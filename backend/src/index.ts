import express, { Express, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session";
import path from "path";
import multer from "multer";
import { PrismaClient } from "@prisma/client";
import passport from "./auth/cas";
import { requireAuth, requireStaff, requireAdmin } from "./middleware/auth";
import { syncOrderToSheet, updateOrderStatusInSheet, updateOrderCommentsInSheet } from "./services/googleSheets";

dotenv.config();

// Multer for multipart file uploads (in-memory, 5MB limit)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const app: Express = express();
const port = process.env.PORT || 3000;

// Middleware
const corsOptions = {
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));
app.use(express.json());

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "bluebite-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
    },
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Initialize Prisma Client
const prisma = new PrismaClient();

// Shared include for menu items (filters archived modifiers, includes groups)
const menuItemInclude = {
  modifiers: { where: { archived: false } },
  modifierGroups: {
    include: { modifiers: { where: { archived: false } } },
    orderBy: { displayOrder: "asc" as const },
  },
};

// ============================================
// SSE (Server-Sent Events) Infrastructure
// ============================================

interface SSEClient {
  id: string;
  res: Response;
  buttery: string | null;
}

const sseClients: SSEClient[] = [];

function broadcastEvent(eventType: string, data: unknown, buttery?: string | null) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  const deadClients: number[] = [];
  for (let i = 0; i < sseClients.length; i++) {
    const client = sseClients[i];
    // Send to all clients, or filter by buttery if both are specified
    if (!buttery || !client.buttery || client.buttery === buttery) {
      try {
        client.res.write(payload);
      } catch {
        console.warn(`[SSE] Failed to write to client ${client.id}, marking for removal`);
        deadClients.push(i);
      }
    }
  }
  // Clean up dead clients (reverse order to preserve indices)
  for (let i = deadClients.length - 1; i >= 0; i--) {
    sseClients.splice(deadClients[i], 1);
  }
}

// SSE endpoint - clients connect here to receive real-time updates
app.get("/api/events", (req: Request, res: Response) => {
  const buttery = (req.query.buttery as string) || null;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "http://localhost:5173",
    "Access-Control-Allow-Credentials": "true",
  });

  // Send initial heartbeat
  res.write("event: connected\ndata: {}\n\n");

  const clientId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const client: SSEClient = { id: clientId, res, buttery };
  sseClients.push(client);

  console.log(`[SSE] Client ${clientId} connected (buttery: ${buttery || "all"}). Total: ${sseClients.length}`);

  // Send heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 30000);

  req.on("close", () => {
    clearInterval(heartbeat);
    const idx = sseClients.findIndex(c => c.id === clientId);
    if (idx !== -1) sseClients.splice(idx, 1);
    console.log(`[SSE] Client ${clientId} disconnected. Total: ${sseClients.length}`);
  });
});

// Health check route
app.get("/", (req: Request, res: Response) => {
  res.json({ message: "BlueBite API is running!", status: "ok" });
});

// Test database connection
app.get("/api/health", async (req: Request, res: Response) => {
  try {
    const result = await prisma.$queryRaw`SELECT 1 as ping`;
    res.json({ status: "Database connected", ping: result });
  } catch {
    res.status(500).json({ error: "Database connection failed" });
  }
});

// CAS Login route - both initiates and handles CAS authentication
app.get(
  "/api/auth/login",
  (req: Request, res: Response, next) => {
    // Log incoming request details for debugging
    const ticket = req.query.ticket;
    const service = req.query.service;

    if (ticket) {
      console.log("CAS callback with ticket:", {
        ticket,
        service,
        originalUrl: req.originalUrl,
        queryParams: req.query
      });
    }

    // Add custom error handling for CAS authentication
    passport.authenticate("cas", { failureRedirect: "/" })(req, res, (err: any) => {
      if (err) {
        console.error("CAS authentication error:", {
          message: err.message,
          cause: err.cause?.message,
          stack: err.stack
        });
        return res.status(500).json({
          error: "Authentication failed",
          message: err.message || err,
          details: err.cause?.message || null
        });
      }
      next();
    });
  },
  (req: Request, res: Response) => {
    // Authentication successful, redirect back to frontend without parameters
    const frontendUrl = process.env.CORS_ORIGIN || "http://localhost:5173";
    res.redirect(frontendUrl);
  }
);

// Logout route
app.post("/api/auth/logout", (req: Request, res: Response) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout failed" });
    }
    res.json({ message: "Logged out successfully" });
  });
});

// Get current authenticated user
app.get("/api/auth/user", (req: Request, res: Response) => {
  if (req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.status(401).json({ error: "Not authenticated" });
  }
});

// Create a user by NetID
app.post("/api/users", async (req: Request, res: Response) => {
  try {
    const { netId, name } = req.body;

    if (!netId) {
      res.status(400).json({ error: "NetID is required" });
      return;
    }

    const user = await prisma.user.create({
      data: {
        netId,
        name: name || null,
      },
    });
    res.status(201).json(user);
  } catch {
    res.status(500).json({ error: "Failed to create user" });
  }
});

// Get all menu items (with optional buttery filter)
app.get("/api/menu", async (req: Request, res: Response) => {
  try {
    const { buttery } = req.query;

    const items = await prisma.menuItem.findMany({
      where: {
        archived: false,
        ...(buttery && { buttery: buttery as string }),
      },
      include: menuItemInclude,
      orderBy: { category: "asc" },
    });
    res.json(items);
  } catch (error) {
    console.error("Menu fetch error:", error);
    res.status(500).json({ error: "Failed to fetch menu items", details: error instanceof Error ? error.message : String(error) });
  }
});

// Create menu item (Admin only)
app.post("/api/menu", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, description, price, category, available, image, hot, buttery } = req.body;

    if (!name || typeof price !== "number" || !category) {
      res.status(400).json({ error: "Name, price, and category are required" });
      return;
    }

    const item = await prisma.menuItem.create({
      data: {
        name,
        description,
        price,
        category,
        available: available !== false,
        hot: hot || false,
        buttery,
        image,
      },
      include: menuItemInclude,
    });
    broadcastEvent("menu:created", item, item.buttery);
    res.status(201).json(item);
  } catch {
    res.status(500).json({ error: "Failed to create menu item" });
  }
});

// Get menu items by category
app.get("/api/menu/category/:category", async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const items = await prisma.menuItem.findMany({
      where: { category },
      include: menuItemInclude,
    });
    res.json(items);
  } catch {
    res.status(500).json({ error: "Failed to fetch menu items" });
  }
});

// Get single menu item
app.get("/api/menu/:itemId", async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const item = await prisma.menuItem.findUnique({
      where: { id: itemId },
      include: menuItemInclude,
    });

    if (!item) {
      res.status(404).json({ error: "Menu item not found" });
      return;
    }

    res.json(item);
  } catch {
    res.status(500).json({ error: "Failed to fetch menu item" });
  }
});

// Create modifier for menu item (Admin only)
app.post("/api/menu/:itemId/modifiers", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const { name, description, price, modifierGroupId } = req.body;

    if (!name || typeof price !== "number") {
      res.status(400).json({ error: "Name and price are required" });
      return;
    }

    const modifier = await prisma.modifier.create({
      data: {
        name,
        description,
        price,
        menuItemId: itemId,
        modifierGroupId: modifierGroupId || null,
      },
    });
    broadcastEvent("menu:updated", { id: itemId, modifierCreated: modifier });
    res.status(201).json(modifier);
  } catch {
    res.status(500).json({ error: "Failed to create modifier" });
  }
});

// Get all modifiers for a menu item (excludes archived)
app.get("/api/menu/:itemId/modifiers", async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const modifiers = await prisma.modifier.findMany({
      where: { menuItemId: itemId, archived: false },
    });
    res.json(modifiers);
  } catch {
    res.status(500).json({ error: "Failed to fetch modifiers" });
  }
});

// Create a new order with items (auto-creates user if doesn't exist)
app.post("/api/orders", async (req: Request, res: Response) => {
  try {
    const { netId, totalPrice, buttery, phone, items } = req.body as {
      netId: string;
      totalPrice: number;
      buttery?: string;
      phone?: string;
      items?: Array<{ menuItemId: string; quantity: number; price: number; modifiers?: string[] }>;
    };

    if (!netId || typeof totalPrice !== "number") {
      res.status(400).json({ error: "Missing required fields: netId and totalPrice" });
      return;
    }

    // Auto-create user if they don't exist
    await prisma.user.upsert({
      where: { netId },
      update: { updatedAt: new Date() },
      create: { netId, role: "customer" },
    });

    // Build order items with snapshot data
    const orderItemsData = await Promise.all((items || []).map(async (item) => {
      // Fetch menu item for name snapshot
      const menuItem = await prisma.menuItem.findUnique({
        where: { id: item.menuItemId },
      });

      // Build modifier connections with snapshot data
      let modifierCreates: { modifierId: string; name: string; price: number }[] = [];

      if (item.modifiers && item.modifiers.length > 0) {
        const availableModifiers = await prisma.modifier.findMany({
          where: {
            menuItemId: item.menuItemId,
            name: { in: item.modifiers },
            archived: false,
          },
        });

        modifierCreates = availableModifiers.map(mod => ({
          modifierId: mod.id,
          name: mod.name,
          price: mod.price,
        }));
      }

      return {
        menuItemId: item.menuItemId,
        name: menuItem?.name || "Unknown Item",
        quantity: item.quantity,
        price: item.price,
        modifiers: {
          create: modifierCreates,
        },
      };
    }));

    const order = await prisma.order.create({
      data: {
        netId,
        totalPrice,
        buttery: buttery || null,
        phone: phone || null,
        status: "pending",
        orderItems: {
          create: orderItemsData,
        },
      },
      include: {
        orderItems: {
          include: {
            modifiers: {
              include: {
                modifier: true,
              },
            },
          },
        },
      },
    });
    broadcastEvent("order:created", order, order.buttery);
    const loggedInUser = req.user as { netId?: string } | undefined;
    syncOrderToSheet(order, loggedInUser?.netId);
    res.status(201).json(order);
  } catch (error) {
    console.error("Order creation error:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// Get all orders (with optional buttery filter)
app.get("/api/orders", async (req: Request, res: Response) => {
  try {
    const { buttery } = req.query;

    const orders = await prisma.order.findMany({
      where: buttery ? { buttery: buttery as string } : undefined,
      include: {
        orderItems: {
          include: {
            modifiers: {
              include: {
                modifier: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  } catch (error) {
    console.error("All orders fetch error:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// Get user's orders (with optional buttery filter)
app.get("/api/users/:netId/orders", async (req: Request, res: Response) => {
  try {
    const { netId } = req.params;
    const { buttery } = req.query;

    const orders = await prisma.order.findMany({
      where: {
        netId,
        ...(buttery && { buttery: buttery as string }),
      },
      include: {
        orderItems: {
          include: {
            modifiers: {
              include: {
                modifier: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  } catch {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// Update order status
app.patch("/api/orders/:orderId", async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!status) {
      res.status(400).json({ error: "Status is required" });
      return;
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status },
      include: {
        orderItems: {
          include: {
            modifiers: {
              include: {
                modifier: true,
              },
            },
          },
        },
      },
    });
    broadcastEvent("order:updated", order, order.buttery);
    updateOrderStatusInSheet(orderId, status);
    res.json(order);
  } catch {
    res.status(500).json({ error: "Failed to update order" });
  }
});

// Update order comments
app.patch("/api/orders/:orderId/comments", async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { comments } = req.body;

    const order = await prisma.order.update({
      where: { id: orderId },
      data: { comments: comments || null },
    });
    broadcastEvent("order:updated", order, order.buttery);
    updateOrderCommentsInSheet(orderId, comments || "");
    res.json(order);
  } catch {
    res.status(500).json({ error: "Failed to update order comments" });
  }
});

// Get list of all butteries
app.get("/api/butteries", async (_req: Request, res: Response) => {
  try {
    const butteries = await prisma.menuItem.groupBy({
      by: ["buttery"],
      _count: true,
    });

    // Filter out nulls and format response
    const formatted = butteries
      .filter(b => b.buttery !== null)
      .map(b => ({
        name: b.buttery,
        itemCount: b._count,
      }))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    res.json(formatted);
  } catch {
    res.status(500).json({ error: "Failed to fetch butteries" });
  }
});

// ============================================
// MENU EDITING ROUTES (RBAC Protected)
// ============================================

// Staff + Admin: Toggle availability or hot status
app.patch("/api/menu/:itemId/toggle", requireAuth, requireStaff, async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const { available, hot } = req.body;

    // Only allow updating available or hot (staff limitation)
    const updates: any = {};
    if (typeof available === 'boolean') updates.available = available;
    if (typeof hot === 'boolean') updates.hot = hot;

    const item = await prisma.menuItem.update({
      where: { id: itemId },
      data: updates,
      include: menuItemInclude,
    });

    broadcastEvent("menu:updated", item, item.buttery);
    res.json(item);
  } catch (error) {
    console.error('Toggle item error:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Admin only: Update entire menu item
app.put("/api/menu/:itemId", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const { name, description, price, category, available, hot, buttery, image } = req.body;

    const item = await prisma.menuItem.update({
      where: { id: itemId },
      data: { name, description, price, category, available, hot, buttery, image },
      include: menuItemInclude,
    });

    broadcastEvent("menu:updated", item, item.buttery);
    res.json(item);
  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Admin only: Archive (soft-delete) menu item
app.delete("/api/menu/:itemId", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;

    const menuItem = await prisma.menuItem.findUnique({
      where: { id: itemId }
    });

    if (!menuItem) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Menu item not found',
        code: 'ITEM_NOT_FOUND'
      });
      return;
    }

    // Soft-delete: just set archived flag, preserve the original name
    await prisma.menuItem.update({
      where: { id: itemId },
      data: { archived: true },
    });

    broadcastEvent("menu:deleted", { id: itemId }, menuItem.buttery);
    res.json({
      success: true,
      message: `Menu item "${menuItem.name}" archived successfully`
    });
  } catch (error) {
    console.error('Archive item error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to archive menu item',
      code: 'ARCHIVE_ERROR'
    });
  }
});

// Admin only: Update modifier
app.put("/api/menu/:itemId/modifiers/:modifierId", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { modifierId } = req.params;
    const { name, description, price, modifierGroupId } = req.body;

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (price !== undefined) data.price = price;
    if (modifierGroupId !== undefined) data.modifierGroupId = modifierGroupId || null;

    const modifier = await prisma.modifier.update({
      where: { id: modifierId },
      data,
    });

    broadcastEvent("menu:updated", { id: req.params.itemId, modifierUpdated: modifier });
    res.json(modifier);
  } catch (error) {
    console.error('Update modifier error:', error);
    res.status(500).json({ error: 'Failed to update modifier' });
  }
});

// Admin only: Soft-delete modifier (archive instead of hard delete)
app.delete("/api/menu/:itemId/modifiers/:modifierId", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { modifierId } = req.params;
    await prisma.modifier.update({
      where: { id: modifierId },
      data: { archived: true },
    });
    broadcastEvent("menu:updated", { id: req.params.itemId, modifierDeleted: modifierId });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete modifier error:', error);
    res.status(500).json({ error: 'Failed to delete modifier' });
  }
});

// ============================================
// MODIFIER GROUP ROUTES (Admin only)
// ============================================

// Create modifier group for a menu item
app.post("/api/menu/:itemId/modifier-groups", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const { name, required, minSelections, maxSelections, displayOrder } = req.body;

    if (!name) {
      res.status(400).json({ error: "Name is required" });
      return;
    }

    const group = await prisma.modifierGroup.create({
      data: {
        name,
        menuItemId: itemId,
        required: required || false,
        minSelections: minSelections || 0,
        maxSelections: maxSelections ?? null,
        displayOrder: displayOrder || 0,
      },
      include: { modifiers: { where: { archived: false } } },
    });

    broadcastEvent("menu:updated", { id: itemId, modifierGroupCreated: group });
    res.status(201).json(group);
  } catch (error) {
    console.error('Create modifier group error:', error);
    res.status(500).json({ error: 'Failed to create modifier group' });
  }
});

// Get all modifier groups for a menu item
app.get("/api/menu/:itemId/modifier-groups", async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const groups = await prisma.modifierGroup.findMany({
      where: { menuItemId: itemId },
      include: { modifiers: { where: { archived: false } } },
      orderBy: { displayOrder: "asc" },
    });
    res.json(groups);
  } catch {
    res.status(500).json({ error: "Failed to fetch modifier groups" });
  }
});

// Update a modifier group
app.put("/api/menu/:itemId/modifier-groups/:groupId", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const { name, required, minSelections, maxSelections, displayOrder } = req.body;

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (required !== undefined) data.required = required;
    if (minSelections !== undefined) data.minSelections = minSelections;
    if (maxSelections !== undefined) data.maxSelections = maxSelections;
    if (displayOrder !== undefined) data.displayOrder = displayOrder;

    const group = await prisma.modifierGroup.update({
      where: { id: groupId },
      data,
      include: { modifiers: { where: { archived: false } } },
    });

    broadcastEvent("menu:updated", { id: req.params.itemId, modifierGroupUpdated: group });
    res.json(group);
  } catch (error) {
    console.error('Update modifier group error:', error);
    res.status(500).json({ error: 'Failed to update modifier group' });
  }
});

// Delete a modifier group (modifiers get unlinked via SET NULL)
app.delete("/api/menu/:itemId/modifier-groups/:groupId", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    await prisma.modifierGroup.delete({ where: { id: groupId } });
    broadcastEvent("menu:updated", { id: req.params.itemId, modifierGroupDeleted: groupId });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete modifier group error:', error);
    res.status(500).json({ error: 'Failed to delete modifier group' });
  }
});

// ============================================
// IMAGE UPLOAD (Supabase Storage)
// ============================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STORAGE_BUCKET = "menu-images";

// Admin only: Upload a menu item image
app.post("/api/upload/menu-image", requireAuth, requireAdmin, upload.single("image"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No image file provided" });
      return;
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      res.status(500).json({ error: "Storage not configured (missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)" });
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(req.file.mimetype)) {
      res.status(400).json({ error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF" });
      return;
    }

    // Generate unique filename: timestamp-random.ext
    const ext = req.file.originalname.split(".").pop() || "jpg";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const storagePath = `${filename}`;

    // Upload to Supabase Storage via REST API (service_role bypasses RLS)
    const uploadResponse = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${storagePath}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": req.file.mimetype,
          "x-upsert": "true",
        },
        body: req.file.buffer,
      }
    );

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("Supabase Storage upload error:", errorText);
      res.status(500).json({ error: "Failed to upload image to storage" });
      return;
    }

    // Build public URL
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${storagePath}`;

    // Optionally update a menu item if itemId is provided
    const { itemId } = req.body;
    if (itemId) {
      await prisma.menuItem.update({
        where: { id: itemId },
        data: { image: publicUrl },
      });
    }

    res.json({ url: publicUrl });
  } catch (error) {
    console.error("Image upload error:", error);
    res.status(500).json({ error: "Failed to upload image" });
  }
});

// Preview routes for design mockups
app.get("/preview", (req: Request, res: Response) => {
  const view = req.query.view as string;
  const viewMap: Record<string, string> = {
    marble: "marble-bg.html",
  };
  const file = viewMap[view];
  if (file) {
    res.sendFile(path.resolve(__dirname, "../../public", file));
  } else {
    res.status(404).send("Preview not found. Available views: " + Object.keys(viewMap).join(", "));
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 BlueBite API running at http://localhost:${port}`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

import express, { Express, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session";
import { PrismaClient } from "@prisma/client";
import passport from "./auth/cas";
import { requireAuth, requireStaff, requireAdmin } from "./middleware/auth";

dotenv.config();

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
      where: buttery ? { buttery: buttery as string } : undefined,
      include: { modifiers: true },
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
      include: { modifiers: true },
    });
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
      include: { modifiers: true },
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
      include: { modifiers: true },
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
    const { name, description, price } = req.body;

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
      },
    });
    res.status(201).json(modifier);
  } catch {
    res.status(500).json({ error: "Failed to create modifier" });
  }
});

// Get all modifiers for a menu item
app.get("/api/menu/:itemId/modifiers", async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const modifiers = await prisma.modifier.findMany({
      where: { menuItemId: itemId },
    });
    res.json(modifiers);
  } catch {
    res.status(500).json({ error: "Failed to fetch modifiers" });
  }
});

// Create a new order with items (auto-creates user if doesn't exist)
app.post("/api/orders", async (req: Request, res: Response) => {
  try {
    const { netId, totalPrice, buttery, items } = req.body as {
      netId: string;
      totalPrice: number;
      buttery?: string;
      items?: Array<{ menuItemId: string; quantity: number; price: number }>;
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

    const order = await prisma.order.create({
      data: {
        netId,
        totalPrice,
        buttery: buttery || null,
        status: "pending",
        orderItems: {
          create: items?.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            price: item.price,
          })) || [],
        },
      },
      include: {
        orderItems: {
          include: { modifiers: true },
        },
      },
    });
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
      include: { orderItems: { include: { modifiers: true } } },
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
      include: { orderItems: { include: { modifiers: true } } },
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
      include: { orderItems: true },
    });
    res.json(order);
  } catch {
    res.status(500).json({ error: "Failed to update order" });
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
      include: { modifiers: true },
    });

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
      include: { modifiers: true },
    });

    res.json(item);
  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Admin only: Delete menu item
app.delete("/api/menu/:itemId", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    await prisma.menuItem.delete({ where: { id: itemId } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Admin only: Update modifier
app.put("/api/menu/:itemId/modifiers/:modifierId", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { modifierId } = req.params;
    const { name, description, price } = req.body;

    const modifier = await prisma.modifier.update({
      where: { id: modifierId },
      data: { name, description, price },
    });

    res.json(modifier);
  } catch (error) {
    console.error('Update modifier error:', error);
    res.status(500).json({ error: 'Failed to update modifier' });
  }
});

// Admin only: Delete modifier
app.delete("/api/menu/:itemId/modifiers/:modifierId", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { modifierId } = req.params;
    await prisma.modifier.delete({ where: { id: modifierId } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete modifier error:', error);
    res.status(500).json({ error: 'Failed to delete modifier' });
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

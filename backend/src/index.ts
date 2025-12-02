import express, { Express, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

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

// Create menu item
app.post("/api/menu", async (req: Request, res: Response) => {
  try {
    const { name, description, price, category, available, image } = req.body;

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

// Create modifier for menu item
app.post("/api/menu/:itemId/modifiers", async (req: Request, res: Response) => {
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

// Start server
app.listen(port, () => {
  console.log(`🚀 BlueBite API running at http://localhost:${port}`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

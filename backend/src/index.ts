import express, { Express, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
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
  } catch (error) {
    res.status(500).json({ error: "Database connection failed" });
  }
});

// Create a test user
app.post("/api/users", async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password required" });
      return;
    }

    const user = await prisma.user.create({
      data: {
        email,
        password,
        name: name || email.split("@")[0],
      },
    });
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to create user" });
  }
});

// Get all menu items
app.get("/api/menu", async (req: Request, res: Response) => {
  try {
    const items = await prisma.menuItem.findMany({
      include: { modifiers: true },
      orderBy: { category: "asc" },
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch menu items" });
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch modifiers" });
  }
});

// Create a new order
app.post("/api/orders", async (req: Request, res: Response) => {
  try {
    const { userId, totalPrice } = req.body;

    if (!userId || typeof totalPrice !== "number") {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const order = await prisma.order.create({
      data: {
        userId,
        totalPrice,
        status: "pending",
      },
      include: { orderItems: true },
    });
    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ error: "Failed to create order" });
  }
});

// Get user's orders
app.get("/api/users/:userId/orders", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const orders = await prisma.order.findMany({
      where: { userId },
      include: { orderItems: { include: { modifiers: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  } catch (error) {
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
  } catch (error) {
    res.status(500).json({ error: "Failed to update order" });
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

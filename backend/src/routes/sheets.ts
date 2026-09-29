import express, { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";
import { requireAuth, requireStaff } from "../middleware/auth";
import { orderCreateLimiter } from "../middleware/rateLimit";
import type { SheetsMirror } from "../services/sheets/mirror";
import {
  MenuItemNotFoundError,
  OrderNotFoundError,
  OrderValidationError,
  RowMovedError,
  type SheetsStore,
} from "../services/sheets/store";
import { BUTTERY_NAME, DRIVE_FILE_ID, type OrderStatus } from "../services/sheets/model";
import { DriveImageCache } from "../services/sheets/drive";

const ORDER_STATUSES: ReadonlySet<string> = new Set<OrderStatus>([
  "awaiting_payment",
  "payment_failed",
  "pending",
  "preparing",
  "ready",
  "completed",
  "cancelled",
]);

interface SheetsRouterDeps {
  mirror: SheetsMirror;
  store: SheetsStore;
  images?: DriveImageCache;
}

function sendError(res: Response, error: unknown, fallback: string): void {
  if (error instanceof OrderValidationError) {
    res.status(400).json({ error: error.message });
  } else if (error instanceof OrderNotFoundError || error instanceof MenuItemNotFoundError) {
    res.status(404).json({ error: "Not found" });
  } else if (error instanceof RowMovedError) {
    res.status(409).json({ error: error.message, code: "SHEET_CHANGED" });
  } else {
    console.error(`[Sheets] ${fallback}:`, error);
    res.status(500).json({ error: fallback });
  }
}

function secretMatches(provided: unknown, expected: string): boolean {
  if (typeof provided !== "string") return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Sheets-backed replacements for the Prisma routes. Mounted ahead of them when
 * STORE=sheets, so the old handlers are never reached for these paths. The menu
 * (items, modifiers, groups, images) is edited in the sheet itself, so its
 * write endpoints are disabled rather than silently diverging from it.
 */
export function createSheetsRouter({ mirror, store, images = new DriveImageCache() }: SheetsRouterDeps) {
  const router = express.Router();

  const forThisButtery = (buttery: unknown) => !buttery || buttery === BUTTERY_NAME;

  router.get("/api/health", (_req, res) => {
    res.json({ status: "Sheets store", loaded: mirror.isLoaded(), orders: mirror.getOrders().length });
  });

  // Apps Script onEdit trigger -> refresh now instead of waiting for the next poll.
  router.post("/api/sheets/webhook", async (req, res) => {
    const secret = process.env.SHEETS_WEBHOOK_SECRET;
    if (!secret) {
      res.status(503).json({ error: "Webhook disabled (SHEETS_WEBHOOK_SECRET not set)" });
      return;
    }
    if (!secretMatches(req.get("x-webhook-secret"), secret)) {
      res.status(401).json({ error: "Invalid webhook secret" });
      return;
    }
    if (mirror.isShared()) {
      try {
        await mirror.refreshNow();
      } catch {
        res.status(502).json({ error: "Refresh failed" }); // Apps Script may retry
        return;
      }
      res.status(200).json({ ok: true });
      return;
    }
    mirror.requestRefresh();
    res.status(202).json({ ok: true });
  });

  // ---- Menu (read from the mirror) ----------------------------------------

  const menuWriteBlocked = (req: Request, res: Response, next: NextFunction) => {
    if (req.method === "GET" || req.method === "PATCH") {
      next();
      return;
    }
    res.status(501).json({
      error: "The menu is managed in the Google Sheet. Edit the Menu and Modifiers tabs there.",
      code: "MANAGED_IN_SHEET",
    });
  };
  router.use("/api/menu", menuWriteBlocked);
  router.use("/api/upload", (_req, res) => {
    res.status(501).json({
      error: "Image upload is disabled. Add the image to the shared Drive folder and paste its link in the Menu tab's Image URL column.",
      code: "MANAGED_IN_SHEET",
    });
  });

  // Serves images that Menu rows point at via a Google Drive link (the service account reads them from Drive).
  // Only files currently referenced by the menu are served, so this can't be used to read other Drive files.
  router.get("/api/images/:fileId", async (req, res) => {
    const { fileId } = req.params;
    if (!DRIVE_FILE_ID.test(fileId) || !mirror.isMenuImage(fileId)) {
      res.status(404).json({ error: "Image not found" });
      return;
    }
    try {
      const image = await images.get(fileId);
      res.set({
        "Content-Type": image.contentType,
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "cross-origin", // the frontend is on a different origin
      });
      res.send(image.data);
    } catch (error) {
      console.error(`[Sheets] Could not load Drive image ${fileId}:`, error instanceof Error ? error.message : error);
      res.status(502).json({ error: "Could not load image from Drive" });
    }
  });

  router.get("/api/menu", (req, res) => {
    res.json(forThisButtery(req.query.buttery) ? mirror.getMenu() : []);
  });

  router.get("/api/menu/category/:category", (req, res) => {
    res.json(mirror.getMenu().filter((m) => m.category === req.params.category));
  });

  router.get("/api/menu/:itemId", (req, res) => {
    const item = mirror.getMenuItem(req.params.itemId);
    if (!item) {
      res.status(404).json({ error: "Menu item not found" });
      return;
    }
    res.json(item);
  });

  router.get("/api/menu/:itemId/modifiers", (req, res) => {
    res.json(mirror.getMenuItem(req.params.itemId)?.modifiers ?? []);
  });

  router.get("/api/menu/:itemId/modifier-groups", (req, res) => {
    res.json(mirror.getMenuItem(req.params.itemId)?.modifierGroups ?? []);
  });

  router.patch("/api/menu/:itemId/toggle", requireAuth, requireStaff, async (req, res) => {
    const { available, hot } = req.body ?? {};
    try {
      const item = await store.setMenuFlags(req.params.itemId, {
        ...(typeof available === "boolean" && { available }),
        ...(typeof hot === "boolean" && { hot }),
      });
      res.json(item);
    } catch (error) {
      sendError(res, error, "Failed to update item");
    }
  });

  router.get("/api/butteries", (_req, res) => {
    res.json([{ name: BUTTERY_NAME, itemCount: mirror.getMenu().length }]);
  });

  // Users live in the Roles tab now; anyone not listed there is a customer, so there is nothing to create.
  router.post("/api/users", (req, res) => {
    const { netId, name } = req.body ?? {};
    if (!netId) {
      res.status(400).json({ error: "NetID is required" });
      return;
    }
    res.status(201).json({ netId, name: name || null, role: mirror.getRole(netId) });
  });

  // ---- Orders -------------------------------------------------------------

  router.post("/api/orders", orderCreateLimiter, async (req, res) => {
    const { netId, phone, items } = req.body ?? {};
    try {
      const order = await store.createOrder({ netId, phone, items });
      res.status(201).json(order);
    } catch (error) {
      sendError(res, error, "Failed to create order");
    }
  });

  router.get("/api/orders", (req, res) => {
    res.json(forThisButtery(req.query.buttery) ? mirror.getOrders() : []);
  });

  router.get("/api/users/:netId/orders", (req, res) => {
    res.json(forThisButtery(req.query.buttery) ? mirror.getOrders({ netId: req.params.netId }) : []);
  });

  router.patch("/api/orders/:orderId", async (req, res) => {
    const { status } = req.body ?? {};
    if (!status) {
      res.status(400).json({ error: "Status is required" });
      return;
    }
    if (!ORDER_STATUSES.has(status)) {
      res.status(400).json({ error: `Invalid status: ${status}` });
      return;
    }
    try {
      res.json(await store.updateOrder(req.params.orderId, { status }));
    } catch (error) {
      sendError(res, error, "Failed to update order");
    }
  });

  router.patch("/api/orders/:orderId/comments", async (req, res) => {
    const comments = typeof req.body?.comments === "string" ? req.body.comments.slice(0, 1000) : "";
    try {
      res.json(await store.updateOrder(req.params.orderId, { comments }));
    } catch (error) {
      sendError(res, error, "Failed to update order comments");
    }
  });

  return router;
}

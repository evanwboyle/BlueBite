import express, { Request, Response } from "express";
import { randomUUID } from "crypto";
import { requireAuth, requireAdmin, AuthenticatedRequest } from "../middleware/auth";
import {
  paymentInitiateLimiter,
  paymentStatusLimiter,
  paymentCancelLimiter,
  paymentAdminLimiter,
} from "../middleware/rateLimit";
import { getPaymentProvider, TERMINAL_PAYMENT_STATUSES, type PaymentResult, type PaymentStatus } from "../services/payments";
import { createPaymentStore, type PaymentStore, type PaymentRecord } from "../services/payments/paymentStore";
import type { MockPaymentProvider } from "../services/payments/mockProvider";
import type { SheetsMirror } from "../services/sheets/mirror";
import { OrderNotFoundError, type SheetsStore } from "../services/sheets/store";
import { BUTTERY_NAME } from "../services/sheets/model";

interface Deps {
  paymentStore?: PaymentStore;
  mirror: SheetsMirror;
  store: SheetsStore;
  broadcastEvent: (eventType: string, data: unknown, buttery?: string | null) => void;
}

// Longer than the 55s Clover request, so a live attempt is never mistaken for a dead one.
const PAYMENT_STALE_MS = 90_000;
const PERSIST_ATTEMPTS = 5;
const PERSIST_RETRY_MS = 2_000;

function log(paymentId: string, type: string, actor: string, message?: string) {
  console.log(`[PAYMENT] ${new Date().toISOString()} paymentId=${paymentId} type=${type} actor=${actor}${message ? ` message=${message}` : ""}`);
}

function serialize(p: PaymentRecord) {
  return {
    id: p.id,
    orderId: p.orderId,
    provider: p.provider,
    status: p.status,
    amount: p.amount,
    currency: p.currency,
    errorMessage: p.errorMessage,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createSheetsPaymentsRouter({ mirror, store, broadcastEvent, paymentStore = createPaymentStore() }: Deps) {
  const router = express.Router();
  const provider = getPaymentProvider();

  /** What the frontend sees for an order that was paid before this process started (or by hand in the sheet). */
  function recordFromSheet(orderId: string): PaymentRecord | null {
    const parsed = mirror.getOrder(orderId);
    if (!parsed?.paid) return null;
    return {
      id: parsed.paymentId || orderId,
      orderId,
      provider: "sheet",
      status: "succeeded",
      amount: parsed.order.totalPrice,
      currency: "USD",
      providerRef: parsed.paymentId || null,
      errorMessage: null,
      createdAt: new Date(parsed.order.createdAt),
      updatedAt: new Date(parsed.order.updatedAt),
    };
  }

  /**
   * The card has been charged at this point, so failing to record it must be loud
   * and must be retried: the Clover ID logged here is what a human reconciles from.
   */
  async function persistPaid(record: PaymentRecord, paymentRef: string): Promise<void> {
    for (let attempt = 1; attempt <= PERSIST_ATTEMPTS; attempt++) {
      try {
        await store.markPaid(record.orderId, paymentRef);
        return;
      } catch (error) {
        if (error instanceof OrderNotFoundError) {
          console.error(`[PAYMENT] CRITICAL: order ${record.orderId} paid (ref ${paymentRef}) but its row no longer exists in the sheet`);
          return;
        }
        console.error(`[PAYMENT] Failed to record payment for order ${record.orderId} (attempt ${attempt}/${PERSIST_ATTEMPTS}):`, error);
        if (attempt < PERSIST_ATTEMPTS) await sleep(PERSIST_RETRY_MS * attempt);
      }
    }
    console.error(
      `[PAYMENT] CRITICAL: order ${record.orderId} was PAID (ref ${paymentRef}, $${record.amount.toFixed(2)}) but could not be written to the sheet. Tick Paid and paste the ref by hand.`
    );
  }

  /**
   * Applies a (possibly asynchronous) provider result. Payments are never re-opened
   * once terminal, so a late device callback after a cancel is logged and ignored.
   */
  async function applyResult(paymentId: string, result: PaymentResult, actor: string, paymentRef?: string) {
    const record = await paymentStore.getById(paymentId);
    if (!record) return;

    if (TERMINAL_PAYMENT_STATUSES.has(record.status)) {
      log(paymentId, "ignored_late_result", actor, `Ignoring ${result.status} - payment already ${record.status}`);
      return;
    }

    record.status = result.status;
    record.providerRef = result.providerRef ?? record.providerRef;
    record.errorMessage = result.errorMessage ?? null;
    record.updatedAt = new Date();
    await paymentStore.save(record);
    log(paymentId, "status_change", actor, `Payment status -> ${result.status}`);

    // Tell the client first: the tap already happened, the sheet write can take a moment.
    broadcastEvent("payment:updated", serialize(record), BUTTERY_NAME);

    if (result.status === "succeeded" || result.status === "bypassed") {
      await persistPaid(record, paymentRef ?? record.providerRef ?? `${record.provider}:${record.id}`);
    } else if (result.status === "cancelled") {
      await store.updateOrder(record.orderId, { status: "cancelled" }).catch((error) => {
        console.error(`[PAYMENT] Failed to mark order ${record.orderId} cancelled:`, error);
      });
    }
    // failed / error / expired: the order stays unpaid (awaiting_payment) and can be retried.
  }

  provider.setResultHandler((paymentId, result) => {
    applyResult(paymentId, result, provider.name === "clover" ? "device" : "mock-device").catch((err) => {
      console.error(`[PAYMENT] Failed to apply async result for ${paymentId}:`, err);
    });
  });

  // POST /api/orders/:orderId/payment - send the sale request to the device.
  router.post("/:orderId/payment", paymentInitiateLimiter, async (req: Request, res: Response) => {
    try {
      const { orderId } = req.params;
      const parsed = mirror.getOrder(orderId);
      if (!parsed) {
        res.status(404).json({ error: "Order not found" });
        return;
      }
      if (parsed.paid) {
        res.status(409).json({ error: "Order has already been paid", code: "ALREADY_PAID" });
        return;
      }
      if (parsed.manual || parsed.order.totalPrice <= 0) {
        res.status(400).json({ error: "This order has no payable amount", code: "NOT_PAYABLE" });
        return;
      }

      const existing = await paymentStore.getByOrder(orderId);
      const inFlight = existing && (existing.status === "requested" || existing.status === "awaiting_device");
      // A function that died mid-request leaves its record non-terminal forever. Past the
      // stale window, retry under the SAME payment id so Clover's idempotency key stops a double charge.
      const stale = inFlight && Date.now() - existing.updatedAt.getTime() > PAYMENT_STALE_MS;
      if (inFlight && !stale) {
        res.status(200).json(serialize(existing)); // in flight: never double-charge
        return;
      }

      const now = new Date();
      const record: PaymentRecord = {
        id: stale ? existing.id : randomUUID(),
        orderId,
        provider: provider.name,
        status: "requested",
        amount: parsed.order.totalPrice, // from the sheet's Total, never from the client
        currency: "USD",
        providerRef: null,
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
      };
      await paymentStore.save(record);
      const actor = (req.body?.netId as string | undefined) || parsed.order.netId;
      log(record.id, "requested", actor, `order ${orderId} ($${record.amount.toFixed(2)}) via ${provider.name}`);

      const result = await provider.requestPayment({
        paymentId: record.id,
        orderId,
        amount: record.amount,
        currency: "USD",
      });
      await applyResult(record.id, result, actor);

      res.status(202).json(serialize(record));
    } catch (error) {
      console.error("Payment initiation error:", error);
      res.status(500).json({ error: "Failed to initiate payment" });
    }
  });

  // GET /api/orders/:orderId/payment - polling fallback for SSE.
  router.get("/:orderId/payment", paymentStatusLimiter, async (req: Request, res: Response) => {
    const record = (await paymentStore.getByOrder(req.params.orderId).catch(() => null)) ?? recordFromSheet(req.params.orderId);
    if (!record) {
      res.status(404).json({ error: "No payment found for this order" });
      return;
    }
    res.json(serialize(record));
  });

  // POST /api/orders/:orderId/payment/cancel - customer backs out, or staff aborts a stuck attempt.
  router.post("/:orderId/payment/cancel", paymentCancelLimiter, async (req: Request, res: Response) => {
    try {
      const record = await paymentStore.getByOrder(req.params.orderId);
      if (!record) {
        res.status(404).json({ error: "No payment found for this order" });
        return;
      }
      if (TERMINAL_PAYMENT_STATUSES.has(record.status)) {
        res.status(200).json(serialize(record));
        return;
      }
      const result = await provider.cancelPayment({ paymentId: record.id, providerRef: record.providerRef });
      await applyResult(record.id, result, "customer");
      res.json(serialize(record));
    } catch (error) {
      console.error("Payment cancel error:", error);
      res.status(500).json({ error: "Failed to cancel payment" });
    }
  });

  // POST /api/orders/:orderId/payment/bypass - admin-only escape hatch (device down, cash taken, etc).
  // Writes BYPASS:<netId> into the Clover Payment ID column so the sheet shows who released it.
  router.post("/:orderId/payment/bypass", requireAuth, requireAdmin, paymentAdminLimiter, async (req: Request, res: Response) => {
    try {
      if (process.env.PAYMENT_BYPASS_ENABLED === "false") {
        res.status(403).json({ error: "Payment bypass is disabled on this server", code: "BYPASS_DISABLED" });
        return;
      }

      const { orderId } = req.params;
      const reason = typeof req.body?.reason === "string" ? req.body.reason.slice(0, 500) : null;
      const admin = (req as AuthenticatedRequest).user!;

      const parsed = mirror.getOrder(orderId);
      if (!parsed) {
        res.status(404).json({ error: "Order not found" });
        return;
      }
      if (parsed.paid) {
        res.status(409).json({ error: "Order already has a finalized payment", code: "ALREADY_FINALIZED" });
        return;
      }

      const now = new Date();
      const record: PaymentRecord = {
        id: randomUUID(),
        orderId,
        provider: "bypass",
        status: "requested",
        amount: parsed.order.totalPrice,
        currency: "USD",
        providerRef: null,
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
      };
      await paymentStore.save(record);

      console.warn(`[PAYMENT] BYPASS: order=${orderId} admin=${admin.netId} reason=${reason ?? "(none given)"}`);
      await applyResult(record.id, { status: "bypassed" }, `admin:${admin.netId}`, `BYPASS:${admin.netId}`);
      res.json(serialize(record));
    } catch (error) {
      console.error("Payment bypass error:", error);
      res.status(500).json({ error: "Failed to bypass payment" });
    }
  });

  // POST /api/orders/:orderId/payment/simulate - debug-only, mock provider only.
  router.post("/:orderId/payment/simulate", requireAuth, requireAdmin, paymentAdminLimiter, async (req: Request, res: Response) => {
    if (process.env.PAYMENTS_DEBUG_MODE !== "true" || provider.name !== "mock") {
      res.status(403).json({
        error: "Payment simulation is only available when PAYMENTS_DEBUG_MODE=true and PAYMENT_PROVIDER=mock",
        code: "SIMULATION_DISABLED",
      });
      return;
    }
    const outcome = req.body?.outcome;
    if (!["succeeded", "failed", "cancelled"].includes(outcome)) {
      res.status(400).json({ error: "outcome must be one of: succeeded, failed, cancelled" });
      return;
    }
    const record = await paymentStore.getByOrder(req.params.orderId);
    if (!record) {
      res.status(404).json({ error: "No payment found for this order" });
      return;
    }
    const admin = (req as AuthenticatedRequest).user!;
    log(record.id, "debug_simulate", `admin:${admin.netId}`, `Forced outcome: ${outcome}`);
    res.json({ ok: (provider as MockPaymentProvider).forceOutcome(record.id, outcome) });
  });

  return router;
}

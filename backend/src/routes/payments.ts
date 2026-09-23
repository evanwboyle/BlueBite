import express, { Request, Response } from "express";
import { randomUUID } from "crypto";
import type { PrismaClient } from "@prisma/client";
import { requireAuth, requireAdmin, AuthenticatedRequest } from "../middleware/auth";
import {
  paymentInitiateLimiter,
  paymentStatusLimiter,
  paymentCancelLimiter,
  paymentAdminLimiter,
} from "../middleware/rateLimit";
import {
  getPaymentProvider,
  logPaymentEvent,
  TERMINAL_PAYMENT_STATUSES,
  type PaymentResult,
  type PaymentStatus,
} from "../services/payments";
import type { MockPaymentProvider } from "../services/payments/mockProvider";

interface PaymentsRouterDeps {
  prisma: PrismaClient;
  broadcastEvent: (eventType: string, data: unknown, buttery?: string | null) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  syncOrderToSheet: (order: any, submittedByNetId?: string) => void;
}

const orderItemsInclude = {
  orderItems: {
    include: { modifiers: { include: { modifier: true } } },
  },
} as const;

function orderStatusForPaymentStatus(status: PaymentStatus): string | null {
  switch (status) {
    case "succeeded":
    case "bypassed":
      return "pending"; // released to the kitchen queue
    case "cancelled":
      return "cancelled";
    case "failed":
    case "error":
    case "expired":
      return "payment_failed";
    default:
      return null; // requested / awaiting_device - order stays awaiting_payment
  }
}

export function createPaymentsRouter({ prisma, broadcastEvent, syncOrderToSheet }: PaymentsRouterDeps) {
  const router = express.Router();
  const provider = getPaymentProvider();

  /**
   * Applies a (possibly asynchronous) payment result to the DB + order status
   * + SSE stream. Shared by the route handlers (synchronous result from the
   * initial request/cancel/bypass call) and the provider's result handler
   * (the device's eventual tap/decline, delivered out-of-band later).
   *
   * Payments are never re-opened once terminal: a stale/duplicate callback
   * arriving after we've already resolved a payment (e.g. a device response
   * landing after we cancelled) is logged and ignored rather than clobbering
   * a state a human may already be acting on.
   */
  async function applyPaymentResult(paymentId: string, result: PaymentResult, actor = "device") {
    const existing = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!existing) return;

    if (TERMINAL_PAYMENT_STATUSES.has(existing.status as PaymentStatus)) {
      await logPaymentEvent({
        paymentId,
        type: "ignored_late_result",
        actor,
        message: `Ignoring ${result.status} result - payment already terminal (${existing.status})`,
        payload: result,
      });
      return;
    }

    const payment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: result.status,
        providerRef: result.providerRef ?? existing.providerRef,
        errorMessage: result.errorMessage ?? null,
        rawResult: result.raw ? (result.raw as object) : undefined,
      },
    });

    await logPaymentEvent({
      paymentId,
      type: "status_change",
      actor,
      message: `Payment status -> ${result.status}`,
      payload: { providerRef: result.providerRef, errorMessage: result.errorMessage },
    });

    const newOrderStatus = orderStatusForPaymentStatus(result.status);
    let order = await prisma.order.findUnique({ where: { id: payment.orderId }, include: orderItemsInclude });
    if (!order) return;

    if (newOrderStatus && newOrderStatus !== order.status) {
      order = await prisma.order.update({
        where: { id: order.id },
        data: { status: newOrderStatus },
        include: orderItemsInclude,
      });

      if (newOrderStatus === "pending") {
        syncOrderToSheet(order, payment.requestedByNetId ?? payment.bypassedByNetId ?? undefined);
      }
    }

    broadcastEvent("order:updated", order, order.buttery);
    broadcastEvent("payment:updated", serializePayment(payment), order.buttery);
  }

  provider.setResultHandler((paymentId, result) => {
    applyPaymentResult(paymentId, result, provider.name === "clover" ? "device" : "mock-device").catch((err) => {
      console.error(`[PAYMENT] Failed to apply async result for ${paymentId}:`, err);
    });
  });

  function serializePayment(payment: {
    id: string;
    orderId: string;
    provider: string;
    status: string;
    amount: number;
    currency: string;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: payment.id,
      orderId: payment.orderId,
      provider: payment.provider,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      errorMessage: payment.errorMessage,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }

  // POST /api/orders/:orderId/payment - send the sale request to the device.
  router.post("/:orderId/payment", paymentInitiateLimiter, async (req: Request, res: Response) => {
    try {
      const { orderId } = req.params;
      const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payment: true } });
      if (!order) {
        res.status(404).json({ error: "Order not found" });
        return;
      }

      if (order.payment) {
        if (order.payment.status === "requested" || order.payment.status === "awaiting_device") {
          // Already in flight - hand back current state instead of double-charging.
          res.status(200).json(serializePayment(order.payment));
          return;
        }
        if (order.payment.status === "succeeded" || order.payment.status === "bypassed") {
          res.status(409).json({ error: "Order has already been paid", code: "ALREADY_PAID" });
          return;
        }
      }

      // Amount is always derived from the persisted order total, never from the client.
      const amount = order.totalPrice;
      const paymentId = order.payment?.id ?? randomUUID();
      const requestedByNetId = (req.body?.netId as string | undefined) || order.netId;

      const payment = await prisma.payment.upsert({
        where: { orderId: order.id },
        create: {
          id: paymentId,
          orderId: order.id,
          provider: provider.name,
          status: "requested",
          amount,
          currency: "USD",
          externalPaymentId: paymentId,
          requestedByNetId,
        },
        update: {
          status: "requested",
          providerRef: null,
          errorMessage: null,
          rawResult: undefined,
          requestedByNetId,
        },
      });

      await logPaymentEvent({
        paymentId: payment.id,
        type: "requested",
        actor: requestedByNetId,
        message: `Payment requested for order ${order.id} ($${amount.toFixed(2)}) via ${provider.name}`,
      });

      const result = await provider.requestPayment({
        paymentId: payment.id,
        orderId: order.id,
        amount,
        currency: "USD",
      });

      await applyPaymentResult(payment.id, result, requestedByNetId);

      const latest = await prisma.payment.findUnique({ where: { id: payment.id } });
      res.status(202).json(serializePayment(latest!));
    } catch (error) {
      console.error("Payment initiation error:", error);
      res.status(500).json({ error: "Failed to initiate payment" });
    }
  });

  // GET /api/orders/:orderId/payment - poll current status (SSE payment:updated is primary; this is the fallback).
  router.get("/:orderId/payment", paymentStatusLimiter, async (req: Request, res: Response) => {
    try {
      const payment = await prisma.payment.findUnique({ where: { orderId: req.params.orderId } });
      if (!payment) {
        res.status(404).json({ error: "No payment found for this order" });
        return;
      }
      res.json(serializePayment(payment));
    } catch {
      res.status(500).json({ error: "Failed to fetch payment status" });
    }
  });

  // POST /api/orders/:orderId/payment/cancel - customer backs out, or staff aborts a stuck attempt.
  router.post("/:orderId/payment/cancel", paymentCancelLimiter, async (req: Request, res: Response) => {
    try {
      const payment = await prisma.payment.findUnique({ where: { orderId: req.params.orderId } });
      if (!payment) {
        res.status(404).json({ error: "No payment found for this order" });
        return;
      }

      if (TERMINAL_PAYMENT_STATUSES.has(payment.status as PaymentStatus)) {
        res.status(200).json(serializePayment(payment));
        return;
      }

      const result = await provider.cancelPayment({ paymentId: payment.id, providerRef: payment.providerRef });
      await applyPaymentResult(payment.id, result, "customer");

      const latest = await prisma.payment.findUnique({ where: { id: payment.id } });
      res.json(serializePayment(latest!));
    } catch (error) {
      console.error("Payment cancel error:", error);
      res.status(500).json({ error: "Failed to cancel payment" });
    }
  });

  // POST /api/orders/:orderId/payment/bypass - admin-only escape hatch (device down, cash taken instead, etc).
  // Every use is logged with the admin's netId and reason - this is the one path that releases
  // an order to the kitchen without a confirmed device payment, so it's deliberately loud.
  router.post(
    "/:orderId/payment/bypass",
    requireAuth,
    requireAdmin,
    paymentAdminLimiter,
    async (req: Request, res: Response) => {
      try {
        if (process.env.PAYMENT_BYPASS_ENABLED === "false") {
          res.status(403).json({ error: "Payment bypass is disabled on this server", code: "BYPASS_DISABLED" });
          return;
        }

        const { orderId } = req.params;
        const reason = typeof req.body?.reason === "string" ? req.body.reason.slice(0, 500) : null;
        const admin = (req as AuthenticatedRequest).user!;

        const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payment: true } });
        if (!order) {
          res.status(404).json({ error: "Order not found" });
          return;
        }
        if (order.payment && (order.payment.status === "succeeded" || order.payment.status === "bypassed")) {
          res.status(409).json({ error: "Order already has a finalized payment", code: "ALREADY_FINALIZED" });
          return;
        }

        const paymentId = order.payment?.id ?? randomUUID();
        const payment = await prisma.payment.upsert({
          where: { orderId: order.id },
          create: {
            id: paymentId,
            orderId: order.id,
            provider: "bypass",
            status: "bypassed",
            amount: order.totalPrice,
            currency: "USD",
            externalPaymentId: paymentId,
            bypassedByNetId: admin.netId,
            bypassReason: reason,
          },
          update: {
            status: "bypassed",
            provider: "bypass",
            bypassedByNetId: admin.netId,
            bypassReason: reason,
            errorMessage: null,
          },
        });

        console.warn(`[PAYMENT] BYPASS: order=${order.id} admin=${admin.netId} reason=${reason ?? "(none given)"}`);
        await logPaymentEvent({
          paymentId: payment.id,
          type: "bypassed",
          actor: `admin:${admin.netId}`,
          message: reason ?? "No reason given",
        });

        await applyPaymentResult(payment.id, { status: "bypassed" }, `admin:${admin.netId}`);

        const latest = await prisma.payment.findUnique({ where: { id: payment.id } });
        res.json(serializePayment(latest!));
      } catch (error) {
        console.error("Payment bypass error:", error);
        res.status(500).json({ error: "Failed to bypass payment" });
      }
    }
  );

  // POST /api/orders/:orderId/payment/simulate - debug-only, mock provider only.
  // Lets the team drive the "manual" mock outcome (see MockPaymentProvider) from a real
  // admin session instead of waiting out MOCK_PAYMENT_DELAY_MS, without needing any device.
  router.post(
    "/:orderId/payment/simulate",
    requireAuth,
    requireAdmin,
    paymentAdminLimiter,
    async (req: Request, res: Response) => {
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

      const payment = await prisma.payment.findUnique({ where: { orderId: req.params.orderId } });
      if (!payment) {
        res.status(404).json({ error: "No payment found for this order" });
        return;
      }

      const admin = (req as AuthenticatedRequest).user!;
      const ok = (provider as MockPaymentProvider).forceOutcome(payment.id, outcome);
      await logPaymentEvent({
        paymentId: payment.id,
        type: "debug_simulate",
        actor: `admin:${admin.netId}`,
        message: `Forced outcome: ${outcome}`,
      });

      res.json({ ok });
    }
  );

  return router;
}

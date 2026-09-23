import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Every payment lifecycle transition goes through here: a structured console
 * line for live tailing/ops, plus a permanent PaymentEvent row for audit
 * (who initiated it, what the device/provider said, admin bypasses, etc).
 * Never throws - a logging failure must not break the payment flow.
 */
export async function logPaymentEvent(params: {
  paymentId: string;
  type: string;
  actor?: string | null;
  message?: string | null;
  payload?: unknown;
}): Promise<void> {
  const { paymentId, type, actor, message, payload } = params;

  console.log(
    `[PAYMENT] ${new Date().toISOString()} paymentId=${paymentId} type=${type} actor=${actor ?? "system"}${
      message ? ` message=${message}` : ""
    }`
  );

  try {
    await prisma.paymentEvent.create({
      data: {
        paymentId,
        type,
        actor: actor ?? null,
        message: message ?? null,
        payload: payload === undefined ? Prisma.JsonNull : (payload as Prisma.InputJsonValue),
      },
    });
  } catch (err) {
    console.error(`[PAYMENT] Failed to persist audit event for ${paymentId}:`, err);
  }
}

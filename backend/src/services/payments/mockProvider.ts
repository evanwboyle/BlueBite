import type {
  PaymentProvider,
  PaymentRequestParams,
  PaymentCancelParams,
  PaymentResult,
  PaymentResultHandler,
} from "./types";
import { logPaymentEvent } from "./paymentLogger";

/**
 * In-process payment terminal simulator. No network calls, no Clover account
 * needed - this is what runs by default (PAYMENT_PROVIDER unset or "mock")
 * so the whole order -> "tap to pay" -> confirmation flow can be built and
 * tested without any physical device.
 *
 * Outcome is controlled by MOCK_PAYMENT_OUTCOME:
 *   "succeed" (default) - resolves to succeeded after MOCK_PAYMENT_DELAY_MS
 *   "fail"               - resolves to failed (simulated decline)
 *   "manual"             - stays in awaiting_device until a debug endpoint
 *                          (POST /api/orders/:orderId/payment/simulate) forces
 *                          an outcome, or it's cancelled, or it times out.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock" as const;

  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private onResult: PaymentResultHandler | null = null;

  setResultHandler(handler: PaymentResultHandler): void {
    this.onResult = handler;
  }

  async requestPayment(params: PaymentRequestParams): Promise<PaymentResult> {
    const outcome = (process.env.MOCK_PAYMENT_OUTCOME || "succeed").toLowerCase();
    const delayMs = Number(process.env.MOCK_PAYMENT_DELAY_MS ?? 3000);
    const providerRef = `mock_${params.paymentId}`;

    await logPaymentEvent({
      paymentId: params.paymentId,
      type: "device_request_sent",
      actor: "mock-device",
      message: `Simulated device prompt shown for $${params.amount.toFixed(2)} (outcome=${outcome})`,
    });

    if (outcome === "manual") {
      // Caller stays in "awaiting_device" until /simulate, cancel, or timeout fires.
      return { status: "awaiting_device", providerRef };
    }

    const timer = setTimeout(async () => {
      this.timers.delete(params.paymentId);
      const result: PaymentResult =
        outcome === "fail"
          ? { status: "failed", providerRef, errorMessage: "Simulated card decline" }
          : { status: "succeeded", providerRef };
      await logPaymentEvent({
        paymentId: params.paymentId,
        type: "device_response",
        actor: "mock-device",
        message: `Simulated outcome: ${result.status}`,
      });
      this.onResult?.(params.paymentId, result);
    }, delayMs);
    this.timers.set(params.paymentId, timer);

    return { status: "awaiting_device", providerRef };
  }

  async cancelPayment(params: PaymentCancelParams): Promise<PaymentResult> {
    const timer = this.timers.get(params.paymentId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(params.paymentId);
    }
    return { status: "cancelled", providerRef: params.providerRef };
  }

  /** Debug-only: force a pending "manual" outcome payment to resolve immediately. */
  forceOutcome(paymentId: string, status: "succeeded" | "failed" | "cancelled"): boolean {
    const timer = this.timers.get(paymentId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(paymentId);
    }
    this.onResult?.(paymentId, { status, providerRef: `mock_${paymentId}` });
    return true;
  }
}

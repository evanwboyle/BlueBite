import type {
  PaymentProvider,
  PaymentRequestParams,
  PaymentCancelParams,
  PaymentResult,
  PaymentResultHandler,
} from "./types";
import { logPaymentEvent } from "./paymentLogger";

const SANDBOX_SERVER = "https://apisandbox.dev.clover.com";
const PRODUCTION_SERVER = "https://api.clover.com";

interface CloverRestConfig {
  server: string;
  accessToken: string;
  deviceSerial: string;
  posId: string;
  timeoutSeconds: number;
}

function loadConfig(env: NodeJS.ProcessEnv = process.env): CloverRestConfig {
  const accessToken = env.CLOVER_ACCESS_TOKEN;
  const deviceSerial = env.CLOVER_DEVICE_SERIAL || env.CLOVER_DEVICE_ID;
  if (!accessToken || !deviceSerial) {
    throw new Error(
      "Clover REST provider is not configured. Set CLOVER_ACCESS_TOKEN and CLOVER_DEVICE_SERIAL " +
        "(see documentation/CLOVER_PAYMENTS.md), or set PAYMENT_PROVIDER=mock."
    );
  }
  const environment = (env.CLOVER_ENVIRONMENT || "sandbox").toLowerCase();
  return {
    server: env.CLOVER_SERVER_URL || (environment === "production" ? PRODUCTION_SERVER : SANDBOX_SERVER),
    accessToken,
    deviceSerial,
    posId: env.CLOVER_POS_ID || "BlueBite",
    // Must stay under the serverless function's maxDuration (60s on Vercel).
    timeoutSeconds: Number(env.CLOVER_PAY_TIMEOUT_SECONDS ?? 55),
  };
}

/** Clover's externalPaymentId is capped at 32 chars; a UUID without dashes is exactly 32. */
export function toExternalPaymentId(paymentId: string): string {
  return paymentId.replace(/-/g, "").slice(0, 32);
}

/**
 * Tap-to-pay through Clover's REST Pay Display API (cloud connection): one HTTPS
 * POST /connect/v1/payments that stays open until the customer finishes on the
 * device, so it works from a serverless function with no persistent connection.
 * The device must be running the Cloud Pay Display app.
 *
 * requestPayment resolves with the *final* result (succeeded/failed/expired/error),
 * so callers must await it inside the function's lifetime. The Idempotency-Key and
 * externalPaymentId are derived from paymentId, so re-sending the same payment
 * after a dropped connection cannot double-charge.
 *
 * NOT yet exercised against a real device or sandbox: response shape is taken
 * from Clover's docs (payment.result, payment.id).
 */
export class CloverRestPaymentProvider implements PaymentProvider {
  readonly name = "clover" as const;

  constructor(
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  // Results are returned inline, never delivered asynchronously.
  setResultHandler(_handler: PaymentResultHandler): void {}

  async requestPayment(params: PaymentRequestParams): Promise<PaymentResult> {
    let config: CloverRestConfig;
    try {
      config = loadConfig(this.env);
    } catch (err) {
      return { status: "error", errorMessage: err instanceof Error ? err.message : "Clover is not configured" };
    }

    const externalPaymentId = toExternalPaymentId(params.paymentId);
    await logPaymentEvent({
      paymentId: params.paymentId,
      type: "device_request_sent",
      actor: "system",
      message: `Pay request sent to Clover device for $${params.amount.toFixed(2)}`,
    });

    const controller = new AbortController();
    // Give Clover's own timeout (504) a chance to answer first.
    const abortTimer = setTimeout(() => controller.abort(), (config.timeoutSeconds + 3) * 1000);

    try {
      const response = await this.fetchImpl(`${config.server}/connect/v1/payments`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "X-Clover-Device-Id": config.deviceSerial,
          "X-POS-Id": config.posId,
          "X-Clover-Timeout": String(config.timeoutSeconds),
          "Idempotency-Key": externalPaymentId,
          "User-Agent": "BlueBite POS",
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          amount: Math.round(params.amount * 100), // integer cents
          externalPaymentId,
          final: true,
        }),
      });

      const body = (await response.json().catch(() => null)) as CloverPayResponse | null;
      const result = mapResponse(response.status, body);
      await logPaymentEvent({
        paymentId: params.paymentId,
        type: "clover_pay_response",
        actor: "device",
        message: `HTTP ${response.status} -> ${result.status}${result.errorMessage ? `: ${result.errorMessage}` : ""}`,
      });
      return result;
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      return {
        status: aborted ? "expired" : "error",
        errorMessage: aborted ? "The device did not respond in time" : err instanceof Error ? err.message : "Request failed",
      };
    } finally {
      clearTimeout(abortTimer);
    }
  }

  /**
   * The REST Pay Display docs list no cancel endpoint for an in-flight payment, so
   * this only marks our side cancelled; the customer can press Cancel on the
   * device. A late "succeeded" after this is dropped by the terminal-status rule,
   * which is why a paid-but-cancelled payment must be reconciled by Clover ID.
   */
  async cancelPayment(params: PaymentCancelParams): Promise<PaymentResult> {
    await logPaymentEvent({ paymentId: params.paymentId, type: "device_cancel_sent", actor: "system" });
    return { status: "cancelled", providerRef: params.providerRef };
  }
}

interface CloverPayResponse {
  payment?: { id?: string; result?: string };
  message?: string;
  error?: { message?: string } | string;
}

export function mapResponse(httpStatus: number, body: CloverPayResponse | null): PaymentResult {
  if (httpStatus === 504) return { status: "expired", errorMessage: "The device did not respond in time" };

  if (httpStatus >= 200 && httpStatus < 300) {
    const providerRef = body?.payment?.id ?? null;
    const result = body?.payment?.result?.toUpperCase();
    if (result === "SUCCESS" || result === "APPROVED") return { status: "succeeded", providerRef, raw: body };
    if (result === "CANCEL" || result === "CANCELED" || result === "CANCELLED") {
      return { status: "cancelled", providerRef, raw: body };
    }
    return { status: "failed", providerRef, errorMessage: `Payment ${result ?? "not approved"}`, raw: body };
  }

  const message =
    typeof body?.error === "string" ? body.error : (body?.error?.message ?? body?.message ?? `Clover returned HTTP ${httpStatus}`);
  return { status: "error", errorMessage: message, raw: body };
}

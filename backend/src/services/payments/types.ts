/**
 * Payment provider abstraction. The rest of the app (routes, order flow)
 * only talks to this interface, never to Clover's SDK or the mock directly -
 * that's what makes it possible to develop and test the whole order+payment
 * flow with zero physical hardware (PAYMENT_PROVIDER=mock) and swap in the
 * real Clover Remote Pay Cloud provider later with no route/schema changes.
 */

export type PaymentStatus =
  | "requested" // row created, provider call about to go out
  | "awaiting_device" // provider accepted the request; waiting on the customer to tap/insert/swipe
  | "succeeded"
  | "failed" // card declined / device-reported error
  | "cancelled" // customer or staff cancelled before completion
  | "error" // our side errored talking to the provider (network, config, etc.)
  | "expired" // no terminal result within PAYMENT_TIMEOUT_MS
  | "bypassed"; // admin/debug bypass - no money actually moved

export const TERMINAL_PAYMENT_STATUSES: ReadonlySet<PaymentStatus> = new Set([
  "succeeded",
  "failed",
  "cancelled",
  "error",
  "expired",
  "bypassed",
]);

export interface PaymentRequestParams {
  /** Our Payment row id - always used as the provider idempotency/external id. */
  paymentId: string;
  orderId: string;
  /** Dollars, matching Order.totalPrice. Converted to the provider's native unit internally. */
  amount: number;
  currency: string;
}

export interface PaymentCancelParams {
  paymentId: string;
  /** Provider-specific reference returned from requestPayment, if any. */
  providerRef?: string | null;
}

export interface PaymentResult {
  status: PaymentStatus;
  providerRef?: string | null;
  errorMessage?: string | null;
  raw?: unknown;
}

/**
 * Called by a provider whenever a payment's status changes asynchronously
 * (e.g. the device finally responds to a sale request that was already
 * acknowledged as "awaiting_device"). Providers that resolve synchronously
 * (like the mock, by default) don't need to call this at all.
 */
export type PaymentResultHandler = (paymentId: string, result: PaymentResult) => void | Promise<void>;

export interface PaymentProvider {
  readonly name: "mock" | "clover";
  /** Send the actual sale/charge request. Resolves once the request has been accepted or has failed outright. */
  requestPayment(params: PaymentRequestParams): Promise<PaymentResult>;
  /** Best-effort cancel of an in-flight request. Terminal payments should no-op. */
  cancelPayment(params: PaymentCancelParams): Promise<PaymentResult>;
  /** Wire up the callback used to deliver asynchronous (post-acknowledgement) results. */
  setResultHandler(handler: PaymentResultHandler): void;
}

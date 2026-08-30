import { MockPaymentProvider } from "./mockProvider";
import { CloverPaymentProvider } from "./cloverProvider";
import type { PaymentProvider } from "./types";

export * from "./types";
export { logPaymentEvent } from "./paymentLogger";

let cached: PaymentProvider | null = null;

/**
 * Selects the active payment provider. Defaults to the mock/simulator so the
 * app works out of the box with zero Clover setup - set PAYMENT_PROVIDER=clover
 * once real device credentials (see documentation/CLOVER_PAYMENTS.md) are available.
 */
export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;

  const providerName = (process.env.PAYMENT_PROVIDER || "mock").toLowerCase();
  cached = providerName === "clover" ? new CloverPaymentProvider() : new MockPaymentProvider();
  return cached;
}

import test from "node:test";
import assert from "node:assert/strict";
import { CloverRestPaymentProvider, mapResponse, toExternalPaymentId } from "./cloverRestProvider";

const env = {
  CLOVER_ACCESS_TOKEN: "tok",
  CLOVER_DEVICE_SERIAL: "C0123",
  CLOVER_ENVIRONMENT: "sandbox",
} as NodeJS.ProcessEnv;

const params = { paymentId: "123e4567-e89b-12d3-a456-426614174000", orderId: "o1", amount: 12.5, currency: "USD" };

function fakeFetch(status: number, body: unknown, capture?: { url?: string; init?: RequestInit }): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    if (capture) Object.assign(capture, { url, init });
    return { status, json: async () => body } as Response;
  }) as unknown as typeof fetch;
}

test("externalPaymentId is 32 chars", () => {
  assert.equal(toExternalPaymentId(params.paymentId).length, 32);
});

test("sends cents, headers and idempotency key; maps SUCCESS", async () => {
  const capture: { url?: string; init?: RequestInit } = {};
  const p = new CloverRestPaymentProvider(env, fakeFetch(200, { payment: { id: "PAY1", result: "SUCCESS" } }, capture));
  const result = await p.requestPayment(params);
  assert.deepEqual([result.status, result.providerRef], ["succeeded", "PAY1"]);
  assert.equal(capture.url, "https://apisandbox.dev.clover.com/connect/v1/payments");
  const headers = capture.init!.headers as Record<string, string>;
  assert.equal(headers["X-Clover-Device-Id"], "C0123");
  assert.equal(headers["Idempotency-Key"], toExternalPaymentId(params.paymentId));
  assert.equal(JSON.parse(capture.init!.body as string).amount, 1250);
});

test("maps declines, timeouts and errors", () => {
  assert.equal(mapResponse(200, { payment: { result: "FAIL" } }).status, "failed");
  assert.equal(mapResponse(200, { payment: { result: "CANCEL" } }).status, "cancelled");
  assert.equal(mapResponse(504, null).status, "expired");
  assert.equal(mapResponse(401, { message: "bad token" }).errorMessage, "bad token");
});

test("missing config returns an error result instead of throwing", async () => {
  const p = new CloverRestPaymentProvider({} as NodeJS.ProcessEnv, fakeFetch(200, {}));
  assert.equal((await p.requestPayment(params)).status, "error");
});

test("network failure returns error", async () => {
  const boom = (async () => {
    throw new Error("ECONNRESET");
  }) as unknown as typeof fetch;
  const result = await new CloverRestPaymentProvider(env, boom).requestPayment(params);
  assert.deepEqual([result.status, result.errorMessage], ["error", "ECONNRESET"]);
});

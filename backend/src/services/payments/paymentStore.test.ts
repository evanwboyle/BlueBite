import test from "node:test";
import assert from "node:assert/strict";
import { UpstashRedis } from "../upstash";
import { MemoryPaymentStore, UpstashPaymentStore, createPaymentStore, type PaymentRecord } from "./paymentStore";

const record: PaymentRecord = {
  id: "p1",
  orderId: "o1",
  provider: "mock",
  status: "awaiting_device",
  amount: 5,
  currency: "USD",
  providerRef: null,
  errorMessage: null,
  createdAt: new Date("2026-09-29T10:00:00Z"),
  updatedAt: new Date("2026-09-29T10:00:05Z"),
};

test("Upstash store round-trips a record (dates revived) by id and order", async () => {
  const kv = new Map<string, string>();
  const fake = (async (_url: string, init: RequestInit) => {
    const [cmd, key, value] = JSON.parse(init.body as string);
    if (cmd === "SET") kv.set(key, value);
    return { ok: true, json: async () => ({ result: cmd === "GET" ? (kv.get(key) ?? null) : "OK" }) } as Response;
  }) as unknown as typeof fetch;

  const store = new UpstashPaymentStore(new UpstashRedis("https://x", "tok", fake));
  await store.save(record);
  const byOrder = await store.getByOrder("o1");
  assert.equal(byOrder?.id, "p1");
  assert.ok(byOrder?.updatedAt instanceof Date);
  assert.equal(await store.getById("nope"), null);
});

test("memory store is the default without Upstash env", async () => {
  const store = createPaymentStore({} as NodeJS.ProcessEnv);
  assert.ok(store instanceof MemoryPaymentStore);
  await store.save(record);
  assert.equal((await store.getByOrder("o1"))?.id, "p1");
});

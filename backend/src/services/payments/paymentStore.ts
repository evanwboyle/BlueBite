import type { PaymentStatus } from "./types";
import { UpstashRedis } from "../upstash";

/**
 * A payment attempt. The sheet's durable record of a payment is still the Paid
 * checkbox plus the Clover ID on the order row; this record only tracks an attempt
 * while it is in flight, so status polls hit the same answer from any instance.
 */
export interface PaymentRecord {
  id: string;
  orderId: string;
  provider: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  providerRef: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentStore {
  getById(paymentId: string): Promise<PaymentRecord | null>;
  getByOrder(orderId: string): Promise<PaymentRecord | null>;
  save(record: PaymentRecord): Promise<void>;
}

export class MemoryPaymentStore implements PaymentStore {
  private byId = new Map<string, PaymentRecord>();
  private byOrder = new Map<string, PaymentRecord>();

  async getById(paymentId: string) {
    return this.byId.get(paymentId) ?? null;
  }
  async getByOrder(orderId: string) {
    return this.byOrder.get(orderId) ?? null;
  }
  async save(record: PaymentRecord) {
    this.byId.set(record.id, record);
    this.byOrder.set(record.orderId, record);
  }
}

const TTL_SECONDS = 24 * 60 * 60;

/** Payment attempts in Upstash Redis. */
export class UpstashPaymentStore implements PaymentStore {
  constructor(private readonly redis: UpstashRedis) {}

  private command(...args: (string | number)[]) {
    return this.redis.command(...args);
  }

  private parse(raw: unknown): PaymentRecord | null {
    if (typeof raw !== "string") return null;
    const r = JSON.parse(raw);
    return { ...r, createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt) };
  }

  async getById(paymentId: string) {
    return this.parse(await this.command("GET", `payment:${paymentId}`));
  }

  async getByOrder(orderId: string) {
    const id = await this.command("GET", `payment:order:${orderId}`);
    return typeof id === "string" ? this.getById(id) : null;
  }

  async save(record: PaymentRecord) {
    await this.command("SET", `payment:${record.id}`, JSON.stringify(record), "EX", TTL_SECONDS);
    await this.command("SET", `payment:order:${record.orderId}`, record.id, "EX", TTL_SECONDS);
  }
}

/** Upstash when UPSTASH_REDIS_REST_URL/TOKEN are set, otherwise per-process memory (local dev). */
export function createPaymentStore(env: NodeJS.ProcessEnv = process.env): PaymentStore {
  const redis = UpstashRedis.fromEnv(env);
  return redis ? new UpstashPaymentStore(redis) : new MemoryPaymentStore();
}

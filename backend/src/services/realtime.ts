import * as Ably from "ably";

/**
 * Managed push for order/menu/payment events (Ably). With ABLY_API_KEY set, every event is
 * also published to the channel for its buttery, so browsers get true push without holding a
 * connection to this server, which serverless cannot do. Without it, only the SSE stream runs.
 */

const CHANNEL_PREFIX = "bluebite:";
const ALL_BUTTERIES = "all";

let rest: Ably.Rest | null = null;
const pending = new Set<Promise<unknown>>();

function client(): Ably.Rest | null {
  const key = process.env.ABLY_API_KEY;
  if (!key) return null;
  return (rest ??= new Ably.Rest({ key }));
}

export function realtimeEnabled(): boolean {
  return !!process.env.ABLY_API_KEY;
}

export function channelName(buttery?: string | null): string {
  const slug = (buttery ?? ALL_BUTTERIES).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${CHANNEL_PREFIX}${slug || ALL_BUTTERIES}`;
}

/** Fire-and-forget publish; failures are logged, never thrown into the request that caused the event. */
export function publishRealtime(eventType: string, data: unknown, buttery?: string | null): void {
  const ably = client();
  if (!ably) return;
  const job = ably.channels
    .get(channelName(buttery))
    .publish(eventType, data)
    .catch((err: unknown) => console.error(`[REALTIME] Failed to publish ${eventType}:`, err))
    .finally(() => pending.delete(job));
  pending.add(job);
}

/** Serverless functions are frozen once the response is sent: await this before returning. */
export async function flushRealtime(): Promise<void> {
  await Promise.allSettled([...pending]);
}

/**
 * Short-lived, subscribe-only token for one buttery's channel (plus the shared one). The API key never leaves the server.
 * (Events carry the same order payloads as the SSE stream, which is equally unauthenticated.)
 */
export async function createRealtimeToken(buttery?: string | null): Promise<Ably.TokenRequest | null> {
  const ably = client();
  if (!ably) return null;
  return ably.auth.createTokenRequest({
    // Events with no buttery go to the shared channel, so clients need both.
    capability: { [channelName(buttery)]: ["subscribe"], [channelName(null)]: ["subscribe"] },
    ttl: 60 * 60 * 1000,
  });
}

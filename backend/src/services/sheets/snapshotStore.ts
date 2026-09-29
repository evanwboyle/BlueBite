import { UpstashRedis } from "../upstash";
import type { MirrorSnapshot } from "./mirror";

/**
 * Shared copy of the mirror for serverless, where each invocation may be a fresh process. One
 * instance refreshes from Sheets and saves the result here; the others load it. The lock keeps
 * a burst of cold starts from all hitting the Sheets quota (60 reads/min) at once.
 */
export interface SnapshotStore {
  load(): Promise<MirrorSnapshot | null>;
  save(snapshot: MirrorSnapshot): Promise<void>;
  /** True if this caller now holds the refresh lock. It expires on its own. */
  tryLock(ttlMs: number): Promise<boolean>;
  /** Release the lock early once the refresh is saved, so the next stale request can refresh. */
  unlock(): Promise<void>;
}

const KEY = "sheets:snapshot";
const LOCK_KEY = "sheets:refresh-lock";
const SNAPSHOT_TTL_SECONDS = 24 * 60 * 60;

export class MemorySnapshotStore implements SnapshotStore {
  snapshot: MirrorSnapshot | null = null;
  lockedUntil = 0;
  async load() {
    return this.snapshot;
  }
  async save(snapshot: MirrorSnapshot) {
    this.snapshot = snapshot;
  }
  async tryLock(ttlMs: number) {
    if (Date.now() < this.lockedUntil) return false;
    this.lockedUntil = Date.now() + ttlMs;
    return true;
  }
  async unlock() {
    this.lockedUntil = 0;
  }
}

export class UpstashSnapshotStore implements SnapshotStore {
  constructor(private readonly redis: UpstashRedis) {}

  async load() {
    const raw = await this.redis.command("GET", KEY);
    return typeof raw === "string" ? (JSON.parse(raw) as MirrorSnapshot) : null;
  }
  async save(snapshot: MirrorSnapshot) {
    await this.redis.command("SET", KEY, JSON.stringify(snapshot), "EX", SNAPSHOT_TTL_SECONDS);
  }
  async tryLock(ttlMs: number) {
    return (await this.redis.command("SET", LOCK_KEY, "1", "NX", "PX", ttlMs)) === "OK";
  }
  async unlock() {
    await this.redis.command("DEL", LOCK_KEY);
  }
}

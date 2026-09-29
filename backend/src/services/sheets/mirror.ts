import type { SheetsApi } from "./api";
import {
  BUTTERY_NAME,
  IMAGE_ROUTE,
  MENU_TAB,
  MODIFIERS_TAB,
  ORDER_LAST_COLUMN,
  ROLES_TAB,
  dayTabName,
  parseMenu,
  parseOrderRow,
  parseRoles,
  quoteTab,
  type ApiMenuItem,
  type ApiOrder,
  type Cell,
  type ParsedOrder,
  type Role,
} from "./model";

import type { SnapshotStore } from "./snapshotStore";

/** Everything the mirror serves reads from, JSON-safe so it can live in Redis between serverless invocations. */
export interface MirrorSnapshot {
  fetchedAt: number;
  menu: ApiMenuItem[];
  menuFingerprint: string;
  roles: Array<[string, Role]>;
  orders: ParsedOrder[];
  fingerprints: Array<[string, string]>;
  changedAt: Array<[string, string]>;
  tabs: Array<[string, number]>;
  tabsFetchedAt: number;
}

export type EmitFn = (type: string, data: unknown, buttery?: string | null) => void;

const TAB_LIST_TTL_MS = 60_000;
const TAB_LIST_MISS_TTL_MS = 5_000; // re-check sooner while today's tab doesn't exist yet
const MIN_REFRESH_GAP_MS = 1_000;
const SNAPSHOT_MAX_AGE_MS = 4_000;
const REFRESH_LOCK_MS = 10_000;
const LOOKBACK_DAYS = 2; // today + yesterday, so a shift that crosses midnight stays live

/**
 * In-memory copy of the menu, roles and recent daily order tabs. Every read the
 * API serves comes from here; Sheets is only touched by refresh() (one batchGet)
 * and by the store's writes. Refresh diffs against the previous snapshot and
 * emits the same SSE events the Postgres-backed routes did.
 */
export class SheetsMirror {
  private menu: ApiMenuItem[] = [];
  private menuFingerprint = "";
  private roles = new Map<string, Role>();
  private orders = new Map<string, ParsedOrder>();
  private fingerprints = new Map<string, string>();
  private changedAt = new Map<string, string>();
  private tabs = new Map<string, number>(); // title -> sheetId
  private tabsFetchedAt = 0;
  private loaded = false;

  private running: Promise<void> | null = null;
  private rerun = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private lastRefreshAt = 0;

  private afterRefresh: Array<() => void> = [];

  /** imageBaseUrl: public URL of this server, used to rewrite Drive image links to /api/images/<fileId>. */
  constructor(
    private api: SheetsApi,
    private emit: EmitFn,
    private opts: { imageBaseUrl?: string; snapshots?: SnapshotStore } = {}
  ) {}

  // ---- Reads (served from memory) ----------------------------------------

  isLoaded(): boolean {
    return this.loaded;
  }

  getMenu(): ApiMenuItem[] {
    return this.menu;
  }

  getMenuItem(id: string): ApiMenuItem | undefined {
    return this.menu.find((m) => m.id === id);
  }

  /** True if a menu item currently uses this Drive file. The image proxy only serves files the menu references. */
  isMenuImage(fileId: string): boolean {
    return this.menu.some((m) => m.image?.endsWith(`${IMAGE_ROUTE}${fileId}`));
  }

  getRole(netId: string): Role {
    return this.roles.get(netId.toLowerCase()) ?? "customer";
  }

  getOrder(id: string): ParsedOrder | undefined {
    return this.orders.get(id);
  }

  getOrders(filter?: { netId?: string }): ApiOrder[] {
    const netId = filter?.netId?.toLowerCase();
    return [...this.orders.values()]
      .map((p) => p.order)
      .filter((o) => !netId || o.netId.toLowerCase() === netId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getParsedOrders(): ParsedOrder[] {
    return [...this.orders.values()];
  }

  getSheetId(tab: string): number | undefined {
    return this.tabs.get(tab);
  }

  /** Record a tab the store just created so the next refresh reads it without waiting for the tab-list TTL. */
  noteTab(title: string, sheetId: number): void {
    this.tabs.set(title, sheetId);
  }

  // ---- Serverless: share state through a snapshot store --------------------

  exportSnapshot(): MirrorSnapshot {
    return {
      fetchedAt: this.lastRefreshAt,
      menu: this.menu,
      menuFingerprint: this.menuFingerprint,
      roles: [...this.roles],
      orders: [...this.orders.values()],
      fingerprints: [...this.fingerprints],
      changedAt: [...this.changedAt],
      tabs: [...this.tabs],
      tabsFetchedAt: this.tabsFetchedAt,
    };
  }

  /** Adopt a snapshot another instance saved. Emits nothing: whoever refreshed already emitted the diff. */
  hydrate(snapshot: MirrorSnapshot): void {
    this.menu = snapshot.menu;
    this.menuFingerprint = snapshot.menuFingerprint;
    this.roles = new Map(snapshot.roles);
    this.orders = new Map(snapshot.orders.map((p) => [p.order.id, p]));
    this.fingerprints = new Map(snapshot.fingerprints);
    this.changedAt = new Map(snapshot.changedAt);
    this.tabs = new Map(snapshot.tabs);
    this.tabsFetchedAt = snapshot.tabsFetchedAt;
    this.lastRefreshAt = snapshot.fetchedAt;
    this.loaded = true;
  }

  /**
   * Call at the start of every request when a snapshot store is configured (there is no poll timer
   * in serverless). Serves the shared snapshot while it is younger than maxAgeMs; otherwise one
   * caller takes the lock and refreshes from Sheets, and the rest use the previous snapshot.
   */
  async ensureFresh(maxAgeMs = SNAPSHOT_MAX_AGE_MS): Promise<void> {
    const shared = this.opts.snapshots;
    if (!shared) return;
    if (this.loaded && Date.now() - this.lastRefreshAt < maxAgeMs) return;

    const snapshot = await shared.load();
    if (snapshot && Date.now() - snapshot.fetchedAt < maxAgeMs) {
      this.hydrate(snapshot);
      return;
    }
    const gotLock = await shared.tryLock(REFRESH_LOCK_MS);
    if (snapshot) this.hydrate(snapshot); // also the baseline the refresh diffs against
    if (!gotLock && (snapshot || this.loaded)) return; // someone else is refreshing; stale beats waiting
    try {
      await this.refresh();
    } finally {
      if (gotLock) await shared.unlock().catch(() => undefined); // the lock TTL covers a failed unlock
    }
  }

  /** Called after every successful refresh (the store uses this to stamp hand-typed rows). */
  onRefreshed(fn: () => void): void {
    this.afterRefresh.push(fn);
  }

  // ---- Refresh ------------------------------------------------------------

  /**
   * Reads the sheet and applies changes. Concurrent callers are coalesced, but a
   * call made while a refresh is running always triggers another pass, so a
   * caller that just wrote to the sheet is guaranteed to see its own write.
   */
  refresh(): Promise<void> {
    if (this.running) {
      this.rerun = true;
      return this.running;
    }
    this.running = (async () => {
      do {
        this.rerun = false;
        await this.doRefresh();
      } while (this.rerun);
    })().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  /** True when state is shared through a snapshot store (serverless): no timers, refresh per request. */
  isShared(): boolean {
    return !!this.opts.snapshots;
  }

  /**
   * Webhook entry point in serverless: timers do not survive the response, so refresh now. Adopt the
   * shared snapshot first so the refresh diffs against what clients last saw and emits the right events.
   */
  async refreshNow(): Promise<void> {
    const snapshot = await this.opts.snapshots?.load();
    if (snapshot) this.hydrate(snapshot);
    await this.refresh();
  }

  /** Webhook entry point: refresh soon, but no more than once per second. */
  requestRefresh(): void {
    if (this.debounceTimer) return;
    const wait = Math.max(0, MIN_REFRESH_GAP_MS - (Date.now() - this.lastRefreshAt));
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.refresh().catch(() => undefined); // already logged by the client
    }, wait);
  }

  start(intervalMs: number): void {
    this.stop();
    this.pollTimer = setInterval(() => {
      this.refresh().catch(() => undefined);
    }, intervalMs);
  }

  stop(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.pollTimer = null;
    this.debounceTimer = null;
  }

  private recentDayTabs(now: Date): string[] {
    const tabs: string[] = [];
    for (let i = 0; i < LOOKBACK_DAYS; i++) {
      tabs.push(dayTabName(new Date(now.getTime() - i * 24 * 60 * 60 * 1000)));
    }
    return tabs;
  }

  private async refreshTabs(now: Date): Promise<void> {
    const age = Date.now() - this.tabsFetchedAt;
    const todayKnown = this.tabs.has(dayTabName(now));
    if (age < (todayKnown ? TAB_LIST_TTL_MS : TAB_LIST_MISS_TTL_MS) && this.tabsFetchedAt > 0) return;
    const tabs = await this.api.getTabs();
    this.tabs = new Map(tabs.map((t) => [t.title, t.sheetId]));
    this.tabsFetchedAt = Date.now();
  }

  private async doRefresh(): Promise<void> {
    const now = new Date();
    await this.refreshTabs(now);

    // Only request tabs that exist: batchGet fails the whole call on an unknown range.
    const fixed = [MENU_TAB, MODIFIERS_TAB, ROLES_TAB].filter((t) => this.tabs.has(t));
    const dayTabs = this.recentDayTabs(now).filter((t) => this.tabs.has(t));
    const ranges = [
      ...fixed.map(quoteTab),
      ...dayTabs.map((t) => `${quoteTab(t)}!A:${ORDER_LAST_COLUMN}`),
    ];
    const results = ranges.length ? await this.api.batchGetValues(ranges) : [];
    const byTab = new Map<string, Cell[][]>();
    [...fixed, ...dayTabs].forEach((tab, i) => byTab.set(tab, (results[i] ?? []) as Cell[][]));

    this.applyMenu(byTab.get(MENU_TAB) ?? [], byTab.get(MODIFIERS_TAB) ?? []);
    this.roles = parseRoles(byTab.get(ROLES_TAB) ?? []);
    this.applyOrders(dayTabs, byTab);

    this.loaded = true;
    this.lastRefreshAt = Date.now();
    for (const fn of this.afterRefresh) fn();
    // No await when unshared: an extra microtask here changes how concurrent refreshes coalesce.
    if (this.opts.snapshots) {
      await this.opts.snapshots.save(this.exportSnapshot()).catch((err) => {
        console.error("[Sheets] Failed to save shared snapshot:", err);
      });
    }
  }

  private applyMenu(menuRows: Cell[][], modifierRows: Cell[][]): void {
    const menu = parseMenu(menuRows, modifierRows, { imageBaseUrl: this.opts.imageBaseUrl });
    const fingerprint = JSON.stringify(menu);
    const changed = fingerprint !== this.menuFingerprint;
    this.menu = menu;
    this.menuFingerprint = fingerprint;
    if (changed && this.loaded) this.emit("menu:updated", { source: "sheet" }, BUTTERY_NAME);
  }

  private applyOrders(dayTabs: string[], byTab: Map<string, Cell[][]>): void {
    const next = new Map<string, ParsedOrder>();
    for (const tab of dayTabs) {
      (byTab.get(tab) ?? []).forEach((row, idx) => {
        if (idx === 0) return; // header
        const parsed = parseOrderRow(row, tab, idx + 1);
        if (!parsed) return;
        if (next.has(parsed.order.id)) {
          console.warn(`[Sheets] Duplicate OrderID ${parsed.order.id} in "${tab}" row ${idx + 1}; ignoring the copy`);
          return;
        }
        next.set(parsed.order.id, parsed);
      });
    }

    const nowIso = new Date().toISOString();
    const events: Array<[string, ApiOrder]> = [];

    for (const [id, parsed] of next) {
      const fingerprint = JSON.stringify([parsed.order, parsed.paymentId]);
      const previous = this.fingerprints.get(id);
      if (previous !== fingerprint) {
        if (this.loaded) {
          this.changedAt.set(id, nowIso);
          events.push([previous === undefined ? "order:created" : "order:updated", parsed.order]);
        }
        this.fingerprints.set(id, fingerprint);
      }
      // completedAt on the frontend is derived from updatedAt: the last time we saw the row change
      parsed.order.updatedAt = this.changedAt.get(id) ?? parsed.order.createdAt;
    }

    // Rows a worker deleted while their tab is still being watched. There is no
    // "order:deleted" event; clients refetch the whole list on any order event.
    for (const [id, old] of this.orders) {
      if (next.has(id)) continue;
      this.fingerprints.delete(id);
      this.changedAt.delete(id);
      if (this.loaded && dayTabs.includes(old.tab)) events.push(["order:updated", old.order]);
    }

    this.orders = next;
    for (const [type, order] of events) this.emit(type, order, BUTTERY_NAME);
  }
}

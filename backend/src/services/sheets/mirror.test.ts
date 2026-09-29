import { test } from "node:test";
import assert from "node:assert/strict";
import type { SheetsApi } from "./api";
import { SheetsMirror } from "./mirror";
import { COL, MENU_HEADER, MODIFIERS_HEADER, ORDER_HEADER, ROLES_HEADER, dayTabName, type Cell } from "./model";

/** In-memory stand-in for the spreadsheet: tab title -> rows. */
class FakeSheets implements SheetsApi {
  tabs = new Map<string, Cell[][]>();
  reads = 0;
  metaReads = 0;

  set(title: string, rows: Cell[][]) {
    this.tabs.set(title, rows);
  }

  async batchGetValues(ranges: string[]) {
    this.reads++;
    return ranges.map((range) => {
      const title = range.replace(/^'/, "").replace(/'(!.*)?$/, "");
      const rows = this.tabs.get(title);
      if (!rows) throw new Error(`Unable to parse range: ${range}`);
      return rows as never;
    });
  }
  async getTabs() {
    this.metaReads++;
    return [...this.tabs.keys()].map((title, i) => ({ title, sheetId: i + 1 }));
  }
  async batchUpdate() {}
  async batchUpdateValues() {}
}

function orderRow(id: string, opts: { paid?: boolean; done?: boolean; name?: string } = {}): Cell[] {
  const row: Cell[] = [];
  row[COL.name] = opts.name ?? "ewb28";
  row[COL.order] = "Fries";
  row[COL.done] = opts.done ?? false;
  row[COL.paid] = opts.paid ?? true;
  row[COL.pickedUp] = false;
  row[COL.orderId] = id;
  row[COL.netId] = opts.name ?? "ewb28";
  row[COL.total] = 3;
  row[COL.submittedAt] = "2026-09-19T20:00:00.000Z";
  return row;
}

function setup() {
  const sheets = new FakeSheets();
  const today = dayTabName();
  sheets.set("Menu", [MENU_HEADER, ["Fries", "", 3, "Sides", true, false, "", false]]);
  sheets.set("Modifiers", [MODIFIERS_HEADER]);
  sheets.set("Roles", [ROLES_HEADER, ["ewb28", "admin"]]);
  sheets.set(today, [ORDER_HEADER, orderRow("o1")]);
  const events: Array<{ type: string; data: unknown; buttery?: string | null }> = [];
  const mirror = new SheetsMirror(sheets, (type, data, buttery) => events.push({ type, data, buttery }));
  return { sheets, mirror, events, today };
}

test("first refresh loads silently: no events, data available", async () => {
  const { mirror, events } = setup();
  await mirror.refresh();
  assert.equal(mirror.isLoaded(), true);
  assert.equal(mirror.getMenu().length, 1);
  assert.equal(mirror.getRole("EWB28"), "admin");
  assert.equal(mirror.getRole("nobody"), "customer");
  assert.equal(mirror.getOrders().length, 1);
  assert.equal(events.length, 0);
});

test("a worker's edit in the sheet emits order:updated with the buttery", async () => {
  const { sheets, mirror, events, today } = setup();
  await mirror.refresh();

  sheets.set(today, [ORDER_HEADER, orderRow("o1", { done: true })]);
  await mirror.refresh();

  assert.equal(events.length, 1);
  assert.equal(events[0].type, "order:updated");
  assert.equal(events[0].buttery, "Benjamin Franklin");
  assert.equal(mirror.getOrder("o1")!.order.status, "ready");
  // updatedAt reflects when the change was observed, not the submit time
  assert.notEqual(mirror.getOrder("o1")!.order.updatedAt, mirror.getOrder("o1")!.order.createdAt);
});

test("new rows emit order:created; deleted rows emit order:updated; unchanged refresh is silent", async () => {
  const { sheets, mirror, events, today } = setup();
  await mirror.refresh();

  await mirror.refresh();
  assert.equal(events.length, 0);

  sheets.set(today, [ORDER_HEADER, orderRow("o1"), orderRow("o2", { paid: false })]);
  await mirror.refresh();
  assert.deepEqual(events.map((e) => e.type), ["order:created"]);
  assert.equal(mirror.getOrder("o2")!.order.status, "awaiting_payment");

  sheets.set(today, [ORDER_HEADER, orderRow("o2", { paid: false })]);
  await mirror.refresh();
  assert.deepEqual(events.map((e) => e.type), ["order:created", "order:updated"]);
  assert.equal(mirror.getOrder("o1"), undefined);
});

test("sorting rows in the sheet changes row numbers but not order identity or events", async () => {
  const { sheets, mirror, events, today } = setup();
  sheets.set(today, [ORDER_HEADER, orderRow("o1"), orderRow("o2")]);
  await mirror.refresh();
  assert.equal(mirror.getOrder("o1")!.row, 2);

  sheets.set(today, [ORDER_HEADER, orderRow("o2"), orderRow("o1")]);
  await mirror.refresh();
  assert.equal(mirror.getOrder("o1")!.row, 3);
  assert.equal(events.length, 0);
});

test("menu edits emit menu:updated", async () => {
  const { sheets, mirror, events } = setup();
  await mirror.refresh();
  sheets.set("Menu", [MENU_HEADER, ["Fries", "", 3.5, "Sides", true, false, "", false]]);
  await mirror.refresh();
  assert.deepEqual(events.map((e) => e.type), ["menu:updated"]);
  assert.equal(mirror.getMenu()[0].price, 3.5);
});

test("missing tabs are skipped instead of failing the whole read", async () => {
  const sheets = new FakeSheets();
  sheets.set("Menu", [MENU_HEADER, ["Fries", "", 3, "Sides", true, false, "", false]]);
  const mirror = new SheetsMirror(sheets, () => undefined);
  await mirror.refresh(); // no Modifiers, Roles, or day tab
  assert.equal(mirror.getMenu().length, 1);
  assert.equal(mirror.getOrders().length, 0);
});

test("concurrent refreshes coalesce, and a call during a run triggers another pass", async () => {
  const { sheets, mirror } = setup();
  const first = mirror.refresh();
  const second = mirror.refresh(); // arrives while the first is in flight
  await Promise.all([first, second]);
  assert.equal(sheets.reads, 2); // exactly one extra pass, not one per caller
});

test("tab list is cached between refreshes", async () => {
  const { sheets, mirror } = setup();
  await mirror.refresh();
  await mirror.refresh();
  await mirror.refresh();
  assert.equal(sheets.metaReads, 1);
});

test("getOrders filters by netId and sorts newest first", async () => {
  const { sheets, mirror, today } = setup();
  const older = orderRow("o1", { name: "abc1" });
  const newer = orderRow("o2", { name: "abc1" });
  newer[COL.submittedAt] = "2026-09-19T22:00:00.000Z";
  sheets.set(today, [ORDER_HEADER, older, newer, orderRow("o3", { name: "zzz9" })]);
  await mirror.refresh();
  assert.deepEqual(mirror.getOrders({ netId: "ABC1" }).map((o) => o.id), ["o2", "o1"]);
});

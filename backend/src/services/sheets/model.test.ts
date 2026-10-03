import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bool,
  columnLetter,
  dayTabName,
  deriveStatus,
  extractDriveFileId,
  isDayTab,
  parseMenu,
  parseOrderRow,
  parseRoles,
  statusToCheckboxes,
  MENU_HEADER,
  MODIFIERS_HEADER,
  ROLES_HEADER,
  ORDER_HEADER,
  COL,
  type Cell,
} from "./model";

test("columnLetter and header widths line up", () => {
  assert.equal(columnLetter(0), "A");
  assert.equal(columnLetter(13), "N");
  assert.equal(columnLetter(26), "AA");
  assert.equal(ORDER_HEADER.length, 14);
  assert.equal(ORDER_HEADER[COL.cancelled], "Cancelled");
});

test("bool accepts checkboxes and hand-typed values", () => {
  assert.equal(bool(true), true);
  assert.equal(bool(false), false);
  assert.equal(bool("Yes"), true);
  assert.equal(bool("x"), true);
  assert.equal(bool("no"), false);
  assert.equal(bool("", true), true);
  assert.equal(bool(undefined, false), false);
});

test("dayTabName uses Eastern time, not server time", () => {
  // 03:30 UTC on Sep 20 is still 11:30pm on Sep 19 in New York.
  assert.equal(dayTabName(new Date("2026-09-20T03:30:00Z")), "9/19/2026");
  assert.equal(dayTabName(new Date("2026-01-05T15:00:00Z")), "1/5/2026");
  assert.ok(isDayTab("9/19/2026"));
  assert.ok(!isDayTab("Menu"));
});

test("parseMenu builds items, groups and modifiers; skips archived and unavailable", () => {
  const menu: Cell[][] = [
    MENU_HEADER,
    ["Grilled Cheese", "Classic", 4.5, "Sandwiches", true, true, "http://img/gc.png", false],
    ["Old Item", "", 1, "Main", true, false, "", true],
    ["Fries", "", "$3.00", "", "", "", "", ""],
  ];
  const mods: Cell[][] = [
    MODIFIERS_HEADER,
    ["Grilled Cheese", "Bread", true, 1, 1, "White", 0, true],
    ["Grilled Cheese", "Bread", true, 1, 1, "Wheat", 0.5, true],
    ["Grilled Cheese", "", false, 0, "", "Bacon", 1, true],
    ["Grilled Cheese", "", false, 0, "", "Sold Out", 1, false],
    ["Missing Item", "", false, 0, "", "Ghost", 1, true],
  ];
  const items = parseMenu(menu, mods);
  assert.deepEqual(items.map((i) => i.name), ["Grilled Cheese", "Fries"]);

  const gc = items[0];
  assert.equal(gc.hot, true);
  assert.equal(gc.buttery, "Benjamin Franklin");
  assert.equal(gc.modifiers.length, 3); // White, Wheat, Bacon
  assert.equal(gc.modifierGroups.length, 1);
  assert.equal(gc.modifierGroups[0].required, true);
  assert.equal(gc.modifierGroups[0].maxSelections, 1);
  assert.equal(gc.modifierGroups[0].modifiers.length, 2);
  assert.equal(gc.modifiers.find((m) => m.name === "Bacon")?.modifierGroupId, null);

  const fries = items[1];
  assert.equal(fries.price, 3);
  assert.equal(fries.available, true); // blank defaults to available
  assert.equal(fries.category, "Main");
});

test("parseRoles only recognizes staff/admin, case-insensitively", () => {
  const roles = parseRoles([ROLES_HEADER, ["EWB28", "Admin"], ["abc1", "staff"], ["xyz9", "customer"], ["", "admin"]]);
  assert.equal(roles.get("ewb28"), "admin");
  assert.equal(roles.get("abc1"), "staff");
  assert.equal(roles.has("xyz9"), false);
  assert.equal(roles.size, 2);
});

test("deriveStatus precedence", () => {
  const base = { paid: false, done: false, pickedUp: false, cancelled: false, manual: false };
  assert.equal(deriveStatus(base), "awaiting_payment");
  assert.equal(deriveStatus({ ...base, paid: true }), "pending");
  assert.equal(deriveStatus({ ...base, paid: true, done: true }), "ready");
  assert.equal(deriveStatus({ ...base, paid: true, done: true, pickedUp: true }), "completed");
  assert.equal(deriveStatus({ ...base, paid: true, cancelled: true }), "cancelled");
  assert.equal(deriveStatus({ ...base, manual: true }), "pending");
});

test("statusToCheckboxes never touches Paid and collapses preparing", () => {
  assert.deepEqual(statusToCheckboxes("ready"), { done: true, pickedUp: false, cancelled: false });
  assert.deepEqual(statusToCheckboxes("completed"), { done: true, pickedUp: true, cancelled: false });
  assert.deepEqual(statusToCheckboxes("preparing"), statusToCheckboxes("pending"));
  assert.deepEqual(statusToCheckboxes("cancelled"), { cancelled: true });
  assert.deepEqual(statusToCheckboxes("awaiting_payment"), {});
  assert.ok(!("paid" in statusToCheckboxes("completed")));
});

test("parseOrderRow: app-created row round-trips structured items", () => {
  const items = [{ menuItemId: "Grilled Cheese", name: "Grilled Cheese", quantity: 2, price: 5, modifiers: [{ name: "Bacon", price: 0.5 }] }];
  const row: Cell[] = [];
  row[COL.name] = "ewb28";
  row[COL.order] = "2x Grilled Cheese (Bacon)";
  row[COL.done] = false;
  row[COL.paid] = true;
  row[COL.pickedUp] = false;
  row[COL.phone] = "555-1234";
  row[COL.comments] = "no rush";
  row[COL.orderId] = "ord-1";
  row[COL.netId] = "ewb28";
  row[COL.total] = 10;
  row[COL.paymentId] = "CLV123";
  row[COL.submittedAt] = "2026-09-19T23:10:00.000Z";
  row[COL.itemsJson] = JSON.stringify(items);

  const parsed = parseOrderRow(row, "9/19/2026", 5)!;
  assert.equal(parsed.manual, false);
  assert.equal(parsed.paymentId, "CLV123");
  assert.equal(parsed.order.id, "ord-1");
  assert.equal(parsed.order.status, "pending");
  assert.equal(parsed.order.totalPrice, 10);
  assert.equal(parsed.order.comments, "no rush");
  assert.equal(parsed.order.orderItems[0].modifiers[0].name, "Bacon");
  assert.equal(parsed.order.createdAt, "2026-09-19T23:10:00.000Z");
});

test("parseOrderRow: hand-typed row is display-only and pending", () => {
  const parsed = parseOrderRow(["Sam", "turkey sandwich no mayo", false, false, false, "", ""], "9/19/2026", 7)!;
  assert.equal(parsed.manual, true);
  assert.equal(parsed.order.id, "manual:9/19/2026:7");
  assert.equal(parsed.order.status, "pending");
  assert.equal(parsed.order.totalPrice, 0);
  assert.equal(parsed.order.netId, "Sam");
  assert.equal(parsed.order.orderItems[0].name, "turkey sandwich no mayo");
});

test("parseOrderRow: blank rows are skipped and bad Items JSON degrades gracefully", () => {
  assert.equal(parseOrderRow([], "9/19/2026", 3), null);
  assert.equal(parseOrderRow(["", "", false, false], "9/19/2026", 3), null);

  const row: Cell[] = [];
  row[COL.name] = "ewb28";
  row[COL.order] = "fries";
  row[COL.orderId] = "ord-2";
  row[COL.itemsJson] = "{not json";
  const parsed = parseOrderRow(row, "9/19/2026", 4)!;
  assert.equal(parsed.order.orderItems[0].name, "fries");
});

test("extractDriveFileId understands the ways workers paste Drive links", () => {
  const id = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";
  assert.equal(extractDriveFileId(`https://drive.google.com/file/d/${id}/view?usp=sharing`), id);
  assert.equal(extractDriveFileId(`https://drive.google.com/open?id=${id}`), id);
  assert.equal(extractDriveFileId(`https://drive.google.com/uc?export=view&id=${id}`), id);
  assert.equal(extractDriveFileId(`https://drive.google.com/thumbnail?id=${id}&sz=w1000`), id);
  assert.equal(extractDriveFileId(`https://lh3.googleusercontent.com/d/${id}`), id);
  // not images we can proxy
  assert.equal(extractDriveFileId(`https://drive.google.com/drive/folders/${id}`), null);
  assert.equal(extractDriveFileId(`https://example.com/file/d/${id}/view`), null); // wrong host
  assert.equal(extractDriveFileId("https://cdn.example.com/fries.png"), null);
  assert.equal(extractDriveFileId("not a url"), null);
});

test("parseMenu rewrites Drive links to this server's image route and leaves other URLs alone", () => {
  const id = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";
  const menu: Cell[][] = [
    MENU_HEADER,
    ["Fries", "", 3, "Sides", true, false, `https://drive.google.com/file/d/${id}/view`, false],
    ["Wrap", "", 6, "Mains", true, false, "https://cdn.example.com/wrap.png", false],
    ["Soup", "", 4, "Mains", true, false, "", false],
  ];
  const rewritten = parseMenu(menu, [MODIFIERS_HEADER], { imageBaseUrl: "https://api.example.com/" });
  assert.equal(rewritten[0].image, `https://api.example.com/api/images/${id}`);
  assert.equal(rewritten[1].image, "https://cdn.example.com/wrap.png");
  assert.equal(rewritten[2].image, null);

  // without a base URL nothing is rewritten
  assert.equal(parseMenu(menu, [MODIFIERS_HEADER])[0].image, `https://drive.google.com/file/d/${id}/view`);
});

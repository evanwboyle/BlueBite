// HTTP-level tests for the Sheets-mode routers, run against the in-memory fake sheet.
process.env.STORE = "sheets";
process.env.PAYMENT_PROVIDER = "mock";
process.env.MOCK_PAYMENT_DELAY_MS = "20";
process.env.SHEETS_WEBHOOK_SECRET = "s3cret";

import { test, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "net";
import { SheetsMirror } from "../services/sheets/mirror";
import { SheetsStore } from "../services/sheets/store";
import { FakeSheets } from "../services/sheets/testing";
import {
  COL,
  MENU_HEADER,
  MODIFIERS_HEADER,
  ROLES_HEADER,
  dayTabName,
} from "../services/sheets/model";
import { createSheetsRouter } from "./sheets";
import { createSheetsPaymentsRouter } from "./paymentsSheets";
import { MemoryPaymentStore, type PaymentRecord } from "../services/payments/paymentStore";

/** Like Redis, hands back copies: routes must not rely on mutating the object they saved. Also keeps tests off the network. */
class CopyingPaymentStore extends MemoryPaymentStore {
  private copy(r: PaymentRecord | null) {
    return r ? { ...r } : null;
  }
  async getById(id: string) {
    return this.copy(await super.getById(id));
  }
  async getByOrder(orderId: string) {
    return this.copy(await super.getByOrder(orderId));
  }
  async save(r: PaymentRecord) {
    await super.save({ ...r });
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The rate limiters keep one shared per-IP counter (see middleware/security.ts), so give every test its own client IP.
let nextIp = 1;
const freshIp = () => `10.0.0.${nextIp++}`;

async function setup() {
  const sheets = new FakeSheets();
  sheets.set("Menu", [
    MENU_HEADER,
    ["Fries", "", 3, "Sides", true, false, "", false],
    ["Wrap", "", 6, "Mains", true, true, "", false],
  ]);
  sheets.set("Modifiers", [MODIFIERS_HEADER]);
  sheets.set("Roles", [ROLES_HEADER, ["staff1", "staff"], ["admin1", "admin"]]);
  const events: Array<{ type: string; data: any }> = [];
  const emit = (type: string, data: unknown) => events.push({ type, data });
  const mirror = new SheetsMirror(sheets, emit);
  const store = new SheetsStore(sheets, mirror);
  await mirror.refresh();

  const app = express();
  app.set("trust proxy", true);
  app.use(express.json());
  // Stand-in for passport: the test picks who is logged in with an x-user header.
  app.use((req, _res, next) => {
    const netId = req.get("x-user");
    (req as any).isAuthenticated = () => Boolean(netId);
    if (netId) (req as any).user = { netId, name: null, role: mirror.getRole(netId) };
    next();
  });
  app.use(createSheetsRouter({ mirror, store }));
  app.use("/api/orders", createSheetsPaymentsRouter({ mirror, store, broadcastEvent: emit, paymentStore: new CopyingPaymentStore() }));

  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const ip = freshIp();
  const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { "content-type": "application/json", "x-forwarded-for": ip, ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  return { sheets, mirror, store, events, call, close: () => server.close(), today: dayTabName() };
}

const cleanups: Array<() => void> = [];
after(() => cleanups.forEach((fn) => fn()));

async function ctx() {
  const c = await setup();
  cleanups.push(c.close);
  return c;
}

test("menu and butteries are served from the sheet; non-Franklin butteries get nothing", async () => {
  const { call } = await ctx();
  const menu = await call("GET", "/api/menu?buttery=Benjamin%20Franklin");
  assert.equal(menu.status, 200);
  assert.deepEqual(menu.body.map((m: any) => m.name), ["Fries", "Wrap"]);
  assert.deepEqual((await call("GET", "/api/menu?buttery=Pierson")).body, []);
  assert.deepEqual((await call("GET", "/api/butteries")).body, [{ name: "Benjamin Franklin", itemCount: 2 }]);
  assert.equal((await call("GET", "/api/menu/Fries")).body.price, 3);
  assert.equal((await call("GET", "/api/menu/Nope")).status, 404);
});

test("menu write endpoints are disabled with a pointer to the sheet", async () => {
  const { call } = await ctx();
  const res = await call("POST", "/api/menu", { name: "x" });
  assert.equal(res.status, 501);
  assert.equal(res.body.code, "MANAGED_IN_SHEET");
  assert.equal((await call("DELETE", "/api/menu/Fries")).status, 501);
  assert.equal((await call("POST", "/api/upload/menu-image")).status, 501);
});

test("staff can toggle availability (written to the sheet); customers cannot", async () => {
  const { call, sheets } = await ctx();
  assert.equal((await call("PATCH", "/api/menu/Fries/toggle", { available: false })).status, 401);
  assert.equal((await call("PATCH", "/api/menu/Fries/toggle", { available: false }, { "x-user": "cust1" })).status, 403);

  const res = await call("PATCH", "/api/menu/Fries/toggle", { available: false }, { "x-user": "staff1" });
  assert.equal(res.status, 200);
  assert.equal(res.body.available, false);
  assert.equal(sheets.rows("Menu")[1][4], false);
  assert.equal((await call("PATCH", "/api/menu/Nope/toggle", { available: false }, { "x-user": "staff1" })).status, 404);
});

test("order lifecycle over HTTP: create, list, change status, comment", async () => {
  const { call, events, sheets, today } = await ctx();

  const bad = await call("POST", "/api/orders", { netId: "ewb28", items: [{ menuItemId: "Nope", quantity: 1 }] });
  assert.equal(bad.status, 400);

  const created = await call("POST", "/api/orders", { netId: "ewb28", phone: "555", items: [{ menuItemId: "Fries", quantity: 2, price: 0 }] });
  assert.equal(created.status, 201);
  assert.equal(created.body.totalPrice, 6);
  assert.equal(created.body.status, "awaiting_payment");
  const id = created.body.id;

  assert.equal((await call("GET", "/api/orders")).body.length, 1);
  assert.equal((await call("GET", "/api/users/EWB28/orders")).body.length, 1);
  assert.equal((await call("GET", "/api/users/someone/orders")).body.length, 0);

  assert.equal((await call("PATCH", `/api/orders/${id}`, { status: "bogus" })).status, 400);
  assert.equal((await call("PATCH", `/api/orders/${id}`, {})).status, 400);
  const ready = await call("PATCH", `/api/orders/${id}`, { status: "ready" });
  assert.equal(ready.body.status, "ready");
  assert.equal(sheets.rows(today)[1][COL.done], true);

  const commented = await call("PATCH", `/api/orders/${id}/comments`, { comments: "extra ketchup" });
  assert.equal(commented.body.comments, "extra ketchup");
  assert.equal((await call("PATCH", "/api/orders/missing", { status: "ready" })).status, 404);

  assert.ok(events.some((e) => e.type === "order:created"));
  assert.ok(events.some((e) => e.type === "order:updated"));
});

test("mock payment: succeeds, writes Paid + payment ID, moves order to pending, blocks a second charge", async () => {
  const { call, sheets, events, today } = await ctx();
  const { body: order } = await call("POST", "/api/orders", { netId: "ewb28", items: [{ menuItemId: "Wrap", quantity: 1 }] });

  const start = await call("POST", `/api/orders/${order.id}/payment`, { netId: "ewb28" });
  assert.equal(start.status, 202);
  assert.equal(start.body.amount, 6);
  assert.equal(start.body.status, "awaiting_device");

  await sleep(150); // mock device taps after 20ms; sheet write follows
  const paid = await call("GET", `/api/orders/${order.id}/payment`);
  assert.equal(paid.body.status, "succeeded");

  const row = sheets.rows(today)[1];
  assert.equal(row[COL.paid], true);
  assert.match(String(row[COL.paymentId]), /^mock_/);
  assert.equal((await call("GET", "/api/orders")).body[0].status, "pending");
  assert.ok(events.some((e) => e.type === "payment:updated" && e.data.status === "succeeded"));

  const again = await call("POST", `/api/orders/${order.id}/payment`, {});
  assert.equal(again.status, 409);
  assert.equal(again.body.code, "ALREADY_PAID");
});

test("payment status survives a restart: a paid row is reported as succeeded from the sheet alone", async () => {
  const { call, store } = await ctx();
  const order = await store.createOrder({ netId: "a", items: [{ menuItemId: "Fries", quantity: 1 }] });
  await store.markPaid(order.id, "CLOVER-1");
  const res = await call("GET", `/api/orders/${order.id}/payment`);
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "succeeded");
  assert.equal(res.body.id, "CLOVER-1");
});

test("cancelling an in-flight payment leaves the order unpaid and the late device result is ignored", async () => {
  const { call, sheets, today } = await ctx();
  const { body: order } = await call("POST", "/api/orders", { netId: "a", items: [{ menuItemId: "Fries", quantity: 1 }] });
  await call("POST", `/api/orders/${order.id}/payment`, {});
  const cancelled = await call("POST", `/api/orders/${order.id}/payment/cancel`, {});
  assert.equal(cancelled.body.status, "cancelled");
  await sleep(100);
  assert.equal(sheets.rows(today)[1][COL.paid], false);
  assert.equal((await call("GET", "/api/orders")).body[0].status, "cancelled");
});

test("admin bypass records who released the order; non-admins are refused", async () => {
  const { call, sheets, today } = await ctx();
  const { body: order } = await call("POST", "/api/orders", { netId: "a", items: [{ menuItemId: "Fries", quantity: 1 }] });

  assert.equal((await call("POST", `/api/orders/${order.id}/payment/bypass`, {}, { "x-user": "staff1" })).status, 403);
  const res = await call("POST", `/api/orders/${order.id}/payment/bypass`, { reason: "device down" }, { "x-user": "admin1" });
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "bypassed");
  assert.equal(sheets.rows(today)[1][COL.paymentId], "BYPASS:admin1");
  assert.equal(sheets.rows(today)[1][COL.paid], true);
  assert.equal((await call("POST", `/api/orders/${order.id}/payment/bypass`, {}, { "x-user": "admin1" })).status, 409);
});

test("hand-typed rows cannot be charged", async () => {
  const sheets = new FakeSheets();
  sheets.set("Menu", [MENU_HEADER]);
  sheets.set("Roles", [ROLES_HEADER]);
  sheets.set(dayTabName(), [["Name", "Order"], ["Sam", "turkey sandwich", false, false, false]]);
  const mirror = new SheetsMirror(sheets, () => undefined);
  const store = new SheetsStore(sheets, mirror);
  await mirror.refresh();
  const app = express();
  app.set("trust proxy", true);
  app.use(express.json());
  app.use("/api/orders", createSheetsPaymentsRouter({ mirror, store, broadcastEvent: () => undefined, paymentStore: new CopyingPaymentStore() }));
  const server = app.listen(0);
  cleanups.push(() => server.close());
  const id = mirror.getOrders()[0].id;
  const res = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/orders/${encodeURIComponent(id)}/payment`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": freshIp() }, body: "{}" });
  assert.equal(res.status, 400);
});

test("webhook requires the shared secret and triggers a refresh", async () => {
  const { call, sheets, mirror } = await ctx();
  assert.equal((await call("POST", "/api/sheets/webhook", {})).status, 401);
  assert.equal((await call("POST", "/api/sheets/webhook", {}, { "x-webhook-secret": "wrong" })).status, 401);

  const before = sheets.reads;
  sheets.set("Menu", [MENU_HEADER, ["Fries", "", 9, "Sides", true, false, "", false]]);
  const ok = await call("POST", "/api/sheets/webhook", {}, { "x-webhook-secret": "s3cret" });
  assert.equal(ok.status, 202);
  await sleep(1300); // debounced to at most one refresh per second
  assert.ok(sheets.reads > before);
  assert.equal(mirror.getMenuItem("Fries")!.price, 9);
});

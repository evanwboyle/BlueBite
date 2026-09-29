process.env.STORE = "sheets";

import { test, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "net";
import { SheetsMirror } from "../services/sheets/mirror";
import { SheetsStore } from "../services/sheets/store";
import { DriveImageCache } from "../services/sheets/drive";
import { FakeSheets } from "../services/sheets/testing";
import { MENU_HEADER, MODIFIERS_HEADER, ROLES_HEADER } from "../services/sheets/model";
import { createSheetsRouter } from "./sheets";

const ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";
const OTHER = "9ZyXwVuTsRqPoNmLkJiHgFeDcBa987654"; // a Drive file the menu does NOT reference

async function setup(fetcher: (id: string) => Promise<{ data: Buffer; contentType: string }>) {
  const sheets = new FakeSheets();
  sheets.set("Menu", [
    MENU_HEADER,
    ["Fries", "", 3, "Sides", true, false, `https://drive.google.com/file/d/${ID}/view?usp=sharing`, false],
  ]);
  sheets.set("Modifiers", [MODIFIERS_HEADER]);
  sheets.set("Roles", [ROLES_HEADER]);
  const mirror = new SheetsMirror(sheets, () => undefined, { imageBaseUrl: "http://localhost:3000" });
  const store = new SheetsStore(sheets, mirror);
  await mirror.refresh();

  const app = express();
  app.use(express.json());
  app.use(createSheetsRouter({ mirror, store, images: new DriveImageCache(fetcher) }));
  const server = app.listen(0);
  cleanups.push(() => server.close());
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { base, mirror };
}

const cleanups: Array<() => void> = [];
after(() => cleanups.forEach((fn) => fn()));

test("the menu exposes Drive images as URLs on this server", async () => {
  const { base } = await setup(async () => ({ data: Buffer.from(""), contentType: "image/png" }));
  const menu = (await (await fetch(`${base}/api/menu`)).json()) as Array<{ image: string }>;
  assert.equal(menu[0].image, `http://localhost:3000/api/images/${ID}`);
});

test("serves a referenced Drive image with safe, cacheable headers", async () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const { base } = await setup(async () => ({ data: png, contentType: "image/png" }));
  const res = await fetch(`${base}/api/images/${ID}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/png");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.match(res.headers.get("cache-control") ?? "", /max-age=3600/);
  assert.equal(res.headers.get("cross-origin-resource-policy"), "cross-origin");
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), png);
});

test("refuses files the menu doesn't reference, so the route can't read arbitrary Drive files", async () => {
  let fetched = false;
  const { base } = await setup(async () => {
    fetched = true;
    return { data: Buffer.from("secret"), contentType: "image/png" };
  });
  assert.equal((await fetch(`${base}/api/images/${OTHER}`)).status, 404);
  assert.equal((await fetch(`${base}/api/images/short`)).status, 404);
  assert.equal((await fetch(`${base}/api/images/${ID}%2F..%2Fx`)).status, 404);
  assert.equal(fetched, false); // never even asked Drive
});

test("a Drive failure is a 502, not a crash", async () => {
  const { base } = await setup(async () => {
    throw new Error("File not found: not shared with the service account");
  });
  const res = await fetch(`${base}/api/images/${ID}`);
  assert.equal(res.status, 502);
});

test("the upload endpoint explains where images go now", async () => {
  const { base } = await setup(async () => ({ data: Buffer.from(""), contentType: "image/png" }));
  const res = await fetch(`${base}/api/upload/menu-image`, { method: "POST" });
  assert.equal(res.status, 501);
  assert.match(((await res.json()) as { error: string }).error, /Drive folder/);
});

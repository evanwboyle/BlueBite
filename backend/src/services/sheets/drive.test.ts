import { test } from "node:test";
import assert from "node:assert/strict";
import { DriveImageCache, type DriveImage } from "./drive";

const img = (label: string): DriveImage => ({ data: Buffer.from(label), contentType: "image/png" });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("repeat requests are served from cache; concurrent misses share one Drive fetch", async () => {
  let calls = 0;
  const cache = new DriveImageCache(async () => {
    calls++;
    await sleep(10);
    return img("a");
  });
  const [x, y, z] = await Promise.all([cache.get("f1"), cache.get("f1"), cache.get("f1")]);
  assert.equal(calls, 1);
  assert.equal(x.data.toString(), "a");
  assert.equal(y, x);
  assert.equal(z, x);
  await cache.get("f1");
  assert.equal(calls, 1);
});

test("expired entries are refetched, and a stale copy is served if Drive then fails", async () => {
  let calls = 0;
  let fail = false;
  const cache = new DriveImageCache(async () => {
    calls++;
    if (fail) throw new Error("drive down");
    return img(`v${calls}`);
  }, 20);

  assert.equal((await cache.get("f1")).data.toString(), "v1");
  await sleep(40);
  assert.equal((await cache.get("f1")).data.toString(), "v2"); // refreshed after TTL

  await sleep(40);
  fail = true;
  assert.equal((await cache.get("f1")).data.toString(), "v2"); // stale beats broken
});

test("a failure with nothing cached is surfaced, and is not cached", async () => {
  let calls = 0;
  const cache = new DriveImageCache(async () => {
    calls++;
    if (calls === 1) throw new Error("not shared with the service account");
    return img("ok");
  });
  await assert.rejects(cache.get("f1"), /not shared/);
  assert.equal((await cache.get("f1")).data.toString(), "ok"); // next request retries
});

test("the cache is bounded: the oldest entry is evicted", async () => {
  let calls = 0;
  const cache = new DriveImageCache(async () => {
    calls++;
    return img("x");
  }, 60_000, 2);
  await cache.get("a");
  await cache.get("b");
  await cache.get("c"); // evicts a
  assert.equal(calls, 3);
  await cache.get("b");
  assert.equal(calls, 3);
  await cache.get("a");
  assert.equal(calls, 4);
});

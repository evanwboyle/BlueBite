import test from "node:test";
import assert from "node:assert/strict";
import { channelName, createRealtimeToken, publishRealtime, realtimeEnabled } from "./realtime";

test("channel names are per-buttery slugs with a shared fallback", () => {
  assert.equal(channelName("Benjamin Franklin"), "bluebite:benjamin-franklin");
  assert.equal(channelName(null), "bluebite:all");
  assert.equal(channelName("  !! "), "bluebite:all");
});

test("without ABLY_API_KEY realtime is a no-op", async () => {
  const prev = process.env.ABLY_API_KEY;
  delete process.env.ABLY_API_KEY;
  try {
    assert.equal(realtimeEnabled(), false);
    publishRealtime("order:created", {}, "Benjamin Franklin"); // must not throw
    assert.equal(await createRealtimeToken("Benjamin Franklin"), null);
  } finally {
    if (prev !== undefined) process.env.ABLY_API_KEY = prev;
  }
});

test("token is subscribe-only for the buttery channel and the shared one", async () => {
  const prev = process.env.ABLY_API_KEY;
  process.env.ABLY_API_KEY = "appId.keyId:secret";
  try {
    const token = await createRealtimeToken("Benjamin Franklin");
    assert.deepEqual(JSON.parse(token!.capability!), {
      "bluebite:benjamin-franklin": ["subscribe"],
      "bluebite:all": ["subscribe"],
    });
  } finally {
    if (prev === undefined) delete process.env.ABLY_API_KEY; else process.env.ABLY_API_KEY = prev;
  }
});

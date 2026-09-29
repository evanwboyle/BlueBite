import { test } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { rateLimit } from "./security";

function run(limiter: ReturnType<typeof rateLimit>, ip: string): number {
  let status = 200;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json() {
      return this;
    },
  } as unknown as Response;
  limiter({ ip } as Request, res, () => undefined);
  return status;
}

test("limiters count independently, even for the same client", () => {
  const strict = rateLimit({ windowMs: 60_000, maxRequests: 2, keyGenerator: (r) => r.ip! });
  const polling = rateLimit({ windowMs: 60_000, maxRequests: 100, keyGenerator: (r) => r.ip! });

  // A client polls 50 times; that must not eat into the strict limiter's budget.
  for (let i = 0; i < 50; i++) assert.equal(run(polling, "1.1.1.1"), 200);

  assert.equal(run(strict, "1.1.1.1"), 200);
  assert.equal(run(strict, "1.1.1.1"), 200);
  assert.equal(run(strict, "1.1.1.1"), 429); // its own third request is still blocked
});

test("a limiter still tracks clients separately", () => {
  const limiter = rateLimit({ windowMs: 60_000, maxRequests: 1, keyGenerator: (r) => r.ip! });
  assert.equal(run(limiter, "2.2.2.2"), 200);
  assert.equal(run(limiter, "2.2.2.2"), 429);
  assert.equal(run(limiter, "3.3.3.3"), 200);
});

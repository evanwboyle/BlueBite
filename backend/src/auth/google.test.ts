import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { createGoogleAuthRouter, identityFromClaims, type GoogleVerifier } from "./google";
import { verifyToken, AUTH_COOKIE } from "./jwt";
import { parseRoleEmails } from "../services/sheets/model";

process.env.JWT_SECRET = "test-secret";

test("identity requires a verified email in the allowed domain, on both the claim and the address", () => {
  const ok = { email: "Ewb28@Yale.edu", email_verified: true, hd: "yale.edu" };
  assert.deepEqual(identityFromClaims(ok, "yale.edu"), { email: "ewb28@yale.edu", netId: "ewb28" });
  assert.equal(identityFromClaims({ ...ok, email_verified: false }, "yale.edu"), null);
  assert.equal(identityFromClaims({ ...ok, hd: undefined }, "yale.edu"), null, "a personal gmail has no hd");
  assert.equal(identityFromClaims({ ...ok, hd: "evil.com" }, "yale.edu"), null);
  assert.equal(identityFromClaims({ ...ok, email: "a@yale.edu.evil.com" }, "yale.edu"), null);
  assert.equal(identityFromClaims({ email: "@yale.edu", email_verified: true, hd: "yale.edu" }, "yale.edu"), null);
});

function start(verify: GoogleVerifier | undefined, role: "customer" | "admin" = "customer") {
  const app = express();
  app.use(express.json());
  app.use(createGoogleAuthRouter({ verify, allowedDomain: "yale.edu", resolveRole: () => role }));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  // each test gets its own client IP so the shared login rate limit never interferes
  const post = (body: unknown) =>
    fetch(`${base}/api/auth/google`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": String(Math.random()) },
      body: JSON.stringify(body),
    });
  return { post, close: () => server.close() };
}

test("valid Yale credential sets a JWT cookie with the resolved role", async () => {
  const { post, close } = start(async () => ({ email: "ewb28@yale.edu", email_verified: true, hd: "yale.edu" }), "admin");
  try {
    const res = await post({ credential: "tok" });
    assert.equal(res.status, 200);
    const cookie = res.headers.get("set-cookie")!;
    assert.match(cookie, /HttpOnly/);
    const token = cookie.split(";")[0].slice(`${AUTH_COOKIE}=`.length);
    assert.deepEqual(verifyToken(token), { netId: "ewb28", role: "admin", email: "ewb28@yale.edu" });
  } finally {
    close();
  }
});

test("non-Yale accounts get 403 and no cookie; bad tokens get 401; missing credential 400", async () => {
  const gmail = start(async () => ({ email: "someone@gmail.com", email_verified: true }));
  const bad = start(async () => {
    throw new Error("Wrong recipient");
  });
  try {
    const r1 = await gmail.post({ credential: "tok" });
    assert.equal(r1.status, 403);
    assert.equal(r1.headers.get("set-cookie"), null);
    assert.equal((await bad.post({ credential: "tok" })).status, 401);
    assert.equal((await bad.post({})).status, 400);
  } finally {
    gmail.close();
    bad.close();
  }
});

test("unconfigured server answers 404", async () => {
  delete process.env.GOOGLE_CLIENT_ID;
  const { post, close } = start(undefined);
  try {
    assert.equal((await post({ credential: "tok" })).status, 404);
  } finally {
    close();
  }
});

test("Roles tab matches on the Google Email column", () => {
  const rows = [["NetID", "Role", "Google Email"], ["ewb28", "admin", "Evan.Boyle@yale.edu"], ["x1", "customer", "c@yale.edu"], ["y2", "staff", ""]];
  assert.deepEqual([...parseRoleEmails(rows)], [["evan.boyle@yale.edu", "admin"]]);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { getServerConfig } from "./config";

test("config reflects the active store", () => {
  const prev = process.env.STORE;
  try {
    delete process.env.STORE;
    assert.deepEqual(getServerConfig(), { store: "postgres", menuEditable: true, preparingStatus: true });
    process.env.STORE = "sheets";
    assert.deepEqual(getServerConfig(), { store: "sheets", menuEditable: false, preparingStatus: false });
  } finally {
    if (prev === undefined) delete process.env.STORE; else process.env.STORE = prev;
  }
});

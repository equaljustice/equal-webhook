// One retry for empty / transient-failed model turns (QA 2026-10-30 F8).
// Run: node --test test/turnRetry.test.mjs
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";

import { withTurnRetry } from "../src/chat/turnRetry.js";

const prev = process.env.JOLLYJI_TURN_RETRY;
afterEach(() => {
  if (prev === undefined) delete process.env.JOLLYJI_TURN_RETRY;
  else process.env.JOLLYJI_TURN_RETRY = prev;
});
const quiet = { log: { warn() {} } };
const seq = (...outs) => {
  let i = 0;
  const fn = async () => {
    const o = outs[i++];
    if (o instanceof Error) throw o;
    return o;
  };
  fn.calls = () => i;
  return fn;
};

test("flag off: one call, empty reply returned as is", async () => {
  delete process.env.JOLLYJI_TURN_RETRY;
  const call = seq("", "late");
  assert.equal(await withTurnRetry(call, quiet), "");
  assert.equal(call.calls(), 1);
});

test("empty reply → retried once", async () => {
  process.env.JOLLYJI_TURN_RETRY = "true";
  const call = seq("  ", "Question 17: …");
  assert.equal(await withTurnRetry(call, quiet), "Question 17: …");
  assert.equal(call.calls(), 2);
});

test("'terminated' stream error → retried once; a second failure is thrown", async () => {
  process.env.JOLLYJI_TURN_RETRY = "true";
  const ok = seq(new Error("terminated"), "doc");
  assert.equal(await withTurnRetry(ok, quiet), "doc");
  const bad = seq(new Error("terminated"), new Error("terminated"));
  await assert.rejects(withTurnRetry(bad, quiet), /terminated/);
  assert.equal(bad.calls(), 2);
});

test("non-transient errors (e.g. stale cache) are not retried here", async () => {
  process.env.JOLLYJI_TURN_RETRY = "true";
  const call = seq(new Error("cachedContent not found"), "x");
  await assert.rejects(withTurnRetry(call, quiet), /cachedContent/);
  assert.equal(call.calls(), 1);
});

test("a caller's isEmpty test decides (e.g. control-JSON-only replies)", async () => {
  process.env.JOLLYJI_TURN_RETRY = "true";
  const call = seq('{"payment_required": false}', "Question 6: …");
  const isEmpty = (raw) => raw.trim().startsWith("{");
  assert.equal(await withTurnRetry(call, { ...quiet, isEmpty }), "Question 6: …");
  assert.equal(call.calls(), 2);
});

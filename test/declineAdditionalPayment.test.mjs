// "No thanks" at an optional additional-document barrier (QA 2026-10-30 F5).
// Run: node --test test/declineAdditionalPayment.test.mjs
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  canDeclineAdditionalPayment,
  declineAdditionalPayment,
} from "../src/chat/declineAdditionalPayment.js";

const prev = process.env.JOLLYJI_EXTRA_DOC_DECLINE;
afterEach(() => {
  if (prev === undefined) delete process.env.JOLLYJI_EXTRA_DOC_DECLINE;
  else process.env.JOLLYJI_EXTRA_DOC_DECLINE = prev;
});

const extraBarrier = () => ({
  isPaid: false,
  paymentGateShown: true,
  paymentCycle: 1,
  qaPhase: "waiting_payment",
  selectedLanguage: "en",
  messages: [],
});

test("flag off: nothing can be declined", () => {
  delete process.env.JOLLYJI_EXTRA_DOC_DECLINE;
  assert.equal(declineAdditionalPayment(extraBarrier()), null);
});

test("declining an extra document ends the chat with no charge owed", () => {
  process.env.JOLLYJI_EXTRA_DOC_DECLINE = "true";
  const s = extraBarrier();
  const out = declineAdditionalPayment(s);
  assert.equal(out.sessionTerminated, true);
  assert.equal(out.paymentRequired, false);
  assert.equal(s.paymentCycle, 0);
  assert.equal(s.isPaid, true);
  assert.equal(s.qaPhase, "terminated");
  assert.match(s.messages.at(-1).content, /session is over/i);
  assert.equal(canDeclineAdditionalPayment(s), false); // not twice
});

test("the first (49) barrier and paid or ended sessions cannot be declined", () => {
  process.env.JOLLYJI_EXTRA_DOC_DECLINE = "true";
  assert.equal(canDeclineAdditionalPayment({ ...extraBarrier(), paymentCycle: 0 }), false);
  assert.equal(canDeclineAdditionalPayment({ ...extraBarrier(), isPaid: true }), false);
  assert.equal(canDeclineAdditionalPayment({ ...extraBarrier(), qaPhase: "terminated" }), false);
});

import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { enforceLegacySessionGuards } from "../src/chat/sessionGuards.js";

afterEach(() => delete process.env.JOLLYJI_PICK_BEFORE_PAY);
// Verbatim shape from the F&F last-pick walk (2026-11-03): menu and payment in one turn.
const menuAndPay = {
  paymentRequired: true,
  cleanMessage:
    "<h5><strong>Which document do you wish to generate?</strong></h5>(a) Detailed F&F Statutory Audit &amp; Recalculation Statement<br>(b) Soft-Toned Clarification &amp; Rectification Email to HR / Finance<br><br>To generate this additional document, please complete the payment.",
};

test("flag off: the model's payment request is trusted (unchanged)", () => {
  const out = enforceLegacySessionGuards({}, menuAndPay);
  assert.equal(out.paymentRequired, true);
  assert.equal(out.cleanMessage, menuAndPay.cleanMessage);
});

test("flag on: no payment until the user has picked a document", () => {
  process.env.JOLLYJI_PICK_BEFORE_PAY = "true";
  const out = enforceLegacySessionGuards({}, menuAndPay);
  assert.equal(out.paymentRequired, false);
  assert.doesNotMatch(out.cleanMessage, /complete the payment/);
  assert.match(out.cleanMessage, /\(b\) Soft-Toned/);
});

test("flag on: payment after the pick is untouched", () => {
  process.env.JOLLYJI_PICK_BEFORE_PAY = "true";
  const out = enforceLegacySessionGuards({}, {
    paymentRequired: true,
    cleanMessage: "To generate this additional document, please complete the payment.",
  });
  assert.equal(out.paymentRequired, true);
});

// Cycle-0 barrier copy must not claim the questions are over (QA 2026-10-30 F5).
// Run: node --test test/barrierCopy.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  paymentBarrierMessage,
  legacyPaymentBarrierMessage,
} from "../src/chat/messageControlParse.js";
import { isAssessmentBarrierCopy, pickModelPaymentMessage } from "../src/chat/sessionGuards.js";

const LANGS = ["en", "hi", "bn", "gu", "pa", "ta", "te", "kn", "or", "ur"];

test("cycle-0 copy no longer says all questions are complete or promises an assessment", () => {
  const en = paymentBarrierMessage("en");
  assert.doesNotMatch(en, /completing all the questions|assessment/i);
  for (const lang of LANGS) assert.notEqual(paymentBarrierMessage(lang), legacyPaymentBarrierMessage(lang));
});

test("old and new cycle-0 copy are both recognised, so a model echo never becomes document copy", () => {
  for (const lang of LANGS) {
    assert.equal(isAssessmentBarrierCopy(paymentBarrierMessage(lang)), true);
    assert.equal(isAssessmentBarrierCopy(legacyPaymentBarrierMessage(lang)), true);
    assert.equal(pickModelPaymentMessage(legacyPaymentBarrierMessage(lang)), null);
  }
});

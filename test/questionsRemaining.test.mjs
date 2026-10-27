// Dynamic progress: model-reported "questions_remaining" (Assistant.config.dynamicProgress).
import { test } from "node:test";
import assert from "node:assert/strict";

import { extractUploadRequirement } from "../src/chat/messageControlParse.js";
import {
  normalizeQuestionsRemaining,
  isDynamicProgressAssistant,
} from "../src/chat/progressControl.js";

const json = (extra) =>
  `{"session_terminated": false, "termination_message": null, "payment_required": false, "batch_form": true, "multi_select": false, "upload_required": false, "upload_type": null, "upload_reason": null${extra}}`;

test("reads top-level questions_remaining", () => {
  const info = extractUploadRequirement(`Question 8: Where?\n${json(', "questions_remaining": 12')}`);
  assert.equal(info.questionsRemaining, 12);
  assert.equal(info.sessionTerminated, false);
  assert.ok(!info.cleanMessage.includes("questions_remaining"));
});

test("accepts it nested in session_state, and is null when absent", () => {
  const nested = extractUploadRequirement(
    `Q?\n${json(', "session_state": {"current_step": "batch_2", "questions_remaining": "4"}')}`
  );
  assert.equal(nested.questionsRemaining, 4);
  assert.equal(extractUploadRequirement(`Q?\n${json("")}`).questionsRemaining, null);
});

test("normalizeQuestionsRemaining rejects junk and clamps", () => {
  assert.equal(normalizeQuestionsRemaining(0), 0);
  assert.equal(normalizeQuestionsRemaining("7"), 7);
  assert.equal(normalizeQuestionsRemaining(-1), null);
  assert.equal(normalizeQuestionsRemaining("many"), null);
  assert.equal(normalizeQuestionsRemaining(9999), 500);
});

test("only assistants with config.dynamicProgress opt in", () => {
  assert.equal(isDynamicProgressAssistant({ config: { dynamicProgress: true } }), true);
  assert.equal(isDynamicProgressAssistant({ config: {} }), false);
  assert.equal(isDynamicProgressAssistant(null), false);
});

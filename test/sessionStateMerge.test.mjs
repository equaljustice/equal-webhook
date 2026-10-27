import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeSessionStateFromModel, MAX_ANSWER_JSON_CHARS } from "../src/chat/sessionStateProtocol.js";

test("merge drops oversized answer values (e.g. a copied gift register) and keeps small ones", () => {
  const session = { answers: { q1: "a" }, languageConfirmedByUser: true };
  const big = Array.from({ length: 50 }, () => ({ giver: "Neha Jain", value: "40,000" }));
  assert.ok(JSON.stringify(big).length > MAX_ANSWER_JSON_CHARS);
  mergeSessionStateFromModel(session, {
    answers: { gift_register: big, generated_documents: ["Gift Register"], q2: "b" },
  });
  assert.equal(session.answers.gift_register, undefined);
  assert.deepEqual(session.answers.generated_documents, ["Gift Register"]);
  assert.equal(session.answers.q1, "a");
  assert.equal(session.answers.q2, "b");
});

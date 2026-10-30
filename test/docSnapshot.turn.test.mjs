// Offline legacy turns: which reply becomes the saved document, and when a paid cycle
// may open a new charge (QA 2026-10-30, reports/2026-10-30-edith-qa-usecases.md F1/F2).
// Run: node --test --experimental-test-module-mocks test/docSnapshot.turn.test.mjs
import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

import {
  loadOrchestrator,
  queueModelReply,
  runTurn,
  DEFAULT_JSON,
  PAYMENT_JSON,
  DOCUMENT_BODY,
} from "./helpers/legacyTurnHarness.mjs";
import { isDocumentLikeText } from "../src/chat/messageControlParse.js";

let orch;
const prevFlag = process.env.JOLLYJI_ENFORCE_DOC_PAYMENT;

before(async () => {
  orch = await loadOrchestrator();
});
beforeEach(() => {
  process.env.JOLLYJI_ENFORCE_DOC_PAYMENT = "true";
});
after(() => {
  if (prevFlag === undefined) delete process.env.JOLLYJI_ENFORCE_DOC_PAYMENT;
  else process.env.JOLLYJI_ENFORCE_DOC_PAYMENT = prevFlag;
});

const TERMINATION_JSON = DEFAULT_JSON.replace(
  '"session_terminated": false',
  '"session_terminated": true'
);
const LAST_QUESTION =
  "<h5><strong>Question 17:</strong></h5><h6>Would you prefer ad-hoc arbitration or institutional arbitration?</h6>" +
  "If the confidential information involved is not critical to your company's business, you may choose ad-hoc arbitration. ".repeat(3);

function paidSession(key, extra = {}) {
  return {
    _id: "sess-snap",
    assistantKey: key,
    price: 49,
    additionalPrice: 25,
    isPaid: true,
    paymentGateShown: true,
    paymentCycle: 0,
    qaPhase: "ready_for_final",
    selectedLanguage: "en",
    languageConfirmedByUser: true,
    messages: [{ role: "assistant", content: LAST_QUESTION }],
    ...extra,
  };
}

const assistantFor = (key) => ({ key, config: { systemInstructionAsset: `assets/prompts/${key}.txt` } });
const savedText = (session) => session.finalDocumentData?.content?.sections?.[0]?.text || "";

test("document that also ends the chat is saved — not the previous question", async () => {
  const session = paidSession("make-my-nda");
  const { result } = await runTurn(orch, {
    session,
    assistant: assistantFor("make-my-nda"),
    userMessage: "(b) Institutional",
    modelReply: `${DOCUMENT_BODY}\n${TERMINATION_JSON}`,
  });
  assert.equal(result.sessionTerminated, true);
  assert.match(savedText(session), /GIFT DECLARATION/);
  assert.doesNotMatch(savedText(session), /Question 17/);
  assert.equal(session.qaPhase, "terminated");
});

test("chat that ends without a document never saves the last question", async () => {
  const session = paidSession("sir_assessment");
  await runTurn(orch, {
    session,
    assistant: assistantFor("sir_assessment"),
    userMessage: "a",
    modelReply: `Upload your documents for review.\n${TERMINATION_JSON}`,
  });
  assert.equal(session.finalDocumentData ?? null, null);
});

test("short post-payment menu is not the document and keeps the cycle open", async () => {
  const session = paidSession("livein-agreement");
  const menu =
    "Thank you for using www.equaljustice.ai. Which language would you like in the draft? (a) English (b) Hindi (c) Both — " +
    "the draft will be generated in the language you choose, and you can download it once it is ready.";
  await runTurn(orch, {
    session,
    assistant: assistantFor("livein-agreement"),
    userMessage: "a",
    modelReply: `${menu}\n${DEFAULT_JSON}`,
  });
  assert.equal(session.finalDocumentData ?? null, null);
  assert.equal(session.qaPhase, "ready_for_final");

  // The real agreement on the next turn is still the paid document of cycle 0.
  const { result } = await runTurn(orch, {
    session,
    assistant: assistantFor("livein-agreement"),
    userMessage: "(a) English",
    modelReply: `${DOCUMENT_BODY}\n${DEFAULT_JSON}`,
  });
  assert.equal(result.paymentRequired, false);
  assert.match(savedText(session), /GIFT DECLARATION/);
  assert.equal(session.paymentCycle, 0);
  assert.equal(session.documentCycle, 0);
});

test("payment asked again before the first document: no new charge, the turn continues as paid", async () => {
  const session = paidSession("upi-frauds");
  queueModelReply(`${DOCUMENT_BODY}\n${DEFAULT_JSON}`); // the continued (paid) generation
  const { result } = await runTurn(orch, {
    session,
    assistant: assistantFor("upi-frauds"),
    userMessage: "(a) Complaint to the bank",
    modelReply: `To generate your selected document, please complete the payment.\n${PAYMENT_JSON}`,
  });
  assert.equal(result.paymentRequired, false);
  assert.match(result.reply, /GIFT DECLARATION/);
  assert.equal(session.isPaid, true);
  assert.equal(session.paymentCycle, 0);
  assert.equal(session.documentCycle, 0);
});

test("after this cycle's document, the next document is a new 25 cycle", async () => {
  const session = paidSession("upi-frauds", {
    qaPhase: "qa_in_progress",
    finalDocumentData: { title: "doc 1" },
    documentCycle: 0,
  });
  const { result } = await runTurn(orch, {
    session,
    assistant: assistantFor("upi-frauds"),
    userMessage: "(b) Police complaint",
    modelReply: `To generate your selected document, please complete the payment.\n${PAYMENT_JSON}`,
  });
  assert.equal(result.paymentRequired, true);
  assert.equal(result.paymentCycle, 1);
  assert.equal(result.paymentAmount, 25);
});

test("isDocumentLikeText: trailing next-question is fine, question batches are not", () => {
  assert.equal(isDocumentLikeText(`${DOCUMENT_BODY}<br>Question 22: Would you like to know the right process of signing? (a) Yes (b) No`), true);
  assert.equal(isDocumentLikeText(`Question 15: Date?<br>${DOCUMENT_BODY}`), false);
  assert.equal(isDocumentLikeText(`Question 8A2: What was your relationship?<br>${DOCUMENT_BODY}`), false);
  assert.equal(isDocumentLikeText(LAST_QUESTION), false);
});

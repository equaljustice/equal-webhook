// End-to-end (offline) legacy turns through handleChatTurn with Gemini mocked.
// Run: node --test --experimental-test-module-mocks test/docPaymentGuard.turn.test.mjs
import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

import {
  loadOrchestrator,
  runTurn,
  sessionAfterDeliverable,
  DEFAULT_JSON,
  PAYMENT_JSON,
  DOCUMENT_BODY,
} from "./helpers/legacyTurnHarness.mjs";

let orch;
const prevFlag = process.env.JOLLYJI_ENFORCE_DOC_PAYMENT;

before(async () => {
  orch = await loadOrchestrator();
});
beforeEach(() => {
  delete process.env.JOLLYJI_ENFORCE_DOC_PAYMENT;
});
after(() => {
  if (prevFlag === undefined) delete process.env.JOLLYJI_ENFORCE_DOC_PAYMENT;
  else process.env.JOLLYJI_ENFORCE_DOC_PAYMENT = prevFlag;
});

const docReply = `${DOCUMENT_BODY}\n${DEFAULT_JSON}`;

test("flag off: unpaid document after deliverable passes through (today's behaviour)", async () => {
  const session = sessionAfterDeliverable("qa_in_progress");
  const { result, chunks } = await runTurn(orch, { session, userMessage: "b", modelReply: docReply });
  assert.equal(result.paymentRequired, false);
  assert.match(result.reply, /GIFT DECLARATION/);
  assert.ok(chunks.some((c) => /GIFT DECLARATION/.test(c)));
  assert.equal(session.paymentCycle, 0);
  assert.equal(session.isPaid, true);
});

test("flag on: document withheld (never streamed), barrier cycle 1 at additionalPrice; payment regenerates + snapshots", async () => {
  process.env.JOLLYJI_ENFORCE_DOC_PAYMENT = "true";
  const session = sessionAfterDeliverable("qa_in_progress");
  const t1 = await runTurn(orch, { session, userMessage: "b", modelReply: docReply });
  assert.equal(t1.result.paymentRequired, true);
  assert.equal(t1.result.paymentCycle, 1);
  assert.equal(t1.result.paymentAmount, 199);
  assert.equal(t1.result.reply, "To generate your selected document, please complete the payment.");
  assert.ok(!t1.chunks.some((c) => /GIFT DECLARATION/.test(c)), "document must not be streamed");
  assert.equal(session.qaPhase, "waiting_payment");
  assert.equal(session.isPaid, false);

  // webhook confirms payment; frontend sends the payment-completed turn
  session.isPaid = true;
  const t2 = await runTurn(orch, { session, userMessage: "Payment completed. Please continue.", modelReply: docReply });
  assert.equal(t2.result.paymentRequired, false);
  assert.match(t2.result.reply, /GIFT DECLARATION/);
  assert.equal(session.qaPhase, "final_output_generated");
  assert.match(session.finalDocumentData.content.sections[0].text, /GIFT DECLARATION/);
  assert.equal(session.paymentCycle, 1);
});

test("flag on: immediately-after-deliverable turn (final_output_generated) is also guarded", async () => {
  process.env.JOLLYJI_ENFORCE_DOC_PAYMENT = "true";
  const session = sessionAfterDeliverable("final_output_generated");
  const { result } = await runTurn(orch, { session, userMessage: "a", modelReply: docReply });
  assert.equal(result.paymentRequired, true);
  assert.equal(result.paymentCycle, 1);
});

test("flag on: question / register / short menu turns untouched and streamed", async () => {
  process.env.JOLLYJI_ENFORCE_DOC_PAYMENT = "true";
  const q = `<h5><strong>Question 26:</strong></h5><h6>Name of the person giving the gift?</h6>\n${DEFAULT_JSON}`;
  const s1 = sessionAfterDeliverable("qa_in_progress");
  const r1 = await runTurn(orch, { session: s1, userMessage: "a", modelReply: q });
  assert.equal(r1.result.paymentRequired, false);
  assert.ok(r1.chunks.some((c) => /Question 26/.test(c)));

  const reg = `Please fill in the gift register below.<span hidden data-ej-gift-register="true"></span>\n${DEFAULT_JSON}`;
  const s2 = sessionAfterDeliverable("qa_in_progress");
  const r2 = await runTurn(orch, { session: s2, userMessage: "a", modelReply: reg });
  assert.equal(r2.result.paymentRequired, false);
  assert.match(r2.result.reply, /data-ej-gift-register/);

  const menu = `<h6>Which document would you like to generate now?</h6>(a) Gift Register<br>(b) Gift Declaration<br>\n${DEFAULT_JSON}`;
  const s3 = sessionAfterDeliverable("qa_in_progress");
  const r3 = await runTurn(orch, { session: s3, userMessage: "a", modelReply: menu });
  assert.equal(r3.result.paymentRequired, false);
  assert.match(r3.result.reply, /Which document/);
});

test("model-set payment_required at a document barrier keeps the model's own sentence (cycle 1)", async () => {
  for (const flag of [undefined, "true"]) {
    if (flag) process.env.JOLLYJI_ENFORCE_DOC_PAYMENT = flag;
    else delete process.env.JOLLYJI_ENFORCE_DOC_PAYMENT;
    const session = sessionAfterDeliverable("qa_in_progress");
    const own = "To generate your customized draft for Gift Register, please complete the payment.";
    const { result } = await runTurn(orch, { session, userMessage: "a", modelReply: `${own}\n${PAYMENT_JSON}` });
    assert.equal(result.paymentRequired, true);
    assert.equal(result.paymentCycle, 1);
    assert.equal(result.paymentAmount, 199);
    assert.equal(result.reply, own);
  }
});

// Offline unit tests for the per-document payment guard (JOLLYJI_ENFORCE_DOC_PAYMENT),
// the download-snapshot exclusions and the cycle-aware barrier copy.
// Run: node --test test/docPaymentGuard.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  decideDocPaymentGuard,
  holdDocumentStream,
  isDocPaymentGuardArmed,
  isDocumentLikeReply,
  DOC_PAYMENT_MIN_VISIBLE_CHARS,
} from "../src/chat/docPaymentGuard.js";
import {
  applyPaymentBarrier,
  buildUnpaidPaymentGateResponse,
  pickModelPaymentMessage,
} from "../src/chat/sessionGuards.js";
import {
  inferDownloadSnapshot,
  applyDownloadSnapshot,
  paymentBarrierMessage,
  documentPaymentBarrierMessage,
} from "../src/chat/messageControlParse.js";
import { QA_PHASES } from "../src/chat/sessionStateProtocol.js";

const MARRIAGE = "marriage-gift-planning";
const DOC = `<strong>GIFT DECLARATION</strong><br>${"I, the undersigned, declare that the gift described below was made voluntarily. ".repeat(20)}`;
const SHORT_MENU =
  "<h6>Which document would you like to generate now?</h6>(a) Gift Register<br>(b) Gift Declaration<br>";

function consumedSession(overrides = {}) {
  return {
    _id: "s1",
    assistantKey: MARRIAGE,
    price: 499,
    additionalPrice: 199,
    isPaid: true,
    paymentGateShown: true,
    paymentCycle: 0,
    qaPhase: QA_PHASES.QA_IN_PROGRESS,
    finalDocumentData: { title: "advice" },
    selectedLanguage: "en",
    messages: [],
    ...overrides,
  };
}

const noFlags = { paymentRequired: false, requiresUpload: false };

function decide(session, cleanMessage, extra = {}) {
  return decideDocPaymentGuard({
    session,
    assistant: { key: MARRIAGE },
    uploadInfo: noFlags,
    cleanMessage,
    userMessage: "a",
    phaseAtTurnStart: session.qaPhase,
    enabled: true,
    ...extra,
  });
}

test("flag off → no-op (not armed, stream callback identical)", () => {
  const s = consumedSession();
  const r = decide(s, DOC, { enabled: false });
  assert.deepEqual(r, { enforce: false, reason: "not_armed" });
  const fn = () => {};
  assert.equal(holdDocumentStream(fn, false), fn);
});

test("flag reads env JOLLYJI_ENFORCE_DOC_PAYMENT (default off)", () => {
  const prev = process.env.JOLLYJI_ENFORCE_DOC_PAYMENT;
  delete process.env.JOLLYJI_ENFORCE_DOC_PAYMENT;
  const args = { session: consumedSession(), assistant: { key: MARRIAGE }, phaseAtTurnStart: QA_PHASES.QA_IN_PROGRESS };
  assert.equal(isDocPaymentGuardArmed(args), false);
  process.env.JOLLYJI_ENFORCE_DOC_PAYMENT = "true";
  assert.equal(isDocPaymentGuardArmed(args), true);
  if (prev === undefined) delete process.env.JOLLYJI_ENFORCE_DOC_PAYMENT;
  else process.env.JOLLYJI_ENFORCE_DOC_PAYMENT = prev;
});

test("doc-like reply after deliverable without payment_required → barrier, cycle+1, additionalPrice", () => {
  for (const phase of [QA_PHASES.FINAL_GENERATED, QA_PHASES.QA_IN_PROGRESS]) {
    const s = consumedSession({ qaPhase: phase });
    const r = decide(s, DOC);
    assert.equal(r.enforce, true, phase);
    const barrier = applyPaymentBarrier(s, { language: "en", assistant: { key: MARRIAGE }, cycleAwareCopy: true });
    assert.equal(barrier.paymentCycle, 1);
    assert.equal(s.paymentCycle, 1);
    assert.equal(barrier.paymentAmount, 199);
    assert.equal(s.isPaid, false);
    assert.equal(barrier.cleanMessage, documentPaymentBarrierMessage("en"));
  }
});

test("Question N / register marker / batch marker / short menu / upload turns → untouched", () => {
  const s = consumedSession();
  assert.equal(decide(s, `<h5><strong>Question 9:</strong></h5>${DOC}`).enforce, false);
  assert.equal(decide(s, `${DOC}<span hidden data-ej-gift-register="true"></span>`).enforce, false);
  assert.equal(decide(s, `${DOC}<span hidden data-ej-batch-form="true"></span>`).enforce, false);
  assert.equal(decide(s, SHORT_MENU).enforce, false);
  assert.equal(decide(s, DOC, { uploadInfo: { ...noFlags, requiresUpload: true } }).enforce, false);
  assert.equal(decide(s, DOC, { userMessage: "Document uploaded successfully. Please analyze it." }).enforce, false);
});

test("threshold counts visible text only", () => {
  const padded = `<strong>${"x".repeat(DOC_PAYMENT_MIN_VISIBLE_CHARS - 1)}</strong>${"<br>".repeat(500)}`;
  assert.equal(isDocumentLikeReply(padded, noFlags, ""), false);
  assert.equal(isDocumentLikeReply("x".repeat(DOC_PAYMENT_MIN_VISIBLE_CHARS), noFlags, ""), true);
});

test("not consumed → untouched (ready_for_final, unpaid, no deliverable, non-repeatable, special access)", () => {
  assert.equal(decide(consumedSession({ qaPhase: QA_PHASES.READY_FOR_FINAL }), DOC).enforce, false);
  assert.equal(decide(consumedSession({ isPaid: false }), DOC).enforce, false);
  assert.equal(decide(consumedSession({ finalDocumentData: null }), DOC).enforce, false);
  assert.equal(
    decide(consumedSession({ assistantKey: "nda-maker" }), DOC, { assistant: { key: "nda-maker" } }).enforce,
    false
  );
  assert.equal(decide(consumedSession(), DOC, { isSpecialAccess: true }).enforce, false);
});

test("model-set payment_required path is left to the existing branch", () => {
  const r = decide(consumedSession(), DOC, { uploadInfo: { ...noFlags, paymentRequired: true } });
  assert.deepEqual(r, { enforce: false, reason: "model_payment_required" });
});

test("stream hold: document never streamed, question turns released", () => {
  const seen = [];
  const held = holdDocumentStream((_c, d) => seen.push(d), true);
  held("x", "<strong>GIFT DECLARATION</strong>");
  held("x", DOC);
  assert.equal(seen.length, 0);
  held("x", "Thanks.<h5><strong>Question 9:</strong></h5>");
  held("x", "Thanks.<h5><strong>Question 9:</strong></h5><h6>Name?</h6>");
  assert.equal(seen.length, 2);
});

test("snapshot: excluded for register marker and upload turns; doc still saved", () => {
  const ready = () => ({ isPaid: true, paymentGateShown: true, qaPhase: QA_PHASES.READY_FOR_FINAL, messages: [] });
  const regIntro = `Please fill in the gift register below. ${"Details. ".repeat(40)}<span hidden data-ej-gift-register="true"></span>`;
  assert.equal(inferDownloadSnapshot(ready(), noFlags, regIntro), false);
  assert.equal(inferDownloadSnapshot(ready(), { ...noFlags, requiresUpload: true }, DOC), false);
  assert.equal(inferDownloadSnapshot(ready(), noFlags, DOC), true);
  const s = ready();
  assert.equal(applyDownloadSnapshot(s, "s1", noFlags, regIntro), false);
  assert.equal(s.qaPhase, QA_PHASES.READY_FOR_FINAL);
  assert.equal(s.finalDocumentData, undefined);
});

test("barrier copy: cycle 0 unchanged; cycle ≥1 keeps model sentence, else document fallback", () => {
  const assistant = { key: MARRIAGE };
  // cycle 0 (first gate) — original text even with model sentence
  const s0 = consumedSession({ isPaid: false, paymentGateShown: false, finalDocumentData: null });
  const b0 = applyPaymentBarrier(s0, { language: "en", assistant, cycleAwareCopy: true, modelMessage: "To continue, please complete the payment." });
  assert.equal(b0.paymentCycle, 0);
  assert.equal(b0.cleanMessage, paymentBarrierMessage("en"));

  const own = "To generate your customized draft for Gift Register, please complete the payment.";
  const b1 = applyPaymentBarrier(consumedSession(), { language: "en", assistant, cycleAwareCopy: true, modelMessage: own });
  assert.equal(b1.paymentCycle, 1);
  assert.equal(b1.cleanMessage, own);

  const hiOwn = "गिफ्ट रजिस्टर का ड्राफ्ट तैयार करने के लिए कृपया भुगतान पूरा करें।";
  assert.equal(pickModelPaymentMessage(hiOwn), hiOwn);
  assert.equal(pickModelPaymentMessage("Please pay ₹199 to continue."), null);
  assert.equal(pickModelPaymentMessage(DOC), null);
  assert.equal(pickModelPaymentMessage(""), null);

  const b2 = applyPaymentBarrier(consumedSession(), { language: "hi", assistant, cycleAwareCopy: true, modelMessage: "" });
  assert.equal(b2.cleanMessage, documentPaymentBarrierMessage("hi"));

  // callers that do not opt in (flow path) and non-repeatable assistants: unchanged
  const b3 = applyPaymentBarrier(consumedSession(), { language: "en", modelMessage: own });
  assert.equal(b3.cleanMessage, paymentBarrierMessage("en"));
  const b4 = applyPaymentBarrier(consumedSession({ assistantKey: "nda-maker" }), { language: "en", assistant: { key: "nda-maker" }, cycleAwareCopy: true, modelMessage: own });
  assert.equal(b4.cleanMessage, paymentBarrierMessage("en"));
});

test("unpaid reminder: cycle ≥1 reuses last barrier sentence; cycle 0 unchanged", () => {
  const own = "To generate your customized draft for Gift Register, please complete the payment.";
  const pending1 = consumedSession({ isPaid: false, paymentCycle: 1 });
  const r1 = buildUnpaidPaymentGateResponse(pending1, { language: "en", assistant: { key: MARRIAGE }, modelMessage: own, cycleAwareCopy: true });
  assert.equal(r1.reply, own);
  assert.equal(r1.paymentAmount, 199);
  const pending0 = consumedSession({ isPaid: false, paymentCycle: 0 });
  const r0 = buildUnpaidPaymentGateResponse(pending0, { language: "en", assistant: { key: MARRIAGE }, modelMessage: own, cycleAwareCopy: true });
  assert.equal(r0.reply, paymentBarrierMessage("en"));
  assert.equal(r0.paymentAmount, 499);
});

test("document barrier: an echoed cycle-0 assessment sentence falls back to document copy", async () => {
  const { pickModelPaymentMessage, isAssessmentBarrierCopy } = await import("../src/chat/sessionGuards.js");
  const { paymentBarrierMessage } = await import("../src/chat/messageControlParse.js");
  const echoed = paymentBarrierMessage("en");
  assert.equal(isAssessmentBarrierCopy(echoed), true);
  assert.equal(pickModelPaymentMessage(echoed), null);
  assert.equal(pickModelPaymentMessage(paymentBarrierMessage("hi")), null);
  const own = "To generate your customized draft for Gift Register, please complete the payment.";
  assert.equal(pickModelPaymentMessage(own), own);
});

/**
 * Per-document payment barrier, enforced server-side (JollyJi contract §3).
 *
 * Repeatable-payment assistants charge once per deliverable. If the paid
 * deliverable of the current cycle was already produced and the model emits
 * another document-like reply WITHOUT payment_required, the reply is withheld
 * and the normal payment barrier is raised instead (next cycle, additionalPrice).
 *
 * Default off; set JOLLYJI_ENFORCE_DOC_PAYMENT=true to enable. When off every
 * export used by the orchestrator is a no-op.
 */

import { isRepeatablePaymentAssistant } from "./sessionGuards.js";
import { QA_PHASES } from "./sessionStateProtocol.js";
import { BATCH_FORM_MARKER_RE } from "./batchFormControl.js";
import { MULTI_SELECT_MARKER_RE } from "./multiSelectControl.js";
import { GIFT_REGISTER_MARKER_RE } from "./messageControlParse.js";
import { isPostUploadAnalysisMessage } from "./uploadFlowHints.js";

export function isDocPaymentEnforcementEnabled() {
  const v = process.env.JOLLYJI_ENFORCE_DOC_PAYMENT;
  return v === "true" || v === "1";
}

/**
 * Visible characters (HTML tags stripped, whitespace collapsed). Question menus
 * and document menus in the prompts are a few hundred visible chars; the
 * shortest fixed document template (MARRIAGE GIFT LEDGER, empty) is ~1860.
 */
export const DOC_PAYMENT_MIN_VISIBLE_CHARS = 1200;

const QUESTION_N_RE = /Question\s+\d+\s*:/i;

export function visibleTextLength(text) {
  return String(text || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

/** Question / form / register turns — never a deliverable. */
export function hasQuestionOrFormMarker(text) {
  const s = String(text || "");
  return (
    QUESTION_N_RE.test(s) ||
    GIFT_REGISTER_MARKER_RE.test(s) ||
    BATCH_FORM_MARKER_RE.test(s) ||
    MULTI_SELECT_MARKER_RE.test(s)
  );
}

/**
 * The paid deliverable of the current cycle was already produced.
 * qaPhase is read at turn start (before advanceQaPhase): the snapshot sets
 * final_output_generated, and advanceQaPhase resets it to qa_in_progress on the
 * next turn, so both phases mean "consumed" while isPaid && paymentGateShown.
 * A fresh payment always passes through waiting_payment → ready_for_final,
 * which stays sticky until the next snapshot.
 */
export function isPaidDeliverableConsumed(session, phaseAtTurnStart) {
  if (!session?.isPaid || !session?.paymentGateShown) return false;
  if (!session.finalDocumentData) return false;
  return (
    phaseAtTurnStart === QA_PHASES.FINAL_GENERATED ||
    phaseAtTurnStart === QA_PHASES.QA_IN_PROGRESS
  );
}

/** Guard is live for this turn (decided before the model is called). */
export function isDocPaymentGuardArmed({
  session,
  assistant,
  phaseAtTurnStart,
  isSpecialAccess = false,
  enabled = isDocPaymentEnforcementEnabled(),
}) {
  if (!enabled || isSpecialAccess) return false;
  if (!isRepeatablePaymentAssistant(session, assistant)) return false;
  return isPaidDeliverableConsumed(session, phaseAtTurnStart);
}

export function isDocumentLikeReply(cleanMessage, uploadInfo, userMessage) {
  if (uploadInfo?.requiresUpload) return false;
  if (isPostUploadAnalysisMessage(userMessage)) return false;
  const text = String(cleanMessage || "");
  if (hasQuestionOrFormMarker(text)) return false;
  return visibleTextLength(text) >= DOC_PAYMENT_MIN_VISIBLE_CHARS;
}

/**
 * Pure decision. Returns { enforce: true, reason } when the reply must be
 * withheld and the payment barrier raised; model-set payment_required is left
 * to the existing path.
 */
export function decideDocPaymentGuard({
  session,
  assistant,
  uploadInfo,
  cleanMessage,
  userMessage,
  phaseAtTurnStart,
  isSpecialAccess = false,
  enabled = isDocPaymentEnforcementEnabled(),
}) {
  if (
    !isDocPaymentGuardArmed({
      session,
      assistant,
      phaseAtTurnStart,
      isSpecialAccess,
      enabled,
    })
  ) {
    return { enforce: false, reason: "not_armed" };
  }
  if (uploadInfo?.paymentRequired) {
    return { enforce: false, reason: "model_payment_required" };
  }
  if (!isDocumentLikeReply(cleanMessage, uploadInfo, userMessage)) {
    return { enforce: false, reason: "not_document_like" };
  }
  return { enforce: true, reason: "unpaid_document_after_deliverable" };
}

/**
 * On armed turns, hold SSE tokens until the text shows it is a question/form
 * turn; a withheld document is therefore never streamed. Unarmed → unchanged.
 */
export function holdDocumentStream(onStreamChunk, armed) {
  if (!armed || !onStreamChunk) return onStreamChunk;
  let released = false;
  return (chunk, display) => {
    if (!released && hasQuestionOrFormMarker(display)) released = true;
    if (released) onStreamChunk(chunk, display);
  };
}

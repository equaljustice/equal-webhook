import {
  paymentBarrierMessage,
  legacyPaymentBarrierMessage,
  documentPaymentBarrierMessage,
  detectChatLanguageFromText,
  GIFT_REGISTER_MARKER_RE,
} from "./messageControlParse.js";
import { FLOW_STATES } from "../flow/flowConstants.js";
import { buildControlJson } from "../flow/flowContent.js";
import { isUnpaidPaymentGate } from "./sessionAccess.js";

/**
 * Sensitive actions (payment, upload, session end) are defined per assistant in
 * instructions. The model sets JSON flags; the server enforces them — no extra
 * heuristics that second-guess isPaid, qaPhase, or prompt wording.
 *
 * payment_required: true  → applyPaymentBarrier (Pay UI, isPaid=false until paid)
 * upload_required: true   → upload UI (single or multiple per supportsMultipleUploads)
 * multi_select: true      → frontend multi-option answer UI (language-agnostic)
 * batch_form: true        → frontend multi-question batch form UI (language-agnostic)
 * session_terminated: true → end session
 * Download: server auto-saves after paid final output — no document_ready flag
 * session_terminated: true → handled by orchestrator
 */

const REPEATABLE_PAYMENT_KEY_FRAGMENTS = [
  "emp-termination",
  "emp_termination",
  "employment-termination",
  "ff-reconciliation",
  "ff_reconciliation",
  "cheque-bouncing",
  "cheque_bouncing",
  "upi-fraud",
  "upi_fraud",
  "salary-non-payment",
  "salary_non_payment",
  "senior-citizen",
  "senior_citizen",
  "hindu-inheritance",
  "hindu_inheritance",
  "interitance-guide",
  "interitance_guide",
  "goa-inheritance",
  "goa_inheritance",
  "marriage-gift-planning",
  "marrige_planning",
  "marriage_planning",
  "make-my-rent-agreement",
  "make_my_rent_agreement",
  "check-my-rent",
  "check_my_rent",
  "check-my-will",
  "check_my_will",
  "check-will",
  "check_will",
  "sir-assessment",
  "sir_assessment",
  "sir-check-citizenship-voter-status",
];

export function isRepeatablePaymentAssistant(session, assistant) {
  if (assistant?.config?.paymentMode === "repeatable") return true;
  if (session?.paymentMode === "repeatable") return true;
  const key = String(session?.assistantKey || session?.key || "").toLowerCase();
  return REPEATABLE_PAYMENT_KEY_FRAGMENTS.some((frag) => key.includes(frag));
}

export function getCyclePayableAmount(session, cycleNumber) {
  if ((cycleNumber || 0) === 0) {
    return session.price;
  }
  return typeof session.additionalPrice === "number"
    ? session.additionalPrice
    : session.price;
}

/** First gate uses cycle 0; each subsequent gate increments (repeatable assistants). */
export function preparePaymentBarrierCycle(session) {
  let paymentCycle = session.paymentCycle || 0;
  if (session.isPaid && session.paymentGateShown) {
    paymentCycle += 1;
    session.paymentCycle = paymentCycle;
  }
  session.paymentGateShown = true;
  session.isPaid = false;
  return {
    paymentCycle,
    paymentAmount: getCyclePayableAmount(session, paymentCycle),
  };
}

/**
 * After Razorpay webhook sets isPaid, the frontend auto-sends a "Payment completed…"
 * user message. Models sometimes still emit payment_required:true on that turn, which
 * would call preparePaymentBarrierCycle and wrongly open a new charge cycle.
 */
export function shouldIgnoreStalePaymentRequired(session, userMessage) {
  if (!session?.isPaid) return false;
  return /payment\s*completed/i.test(String(userMessage || ""));
}

const MODEL_PAYMENT_WORD_RE =
  /payment|\bpay\b|भुगतान|पेमेंट|অর্থপ্রদান|পেমেন্ট|ચુકવણી|ਭੁਗਤਾਨ|கட்டண|చెల్లింపు|ಪಾವತಿ|ଦେୟ|ادائیگی/i;
const MODEL_PRICE_RE = /₹|\bRs\.?\s*\d|\bINR\b|\brupees?\b|रुपये|रुपए/i;
const MODEL_PAYMENT_MESSAGE_MAX_VISIBLE = 600;

/**
 * Model's own barrier sentence (e.g. "To generate your customized draft for
 * Gift Register, please complete the payment."), or null when it is missing,
 * long, a question/register turn, or states a price (the Pay UI owns amounts).
 */
export function pickModelPaymentMessage(modelMessage) {
  const text = String(modelMessage || "").trim();
  if (!text) return null;
  const visible = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!visible || visible.length > MODEL_PAYMENT_MESSAGE_MAX_VISIBLE) return null;
  if (/Question\s+\d+\s*:/i.test(text)) return null;
  if (GIFT_REGISTER_MARKER_RE.test(text)) return null;
  if (!MODEL_PAYMENT_WORD_RE.test(visible)) return null;
  if (MODEL_PRICE_RE.test(visible)) return null;
  // The model often echoes the cycle-0 "personalized assessment" sentence it saw earlier in
  // the chat; that copy is wrong for a document payment, so fall back to document copy.
  if (isAssessmentBarrierCopy(visible)) return null;
  return text;
}

const ASSESSMENT_BARRIER_LANGS = ["en", "hi", "bn", "gu", "pa", "ta", "te", "kn", "or", "ur"];
const normalizeCopy = (s) => String(s || "").replace(/\s+/g, " ").trim();

/** True when text is (or contains) the cycle-0 assessment barrier sentence, any language. */
export function isAssessmentBarrierCopy(visibleText) {
  const text = normalizeCopy(visibleText);
  return ASSESSMENT_BARRIER_LANGS.some((lang) =>
    [paymentBarrierMessage(lang), legacyPaymentBarrierMessage(lang)].some((copy) => {
      const c = normalizeCopy(copy);
      return c && text.includes(c);
    })
  );
}

/**
 * Barrier copy. Cycle 0 (and non-repeatable assistants, and callers that do not
 * opt in) keep the original assessment text; later cycles on repeatable
 * assistants are per-document payments.
 */
export function resolvePaymentBarrierCopy(
  session,
  { paymentCycle, language, modelMessage, assistant, cycleAwareCopy = false }
) {
  if (
    cycleAwareCopy &&
    (paymentCycle || 0) >= 1 &&
    isRepeatablePaymentAssistant(session, assistant)
  ) {
    return (
      pickModelPaymentMessage(modelMessage) ||
      documentPaymentBarrierMessage(language)
    );
  }
  return paymentBarrierMessage(language);
}

/** Hard gate when instructions JSON has payment_required: true. */
export function applyPaymentBarrier(session, options = {}) {
  const {
    isSpecialAccess = false,
    language,
    modelMessage,
    assistant,
    cycleAwareCopy = false,
  } = options;
  if (isSpecialAccess) {
    return { activated: false };
  }

  const { paymentCycle, paymentAmount } = preparePaymentBarrierCycle(session);

  const lang =
    language ||
    session.selectedLanguage ||
    detectChatLanguageFromText(session.messages?.slice(-1)[0]?.content || "");

  return {
    activated: true,
    cleanMessage: resolvePaymentBarrierCopy(session, {
      paymentCycle,
      language: lang,
      modelMessage,
      assistant,
      cycleAwareCopy,
    }),
    paymentRequired: true,
    paymentAmount,
    paymentCycle,
    controlJson: buildControlJson({ paymentRequired: true }),
  };
}

/**
 * Block Gemini when payment gate is shown but webhook has not set isPaid.
 * Returns a turn envelope or null if the turn may proceed.
 */
export function buildUnpaidPaymentGateResponse(
  session,
  {
    isSpecialAccess = false,
    language,
    assistant,
    modelMessage,
    cycleAwareCopy = false,
  } = {}
) {
  if (!isUnpaidPaymentGate(session, { isSpecialAccess })) return null;

  const paymentCycle = session.paymentCycle || 0;
  const lang =
    language ||
    session.selectedLanguage ||
    detectChatLanguageFromText(session.messages?.slice(-1)[0]?.content || "");

  return {
    reply: resolvePaymentBarrierCopy(session, {
      paymentCycle,
      language: lang,
      modelMessage,
      assistant,
      cycleAwareCopy,
    }),
    paymentRequired: true,
    paymentAmount: getCyclePayableAmount(session, paymentCycle),
    paymentCycle,
    sessionTerminated: false,
    requiresUpload: false,
    flowMode: false,
    flowOptions: [],
    blockedUnpaidPayment: true,
  };
}

export function enforceFlowGuards(session, uploadInfo) {
  if (!session?.flowKey) return uploadInfo;

  const corrected = { ...uploadInfo, violations: [] };

  if (
    corrected.paymentRequired &&
    session.flowState !== FLOW_STATES.WAITING_PAYMENT &&
    session.flowState !== FLOW_STATES.QA_IN_PROGRESS
  ) {
    corrected.violations.push("payment_required_out_of_phase");
    corrected.paymentRequired = false;
  }

  if (
    corrected.sessionTerminated &&
    session.flowState !== FLOW_STATES.FINAL_GENERATED &&
    session.flowState !== FLOW_STATES.TERMINATED
  ) {
    corrected.violations.push("termination_out_of_phase");
    corrected.sessionTerminated = false;
  }

  if (corrected.violations.length) {
    console.warn("[FlowGuard] Overrode illegal model flags", {
      sessionId: session._id || session.guestSessionId,
      flowState: session.flowState,
      violations: corrected.violations,
    });
  }

  return corrected;
}

/** Legacy AI assistants: trust instruction JSON; only bypass for special-access users. */
export const isNoTerminateOnQuestionEnabled = () =>
  String(process.env.JOLLYJI_NO_TERMINATE_ON_QUESTION || "").toLowerCase() === "true";

/** A batch form, or a "Question N:" with (a)/(b) options or a typed-answer hint. */
function asksNumberedQuestion(uploadInfo) {
  if (uploadInfo.batchForm) return true;
  const text = String(uploadInfo.cleanMessage || "").replace(/<[^>]+>/g, " ");
  if (/Question\s+\d+\s*:/i.test(text) && /\(a\)\s*\S|\[(?:enter|free[\s-]*text)/i.test(text)) {
    return true;
  }
  // A closing choice menu ("Next step … (a) Yes — generate the other document (b) No — end
  // session") is still a question (emp last-pick walk 2026-11-03: ended with the menu unanswerable).
  const tail = text.trim().slice(-400);
  return /\(a\)\s*\S/.test(tail) && /\(b\)\s*\S/.test(tail);
}

export const isPickBeforePayEnabled = () =>
  String(process.env.JOLLYJI_PICK_BEFORE_PAY || "").toLowerCase() === "true";

/** "Which document do you wish to generate?" followed by (a)/(b) choices: not answered yet. */
function asksDocumentMenu(uploadInfo) {
  const text = String(uploadInfo.cleanMessage || "").replace(/<[^>]+>/g, " ");
  const at = text.search(/which document (?:do you wish|would you like) to generate/i);
  return at >= 0 && /\(a\)\s*\S/.test(text.slice(at));
}

export function enforceLegacySessionGuards(
  session,
  uploadInfo,
  { isSpecialAccess = false } = {}
) {
  const corrected = { ...uploadInfo, violations: [] };

  if (corrected.paymentRequired && isSpecialAccess) {
    corrected.paymentRequired = false;
    corrected.violations.push("payment_special_access");
  }

  // A reply that asks numbered questions cannot also end the chat (emp termination batch walk
  // 2026-11-02: Batch 1B shown and session_terminated true in the same turn → "All done",
  // nothing answerable). JOLLYJI_NO_TERMINATE_ON_QUESTION, off by default.
  if (
    corrected.sessionTerminated &&
    isNoTerminateOnQuestionEnabled() &&
    asksNumberedQuestion(corrected)
  ) {
    corrected.sessionTerminated = false;
    corrected.terminationMessage = null;
    corrected.violations.push("terminated_while_asking");
  }

  // The user picks the document first, then pays for it (F&F last-pick walk 2026-11-03: the
  // "Which document…" menu and the payment request came in one turn, the pay card covered the
  // menu and the model chose the document itself). JOLLYJI_PICK_BEFORE_PAY, off by default.
  if (corrected.paymentRequired && isPickBeforePayEnabled() && asksDocumentMenu(corrected)) {
    corrected.paymentRequired = false;
    corrected.cleanMessage = String(corrected.cleanMessage || "")
      .replace(/(?:<br\s*\/?>|\s)*To generate [^.<]*?please complete the payment\.?/gi, "")
      .trimEnd();
    corrected.violations.push("payment_on_unanswered_document_menu");
  }

  if (corrected.violations.length) {
    console.warn("[LegacyGuard] Overrode illegal model flags", {
      sessionId: session._id || session.guestSessionId,
      violations: corrected.violations,
    });
  }

  return corrected;
}

export function appendControlJson(reply, controlJson) {
  if (!controlJson) return reply;
  const trimmed = String(reply || "").trimEnd();
  return `${trimmed}\n${controlJson}`;
}

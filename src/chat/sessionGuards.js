import { paymentBarrierMessage, detectChatLanguageFromText } from "./messageControlParse.js";
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
 * session_terminated: true → end session
 * Download: server auto-saves after paid final output — no document_ready flag
 * session_terminated: true → handled by orchestrator
 */

const REPEATABLE_PAYMENT_KEY_FRAGMENTS = [
  "emp-termination",
  "emp_termination",
  "employment-termination",
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

/** Hard gate when instructions JSON has payment_required: true. */
export function applyPaymentBarrier(session, options = {}) {
  const { isSpecialAccess = false, language } = options;
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
    cleanMessage: paymentBarrierMessage(lang),
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
  { isSpecialAccess = false, language } = {}
) {
  if (!isUnpaidPaymentGate(session, { isSpecialAccess })) return null;

  const paymentCycle = session.paymentCycle || 0;
  const lang =
    language ||
    session.selectedLanguage ||
    detectChatLanguageFromText(session.messages?.slice(-1)[0]?.content || "");

  return {
    reply: paymentBarrierMessage(lang),
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

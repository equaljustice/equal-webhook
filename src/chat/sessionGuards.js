import { paymentBarrierMessage, detectChatLanguageFromText } from "./messageControlParse.js";
import { FLOW_STATES } from "../flow/flowConstants.js";
import { buildControlJson } from "../flow/flowContent.js";
import { QA_PHASES } from "./sessionStateProtocol.js";

export function getCyclePayableAmount(session, cycleNumber) {
  if ((cycleNumber || 0) <= 1) {
    return session.price;
  }
  return typeof session.additionalPrice === "number"
    ? session.additionalPrice
    : session.price;
}

/**
 * Apply server-side payment barrier (never trust LLM for payment flags).
 */
export function applyPaymentBarrier(session, options = {}) {
  const { isSpecialAccess = false, language } = options;
  if (isSpecialAccess) {
    return { activated: false };
  }

  if (session.isPaid) {
    session.paymentCycle = (session.paymentCycle || 0) + 1;
  }
  const paymentCycle = session.paymentCycle || 0;
  const paymentAmount = getCyclePayableAmount(session, paymentCycle);
  session.isPaid = false;

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
 * Enforce flow-state guardrails on LLM-parsed control flags.
 */
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

/**
 * Server-side guardrails for AI-led (legacy) assistants — payment/termination/document timing.
 */
export function enforceLegacySessionGuards(session, uploadInfo, { isSpecialAccess = false } = {}) {
  const corrected = { ...uploadInfo, violations: [] };
  const phase = session.qaPhase || QA_PHASES.QA_IN_PROGRESS;

  if (corrected.paymentRequired && (session.isPaid || isSpecialAccess)) {
    corrected.paymentRequired = false;
    corrected.violations.push("payment_already_paid");
  }

  if (
    corrected.documentReady &&
    !isSpecialAccess &&
    !session.isPaid &&
    phase !== QA_PHASES.READY_FOR_FINAL &&
    phase !== QA_PHASES.FINAL_GENERATED
  ) {
    corrected.documentReady = false;
    corrected.violations.push("document_before_payment");
  }

  if (corrected.sessionTerminated) {
    if (
      phase === QA_PHASES.QA_IN_PROGRESS ||
      phase === QA_PHASES.WAITING_PAYMENT
    ) {
      corrected.sessionTerminated = false;
      corrected.terminationMessage = null;
      corrected.violations.push("termination_during_qa");
    } else if (
      !corrected.documentReady &&
      phase !== QA_PHASES.FINAL_GENERATED &&
      phase !== QA_PHASES.TERMINATED
    ) {
      corrected.sessionTerminated = false;
      corrected.terminationMessage = null;
      corrected.violations.push("termination_before_document");
    }
  }

  if (corrected.violations.length) {
    console.warn("[LegacyGuard] Overrode illegal model flags", {
      sessionId: session._id || session.guestSessionId,
      qaPhase: phase,
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

/**
 * "No thanks" at an optional additional-document barrier (paymentCycle ≥ 1).
 * Before this, every send at that barrier was refused with 403 "Payment required
 * before chatting" and the user had no way out (QA 2026-10-30 F5: upi-frauds, goa).
 *
 * Declining closes the open cycle without a charge: the session goes back to the
 * last paid cycle and ends politely. The first (cycle 0) barrier cannot be declined.
 *
 * Off unless JOLLYJI_EXTRA_DOC_DECLINE=true (deploy ≠ enable).
 */
import { QA_PHASES } from "./sessionStateProtocol.js";
import { terminationBarrierMessage } from "./messageControlParse.js";

export function isExtraDocDeclineEnabled() {
  const v = String(process.env.JOLLYJI_EXTRA_DOC_DECLINE || "").trim().toLowerCase();
  return v === "true" || v === "1";
}

export function canDeclineAdditionalPayment(session) {
  if (!isExtraDocDeclineEnabled() || !session) return false;
  if (session.qaPhase === QA_PHASES.TERMINATED) return false;
  return !!session.paymentGateShown && !session.isPaid && (session.paymentCycle || 0) >= 1;
}

/**
 * Mutates the session. Returns the reply payload, or null when declining is not allowed.
 */
export function declineAdditionalPayment(session) {
  if (!canDeclineAdditionalPayment(session)) return null;
  session.paymentCycle = (session.paymentCycle || 1) - 1;
  session.isPaid = true; // the previous cycle was paid; nothing is owed
  session.qaPhase = QA_PHASES.TERMINATED;
  const reply = terminationBarrierMessage(session.selectedLanguage || "en");
  if (!Array.isArray(session.messages)) session.messages = [];
  session.messages.push({ role: "assistant", content: reply });
  return {
    reply,
    displayReply: reply,
    paymentRequired: false,
    paymentCycle: session.paymentCycle,
    sessionTerminated: true,
    terminationMessage: reply,
  };
}

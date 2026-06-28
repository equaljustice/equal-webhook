/**
 * Chat access vs payment are separate concerns.
 * - deferPayment (per assistant config): Q&A allowed before any payment.
 * - isPaid: user completed payment for the current gate (set by Razorpay / barrier).
 */

export function resolveDeferPayment(session) {
  if (session?.deferPayment === true) return true;
  if (session?.geminiConfig?.deferPayment === true) return true;
  return false;
}

/** Whether the payment gate is active and webhook has not confirmed payment yet. */
export function isUnpaidPaymentGate(session, { isSpecialAccess = false } = {}) {
  if (isSpecialAccess) return false;
  if (!session?.paymentGateShown) return false;
  return !session?.isPaid;
}

/** Whether the user may send chat messages (preflight / UI input). */
export function canAccessChat(session, { isSpecialAccess = false } = {}) {
  if (isSpecialAccess) return true;
  if (session?.isPaid) return true;
  // Hard gate: no chat turns while Pay UI is shown until Razorpay webhook sets isPaid.
  if (isUnpaidPaymentGate(session, { isSpecialAccess })) return false;
  if (resolveDeferPayment(session)) return true;
  return false;
}

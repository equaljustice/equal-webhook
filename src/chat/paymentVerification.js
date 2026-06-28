import { Payment } from "../model/payment.model.js";

/**
 * True only when Razorpay webhook has recorded a paid Payment for this session.
 * Client "mark-payment" endpoints and chat text must never set isPaid without this.
 */
export async function hasWebhookConfirmedPayment({
  sessionId = null,
  guestSessionId = null,
} = {}) {
  if (!sessionId && !guestSessionId) return false;

  const query = { "status.value": "paid" };
  if (guestSessionId) {
    query.guestSessionId = guestSessionId;
  } else {
    query.sessionId = sessionId;
    query.$or = [{ guestSessionId: null }, { guestSessionId: { $exists: false } }];
  }

  const record = await Payment.findOne(query).sort({ "status.paidAt": -1 });
  return !!record;
}

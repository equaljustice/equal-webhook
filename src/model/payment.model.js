import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  sessionId: { type: String, required: true },
  status: {
    value: {
      type: String,
      enum: ["unpaid", "paid", "failed", "refunded", "cancelled"],
      default: "unpaid",
    },
    paidAt: { type: Date },
  },
  orderDetails: {
    currency: { type: String },
    amount: { type: String },
  },
  customerDetails: {
    chEmail: { type: String },
  },
  webhookTransaction: { type: Object },
  orderId: { type: String },
  createdOn: { type: Date, default: Date.now },
});

export const Payment = mongoose.model("Payment", paymentSchema);

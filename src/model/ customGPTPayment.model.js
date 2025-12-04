import mongoose from "mongoose";

const CustomGPTpaymentSchema = new mongoose.Schema({
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

export const CustomGPTpayment = mongoose.model(
  "CustomGPTPayment",
  CustomGPTpaymentSchema
);

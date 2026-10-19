import mongoose from "mongoose";

/** Contact-form submissions from the JollyJi "ask a lawyer" dialog. */
const legalHelpRequestSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    email: { type: String, trim: true, default: null },
    phone: { type: String, trim: true, default: null },
    source: { type: String, trim: true, default: "jollyji" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

legalHelpRequestSchema.index({ createdAt: -1 });

export const LegalHelpRequest = mongoose.model(
  "LegalHelpRequest",
  legalHelpRequestSchema,
);

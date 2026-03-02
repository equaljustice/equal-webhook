import mongoose from "mongoose";

const promptAuditSchema = new mongoose.Schema({
  identifier: { type: String, required: true, index: true },
  action: {
    type: String,
    enum: ["create", "update", "delete"],
    required: true,
  },
  previousContent: { type: String, default: null },
  newContent: { type: String, default: null },
  performedBy: { type: String, default: null }, // admin email or ID
  metadata: {
    fileSize: Number,
    lineCount: Number,
  },
  createdAt: { type: Date, default: Date.now, index: true },
});

export const PromptAudit = mongoose.model("PromptAudit", promptAuditSchema);

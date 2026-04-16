import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  assistantId: { type: String, required: true },
  assistantKey: { type: String },
  threadId: { type: String, required: true },
  price: { type: Number, required: true },
  actualPrice: { type: Number },
  additionalPrice: { type: Number },
  actualAdditionalPrice: { type: Number },
  isPaid: { type: Boolean, default: false },
  paymentCycle: { type: Number, default: 0 },
  title: { type: String, default: "New chat" },
  startedOn: { type: Date, default: Date.now },
  endedOn: { type: Date },
  provider: { type: String, enum: ["openai", "gemini"], default: "openai" },
  geminiConfig: { type: mongoose.Schema.Types.Mixed },
  messages: [
    {
      role: String,
      content: String,
      timestamp: { type: Date, default: Date.now },
    },
  ],
  // Document upload fields
  isDocUploadRequired: { type: Boolean, default: false },
  uploadedFileId: { type: String }, // Legacy: kept for backward compatibility
  uploadedFileIds: { type: [String], default: [] }, // Array for multiple file uploads
  uploadAttempts: { type: Number, default: 0 },
  isDocUploaded: { type: Boolean, default: false },
  supportsMultipleUploads: { type: Boolean, default: false }, // Whether this session supports multiple file uploads
  // Final document data for download feature
  finalDocumentData: { type: mongoose.Schema.Types.Mixed, default: null },
  // Explicit final response used for document downloads
  final_response: { type: String, default: null },
});

export const Session = mongoose.model("Session", sessionSchema);

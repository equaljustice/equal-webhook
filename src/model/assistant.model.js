import mongoose from "mongoose";

const assistantSchema = new mongoose.Schema({
  name: { type: String },
  key: { type: String, required: true, unique: true },
  assistantId: { type: String, required: true, unique: true },
  price: { type: Number, required: true },
  actualPrice: { type: Number },
  additionalPrice: { type: Number },
  actualAdditionalPrice: { type: Number },
  description: { type: String },
  provider: { type: String, enum: ['openai', 'gemini'], required: true },
  /** When true, clients may show PDF/Word download after a completed document session */
  docDownloadAvailable: { type: Boolean, default: false },
  config: { type: mongoose.Schema.Types.Mixed },
});

export const Assistant = mongoose.model("Assistant", assistantSchema);

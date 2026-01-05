import mongoose from "mongoose";

const assistantSchema = new mongoose.Schema({
  name: { type: String },
  key: { type: String, required: true, unique: true },
  assistantId: { type: String, required: true, unique: true },
  price: { type: Number, required: true },
  description: { type: String },
  provider: { type: String, enum: ['openai', 'gemini'], required: true },
  config: { type: mongoose.Schema.Types.Mixed },
});

export const Assistant = mongoose.model("Assistant", assistantSchema);

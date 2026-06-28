import mongoose from "mongoose";

/** Singleton global Gemini defaults (key = "global"). */
const geminiSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: "global" },
  model: { type: String },
  temperature: { type: Number },
  topK: { type: Number },
  topP: { type: Number },
  updatedBy: { type: String },
  updatedAt: { type: Date, default: Date.now },
});

export const GeminiSettings = mongoose.model("GeminiSettings", geminiSettingsSchema);

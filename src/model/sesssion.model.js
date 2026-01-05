import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  assistantId: { type: String, required: true },
  assistantKey: { type: String },
  threadId: { type: String, required: true },
  price: { type: Number, required: true },
  isPaid: { type: Boolean, default: false },
  title: { type: String, default: "New chat" },
  startedOn: { type: Date, default: Date.now },
  endedOn: { type: Date },
  provider: { type: String, enum: ['openai', 'gemini'], default: 'openai' },
  geminiConfig: { type: mongoose.Schema.Types.Mixed },
  messages: [
    {
      role: String,
      content: String,
      timestamp: { type: Date, default: Date.now },
    },
  ],
});

export const Session = mongoose.model("Session", sessionSchema);

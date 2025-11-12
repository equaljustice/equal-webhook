import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  sessionId: { type: Schema.Types.ObjectId, ref: "Session", required: true },
  threadId: { type: Schema.Types.ObjectId, ref: "Thread" },
  openaiThreadId: String,
  role: { type: String, enum: ["user", "assistant", "system"], required: true },
  content: String,
  runId: String,
  createdAt: { type: Date, default: Date.now },
});

export const Message = mongoose.model("Message", messageSchema);

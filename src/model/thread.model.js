import mongoose from "mongoose";

const threadSchema = new mongoose.Schema({
  sessionId: { type: Schema.Types.ObjectId, ref: "Session", required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  openaiThreadId: String,
  createdAt: { type: Date, default: Date.now },
  lastRunAt: Date,
});

export const Thread = mongoose.model("Thread", threadSchema);

import mongoose from "mongoose";

const promptSchema = new mongoose.Schema({
  identifier: { type: String, required: true, unique: true },
  filename: { type: String, required: true },
  content: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

// Update `updatedAt` on every save
promptSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

promptSchema.pre("findOneAndUpdate", function (next) {
  this.set({ updatedAt: new Date() });
  next();
});

export const Prompt = mongoose.model("Prompt", promptSchema);

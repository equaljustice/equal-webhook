import mongoose from "mongoose";

const analyticsEventSchema = new mongoose.Schema(
  {
    eventName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    anonymousId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    sessionId: {
      type: String,
      trim: true,
      default: null,
    },
    path: {
      type: String,
      trim: true,
      default: "",
    },
    referrer: {
      type: String,
      trim: true,
      default: "",
    },
    source: {
      type: String,
      trim: true,
      default: "web",
    },
    utm: {
      source: { type: String, trim: true, default: "" },
      medium: { type: String, trim: true, default: "" },
      campaign: { type: String, trim: true, default: "" },
      term: { type: String, trim: true, default: "" },
      content: { type: String, trim: true, default: "" },
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    ipAddress: {
      type: String,
      trim: true,
      default: "",
    },
    userAgent: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true },
);

analyticsEventSchema.index({ occurredAt: -1, eventName: 1 });
analyticsEventSchema.index({ anonymousId: 1, occurredAt: -1 });

export const AnalyticsEvent = mongoose.model(
  "AnalyticsEvent",
  analyticsEventSchema,
);

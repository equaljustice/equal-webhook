import { AnalyticsEvent } from "../model/analyticsEvent.model.js";

function clientIpFromReq(req) {
  return (
    req?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req?.socket?.remoteAddress ||
    ""
  );
}

/**
 * Fire-and-forget guest analytics (never throws to callers).
 */
export function trackGuestAnalyticsEvent({
  eventName,
  anonymousId,
  sessionId = null,
  metadata = {},
  req = null,
}) {
  if (!eventName || !anonymousId) return;

  const payload = {
    eventName,
    anonymousId,
    userId: null,
    sessionId,
    path: "/guest/chat",
    referrer: "",
    source: "server",
    utm: {
      source: "",
      medium: "",
      campaign: "",
      term: "",
      content: "",
    },
    metadata,
    occurredAt: new Date(),
    ipAddress: req ? clientIpFromReq(req) : "",
    userAgent: req?.headers?.["user-agent"] || "",
  };

  AnalyticsEvent.create(payload).catch((err) => {
    console.warn(`[analytics] ${eventName} failed:`, err.message);
  });
}

export function trackGuestChatStarted({
  anonymousId,
  browserSessionId,
  guestSessionId,
  assistantKey,
  req,
}) {
  trackGuestAnalyticsEvent({
    eventName: "guest_chat_started",
    anonymousId,
    sessionId: browserSessionId || null,
    metadata: {
      guestSessionId,
      assistantKey,
    },
    req,
  });
}

export function trackGuestMessageSent({
  anonymousId,
  browserSessionId,
  guestSessionId,
  assistantKey,
  userMessageCount,
  req,
}) {
  trackGuestAnalyticsEvent({
    eventName: "guest_message_sent",
    anonymousId,
    sessionId: browserSessionId || null,
    metadata: {
      guestSessionId,
      assistantKey,
      userMessageCount: userMessageCount ?? null,
    },
    req,
  });
}

import { NODE_TYPES } from "../flow/flowConstants.js";

/**
 * Write Server-Sent Events helpers for Express response.
 */
export function initSse(res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
}

export function sseEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function sseToken(res, text, fullText) {
  sseEvent(res, "token", { text, full: fullText });
}

export function sseDone(res, payload) {
  sseEvent(res, "done", payload);
}

export function sseError(res, message, status = 500) {
  sseEvent(res, "error", { message, status });
  res.end();
}

export function endSse(res) {
  res.end();
}

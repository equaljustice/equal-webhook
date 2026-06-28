import {
  handleChatTurn,
  bootstrapFlowSession,
  advanceFlowAfterUpload,
} from "./chatOrchestrator.js";
import { initSse, sseToken, sseDone, sseError, endSse } from "./sseStream.js";
import { processGuestAssistantReply, enrichGuestApiResponse } from "./guestSignupOffer.js";
import { FLOW_BOOTSTRAP_MESSAGE } from "../flow/flowEngine.js";
import { GUEST_BOOTSTRAP_MESSAGE } from "./guestDisplayMessages.js";
import { normalizeQaDisplayHtml } from "./replyFormat.js";
import { canAccessChat } from "./sessionAccess.js";

function formatGeminiErrorMessage(err) {
  const raw = String(err?.message || err || "").trim();
  if (!raw) return "Document analysis failed. Please try again.";

  const unsupportedMime = raw.match(/Unsupported MIME type:\s*([^\s"\\]+)/i);
  if (unsupportedMime) {
    return "This document format cannot be analyzed directly. Please upload PDF or DOCX, or paste the text in chat.";
  }

  try {
    const outer = JSON.parse(raw);
    const innerMsg = outer?.error?.message;
    if (typeof innerMsg === "string") {
      const nested = JSON.parse(innerMsg);
      const apiMsg = nested?.error?.message;
      if (apiMsg) return apiMsg;
    }
  } catch {
    // not nested JSON
  }

  return raw.length > 240 ? `${raw.slice(0, 240)}…` : raw;
}

/**
 * Shared pre-checks before a chat turn.
 * @returns {{ ok: boolean, status?: number, body?: object }}
 */
export function preflightChatTurn(session, {
  isSpecialAccess = false,
  requirePaid = true,
}) {
  if (requirePaid && !canAccessChat(session, { isSpecialAccess })) {
    return { ok: false, status: 403, body: { error: "Payment required before chatting" } };
  }
  if (session.isDocUploadRequired && !session.isDocUploaded) {
    return {
      ok: false,
      status: 403,
      body: { error: "Document upload required", requiresUpload: true },
    };
  }
  return { ok: true };
}

export function applyFileIdToSession(session, fileId) {
  if (!fileId || session.uploadedFileId) return;
  if (session.supportsMultipleUploads) {
    if (!session.uploadedFileIds) session.uploadedFileIds = [];
    session.uploadedFileIds.push(fileId);
  }
  session.uploadedFileId = fileId;
  session.isDocUploaded = true;
  session.isDocUploadRequired = false;
  session.uploadAttempts = (session.uploadAttempts || 0) + 1;
}

export function collectFilesToUse(session, fileId) {
  const files = [];
  if (session.supportsMultipleUploads && session.uploadedFileIds?.length > 0) {
    files.push(...session.uploadedFileIds);
  } else if (session.uploadedFileId) {
    files.push(session.uploadedFileId);
  } else if (fileId) {
    files.push(fileId);
  }
  return files;
}

function applyUploadFlagsFromResult(session, result) {
  if (!result.requiresUpload) return;
  if (
    session.isDocUploaded &&
    (session.uploadedFileId || session.uploadedFileIds?.length) &&
    result.uploadType !== "re_upload"
  ) {
    return;
  }
  if (session.uploadAttempts < 2) {
    session.isDocUploadRequired = true;
    if (result.uploadType === "re_upload") {
      session.isDocUploaded = false;
      session.uploadedFileId = null;
      session.uploadedFileIds = [];
      session.uploadedFilesMeta = [];
      session.replaceNextUpload = true;
    }
  } else {
    session.isDocUploadRequired = false;
  }
}

/**
 * Execute one chat turn (JSON or SSE).
 */
export async function executeChatTurn({
  session,
  assistant,
  userMessage,
  fileId,
  isGuest = false,
  isSpecialAccess = false,
  res,
  stream = false,
  enrichGuest = null,
  persistBeforeStreamDone = null,
}) {
  applyFileIdToSession(session, fileId);
  const filesToUse = collectFilesToUse(session, fileId);

  if (!session.messages) session.messages = [];

  const onStreamChunk = stream
    ? (_chunk, full) => {
        if (res) sseToken(res, full);
      }
    : undefined;

  const result = await handleChatTurn({
    session,
    assistant,
    userMessage,
    filesToUse,
    isGuest,
    isSpecialAccess,
    onStreamChunk,
  });

  if (result.status) {
    if (stream && res) {
      const msg = formatGeminiErrorMessage(result.error || result.message);
      sseError(res, msg, result.status);
      return null;
    }
    return { error: true, status: result.status, body: result };
  }

  const isBootstrap =
    userMessage === FLOW_BOOTSTRAP_MESSAGE ||
    userMessage === GUEST_BOOTSTRAP_MESSAGE;

  if (!isBootstrap) {
    session.messages.push({ role: "user", content: userMessage });
  }
  if (result.reply) {
    const displayReply = normalizeQaDisplayHtml(result.reply, {
      documentReady: false,
    });
    session.messages.push({ role: "assistant", content: displayReply });
    result.reply = displayReply;
  }

  if (result.paymentRequired && isSpecialAccess) {
    session.isPaid = true;
    result.paymentRequired = false;
  }

  if (typeof result.finalResponse === "string" && result.finalResponse.trim()) {
    session.final_response = result.finalResponse.trim();
  }

  applyUploadFlagsFromResult(session, result);

  const guestUploadInfo = {
    requiresUpload: result.requiresUpload,
    uploadType: result.uploadType,
    reason: result.uploadReason,
    sessionTerminated: result.sessionTerminated,
    terminationMessage: result.terminationMessage,
    paymentRequired: result.paymentRequired,
    documentReady: false,
    finalResponse: result.finalResponse,
    guestSignupOffer: !!result.guestSignupOffer,
    guestSignupOfferPending: !!result.guestSignupOfferPending,
    selectedLanguage: result.selectedLanguage || session.selectedLanguage,
  };

  if (isGuest) {
    processGuestAssistantReply(session, guestUploadInfo, userMessage);
  }

  const payload = {
    reply: result.reply,
    displayReply: result.reply || "",
    sessionTerminated: result.sessionTerminated || false,
    terminationMessage: result.terminationMessage || null,
    paymentRequired: result.paymentRequired || false,
    paymentAmount: result.paymentAmount,
    paymentCycle: result.paymentCycle ?? session.paymentCycle ?? 0,
    requiresUpload: session.isDocUploadRequired && !session.isDocUploaded,
    isReUpload: result.uploadType === "re_upload",
    uploadReason: result.uploadReason || null,
    nodeId: result.nodeId,
    displayNumber: result.displayNumber,
    phase: result.phase,
    flowMode: result.flowMode || false,
    streaming: result.streaming || false,
    flowOptions: result.flowOptions || [],
    inputType: result.inputType || null,
    guestSignupOfferPending: result.guestSignupOfferPending || false,
    instructionCached: result.instructionCached || false,
  };

  const finalPayload = isGuest
    ? enrichGuestApiResponse(payload, session, guestUploadInfo)
    : payload;

  if (stream && res) {
    if (typeof persistBeforeStreamDone === "function") {
      await persistBeforeStreamDone();
    }
    sseDone(res, finalPayload);
    endSse(res);
  }

  return finalPayload;
}

export async function executeChatTurnStream(req, res, opts) {
  initSse(res);
  try {
    await executeChatTurn({ ...opts, res, stream: true });
  } catch (err) {
    console.error("executeChatTurnStream", err);
    sseError(res, err.message || "Stream failed");
  }
}

export { bootstrapFlowSession, advanceFlowAfterUpload };

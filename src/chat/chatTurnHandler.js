import {
  handleChatTurn,
  bootstrapFlowSession,
  advanceFlowAfterUpload,
} from "./chatOrchestrator.js";
import { initSse, sseToken, sseDone, sseError, endSse } from "./sseStream.js";
import { processGuestAssistantReply, enrichGuestApiResponse } from "./guestSignupOffer.js";
import { FLOW_BOOTSTRAP_MESSAGE } from "../flow/flowEngine.js";

/**
 * Shared pre-checks before a chat turn.
 * @returns {{ ok: boolean, status?: number, body?: object }}
 */
export function preflightChatTurn(session, {
  isSpecialAccess = false,
  requirePaid = true,
}) {
  if (requirePaid && !session.isPaid && !isSpecialAccess) {
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
  if (session.uploadAttempts < 2) {
    session.isDocUploadRequired = true;
    if (result.uploadType === "re_upload") {
      session.isDocUploaded = false;
      if (!session.supportsMultipleUploads) {
        session.uploadedFileId = null;
        session.uploadedFileIds = [];
      }
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
}) {
  applyFileIdToSession(session, fileId);
  const filesToUse = collectFilesToUse(session, fileId);

  if (!session.messages) session.messages = [];

  let streamBuffer = "";
  const onStreamChunk = stream
    ? (chunk, full) => {
        streamBuffer = full;
        if (res) sseToken(res, chunk, full);
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
      sseError(res, result.error || result.message, result.status);
      return null;
    }
    return { error: true, status: result.status, body: result };
  }

  const isBootstrap = userMessage === FLOW_BOOTSTRAP_MESSAGE;

  if (!isBootstrap) {
    session.messages.push({ role: "user", content: userMessage });
  }
  if (result.reply) {
    session.messages.push({ role: "assistant", content: result.reply });
  }

  if (result.paymentRequired && isSpecialAccess) {
    session.isPaid = true;
    result.paymentRequired = false;
  }

  if (typeof result.finalResponse === "string" && result.finalResponse.trim()) {
    session.final_response = result.finalResponse.trim();
  }

  applyUploadFlagsFromResult(session, result);

  if (isGuest) {
    processGuestAssistantReply(
      session,
      {
        requiresUpload: result.requiresUpload,
        uploadType: result.uploadType,
        reason: result.uploadReason,
        sessionTerminated: result.sessionTerminated,
        terminationMessage: result.terminationMessage,
        paymentRequired: result.paymentRequired,
        documentReady: result.documentReady,
        finalResponse: result.finalResponse,
        guestSignupOffer: false,
        selectedLanguage: session.selectedLanguage,
      },
      userMessage
    );
  }

  const payload = {
    reply: result.reply,
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
  };

  const finalPayload =
    isGuest
      ? enrichGuestApiResponse(payload, session, {
          requiresUpload: payload.requiresUpload,
          uploadType: result.uploadType,
          reason: result.uploadReason,
          sessionTerminated: payload.sessionTerminated,
          terminationMessage: payload.terminationMessage,
          paymentRequired: payload.paymentRequired,
          documentReady: result.documentReady,
          finalResponse: result.finalResponse,
          guestSignupOffer: false,
          selectedLanguage: session.selectedLanguage,
        })
      : payload;

  if (stream && res) {
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

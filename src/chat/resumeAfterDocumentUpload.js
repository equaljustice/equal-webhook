import { executeChatTurn } from "./chatTurnHandler.js";

/**
 * After files are on session.uploadedFileIds, run a full orchestrated chat turn
 * (cached instructions, session state, guards) so upload analysis matches normal chat.
 */
export async function resumeChatAfterDocumentUpload({
  session,
  assistant,
  isGuest = false,
  isSpecialAccess = false,
}) {
  const fileCount = session.supportsMultipleUploads
    ? session.uploadedFileIds?.length || 1
    : 1;
  const uploadMessage =
    fileCount > 1
      ? `${fileCount} documents uploaded successfully. Please analyze them.`
      : "Document uploaded successfully. Please analyze it.";

  const turn = await executeChatTurn({
    session,
    assistant,
    userMessage: uploadMessage,
    isGuest,
    isSpecialAccess,
  });

  if (turn?.error) {
    const msg =
      turn.body?.error ||
      turn.body?.message ||
      turn.error ||
      "Failed to analyze uploaded document";
    throw new Error(msg);
  }

  return {
    uploadMessage,
    assistantReply: turn?.reply || null,
    conversationResumed: !!turn?.reply,
    requiresUpload: turn?.requiresUpload || false,
    uploadType: turn?.uploadType || null,
    turn,
  };
}

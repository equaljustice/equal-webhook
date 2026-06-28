/**
 * Canonical guest onboarding copy — shown in chat as normal assistant messages (no Quick pick).
 */

import {
  buildLanguageSelectionHtml,
} from "./languageSelectionDisplay.js";

export const GUEST_BOOTSTRAP_MESSAGE = "__guest_start__";

export function buildGuestLanguagePromptHtml() {
  return buildLanguageSelectionHtml();
}

/** After language pick — guest offer is shown in the frontend modal, not in chat. */
export function finishGuestLanguageSelectedTurn({
  session,
  persistSessionDocumentSnapshot,
}) {
  const uploadInfo = {
    requiresUpload: false,
    uploadType: null,
    reason: null,
    sessionTerminated: false,
    terminationMessage: null,
    paymentRequired: false,
    documentReady: false,
    cleanMessage: "",
    documentData: null,
    finalResponse: null,
    guestSignupOffer: false,
    selectedLanguage: session.selectedLanguage || null,
    sessionState: null,
  };

  persistSessionDocumentSnapshot(
    session,
    session._id || session.guestSessionId,
    uploadInfo,
    ""
  );

  return {
    reply: "",
    sessionTerminated: false,
    terminationMessage: null,
    paymentRequired: false,
    requiresUpload: false,
    uploadType: null,
    uploadReason: null,
    documentReady: false,
    guestSignupOffer: false,
    guestSignupOfferPending: true,
    selectedLanguage: session.selectedLanguage || null,
    flowMode: false,
    flowOptions: [],
    streaming: false,
    instructionCached: false,
  };
}

export function emitStaticAssistantReply(text, onStreamChunk) {
  if (!onStreamChunk || !text) return;
  onStreamChunk(text, text);
}

/** Persist and return envelope for server-owned guest onboarding messages. */
export function finishGuestStaticTurn({
  session,
  reply,
  onStreamChunk,
  normalizeQaDisplayHtml,
  persistSessionDocumentSnapshot,
}) {
  const cleanMessage = normalizeQaDisplayHtml(reply);
  emitStaticAssistantReply(cleanMessage, onStreamChunk);

  const uploadInfo = {
    requiresUpload: false,
    uploadType: null,
    reason: null,
    sessionTerminated: false,
    terminationMessage: null,
    paymentRequired: false,
    documentReady: false,
    cleanMessage,
    documentData: null,
    finalResponse: null,
    guestSignupOffer: false,
    selectedLanguage: session.selectedLanguage || null,
    sessionState: null,
  };

  persistSessionDocumentSnapshot(
    session,
    session._id || session.guestSessionId,
    uploadInfo,
    cleanMessage
  );

  return {
    reply: cleanMessage,
    sessionTerminated: false,
    terminationMessage: null,
    paymentRequired: false,
    requiresUpload: false,
    uploadType: null,
    uploadReason: null,
    documentReady: false,
    guestSignupOffer: false,
    selectedLanguage: session.selectedLanguage || null,
    flowMode: false,
    flowOptions: [],
    streaming: !!onStreamChunk,
    instructionCached: false,
  };
}

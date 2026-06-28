import { readPromptFile } from "../utils/promptManager.js";
import {
  isFlowOrchestratorEnabled,
  loadFlowBundle,
} from "../flow/flowRegistry.js";
import {
  initFlowSession,
  presentFlowStart,
  processFlowTurn,
  FLOW_BOOTSTRAP_MESSAGE,
} from "../flow/flowEngine.js";
import { FLOW_STATES } from "../flow/flowConstants.js";
import { appendControlJson } from "./sessionGuards.js";
import {
  extractUploadRequirement,
  applyDownloadSnapshot,
  inferDownloadSnapshot,
  persistSessionDocumentSnapshot,
  paymentBarrierMessage,
  detectChatLanguageFromText,
  stripControlJsonFromDisplay,
} from "./messageControlParse.js";
import { normalizeQaDisplayHtml, streamDisplayFromRaw } from "./replyFormat.js";
import {
  applyPaymentBarrier,
  enforceFlowGuards,
  enforceLegacySessionGuards,
  getCyclePayableAmount,
  buildUnpaidPaymentGateResponse,
} from "./sessionGuards.js";
import {
  buildFinalGenerationUserMessage,
  buildLegacyGeminiContents,
  buildGeminiHistory,
  streamGeminiChat,
} from "./geminiChat.js";
import { buildPostUploadTurnOverlay } from "./uploadFlowHints.js";
import { buildGuestGeminiSystemInstruction } from "./guestSignupOffer.js";
import {
  appendGuestSystemInstruction,
  applyPreTurnSessionUpdates,
  detectLanguageChoiceFromUserMessage,
  promoteGuestSignupOfferState,
} from "./guestPromptContext.js";
import {
  GUEST_BOOTSTRAP_MESSAGE,
  buildGuestLanguagePromptHtml,
  finishGuestStaticTurn,
  finishGuestLanguageSelectedTurn,
} from "./guestDisplayMessages.js";
import {
  enforceGuestOfferGuards,
  stripGuestOfferBoilerplate,
  GUEST_FLOW_PHASE,
  isAwaitingGuestChoice,
  isGuestLanguagePhase,
} from "./guestSessionGuards.js";
import {
  getOrCreateInstructionCache,
  isInstructionCacheEnabled,
} from "./geminiInstructionCache.js";
import {
  SESSION_STATE_PROTOCOL,
  mergeSessionStateFromModel,
  advanceQaPhase,
  QA_PHASES,
} from "./sessionStateProtocol.js";

/**
 * Initialize flow on new session when orchestrator is enabled.
 */
export async function bootstrapFlowSession(session, assistant) {
  const enabled = await isFlowOrchestratorEnabled(assistant);
  if (!enabled) return false;

  const version = assistant.config?.flowVersion || 1;
  const bundle = await loadFlowBundle(assistant.key, version);
  if (!bundle) return false;

  initFlowSession(session, bundle.flow);
  session.useFlowOrchestrator = true;
  return true;
}

/**
 * After document upload, advance flow past upload_gate.
 */
export async function advanceFlowAfterUpload(session, assistant) {
  if (!session.useFlowOrchestrator || !session.flowKey) return null;

  const version = session.flowVersion || 1;
  const bundle = await loadFlowBundle(assistant.key, version);
  if (!bundle) return null;

  const node = bundle.flow.nodes[session.currentNodeId];
  if (
    session.flowState === FLOW_STATES.WAITING_UPLOAD &&
    node?.type === "upload_gate"
  ) {
    session.flowState = FLOW_STATES.QA_IN_PROGRESS;
    session.isDocUploadRequired = false;
    session.isDocUploaded = true;
    session.currentNodeId = node.next;
    const language = session.selectedLanguage || "en";
    const result = processFlowTurn({
      session,
      flow: bundle.flow,
      content: bundle.content,
      userMessage: "__upload_complete__",
      context: { isPaid: session.isPaid, isSpecialAccess: false },
    });
    if (result.ok && result.reply) {
      return result;
    }
    return presentFlowStart({
      session,
      flow: bundle.flow,
      content: bundle.content,
      language,
      context: { isPaid: session.isPaid },
    });
  }
  return null;
}

/**
 * Split static instructions (cacheable) from per-session runtime overlay.
 */
async function resolveInstructionLayers({
  assistant,
  session,
  filesToUse,
  userMessage = "",
  isGuest,
  templateAsset,
  flowMode = false,
}) {
  const asset =
    templateAsset ||
    assistant?.config?.systemInstructionAsset ||
    assistant?.config?.finalGenerationAsset;

  if (!asset) {
    return {
      cacheableText: null,
      dynamicOverlay: SESSION_STATE_PROTOCOL,
      fullInlineText: null,
      asset: null,
    };
  }

  let cacheableText = await readPromptFile(asset);

  if (flowMode) {
    cacheableText +=
      "\n\n=== FLOW MODE: FINAL GENERATION ONLY ===\n" +
      "You are generating the final legal document. The structured answers JSON in the user message is authoritative. " +
      "Do not ask new questions. Output the complete document per your template rules. " +
      "End with control JSON on the last line only.";
  }

  const dynamicParts = [SESSION_STATE_PROTOCOL];

  if (isGuest) {
    const guestOverlay = appendGuestSystemInstruction("", session).trim();
    if (guestOverlay) dynamicParts.unshift(guestOverlay);
  }

  if (filesToUse?.length > 0) {
    const fileCount = filesToUse.length;
    const fileText = fileCount > 1 ? "documents have" : "document has";
    dynamicParts.push(
      `IMPORTANT: ${fileCount} uploaded ${fileText} been provided for analysis. ` +
        "The uploaded document(s) are read-only. Do not invent missing clauses. " +
        "If information is missing from the document(s), respond with 'Not found in document.' " +
        "Follow the system rules strictly and analyze only what is present in the uploaded document(s)."
    );
    const postUploadOverlay = buildPostUploadTurnOverlay(
      session,
      assistant,
      userMessage
    );
    if (postUploadOverlay) {
      dynamicParts.push(postUploadOverlay);
    }
  }

  const dynamicOverlay = dynamicParts.join("\n\n");
  const fullInlineText = `${cacheableText}\n\n${dynamicOverlay}`;

  return { cacheableText, dynamicOverlay, fullInlineText, asset };
}

async function resolveSystemInstruction({
  assistant,
  session,
  filesToUse,
  isGuest,
  templateAsset,
  flowMode = false,
}) {
  const asset =
    templateAsset ||
    assistant?.config?.systemInstructionAsset ||
    assistant?.config?.finalGenerationAsset;

  if (!asset) return undefined;

  let text;
  if (isGuest) {
    text = await buildGuestGeminiSystemInstruction(
      assistant,
      session,
      filesToUse
    );
  } else {
    text = await readPromptFile(asset);
    if (filesToUse?.length > 0) {
      const fileCount = filesToUse.length;
      const fileText = fileCount > 1 ? "documents have" : "document has";
      text +=
        `\n\nIMPORTANT: ${fileCount} uploaded ${fileText} been provided for analysis. ` +
        "The uploaded document(s) are read-only. Do not invent missing clauses. " +
        "If information is missing from the document(s), respond with 'Not found in document.' " +
        "Follow the system rules strictly and analyze only what is present in the uploaded document(s).";
    }
  }

  if (flowMode && text) {
    text +=
      "\n\n=== FLOW MODE: FINAL GENERATION ONLY ===\n" +
      "You are generating the final legal document. The structured answers JSON in the user message is authoritative. " +
      "Do not ask new questions. Output the complete document per your template rules. " +
      "End with control JSON on the last line only.";
  }

  return text;
}

function wrapStreamChunkForDisplay(onStreamChunk) {
  if (!onStreamChunk) return undefined;
  return (_chunk, rawFull) => {
    const display = streamDisplayFromRaw(rawFull);
    onStreamChunk(_chunk, display);
  };
}

function buildFlowResponseEnvelope(session, result, extra = {}) {
  return {
    reply: result.reply,
    paymentRequired: !!result.paymentRequired,
    paymentAmount: result.paymentAmount,
    paymentCycle: session.paymentCycle || 0,
    requiresUpload: !!result.requiresUpload,
    uploadType: result.uploadType || null,
    sessionTerminated: !!result.sessionTerminated,
    terminationMessage: result.terminationMessage || null,
    nodeId: result.nodeId,
    displayNumber: result.displayNumber,
    phase: result.phase || session.flowState,
    flowMode: true,
    flowOptions: [],
    inputType: result.inputType || null,
    streaming: !!extra.streaming,
    ...extra,
  };
}

/**
 * Unified chat turn — flow orchestrator or legacy Gemini.
 */
export async function handleChatTurn({
  session,
  assistant,
  userMessage,
  filesToUse = [],
  isGuest = false,
  isSpecialAccess = false,
  onStreamChunk,
}) {
  const useFlow =
    session.useFlowOrchestrator ||
    (await isFlowOrchestratorEnabled(assistant));

  const streamForDisplay = wrapStreamChunkForDisplay(onStreamChunk);

  if (useFlow) {
    return handleFlowTurn({
      session,
      assistant,
      userMessage,
      filesToUse,
      isGuest,
      isSpecialAccess,
      onStreamChunk: streamForDisplay,
    });
  }

  return handleLegacyGeminiTurn({
    session,
    assistant,
    userMessage,
    filesToUse,
    isGuest,
    isSpecialAccess,
    onStreamChunk: streamForDisplay,
  });
}

async function handleFlowTurn({
  session,
  assistant,
  userMessage,
  filesToUse,
  isGuest,
  isSpecialAccess,
  onStreamChunk,
}) {
  const version = session.flowVersion || assistant.config?.flowVersion || 1;
  const bundle = await loadFlowBundle(assistant.key, version);
  if (!bundle) {
    return handleLegacyGeminiTurn({
      session,
      assistant,
      userMessage,
      filesToUse,
      isGuest,
      isSpecialAccess,
      onStreamChunk,
    });
  }

  if (!session.flowKey) {
    initFlowSession(session, bundle.flow);
    session.useFlowOrchestrator = true;
  }

  if (userMessage !== FLOW_BOOTSTRAP_MESSAGE) {
    const unpaidGate = buildUnpaidPaymentGateResponse(session, {
      isSpecialAccess,
      language: session.selectedLanguage,
    });
    if (unpaidGate) {
      if (onStreamChunk && unpaidGate.reply) {
        onStreamChunk(unpaidGate.reply, unpaidGate.reply);
      }
      return buildFlowResponseEnvelope(session, {
        ...unpaidGate,
        phase: session.flowState || FLOW_STATES.WAITING_PAYMENT,
        streaming: !!onStreamChunk,
      });
    }
  }

  const context = { isPaid: session.isPaid || isSpecialAccess, isSpecialAccess };

  let result;
  if (userMessage === FLOW_BOOTSTRAP_MESSAGE) {
    result = processFlowTurn({
      session,
      flow: bundle.flow,
      content: bundle.content,
      userMessage,
      context,
    });
  } else if (userMessage === "__upload_complete__") {
    result = await advanceFlowAfterUpload(session, assistant);
    if (!result) {
      result = processFlowTurn({
        session,
        flow: bundle.flow,
        content: bundle.content,
        userMessage: "continue",
        context,
      });
    }
  } else {
    result = processFlowTurn({
      session,
      flow: bundle.flow,
      content: bundle.content,
      userMessage,
      context,
    });
  }

  if (!result?.ok) {
    return { error: result?.error || "Flow processing failed", status: 500 };
  }

  // Payment barrier from flow engine
  if (result.paymentRequired && !isSpecialAccess) {
    applyPaymentBarrier(session, {
      isSpecialAccess,
      language: session.selectedLanguage,
    });
    const paymentCycle = session.paymentCycle || 0;
    const paymentAmount = getCyclePayableAmount(session, paymentCycle);
    let reply = result.reply || paymentBarrierMessage(session.selectedLanguage || "en");
    if (result.controlJson) {
      reply = appendControlJson(reply, result.controlJson);
    }
    return buildFlowResponseEnvelope(session, {
      ...result,
      reply,
      paymentRequired: true,
      paymentAmount,
    });
  }

  // Final LLM generation — never invoke model until webhook confirms payment
  if (result.finalGenerate || result.invokeLlm) {
    const unpaidBeforeGenerate = buildUnpaidPaymentGateResponse(session, {
      isSpecialAccess,
      language: session.selectedLanguage,
    });
    if (unpaidBeforeGenerate) {
      if (onStreamChunk && unpaidBeforeGenerate.reply) {
        onStreamChunk(unpaidBeforeGenerate.reply, unpaidBeforeGenerate.reply);
      }
      return buildFlowResponseEnvelope(session, {
        ...unpaidBeforeGenerate,
        phase: session.flowState || FLOW_STATES.WAITING_PAYMENT,
        streaming: !!onStreamChunk,
      });
    }

    const templateAsset =
      result.templateAsset ||
      bundle.flow.finalTemplateAsset ||
      assistant.config?.systemInstructionAsset;

    const systemInstructionText = await resolveSystemInstruction({
      assistant,
      session,
      filesToUse,
      isGuest,
      templateAsset,
      flowMode: true,
    });

    const genUserMessage = buildFinalGenerationUserMessage(session, userMessage);
    const history = buildGeminiHistory(session, genUserMessage, filesToUse, {
      useTrimmedHistory: false,
    });
    const sourceConfig = session.geminiConfig || {};

    const assistantMessage = await streamGeminiChat({
      sourceConfig,
      systemInstructionText,
      contents: history,
      onChunk: onStreamChunk,
    });

    let uploadInfo = extractUploadRequirement(assistantMessage);
    uploadInfo = enforceFlowGuards(session, uploadInfo);
    let cleanMessage = uploadInfo.cleanMessage || assistantMessage;

    if (uploadInfo.paymentRequired && !isSpecialAccess) {
      const barrier = applyPaymentBarrier(session, {
        language: session.selectedLanguage,
      });
      cleanMessage = barrier.cleanMessage;
      return buildFlowResponseEnvelope(session, {
        reply: cleanMessage,
        paymentRequired: true,
        paymentAmount: barrier.paymentAmount,
        nodeId: result.nodeId,
        phase: FLOW_STATES.WAITING_PAYMENT,
      });
    }

    if (uploadInfo.sessionTerminated) {
      session.flowState = FLOW_STATES.TERMINATED;
    }

    const saved = applyDownloadSnapshot(
      session,
      session._id || session.guestSessionId,
      uploadInfo,
      cleanMessage
    );
    if (saved) {
      session.flowState = FLOW_STATES.FINAL_GENERATED;
    }

    return buildFlowResponseEnvelope(session, {
      reply: cleanMessage,
      sessionTerminated: uploadInfo.sessionTerminated,
      terminationMessage: uploadInfo.terminationMessage,
      requiresUpload: uploadInfo.requiresUpload,
      uploadType: uploadInfo.uploadType,
      nodeId: result.nodeId,
      phase: session.flowState,
    }, { streaming: !!onStreamChunk });
  }

  let reply = result.reply || "";
  if (result.controlJson) {
    reply = appendControlJson(reply, result.controlJson);
  }

  return buildFlowResponseEnvelope(session, { ...result, reply });
}

async function handleLegacyGeminiTurn({
  session,
  assistant,
  userMessage,
  filesToUse,
  isGuest,
  isSpecialAccess,
  onStreamChunk,
}) {
  let layers;
  try {
    layers = await resolveInstructionLayers({
      assistant,
      session,
      filesToUse,
      userMessage,
      isGuest,
    });
  } catch (err) {
    return { error: err.message, status: 500, message: "systemInstruction file not found" };
  }

  if (!layers.fullInlineText) {
    return { error: "No system instruction asset configured", status: 500 };
  }

  if (!session.qaPhase) {
    session.qaPhase = QA_PHASES.QA_IN_PROGRESS;
  }

  if (isGuest && userMessage === GUEST_BOOTSTRAP_MESSAGE) {
    return finishGuestStaticTurn({
      session,
      reply: buildGuestLanguagePromptHtml(),
      onStreamChunk,
      normalizeQaDisplayHtml,
      persistSessionDocumentSnapshot,
    });
  }

  applyPreTurnSessionUpdates(session, userMessage);

  if (isGuest) {
    const langPick = detectLanguageChoiceFromUserMessage(userMessage);
    if (langPick && isAwaitingGuestChoice(session)) {
      session.guestOfferQuestionShown = true;
      promoteGuestSignupOfferState(session);
      return finishGuestLanguageSelectedTurn({
        session,
        persistSessionDocumentSnapshot,
      });
    }
  }

  const unpaidGate = buildUnpaidPaymentGateResponse(session, {
    isSpecialAccess,
    language: session.selectedLanguage,
  });
  if (unpaidGate) {
    if (onStreamChunk && unpaidGate.reply) {
      onStreamChunk(unpaidGate.reply, unpaidGate.reply);
    }
    return {
      ...unpaidGate,
      streaming: !!onStreamChunk,
      instructionCached: false,
    };
  }

  if (
    session.qaPhase === QA_PHASES.WAITING_PAYMENT &&
    (session.isPaid || isSpecialAccess)
  ) {
    session.qaPhase = QA_PHASES.READY_FOR_FINAL;
  }

  const sourceConfig = session.geminiConfig || {};
  let cachedContentName = null;
  const hasUploadedFiles = Array.isArray(filesToUse) && filesToUse.length > 0;

  // Document turns attach fileData — skip context cache (inline instructions + files).
  if (isInstructionCacheEnabled() && !hasUploadedFiles) {
    cachedContentName = await getOrCreateInstructionCache({
      instructionText: layers.cacheableText,
      sourceConfig,
      displayName: assistant.key || "assistant",
    });
    session.geminiInstructionCacheName = cachedContentName || null;
  } else if (hasUploadedFiles) {
    session.geminiInstructionCacheName = null;
  }

  const contents = buildLegacyGeminiContents({
    session,
    userMessage,
    filesToUse,
    dynamicOverlay: layers.dynamicOverlay,
  });

  const streamOpts = {
    sourceConfig,
    systemInstructionText: cachedContentName ? undefined : layers.fullInlineText,
    cachedContentName: cachedContentName || undefined,
    contents,
    onChunk: onStreamChunk,
  };

  let assistantMessage;
  try {
    assistantMessage = await streamGeminiChat(streamOpts);
  } catch (geminiErr) {
    const staleCache =
      cachedContentName &&
      (/cache|cachedContent|not found|expired|invalid/i.test(
        String(geminiErr?.message || "")
      ) ||
        hasUploadedFiles);
    if (staleCache || (hasUploadedFiles && cachedContentName)) {
      console.warn(
        "[GeminiCache] Stale cache reference — retrying with inline instructions",
        { name: cachedContentName }
      );
      session.geminiInstructionCacheName = null;
      try {
        assistantMessage = await streamGeminiChat({
          ...streamOpts,
          cachedContentName: undefined,
          systemInstructionText: layers.fullInlineText,
        });
        cachedContentName = null;
      } catch (retryErr) {
        return { error: retryErr.message, status: 500, message: "Gemini failed" };
      }
    } else {
      console.error("[Gemini] generateContent failed", {
        sessionId: session._id || session.guestSessionId,
        message: geminiErr?.message,
      });
      return { error: geminiErr.message, status: 500, message: "Gemini failed" };
    }
  }

  let uploadInfo = extractUploadRequirement(assistantMessage);
  uploadInfo = enforceFlowGuards(session, uploadInfo);
  uploadInfo = enforceLegacySessionGuards(session, uploadInfo, {
    isSpecialAccess,
  });
  if (isGuest) {
    uploadInfo = enforceGuestOfferGuards(session, uploadInfo);
  }

  if (uploadInfo.sessionState) {
    mergeSessionStateFromModel(session, uploadInfo.sessionState);
  }

  advanceQaPhase(session, uploadInfo);

  let cleanMessage = uploadInfo.cleanMessage || assistantMessage;
  if (!cleanMessage?.trim() && uploadInfo.sessionState) {
    cleanMessage =
      "Thank you. Please wait while I prepare your next question.";
    console.warn("[Chat] Model returned control JSON only — no user-visible reply", {
      sessionId: session._id || session.guestSessionId,
      currentStep: uploadInfo.sessionState?.current_step,
    });
  }

  cleanMessage = normalizeQaDisplayHtml(cleanMessage, {
    documentReady: inferDownloadSnapshot(session, uploadInfo, cleanMessage),
  });

  if (isGuest) {
    if (isGuestLanguagePhase(session)) {
      cleanMessage = stripGuestOfferBoilerplate(cleanMessage);
    } else if (
      session.guestFlowPhase === GUEST_FLOW_PHASE.ACTIVE ||
      session.signupOfferResponse === "declined" ||
      session.signupOfferResponse === "accepted"
    ) {
      cleanMessage = stripGuestOfferBoilerplate(cleanMessage);
    }
    if (isAwaitingGuestChoice(session)) {
      session.guestOfferQuestionShown = true;
      cleanMessage = "";
    }
  }

  const flowOptions = [];

  if (uploadInfo.paymentRequired && !isSpecialAccess) {
    const barrier = applyPaymentBarrier(session, {
      language:
        session.selectedLanguage || detectChatLanguageFromText(cleanMessage),
    });
    session.qaPhase = QA_PHASES.WAITING_PAYMENT;
    cleanMessage = barrier.cleanMessage;
    return {
      reply: cleanMessage,
      paymentRequired: true,
      paymentAmount: barrier.paymentAmount,
      paymentCycle: barrier.paymentCycle,
      sessionTerminated: false,
      flowMode: false,
      flowOptions,
      streaming: !!onStreamChunk,
      instructionCached: !!cachedContentName,
    };
  }

  applyDownloadSnapshot(
    session,
    session._id || session.guestSessionId,
    uploadInfo,
    cleanMessage
  );

  const guestSignupOfferPending =
    isGuest &&
    isAwaitingGuestChoice(session) &&
    session.signupOfferResponse !== "declined" &&
    session.signupOfferResponse !== "accepted";

  return {
    reply: cleanMessage,
    sessionTerminated: uploadInfo.sessionTerminated,
    terminationMessage: uploadInfo.terminationMessage,
    paymentRequired: false,
    requiresUpload: uploadInfo.requiresUpload,
    uploadType: uploadInfo.uploadType,
    uploadReason: uploadInfo.reason,
    guestSignupOffer: !!uploadInfo.guestSignupOffer,
    guestSignupOfferPending,
    selectedLanguage: uploadInfo.selectedLanguage || session.selectedLanguage || null,
    flowMode: false,
    flowOptions,
    streaming: !!onStreamChunk,
    instructionCached: !!cachedContentName,
  };
}

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
  persistSessionDocumentSnapshot,
  paymentBarrierMessage,
  detectChatLanguageFromText,
} from "./messageControlParse.js";
import {
  applyPaymentBarrier,
  enforceFlowGuards,
  enforceLegacySessionGuards,
  getCyclePayableAmount,
} from "./sessionGuards.js";
import {
  buildFinalGenerationUserMessage,
  buildLegacyGeminiContents,
  buildGeminiHistory,
  streamGeminiChat,
} from "./geminiChat.js";
import { buildGuestGeminiSystemInstruction } from "./guestSignupOffer.js";
import { appendGuestSystemInstruction } from "./guestPromptContext.js";
import {
  getOrCreateInstructionCache,
  isInstructionCacheEnabled,
} from "./geminiInstructionCache.js";
import {
  SESSION_STATE_PROTOCOL,
  mergeSessionStateFromModel,
  advanceQaPhase,
  quickOptionsToFlowOptions,
  isPaymentCompletionMessage,
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
    flowOptions: result.flowOptions || [],
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

  if (useFlow) {
    return handleFlowTurn({
      session,
      assistant,
      userMessage,
      filesToUse,
      isGuest,
      isSpecialAccess,
      onStreamChunk,
    });
  }

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

  // Final LLM generation
  if (result.finalGenerate || result.invokeLlm) {
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

    session.flowState = uploadInfo.documentReady
      ? FLOW_STATES.FINAL_GENERATED
      : session.flowState;

    if (uploadInfo.sessionTerminated) {
      session.flowState = FLOW_STATES.TERMINATED;
    }

    persistSessionDocumentSnapshot(
      session,
      session._id || session.guestSessionId,
      uploadInfo,
      cleanMessage
    );

    return buildFlowResponseEnvelope(session, {
      reply: cleanMessage,
      sessionTerminated: uploadInfo.sessionTerminated,
      terminationMessage: uploadInfo.terminationMessage,
      requiresUpload: uploadInfo.requiresUpload,
      uploadType: uploadInfo.uploadType,
      nodeId: result.nodeId,
      phase: session.flowState,
      documentReady: uploadInfo.documentReady,
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

  if (
    session.qaPhase === QA_PHASES.WAITING_PAYMENT &&
    (session.isPaid || isSpecialAccess || isPaymentCompletionMessage(userMessage))
  ) {
    session.qaPhase = QA_PHASES.READY_FOR_FINAL;
  }

  const sourceConfig = session.geminiConfig || {};
  let cachedContentName = session.geminiInstructionCacheName || null;

  if (!cachedContentName && isInstructionCacheEnabled()) {
    cachedContentName = await getOrCreateInstructionCache({
      instructionText: layers.cacheableText,
      sourceConfig,
      displayName: assistant.key || "assistant",
    });
    if (cachedContentName) {
      session.geminiInstructionCacheName = cachedContentName;
    }
  }

  const contents = buildLegacyGeminiContents({
    session,
    userMessage,
    filesToUse,
    dynamicOverlay: layers.dynamicOverlay,
  });

  let assistantMessage;
  try {
    assistantMessage = await streamGeminiChat({
      sourceConfig,
      systemInstructionText: cachedContentName ? undefined : layers.fullInlineText,
      cachedContentName: cachedContentName || undefined,
      contents,
      onChunk: onStreamChunk,
    });
  } catch (geminiErr) {
    return { error: geminiErr.message, status: 500, message: "Gemini failed" };
  }

  let uploadInfo = extractUploadRequirement(assistantMessage);
  uploadInfo = enforceFlowGuards(session, uploadInfo);
  uploadInfo = enforceLegacySessionGuards(session, uploadInfo, { isSpecialAccess });

  if (uploadInfo.sessionState) {
    mergeSessionStateFromModel(session, uploadInfo.sessionState);
  }
  if (uploadInfo.selectedLanguage) {
    session.selectedLanguage = uploadInfo.selectedLanguage;
  }

  advanceQaPhase(session, uploadInfo);

  let cleanMessage = uploadInfo.cleanMessage || assistantMessage;
  const flowOptions = quickOptionsToFlowOptions(
    uploadInfo.sessionState?.quick_options || session.lastQuickOptions
  );

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

  persistSessionDocumentSnapshot(
    session,
    session._id || session.guestSessionId,
    uploadInfo,
    cleanMessage
  );

  return {
    reply: cleanMessage,
    sessionTerminated: uploadInfo.sessionTerminated,
    terminationMessage: uploadInfo.terminationMessage,
    paymentRequired: false,
    requiresUpload: uploadInfo.requiresUpload,
    uploadType: uploadInfo.uploadType,
    uploadReason: uploadInfo.reason,
    documentReady: uploadInfo.documentReady,
    flowMode: false,
    flowOptions,
    streaming: !!onStreamChunk,
    instructionCached: !!cachedContentName,
  };
}

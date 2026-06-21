import { detectLanguageChoiceFromUserMessage } from "../chat/guestPromptContext.js";
import {
  FLOW_STATES,
  INPUT_TYPES,
  NODE_TYPES,
  PAYMENT_MODES,
} from "./flowConstants.js";
import { buildControlJson, renderNodeContent, buildFlowOptions } from "./flowContent.js";
import { evaluateCondition, matchRouterRoute, resolveRouterNext } from "./flowConditions.js";
import { refreshDerivedFlags } from "./flowDerivedFlags.js";

function defaultFlowSession() {
  return {
    flowKey: null,
    flowVersion: 1,
    flowState: FLOW_STATES.QA_IN_PROGRESS,
    currentNodeId: null,
    answers: {},
    askedNodeOrder: [],
    paymentGateShown: false,
    flowAudit: [],
    noticeParagraphs: [],
    noticeParagraphKeys: [],
  };
}

export function initFlowSession(session, flow) {
  const base = defaultFlowSession();
  session.flowKey = flow.flowKey;
  session.flowVersion = flow.version;
  session.flowState = FLOW_STATES.QA_IN_PROGRESS;
  session.currentNodeId = flow.startNodeId;
  session.answers = session.answers || {};
  session.askedNodeOrder = [];
  session.paymentGateShown = false;
  session.flowAudit = session.flowAudit || [];
  return { ...base, ...session };
}

function audit(session, entry) {
  if (!session.flowAudit) session.flowAudit = [];
  session.flowAudit.push({ ...entry, at: new Date().toISOString() });
  if (session.flowAudit.length > 200) {
    session.flowAudit = session.flowAudit.slice(-200);
  }
}

function normalizeAnswer(node, rawMessage) {
  const text = String(rawMessage || "").trim();
  const input = node.input || { type: INPUT_TYPES.TEXT };

  if (input.type === INPUT_TYPES.LANGUAGE_SELECT) {
    const lang = detectLanguageChoiceFromUserMessage(text);
    if (lang) return { valid: true, value: lang, normalized: lang };

    const lower = text.toLowerCase().replace(/\.$/, "").trim();
    const letterMatch = lower.match(/^([a-m])$/);
    if (letterMatch) {
      const idx = letterMatch[1].charCodeAt(0) - 97;
      const langKeys = [
        "en", "hi", "gu", "pa", "ta", "te", "kn", "bn", "mr", "or", "as", "bho", "ur",
      ];
      if (langKeys[idx]) {
        return { valid: true, value: langKeys[idx], normalized: langKeys[idx] };
      }
    }

    const num = parseInt(lower.replace(/[^\d]/g, ""), 10);
    if (num >= 1 && num <= 13) {
      const langKeys = [
        "en", "hi", "gu", "pa", "ta", "te", "kn", "bn", "mr", "or", "as", "bho", "ur",
      ];
      const code = langKeys[num - 1];
      return { valid: true, value: code, normalized: code };
    }

    return { valid: false, reason: "invalid_language" };
  }

  if (input.type === INPUT_TYPES.SINGLE_SELECT) {
    const lower = text.toLowerCase().replace(/\.$/, "").trim();
    const options = input.options || [];
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const key = typeof opt === "string" ? opt : opt.key;
      const label = typeof opt === "string" ? opt : opt.label || "";
      const letter = String.fromCharCode(97 + i);
      if (
        lower === String(key).toLowerCase() ||
        lower === letter ||
        lower === `${i + 1}` ||
        lower === `${letter}.` ||
        lower.startsWith(`${letter})`) ||
        lower.startsWith(`${i + 1}.`) ||
        lower.startsWith(`${i + 1} `) ||
        (label && lower === String(label).toLowerCase())
      ) {
        return { valid: true, value: key, normalized: key };
      }
    }
    return { valid: false, reason: "invalid_option" };
  }

  if (input.type === INPUT_TYPES.CONFIRMATION) {
    const yes = /^(yes|y|ok|okay|confirm|understood|agree|ha|haan|हाँ|हां|ठीक)/i.test(
      text
    );
    const no = /^(no|n|cancel|decline|nahi|नहीं)/i.test(text);
    if (yes) return { valid: true, value: "yes", normalized: "yes" };
    if (no) return { valid: true, value: "no", normalized: "no" };
    return { valid: false, reason: "invalid_confirmation" };
  }

  if (input.type === INPUT_TYPES.NUMBER) {
    const n = parseInt(text.replace(/[^\d]/g, ""), 10);
    if (Number.isFinite(n) && n > 0) {
      return { valid: true, value: n, normalized: String(n) };
    }
    return { valid: false, reason: "invalid_number" };
  }

  if (!text) return { valid: false, reason: "empty" };

  const maxWords = input.maxWords;
  if (maxWords && Number.isFinite(maxWords)) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length > maxWords) {
      return { valid: false, reason: "too_long", maxWords };
    }
  }

  return { valid: true, value: text, normalized: text };
}

function resolveNextNodeId(node, answerValue, session) {
  const answers = session.answers || {};
  const flags = session.flowFlags || {};
  if (node.edges && answerValue != null && node.edges[answerValue]) {
    return node.edges[answerValue];
  }
  if (node.type === NODE_TYPES.ROUTER) {
    return resolveRouterNext(node, answers, answerValue, flags);
  }
  return node.next || null;
}

function collectNoticeParagraph(session, content, paragraphKey) {
  if (!paragraphKey || !content?.noticeParagraphs?.[paragraphKey]) return;
  const block = content.noticeParagraphs[paragraphKey];
  const language = session.selectedLanguage || session.answers?.language || "en";
  const text =
    (typeof block === "string" ? block : block[language]) ||
    (typeof block === "object" ? block.en : "") ||
    "";
  if (!text) return;
  if (!session.noticeParagraphs) session.noticeParagraphs = [];
  if (!session.noticeParagraphs.includes(text)) {
    session.noticeParagraphs.push(text);
  }
  if (!session.noticeParagraphKeys) session.noticeParagraphKeys = [];
  if (!session.noticeParagraphKeys.includes(paragraphKey)) {
    session.noticeParagraphKeys.push(paragraphKey);
  }
}

function applyOnAnswerEffects(session, content, node, answerValue) {
  const effects = node.onAnswer?.[answerValue];
  if (!effects) return;
  if (effects.noticeParagraphKey) {
    collectNoticeParagraph(session, content, effects.noticeParagraphKey);
  }
  if (effects.noticeParagraphKeys?.length) {
    for (const key of effects.noticeParagraphKeys) {
      collectNoticeParagraph(session, content, key);
    }
  }
}

function withFlowOptions(result, node) {
  if (!node || !result) return result;
  const flowOptions = buildFlowOptions(node);
  if (flowOptions.length) {
    result.flowOptions = flowOptions;
    result.inputType = node.input?.type || null;
  }
  return result;
}

function nextDisplayNumber(session) {
  const asked = session.askedNodeOrder || [];
  return asked.filter((id) => id.startsWith("q:")).length + 1;
}

function isPaymentCompletionMessage(text) {
  return /payment\s+completed|paid\s+successfully|mark\s+payment/i.test(
    String(text || "")
  );
}

export const FLOW_BOOTSTRAP_MESSAGE = "__flow_start__";

/**
 * Process one user turn through the flow engine.
 * @returns {Promise<object>}
 */
export function processFlowTurn({
  session,
  flow,
  content,
  userMessage,
  context = {},
}) {
  const { isPaid, isSpecialAccess } = context;
  const nodeId = session.currentNodeId;
  const node = flow.nodes[nodeId];

  if (!node) {
    return {
      ok: false,
      error: `Unknown flow node: ${nodeId}`,
    };
  }

  const language = session.selectedLanguage || session.answers?.language || "en";

  if (userMessage === FLOW_BOOTSTRAP_MESSAGE) {
    return presentNode({
      session,
      flow,
      content,
      nodeId: session.currentNodeId || flow.startNodeId,
      language,
      context,
    });
  }

  // Waiting for payment — only accept payment completion or block
  if (session.flowState === FLOW_STATES.WAITING_PAYMENT) {
    if (isPaid || isSpecialAccess || isPaymentCompletionMessage(userMessage)) {
      session.flowState = FLOW_STATES.READY_FOR_FINAL;
      session.isPaid = true;
      const nextId = node.next || node.defaultNext;
      if (nextId) {
        session.currentNodeId = nextId;
        audit(session, {
          from: nodeId,
          event: "payment_cleared",
          to: nextId,
        });
        return presentNode({
          session,
          flow,
          content,
          nodeId: nextId,
          language,
          context,
        });
      }
    }
    return {
      ok: true,
      reply: null,
      paymentRequired: true,
      phase: session.flowState,
      nodeId,
      blocked: true,
      blockReason: "payment_required",
    };
  }

  if (session.flowState === FLOW_STATES.TERMINATED) {
    const closing =
      content?.closing?.text?.[language] ||
      content?.closing?.text?.en ||
      "Your session is over now. You can exit or start a new session.";
    return {
      ok: true,
      reply: closing,
      sessionTerminated: true,
      phase: session.flowState,
      nodeId,
      controlJson: buildControlJson({ sessionTerminated: true }),
    };
  }

  // MESSAGE nodes auto-advance on any user ack
  if (node.type === NODE_TYPES.MESSAGE) {
    const nextId = node.next;
    if (nextId) {
      session.currentNodeId = nextId;
      audit(session, { from: nodeId, event: "message_ack", to: nextId });
      return presentNode({
        session,
        flow,
        content,
        nodeId: nextId,
        language,
        context,
      });
    }
  }

  // QUESTION — validate answer
  if (node.type === NODE_TYPES.QUESTION) {
    const parsed = normalizeAnswer(node, userMessage);
    if (!parsed.valid) {
      const displayNumber = session.askedNodeOrder?.length
        ? session.askedNodeOrder.filter((x) => x.startsWith("q:")).length
        : nextDisplayNumber(session);
      const retryHtml = renderNodeContent({
        content,
        contentKey: node.contentKey,
        node,
        language,
        displayNumber,
      });
      return withFlowOptions(
        {
          ok: true,
          reply: retryHtml,
          phase: session.flowState,
          nodeId,
          displayNumber,
          retried: true,
        },
        node
      );
    }

    session.answers[nodeId] = parsed.normalized;
    if (node.storeAs) session.answers[node.storeAs] = parsed.normalized;
    if (node.input?.type === INPUT_TYPES.LANGUAGE_SELECT) {
      session.selectedLanguage = parsed.normalized;
      session.answers.language = parsed.normalized;
    }

    if (!session.askedNodeOrder.includes(`q:${nodeId}`)) {
      session.askedNodeOrder.push(`q:${nodeId}`);
    }

    applyOnAnswerEffects(session, content, node, parsed.value);
    refreshDerivedFlags(session);

    const nextId = resolveNextNodeId(node, parsed.value, session);

    audit(session, {
      from: nodeId,
      answer: parsed.normalized,
      to: nextId,
    });

    if (!nextId) {
      return { ok: false, error: `No transition from node ${nodeId}` };
    }

    session.currentNodeId = nextId;
    return presentNode({
      session,
      flow,
      content,
      nodeId: nextId,
      language,
      context,
    });
  }

  // Non-question nodes on first presentation
  return presentNode({
    session,
    flow,
    content,
    nodeId,
    language,
    context,
  });
}

function presentNode({ session, flow, content, nodeId, language, context }) {
  const node = flow.nodes[nodeId];
  if (!node) return { ok: false, error: `Missing node ${nodeId}` };

  const { isPaid, isSpecialAccess } = context;

  if (node.type === NODE_TYPES.PAYMENT_GATE) {
    const repeatable = flow.paymentMode === PAYMENT_MODES.REPEATABLE;
    if (session.isPaid && !repeatable && session.paymentGateShown) {
      session.currentNodeId = node.next;
      return presentNode({
        session,
        flow,
        content,
        nodeId: node.next,
        language,
        context,
      });
    }

    if (session.isPaid && repeatable) {
      session.paymentCycle = (session.paymentCycle || 0) + 1;
    }

    session.flowState = FLOW_STATES.WAITING_PAYMENT;
    session.paymentGateShown = true;
    session.isPaid = false;

    const html = renderNodeContent({
      content,
      contentKey: node.contentKey,
      node,
      language,
      displayNumber: null,
    });

    return {
      ok: true,
      reply: html,
      paymentRequired: true,
      phase: session.flowState,
      nodeId,
      controlJson: buildControlJson({ paymentRequired: true }),
    };
  }

  if (node.type === NODE_TYPES.UPLOAD_GATE) {
    session.flowState = FLOW_STATES.WAITING_UPLOAD;
    session.isDocUploadRequired = true;
    session.isDocUploaded = false;

    const html = renderNodeContent({
      content,
      contentKey: node.contentKey,
      node,
      language,
      displayNumber: null,
    });

    return {
      ok: true,
      reply: html,
      requiresUpload: true,
      uploadType: node.uploadType || "document",
      phase: session.flowState,
      nodeId,
      controlJson: buildControlJson({
        uploadRequired: true,
        uploadType: node.uploadType || "document",
      }),
    };
  }

  if (node.type === NODE_TYPES.FINAL_GENERATE) {
    if (!isPaid && !isSpecialAccess && flow.deferPayment !== false) {
      session.flowState = FLOW_STATES.WAITING_PAYMENT;
      session.currentNodeId = nodeId;
      return {
        ok: true,
        invokeLlm: true,
        blocked: true,
        paymentRequired: true,
        phase: session.flowState,
        nodeId,
      };
    }

    session.flowState = FLOW_STATES.READY_FOR_FINAL;
    return {
      ok: true,
      invokeLlm: true,
      finalGenerate: true,
      phase: session.flowState,
      nodeId,
      templateAsset: node.templatePromptAsset,
      generationContentKey: node.contentKey,
    };
  }

  if (node.type === NODE_TYPES.ROUTER) {
    refreshDerivedFlags(session);
    const route = matchRouterRoute(node, session.answers, null, session.flowFlags);
    const nextId = route?.next;
    if (!nextId) {
      return { ok: false, error: `Router ${nodeId} has no matching route` };
    }
    if (route.collectNoticeParagraphKey) {
      collectNoticeParagraph(session, content, route.collectNoticeParagraphKey);
    }
    session.currentNodeId = nextId;
    audit(session, { from: nodeId, event: "router_auto", to: nextId });
    return presentNode({
      session,
      flow,
      content,
      nodeId: nextId,
      language,
      context,
    });
  }

  if (node.type === NODE_TYPES.TERMINATE) {
    session.flowState = FLOW_STATES.TERMINATED;
    const html = renderNodeContent({
      content,
      contentKey: node.contentKey,
      node,
      language,
      displayNumber: null,
    });
    return {
      ok: true,
      reply: html,
      sessionTerminated: true,
      phase: session.flowState,
      nodeId,
      controlJson: buildControlJson({
        sessionTerminated: true,
        terminationMessage: html,
      }),
    };
  }

  if (node.type === NODE_TYPES.MESSAGE) {
    const html = renderNodeContent({
      content,
      contentKey: node.contentKey,
      node,
      language,
      displayNumber: null,
    });
    return {
      ok: true,
      reply: html,
      phase: session.flowState,
      nodeId,
      awaitUserAck: true,
    };
  }

  if (node.type === NODE_TYPES.QUESTION) {
    const displayNumber = nextDisplayNumber(session);
    const html = renderNodeContent({
      content,
      contentKey: node.contentKey,
      node,
      language,
      displayNumber,
    });
    return withFlowOptions(
      {
        ok: true,
        reply: html,
        phase: session.flowState,
        nodeId,
        displayNumber,
      },
      node
    );
  }

  return { ok: false, error: `Unhandled node type ${node.type} at ${nodeId}` };
}

/**
 * Present the first node when a flow session starts (no user answer yet).
 */
export function presentFlowStart({ session, flow, content, language = "en", context }) {
  return presentNode({
    session,
    flow,
    content,
    nodeId: flow.startNodeId,
    language,
    context,
  });
}

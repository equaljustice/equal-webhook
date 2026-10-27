import { NODE_TYPES, FLOW_STATES } from "../flow/flowConstants.js";

/**
 * JollyJi stepper progress (SSE `done` / JSON: progress, batchLabel).
 * Default off; set JOLLYJI_PROGRESS_ENABLED=true to enable.
 * When off, control keys, prompt text and payloads are unchanged.
 */
export function isProgressEnabled() {
  const v = process.env.JOLLYJI_PROGRESS_ENABLED;
  return v === "true" || v === "1";
}

export const PROGRESS_CONTROL_KEYS = ["progress", "batch_label"];

const BATCH_LABEL_MAX = 80;

/** 0-100 integer, or null when absent/invalid. Numeric strings accepted. */
export function normalizeProgress(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/**
 * Dynamic progress (Assistant.config.dynamicProgress): the model reports how many questions
 * are still ahead for THIS user's branch; the client divides answered by answered + remaining.
 */
export const QUESTIONS_REMAINING_RULE =
  '- QUESTIONS REMAINING: in the same last-line control JSON, always include top-level "questions_remaining": an integer = how many questions this user still has to answer before the final advice is generated: the questions asked in THIS message plus every later question that applies given the answers so far (branching included; questions after a payment step still count; a batch counts as its number of questions). Use 0 when no questions are pending (e.g. on the payment step after the last batch, the advice itself, documents). Never nest it inside session_state.';

export function isDynamicProgressAssistant(assistant) {
  return assistant?.config?.dynamicProgress === true;
}

/** Integer 0-500, or null when absent/invalid. Numeric strings accepted. */
export function normalizeQuestionsRemaining(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(500, Math.round(n));
}

/** Short non-empty string, or null. */
export function normalizeBatchLabel(value) {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  return s.length > BATCH_LABEL_MAX ? s.slice(0, BATCH_LABEL_MAX) : s;
}

/**
 * Next node on the only non-terminating path, or null when the flow branches
 * (routers, or edges with more than one non-terminate target).
 */
function singleForwardNext(flow, node) {
  if (!node || node.type === NODE_TYPES.ROUTER) return null;
  if (node.edges && typeof node.edges === "object") {
    const targets = [...new Set(Object.values(node.edges))].filter(
      (id) => flow.nodes[id]?.type !== NODE_TYPES.TERMINATE
    );
    return targets.length === 1 ? targets[0] : null;
  }
  return node.next || node.defaultNext || null;
}

/**
 * Honest flow progress: answered questions / (answered + questions remaining on
 * the single forward path to the payment/final step). Null when the remaining
 * path branches, so the client falls back to its own estimate.
 */
export function computeFlowProgress(session, flow) {
  if (!session || !flow?.nodes) return null;
  if (session.flowState === FLOW_STATES.FINAL_GENERATED) return 100;

  const answered = (session.askedNodeOrder || []).filter((id) =>
    String(id).startsWith("q:")
  ).length;

  let remaining = 0;
  let nodeId = session.currentNodeId;
  const seen = new Set();
  while (nodeId) {
    if (seen.has(nodeId)) return null;
    seen.add(nodeId);
    const node = flow.nodes[nodeId];
    if (!node) return null;
    if (
      node.type === NODE_TYPES.PAYMENT_GATE ||
      node.type === NODE_TYPES.FINAL_GENERATE ||
      node.type === NODE_TYPES.TERMINATE
    ) {
      break;
    }
    if (
      node.type === NODE_TYPES.QUESTION &&
      !(session.askedNodeOrder || []).includes(`q:${nodeId}`)
    ) {
      remaining += 1;
    }
    const next = singleForwardNext(flow, node);
    // Branching (router / multi-target edges) or dead end: total unknown.
    if (!next) return null;
    nodeId = next;
  }

  const total = answered + remaining;
  if (total <= 0) return null;
  return normalizeProgress((answered * 100) / total);
}

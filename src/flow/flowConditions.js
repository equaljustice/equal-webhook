/**
 * Deterministic condition evaluation for flow routers.
 * Answers are normalized keys stored on session.answers (via storeAs).
 */

function readAnswer(answers, key) {
  if (!key || !answers) return undefined;
  return answers[key];
}

function matchEquals(actual, expected) {
  if (expected == null) return false;
  return String(actual).toLowerCase() === String(expected).toLowerCase();
}

/**
 * @param {object} condition
 * @param {object} answers session.answers
 * @param {string} [lastAnswer] answer just captured on current question node
 */
export function evaluateCondition(condition, answers = {}, lastAnswer = null, flags = {}) {
  if (!condition) return false;

  if (condition.not) {
    return !evaluateCondition(condition.not, answers, lastAnswer, flags);
  }

  if (condition.and?.length) {
    return condition.and.every((c) => evaluateCondition(c, answers, lastAnswer, flags));
  }

  if (condition.or?.length) {
    return condition.or.some((c) => evaluateCondition(c, answers, lastAnswer, flags));
  }

  if (condition.flag != null) {
    const val = flags[condition.flag];
    if (condition.equals !== undefined) return val === condition.equals;
    if (condition.notEquals !== undefined) return val !== condition.notEquals;
    return !!val;
  }

  if (condition.answerKey != null) {
    const actual = readAnswer(answers, condition.answerKey);
    if (condition.equals != null) return matchEquals(actual, condition.equals);
    if (condition.in?.length) {
      return condition.in.some((v) => matchEquals(actual, v));
    }
    return actual != null && actual !== "";
  }

  if (condition.anyAnswer?.keys?.length) {
    const { keys, equals } = condition.anyAnswer;
    return keys.some((key) => matchEquals(readAnswer(answers, key), equals));
  }

  if (condition.allAnswers?.keys?.length) {
    const { keys, equals } = condition.allAnswers;
    return keys.every((key) => matchEquals(readAnswer(answers, key), equals));
  }

  // Legacy: bare equals on the answer just given
  if (condition.equals != null && lastAnswer != null) {
    return matchEquals(lastAnswer, condition.equals);
  }

  return false;
}

/**
 * Pick the first matching route (includes defaultNext fallback).
 */
export function matchRouterRoute(node, answers, lastAnswer = null, flags = {}) {
  for (const route of node.routes || []) {
    if (evaluateCondition(route.when, answers, lastAnswer, flags)) return route;
  }
  if (node.defaultNext) return { next: node.defaultNext };
  return null;
}

/**
 * Pick the first matching route next node id.
 */
export function resolveRouterNext(node, answers, lastAnswer = null, flags = {}) {
  const route = matchRouterRoute(node, answers, lastAnswer, flags);
  return route?.next || null;
}

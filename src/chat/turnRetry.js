/**
 * One retry for a failed or empty model turn (QA 2026-10-30 F8: cheque-bounce got
 * two empty replies; check_my_will's first turn after paying died with
 * error "terminated" — the same message worked when the user resent it).
 * Stream tokens carry the full text, so a retry simply replaces what was shown.
 *
 * Off unless JOLLYJI_TURN_RETRY=true (deploy ≠ enable).
 */

export function isTurnRetryEnabled() {
  const v = String(process.env.JOLLYJI_TURN_RETRY || "").trim().toLowerCase();
  return v === "true" || v === "1";
}

const TRANSIENT_ERROR_RE =
  /terminated|ECONNRESET|socket hang up|fetch failed|other side closed|\b50[234]\b|UNAVAILABLE|overloaded|DEADLINE_EXCEEDED/i;

export function isTransientModelError(err) {
  return TRANSIENT_ERROR_RE.test(String(err?.message || err || ""));
}

export function isEmptyModelReply(text) {
  return !String(text ?? "").trim();
}

/**
 * Runs `call` and retries once when it throws a transient error or returns an empty
 * reply (`isEmpty`: by default blank text; callers pass a control-JSON-aware test). Non-transient errors are re-thrown unchanged (callers keep their handling).
 */
export async function withTurnRetry(
  call,
  { log = console, context = {}, isEmpty = isEmptyModelReply } = {}
) {
  if (!isTurnRetryEnabled()) return call();
  let first;
  try {
    first = await call();
  } catch (err) {
    if (!isTransientModelError(err)) throw err;
    log.warn?.("[TurnRetry] transient model error — retrying once", { ...context, message: err?.message });
    return call();
  }
  if (!isEmpty(first)) return first;
  log.warn?.("[TurnRetry] empty model reply — retrying once", context);
  return call();
}

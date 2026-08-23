/** Durable, language-agnostic marker kept in assistant HTML after control JSON is stripped. */
export const BATCH_FORM_MARKER_HTML =
  '<span hidden data-ej-batch-form="true"></span>';

export const BATCH_FORM_MARKER_RE =
  /data-ej-batch-form\s*=\s*["']?(?:1|true|yes)["']?/i;

export function isTruthyFlag(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

/** Inject a hidden batch-form marker so frontend/history work in any language. */
export function applyBatchFormDisplayMarker(html, batchForm) {
  const text = String(html || "");
  if (!batchForm || !text.trim()) return text;
  if (BATCH_FORM_MARKER_RE.test(text)) return text;
  return `${text.trimEnd()}${BATCH_FORM_MARKER_HTML}`;
}

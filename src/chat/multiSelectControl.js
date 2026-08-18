/** Durable, language-agnostic marker kept in assistant HTML after control JSON is stripped. */
export const MULTI_SELECT_MARKER_HTML =
  '<span hidden data-ej-multi-select="true"></span>';

export const MULTI_SELECT_MARKER_RE =
  /data-ej-multi-select\s*=\s*["']?(?:1|true|yes)["']?/i;

export function isTruthyFlag(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

/** Inject a hidden multi-select marker so frontend/history work in any language. */
export function applyMultiSelectDisplayMarker(html, multiSelect) {
  const text = String(html || "");
  if (!multiSelect || !text.trim()) return text;
  if (MULTI_SELECT_MARKER_RE.test(text)) return text;
  return `${text.trimEnd()}${MULTI_SELECT_MARKER_HTML}`;
}

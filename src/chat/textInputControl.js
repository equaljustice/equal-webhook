/**
 * Typed-answer protocol: the model sets "text_input": true in its control JSON when the
 * question needs a typed answer (a name, date, amount, address, description), and the
 * server keeps a hidden marker in the HTML so the UI shows its text box in any language
 * and after a reload. Before this the UI guessed from the English "Question N:" label.
 *
 * The model is told about the flag only when JOLLYJI_TEXT_INPUT_PROTOCOL=true (deploy ≠
 * enable); the flag and marker are honoured whenever they appear.
 */

export const TEXT_INPUT_MARKER_HTML = '<span hidden data-ej-text-input="true"></span>';

export const TEXT_INPUT_MARKER_RE = /data-ej-text-input\s*=\s*["']?(?:1|true|yes)["']?/i;

export function isTextInputProtocolEnabled() {
  const v = String(process.env.JOLLYJI_TEXT_INPUT_PROTOCOL || "").trim().toLowerCase();
  return v === "true" || v === "1";
}

/** Inject a hidden text-input marker so frontend/history work in any language. */
export function applyTextInputDisplayMarker(html, textInput) {
  const text = String(html || "");
  if (!textInput || !text.trim()) return text;
  if (TEXT_INPUT_MARKER_RE.test(text)) return text;
  return `${text.trimEnd()}${TEXT_INPUT_MARKER_HTML}`;
}

export function textInputProtocolRule() {
  return [
    "=== JOLLYJI INPUT RULE ===",
    'In the JSON control block of every reply, also set "text_input".',
    '"text_input": true when your reply asks a question the user must answer by typing (a name, date, amount, address, number or description) and offers no lettered options to choose from.',
    '"text_input": false when the reply offers options to choose from, is a batch form ("batch_form": true), asks for an upload, asks for payment, or asks no question (advice, a document, the end of the session).',
  ].join("\n");
}

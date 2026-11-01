/**
 * Typed-answer protocol: the model sets "text_input": true in its control JSON when the
 * question needs a typed answer (a name, date, amount, address, description), and the
 * server keeps a hidden marker in the HTML so the UI shows its text box in any language
 * and after a reload. Before this the UI guessed from the English "Question N:" label.
 *
 * The model is told about the flag only when JOLLYJI_TEXT_INPUT_PROTOCOL=true (deploy ≠
 * enable); the flag and marker are honoured whenever they appear. Gemini often copies the
 * prompt's own JSON template and leaves the key out, so with the flag on the server also
 * infers it (resolveTextInput) from language-agnostic signals.
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

/**
 * The prompts say "append exactly one JSON object … with this exact schema", so Gemini leaves
 * out any key the schema lacks. Add "text_input" to each schema, and "text_input": false to
 * the single-line examples for upload / payment / end turns (where it is always false).
 */
export function addTextInputToTemplates(text) {
  return String(text ?? "")
    .replace(
      /"payment_required": true or false(,?)/g,
      '"payment_required": true or false,\n  "text_input": true or false$1'
    )
    .replace(/\{"upload_required"[^{}\n]*\}/g, (obj) =>
      obj.includes('"text_input"') ||
      !/"(?:upload_required|payment_required|session_terminated)":\s*true/.test(obj)
        ? obj
        : obj.replace(/\s*\}$/, ', "text_input": false}')
    );
}

export function textInputProtocolRule() {
  return [
    "=== JOLLYJI INPUT RULE (applies to every reply, in every language) ===",
    'Every JSON control block you output MUST include the key "text_input" (true or false), in addition to the keys shown in the examples above.',
    '"text_input": true when the user has to type the answer: a name, details, a date, an amount, an address, a PAN or ID number, an email, a phone number or a description — including "Please provide the following details…" requests and re-asks after an invalid answer — and the question offers no lettered options to choose from.',
    '"text_input": false when the reply offers lettered options to choose from, is a batch form ("batch_form": true), asks for an upload, asks for payment, or asks no question (advice, a document, the end of the session).',
    "Decide by what the user must do, not by the language of the reply.",
  ].join("\n");
}

// Lettered options in any script: "(a)", "(क)", or "a)" at a line start — two or more.
const LETTERED_OPTION_RE = /(?:\(\s*\p{L}\s*\)|(?:^|\n|<br\s*\/?>|<p>|<li>)\s*\p{L}\s*\))/gu;
// The reply asks something: a question mark (Latin, Arabic/Urdu, full-width) or a
// numbered question label in any script ("Question 2:", "प्रश्न 2:", "প্রশ্ন ২:", "سوال 2:").
const ASKS_RE = /[?？؟]|(?:^|\n|>)\s*[\p{L}\p{M}]+\s+\p{Nd}+\s*[:：]/u;

function visibleText(html) {
  return String(html || "").replace(/<span\s+hidden[^>]*>\s*<\/span>/gi, "");
}

/**
 * Typed answer for this turn: the model's flag, or — protocol on — a turn that asks
 * something, offers no lettered options, and is not a form, upload, payment or end.
 */
export function resolveTextInput(info, cleanMessage) {
  if (!info) return false;
  // A form, option list, upload, payment or end has its own UI, whatever the model said
  // (live: Gemini also set text_input on batch forms).
  if (info.multiSelect || info.batchForm || info.requiresUpload || info.paymentRequired) return false;
  if (info.sessionTerminated || info.guestSignupOffer) return false;
  if (info.textInput) return true;
  if (!isTextInputProtocolEnabled()) return false;
  const text = visibleText(cleanMessage);
  if (!ASKS_RE.test(text)) return false;
  return (text.match(LETTERED_OPTION_RE) || []).length < 2;
}

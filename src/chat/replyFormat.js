import { stripControlJsonFromDisplay } from "./messageControlParse.js";
import {
  normalizeLanguageSelectionHtml,
  LANGUAGE_LIST_MARKERS,
} from "./languageSelectionDisplay.js";

/**
 * User-visible stream text only — strips partial/final control JSON before formatting.
 * Never send raw model buffer to SSE.
 */
export function streamDisplayFromRaw(rawText) {
  if (!rawText) return "";

  let t = String(rawText);
  t = t.replace(/```json[\s\S]*$/gi, "").trim();
  t = stripControlJsonFromDisplay(t);
  if (!t.trim()) return "";

  // Hide trailing JSON fragment start while model is still streaming.
  t = t.replace(/\s*\{\s*"?[\w_]*"?\s*:?\s*$/g, "").trim();
  if (!t.trim()) return "";

  t = normalizeQaDisplayHtml(t);
  return stripControlJsonFromDisplay(t);
}

/** Formatting safe to apply on every stream chunk (stable layout, no Question headers). */
export function normalizeStreamDisplayHtml(text) {
  if (!text) return "";

  let t = stripControlJsonFromDisplay(text).trim();
  if (!t) return t;

  t = t.replace(/(\r?\n\s*){3,}/g, "\n\n");
  t = t.replace(/(<br\s*\/?>\s*){3,}/gi, "<br><br>");

  if (!/<br[^>]*>\s*\([a-z]\)/i.test(t)) {
    t = t.replace(/\s+\(([a-z])\)\s+/gi, "<br>($1) ");
  }

  t = t.replace(/\s*(Mandatory:)/g, "<br><br><strong>$1</strong>");
  t = t.replace(/\s*(Optional:)/g, "<br><br><strong>$1</strong>");

  if (t.includes("\n") && !/<br\s*\/?>/i.test(t)) {
    t = t.replace(/\r\n/g, "\n").replace(/\n\n+/g, "<br><br>").replace(/\n/g, "<br>");
  }

  t = normalizeLanguageSelectionHtml(t);
  return stripControlJsonFromDisplay(t);
}

/**
 * Light post-process for Q&A turns when the model omits HTML from instructions.
 * Skips final-document output entirely — each assistant prompt defines its own
 * Category 2 / FINAL DOCUMENT OUTPUT FORMAT; the server does not reshape those.
 */
export function normalizeQaDisplayHtml(text, { documentReady = false } = {}) {
  if (!text || documentReady) return text || "";

  let t = normalizeStreamDisplayHtml(text);
  if (!t) return t;
  if (t.length > 12_000) return t;

  const hasNumberedQuestion = /Question\s+\d+/i.test(t);
  const looksLikeQa =
    hasNumberedQuestion ||
    /\([a-z]\)\s/.test(t) ||
    /Mandatory:/i.test(t) ||
    /Please select a language/i.test(t) ||
    LANGUAGE_LIST_MARKERS.test(t);

  if (!looksLikeQa) return t;

  if (hasNumberedQuestion && !/<h5/i.test(t)) {
    t = t.replace(
      /Question\s+(\d+):\s*/gi,
      "<h5><strong>Question $1:</strong></h5>"
    );
  }

  t = t.replace(
    /<h5>\s*<strong>\s*Question\s*:?\s*<\/strong>\s*<\/h5>/gi,
    ""
  );
  t = t.replace(/(^|\n)\s*Question\s*:\s*(?!\d)/gi, "$1");

  t = t.replace(
    /\[Explanation to the user:\s*([^\]]+)\]/gi,
    "<em>$1</em>"
  );

  if (!/<br[^>]*>\s*\([a-z]\)/i.test(t)) {
    t = t.replace(/\s+\(([a-z])\)\s+/gi, "<br>($1) ");
  }

  if (/^\d+\.\s/m.test(t) && !/<br/i.test(t)) {
    t = t.replace(/(\d+\.\s)/g, "<br>$1");
  }

  t = t.replace(
    /\s*(Which optional information would you like to continue\?)/gi,
    "<br><br>$1"
  );

  if (!/<br/i.test(t) && /\n/.test(t)) {
    t = t.replace(/\n\n+/g, "<br><br>").replace(/\n/g, "<br>");
  } else if (!/<br/i.test(t)) {
    t = t.replace(/([.!?])\s+(?=[A-Z(])/g, "$1<br><br>");
  }

  return t.trim();
}

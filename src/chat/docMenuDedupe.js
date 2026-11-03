/**
 * A document generated once in a session is never offered again (Sahil 2026-11-03; F&F last-pick
 * walk: the third "Which document…" menu re-offered the Formal Notice generated first, the user
 * paid, and only then was told it was already generated).
 *
 * Stateless: the generated titles are read from the session's own earlier document replies, so
 * nothing new is stored. JOLLYJI_NO_REPEAT_DOCS, off by default.
 */
import { isDocumentLikeText } from "./messageControlParse.js";

export const isNoRepeatDocsEnabled = () =>
  String(process.env.JOLLYJI_NO_REPEAT_DOCS || "").toLowerCase() === "true";

const MENU_RE = /which document (?:do you wish|would you like) to generate/i;
const STOP = new Set(["the", "and", "for", "your", "with", "from", "this"]);

const plainLines = (html) =>
  String(html || "")
    .replace(/<br\s*\/?>|<\/(?:p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .split("\n")
    .map((l) => l.replace(/[*#:]+/g, " ").trim())
    .filter(Boolean);

const words = (s) =>
  new Set(
    String(s)
      .toLowerCase()
      .match(/[a-z]+/g)
      ?.filter((w) => w.length > 2 && !STOP.has(w)) || []
  );

/** First line of every earlier document reply ("Notice to Employer", "Police Complaint", …). */
export function generatedDocTitles(messages = []) {
  return messages
    .filter((m) => m?.role === "assistant" && isDocumentLikeText(m.content))
    .map((m) => plainLines(m.content)[0])
    .filter(Boolean);
}

/** Every word of the menu label is in the title (or the other way round). */
function sameDoc(label, title) {
  const a = words(label);
  const b = words(title);
  if (!a.size || !b.size) return false;
  const inB = [...a].every((w) => b.has(w));
  const inA = [...b].every((w) => a.has(w));
  return inB || inA;
}

/**
 * Drop "(x) <label>" lines after a "Which document…" heading when that document was already
 * generated. Leaves the reply unchanged if it is not a document menu, or if no option would remain.
 */
export function dropGeneratedDocOptions(html, titles) {
  const text = String(html || "");
  const at = text.search(MENU_RE);
  if (at < 0 || !titles?.length) return { html: text, dropped: [] };
  const head = text.slice(0, at);
  const menu = text.slice(at);
  const OPTION_RE = /(^|<br\s*\/?>|\n|<p>|<li>|<\/h[1-6]>|<\/p>|<\/div>)(\s*\([a-z]\)\s*)([^<\n]+)(?:<\/p>|<\/li>)?/gi;
  const options = [...menu.matchAll(OPTION_RE)];
  const dropped = options.filter((m) => titles.some((t) => sameDoc(m[3].replace(/&amp;/g, "&"), t)));
  if (!dropped.length || dropped.length === options.length) return { html: text, dropped: [] };
  let out = menu;
  for (const m of dropped) out = out.replace(m[0], /^<(p|li)>$/i.test(m[1]) ? "" : m[1]);
  out = out.replace(/(<br\s*\/?>\s*){2,}/gi, "<br>").replace(/\n{2,}/g, "\n");
  return { html: head + out, dropped: dropped.map((m) => m[3].trim()) };
}

/**
 * A document reply that ends with the closing thank-you and asks nothing is the last document:
 * the chat ends there (F&F last-pick walk 2026-11-03: the third document came with the closing
 * line but session_terminated false; "Continue" then charged again for the same document).
 */
export function endsWithClosingAfterDocument(html) {
  const text = String(html || "");
  if (!isDocumentLikeText(text)) return false;
  const plain = plainLines(text).join("\n");
  const at = plain.search(/thank you for using www\./i);
  if (at < 0 || plain.length - at > 400) return false;
  const after = plain.slice(at);
  return !/\?/.test(after) && !/\([a-z]\)\s*\S/i.test(after);
}

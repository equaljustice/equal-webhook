/**
 * Single canonical language-selection message for all assistants (guest + logged-in).
 */

export const LANGUAGE_PROMPT_HEADING = "Please select a language:";

export const LANGUAGE_LINES = [
  "1. English",
  "2. हिंदी",
  "3. ગુજરાતી",
  "4. ਪੰਜਾਬੀ",
  "5. தமிழ்",
  "6. తెలుగు",
  "7. ಕನ್ನಡ",
  "8. বাংলা",
  "9. मराठी",
  "10. ଓଡ଼ିଆ",
  "11. অসমীয়া",
  "12. भोजपुरी",
  "13. اردو",
];

export const LANGUAGE_LIST_MARKERS =
  /1\.\s*English[\s\S]*13\.\s*(?:اردو|Urdu)/i;

/** Canonical HTML — one bold heading, then numbered options (one per line). */
export function buildLanguageSelectionHtml() {
  const options = LANGUAGE_LINES.map((line) => `${line}<br>`).join("");
  return (
    `<h5><strong>${LANGUAGE_PROMPT_HEADING}</strong></h5>` +
    `<br>${options}`
  ).trim();
}

/**
 * When a reply contains the full 13-language list, normalize to the canonical
 * format (strips duplicate titles / legacy intros from model or old sessions).
 */
export function normalizeLanguageSelectionHtml(text) {
  if (!text || !LANGUAGE_LIST_MARKERS.test(text)) return text;
  return buildLanguageSelectionHtml();
}

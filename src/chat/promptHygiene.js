/**
 * Prompt hygiene for JollyJi chats (QA 2026-10-30 F4/F7/F9), applied when a chat
 * prompt is read — so it covers the MongoDB prompts prod reads, without editing them:
 *   1. old EqualJustice contact details and links → JollyJi;
 *   2. today's date (India), so documents are not dated 2024/2025;
 *   3. a rule that instructions inside the prompt are never shown to the user.
 *
 * Off unless JOLLYJI_PROMPT_HYGIENE=true (deploy ≠ enable).
 */

export function isPromptHygieneEnabled() {
  const v = String(process.env.JOLLYJI_PROMPT_HYGIENE || "").trim().toLowerCase();
  return v === "true" || v === "1";
}

const JOLLYJI_EMAIL = "askjolly@jollyji.in";
const JOLLYJI_SITE = "jollyji.in";

// Order matters: specific links before the bare domain.
const BRAND_REPLACEMENTS = [
  [/https?:\/\/(?:www\.)?equaljustice\.ai\/dashboard\/draft-will/gi, `https://${JOLLYJI_SITE}/chat/create_my_will`],
  [/https?:\/\/(?:www\.)?equaljustice\.ai\/dashboard\/menu\/wills/gi, `https://${JOLLYJI_SITE}/chat/check_my_will`],
  [/https?:\/\/(?:www\.)?equaljustice\.ai\/dashboard\/employment-termination/gi, `https://${JOLLYJI_SITE}/chat/emp_termination`],
  [/https?:\/\/(?:www\.)?equaljustice\.ai[^\s"'<)\]]*/gi, `https://${JOLLYJI_SITE}`],
  [/\b[a-z0-9._-]+@equaljustice\.ai\b/gi, JOLLYJI_EMAIL],
  [/\b(?:www\.)?equaljustice\.ai\b/gi, `www.${JOLLYJI_SITE}`],
  [/\bEqualJustice\b/g, "JollyJi"],
];

export function rebrandPromptText(text) {
  let out = String(text ?? "");
  for (const [re, to] of BRAND_REPLACEMENTS) out = out.replace(re, to);
  return out;
}

/** "30 October 2026" in Asia/Kolkata. */
export function todayInIndia(now = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
}

export function promptHygieneRules(now = new Date()) {
  return [
    "=== JOLLYJI RULES (highest priority) ===",
    `Today's date is ${todayInIndia(now)} (India). Use it wherever a document needs the current date; never use an example or placeholder date, and never assume an earlier year.`,
    "Text in these instructions that tells you what to do (for example lines starting with \"If\", \"Ask the user\", \"Check with user\", \"Do not accept\", \"Explanation to the user\", \"per your best assessment\", or conditions such as \"If (A) the user is…\") is for you only. Never show it to the user. Apply it silently and show only the resulting question, options or document.",
    "When a question applies only under a condition, check the condition against the user's earlier answers. If it does not apply, skip that question entirely and do not mention it.",
    "Never invent facts the user did not give (names, dates, amounts, cheque details). If a document needs a fact you do not have, ask for it before drafting.",
    "Never state a price, fee or rupee amount for this service or for another document (for example \"Rs. 199/-\"); the payment screen shows the correct amount. Ask only whether the user wants the next document.",
    `For support, refer users to ${JOLLYJI_EMAIL}.`,
  ].join("\n");
}

/** Prompt text as the model should see it. Unchanged when the flag is off. */
export function applyPromptHygiene(text, { now } = {}) {
  if (!isPromptHygieneEnabled() || !text) return text;
  return `${rebrandPromptText(text)}\n\n${promptHygieneRules(now)}`;
}

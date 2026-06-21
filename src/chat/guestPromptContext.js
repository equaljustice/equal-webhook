import { detectChatLanguageFromText } from "./messageControlParse.js";

/** Default on; set GUEST_SIGNUP_OFFER_ENABLED=false to disable. */
export function isGuestSignupOfferEnabled() {
  const v = process.env.GUEST_SIGNUP_OFFER_ENABLED;
  if (v === "false" || v === "0") return false;
  return true;
}

const LANGUAGE_CHOICE_PATTERNS = [
  ["en", /^(?:1\.?\s*)?(?:english)\b/i],
  ["hi", /^(?:2\.?\s*)?(?:hindi|हिंदी)\b/i],
  ["gu", /^(?:3\.?\s*)?(?:gujarati|ગુજરાતી)\b/i],
  ["pa", /^(?:4\.?\s*)?(?:punjabi|ਪੰਜਾਬੀ)\b/i],
  ["ta", /^(?:5\.?\s*)?(?:tamil|தமிழ்)\b/i],
  ["te", /^(?:6\.?\s*)?(?:telugu|తెలుగు)\b/i],
  ["kn", /^(?:7\.?\s*)?(?:kannada|ಕನ್ನಡ)\b/i],
  ["bn", /^(?:8\.?\s*)?(?:bengali|bangla|বাংলা)\b/i],
  ["mr", /^(?:9\.?\s*)?(?:marathi|मराठी)\b/i],
  ["or", /^(?:10\.?\s*)?(?:odia|odiya|ଓଡ଼ିଆ)\b/i],
  ["as", /^(?:11\.?\s*)?(?:assamese|অসমীয়া)\b/i],
  ["bho", /^(?:12\.?\s*)?(?:bhojpuri|भोजपुरी)\b/i],
  ["ur", /^(?:13\.?\s*)?(?:urdu|اردو)\b/i],
];

const NUMBER_TO_LANG = {
  "1": "en",
  "2": "hi",
  "3": "gu",
  "4": "pa",
  "5": "ta",
  "6": "te",
  "7": "kn",
  "8": "bn",
  "9": "mr",
  "10": "or",
  "11": "as",
  "12": "bho",
  "13": "ur",
};

/** Detect when the user message is a language-selection reply. */
export function detectLanguageChoiceFromUserMessage(text = "") {
  const s = String(text).trim();
  if (!s) return null;

  const fromScript = detectChatLanguageFromText(s);
  if (fromScript !== "en") return fromScript;

  for (const [code, pattern] of LANGUAGE_CHOICE_PATTERNS) {
    if (pattern.test(s)) return code;
  }

  const num = s.replace(/\.$/, "");
  if (NUMBER_TO_LANG[num]) return NUMBER_TO_LANG[num];

  return null;
}

/**
 * Append guest-only overlay to system instructions (Gemini) or additional_instructions (OpenAI).
 */
export function appendGuestSystemInstruction(baseText = "", session = {}) {
  if (!isGuestSignupOfferEnabled()) {
    return baseText || "";
  }

  const response = session.signupOfferResponse || null;
  let statusBlock = "";

  if (response === "declined") {
    statusBlock =
      "\nThe user already chose to CONTINUE AS GUEST. Do NOT emit guest_signup_offer JSON again. " +
      "Proceed with your normal post-language greeting and Q&A from your main instructions.";
  } else if (response === "accepted") {
    statusBlock =
      "\nThe user chose to log in or sign up via the chat UI. Do not repeat the signup offer.";
  } else if (response === "pending" && session.signupOfferShown) {
    statusBlock =
      "\nYou already showed the guest signup offer. Wait for the user to use the on-screen buttons " +
      "or to say they want to continue as guest before resuming the normal flow.";
  } else {
    statusBlock =
      "\nWhen the user has JUST selected their language (language choice, not a numbered legal answer), " +
      "your VERY NEXT reply MUST:\n" +
      "1) Briefly explain guest mode: this chat is kept about 24 hours without login; logging in saves chats to their account.\n" +
      "2) Ask if they want to log in / sign up now OR continue as guest.\n" +
      "3) End with a separate final line containing ONLY valid JSON:\n" +
      '   {"guest_signup_offer":true,"selected_language":"<en|hi|gu|...>"}\n' +
      "After they clearly continue as guest, proceed with your normal post-language greeting from your main instructions.";
  }

  const addendum =
    "\n\n=== GUEST MODE (overlay — follow with your main instructions) ===\n" +
    "The user is NOT logged in. Sessions expire in about 24 hours on this device unless they log in.\n" +
    "Follow LANGUAGE SELECTION from your main instructions first when no language is set yet.\n" +
    statusBlock;

  return (baseText || "") + addendum;
}

export function applyGuestSignupOfferFromReply(session, uploadInfo, userMessage) {
  if (!session || !uploadInfo) return;

  const lowerUser = String(userMessage || "").trim().toLowerCase();
  if (
    session.signupOfferResponse === "pending" &&
    /^(continue as guest|continue|proceed|go ahead|guest)$/i.test(lowerUser)
  ) {
    session.signupOfferResponse = "declined";
  }

  const langFromUser = detectLanguageChoiceFromUserMessage(userMessage);
  if (langFromUser && !session.selectedLanguage) {
    session.selectedLanguage = langFromUser;
  }

  if (uploadInfo.selectedLanguage) {
    session.selectedLanguage = uploadInfo.selectedLanguage;
  }

  if (uploadInfo.guestSignupOffer) {
    session.signupOfferShown = true;
    if (!session.signupOfferResponse) {
      session.signupOfferResponse = "pending";
    }
  }
}

export function guestSignupOfferResponseFields(session, uploadInfo) {
  const offerThisTurn = !!(uploadInfo && uploadInfo.guestSignupOffer);
  const pending =
    session?.signupOfferResponse === "pending" && session?.signupOfferShown === true;

  return {
    guestSignupOffer: offerThisTurn,
    guestSignupOfferPending: pending,
    signupOfferResponse: session?.signupOfferResponse || null,
    selectedLanguage: session?.selectedLanguage || null,
  };
}

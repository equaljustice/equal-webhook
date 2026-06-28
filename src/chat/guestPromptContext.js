import { detectChatLanguageFromText } from "./messageControlParse.js";
import {
  GUEST_FLOW_PHASE,
  isAwaitingGuestChoice,
  isGuestLanguagePhase,
  markGuestFlowActive,
  guestOfferOverlayForPhase,
} from "./guestSessionGuards.js";

/** Default on; set GUEST_SIGNUP_OFFER_ENABLED=false to disable. */
export function isGuestSignupOfferEnabled() {
  const v = process.env.GUEST_SIGNUP_OFFER_ENABLED;
  if (v === "false" || v === "0") return false;
  return true;
}

/** Ensure guest signup UI only after the user picked a language (never from model JSON alone). */
export function promoteGuestSignupOfferState(session) {
  if (!session || !isGuestSignupOfferEnabled()) return;
  if (!session.languageConfirmedByUser) return;
  if (!isAwaitingGuestChoice(session)) return;
  if (
    session.signupOfferResponse === "declined" ||
    session.signupOfferResponse === "accepted"
  ) {
    return;
  }
  session.signupOfferShown = true;
  session.signupOfferResponse = "pending";
  session.guestFlowPhase = GUEST_FLOW_PHASE.GUEST_OFFER;
}

function applyUserLanguageChoice(session, lang) {
  if (!session || !lang) return;
  session.selectedLanguage = lang;
  session.languageConfirmedByUser = true;
  if (!session.answers) session.answers = {};
  session.answers.language = lang;
  session.guestFlowPhase = GUEST_FLOW_PHASE.GUEST_OFFER;
  promoteGuestSignupOfferState(session);
}

/**
 * Server-side updates before each model turn (language pick, guest continue, etc.).
 */
export function applyPreTurnSessionUpdates(session, userMessage) {
  if (!session) return;

  const lang = detectLanguageChoiceFromUserMessage(userMessage);
  if (lang && !session.languageConfirmedByUser) {
    applyUserLanguageChoice(session, lang);
  }

  const m = String(userMessage || "").trim().toLowerCase();

  if (isAwaitingGuestChoice(session)) {
    if (/^(b|continue as guest|continue as a guest)$/i.test(m)) {
      session.signupOfferResponse = "declined";
      markGuestFlowActive(session);
    } else if (/^(a|log in|login|sign up|signup|sign-up)$/i.test(m)) {
      session.signupOfferResponse = "accepted";
      session.guestFlowPhase = GUEST_FLOW_PHASE.ACTIVE;
    } else if (
      m.length > 20 &&
      !detectLanguageChoiceFromUserMessage(userMessage)
    ) {
      markGuestFlowActive(session);
    }
  }
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

  const statusBlock = guestOfferOverlayForPhase(session);

  const addendum =
    "\n\n=== GUEST MODE (overlay — follow with your main instructions) ===\n" +
    "The user is NOT logged in. Sessions expire in about 24 hours on this device unless they log in.\n" +
    statusBlock;

  return (baseText || "") + addendum;
}

export function applyGuestSignupOfferFromReply(session, uploadInfo, userMessage) {
  if (!session || !uploadInfo) return;

  const lowerUser = String(userMessage || "").trim().toLowerCase();
  if (
    isAwaitingGuestChoice(session) &&
    /^(b|continue as guest|continue as a guest)$/i.test(lowerUser)
  ) {
    session.signupOfferResponse = "declined";
    markGuestFlowActive(session);
  }

  const langFromUser = detectLanguageChoiceFromUserMessage(userMessage);
  if (langFromUser && !session.languageConfirmedByUser) {
    applyUserLanguageChoice(session, langFromUser);
  }

  if (uploadInfo.guestSignupOffer && session.languageConfirmedByUser) {
    if (
      session.signupOfferResponse === "declined" ||
      session.guestFlowPhase === GUEST_FLOW_PHASE.ACTIVE
    ) {
      uploadInfo.guestSignupOffer = false;
      return;
    }
    session.signupOfferShown = true;
    if (!session.signupOfferResponse) {
      session.signupOfferResponse = "pending";
      session.guestFlowPhase = GUEST_FLOW_PHASE.GUEST_OFFER;
    }
  } else if (uploadInfo.guestSignupOffer && !session.languageConfirmedByUser) {
    uploadInfo.guestSignupOffer = false;
  }
}

export function guestSignupOfferResponseFields(session) {
  const declined =
    session?.signupOfferResponse === "declined" ||
    session?.signupOfferResponse === "accepted" ||
    session?.guestFlowPhase === GUEST_FLOW_PHASE.ACTIVE;

  const pending =
    isGuestSignupOfferEnabled() &&
    !declined &&
    !!session?.languageConfirmedByUser &&
    isAwaitingGuestChoice(session);

  return {
    guestSignupOffer: false,
    guestSignupOfferPending: pending,
    guestFlowPhase: resolveGuestFlowPhaseForClient(session),
    signupOfferResponse: session?.signupOfferResponse || null,
    selectedLanguage: session?.languageConfirmedByUser
      ? session?.selectedLanguage || null
      : null,
    languageConfirmedByUser: !!session?.languageConfirmedByUser,
    guestOfferAwaitingResponse:
      !declined &&
      !!session?.languageConfirmedByUser &&
      isAwaitingGuestChoice(session),
  };
}

function resolveGuestFlowPhaseForClient(session) {
  if (isGuestLanguagePhase(session)) return GUEST_FLOW_PHASE.LANGUAGE;
  if (isAwaitingGuestChoice(session)) return GUEST_FLOW_PHASE.GUEST_OFFER;
  return GUEST_FLOW_PHASE.ACTIVE;
}

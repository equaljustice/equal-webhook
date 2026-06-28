/**
 * Hard guards for guest signup offer — must not interrupt legal Q&A.
 */

const GUEST_OFFER_SNIPPETS = [
  /It looks like you're not logged in[\s\S]*?(?=\n\n|$)/gi,
  /It looks like you're continuing as a guest[\s\S]*?(?=\n\n|$)/gi,
  /Your session will expire in about 24 hours[\s\S]*?(?=\n\n|$)/gi,
  /This chat will be kept for about 24 hours[\s\S]*?(?=\n\n|$)/gi,
  /Would you like to log in\s*\/\s*sign up now[\s\S]*?Continue as guest\)?/gi,
  /\(a\)\s*Log in\s*\/\s*Sign up\s*\n?\s*\(b\)\s*Continue as guest/gi,
  /\(a\)\s*Log in\s*\/\s*Sign up[\s\S]*?\(b\)\s*Continue as guest/gi,
];

export const GUEST_FLOW_PHASE = {
  LANGUAGE: "language",
  GUEST_OFFER: "guest_offer",
  ACTIVE: "active",
};

/** Quick-pick disabled — language and guest choices are typed in chat only. */
export const GUEST_LANGUAGE_FLOW_OPTIONS = [];

export function isGuestLanguagePhase(session) {
  return resolveGuestFlowPhase(session) === GUEST_FLOW_PHASE.LANGUAGE;
}

export function resolveGuestFlowPhase(session) {
  if (!session) return GUEST_FLOW_PHASE.LANGUAGE;
  if (session.guestFlowPhase === GUEST_FLOW_PHASE.ACTIVE) {
    return GUEST_FLOW_PHASE.ACTIVE;
  }
  if (
    session.signupOfferResponse === "declined" ||
    session.signupOfferResponse === "accepted"
  ) {
    return GUEST_FLOW_PHASE.ACTIVE;
  }
  if (!session.languageConfirmedByUser) {
    return GUEST_FLOW_PHASE.LANGUAGE;
  }
  return GUEST_FLOW_PHASE.GUEST_OFFER;
}

/** True only between language selection and guest login/guest choice. */
export function isAwaitingGuestChoice(session) {
  return resolveGuestFlowPhase(session) === GUEST_FLOW_PHASE.GUEST_OFFER;
}

export function markGuestFlowActive(session) {
  session.guestFlowPhase = GUEST_FLOW_PHASE.ACTIVE;
  session.signupOfferResponse = session.signupOfferResponse || "declined";
}

export function stripGuestOfferBoilerplate(text = "") {
  if (!text) return text;
  let out = text;
  for (const pattern of GUEST_OFFER_SNIPPETS) {
    out = out.replace(pattern, "").trim();
  }
  return out.replace(/(<br\s*\/?>\s*){3,}/gi, "<br><br>").trim();
}

/**
 * Block model from re-triggering guest signup after user continued as guest.
 */
export function enforceGuestOfferGuards(session, uploadInfo = {}) {
  const corrected = { ...uploadInfo };
  const phase = resolveGuestFlowPhase(session);

  if (phase === GUEST_FLOW_PHASE.ACTIVE || session.signupOfferResponse === "declined") {
    if (corrected.guestSignupOffer) {
      corrected.guestSignupOffer = false;
      corrected.violations = [...(corrected.violations || []), "guest_offer_after_declined"];
    }
  }

  if (corrected.guestSignupOffer && phase !== GUEST_FLOW_PHASE.GUEST_OFFER) {
    corrected.guestSignupOffer = false;
    corrected.violations = [...(corrected.violations || []), "guest_offer_out_of_phase"];
  }

  if (corrected.violations?.length) {
    console.warn("[GuestGuard] Blocked guest signup offer", {
      sessionId: session._id || session.guestSessionId,
      phase,
      violations: corrected.violations,
    });
  }

  return corrected;
}

export function guestOfferOverlayForPhase(session) {
  const phase = resolveGuestFlowPhase(session);
  if (phase === GUEST_FLOW_PHASE.LANGUAGE) {
    return (
      "GUEST FLOW STEP 1 — LANGUAGE ONLY. Ask ONLY for language selection. " +
      "Do NOT mention login, signup, or 24-hour retention."
    );
  }
  if (phase === GUEST_FLOW_PHASE.GUEST_OFFER) {
    if (session.guestOfferQuestionShown) {
      return (
        "GUEST FLOW — guest offer already shown. Wait for user to answer (a) or (b). " +
        "Do NOT repeat the login/guest question."
      );
    }
    return (
      "GUEST FLOW STEP 2 — SIGNUP OFFER (shown in app UI modal, NOT in chat). " +
      "Do NOT output login/guest text or (a)/(b) options in chat. Wait silently until guest_flow.signup_response is set."
    );
  }
  return (
    "GUEST FLOW COMPLETE — user is in legal Q&A. NEVER mention login, signup, " +
    "24-hour retention, or guest_signup_offer again. Never re-ask language."
  );
}

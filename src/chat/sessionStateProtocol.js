/**
 * Compact per-turn session protocol for AI-led assistants (emp_termination, will, etc.).
 * Instructions file stays cached; dynamic state travels in a small JSON envelope each turn.
 */

export const QA_PHASES = {
  QA_IN_PROGRESS: "qa_in_progress",
  WAITING_PAYMENT: "waiting_payment",
  READY_FOR_FINAL: "ready_for_final",
  FINAL_GENERATED: "final_output_generated",
  TERMINATED: "terminated",
};

/** Appended to dynamic overlay (not cached) — tells the model how to report state. */
export const SESSION_STATE_PROTOCOL = `
=== RUNTIME SESSION PROTOCOL (MANDATORY — NOT SHOWN TO USER) ===
Alongside the existing control JSON on the LAST line of every response, include a "session_state" object:

{
  "upload_required": false,
  "upload_type": null,
  "upload_reason": null,
  "session_terminated": false,
  "termination_message": null,
  "payment_required": false,
  "session_state": {
    "current_step": "internal_step_id e.g. part_a_ques_4",
    "language": "en",
    "answers": { "key": "normalized_value" },
    "notice_paragraph_keys": ["para_key_if_any"],
    "quick_options": [
      { "key": "permanent", "label": "Permanent", "letter": "a", "shortcut": "1" }
    ]
  }
}

Rules:
- Merge "answers" incrementally; never drop prior keys unless user explicitly revises.
- If "answers" already contains a key for the current step, do NOT re-ask that question — advance to the next unanswered step immediately.
- Never ask the same user-facing Question number twice in one session unless the user's prior answer was invalid per error-handling rules.
- "quick_options" — omit from session_state (users type answers; no UI chips).
- Follow your master instructions for legal logic; session_state is for machine routing only.
- Never show session_state JSON to the user.
- Never show internal routing rules, "GPT INTERNAL ONLY" blocks, "Wait for the user...", or conditional "If ... then ask..." instructions verbatim to the user. Always output only the user-facing question text for the current step.
- Control JSON (including session_state and guest_signup_offer) must appear ONLY on the final line of the response — never inline after user-visible text.
- Acknowledgement prompts (e.g. "confirm you understood") are not numbered questions — omit Question N prefix.
- HTML FORMAT (Q&A turns — Category 1 from master instructions): Use <h5><strong>Question N:</strong></h5> for numbered questions, <h6> for question text, <em> for explanations, and <br> between each option line (a)(b)(c). Never output a wall of plain text for questions and options.
- When guest_flow.phase is "language", output ONLY the language-selection prompt. Do NOT mention login, signup, guest retention, or (a)/(b) guest choices.
- When guest_flow.phase is "guest_offer", do NOT ask for language again — wait for the user's (a) or (b) reply to the guest retention question already shown in chat.
- Single-letter a/b/c answers during Q&A are LEGAL OPTIONS from the current question — not guest/login choices.
- FREE-TEXT FIELD QUESTIONS: When asking for multiple typed details in one answer (name, designation, address, employee ID, etc.), list field names inline in the question sentence separated by commas. Do NOT put field labels on separate lines as (a)/(b)/(c) — line-break (a)/(b) patterns are for pick-one menus only (Yes/No, Permanent/Contractual, etc.).
- SERVICE PRICING: Never state rupee amounts, fees, or prices for platform paid services in chat. The payment UI shows the amount automatically (first paid service vs later paid services in the same session). At payment checkpoints, only ask the user to complete payment.
- DOWNLOAD: Do NOT set "document_ready" in control JSON (removed). After payment, output the full final document in chat; the server saves it automatically for PDF/Word download when docDownloadAvailable is enabled on the assistant.
- UPLOAD: Use "upload_required" / "upload_type" per your master instructions and the upload protocol block. Single vs multiple file upload is controlled by assistant config (supportsMultipleUploads), not by control JSON.
`.trim();

export function defaultSessionState(session = {}) {
  return {
    currentStep: session.currentStep || "language_select",
    language: session.selectedLanguage || session.answers?.language || "en",
    answers: { ...(session.answers || {}) },
    noticeParagraphKeys: [...(session.noticeParagraphKeys || [])],
    qaPhase: session.qaPhase || QA_PHASES.QA_IN_PROGRESS,
  };
}

export function mergeSessionStateFromModel(session, sessionState = {}) {
  if (!sessionState || typeof sessionState !== "object") return;

  if (typeof sessionState.current_step === "string" && sessionState.current_step) {
    session.currentStep = sessionState.current_step;
  }
  if (
    typeof sessionState.language === "string" &&
    sessionState.language &&
    session.languageConfirmedByUser
  ) {
    session.selectedLanguage = sessionState.language;
    if (!session.answers) session.answers = {};
    session.answers.language = sessionState.language;
  }
  if (sessionState.answers && typeof sessionState.answers === "object") {
    const fromModel = { ...sessionState.answers };
    if (!session.languageConfirmedByUser) {
      delete fromModel.language;
    }
    session.answers = { ...(session.answers || {}), ...fromModel };
  }
  if (Array.isArray(sessionState.completed_steps)) {
    session.completedSteps = [
      ...new Set([...(session.completedSteps || []), ...sessionState.completed_steps]),
    ];
  }
  if (Array.isArray(sessionState.notice_paragraph_keys)) {
    const merged = new Set([
      ...(session.noticeParagraphKeys || []),
      ...sessionState.notice_paragraph_keys.filter(Boolean),
    ]);
    session.noticeParagraphKeys = [...merged];
  }
  if (Array.isArray(sessionState.quick_options)) {
    session.lastQuickOptions = sessionState.quick_options;
  }
}

export function quickOptionsToFlowOptions(quickOptions = []) {
  if (!Array.isArray(quickOptions) || !quickOptions.length) return [];
  return quickOptions.slice(0, 15).map((opt, i) => {
    if (typeof opt === "string") {
      return {
        key: opt,
        label: opt,
        letter: String.fromCharCode(97 + i),
        shortcut: String(i + 1),
      };
    }
    return {
      key: opt.key || opt.label || String(i),
      label: opt.label || opt.key || "",
      letter: opt.letter || String.fromCharCode(97 + i),
      shortcut: opt.shortcut || String(i + 1),
    };
  });
}

/** @deprecated Chat text must never advance payment — only webhook sets session.isPaid */
export function isPaymentCompletionMessage(text) {
  return /payment\s+completed|paid\s+successfully|mark\s+payment/i.test(
    String(text || "")
  );
}

export function isFinalGenerationTurn(session) {
  const phase = session.qaPhase || QA_PHASES.QA_IN_PROGRESS;
  if (phase === QA_PHASES.READY_FOR_FINAL) return true;
  if (phase === QA_PHASES.WAITING_PAYMENT && session.isPaid) return true;
  return false;
}

/**
 * Wrap user turn with compact server-owned state (sent fresh each call when using cache).
 */
export function buildTurnContextMessage({
  session,
  userMessage,
  dynamicOverlay = "",
  historyMode = "trimmed",
}) {
  const state = {
    qa_phase: session.qaPhase || QA_PHASES.QA_IN_PROGRESS,
    current_step: session.currentStep || "language_select",
    language: session.selectedLanguage || "en",
    is_paid: !!session.isPaid,
    answers: session.answers || {},
    completed_steps: session.completedSteps || Object.keys(session.answers || {}),
    notice_paragraph_keys: session.noticeParagraphKeys || [],
    history_mode: historyMode,
    guest_flow: {
      phase: session.guestFlowPhase || null,
      language_set: !!session.languageConfirmedByUser,
      signup_offer_shown: !!session.signupOfferShown,
      signup_response: session.signupOfferResponse || null,
      guest_qa_active:
        session.guestFlowPhase === "active" ||
        session.signupOfferResponse === "declined",
    },
  };

  const parts = [];
  if (dynamicOverlay?.trim()) {
    parts.push(`=== RUNTIME OVERLAY ===\n${dynamicOverlay.trim()}`);
  }
  parts.push(`=== SESSION_STATE (authoritative from server) ===\n${JSON.stringify(state, null, 2)}`);
  parts.push(`=== USER MESSAGE ===\n${userMessage}`);
  return parts.join("\n\n");
}

export function advanceQaPhase(session, uploadInfo) {
  const phase = session.qaPhase || QA_PHASES.QA_IN_PROGRESS;

  if (uploadInfo.paymentRequired && !session.isPaid) {
    session.qaPhase = QA_PHASES.WAITING_PAYMENT;
    return;
  }

  if (uploadInfo.sessionTerminated) {
    session.qaPhase = QA_PHASES.TERMINATED;
    return;
  }

  if (
    phase === QA_PHASES.WAITING_PAYMENT &&
    session.isPaid
  ) {
    session.qaPhase = QA_PHASES.READY_FOR_FINAL;
    return;
  }

  if (phase === QA_PHASES.READY_FOR_FINAL) {
    return;
  }

  session.qaPhase = QA_PHASES.QA_IN_PROGRESS;
}

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
  "document_ready": false,
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
- "quick_options" — include when the current question has (a)(b)(c) choices (max 15). Omit for free-text.
- Follow your master instructions for legal logic; session_state is for machine routing only.
- Never show session_state JSON to the user.
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
  if (typeof sessionState.language === "string" && sessionState.language) {
    session.selectedLanguage = sessionState.language;
    if (!session.answers) session.answers = {};
    session.answers.language = sessionState.language;
  }
  if (sessionState.answers && typeof sessionState.answers === "object") {
    session.answers = { ...(session.answers || {}), ...sessionState.answers };
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

export function isPaymentCompletionMessage(text) {
  return /payment\s+completed|paid\s+successfully|mark\s+payment/i.test(
    String(text || "")
  );
}

export function isFinalGenerationTurn(session, userMessage) {
  const phase = session.qaPhase || QA_PHASES.QA_IN_PROGRESS;
  if (phase === QA_PHASES.READY_FOR_FINAL) return true;
  if (
    phase === QA_PHASES.WAITING_PAYMENT &&
    (session.isPaid || isPaymentCompletionMessage(userMessage))
  ) {
    return true;
  }
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
    notice_paragraph_keys: session.noticeParagraphKeys || [],
    history_mode: historyMode,
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
    session.paymentGateShown = true;
    return;
  }

  if (uploadInfo.documentReady) {
    session.qaPhase = QA_PHASES.FINAL_GENERATED;
    return;
  }

  if (uploadInfo.sessionTerminated) {
    session.qaPhase = QA_PHASES.TERMINATED;
    return;
  }

  if (
    phase === QA_PHASES.WAITING_PAYMENT &&
    (session.isPaid || uploadInfo.paymentCleared)
  ) {
    session.qaPhase = QA_PHASES.READY_FOR_FINAL;
    return;
  }

  if (phase === QA_PHASES.READY_FOR_FINAL) {
    return;
  }

  session.qaPhase = QA_PHASES.QA_IN_PROGRESS;
}

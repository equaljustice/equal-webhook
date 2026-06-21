/** Server-owned session phases — LLM must not override these. */
export const FLOW_STATES = {
  QA_IN_PROGRESS: "qa_in_progress",
  WAITING_PAYMENT: "waiting_payment",
  WAITING_UPLOAD: "waiting_upload",
  READY_FOR_FINAL: "ready_for_final_output",
  FINAL_GENERATED: "final_output_generated",
  TERMINATED: "terminated",
};

export const NODE_TYPES = {
  QUESTION: "question",
  MESSAGE: "message",
  ROUTER: "router",
  PAYMENT_GATE: "payment_gate",
  UPLOAD_GATE: "upload_gate",
  FINAL_GENERATE: "final_generate",
  TERMINATE: "terminate",
};

export const PAYMENT_MODES = {
  ONCE: "once",
  REPEATABLE: "repeatable",
};

export const INPUT_TYPES = {
  LANGUAGE_SELECT: "language_select",
  SINGLE_SELECT: "single_select",
  MULTI_SELECT: "multi_select",
  TEXT: "text",
  NUMBER: "number",
  CONFIRMATION: "confirmation",
};

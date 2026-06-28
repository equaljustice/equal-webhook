import { POST_UPLOAD_ANALYSIS_MESSAGE } from "../utils/geminiFileUpload.js";

export function isPostUploadAnalysisMessage(text) {
  return /document(s)? uploaded successfully|please analyze/i.test(
    String(text || "")
  );
}

function assistantKey(session, assistant) {
  return String(session?.assistantKey || assistant?.key || "").toLowerCase();
}

function isCheckMyRentKey(key) {
  return key.includes("check-my-rent") || key.includes("check_my_rent");
}

function isCheckWillKey(key) {
  return (
    key.includes("check_will") ||
    key.includes("check-will") ||
    key.includes("create_my_will") ||
    key.includes("create-my-will") ||
    key.includes("will_instructions")
  );
}

function isSideProjectKey(key) {
  return key.includes("side-project") || key.includes("side_project");
}

function isServiceBondKey(key) {
  return key.includes("service-bond") || key.includes("service_bond");
}

/**
 * User message sent by the client after multipart upload to trigger Gemini analysis.
 */
export function buildPostUploadAnalysisMessage(session, assistant, fileCount = 1) {
  const base =
    fileCount > 1
      ? `${fileCount} documents uploaded successfully. Please analyze them.`
      : POST_UPLOAD_ANALYSIS_MESSAGE;

  const key = assistantKey(session, assistant);
  if (isCheckMyRentKey(key)) {
    return (
      `${base} Execute Q3 post-upload rules now: output the full STRUCTURED SUMMARY ` +
      `and Question 4 confirmation in this same response. Do not stop after the summary only.`
    );
  }
  if (isCheckWillKey(key)) {
    return (
      `${base} Execute Step 1–2 compound turn now: output the Will confirmation summary ` +
      `and ask the user to confirm or provide corrections in this same response.`
    );
  }
  if (isSideProjectKey(key)) {
    return (
      `${base} Execute Q1 post-upload rules now: complete internal extraction, then ask Question 2 ` +
      `in this same response. Do not wait for the user to ask what is next.`
    );
  }
  if (isServiceBondKey(key)) {
    return (
      `${base} Process this upload per service-bond upload flow. If more documents are still ` +
      `required for the user's path, request the next upload. If this was the last required ` +
      `document, ask Question 1 in this same response.`
    );
  }
  return base;
}

/**
 * Runtime overlay appended on the post-upload analysis turn (when files are attached).
 */
export function buildPostUploadTurnOverlay(session, assistant, userMessage) {
  if (!isPostUploadAnalysisMessage(userMessage)) return "";

  const key = assistantKey(session, assistant);
  if (isCheckMyRentKey(key)) {
    return (
      "=== POST-UPLOAD ANALYSIS TURN (MANDATORY) ===\n" +
      "Document upload for Q3 is complete. In THIS response you MUST:\n" +
      "1) Output the full STRUCTURED SUMMARY (Category 2 plain text) per master instructions.\n" +
      "2) Immediately continue in the SAME response with Question 4 (Category 1 HTML): " +
      "ask the user to confirm the summary or provide edits.\n" +
      "Do NOT end after the summary only. Do NOT wait for the user to ask what is next. " +
      "Do NOT reply with acknowledgements or process explanations only."
    );
  }
  if (isCheckWillKey(key)) {
    return (
      "=== POST-UPLOAD ANALYSIS TURN (MANDATORY) ===\n" +
      "Will upload (Step 1) is complete. In THIS response you MUST:\n" +
      "1) Output the Step 2 confirmation summary of what the Will contains.\n" +
      "2) Immediately ask the user to confirm or provide corrections (a) Confirm or (b) Corrections.\n" +
      "Do NOT ask Part A–G questions yet. Do NOT wait for the user to ask what is next."
    );
  }
  if (isSideProjectKey(key)) {
    return (
      "=== POST-UPLOAD ANALYSIS TURN (MANDATORY) ===\n" +
      "Employment contract upload (Q1) is complete. In THIS response you MUST:\n" +
      "1) Read/OCR and complete internal extraction per Q1 internal rules (do not share internal map).\n" +
      "2) Immediately ask Question 2 (HR/moonlighting policy) in the SAME response.\n" +
      "Do NOT end after extraction only. Do NOT wait for the user to ask what is next."
    );
  }
  if (isServiceBondKey(key)) {
    return (
      "=== POST-UPLOAD ANALYSIS TURN (MANDATORY) ===\n" +
      "Process the uploaded service-bond related document per master instructions.\n" +
      "- If more documents are still required for the user's selected path (a) or (b), request the next upload with upload JSON.\n" +
      "- If this was the LAST required document for the path, ask Question 1 in THIS same response.\n" +
      "Do NOT wait for the user to ask what is next."
    );
  }

  return (
    "=== POST-UPLOAD ANALYSIS TURN ===\n" +
    "The uploaded document(s) are attached. Analyze per your master instructions and " +
    "ask the next required official question in this same response — do not wait for the user " +
    "to ask what happens next."
  );
}

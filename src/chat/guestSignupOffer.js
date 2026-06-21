import { readPromptFile } from "../utils/promptManager.js";
import {
  appendGuestSystemInstruction,
  isGuestSignupOfferEnabled,
  applyGuestSignupOfferFromReply,
  guestSignupOfferResponseFields,
} from "./guestPromptContext.js";

/**
 * Load base prompt + upload notice + guest overlay for Gemini guest chat.
 */
export async function buildGuestGeminiSystemInstruction(
  assistantRow,
  session,
  filesToUse = []
) {
  if (!assistantRow?.config?.systemInstructionAsset) {
    return null;
  }

  let systemInstructionText;
  try {
    systemInstructionText = await readPromptFile(
      assistantRow.config.systemInstructionAsset
    );
  } catch (err) {
    throw err;
  }

  if (filesToUse.length > 0) {
    const fileCount = filesToUse.length;
    const fileText = fileCount > 1 ? "documents have" : "document has";
    systemInstructionText +=
      `\n\nIMPORTANT: ${fileCount} uploaded ${fileText} been provided for analysis. ` +
      "The uploaded document(s) are read-only. Do not invent missing clauses. " +
      "If information is missing from the document(s), respond with 'Not found in document.' " +
      "Follow the system rules strictly and analyze only what is present in the uploaded document(s).";
  }

  return appendGuestSystemInstruction(systemInstructionText, session);
}

/** OpenAI Assistants API additional_instructions for guest overlay. */
export function buildGuestOpenAiAdditionalInstructions(session) {
  if (!isGuestSignupOfferEnabled()) return undefined;
  const text = appendGuestSystemInstruction("", session).trim();
  return text.length > 0 ? text : undefined;
}

export function enrichGuestApiResponse(body, session, uploadInfo) {
  return {
    ...body,
    ...guestSignupOfferResponseFields(session, uploadInfo),
  };
}

export function processGuestAssistantReply(session, uploadInfo, userMessage) {
  applyGuestSignupOfferFromReply(session, uploadInfo, userMessage);
}

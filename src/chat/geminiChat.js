import { GoogleGenAI } from "@google/genai";
import {
  buildGeminiGenerationConfig,
  resolveGeminiModel,
} from "../utils/geminiConfig.js";
import { withTimeout } from "./messageControlParse.js";

const GEMINI_STREAM_TIMEOUT_MS = 120000;

/**
 * Stream Gemini generateContent; invoke onChunk for each text delta.
 * @returns {Promise<string>} full assembled text
 */
export async function streamGeminiChat({
  apiKey = process.env.GEMINI_API_KEY,
  model,
  sourceConfig = {},
  systemInstructionText,
  contents,
  onChunk,
  timeoutMs = GEMINI_STREAM_TIMEOUT_MS,
}) {
  const ai = new GoogleGenAI({ apiKey });
  const resolvedModel = resolveGeminiModel(sourceConfig);
  const config = buildGeminiGenerationConfig({
    sourceConfig,
    systemInstructionText,
  });

  let fullText = "";

  await withTimeout(
    (async () => {
      const response = await ai.models.generateContentStream({
        model: model || resolvedModel,
        config,
        contents,
      });
      for await (const chunk of response) {
        if (chunk.text) {
          fullText += chunk.text;
          if (typeof onChunk === "function") {
            onChunk(chunk.text, fullText);
          }
        }
      }
    })(),
    timeoutMs,
    "Gemini stream"
  );

  return fullText;
}

/**
 * Build Gemini contents array from session history + current user turn.
 */
export function buildGeminiHistory(session, userMessage, filesToUse = []) {
  const history = (session.messages || []).map((msg) => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }],
  }));

  const currentParts = [{ text: userMessage }];
  for (const fileUri of filesToUse) {
    if (fileUri) {
      currentParts.push({ fileData: { fileUri } });
    }
  }
  history.push({ role: "user", parts: currentParts });
  return history;
}

/**
 * Compact dynamic context for final generation (flow mode).
 */
export function buildFinalGenerationUserMessage(session, userMessage) {
  const answers = session.answers || {};
  return JSON.stringify(
    {
      mode: "final_generation",
      language: session.selectedLanguage || answers.language || "en",
      answers,
      notice_paragraphs: session.noticeParagraphs || [],
      notice_paragraph_keys: session.noticeParagraphKeys || [],
      user_message: userMessage,
    },
    null,
    2
  );
}

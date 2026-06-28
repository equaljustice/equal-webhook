import { GoogleGenAI } from "@google/genai";
import {
  buildGeminiGenerationConfig,
  resolveGeminiModel,
} from "../utils/geminiConfig.js";
import { withTimeout } from "./messageControlParse.js";
import { buildTurnContextMessage, isFinalGenerationTurn } from "./sessionStateProtocol.js";

const GEMINI_STREAM_TIMEOUT_MS = 120000;
const TRIMMED_HISTORY_TURNS = parseInt(process.env.GEMINI_TRIM_HISTORY_TURNS || "2", 10);

/**
 * Stream Gemini generateContent; invoke onChunk for each text delta.
 * @returns {Promise<string>} full assembled text
 */
export async function streamGeminiChat({
  apiKey = process.env.GEMINI_API_KEY,
  model,
  sourceConfig = {},
  systemInstructionText,
  cachedContentName,
  contents,
  onChunk,
  timeoutMs = GEMINI_STREAM_TIMEOUT_MS,
}) {
  const ai = new GoogleGenAI({ apiKey });
  const resolvedModel = resolveGeminiModel(sourceConfig);
  const config = buildGeminiGenerationConfig({
    sourceConfig,
    systemInstructionText: cachedContentName ? undefined : systemInstructionText,
    cachedContentName,
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
export function buildGeminiHistory(
  session,
  userMessage,
  filesToUse = [],
  options = {}
) {
  const { dynamicOverlay = "", useTrimmedHistory = true } = options;
  const fullHistory = useTrimmedHistory
    ? sliceRecentHistory(session.messages || [], TRIMMED_HISTORY_TURNS)
    : session.messages || [];

  const history = fullHistory.map((msg) => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }],
  }));

  const historyMode = useTrimmedHistory ? "trimmed" : "full";
  const wrappedUser = buildTurnContextMessage({
    session,
    userMessage,
    dynamicOverlay,
    historyMode,
  });

  const currentParts = [{ text: wrappedUser }];
  const fileMetaById = new Map(
    (session?.uploadedFilesMeta || []).map((m) => [m.fileId, m])
  );
  for (const fileUri of filesToUse) {
    if (!fileUri) continue;
    const meta = fileMetaById.get(fileUri);
    const fileData = { fileUri };
    if (meta?.mimeType) {
      fileData.mimeType = meta.mimeType;
    }
    currentParts.push({ fileData });
  }
  history.push({ role: "user", parts: currentParts });
  return history;
}

function sliceRecentHistory(messages, turnCount) {
  if (!turnCount || turnCount <= 0) return [];
  const maxMessages = turnCount * 2;
  if (messages.length <= maxMessages) return messages;
  return messages.slice(-maxMessages);
}

/**
 * Build contents for legacy AI-led chat with optional trimmed history.
 */
export function buildLegacyGeminiContents({
  session,
  userMessage,
  filesToUse = [],
  dynamicOverlay = "",
}) {
  const useFullHistory = isFinalGenerationTurn(session);
  return buildGeminiHistory(session, userMessage, filesToUse, {
    dynamicOverlay,
    useTrimmedHistory: !useFullHistory,
  });
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

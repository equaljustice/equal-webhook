import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";
import { resolveGeminiModel } from "../utils/geminiConfig.js";

/** In-process registry — cache names are valid across instances only with shared Redis later. */
const registry = new Map();

/** Default 24h — aligns with guest session retention; override via GEMINI_CACHE_TTL_SEC */
const DEFAULT_TTL_SEC = parseInt(
  process.env.GEMINI_CACHE_TTL_SEC || String(24 * 60 * 60),
  10
);

/** Gemini rejects caches.create when contents is missing or empty. */
const CACHE_CONTENTS_ANCHOR = {
  role: "user",
  parts: [
    {
      text:
        "Master legal-assistant instructions are attached via system instruction. " +
        "Each new turn supplies SESSION_STATE and the user message — follow those instructions.",
    },
  ],
};

export function isInstructionCacheEnabled() {
  if (process.env.GEMINI_CONTEXT_CACHE_ENABLED === "false") return false;
  return !!process.env.GEMINI_API_KEY;
}

function cacheKey(instructionText, model) {
  const hash = crypto
    .createHash("sha256")
    .update(`${model}\0${instructionText}`)
    .digest("hex")
    .slice(0, 24);
  return `${model}:${hash}`;
}

function isEntryValid(entry) {
  return entry?.name && entry.expiresAt > Date.now() + 30_000;
}

/**
 * Get or create a Gemini cached content resource for a static instruction block.
 * @returns {Promise<string|null>} cachedContent resource name
 */
export async function getOrCreateInstructionCache({
  instructionText,
  sourceConfig = {},
  displayName = "equaljustice-instructions",
  apiKey = process.env.GEMINI_API_KEY,
}) {
  if (!isInstructionCacheEnabled() || !instructionText?.trim()) {
    return null;
  }

  const model = resolveGeminiModel(sourceConfig);
  const key = cacheKey(instructionText, model);
  const existing = registry.get(key);
  if (isEntryValid(existing)) {
    return existing.name;
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const created = await ai.caches.create({
      model,
      config: {
        displayName: `${displayName}-${key.slice(-8)}`,
        systemInstruction: instructionText,
        contents: [CACHE_CONTENTS_ANCHOR],
        ttl: `${DEFAULT_TTL_SEC}s`,
      },
    });

    if (!created?.name) {
      console.warn("[GeminiCache] create returned no name — using inline instructions");
      return null;
    }

    registry.set(key, {
      name: created.name,
      expiresAt: Date.now() + DEFAULT_TTL_SEC * 1000,
      model,
    });

    console.info("[GeminiCache] Created instruction cache", {
      name: created.name,
      model,
      displayName,
      ttlSec: DEFAULT_TTL_SEC,
    });

    return created.name;
  } catch (err) {
    console.warn(
      "[GeminiCache] Cache create failed — falling back to inline instructions:",
      err.message
    );
    return null;
  }
}

export function clearInstructionCacheRegistry() {
  registry.clear();
}

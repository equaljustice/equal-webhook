export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export const DEFAULT_GEMINI_GENERATION = {
  temperature: 0.1,
  topK: 10,
  topP: 0.5,
};

const ENV_KEYS = {
  temperature: "GEMINI_TEMPERATURE",
  topK: "GEMINI_TOP_K",
  topP: "GEMINI_TOP_P",
};

function parseOptionalNumber(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function resolveGenerationParam(sourceConfig, key) {
  const fromSource = parseOptionalNumber(sourceConfig?.[key]);
  if (fromSource !== undefined) {
    return fromSource;
  }
  const fromEnv = parseOptionalNumber(process.env[ENV_KEYS[key]]);
  if (fromEnv !== undefined) {
    return fromEnv;
  }
  return DEFAULT_GEMINI_GENERATION[key];
}

export function resolveGeminiModel(sourceConfig = {}) {
  return sourceConfig.model || DEFAULT_GEMINI_MODEL;
}

/**
 * Builds a Gemini GenerateContentConfig from assistant/session config.
 * App flags (deferPayment, systemInstructionAsset, etc.) are excluded.
 *
 * Priority: assistant `config` → .env → defaults (0.1 / 10 / 0.5)
 */
export function buildGeminiGenerationConfig({
  sourceConfig = {},
  systemInstructionText,
  cachedContentName,
} = {}) {
  const config = {
    temperature: resolveGenerationParam(sourceConfig, "temperature"),
    topK: resolveGenerationParam(sourceConfig, "topK"),
    topP: resolveGenerationParam(sourceConfig, "topP"),
  };

  if (systemInstructionText) {
    config.systemInstruction = [{ text: systemInstructionText }];
  }

  if (cachedContentName) {
    config.cachedContent = cachedContentName;
  }

  return config;
}

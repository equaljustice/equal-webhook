import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_GENERATION,
  GEMINI_GENERATION_KEYS,
  GEMINI_PARAMETER_META,
  isAllowedGeminiModel,
} from "../constants/geminiModels.js";
import { GeminiSettings } from "../model/geminiSettings.model.js";

export {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_GENERATION,
  GEMINI_PARAMETER_META,
  getGeminiModelCatalog,
  isAllowedGeminiModel,
} from "../constants/geminiModels.js";

const ENV_KEYS = {
  model: "GEMINI_MODEL",
  temperature: "GEMINI_TEMPERATURE",
  topK: "GEMINI_TOP_K",
  topP: "GEMINI_TOP_P",
};

let cachedGlobalSettings = null;
let cacheLoadedAt = 0;
const GLOBAL_CACHE_TTL_MS = 30_000;

function parseOptionalNumber(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function pickGeminiOverrides(config = {}) {
  const out = {};
  for (const key of GEMINI_GENERATION_KEYS) {
    if (config[key] !== undefined && config[key] !== null && config[key] !== "") {
      out[key] = config[key];
    }
  }
  return out;
}

export function stripGeminiOverrides(config = {}) {
  const out = { ...config };
  for (const key of GEMINI_GENERATION_KEYS) {
    delete out[key];
  }
  return out;
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
  const candidate = sourceConfig.model || process.env[ENV_KEYS.model];
  if (typeof candidate === "string" && candidate.trim()) {
    return candidate.trim();
  }
  return DEFAULT_GEMINI_MODEL;
}

/**
 * Merged effective generation config: assistant overrides → global DB → env → defaults.
 */
export function buildEffectiveGeminiConfig({
  globalSettings = {},
  assistantConfig = {},
} = {}) {
  const merged = {
    ...pickGeminiOverrides(globalSettings),
    ...pickGeminiOverrides(assistantConfig),
  };
  return {
    model: resolveGeminiModel(merged),
    temperature: resolveGenerationParam(merged, "temperature"),
    topK: resolveGenerationParam(merged, "topK"),
    topP: resolveGenerationParam(merged, "topP"),
  };
}

export async function getGlobalGeminiSettings({ forceRefresh = false } = {}) {
  const stale =
    !cachedGlobalSettings || Date.now() - cacheLoadedAt > GLOBAL_CACHE_TTL_MS;
  if (!forceRefresh && !stale) {
    return cachedGlobalSettings;
  }
  const doc = await GeminiSettings.findOne({ key: "global" }).lean();
  cachedGlobalSettings = doc ? pickGeminiOverrides(doc) : {};
  cacheLoadedAt = Date.now();
  return cachedGlobalSettings;
}

export function invalidateGlobalGeminiCache() {
  cachedGlobalSettings = null;
  cacheLoadedAt = 0;
}

/**
 * Full session geminiConfig: assistant feature flags + effective generation params.
 */
export async function resolveSessionGeminiConfig(assistantConfig = {}) {
  const globalSettings = await getGlobalGeminiSettings();
  const effective = buildEffectiveGeminiConfig({
    globalSettings,
    assistantConfig,
  });
  return {
    ...(assistantConfig || {}),
    ...effective,
  };
}

export function validateGeminiGenerationInput(input = {}) {
  const errors = [];
  const normalized = {};

  if (input.model !== undefined) {
    if (input.model === null || input.model === "") {
      normalized.model = null;
    } else if (!isAllowedGeminiModel(input.model)) {
      errors.push(`Invalid model: ${input.model}`);
    } else {
      normalized.model = input.model.trim();
    }
  }

  if (input.temperature !== undefined) {
    if (input.temperature === null || input.temperature === "") {
      normalized.temperature = null;
    } else {
      const value = Number(input.temperature);
      const { min, max } = GEMINI_PARAMETER_META.temperature;
      if (!Number.isFinite(value) || value < min || value > max) {
        errors.push(`temperature must be between ${min} and ${max}`);
      } else {
        normalized.temperature = value;
      }
    }
  }

  if (input.topK !== undefined) {
    if (input.topK === null || input.topK === "") {
      normalized.topK = null;
    } else {
      const value = Number(input.topK);
      const { min, max } = GEMINI_PARAMETER_META.topK;
      if (!Number.isInteger(value) || value < min || value > max) {
        errors.push(`topK must be an integer between ${min} and ${max}`);
      } else {
        normalized.topK = value;
      }
    }
  }

  if (input.topP !== undefined) {
    if (input.topP === null || input.topP === "") {
      normalized.topP = null;
    } else {
      const value = Number(input.topP);
      const { min, max } = GEMINI_PARAMETER_META.topP;
      if (!Number.isFinite(value) || value < min || value > max) {
        errors.push(`topP must be between ${min} and ${max}`);
      } else {
        normalized.topP = value;
      }
    }
  }

  return { errors, normalized };
}

/**
 * Builds a Gemini GenerateContentConfig from assistant/session config.
 *
 * Priority: assistant/session `config` → global DB → .env → defaults
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

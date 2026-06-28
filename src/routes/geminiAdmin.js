import express from "express";
import { adminAuth } from "../middleware/adminAuth.js";
import { Assistant } from "../model/assistant.model.js";
import { GeminiSettings } from "../model/geminiSettings.model.js";
import {
  GEMINI_GENERATION_KEYS,
  GEMINI_PARAMETER_META,
  DEFAULT_GEMINI_GENERATION,
  DEFAULT_GEMINI_MODEL,
  getGeminiModelCatalog,
} from "../constants/geminiModels.js";
import {
  buildEffectiveGeminiConfig,
  getGlobalGeminiSettings,
  invalidateGlobalGeminiCache,
  pickGeminiOverrides,
  stripGeminiOverrides,
  validateGeminiGenerationInput,
} from "../utils/geminiConfig.js";

const router = express.Router();

function describeInheritance(assistantConfig = {}, globalSettings = {}) {
  const overrides = pickGeminiOverrides(assistantConfig);
  const inherits = {};
  for (const key of GEMINI_GENERATION_KEYS) {
    inherits[key] = overrides[key] === undefined;
  }
  return { overrides, inherits };
}

function serializeAssistantGemini(assistant, globalSettings) {
  const { overrides, inherits } = describeInheritance(
    assistant.config || {},
    globalSettings,
  );
  const effective = buildEffectiveGeminiConfig({
    globalSettings,
    assistantConfig: assistant.config || {},
  });
  return {
    _id: assistant._id,
    name: assistant.name,
    key: assistant.key,
    provider: assistant.provider,
    overrides,
    inherits,
    effective,
  };
}

/**
 * GET /api/gemini-admin/catalog
 * Model list + parameter metadata for the admin UI.
 */
router.get("/catalog", adminAuth, async (req, res) => {
  try {
    return res.status(200).json({
      models: getGeminiModelCatalog(),
      parameters: GEMINI_PARAMETER_META,
      defaults: {
        model: DEFAULT_GEMINI_MODEL,
        ...DEFAULT_GEMINI_GENERATION,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to load Gemini catalog",
      message: error.message,
    });
  }
});

/**
 * GET /api/gemini-admin/settings
 * Global settings + per-assistant effective Gemini configuration.
 */
router.get("/settings", adminAuth, async (req, res) => {
  try {
    const globalDoc = await GeminiSettings.findOne({ key: "global" }).lean();
    const globalSettings = await getGlobalGeminiSettings({ forceRefresh: true });
    const globalEffective = buildEffectiveGeminiConfig({ globalSettings });

    const assistants = await Assistant.find({}).sort({ name: 1 }).lean();
    const geminiAssistants = assistants
      .filter((a) => a.provider === "gemini")
      .map((a) => serializeAssistantGemini(a, globalSettings));

    return res.status(200).json({
      global: {
        stored: pickGeminiOverrides(globalDoc || {}),
        effective: globalEffective,
        updatedAt: globalDoc?.updatedAt || null,
        updatedBy: globalDoc?.updatedBy || null,
      },
      assistants: geminiAssistants,
      note: "Changes apply to new chat sessions only. Existing sessions keep their snapshot.",
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to load Gemini settings",
      message: error.message,
    });
  }
});

/**
 * PUT /api/gemini-admin/settings/global
 * Update global Gemini defaults.
 */
router.put("/settings/global", adminAuth, async (req, res) => {
  try {
    const { errors, normalized } = validateGeminiGenerationInput(req.body || {});
    if (errors.length > 0) {
      return res.status(400).json({ error: "Validation failed", errors });
    }

    const update = {
      updatedAt: new Date(),
      updatedBy: req.admin?.email || "admin",
    };
    for (const key of GEMINI_GENERATION_KEYS) {
      if (normalized[key] !== undefined) {
        update[key] = normalized[key];
      }
    }

    const doc = await GeminiSettings.findOneAndUpdate(
      { key: "global" },
      { $set: { key: "global", ...update } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();

    invalidateGlobalGeminiCache();

    return res.status(200).json({
      message: "Global Gemini settings updated",
      global: {
        stored: pickGeminiOverrides(doc),
        effective: buildEffectiveGeminiConfig({
          globalSettings: pickGeminiOverrides(doc),
        }),
        updatedAt: doc.updatedAt,
        updatedBy: doc.updatedBy,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to update global Gemini settings",
      message: error.message,
    });
  }
});

/**
 * PUT /api/gemini-admin/assistants/:assistantId
 * Update per-assistant Gemini overrides (merged into assistant.config).
 *
 * Body: { model?, temperature?, topK?, topP?, useGlobalDefaults?: boolean }
 * useGlobalDefaults=true clears all Gemini generation overrides for that assistant.
 */
router.put("/assistants/:assistantId", adminAuth, async (req, res) => {
  try {
    const { assistantId } = req.params;
    const assistant = await Assistant.findById(assistantId);
    if (!assistant) {
      return res.status(404).json({ message: "Assistant not found" });
    }
    if (assistant.provider !== "gemini") {
      return res.status(400).json({
        message: "Gemini settings apply only to assistants with provider=gemini",
      });
    }

    const useGlobalDefaults = req.body?.useGlobalDefaults === true;
    let nextConfig = { ...(assistant.config || {}) };

    if (useGlobalDefaults) {
      nextConfig = stripGeminiOverrides(nextConfig);
    } else {
      const { errors, normalized } = validateGeminiGenerationInput(req.body || {});
      if (errors.length > 0) {
        return res.status(400).json({ error: "Validation failed", errors });
      }

      for (const key of GEMINI_GENERATION_KEYS) {
        if (normalized[key] === null) {
          delete nextConfig[key];
        } else if (normalized[key] !== undefined) {
          nextConfig[key] = normalized[key];
        }
      }
    }

    assistant.config = nextConfig;
    await assistant.save();

    const globalSettings = await getGlobalGeminiSettings({ forceRefresh: true });

    return res.status(200).json({
      message: "Assistant Gemini settings updated",
      assistant: serializeAssistantGemini(assistant.toObject(), globalSettings),
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to update assistant Gemini settings",
      message: error.message,
    });
  }
});

export default router;

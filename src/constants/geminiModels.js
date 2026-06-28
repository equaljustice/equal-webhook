/**
 * Curated Gemini text-generation models for EqualJustice chat orchestration.
 * Excludes image, audio/TTS, live, video, embedding, agent, and deprecated models.
 *
 * Ordered by capabilityRank (1 = highest capability). costRank follows the same
 * order — lower rank = higher relative cost on Google's pricing tiers.
 */
export const GEMINI_CHAT_MODELS = [
  {
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro",
    stability: "preview",
    capabilityRank: 1,
    costRank: 1,
    capabilityLabel: "Highest reasoning",
    costLabel: "Highest cost",
    description:
      "Advanced intelligence for complex legal reasoning, multi-step flows, and agentic tasks.",
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    stability: "stable",
    capabilityRank: 2,
    costRank: 2,
    capabilityLabel: "Very high reasoning",
    costLabel: "High cost",
    description:
      "Deep reasoning and coding — best for difficult termination, inheritance, or multi-branch Q&A.",
  },
  {
    id: "gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    stability: "stable",
    capabilityRank: 3,
    costRank: 3,
    capabilityLabel: "High intelligence",
    costLabel: "Medium-high cost",
    description:
      "Frontier-class flash model for sustained agentic and structured Q&A performance.",
  },
  {
    id: "gemini-3-flash-preview",
    label: "Gemini 3 Flash",
    stability: "preview",
    capabilityRank: 4,
    costRank: 4,
    capabilityLabel: "Strong general",
    costLabel: "Medium cost",
    description:
      "Frontier performance at lower cost than Pro — good balance for production chat.",
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    stability: "stable",
    capabilityRank: 5,
    costRank: 5,
    capabilityLabel: "Balanced",
    costLabel: "Medium-low cost",
    recommended: true,
    description:
      "Default workhorse — strong price-performance for high-volume instruction-following chat.",
  },
  {
    id: "gemini-2.5-flash-preview-05-20",
    label: "Gemini 2.5 Flash (Preview)",
    stability: "preview",
    capabilityRank: 5,
    costRank: 5,
    capabilityLabel: "Balanced (preview)",
    costLabel: "Medium-low cost",
    description:
      "Preview snapshot of 2.5 Flash — use for early access; prefer stable gemini-2.5-flash for production.",
  },
  {
    id: "gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash-Lite",
    stability: "stable",
    capabilityRank: 6,
    costRank: 6,
    capabilityLabel: "Lightweight",
    costLabel: "Low cost",
    description:
      "Fast, cost-efficient multimodal flash — suitable for simpler flows with tight budgets.",
  },
  {
    id: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash-Lite",
    stability: "stable",
    capabilityRank: 7,
    costRank: 7,
    capabilityLabel: "Fastest / lightest",
    costLabel: "Lowest cost",
    description:
      "Fastest and most budget-friendly 2.5 option — use when latency and cost matter most.",
  },
];

export const GEMINI_MODEL_IDS = new Set(GEMINI_CHAT_MODELS.map((m) => m.id));

export function isAllowedGeminiModel(modelId) {
  return typeof modelId === "string" && GEMINI_MODEL_IDS.has(modelId.trim());
}

export function getGeminiModelCatalog() {
  return [...GEMINI_CHAT_MODELS].sort((a, b) => {
    if (a.capabilityRank !== b.capabilityRank) {
      return a.capabilityRank - b.capabilityRank;
    }
    return a.id.localeCompare(b.id);
  });
}

/**
 * Admin-facing explanations for generation parameters.
 */
export const GEMINI_PARAMETER_META = {
  model: {
    label: "Model",
    description:
      "Which Gemini model generates chat replies. Higher-tier models reason better but cost more per token.",
    effect:
      "Pro models follow complex instruction files more reliably; Flash models are faster and cheaper. Changes apply to new sessions only.",
  },
  temperature: {
    label: "Temperature",
    min: 0,
    max: 2,
    step: 0.05,
    default: 0.1,
    description:
      "Controls randomness in token selection. Legal Q&A flows should stay low for consistency.",
    effect:
      "Lower (0–0.3): deterministic, sticks to instructions — recommended for EqualJustice. Higher (0.7+): more varied phrasing but higher risk of drift or hallucination.",
  },
  topK: {
    label: "Top K",
    min: 1,
    max: 40,
    step: 1,
    default: 10,
    description:
      "Limits each step to the K most likely next tokens before sampling.",
    effect:
      "Lower values narrow choices (more focused). Higher values allow more vocabulary diversity. Typical range for structured chat: 5–20.",
  },
  topP: {
    label: "Top P (nucleus sampling)",
    min: 0,
    max: 1,
    step: 0.05,
    default: 0.5,
    description:
      "Samples from the smallest set of tokens whose cumulative probability exceeds P.",
    effect:
      "Lower (0.3–0.5): conservative, instruction-safe output. Higher (0.8–1.0): broader word choice — use cautiously in legal flows.",
  },
};

export const GEMINI_GENERATION_KEYS = ["model", "temperature", "topK", "topP"];

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export const DEFAULT_GEMINI_GENERATION = {
  temperature: 0.1,
  topK: 10,
  topP: 0.5,
};

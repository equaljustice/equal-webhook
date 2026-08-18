import { INPUT_TYPES } from "./flowConstants.js";

const LANG_OPTIONS_RENDER = [
  { key: "en", label: "English" },
  { key: "hi", label: "हिंदी" },
  { key: "gu", label: "ગુજરાતી" },
  { key: "pa", label: "ਪੰਜਾਬੀ" },
  { key: "ta", label: "தமிழ்" },
  { key: "te", label: "తెలుగు" },
  { key: "kn", label: "ಕನ್ನಡ" },
  { key: "bn", label: "বাংলা" },
  { key: "mr", label: "मराठी" },
  { key: "or", label: "ଓଡ଼ିଆ" },
  { key: "as", label: "অসমীয়া" },
  { key: "bho", label: "भोजपुरी" },
  { key: "ur", label: "اردو" },
];

function pickLocalized(block, language = "en") {
  if (!block) return "";
  if (typeof block === "string") return block;
  return block[language] || block.en || block[Object.keys(block)[0]] || "";
}

function formatOptionsHtml(options = []) {
  return options
    .map((opt) => {
      const label = typeof opt === "string" ? opt : opt.label;
      return `${label}<br>`;
    })
    .join("");
}

/**
 * Render a user-facing HTML message for a flow node.
 */
export function renderNodeContent({
  content,
  contentKey,
  node,
  language = "en",
  displayNumber,
  loopContext = {},
}) {
  const block = content?.[contentKey] || {};
  const title = pickLocalized(block.title, language);
  const text = pickLocalized(block.text, language);
  const explanation = pickLocalized(block.explanation, language);
  let options = block.options;

  if (node?.input?.type === INPUT_TYPES.LANGUAGE_SELECT) {
    options = LANG_OPTIONS_RENDER.map((o, i) => ({
      key: o.key,
      label: `${i + 1}. ${o.label}`,
    }));
  } else if (options && typeof options === "object" && !Array.isArray(options)) {
    options = Object.entries(options).map(([key, label]) => ({
      key,
      label: pickLocalized(label, language),
    }));
  }

  const parts = [];
  const isQuestion =
    node?.type === "question" && displayNumber != null && displayNumber > 0;

  if (isQuestion && title) {
    parts.push(`<h5><strong>Question ${displayNumber}:</strong></h5>`);
    parts.push(`<h6>${interpolate(text, loopContext)}</h6>`);
  } else if (title) {
    parts.push(`<strong>${interpolate(title, loopContext)}</strong><br>`);
    if (text) parts.push(`${interpolate(text, loopContext)}<br>`);
  } else if (text) {
    parts.push(`${interpolate(text, loopContext)}`);
  }

  if (options?.length) {
    const letters = "abcdefghijklmnopqrstuvwxyz";
    const optsHtml = options
      .map((opt, i) => {
        const label =
          typeof opt === "string"
            ? opt
            : opt.label || String(opt.key || opt);
        const prefix =
          node?.input?.type === INPUT_TYPES.LANGUAGE_SELECT
            ? ""
            : `(${letters[i]}) `;
        return `${prefix}${label}<br>`;
      })
      .join("");
    parts.push(optsHtml);
  }

  if (explanation) {
    parts.push(`<em>${interpolate(explanation, loopContext)}</em>`);
  }

  return parts.join("");
}

function interpolate(text = "", ctx = {}) {
  return String(text).replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (ctx[key] != null) return String(ctx[key]);
    return `{{${key}}}`;
  });
}

export function buildControlJson(flags = {}) {
  const payload = {
    upload_required: !!flags.uploadRequired,
    upload_type: flags.uploadType || null,
    upload_reason: flags.uploadReason || null,
    session_terminated: !!flags.sessionTerminated,
    termination_message: flags.terminationMessage || null,
    payment_required: !!flags.paymentRequired,
    multi_select: !!flags.multiSelect,
  };
  return JSON.stringify(payload);
}

const LANG_OPTIONS = [
  { key: "en", label: "English" },
  { key: "hi", label: "हिंदी" },
  { key: "gu", label: "ગુજરાતી" },
  { key: "pa", label: "ਪੰਜਾਬੀ" },
  { key: "ta", label: "தமிழ்" },
  { key: "te", label: "తెలుగు" },
  { key: "kn", label: "ಕನ್ನಡ" },
  { key: "bn", label: "বাংলা" },
  { key: "mr", label: "मराठी" },
  { key: "or", label: "ଓଡ଼ିଆ" },
  { key: "as", label: "অসমীয়া" },
  { key: "bho", label: "भोजपुरी" },
  { key: "ur", label: "اردو" },
];

/**
 * Structured options for the frontend quick-pick UI.
 */
export function buildFlowOptions(node) {
  const input = node?.input || {};
  if (input.type === INPUT_TYPES.LANGUAGE_SELECT) {
    return LANG_OPTIONS.map((o, i) => ({
      key: o.key,
      label: o.label,
      shortcut: String(i + 1),
      letter: String.fromCharCode(97 + i),
    }));
  }
  if (input.type === INPUT_TYPES.SINGLE_SELECT && input.options?.length) {
    return input.options.map((opt, i) => {
      const key = typeof opt === "string" ? opt : opt.key;
      const label = typeof opt === "string" ? opt : opt.label || key;
      return {
        key,
        label,
        shortcut: String(i + 1),
        letter: String.fromCharCode(97 + i),
      };
    });
  }
  if (input.type === INPUT_TYPES.MULTI_SELECT && input.options?.length) {
    return input.options.map((opt, i) => {
      const key = typeof opt === "string" ? opt : opt.key;
      const label = typeof opt === "string" ? opt : opt.label || key;
      return {
        key,
        label,
        shortcut: String(i + 1),
        letter: String.fromCharCode(97 + i),
      };
    });
  }
  if (input.type === INPUT_TYPES.CONFIRMATION) {
    return [
      { key: "yes", label: "Yes", shortcut: "1", letter: "a" },
      { key: "no", label: "No", shortcut: "2", letter: "b" },
    ];
  }
  return [];
}

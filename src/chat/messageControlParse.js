/**
 * Shared helpers for assistant reply parsing, payment/termination fallbacks,
 * and document snapshot persistence. Used by auth and guest chat routes.
 */

import { QA_PHASES } from "./sessionStateProtocol.js";
import {
  isProgressEnabled,
  PROGRESS_CONTROL_KEYS,
  normalizeProgress,
  normalizeQuestionsRemaining,
  normalizeBatchLabel,
} from "./progressControl.js";

export const withTimeout = (promise, ms, label = "Operation") => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
};

/**
 * Build document data from the actual final response message.
 * Uses the real chat content (cleanMessage) as the document body,
 * and optionally merges metadata from the LLM's document JSON (title, document_type).
 */
export const buildDocumentDataFromMessage = (cleanMessage, session, llmDocData) => {
  const assistantKey = session?.assistantKey || "document";
  const sessionTitle = session?.title || "Document";
  const isWill =
    assistantKey === "will_instructions" ||
    assistantKey === "create_my_will" ||
    llmDocData?.metadata?.template_profile === "will" ||
    String(llmDocData?.document_type || "").toLowerCase().includes("will");

  return {
    document_type: llmDocData?.document_type || assistantKey,
    title: llmDocData?.title || sessionTitle,
    content: {
      sections: [
        {
          type: isWill ? "will_text" : "html",
          text: cleanMessage,
        },
      ],
    },
    metadata: {
      language: llmDocData?.metadata?.language || "en",
      generated_date: new Date().toISOString(),
      use_case: llmDocData?.metadata?.use_case || assistantKey,
      testator_name: llmDocData?.metadata?.testator_name,
      will_title_line: llmDocData?.metadata?.will_title_line,
      template_profile: llmDocData?.metadata?.template_profile,
    },
  };
};

export const DOCUMENT_SNAPSHOT_MIN_LENGTH = 200;

/** Gift Register intro turn (JollyJi renders the register table) — never a deliverable. */
export const GIFT_REGISTER_MARKER_RE =
  /data-ej-gift-register\s*=\s*["']?(?:1|true|yes)["']?/i;

export const findLastSubstantiveMessage = (session) => {
  const messages = session.messages || [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (
      m.role === "assistant" &&
      m.content &&
      m.content.length >= DOCUMENT_SNAPSHOT_MIN_LENGTH
    ) {
      return m.content;
    }
  }
  return null;
};

/**
 * Server-side download snapshot (replaces model "document_ready" JSON flag).
 * Saves PDF/Word source when user has paid and the assistant outputs the final document.
 */
export function inferDownloadSnapshot(session, uploadInfo, cleanMessage) {
  if (uploadInfo?.paymentRequired || uploadInfo?.requiresUpload) return false;
  if (!session?.isPaid || !session?.paymentGateShown) return false;
  const phase = session.qaPhase || QA_PHASES.QA_IN_PROGRESS;
  if (phase !== QA_PHASES.READY_FOR_FINAL) return false;
  const text = String(cleanMessage || "").trim();
  if (text.length < DOCUMENT_SNAPSHOT_MIN_LENGTH) return false;
  if (/Question\s+\d+\s*:/i.test(text)) return false;
  if (GIFT_REGISTER_MARKER_RE.test(text)) return false;
  return true;
}

export function applyDownloadSnapshot(session, sessionId, uploadInfo, cleanMessage) {
  const snapshotInfo = {
    ...uploadInfo,
    documentReady: inferDownloadSnapshot(session, uploadInfo, cleanMessage),
  };
  persistSessionDocumentSnapshot(session, sessionId, snapshotInfo, cleanMessage);
  if (snapshotInfo.documentReady) {
    session.qaPhase = QA_PHASES.FINAL_GENERATED;
  }
  return snapshotInfo.documentReady;
}

export const persistSessionDocumentSnapshot = (
  session,
  sessionId,
  uploadInfo,
  cleanMessage
) => {
  const terminated = uploadInfo.sessionTerminated;
  const docReady = uploadInfo.documentReady;
  if (!terminated && !docReady) return;

  if (terminated && !docReady && session.finalDocumentData) {
    return;
  }

  const resolvedFinalResponse =
    typeof uploadInfo.finalResponse === "string" &&
    uploadInfo.finalResponse.trim().length > 0
      ? uploadInfo.finalResponse.trim()
      : null;

  let docContent = null;
  if (docReady) {
    docContent =
      resolvedFinalResponse ||
      (cleanMessage && cleanMessage.trim().length >= DOCUMENT_SNAPSHOT_MIN_LENGTH
        ? cleanMessage.trim()
        : null) ||
      findLastSubstantiveMessage(session);
  } else if (terminated) {
    docContent =
      resolvedFinalResponse ||
      session.final_response ||
      findLastSubstantiveMessage(session);
  }

  if (docContent) {
    session.finalDocumentData = buildDocumentDataFromMessage(
      docContent,
      session,
      uploadInfo.documentData
    );
    console.log("Stored document data for session:", sessionId);
  }
};

const extractDocumentData = (message) => {
  if (!message || typeof message !== "string") {
    return { data: null, startIdx: -1, endIdx: -1 };
  }

  let startIdx = -1;
  const searchPatterns = [
    '{"document_type"',
    '{\n"document_type"',
    '{\r\n"document_type"',
    '{\r"document_type"',
    '{ "document_type"',
  ];

  for (const pattern of searchPatterns) {
    startIdx = message.indexOf(pattern);
    if (startIdx !== -1) {
      break;
    }
  }

  if (startIdx === -1) {
    return { data: null, startIdx: -1, endIdx: -1 };
  }

  let braceCount = 0;
  let inString = false;
  let escapeNext = false;
  let endIdx = -1;

  for (let i = startIdx; i < message.length; i++) {
    const char = message[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === "{") {
        braceCount++;
      } else if (char === "}") {
        braceCount--;
        if (braceCount === 0) {
          endIdx = i;
          break;
        }
      }
    }
  }

  if (endIdx === -1) {
    return { data: null, startIdx: -1, endIdx: -1 };
  }

  try {
    const jsonStr = message.substring(startIdx, endIdx + 1);
    const documentData = JSON.parse(jsonStr);

    if (documentData && documentData.hasOwnProperty("document_type")) {
      return { data: documentData, startIdx, endIdx: endIdx + 1 };
    }
  } catch (parseError) {
    console.warn("Failed to parse document data JSON:", parseError.message);
    return { data: null, startIdx: -1, endIdx: -1 };
  }

  return { data: null, startIdx: -1, endIdx: -1 };
};

export function detectChatLanguageFromText(text = "") {
  const s = String(text);

  if (/[\u0600-\u06FF\u0750-\u077F]/.test(s)) return "ur";
  if (/[\u0900-\u097F]/.test(s)) return "hi";
  if (/[\u0A80-\u0AFF]/.test(s)) return "gu";
  if (/[\u0A00-\u0A7F]/.test(s)) return "pa";
  if (/[\u0B80-\u0BFF]/.test(s)) return "ta";
  if (/[\u0C00-\u0C7F]/.test(s)) return "te";
  if (/[\u0C80-\u0CFF]/.test(s)) return "kn";
  if (/[\u0B00-\u0B7F]/.test(s)) return "or";
  if (/[\u0980-\u09FF]/.test(s)) return "bn";

  return "en";
}

export function paymentBarrierMessage(language) {
  switch (language) {
    case "hi":
      return "सभी प्रश्नों के उत्तर देने के लिए धन्यवाद। अपनी व्यक्तिगत मूल्यांकन रिपोर्ट प्राप्त करने के लिए कृपया भुगतान पूरा करें।";
    case "bn":
      return "সব প্রশ্নের উত্তর দেওয়ার জন্য ধন্যবাদ। আপনার ব্যক্তিগত মূল্যায়ন রিপোর্ট পেতে অনুগ্রহ করে অর্থপ্রদান সম্পূর্ণ করুন।";
    case "gu":
      return "બધા પ્રશ્નોના જવાબ આપવા બદલ આભાર. તમારો વ્યક્તિગત અંદાજ/મૂલ્યાંકન મેળવવા માટે કૃપા કરીને ચુકવણી પૂર્ણ કરો.";
    case "pa":
      return "ਸਾਰੇ ਸਵਾਲਾਂ ਦੇ ਜਵਾਬ ਦੇਣ ਲਈ ਧੰਨਵਾਦ। ਆਪਣਾ ਨਿੱਜੀ ਮੁਲਾਂਕਣ ਪ੍ਰਾਪਤ ਕਰਨ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਭੁਗਤਾਨ ਪੂਰਾ ਕਰੋ।";
    case "ta":
      return "அனைத்து கேள்விகளுக்கும் பதிலளித்ததற்கு நன்றி. உங்கள் தனிப்பட்ட மதிப்பீட்டை பெற, தயவுசெய்து கட்டணத்தை நிறைவு செய்யுங்கள்।";
    case "te":
      return "అన్ని ప్రశ్నలకు సమాధానమిచ్చినందుకు ధన్యవాదాలు. మీ వ్యక్తిగత అంచనాను పొందేందుకు దయచేసి చెల్లింపును పూర్తి చేయండి।";
    case "kn":
      return "ಎಲ್ಲಾ ಪ್ರಶ್ನೆಗಳಿಗೆ ಉತ್ತರಿಸಿದುದಕ್ಕೆ ಧನ್ಯವಾದಗಳು. ನಿಮ್ಮ ವೈಯಕ್ತಿಕ ಮೌಲ್ಯಮಾಪನವನ್ನು ಪಡೆಯಲು ದಯವಿಟ್ಟು ಪಾವತಿಯನ್ನು ಪೂರ್ಣಗೊಳಿಸಿ।";
    case "or":
      return "ସମସ୍ତ ପ୍ରଶ୍ନର ଉତ୍ତର ଦେଇଥିବା ପାଇଁ ଧନ୍ୟବାଦ। ଆପଣଙ୍କର ବ୍ୟକ୍ତିଗତ ମୂଲ୍ୟାଙ୍କନ ପାଇବାକୁ ଦୟାକରି ଦେୟ ପୂରଣ କରନ୍ତୁ।";
    case "ur":
      return "تمام سوالات کے جوابات دینے کا شکریہ۔ اپنا ذاتی جائزہ حاصل کرنے کے لیے براہ کرم ادائیگی مکمل کریں۔";
    case "en":
    default:
      return "Thank you for completing all the questions. To receive your personalized assessment, please complete the payment.";
  }
}

/** Barrier copy for later payment cycles (one payment per document). */
export function documentPaymentBarrierMessage(language) {
  switch (language) {
    case "hi":
      return "अपना चुना हुआ दस्तावेज़ तैयार करने के लिए कृपया भुगतान पूरा करें।";
    case "bn":
      return "আপনার নির্বাচিত নথি তৈরি করতে অনুগ্রহ করে অর্থপ্রদান সম্পূর্ণ করুন।";
    case "gu":
      return "તમારો પસંદ કરેલો દસ્તાવેજ તૈયાર કરવા માટે કૃપા કરીને ચુકવણી પૂર્ણ કરો.";
    case "pa":
      return "ਆਪਣਾ ਚੁਣਿਆ ਹੋਇਆ ਦਸਤਾਵੇਜ਼ ਤਿਆਰ ਕਰਨ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਭੁਗਤਾਨ ਪੂਰਾ ਕਰੋ।";
    case "ta":
      return "நீங்கள் தேர்ந்தெடுத்த ஆவணத்தை உருவாக்க, தயவுசெய்து கட்டணத்தை நிறைவு செய்யுங்கள்.";
    case "te":
      return "మీరు ఎంచుకున్న పత్రాన్ని రూపొందించడానికి దయచేసి చెల్లింపును పూర్తి చేయండి.";
    case "kn":
      return "ನೀವು ಆಯ್ಕೆ ಮಾಡಿದ ದಾಖಲೆಯನ್ನು ರಚಿಸಲು ದಯವಿಟ್ಟು ಪಾವತಿಯನ್ನು ಪೂರ್ಣಗೊಳಿಸಿ.";
    case "or":
      return "ଆପଣ ବାଛିଥିବା ଦଲିଲ ପ୍ରସ୍ତୁତ କରିବାକୁ ଦୟାକରି ଦେୟ ପୂରଣ କରନ୍ତୁ।";
    case "ur":
      return "اپنی منتخب کردہ دستاویز تیار کرنے کے لیے براہ کرم ادائیگی مکمل کریں۔";
    case "en":
    default:
      return "To generate your selected document, please complete the payment.";
  }
}

function terminationBarrierMessage(language) {
  switch (language) {
    case "hi":
      return "आपका सेशन समाप्त हो गया है। आप बाहर निकल सकते हैं या नया सेशन शुरू कर सकते हैं।";
    case "bn":
      return "আপনার সেশন শেষ হয়ে গেছে। আপনি বের হতে পারেন বা নতুন সেশন শুরু করতে পারেন।";
    case "gu":
      return "તમારું સત્ર સમાપ્ત થઈ ગયું છે. તમે બહાર નીકળી શકો છો અથવા નવું સત્ર શરૂ કરી શકો છો.";
    case "pa":
      return "ਤੁਹਾਡਾ ਸੈਸ਼ਨ ਖਤਮ ਹੋ ਗਿਆ ਹੈ। ਤੁਸੀਂ ਬਾਹਰ ਨਿਕਲ ਸਕਦੇ ਹੋ ਜਾਂ ਨਵਾਂ ਸੈਸ਼ਨ ਸ਼ੁਰੂ ਕਰ ਸਕਦੇ ਹੋ।";
    case "ta":
      return "உங்கள் அமர்வு முடிவடைந்தது. நீங்கள் வெளியேறலாம் அல்லது புதிய அமர்வை தொடங்கலாம்।";
    case "te":
      return "మీ సెషన్ ముగిసింది. మీరు బయటకి వెళ్లవచ్చు లేదా కొత్త సెషన్ ప్రారంభించవచ్చు।";
    case "kn":
      return "ನಿಮ್ಮ ಸೆಷನ್ ಮುಗಿದಿದೆ. ನೀವು ಹೊರಬರಬಹುದು ಅಥವಾ ಹೊಸ ಸೆಷನ್ ಆರಂಭಿಸಬಹುದು।";
    case "or":
      return "ଆପଣଙ୍କ ସେସନ୍ ସମାପ୍ତ ହୋଇଛି। ଆପଣ ବାହାରି ପାରିବେ କିମ୍ବା ନୂତନ ସେସନ୍ ଆରମ୍ଭ କରିପାରିବେ।";
    case "ur":
      return "آپ کا سیشن ختم ہو گیا ہے۔ آپ باہر نکل سکتے ہیں یا نیا سیشن شروع کر سکتے ہیں۔";
    case "en":
    default:
      return "Your session is over now. You can exit or start a new session.";
  }
}

const TOP_LEVEL_CONTROL_KEYS = [
  "upload_required",
  "session_terminated",
  "payment_required",
  "multi_select",
  "batch_form",
  "document_ready",
  "guest_signup_offer",
  "selected_language",
  "session_state",
];

/** Control keys in effect; progress keys only when JOLLYJI_PROGRESS_ENABLED. */
function activeControlKeys() {
  return isProgressEnabled()
    ? [...TOP_LEVEL_CONTROL_KEYS, ...PROGRESS_CONTROL_KEYS]
    : TOP_LEVEL_CONTROL_KEYS;
}

function isControlMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(metadata, "session_state")) {
    return true;
  }
  return activeControlKeys().some((k) =>
    Object.prototype.hasOwnProperty.call(metadata, k)
  );
}

function extractControlJsonFromMessage(message) {
  if (!message || typeof message !== "string") return null;

  const trimmed = message.trimEnd();
  const lines = trimmed.split("\n");
  const lastLine = lines[lines.length - 1]?.trim();
  if (lastLine?.startsWith("{")) {
    const fromLastLine = parseControlJsonBlock(lastLine);
    if (fromLastLine) return fromLastLine;
  }

  if (!activeControlKeys().some((key) => message.includes(`"${key}"`))) {
    return null;
  }

  // Outermost, last-ending balanced object whose TOP-LEVEL keys are control
  // keys. Picking the nearest "{" before the last key landed inside nested
  // session_state/answers objects (inline JSON) and lost the control block.
  let best = null;
  let pos = message.length;
  for (let n = 0; n < CONTROL_JSON_SCAN_LIMIT; n++) {
    const startIdx = message.lastIndexOf("{", pos - 1);
    if (startIdx === -1) break;
    pos = startIdx;
    const jsonStr = extractBalancedJson(message, startIdx);
    if (!jsonStr) continue;
    const endIdx = startIdx + jsonStr.length;
    if (best && endIdx < best.endIdx) continue;
    let metadata;
    try {
      metadata = JSON.parse(jsonStr);
    } catch {
      continue;
    }
    if (!isControlMetadata(metadata)) continue;
    best = { jsonStr, metadata, endIdx };
  }
  if (!best) return repairTruncatedControlJson(message);
  return { jsonStr: best.jsonStr, metadata: best.metadata };
}

const CONTROL_JSON_START_RE =
  /\{\s*"(?:upload_required|session_terminated|payment_required|batch_form|multi_select|session_state)"\s*:/g;
const TRAILING_HIDDEN_MARKERS_RE = /(?:\s*<span\s+hidden[^>]*>\s*<\/span>)+\s*$/i;

/**
 * Large control JSON (e.g. a gift register copied into session_state) sometimes ends one or
 * more brackets short ("…}]}}" for an object that needs "…}]}}}"). Starting at the last
 * "{" that opens a control object, close whatever is still open, in order, and parse.
 */
function repairTruncatedControlJson(message) {
  let startIdx = -1;
  for (const m of message.matchAll(CONTROL_JSON_START_RE)) startIdx = m.index ?? startIdx;
  if (startIdx === -1) return null;
  const body = message.slice(startIdx).replace(TRAILING_HIDDEN_MARKERS_RE, "").trimEnd();
  const stack = [];
  let inString = false;
  let escapeNext = false;
  let end = body.length;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (escapeNext) { escapeNext = false; continue; }
    if (ch === "\\") { escapeNext = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") {
      if (stack.pop() !== ch) return null;
      if (stack.length === 0) { end = i + 1; break; }
    }
  }
  if (inString) return null;
  const jsonStr = body.slice(0, end) + stack.reverse().join("");
  try {
    const metadata = JSON.parse(jsonStr);
    if (!isControlMetadata(metadata)) return null;
    console.warn("[ControlParse] Repaired truncated control JSON", { closed: stack.length });
    return { jsonStr: body.slice(0, end), metadata };
  } catch {
    return null;
  }
}

const CONTROL_JSON_SCAN_LIMIT = 200;

/** Key tokens that only appear in control JSON ("key": …), never in prose. */
const CONTROL_KEY_TOKEN_RE =
  /"(upload_required|upload_type|upload_reason|session_terminated|termination_message|payment_required|multi_select|batch_form|document_ready|guest_signup_offer|selected_language|session_state)"\s*:/;

export function hasControlKeyToken(message) {
  return CONTROL_KEY_TOKEN_RE.test(String(message || ""));
}

function salvageFlag(text, key) {
  return new RegExp(`"${key}"\\s*:\\s*(?:true|"true")`, "i").test(text);
}

function salvageString(text, key) {
  const m = new RegExp(`"${key}"\\s*:\\s*"([^"\\\\]{1,200})"`).exec(text);
  return m ? m[1] : null;
}

/**
 * Control JSON was emitted but does not parse (e.g. missing brace). Read only
 * explicit `"flag": true` pairs the model wrote; never keyword-scan the text.
 */
function salvageMalformedControl(message) {
  const tail = message.slice(-300);
  console.warn("[ControlParse] Control JSON present but unparseable", { tail });
  const requiresUpload = salvageFlag(message, "upload_required");
  const uploadType = salvageString(message, "upload_type");
  const sessionTerminated = salvageFlag(message, "session_terminated");
  return {
    ...emptyUploadInfo(stripControlJsonFromDisplay(message)),
    requiresUpload,
    uploadType: requiresUpload ? uploadType || "initial" : null,
    reason: requiresUpload ? salvageString(message, "upload_reason") : null,
    sessionTerminated,
    terminationMessage: sessionTerminated
      ? salvageString(message, "termination_message") ||
        terminationBarrierMessage(detectChatLanguageFromText(message))
      : null,
    paymentRequired: salvageFlag(message, "payment_required"),
    multiSelect: salvageFlag(message, "multi_select"),
    batchForm: salvageFlag(message, "batch_form"),
  };
}

function extractBalancedJson(message, startIdx) {
  let braceCount = 0;
  let inString = false;
  let escapeNext = false;
  let endIdx = -1;

  for (let i = startIdx; i < message.length; i++) {
    const char = message[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === "{") {
        braceCount++;
      } else if (char === "}") {
        braceCount--;
        if (braceCount === 0) {
          endIdx = i;
          break;
        }
      }
    }
  }

  if (endIdx === -1) return null;
  return message.substring(startIdx, endIdx + 1);
}

function parseControlJsonBlock(jsonStr) {
  try {
    const metadata = JSON.parse(jsonStr);
    if (!isControlMetadata(metadata)) return null;
    return { jsonStr, metadata };
  } catch {
    return null;
  }
}

const CONTROL_JSON_MARKERS = [
  '"upload_required"',
  '"session_terminated"',
  '"payment_required"',
  '"multi_select"',
  '"batch_form"',
  '"document_ready"',
  '"guest_signup_offer"',
  '"selected_language"',
  '"session_state"',
];

function tailLooksLikeControlJson(text) {
  if (CONTROL_JSON_MARKERS.some((marker) => text.includes(marker))) {
    return true;
  }
  if (
    isProgressEnabled() &&
    PROGRESS_CONTROL_KEYS.some((k) => text.includes(`"${k}"`))
  ) {
    return true;
  }
  return /\b(session_state|upload_required|guest_signup_offer|session_terminated|payment_required|multi_select|batch_form|document_ready|selected_language)\b/.test(
    text
  );
}

function removeInlineControlJsonBlocks(text) {
  let out = text;
  let changed = true;

  while (changed) {
    changed = false;
    let idx = 0;
    while (idx < out.length) {
      const start = out.indexOf("{", idx);
      if (start === -1) break;

      const block = extractBalancedJson(out, start);
      if (block) {
        try {
          const metadata = JSON.parse(block);
          if (isControlMetadata(metadata) || metadata.session_state) {
            out = (out.slice(0, start) + out.slice(start + block.length)).trim();
            changed = true;
            idx = Math.max(0, start - 1);
            continue;
          }
        } catch {
          // not valid JSON — keep scanning
        }
      }
      idx = start + 1;
    }
  }

  return out;
}

function looksLikeStreamingJsonFragment(tail) {
  if (!tail || !tail.startsWith("{")) return false;
  if (tail === "{" || tail === "{\n" || tail === "{\r\n") return true;
  const inner = tail.slice(1);
  if (!inner.trim()) return true;
  if (tailLooksLikeControlJson(tail)) return true;
  if (inner.includes(":") || inner.includes('"')) return true;
  return false;
}

/**
 * Hide incomplete control JSON while streaming (before closing brace arrives).
 */
export function stripPartialTrailingControlJson(message) {
  if (!message || typeof message !== "string") return message || "";

  let text = message;
  const trimmedStart = text.trimStart();

  if (trimmedStart.startsWith("{") && looksLikeStreamingJsonFragment(trimmedStart)) {
    const complete = extractBalancedJson(text, text.indexOf("{"));
    if (!complete) return "";
  }

  const lines = text.split("\n");
  const lastLine = lines[lines.length - 1] ?? "";
  if (lastLine.trim().startsWith("{")) {
    const tailFromBrace = lastLine.slice(lastLine.indexOf("{"));
    if (looksLikeStreamingJsonFragment(tailFromBrace)) {
      text = lines.slice(0, -1).join("\n").trimEnd();
    }
  }

  let lastBrace = text.lastIndexOf("{");
  while (lastBrace !== -1) {
    const tail = text.slice(lastBrace);
    const balanced = extractBalancedJson(text, lastBrace);

    if (balanced) {
      try {
        const metadata = JSON.parse(balanced);
        if (isControlMetadata(metadata) || metadata.session_state) {
          text = text.slice(0, lastBrace).trimEnd();
          lastBrace = text.lastIndexOf("{");
          continue;
        }
      } catch {
        // not control JSON
      }
      break;
    }

    if (looksLikeStreamingJsonFragment(tail)) {
      text = text.slice(0, lastBrace).trimEnd();
      lastBrace = text.lastIndexOf("{");
      continue;
    }
    break;
  }

  return text;
}

/** Remove trailing control/session JSON from assistant text shown to users. */
export function stripControlJsonFromDisplay(message) {
  if (!message || typeof message !== "string") return message || "";

  let text = message;
  let prev = null;

  while (text !== prev) {
    prev = text;
    const controlJson = extractControlJsonFromMessage(text);
    if (controlJson?.jsonStr) {
      text = text.replace(controlJson.jsonStr, "").trim();
    }
  }

  const lines = text.trimEnd().split("\n");
  const lastLine = lines[lines.length - 1]?.trim();
  if (lastLine?.startsWith("{") && lastLine.includes("session_state")) {
    text = lines.slice(0, -1).join("\n").trim();
  }

  text = removeInlineControlJsonBlocks(text);
  text = stripPartialTrailingControlJson(text);
  text = stripPartialTrailingControlJson(text);
  text = text.replace(/```json\s*[\s\S]*?```/gi, "").trim();
  return text;
}

const emptyUploadInfo = (cleanMessage = "") => ({
  requiresUpload: false,
  uploadType: null,
  reason: null,
  sessionTerminated: false,
  terminationMessage: null,
  paymentRequired: false,
  multiSelect: false,
  batchForm: false,
  documentReady: false,
  cleanMessage,
  documentData: null,
  finalResponse: null,
  guestSignupOffer: false,
  selectedLanguage: null,
  sessionState: null,
});

export const extractUploadRequirement = (message) => {
  if (!message || typeof message !== "string") {
    return emptyUploadInfo(message || "");
  }

  const controlJson = extractControlJsonFromMessage(message);

  let documentData = null;
  let cleanMessage = message;

  if (controlJson) {
    try {
      const metadata = controlJson.metadata;
      const jsonMatch = controlJson.jsonStr;
      const hasStandardControl =
        metadata.hasOwnProperty("upload_required") ||
        metadata.hasOwnProperty("session_terminated") ||
        metadata.hasOwnProperty("payment_required") ||
        metadata.hasOwnProperty("multi_select") ||
        metadata.hasOwnProperty("batch_form") ||
        metadata.hasOwnProperty("document_ready");
      const hasGuestOffer =
        metadata.hasOwnProperty("guest_signup_offer");
      const hasSessionState =
        metadata.hasOwnProperty("session_state");
      const progressOn = isProgressEnabled();
      const hasProgress =
        progressOn &&
        PROGRESS_CONTROL_KEYS.some((k) => metadata.hasOwnProperty(k));

      if (hasStandardControl || hasGuestOffer || hasSessionState || hasProgress) {
        const sessionTerminatedFlag =
          metadata.session_terminated === true ||
          metadata.session_terminated === "true";
        const guestSignupOfferFlag =
          metadata.guest_signup_offer === true ||
          metadata.guest_signup_offer === "true";
        if (sessionTerminatedFlag) {
          const docResult = extractDocumentData(message);
          documentData = docResult.data;

          if (documentData && docResult.startIdx !== -1 && docResult.endIdx !== -1) {
            const beforeDoc = message.substring(0, docResult.startIdx);
            const afterDoc = message.substring(docResult.endIdx);
            message = (beforeDoc + afterDoc).trim();
          }
        }

        cleanMessage = message.replace(jsonMatch, "").trim();
        cleanMessage = stripControlJsonFromDisplay(cleanMessage);

        if (documentData) {
          cleanMessage = cleanMessage.replace(/\n\s*\{[\s\n]*"document_type"[\s\S]*?\}\s*/g, "").trim();
          cleanMessage = cleanMessage.replace(/\{[\s\n]*"document_type"[\s\S]*?\}\s*/g, "").trim();
          cleanMessage = cleanMessage.replace(/\s*\{[\s\n]*"document_type"[\s\S]*?\}\s*$/g, "").trim();
        }

        const nestedState =
          metadata.session_state && typeof metadata.session_state === "object"
            ? metadata.session_state
            : {};
        const progressFields = progressOn
          ? {
              progress: normalizeProgress(
                metadata.progress ?? nestedState.progress
              ),
              batchLabel: normalizeBatchLabel(
                metadata.batch_label ?? nestedState.batch_label
              ),
            }
          : {};

        return {
          ...progressFields,
          questionsRemaining: normalizeQuestionsRemaining(
            metadata.questions_remaining ?? nestedState.questions_remaining
          ),
          requiresUpload:
            metadata.upload_required === true ||
            metadata.upload_required === "true",
          uploadType: metadata.upload_type || null,
          reason: metadata.upload_reason || null,
          sessionTerminated:
            metadata.session_terminated === true ||
            metadata.session_terminated === "true",
          terminationMessage: metadata.termination_message || null,
          paymentRequired:
            metadata.payment_required === true ||
            metadata.payment_required === "true",
          multiSelect:
            metadata.multi_select === true ||
            metadata.multi_select === "true",
          batchForm:
            metadata.batch_form === true ||
            metadata.batch_form === "true",
          documentReady: false,
          cleanMessage: cleanMessage,
          documentData: documentData,
          finalResponse:
            typeof metadata.final_response === "string" &&
            metadata.final_response.trim().length > 0
              ? metadata.final_response.trim()
              : null,
          guestSignupOffer: guestSignupOfferFlag,
          selectedLanguage:
            typeof metadata.selected_language === "string"
              ? metadata.selected_language.trim()
              : null,
          sessionState:
            metadata.session_state && typeof metadata.session_state === "object"
              ? metadata.session_state
              : null,
        };
      }
    } catch (parseError) {
      console.warn(
        "Failed to parse metadata JSON, falling back to regex:",
        parseError
      );
    }
  }

  // Unparseable control JSON: its key names contain "upload"/"terminate", so
  // the keyword scan below must never see it.
  if (hasControlKeyToken(message)) {
    return salvageMalformedControl(message);
  }

  const lowerMessage = message.toLowerCase();
  const uploadKeywords = [
    "upload",
    "re-upload",
    "reupload",
    "please upload",
    "need to upload",
    "upload the document",
    "upload your document",
    "upload a document",
    "upload the file",
    "upload your file",
    "upload a file",
    "upload again",
    "upload your will again",
    "upload again in",
    "please upload again",
    "upload your will",
    "upload your document again",
    "upload the document again",
    "upload the file again",
    "upload your file again",
    "upload it again",
    "upload once more",
    "upload one more time",
    "kindly upload",
    "upload now",
  ];

  const requiresUpload = uploadKeywords.some((keyword) =>
    lowerMessage.includes(keyword)
  );
  const isReUpload =
    requiresUpload &&
    (lowerMessage.includes("re-upload") ||
      lowerMessage.includes("reupload") ||
      lowerMessage.includes("upload again") ||
      lowerMessage.includes("upload your will again"));

  const terminationKeywords = [
    "session is over",
    "session over",
    "exit or start a new session",
    "can exit or start",
    "terminate",
    "end the session",
  ];
  const sessionTerminated = terminationKeywords.some((keyword) =>
    lowerMessage.includes(keyword)
  );

  let fallbackDocumentData = null;
  if (sessionTerminated) {
    const docResult = extractDocumentData(message);
    fallbackDocumentData = docResult.data;

    if (fallbackDocumentData && docResult.startIdx !== -1 && docResult.endIdx !== -1) {
      cleanMessage = message.substring(0, docResult.startIdx) +
                    message.substring(docResult.endIdx);
      cleanMessage = cleanMessage.trim();
      cleanMessage = cleanMessage.replace(/\n\s*\{[\s\n]*"document_type"[\s\S]*?\}\s*/g, "").trim();
      cleanMessage = cleanMessage.replace(/\{[\s\n]*"document_type"[\s\S]*?\}\s*/g, "").trim();
    }
  }

  return {
    ...emptyUploadInfo(message),
    requiresUpload,
    uploadType: isReUpload ? "re_upload" : requiresUpload ? "initial" : null,
    sessionTerminated: sessionTerminated,
    terminationMessage: sessionTerminated
      ? terminationBarrierMessage(detectChatLanguageFromText(message))
      : null,
    documentData: fallbackDocumentData,
  };
};

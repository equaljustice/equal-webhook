/**
 * Shared helpers for assistant reply parsing, payment/termination fallbacks,
 * and document snapshot persistence. Used by auth and guest chat routes.
 */

import { QA_PHASES } from "./sessionStateProtocol.js";

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
  "document_ready",
  "guest_signup_offer",
  "selected_language",
  "session_state",
];

function isControlMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(metadata, "session_state")) {
    return true;
  }
  return TOP_LEVEL_CONTROL_KEYS.some((k) =>
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

  let lastKeyIdx = -1;
  for (const key of TOP_LEVEL_CONTROL_KEYS) {
    const idx = message.lastIndexOf(`"${key}"`);
    if (idx > lastKeyIdx) lastKeyIdx = idx;
  }
  if (lastKeyIdx === -1) return null;

  const startIdx = message.lastIndexOf("{", lastKeyIdx);
  if (startIdx === -1) return null;

  const jsonStr = extractBalancedJson(message, startIdx);
  if (!jsonStr) return null;

  try {
    const metadata = JSON.parse(jsonStr);
    if (!isControlMetadata(metadata)) return null;
    return { jsonStr, metadata };
  } catch {
    return null;
  }
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
  '"document_ready"',
  '"guest_signup_offer"',
  '"selected_language"',
  '"session_state"',
];

function tailLooksLikeControlJson(text) {
  if (CONTROL_JSON_MARKERS.some((marker) => text.includes(marker))) {
    return true;
  }
  return /\b(session_state|upload_required|guest_signup_offer|session_terminated|payment_required|multi_select|document_ready|selected_language)\b/.test(
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
        metadata.hasOwnProperty("document_ready");
      const hasGuestOffer =
        metadata.hasOwnProperty("guest_signup_offer");
      const hasSessionState =
        metadata.hasOwnProperty("session_state");

      if (hasStandardControl || hasGuestOffer || hasSessionState) {
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

        return {
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

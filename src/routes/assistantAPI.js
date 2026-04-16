import express from "express";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { jwtAuth } from "../middleware/jwtAuth.js";
import { Assistant } from "../model/assistant.model.js";
import { Session } from "../model/sesssion.model.js";
import path from "path";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import os from "os";
import { SPECIAL_ACCESS_USER_IDS } from "../../constants.js";
import { readPromptFile } from "../utils/promptManager.js";
import {
  generateDocument,
  getDocumentFilename,
} from "../utils/documentGenerator.js";

const router = express.Router();
const OPENAI_RUN_POLL_MAX_ATTEMPTS = 120; // ~2 minutes at 1s poll
const GEMINI_STREAM_TIMEOUT_MS = 120000; // 2 minutes

// Configure multer for temporary file storage
const upload = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept PDF, DOCX, and image files
    const allowedMimes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "image/jpeg",
      "image/png",
      "image/jpg",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error("Invalid file type. Only PDF, DOCX, and images are allowed."),
        false
      );
    }
  },
});

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Helper function to check if user has special access (no payment required)
const hasSpecialAccess = (userId) => {
  return SPECIAL_ACCESS_USER_IDS.includes(userId);
};

/** Map assistantKey → docDownloadAvailable (explicit true only). */
async function docDownloadFlagByAssistantKeys(assistantKeys) {
  const keys = [...new Set((assistantKeys || []).filter(Boolean))];
  if (keys.length === 0) return {};
  const rows = await Assistant.find({ key: { $in: keys } })
    .select("key docDownloadAvailable")
    .lean();
  const map = {};
  for (const row of rows) {
    map[row.key] = row.docDownloadAvailable === true;
  }
  return map;
}

const getCyclePayableAmount = (session, cycleNumber) => {
  if ((cycleNumber || 0) <= 1) {
    return session.price;
  }
  return typeof session.additionalPrice === "number"
    ? session.additionalPrice
    : session.price;
};

const withTimeout = (promise, ms, label = "Operation") => {
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
 * This prevents the "random content" bug where the LLM hallucinates document sections.
 */
const buildDocumentDataFromMessage = (cleanMessage, session, llmDocData) => {
  const assistantKey = session?.assistantKey || "document";
  const sessionTitle = session?.title || "Document";

  return {
    document_type: llmDocData?.document_type || assistantKey,
    title: llmDocData?.title || sessionTitle,
    content: {
      sections: [
        {
          type: "html",
          text: cleanMessage, // The actual final response the user saw
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

/** Minimum length for treating an assistant reply as a downloadable document body. */
const DOCUMENT_SNAPSHOT_MIN_LENGTH = 200;

/**
 * Walk backward through session.messages to find the last substantive
 * assistant message (the actual legal document), skipping short
 * termination / acknowledgement messages.
 * Returns the content string, or null if nothing qualifies.
 */
const findLastSubstantiveMessage = (session) => {
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
 * Persist finalDocumentData when the model signals session end and/or a completed
 * generated document (document_ready), so downloads work before termination
 * (e.g. multi-notice salary flow).
 */
const persistSessionDocumentSnapshot = (session, sessionId, uploadInfo, cleanMessage) => {
  const terminated = uploadInfo.sessionTerminated;
  const docReady = uploadInfo.documentReady;
  if (!terminated && !docReady) return;

  // Closing-only turn after document_ready: keep the last captured artifact (e.g. Will before
  // signing guidance, or latest notice in multi-notice flow). Legacy flows without
  // document_ready still set finalDocumentData only here.
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

// Helper function to extract structured document data from assistant message
// Returns both the document data and the indices for removal
const extractDocumentData = (message) => {
  if (!message || typeof message !== "string") {
    return { data: null, startIdx: -1, endIdx: -1 };
  }

  // Find the start of the document JSON by looking for "document_type"
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

  // Find the matching closing brace by counting braces
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

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
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

  // Extract and parse the JSON
  try {
    const jsonStr = message.substring(startIdx, endIdx + 1);
    const documentData = JSON.parse(jsonStr);
    
    // Validate that it has document_type field
    if (documentData && documentData.hasOwnProperty("document_type")) {
      return { data: documentData, startIdx, endIdx: endIdx + 1 };
    }
  } catch (parseError) {
    console.warn("Failed to parse document data JSON:", parseError.message);
    return { data: null, startIdx: -1, endIdx: -1 };
  }

  return { data: null, startIdx: -1, endIdx: -1 };
};

/**
 * Best-effort language detection based on unicode script ranges.
 * This is only used for backend-generated fallback messages (payment/termination),
 * because the main Q&A flow content is generated by the model in the chosen language.
 * @param {string} text
 * @returns {"en"|"hi"|"bn"|"gu"|"pa"|"ta"|"te"|"kn"|"or"|"ur"}
 */
function detectChatLanguageFromText(text = "") {
  const s = String(text);

  // Urdu (Arabic script)
  if (/[\u0600-\u06FF\u0750-\u077F]/.test(s)) return "ur";

  // Devanagari (Hindi/Marathi/Bhojpuri)
  if (/[\u0900-\u097F]/.test(s)) return "hi";

  // Gujarati
  if (/[\u0A80-\u0AFF]/.test(s)) return "gu";

  // Gurmukhi (Punjabi)
  if (/[\u0A00-\u0A7F]/.test(s)) return "pa";

  // Tamil
  if (/[\u0B80-\u0BFF]/.test(s)) return "ta";

  // Telugu
  if (/[\u0C00-\u0C7F]/.test(s)) return "te";

  // Kannada
  if (/[\u0C80-\u0CFF]/.test(s)) return "kn";

  // Odia
  if (/[\u0B00-\u0B7F]/.test(s)) return "or";

  // Bengali/Assamese
  if (/[\u0980-\u09FF]/.test(s)) return "bn";

  return "en";
}

function paymentBarrierMessage(language) {
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

/**
 * Extract the final control JSON block from any position within the message.
 * The control JSON must contain at least one of:
 * upload_required, session_terminated, payment_required, document_ready
 * @param {string} message
 * @returns {null | { jsonStr: string, metadata: any }}
 */
function extractControlJsonFromMessage(message) {
  if (!message || typeof message !== "string") return null;

  const controlKeys = [
    "upload_required",
    "session_terminated",
    "payment_required",
    "document_ready",
  ];

  // Find the latest occurrence of any control key so we target the final JSON.
  let lastKeyIdx = -1;
  for (const key of controlKeys) {
    const idx = message.lastIndexOf(`"${key}"`);
    if (idx > lastKeyIdx) lastKeyIdx = idx;
  }
  if (lastKeyIdx === -1) return null;

  // The control JSON should start at the nearest '{' before the key.
  const startIdx = message.lastIndexOf("{", lastKeyIdx);
  if (startIdx === -1) return null;

  // Brace-match to find the end of the JSON object.
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

  const jsonStr = message.substring(startIdx, endIdx + 1);
  try {
    const metadata = JSON.parse(jsonStr);
    const hasAnyControlKey = controlKeys.some((k) =>
      Object.prototype.hasOwnProperty.call(metadata, k)
    );
    if (!hasAnyControlKey) return null;
    return { jsonStr, metadata };
  } catch {
    return null;
  }
}

// Helper function to extract structured upload requirement and session termination from assistant message
const extractUploadRequirement = (message) => {
  if (!message || typeof message !== "string") {
    return {
      requiresUpload: false,
      uploadType: null,
      reason: null,
      sessionTerminated: false,
      terminationMessage: null,
      paymentRequired: false,
      documentReady: false,
      cleanMessage: message || "",
      documentData: null,
      finalResponse: null,
    };
  }

  // Extract structured control JSON from anywhere inside the assistant reply.
  // This is important for non-English languages where the model might append
  // trailing whitespace/punctuation after the JSON.
  const controlJson = extractControlJsonFromMessage(message);

  let documentData = null;
  let cleanMessage = message;

  if (controlJson) {
    try {
      const metadata = controlJson.metadata;
      const jsonMatch = controlJson.jsonStr;
      // Validate that it has the expected structure
      if (
        metadata.hasOwnProperty("upload_required") ||
        metadata.hasOwnProperty("session_terminated") ||
        metadata.hasOwnProperty("payment_required") ||
        metadata.hasOwnProperty("document_ready")
      ) {
        const documentReadyFlag =
          metadata.document_ready === true || metadata.document_ready === "true";
        const sessionTerminatedFlag =
          metadata.session_terminated === true ||
          metadata.session_terminated === "true";
        // Extract optional embedded {"document_type":...} when ending and/or
        // when a final artifact is emitted mid-session
        if (sessionTerminatedFlag || documentReadyFlag) {
          const docResult = extractDocumentData(message);
          documentData = docResult.data;

          if (documentData && docResult.startIdx !== -1 && docResult.endIdx !== -1) {
            const beforeDoc = message.substring(0, docResult.startIdx);
            const afterDoc = message.substring(docResult.endIdx);
            message = (beforeDoc + afterDoc).trim();
          }
        }

        // Extract clean message (remove termination JSON/control JSON block)
        cleanMessage = message.replace(jsonMatch, "").trim();
        
        // Final cleanup: remove any remaining document JSON patterns (safety net)
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
          documentReady: documentReadyFlag,
          cleanMessage: cleanMessage,
          documentData: documentData,
          finalResponse:
            typeof metadata.final_response === "string" &&
            metadata.final_response.trim().length > 0
              ? metadata.final_response.trim()
              : null,
        };
      }
    } catch (parseError) {
      // If JSON parsing fails, fall back to old regex method for backward compatibility
      console.warn(
        "Failed to parse metadata JSON, falling back to regex:",
        parseError
      );
    }
  }

  // Fallback: Use old regex-based detection for backward compatibility
  // This will be removed once all assistants are updated with structured output
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

  // Fallback termination detection (regex-based for backward compatibility)
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

  // Even in fallback mode, try to extract document data if session is terminated
  let fallbackDocumentData = null;
  if (sessionTerminated) {
    const docResult = extractDocumentData(message);
    fallbackDocumentData = docResult.data;
    
    // Remove document JSON from clean message in fallback mode too
    if (fallbackDocumentData && docResult.startIdx !== -1 && docResult.endIdx !== -1) {
      cleanMessage = message.substring(0, docResult.startIdx) + 
                    message.substring(docResult.endIdx);
      cleanMessage = cleanMessage.trim();
      // Also remove any leading/trailing newlines
      cleanMessage = cleanMessage.replace(/\n\s*\{[\s\n]*"document_type"[\s\S]*?\}\s*/g, "").trim();
      cleanMessage = cleanMessage.replace(/\{[\s\n]*"document_type"[\s\S]*?\}\s*/g, "").trim();
    }
  }

  return {
    requiresUpload,
    uploadType: isReUpload ? "re_upload" : requiresUpload ? "initial" : null,
    reason: null,
    sessionTerminated: sessionTerminated,
    terminationMessage: sessionTerminated
      ? terminationBarrierMessage(detectChatLanguageFromText(message))
      : null,
    paymentRequired: false,
    documentReady: false,
    cleanMessage: message,
    documentData: fallbackDocumentData,
    finalResponse: null,
  };
};

//Create Assistant instance into db
router.post("/create", async (req, res) => {
  const {
    name,
    key,
    id,
    price,
    actualPrice,
    additionalPrice,
    actualAdditionalPrice,
    desc,
    provider,
    config,
  } = req.body;

  if (!name || !key || !id || !price || !desc || !provider) {
    return res.status(404).json({ message: "Info is required" });
  }

  try {
    const payload = {
      name,
      key,
      assistantId: id,
      price,
      actualPrice: typeof actualPrice === "number" ? actualPrice : price,
      additionalPrice:
        typeof additionalPrice === "number" ? additionalPrice : price,
      actualAdditionalPrice:
        typeof actualAdditionalPrice === "number"
          ? actualAdditionalPrice
          : typeof actualPrice === "number"
            ? actualPrice
            : typeof additionalPrice === "number"
              ? additionalPrice
              : price,
      description: desc,
      provider,
      docDownloadAvailable: req.body.docDownloadAvailable === true,
      config: config || {},
    };
    const response = await Assistant.create(payload);
    return res.status(201).json(response);
  } catch (error) {
    return res.status(500).json({
      message: "Error creating assistant",
      error: error.message,
    });
  }
});

//Modify a assistant
router.put("/update/:assistantId", async (req, res) => {
  const { assistantId } = req.params;
  const updateFields = {};
  const allowedFields = [
    "name",
    "key",
    "assistantId",
    "price",
    "actualPrice",
    "additionalPrice",
    "actualAdditionalPrice",
    "description",
    "provider",
    "docDownloadAvailable",
    "config",
  ];

  // Prepare an update object only with provided allowed fields
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updateFields[field] = req.body[field];
    }
  }

  if (Object.keys(updateFields).length === 0) {
    return res
      .status(400)
      .json({ message: "No valid fields provided to update" });
  }

  try {
    // Check for unique key and assistantId if updating them
    if (updateFields.key) {
      const exists = await Assistant.findOne({
        key: updateFields.key,
        _id: { $ne: assistantId },
      });
      if (exists) {
        return res
          .status(409)
          .json({ message: "Key already in use by another assistant" });
      }
    }
    if (updateFields.assistantId) {
      const exists = await Assistant.findOne({
        assistantId: updateFields.assistantId,
        _id: { $ne: assistantId },
      });
      if (exists) {
        return res
          .status(409)
          .json({ message: "assistantId already in use by another assistant" });
      }
    }

    // Find and update the assistant
    const assistant = await Assistant.findByIdAndUpdate(
      assistantId,
      { $set: updateFields },
      { new: true }
    );
    if (!assistant) {
      return res.status(404).json({ message: "Assistant not found!" });
    }

    return res
      .status(200)
      .json({ message: "Assistant updated successfully", assistant });
  } catch (error) {
    return res.status(500).json({
      message: "Error updating assistant",
      error: error.message,
    });
  }
});

router.get("/listall", async (req, res) => {
  try {
    const assistants = await Assistant.find({});
    return res.status(200).json({ assistants });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching assistants",
      error: error.message,
    });
  }
});

//Create a new session
router.post("/start-session", jwtAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { key } = req.body;

    //Find AssistantId from key
    const assistant = await Assistant.findOne({ key });

    if (!assistant) {
      return res.status(404).json({ message: "Assistant not found!" });
    }
    const assistantId = assistant.assistantId;
    const sessionKey = assistant.key;

    // return res.status(200).json({
    //   assistantId,
    //   userId,
    // });

    let threadId = undefined;
    let geminiConfig = undefined;
    let provider = assistant.provider || "openai";

    if (provider === "openai") {
      //Create a new thread - OpenAI flow
      const thread = await client.beta.threads.create();
      threadId = thread.id;
    } else if (provider === "gemini") {
      // For Gemini, threadId may not be needed, but store config
      const { v4: uuidv4 } = await import("uuid");
      geminiConfig = assistant.config || {};
      threadId = uuidv4(); // Use a unique threadId (uuid) for Gemini
    }

    //Create session in DB
    const startedOn = new Date();
    const endedOn = new Date(startedOn.getTime() + 7 * 24 * 60 * 60 * 1000);

    const isSpecialAccess = hasSpecialAccess(userId);
    // deferPayment: true  → Q&A is free, payment triggered by AI before final output
    // deferPayment: false → original flow, payment required upfront before chatting
    const deferPayment = assistant.config?.deferPayment === true;
    const isPaid = isSpecialAccess || deferPayment ? true : false;

    // Check if assistant supports multiple file uploads
    const supportsMultipleUploads =
      assistant.config?.supportsMultipleUploads === true;

    const session = await Session.create({
      userId,
      assistantId,
      threadId,
      title: assistant.name,
      assistantKey: sessionKey,
      price: assistant.price,
      actualPrice:
        typeof assistant.actualPrice === "number"
          ? assistant.actualPrice
          : assistant.price,
      additionalPrice:
        typeof assistant.additionalPrice === "number"
          ? assistant.additionalPrice
          : assistant.price,
      actualAdditionalPrice:
        typeof assistant.actualAdditionalPrice === "number"
          ? assistant.actualAdditionalPrice
          : typeof assistant.actualPrice === "number"
            ? assistant.actualPrice
            : typeof assistant.additionalPrice === "number"
              ? assistant.additionalPrice
              : assistant.price,
      startedOn,
      endedOn,
      provider,
      geminiConfig,
      isPaid,
      supportsMultipleUploads,
    });

    //Send SuccessMessage
    return res.status(201).json({
      message: "Session created successfully",
      sessionId: session._id,
      threadId: threadId,
      provider,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create session" });
  }
});

//Fetch All User sessions
router.get("/get-sessions", jwtAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const sessions = await Session.find({ userId }).lean();
    if (!sessions?.length) {
      return res.status(200).json(sessions || []);
    }
    const keyToDoc = await docDownloadFlagByAssistantKeys(
      sessions.map((s) => s.assistantKey)
    );
    const enriched = sessions.map((s) => ({
      ...s,
      docDownloadAvailable:
        !!(s.assistantKey && keyToDoc[s.assistantKey] === true),
    }));
    return res.status(200).json(enriched);
  } catch (error) {
    return res.status(500).json({
      error: error.message,
      message: "Error fetching User Sessions",
    });
  }
});

// Delete Session by ID
router.delete("/delete-session/:sessionId", jwtAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    // Find session and ensure it belongs to the requesting user
    const session = await Session.findOne({ _id: sessionId, userId });
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    await Session.deleteOne({ _id: sessionId });

    return res.status(200).json({ message: "Session deleted successfully" });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
      message: "Failed to delete session",
    });
  }
});

// Upload document(s) for Gemini file analysis - supports both single and multiple files
router.post(
  "/upload-document",
  jwtAuth,
  upload.array("documents", 10), // Support up to 10 files, field name: "documents"
  async (req, res) => {
    try {
      const files = req.files || (req.file ? [req.file] : []); // Support both single and multiple
      const { sessionId } = req.body;
      const userId = req.user.id;

      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No file(s) uploaded" });
      }

      // If sessionId is provided, validate and link to session
      let session = null;
      if (sessionId) {
        session = await Session.findOne({ _id: sessionId, userId });
        if (!session) {
          // Clean up temp files
          const fs = await import("fs/promises");
          for (const file of files) {
            await fs.unlink(file.path).catch(() => {});
          }
          return res.status(404).json({ error: "Session not found" });
        }
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const fs = await import("fs/promises");

      // Helper function to upload a single file to Gemini
      const uploadFileToGemini = async (file) => {
        // Read file buffer
        const fileBuffer = await fs.readFile(file.path);

        // Determine mimeType with fallback
        let mimeType = file.mimetype;
        if (!mimeType || mimeType === "application/octet-stream") {
          // Fallback based on file extension
          const ext = path.extname(file.originalname || "").toLowerCase();
          const mimeTypes = {
            ".pdf": "application/pdf",
            ".doc": "application/msword",
            ".docx":
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
          };
          mimeType = mimeTypes[ext] || "application/pdf";
        }

        // Upload file to Gemini Files API
        let uploadResponse;
        try {
          // Format 1: Using file path with config containing mimeType
          uploadResponse = await ai.files.upload({
            file: file.path,
            config: {
              mimeType: mimeType,
              displayName: file.originalname || `document_${uuidv4()}`,
            },
          });
        } catch (pathErr) {
          // Format 2: Using file buffer if path doesn't work
          uploadResponse = await ai.files.upload({
            file: fileBuffer,
            config: {
              mimeType: mimeType,
              displayName: file.originalname || `document_${uuidv4()}`,
            },
          });
        }

        // Extract file URI from response (handle different response structures)
        const fileId =
          uploadResponse?.file?.uri ||
          uploadResponse?.file?.name ||
          uploadResponse?.uri ||
          uploadResponse?.fileId ||
          uploadResponse?.name;

        if (!fileId) {
          throw new Error(
            "Failed to extract file ID from Gemini upload response"
          );
        }

        return fileId;
      };

      // Upload all files to Gemini
      const uploadedFiles = [];
      const fileErrors = [];

      for (const file of files) {
        try {
          const fileId = await uploadFileToGemini(file);
          uploadedFiles.push({
            fileId: fileId,
            fileName: file.originalname,
          });
          // Clean up temp file after successful upload
          await fs.unlink(file.path).catch(() => {});
        } catch (uploadErr) {
          // Clean up temp file on error
          await fs.unlink(file.path).catch(() => {});
          fileErrors.push({
            fileName: file.originalname,
            error: uploadErr.message,
          });
        }
      }

      // If all files failed, return error
      if (uploadedFiles.length === 0) {
        return res.status(500).json({
          error: "Failed to upload all files",
          errors: fileErrors,
        });
      }

      // If some files failed, include errors in response but continue
      const fileIds = uploadedFiles.map((f) => f.fileId);

      // If sessionId was provided, link fileIds to session and update upload status
      let assistantReply = null;
      if (session) {
        // Handle multiple uploads: append all new fileIds to array
        if (!session.uploadedFileIds) {
          session.uploadedFileIds = [];
        }
        // Add all newly uploaded files to the array
        for (const fileId of fileIds) {
          session.uploadedFileIds.push(fileId);
        }
        // Also keep uploadedFileId for backward compatibility (use latest)
        session.uploadedFileId = fileIds[fileIds.length - 1];

        session.isDocUploaded = true;
        session.isDocUploadRequired = false;
        // Remove uploadAttempts tracking - no longer needed

        // Automatically continue conversation with uploaded document
        try {
          // Create a message indicating document was uploaded
          const fileCount = session.supportsMultipleUploads
            ? session.uploadedFileIds?.length || 1
            : 1;
          const uploadMessage =
            fileCount > 1
              ? `${fileCount} documents uploaded successfully. Please analyze them.`
              : "Document uploaded successfully. Please analyze it.";

          if (session.provider === "gemini") {
            // Gemini logic - automatically process the uploaded document
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

            // Build history for context
            const history = (session.messages || []).map((msg) => ({
              role: msg.role === "user" ? "user" : "model",
              parts: [{ text: msg.content }],
            }));

            // Build message with uploaded file(s)
            const messageParts = [{ text: uploadMessage }];

            // Add all uploaded files to the message
            const filesToInclude = session.supportsMultipleUploads
              ? session.uploadedFileIds || fileIds
              : fileIds;

            for (const fileUri of filesToInclude) {
              if (fileUri) {
                messageParts.push({
                  fileData: {
                    fileUri: fileUri,
                  },
                });
              }
            }

            history.push({ role: "user", parts: messageParts });
            let config = session.geminiConfig || {};
            const model = config.model || "gemini-3-flash-preview";

            // Pull systemInstruction from assistant asset if available
            let systemInstructionText = undefined;
            try {
              const assistant = await Assistant.findOne({
                assistantId: session.assistantId,
              });
              if (
                assistant &&
                assistant.config &&
                assistant.config.systemInstructionAsset
              ) {
                try {
                  // Read from GCS (with local filesystem fallback)
                  systemInstructionText = await readPromptFile(
                    assistant.config.systemInstructionAsset
                  );
                } catch (err) {
                  // Continue without system instruction if file not found
                  console.warn(
                    `Failed to load system instruction: ${err.message}`
                  );
                }

                // Add file analysis instructions
                if (systemInstructionText) {
                  const fileCount = filesToInclude.length;
                  const fileText =
                    fileCount > 1 ? "documents have" : "document has";
                  systemInstructionText +=
                    `\n\nIMPORTANT: ${fileCount} uploaded ${fileText} been provided for analysis. ` +
                    "The uploaded document(s) are read-only. Do not invent missing clauses. " +
                    "If information is missing from the document(s), respond with 'Not found in document.' " +
                    "Follow the system rules strictly and analyze only what is present in the uploaded document(s).";

                  config = {
                    ...config,
                    systemInstruction: [{ text: systemInstructionText }],
                  };
                }
              }
            } catch (resolveErr) {
              // Continue without system instruction on error
            }

            // Generate assistant response
            let assistantMessage = "";
            try {
              await withTimeout(
                (async () => {
                  const response = await ai.models.generateContentStream({
                    model,
                    config,
                    contents: history,
                  });
                  for await (const chunk of response) {
                    if (chunk.text) {
                      assistantMessage += chunk.text;
                    }
                  }
                })(),
                GEMINI_STREAM_TIMEOUT_MS,
                "Gemini stream"
              );
              // Extract upload requirement from structured output
              const uploadInfo = extractUploadRequirement(assistantMessage);
              const cleanMessage = uploadInfo.cleanMessage || assistantMessage;
              assistantReply = cleanMessage;

              // Save messages to session (without JSON marker)
              session.messages.push({ role: "user", content: uploadMessage });
              session.messages.push({
                role: "assistant",
                content: cleanMessage,
              });

              const resolvedFinalResponse =
                typeof uploadInfo.finalResponse === "string" &&
                uploadInfo.finalResponse.trim().length > 0
                  ? uploadInfo.finalResponse.trim()
                  : null;
              if (resolvedFinalResponse) {
                session.final_response = resolvedFinalResponse;
              }

              persistSessionDocumentSnapshot(
                session,
                session._id,
                uploadInfo,
                cleanMessage
              );

              // Check if assistant is asking for re-upload in the auto-resume response
              const requiresReUpload =
                uploadInfo.requiresUpload &&
                uploadInfo.uploadType === "re_upload";
              if (requiresReUpload) {
                // Assistant is asking for re-upload, set the flag
                session.isDocUploadRequired = true;
                session.isDocUploaded = false;
                // For multiple uploads, don't clear all files - just mark as needing re-upload
                // For single upload, clear the fileId
                if (!session.supportsMultipleUploads) {
                  session.uploadedFileId = null;
                  session.uploadedFileIds = [];
                }
              }
            } catch (geminiErr) {
              // If Gemini fails, continue without assistant reply
              console.error(
                "Failed to generate assistant response after upload:",
                geminiErr
              );
            }
          } else if (session.provider === "openai") {
            // OpenAI logic - automatically process the uploaded document
            // Add message to thread
            await client.beta.threads.messages.create(session.threadId, {
              role: "user",
              content: uploadMessage,
            });

            // Run the assistant
            const run = await client.beta.threads.runs.create(
              session.threadId,
              {
                assistant_id: session.assistantId,
              }
            );

            // Poll until completed with bounded attempts (anti-stall)
            let runStatus;
            let attempts = 0;
            do {
              await new Promise((r) => setTimeout(r, 1000));
              runStatus = await client.beta.threads.runs.retrieve(
                session.threadId,
                run.id
              );
              attempts += 1;
            } while (
              runStatus.status !== "completed" &&
              attempts < OPENAI_RUN_POLL_MAX_ATTEMPTS
            );
            if (runStatus.status !== "completed") {
              throw new Error("OpenAI run did not complete in time");
            }

            // Fetch messages
            const messages = await client.beta.threads.messages.list(
              session.threadId
            );
            const assistantMessage =
              messages.data[0].content[0].text.value || "No response";

            // Extract upload requirement from structured output
            const uploadInfo = extractUploadRequirement(assistantMessage);
            const cleanMessage = uploadInfo.cleanMessage || assistantMessage;
            assistantReply = cleanMessage;

            // Save message history (without JSON marker)
            session.messages.push({ role: "user", content: uploadMessage });
            session.messages.push({
              role: "assistant",
              content: cleanMessage,
            });

            const resolvedFinalResponse =
              typeof uploadInfo.finalResponse === "string" &&
              uploadInfo.finalResponse.trim().length > 0
                ? uploadInfo.finalResponse.trim()
                : null;
            if (resolvedFinalResponse) {
              session.final_response = resolvedFinalResponse;
            }

            persistSessionDocumentSnapshot(
              session,
              session._id,
              uploadInfo,
              cleanMessage
            );

            // Check if assistant is asking for re-upload in the auto-resume response
            const requiresReUpload =
              uploadInfo.requiresUpload &&
              uploadInfo.uploadType === "re_upload";
            if (requiresReUpload) {
              // Assistant is asking for re-upload, set the flag
              session.isDocUploadRequired = true;
              session.isDocUploaded = false;
              session.uploadedFileId = null;
            }
          }
        } catch (autoContinueErr) {
          // If auto-continue fails, log but don't fail the upload
          console.error(
            "Failed to auto-continue conversation after upload:",
            autoContinueErr
          );
        }

        await session.save();
      }

      return res.status(200).json({
        fileIds: fileIds, // Array of all uploaded file IDs
        files: uploadedFiles, // Array of {fileId, fileName} objects
        message:
          uploadedFiles.length > 1
            ? `${uploadedFiles.length} files uploaded successfully`
            : "File uploaded successfully",
        assistantReply: assistantReply, // Include assistant's response if available
        conversationResumed: !!assistantReply,
        supportsMultipleUploads: session?.supportsMultipleUploads || false,
        totalUploadedFiles: session?.uploadedFileIds?.length || fileIds.length,
        uploadedFileIds: session?.uploadedFileIds || fileIds,
        // Backward compatibility - include single fileId and fileName
        fileId: fileIds[0], // First file ID for backward compatibility
        fileName: uploadedFiles[0]?.fileName,
        // Include errors if any files failed
        ...(fileErrors.length > 0 && { errors: fileErrors }),
      });
    } catch (error) {
      // Clean up temp file on error
      if (req.file?.path) {
        const fs = await import("fs/promises");
        await fs.unlink(req.file.path).catch(() => {});
      }
      return res.status(500).json({
        error: "File upload failed",
        message: error.message,
      });
    }
  }
);

//Send Message
router.post("/send-message", jwtAuth, async (req, res) => {
  try {
    const { sessionId, userMessage, fileId } = req.body;
    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });
    // Check payment (skip for special access users)
    const userId = req.user.id;
    const isSpecialAccess = hasSpecialAccess(userId);
    if (!session.isPaid && !isSpecialAccess) {
      return res
        .status(403)
        .json({ error: "Payment required before chatting" });
    }

    // Auto-mark as paid for special access users if not already marked
    if (isSpecialAccess && !session.isPaid) {
      session.isPaid = true;
      await session.save();
    }

    // Check if document upload is required but not completed
    if (session.isDocUploadRequired && !session.isDocUploaded) {
      return res.status(403).json({
        error: "Document upload required",
        requiresUpload: true,
      });
    }

    // Get all fileIds from session (support multiple uploads)
    // If fileId is provided directly, also update the session
    let filesToUse = [];
    if (
      session.supportsMultipleUploads &&
      session.uploadedFileIds?.length > 0
    ) {
      filesToUse = session.uploadedFileIds;
    } else if (session.uploadedFileId) {
      filesToUse = [session.uploadedFileId];
    } else if (fileId) {
      filesToUse = [fileId];
    }

    if (fileId && !session.uploadedFileId) {
      // If fileId is provided and session doesn't have one, save it
      if (session.supportsMultipleUploads) {
        if (!session.uploadedFileIds) {
          session.uploadedFileIds = [];
        }
        session.uploadedFileIds.push(fileId);
      }
      session.uploadedFileId = fileId;
      session.isDocUploaded = true;
      session.isDocUploadRequired = false; // Clear upload requirement when file is provided
      session.uploadAttempts = (session.uploadAttempts || 0) + 1;
    }

    if (session.provider === "gemini") {
      // Gemini logic
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      // Build history for context, if needed
      const history = (session.messages || []).map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      }));

      // Build current message parts
      const currentMessageParts = [{ text: userMessage }];

      // Add all uploaded files to the message (support multiple uploads)
      // Gemini API expects file references in parts array
      for (const fileUri of filesToUse) {
        if (fileUri) {
          currentMessageParts.push({
            fileData: {
              fileUri: fileUri,
            },
          });
        }
      }

      history.push({ role: "user", parts: currentMessageParts });
      let config = session.geminiConfig || {};
      const model = config.model || "gemini-3-flash-preview";
      // Pull systemInstruction from assistant asset if available
      let systemInstructionText = undefined;
      try {
        // Find the assistant for the session
        const assistant = await Assistant.findOne({
          assistantId: session.assistantId,
        });
        if (
          assistant &&
          assistant.config &&
          assistant.config.systemInstructionAsset
        ) {
          try {
            // Read from GCS (with local filesystem fallback)
            systemInstructionText = await readPromptFile(
              assistant.config.systemInstructionAsset
            );
          } catch (err) {
            // Return error if file not found (this is in send-message, so we should fail)
            return res.status(500).json({
              error: "systemInstruction file not found",
              message: err.message,
            });
          }
          // Add file analysis instructions if files are provided
          if (filesToUse.length > 0) {
            const fileCount = filesToUse.length;
            const fileText = fileCount > 1 ? "documents have" : "document has";
            systemInstructionText +=
              `\n\nIMPORTANT: ${fileCount} uploaded ${fileText} been provided for analysis. ` +
              "The uploaded document(s) are read-only. Do not invent missing clauses. " +
              "If information is missing from the document(s), respond with 'Not found in document.' " +
              "Follow the system rules strictly and analyze only what is present in the uploaded document(s).";
          }

          config = {
            ...config,
            systemInstruction: [{ text: systemInstructionText }],
          };
        }
      } catch (resolveErr) {
        return res.status(500).json({
          error: "Failed to resolve systemInstruction asset",
          message: resolveErr.message,
        });
      }
      let assistantMessage = "";
      let chunks = [];
      try {
        await withTimeout(
          (async () => {
            const response = await ai.models.generateContentStream({
              model,
              config,
              contents: history,
            });
            for await (const chunk of response) {
              if (chunk.text) {
                assistantMessage += chunk.text;
                chunks.push(chunk.text);
                // Optionally, stream chunk.text to client with res.write (for real streaming)
              }
            }
          })(),
          GEMINI_STREAM_TIMEOUT_MS,
          "Gemini stream"
        );
      } catch (geminiErr) {
        return res
          .status(500)
          .json({ error: geminiErr.message, message: "Gemini failed" });
      }
      // Extract upload requirement from structured output
      const uploadInfo = extractUploadRequirement(assistantMessage);
      let cleanMessage = uploadInfo.cleanMessage || assistantMessage;

      // HARD PAYMENT BARRIER: When AI signals payment is required, replace the
      // entire response with a safe payment prompt. This prevents any assessment
      // content from leaking even if the AI ignores instructions.
      if (uploadInfo.paymentRequired && !isSpecialAccess) {
        if (session.isPaid) {
          session.paymentCycle = (session.paymentCycle || 0) + 1;
        }
        const paymentCycle = session.paymentCycle || 0;
        const paymentAmount = getCyclePayableAmount(session, paymentCycle);
        session.isPaid = false;
        cleanMessage = paymentBarrierMessage(
          detectChatLanguageFromText(cleanMessage)
        );
        console.log("Payment barrier activated for session:", sessionId);

        session.messages.push({ role: "user", content: userMessage });
        session.messages.push({ role: "assistant", content: cleanMessage });
        await session.save();

        return res.json({
          reply: cleanMessage,
          sessionTerminated: false,
          terminationMessage: null,
          paymentRequired: true,
          paymentAmount,
          paymentCycle,
        });
      }

      session.messages.push({ role: "user", content: userMessage });
      session.messages.push({ role: "assistant", content: cleanMessage });

      const resolvedFinalResponse =
        typeof uploadInfo.finalResponse === "string" &&
        uploadInfo.finalResponse.trim().length > 0
          ? uploadInfo.finalResponse.trim()
          : null;
      if (resolvedFinalResponse) {
        session.final_response = resolvedFinalResponse;
      }

      persistSessionDocumentSnapshot(
        session,
        sessionId,
        uploadInfo,
        cleanMessage
      );

      // Use structured upload requirement (works for all languages)
      const requiresUpload = uploadInfo.requiresUpload;
      const uploadType = uploadInfo.uploadType;
      const isReUpload =
        uploadType === "re_upload" ||
        (requiresUpload && session.isDocUploaded && session.uploadAttempts > 0);

      if (requiresUpload) {
        // Only set upload required if we haven't exceeded max attempts
        if (session.uploadAttempts < 2) {
          session.isDocUploadRequired = true;
          // If re-upload, reset the uploaded status
          if (isReUpload) {
            session.isDocUploaded = false;
            // For multiple uploads, don't clear all files - just mark as needing re-upload
            // For single upload, clear the fileId
            if (!session.supportsMultipleUploads) {
              session.uploadedFileId = null;
              session.uploadedFileIds = [];
            }
          }
        } else {
          // Max attempts reached - clear upload requirement to allow chat to continue
          session.isDocUploadRequired = false;
        }
      } else {
        // Only clear upload requirement if document is uploaded AND assistant didn't ask for upload
        // Don't clear if assistant is asking for re-upload (even if document exists)
        if (session.isDocUploaded && filesToUse.length > 0 && !requiresUpload) {
          session.isDocUploadRequired = false;
        }
        // Also clear if max attempts reached (allow chat to continue)
        if (session.uploadAttempts >= 2) {
          session.isDocUploadRequired = false;
        }
      }

      await session.save();

      // Return response with upload requirement flag if needed (use cleanMessage without JSON marker)
      if (session.isDocUploadRequired && !session.isDocUploaded) {
        return res.json({
          reply: cleanMessage,
          requiresUpload: true,
          isReUpload: uploadType === "re_upload",
          uploadReason: uploadInfo.reason || null,
          sessionTerminated: uploadInfo.sessionTerminated || false,
          terminationMessage: uploadInfo.terminationMessage || null,
          paymentRequired: false,
        });
      }

      return res.json({
        reply: cleanMessage,
        sessionTerminated: uploadInfo.sessionTerminated || false,
        terminationMessage: uploadInfo.terminationMessage || null,
        paymentRequired: false,
      });
    }
    // ========== OpenAI (default) logic ==========
    // Step 3: Add message to thread
    await client.beta.threads.messages.create(session.threadId, {
      role: "user",
      content: userMessage,
    });
    // Step 4: Run the assistant
    const run = await client.beta.threads.runs.create(session.threadId, {
      assistant_id: session.assistantId,
    });
    // Step 5: Poll until completed with bounded attempts (anti-stall)
    let runStatus;
    let attempts = 0;
    do {
      await new Promise((r) => setTimeout(r, 1000));
      runStatus = await client.beta.threads.runs.retrieve(
        session.threadId,
        run.id
      );
      attempts += 1;
    } while (
      runStatus.status !== "completed" &&
      attempts < OPENAI_RUN_POLL_MAX_ATTEMPTS
    );
    if (runStatus.status !== "completed") {
      return res.status(504).json({
        error: "Assistant response timeout",
        message: "The model took too long to respond. Please retry.",
      });
    }
    // Step 6: Fetch messages
    const messages = await client.beta.threads.messages.list(session.threadId);
    const assistantMessage =
      messages.data[0].content[0].text.value || "No response";

    // Extract upload requirement from structured output
    const uploadInfo = extractUploadRequirement(assistantMessage);
    let cleanMessage = uploadInfo.cleanMessage || assistantMessage;

    // HARD PAYMENT BARRIER: When AI signals payment is required, replace the
    // entire response with a safe payment prompt. This prevents any assessment
    // content from leaking even if the AI ignores instructions.
    if (uploadInfo.paymentRequired && !isSpecialAccess) {
      if (session.isPaid) {
        session.paymentCycle = (session.paymentCycle || 0) + 1;
      }
      const paymentCycle = session.paymentCycle || 0;
      const paymentAmount = getCyclePayableAmount(session, paymentCycle);
      session.isPaid = false;
      cleanMessage = paymentBarrierMessage(
        detectChatLanguageFromText(cleanMessage)
      );
      console.log("Payment barrier activated for session:", sessionId);

      session.messages.push({ role: "user", content: userMessage });
      session.messages.push({ role: "assistant", content: cleanMessage });
      await session.save();

      return res.json({
        reply: cleanMessage,
        sessionTerminated: false,
        terminationMessage: null,
        paymentRequired: true,
        paymentAmount,
        paymentCycle,
      });
    }

    // Save message history (without JSON marker)
    session.messages.push({ role: "user", content: userMessage });
    session.messages.push({ role: "assistant", content: cleanMessage });

    const resolvedFinalResponse =
      typeof uploadInfo.finalResponse === "string" &&
      uploadInfo.finalResponse.trim().length > 0
        ? uploadInfo.finalResponse.trim()
        : null;
    if (resolvedFinalResponse) {
      session.final_response = resolvedFinalResponse;
    }

    persistSessionDocumentSnapshot(
      session,
      sessionId,
      uploadInfo,
      cleanMessage
    );

    // Use structured upload requirement (works for all languages)
    const requiresUpload = uploadInfo.requiresUpload;
    const uploadType = uploadInfo.uploadType;
    const isReUpload =
      uploadType === "re_upload" ||
      (requiresUpload && session.isDocUploaded && session.uploadAttempts > 0);

    if (requiresUpload) {
      session.isDocUploadRequired = true;
      // If re-upload, reset the uploaded status
      if (isReUpload) {
        session.isDocUploaded = false;
        // For multiple uploads, don't clear all files - just mark as needing re-upload
        // For single upload, clear the fileId
        if (!session.supportsMultipleUploads) {
          session.uploadedFileId = null;
          session.uploadedFileIds = [];
        }
      }
    } else {
      // Only clear upload requirement if document is uploaded AND assistant didn't ask for upload
      // Don't clear if assistant is asking for re-upload (even if document exists)
      if (session.isDocUploaded && filesToUse.length > 0 && !requiresUpload) {
        session.isDocUploadRequired = false;
      }
    }

    await session.save();

    // Return response with upload requirement flag if needed (use cleanMessage without JSON marker)
    if (session.isDocUploadRequired && !session.isDocUploaded) {
      return res.json({
        reply: cleanMessage,
        requiresUpload: true,
        isReUpload: uploadType === "re_upload",
        uploadReason: uploadInfo.reason || null,
        sessionTerminated: uploadInfo.sessionTerminated || false,
        terminationMessage: uploadInfo.terminationMessage || null,
        paymentRequired: false,
      });
    }

    res.json({
      reply: cleanMessage,
      sessionTerminated: uploadInfo.sessionTerminated || false,
      terminationMessage: uploadInfo.terminationMessage || null,
      paymentRequired: false,
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
      message: "Failed to send message",
    });
  }
});

//Mark payment for session
router.post("/mark-payment", jwtAuth, async (req, res) => {
  const { sessionId } = req.body;
  const session = await Session.findById(sessionId);
  if (!session) return res.status(404).json({ error: "Session not found" });

  session.isPaid = true;
  await session.save();
  res.json({ message: "Payment confirmed. You can now chat!" });
});

// Download document endpoint
router.get("/download-document/:sessionId", jwtAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { format = "pdf" } = req.query;
    const userId = req.user.id;

    // Validate format
    if (format !== "pdf" && format !== "word" && format !== "docx") {
      return res.status(400).json({
        error: "Invalid format",
        message: "Format must be 'pdf' or 'word'",
      });
    }

    // Find session and validate ownership
    const session = await Session.findOne({ _id: sessionId, userId });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Check if session has final document data
    let documentData = session.finalDocumentData;
    
    // Fallback: Build document data from the last substantive assistant message
    // This handles sessions created before the feature or where storage failed
    if (!documentData) {
      const savedFinalResponse =
        typeof session.final_response === "string" &&
        session.final_response.trim().length > 0
          ? session.final_response.trim()
          : null;
      const substantiveContent =
        savedFinalResponse ||
        (session.messages && session.messages.length > 0
          ? findLastSubstantiveMessage(session)
          : null);
      if (substantiveContent) {
        documentData = buildDocumentDataFromMessage(
          substantiveContent,
          session,
          null
        );
        // Save it for future use
        session.finalDocumentData = documentData;
        await session.save();
      }
    }
    
    if (!documentData) {
      return res.status(404).json({
        error: "Document not available",
        message:
          "This session does not have a final document available for download. The session may not be completed yet.",
      });
    }

      try {
        // Generate document
        const documentBuffer = await generateDocument(documentData, format, {
          assistantKey: session.assistantKey,
        });

        // Get filename
        const filename = getDocumentFilename(documentData, format);

      // Set response headers
      const contentType =
        format === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      res.setHeader("Content-Type", contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.setHeader("Content-Length", documentBuffer.length);

      // Send document
      res.send(documentBuffer);
    } catch (generationError) {
      console.error("Document generation error:", generationError);
      return res.status(500).json({
        error: "Document generation failed",
        message: generationError.message,
      });
    }
  } catch (error) {
    console.error("Download document error:", error);
    return res.status(500).json({
      error: "Failed to download document",
      message: error.message,
    });
  }
});

export default router;

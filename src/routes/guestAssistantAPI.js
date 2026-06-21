import express from "express";
import OpenAI from "openai";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
import os from "os";
import { Assistant } from "../model/assistant.model.js";
import { Session } from "../model/sesssion.model.js";
import { Payment } from "../model/payment.model.js";
import { jwtAuth } from "../middleware/jwtAuth.js";
import {
  generateDocument,
  getDocumentFilename,
} from "../utils/documentGenerator.js";
import {
  persistSessionDocumentSnapshot,
  extractUploadRequirement,
  detectChatLanguageFromText,
  paymentBarrierMessage,
  buildDocumentDataFromMessage,
  findLastSubstantiveMessage,
} from "../chat/messageControlParse.js";
import { getCyclePayableAmount } from "../chat/sessionGuards.js";
import {
  getGuestSession,
  putGuestSession,
  deleteGuestSession,
  listGuestSessionsForUser,
  listAllGuestSessionsForAnonymous,
  registerGuestSessionInIndex,
  GUEST_SESSION_TTL_MS,
  isGuestStorageAvailable,
} from "../services/guestSessionStore.js";
import { signGuestToken, verifyGuestToken } from "../services/guestToken.js";
import { guestUploadDocumentHandler } from "../handlers/guestUploadDocumentHandler.js";
import {
  buildGuestOpenAiAdditionalInstructions,
  enrichGuestApiResponse,
  processGuestAssistantReply,
} from "../chat/guestSignupOffer.js";
import {
  bootstrapFlowSession,
  executeChatTurn,
  executeChatTurnStream,
  preflightChatTurn,
} from "../chat/chatTurnHandler.js";
import {
  trackGuestChatStarted,
  trackGuestMessageSent,
} from "../services/guestAnalytics.js";

const router = express.Router();
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OPENAI_RUN_POLL_MAX_ATTEMPTS = 120;

const guestUpload = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
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

function readGuestToken(req) {
  return req.get("guest-token") || req.get("Guest-Token");
}

function countGuestUserMessages(session) {
  return (session.messages || []).filter((m) => m.role === "user").length;
}

function recordGuestMessageAnalytics(session, guestSessionId, req) {
  trackGuestMessageSent({
    anonymousId: session.anonymousId,
    browserSessionId: session.browserSessionId,
    guestSessionId,
    assistantKey: session.assistantKey,
    userMessageCount: countGuestUserMessages(session),
    req,
  });
}

function buildGuestSessionDoc({
  guestSessionId,
  anonymousId,
  browserSessionId,
  assistant,
  threadId,
  geminiConfig,
  provider,
  isPaid,
}) {
  const startedOn = new Date();
  const endedOn = new Date(startedOn.getTime() + GUEST_SESSION_TTL_MS);
  const sessionKey = assistant.key;
  const nowIso = startedOn.toISOString();
  return {
    guestSessionId,
    anonymousId,
    browserSessionId,
    assistantId: assistant.assistantId,
    assistantKey: sessionKey,
    threadId,
    title: assistant.name,
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
    startedOn: nowIso,
    endedOn: endedOn.toISOString(),
    updatedAt: nowIso,
    provider,
    geminiConfig: geminiConfig || {},
    isPaid,
    paymentCycle: 0,
    messages: [],
    isDocUploadRequired: false,
    uploadedFileId: null,
    uploadedFileIds: [],
    uploadAttempts: 0,
    isDocUploaded: false,
    supportsMultipleUploads: assistant.config?.supportsMultipleUploads === true,
    finalDocumentData: null,
    final_response: null,
    selectedLanguage: null,
    signupOfferShown: false,
    signupOfferResponse: null,
    useFlowOrchestrator: false,
    flowKey: null,
    flowVersion: null,
    flowState: null,
    currentNodeId: null,
    answers: {},
    askedNodeOrder: [],
    paymentGateShown: false,
    flowAudit: [],
  };
}

/** @param {import("express").Request} req */
function requireGuestContext(req, res) {
  const token = readGuestToken(req);
  if (!token) {
    res.status(401).json({ error: "guest-token header required" });
    return null;
  }
  try {
    return verifyGuestToken(token);
  } catch {
    res.status(401).json({ error: "Invalid or expired guest-token" });
    return null;
  }
}

function guestSessionToClientShape(guestSessionId, session, docDownloadAvailable = false) {
  const guestSignupOfferPending =
    session.signupOfferResponse === "pending" && session.signupOfferShown === true;
  return {
    ...session,
    _id: guestSessionId,
    key: session.assistantKey,
    assistantKey: session.assistantKey,
    docDownloadAvailable,
    isGuest: true,
    guestRetentionHours: 24,
    guestSignupOfferPending,
  };
}

router.post("/guest/list-all-sessions", async (req, res) => {
  try {
    if (!(await isGuestStorageAvailable())) {
      return res.status(503).json({
        error: "Guest chat unavailable",
        message: "Guest storage unavailable",
      });
    }
    const { anonymousId } = req.body || {};
    if (typeof anonymousId !== "string" || !anonymousId.trim()) {
      return res.status(400).json({ message: "anonymousId is required" });
    }
    const summaries = await listAllGuestSessionsForAnonymous(anonymousId.trim());
    const assistantKeys = [
      ...new Set(summaries.map((s) => s.assistantKey).filter(Boolean)),
    ];
    const assistants = await Assistant.find({ key: { $in: assistantKeys } })
      .select("key name docDownloadAvailable")
      .lean();
    const assistantByKey = new Map(assistants.map((a) => [a.key, a]));

    const sessions = summaries.map((s) => {
      const assistant = assistantByKey.get(s.assistantKey);
      return {
        _id: s.guestSessionId,
        key: s.assistantKey,
        assistantKey: s.assistantKey,
        title: s.title || assistant?.name || "Guest chat",
        startedOn: s.startedOn,
        endedOn: s.endedOn,
        updatedAt: s.updatedAt,
        isPaid: s.isPaid,
        messages: [],
        isGuest: true,
        guestRetentionHours: 24,
        docDownloadAvailable: assistant?.docDownloadAvailable === true,
      };
    });
    return res.status(200).json(sessions);
  } catch (err) {
    console.error("guest/list-all-sessions", err);
    return res.status(500).json({
      error: err.message,
      message: "Failed to list guest sessions",
    });
  }
});

router.post("/guest/list-sessions", async (req, res) => {
  try {
    if (!(await isGuestStorageAvailable())) {
      return res.status(503).json({
        error: "Guest chat unavailable",
        message: "Guest storage unavailable",
      });
    }
    const { assistantKey, anonymousId } = req.body || {};
    if (!assistantKey || typeof anonymousId !== "string" || !anonymousId.trim()) {
      return res.status(400).json({
        message: "assistantKey and anonymousId are required",
      });
    }
    const summaries = await listGuestSessionsForUser(
      anonymousId.trim(),
      assistantKey
    );
    const assistant = await Assistant.findOne({ key: assistantKey })
      .select("docDownloadAvailable name")
      .lean();
    const docDownloadAvailable = assistant?.docDownloadAvailable === true;
    const sessions = summaries.map((s) => ({
      _id: s.guestSessionId,
      key: assistantKey,
      assistantKey,
      title: s.title || assistant?.name || "Guest chat",
      startedOn: s.startedOn,
      endedOn: s.endedOn,
      updatedAt: s.updatedAt,
      isPaid: s.isPaid,
      messages: [],
      isGuest: true,
      guestRetentionHours: 24,
      docDownloadAvailable,
    }));
    return res.status(200).json(sessions);
  } catch (err) {
    console.error("guest/list-sessions", err);
    return res.status(500).json({
      error: err.message,
      message: "Failed to list guest sessions",
    });
  }
});

router.post("/guest/issue-token", async (req, res) => {
  try {
    const { guestSessionId, anonymousId, assistantKey } = req.body || {};
    if (
      !guestSessionId ||
      typeof anonymousId !== "string" ||
      !anonymousId.trim() ||
      !assistantKey
    ) {
      return res.status(400).json({
        message: "guestSessionId, anonymousId, and assistantKey are required",
      });
    }
    const session = await getGuestSession(guestSessionId);
    if (!session) {
      return res.status(404).json({ error: "Guest session not found or expired" });
    }
    if (
      session.anonymousId !== anonymousId.trim() ||
      session.assistantKey !== assistantKey
    ) {
      return res.status(403).json({ error: "Session does not belong to this guest" });
    }
    const guestToken = signGuestToken({
      guestSessionId,
      anonymousId: anonymousId.trim(),
      browserSessionId: session.browserSessionId || "",
      assistantKey,
    });
    return res.status(200).json({ guestToken, guestSessionId });
  } catch (err) {
    console.error("guest/issue-token", err);
    return res.status(500).json({ error: err.message, message: "Failed to issue guest token" });
  }
});

router.get("/guest/session/:guestSessionId", async (req, res) => {
  try {
    const decoded = requireGuestContext(req, res);
    if (!decoded) return;
    const { guestSessionId } = req.params;
    if (decoded.guestSessionId !== guestSessionId) {
      return res.status(403).json({ error: "guestSessionId does not match guest-token" });
    }
    const session = await getGuestSession(guestSessionId);
    if (!session) {
      return res.status(404).json({ error: "Guest session not found or expired" });
    }
    if (session.anonymousId !== decoded.anonymousId) {
      return res.status(403).json({ error: "anonymousId does not match guest-token" });
    }
    let docDownloadAvailable = false;
    try {
      const a = await Assistant.findOne({ assistantId: session.assistantId })
        .select("docDownloadAvailable")
        .lean();
      docDownloadAvailable = a?.docDownloadAvailable === true;
    } catch {
      // ignore
    }
    return res.status(200).json(
      guestSessionToClientShape(guestSessionId, session, docDownloadAvailable)
    );
  } catch (err) {
    console.error("guest/session", err);
    return res.status(500).json({ error: err.message, message: "Failed to load guest session" });
  }
});

router.post("/guest/start-session", async (req, res) => {
  try {
    if (!(await isGuestStorageAvailable())) {
      return res.status(503).json({
        error: "Guest chat unavailable",
        message:
          "Guest storage unavailable. Set REDIS_URL or unset GUEST_REQUIRE_REDIS (default uses in-memory store when REDIS_URL is empty).",
      });
    }

    const {
      key,
      anonymousId,
      sessionId: browserSessionId,
      forceNew,
    } = req.body || {};
    if (!key || typeof anonymousId !== "string" || !anonymousId.trim()) {
      return res.status(400).json({
        message: "key and anonymousId are required",
      });
    }
    if (typeof browserSessionId !== "string" || !browserSessionId.trim()) {
      return res.status(400).json({
        message: "sessionId (browser session) is required",
      });
    }

    const assistant = await Assistant.findOne({ key });
    if (!assistant) {
      return res.status(404).json({ message: "Assistant not found!" });
    }

    const anon = anonymousId.trim();
    const browserId = browserSessionId.trim();

    if (forceNew !== true) {
      const existing = await listGuestSessionsForUser(anon, key);
      if (existing.length > 0) {
        const latest = existing[0];
        const guestToken = signGuestToken({
          guestSessionId: latest.guestSessionId,
          anonymousId: anon,
          browserSessionId: browserId,
          assistantKey: assistant.key,
        });
        return res.status(200).json({
          message: "Existing guest session returned",
          sessionId: latest.guestSessionId,
          guestToken,
          existing: true,
        });
      }
    }

    let threadId;
    let geminiConfig;
    const provider = assistant.provider || "openai";

    if (provider === "openai") {
      const thread = await client.beta.threads.create();
      threadId = thread.id;
    } else if (provider === "gemini") {
      geminiConfig = assistant.config || {};
      threadId = uuidv4();
    } else {
      return res.status(400).json({ message: "Unsupported provider" });
    }

    const deferPayment = assistant.config?.deferPayment === true;
    const isPaid = deferPayment;

    const guestSessionId = uuidv4();
    const sessionDoc = buildGuestSessionDoc({
      guestSessionId,
      anonymousId: anon,
      browserSessionId: browserId,
      assistant,
      threadId,
      geminiConfig,
      provider,
      isPaid,
    });

    await bootstrapFlowSession(sessionDoc, assistant);

    await putGuestSession(guestSessionId, sessionDoc);

    trackGuestChatStarted({
      anonymousId: anon,
      browserSessionId: browserId,
      guestSessionId,
      assistantKey: assistant.key,
      req,
    });

    const guestToken = signGuestToken({
      guestSessionId,
      anonymousId: anonymousId.trim(),
      browserSessionId: browserSessionId.trim(),
      assistantKey: assistant.key,
    });

    return res.status(201).json({
      message: "Guest session created successfully",
      sessionId: guestSessionId,
      guestToken,
      threadId,
      provider,
    });
  } catch (error) {
    console.error("guest/start-session", error);
    return res.status(500).json({ error: "Failed to create guest session" });
  }
});

router.post("/guest/signup-offer-response", async (req, res) => {
  try {
    const decoded = requireGuestContext(req, res);
    if (!decoded) return;

    const { guestSessionId, response } = req.body || {};
    if (!guestSessionId || !response) {
      return res.status(400).json({
        error: "guestSessionId and response are required",
      });
    }
    if (response !== "declined" && response !== "accepted") {
      return res.status(400).json({
        error: 'response must be "declined" or "accepted"',
      });
    }
    if (decoded.guestSessionId !== guestSessionId) {
      return res.status(403).json({ error: "guestSessionId does not match guest-token" });
    }

    const session = await getGuestSession(guestSessionId);
    if (!session) {
      return res.status(404).json({ error: "Guest session not found or expired" });
    }
    if (session.anonymousId !== decoded.anonymousId) {
      return res.status(403).json({ error: "anonymousId does not match guest-token" });
    }

    session.signupOfferResponse = response;
    if (response === "accepted") {
      session.signupOfferShown = true;
    }
    await putGuestSession(guestSessionId, session);

    return res.status(200).json({
      success: true,
      signupOfferResponse: session.signupOfferResponse,
      guestSignupOfferPending: false,
    });
  } catch (err) {
    console.error("guest/signup-offer-response", err);
    return res.status(500).json({
      error: err.message,
      message: "Failed to record signup offer response",
    });
  }
});

router.post("/guest/send-message-stream", async (req, res) => {
  try {
    const decoded = requireGuestContext(req, res);
    if (!decoded) return;

    const { guestSessionId, userMessage, fileId } = req.body || {};
    if (!guestSessionId || !userMessage) {
      return res.status(400).json({ error: "guestSessionId and userMessage are required" });
    }
    if (decoded.guestSessionId !== guestSessionId) {
      return res.status(403).json({ error: "guestSessionId does not match guest-token" });
    }

    const session = await getGuestSession(guestSessionId);
    if (!session) {
      return res.status(404).json({ error: "Guest session not found or expired" });
    }

    const preflight = preflightChatTurn(session, { requirePaid: true });
    if (!preflight.ok) {
      return res.status(preflight.status).json(preflight.body);
    }

    const assistantRow = await Assistant.findOne({ assistantId: session.assistantId });
    if (!assistantRow) {
      return res.status(404).json({ error: "Assistant not found" });
    }

    if (session.provider !== "gemini") {
      return res.status(400).json({ error: "Streaming is only supported for Gemini sessions" });
    }

    await executeChatTurnStream(req, res, {
      session,
      assistant: assistantRow,
      userMessage,
      fileId,
      isGuest: true,
    });

    await putGuestSession(guestSessionId, session);
    recordGuestMessageAnalytics(session, guestSessionId, req);
  } catch (err) {
    console.error("guest/send-message-stream", err);
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message });
    }
  }
});

router.post("/guest/send-message", async (req, res) => {
  try {
    const decoded = requireGuestContext(req, res);
    if (!decoded) return;

    const { guestSessionId, userMessage, fileId } = req.body || {};
    if (!guestSessionId || !userMessage) {
      return res.status(400).json({ error: "guestSessionId and userMessage are required" });
    }
    if (decoded.guestSessionId !== guestSessionId) {
      return res.status(403).json({ error: "guestSessionId does not match guest-token" });
    }

    const session = await getGuestSession(guestSessionId);
    if (!session) {
      return res.status(404).json({ error: "Guest session not found or expired" });
    }
    if (session.anonymousId !== decoded.anonymousId) {
      return res.status(403).json({ error: "anonymousId does not match guest-token" });
    }
    if (session.assistantKey !== decoded.assistantKey) {
      return res.status(403).json({ error: "assistantKey does not match guest-token" });
    }

    const isSpecialAccess = false;
    const preflight = preflightChatTurn(session, {
      isSpecialAccess,
      requirePaid: true,
    });
    if (!preflight.ok) {
      return res.status(preflight.status).json(preflight.body);
    }

    const assistantRow = await Assistant.findOne({
      assistantId: session.assistantId,
    });
    if (!assistantRow) {
      return res.status(404).json({ error: "Assistant not found" });
    }

    if (session.provider === "gemini") {
      const turn = await executeChatTurn({
        session,
        assistant: assistantRow,
        userMessage,
        fileId,
        isGuest: true,
        isSpecialAccess,
      });

      if (turn?.error) {
        return res.status(turn.status || 500).json(turn.body || { error: "Chat failed" });
      }

      await putGuestSession(guestSessionId, session);
      recordGuestMessageAnalytics(session, guestSessionId, req);
      return res.json(turn);
    }

    await client.beta.threads.messages.create(session.threadId, {
      role: "user",
      content: userMessage,
    });
    const additionalInstructions = buildGuestOpenAiAdditionalInstructions(session);
    const runPayload = {
      assistant_id: session.assistantId,
    };
    if (additionalInstructions) {
      runPayload.additional_instructions = additionalInstructions;
    }
    const run = await client.beta.threads.runs.create(session.threadId, runPayload);

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

    const messages = await client.beta.threads.messages.list(session.threadId);
    const assistantMessage =
      messages.data[0].content[0].text.value || "No response";

    const uploadInfo = extractUploadRequirement(assistantMessage);
    let cleanMessage = uploadInfo.cleanMessage || assistantMessage;

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
      console.log("Payment barrier activated for guest session:", guestSessionId);

      session.messages.push({ role: "user", content: userMessage });
      session.messages.push({ role: "assistant", content: cleanMessage });
      processGuestAssistantReply(session, uploadInfo, userMessage);
      await putGuestSession(guestSessionId, session);
      recordGuestMessageAnalytics(session, guestSessionId, req);

      return res.json(
        enrichGuestApiResponse(
          {
            reply: cleanMessage,
            sessionTerminated: false,
            terminationMessage: null,
            paymentRequired: true,
            paymentAmount,
            paymentCycle,
          },
          session,
          uploadInfo
        )
      );
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
      guestSessionId,
      uploadInfo,
      cleanMessage
    );

    const requiresUpload = uploadInfo.requiresUpload;
    const uploadType = uploadInfo.uploadType;
    const isReUpload =
      uploadType === "re_upload" ||
      (requiresUpload && session.isDocUploaded && session.uploadAttempts > 0);

    if (requiresUpload) {
      session.isDocUploadRequired = true;
      if (isReUpload) {
        session.isDocUploaded = false;
        if (!session.supportsMultipleUploads) {
          session.uploadedFileId = null;
          session.uploadedFileIds = [];
        }
      }
    } else {
      if (session.isDocUploaded && filesToUse.length > 0 && !requiresUpload) {
        session.isDocUploadRequired = false;
      }
    }

    processGuestAssistantReply(session, uploadInfo, userMessage);
    await putGuestSession(guestSessionId, session);
    recordGuestMessageAnalytics(session, guestSessionId, req);

    if (session.isDocUploadRequired && !session.isDocUploaded) {
      return res.json(
        enrichGuestApiResponse(
          {
            reply: cleanMessage,
            requiresUpload: true,
            isReUpload: uploadType === "re_upload",
            uploadReason: uploadInfo.reason || null,
            sessionTerminated: uploadInfo.sessionTerminated || false,
            terminationMessage: uploadInfo.terminationMessage || null,
            paymentRequired: false,
          },
          session,
          uploadInfo
        )
      );
    }

    return res.json(
      enrichGuestApiResponse(
        {
          reply: cleanMessage,
          sessionTerminated: uploadInfo.sessionTerminated || false,
          terminationMessage: uploadInfo.terminationMessage || null,
          paymentRequired: false,
        },
        session,
        uploadInfo
      )
    );
  } catch (err) {
    console.error("guest/send-message", err);
    return res.status(500).json({
      error: err.message,
      message: "Failed to send message",
    });
  }
});

router.post(
  "/guest/upload-document",
  guestUpload.array("documents", 10),
  guestUploadDocumentHandler
);

router.post("/guest/mark-payment", async (req, res) => {
  try {
    const decoded = requireGuestContext(req, res);
    if (!decoded) return;
    const { guestSessionId } = req.body || {};
    if (!guestSessionId) {
      return res.status(400).json({ error: "guestSessionId is required" });
    }
    if (decoded.guestSessionId !== guestSessionId) {
      return res.status(403).json({ error: "guestSessionId does not match guest-token" });
    }
    const session = await getGuestSession(guestSessionId);
    if (!session) {
      return res.status(404).json({ error: "Guest session not found or expired" });
    }
    if (session.anonymousId !== decoded.anonymousId) {
      return res.status(403).json({ error: "anonymousId does not match guest-token" });
    }
    session.isPaid = true;
    await putGuestSession(guestSessionId, session);
    return res.json({ message: "Payment confirmed. You can now chat!" });
  } catch (err) {
    console.error("guest/mark-payment", err);
    return res.status(500).json({ error: err.message, message: "Failed to mark payment" });
  }
});

router.get("/guest/download-document/:guestSessionId", async (req, res) => {
  try {
    const decoded = requireGuestContext(req, res);
    if (!decoded) return;
    const { guestSessionId } = req.params;
    const { format = "pdf" } = req.query;
    if (decoded.guestSessionId !== guestSessionId) {
      return res.status(403).json({ error: "guestSessionId does not match guest-token" });
    }
    if (format !== "pdf" && format !== "word" && format !== "docx") {
      return res.status(400).json({
        error: "Invalid format",
        message: "Format must be 'pdf' or 'word'",
      });
    }
    const session = await getGuestSession(guestSessionId);
    if (!session) {
      return res.status(404).json({ error: "Guest session not found or expired" });
    }
    if (session.anonymousId !== decoded.anonymousId) {
      return res.status(403).json({ error: "anonymousId does not match guest-token" });
    }

    let documentData = session.finalDocumentData;
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
        session.finalDocumentData = documentData;
        await putGuestSession(guestSessionId, session);
      }
    }

    if (!documentData) {
      return res.status(404).json({
        error: "Document not available",
        message:
          "This session does not have a final document available for download. The session may not be completed yet.",
      });
    }

    const documentBuffer = await generateDocument(documentData, format, {
      assistantKey: session.assistantKey,
    });
    const filename = getDocumentFilename(documentData, format);
    const contentType =
      format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", documentBuffer.length);
    return res.send(documentBuffer);
  } catch (error) {
    console.error("guest/download-document", error);
    return res.status(500).json({
      error: "Failed to download document",
      message: error.message,
    });
  }
});

router.post("/guest/end-session", async (req, res) => {
  try {
    const decoded = requireGuestContext(req, res);
    if (!decoded) return;
    const { guestSessionId } = req.body || {};
    if (!guestSessionId) {
      return res.status(400).json({ error: "guestSessionId is required" });
    }
    const session = await getGuestSession(guestSessionId);
    if (!session) {
      return res.status(404).json({ error: "Guest session not found or expired" });
    }
    if (session.anonymousId !== decoded.anonymousId) {
      return res.status(403).json({ error: "anonymousId does not match guest-token" });
    }
    if (session.assistantKey !== decoded.assistantKey) {
      return res.status(403).json({
        error: "assistantKey does not match guest-token for this use-case",
      });
    }
    await deleteGuestSession(guestSessionId);
    return res.json({ message: "Guest session ended", success: true });
  } catch (err) {
    console.error("guest/end-session", err);
    return res.status(500).json({ error: err.message, message: "Failed to end session" });
  }
});

router.post("/guest/convert-session", jwtAuth, async (req, res) => {
  try {
    const token = readGuestToken(req);
    if (!token) {
      return res.status(401).json({ error: "guest-token header required" });
    }
    let decoded;
    try {
      decoded = verifyGuestToken(token);
    } catch {
      return res.status(401).json({ error: "Invalid or expired guest-token" });
    }
    const { guestSessionId } = req.body || {};
    if (!guestSessionId) {
      return res.status(400).json({ error: "guestSessionId is required" });
    }
    if (decoded.guestSessionId !== guestSessionId) {
      return res.status(403).json({ error: "guestSessionId does not match guest-token" });
    }

    const guest = await getGuestSession(guestSessionId);
    if (!guest) {
      return res.status(404).json({ error: "Guest session not found or expired" });
    }

    const userId = String(req.user.id);
    const startedOn = guest.startedOn ? new Date(guest.startedOn) : new Date();
    const endedOn = guest.endedOn ? new Date(guest.endedOn) : new Date(startedOn.getTime() + 7 * 24 * 60 * 60 * 1000);

    const mongoSession = await Session.create({
      userId,
      assistantId: guest.assistantId,
      threadId: guest.threadId,
      title: guest.title || "New chat",
      assistantKey: guest.assistantKey,
      price: guest.price,
      actualPrice: guest.actualPrice,
      additionalPrice: guest.additionalPrice,
      actualAdditionalPrice: guest.actualAdditionalPrice,
      startedOn,
      endedOn,
      provider: guest.provider || "openai",
      geminiConfig: guest.geminiConfig || {},
      isPaid: !!guest.isPaid,
      supportsMultipleUploads: guest.supportsMultipleUploads === true,
      messages: Array.isArray(guest.messages) ? guest.messages : [],
      isDocUploadRequired: !!guest.isDocUploadRequired,
      uploadedFileId: guest.uploadedFileId || undefined,
      uploadedFileIds: Array.isArray(guest.uploadedFileIds) ? guest.uploadedFileIds : [],
      uploadAttempts: guest.uploadAttempts || 0,
      isDocUploaded: !!guest.isDocUploaded,
      finalDocumentData: guest.finalDocumentData ?? null,
      final_response: guest.final_response ?? null,
      paymentCycle: guest.paymentCycle || 0,
    });

    await Payment.updateMany(
      { guestSessionId: String(guestSessionId) },
      {
        $set: {
          userId,
          sessionId: String(mongoSession._id),
          guestSessionId: null,
        },
      }
    );

    await deleteGuestSession(guestSessionId);

    return res.status(201).json({
      message: "Session converted successfully",
      sessionId: mongoSession._id,
    });
  } catch (err) {
    console.error("guest/convert-session", err);
    return res.status(500).json({
      error: err.message,
      message: "Failed to convert guest session",
    });
  }
});

export default router;

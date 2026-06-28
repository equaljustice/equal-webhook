import express from "express";
import OpenAI from "openai";
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
import {
  withTimeout,
  buildDocumentDataFromMessage,
  findLastSubstantiveMessage,
  applyDownloadSnapshot,
  extractUploadRequirement,
  detectChatLanguageFromText,
  paymentBarrierMessage,
} from "../chat/messageControlParse.js";
import {
  bootstrapFlowSession,
  executeChatTurn,
  executeChatTurnStream,
  preflightChatTurn,
} from "../chat/chatTurnHandler.js";
import {
  getCyclePayableAmount,
  preparePaymentBarrierCycle,
} from "../chat/sessionGuards.js";
import { hasWebhookConfirmedPayment } from "../chat/paymentVerification.js";
import {
  isAllowedUploadFile,
  UPLOAD_TYPE_ERROR,
} from "../utils/uploadFileTypes.js";
import {
  uploadMulterFileToGemini,
  cleanupMulterFiles,
  linkUploadedFilesToSession,
} from "../utils/geminiFileUpload.js";
import { resolveSessionGeminiConfig } from "../utils/geminiConfig.js";

const router = express.Router();
const OPENAI_RUN_POLL_MAX_ATTEMPTS = 120;

// Configure multer for temporary file storage
const upload = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (isAllowedUploadFile(file)) {
      cb(null, true);
    } else {
      cb(new Error(UPLOAD_TYPE_ERROR), false);
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

//Create Assistant instance into db
router.post("/create", async (req, res) => {
  const {
    name,
    key,
    id,
    assistantId: bodyAssistantId,
    price,
    actualPrice,
    additionalPrice,
    actualAdditionalPrice,
    desc,
    description,
    provider,
    config,
  } = req.body;

  const resolvedId = id ?? bodyAssistantId;
  const resolvedDesc = desc ?? description;

  if (!name || !key || !resolvedId || price == null || !resolvedDesc || !provider) {
    const missing = [];
    if (!name) missing.push("name");
    if (!key) missing.push("key");
    if (!resolvedId) missing.push("id (or assistantId)");
    if (price == null) missing.push("price");
    if (!resolvedDesc) missing.push("desc (or description)");
    if (!provider) missing.push("provider");
    return res.status(400).json({
      message: "Info is required",
      missing,
      hint: "POST body must include: name, key, id (or assistantId), price, desc (or description), provider",
    });
  }

  try {
    const payload = {
      name,
      key,
      assistantId: resolvedId,
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
      description: resolvedDesc,
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
      geminiConfig = await resolveSessionGeminiConfig(assistant.config || {});
      threadId = uuidv4(); // Use a unique threadId (uuid) for Gemini
    }

    //Create session in DB
    const startedOn = new Date();
    const endedOn = new Date(startedOn.getTime() + 7 * 24 * 60 * 60 * 1000);

    const isSpecialAccess = hasSpecialAccess(userId);
    // deferPayment: true  → Q&A is free, payment triggered by AI before final output
    // deferPayment: false → original flow, payment required upfront before chatting
    const deferPayment = assistant.config?.deferPayment === true;
    const isPaid = isSpecialAccess;

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
      deferPayment,
      supportsMultipleUploads,
    });

    await bootstrapFlowSession(session, assistant);
    await session.save();

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
      deferPayment:
        s.deferPayment === true || s.geminiConfig?.deferPayment === true,
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

      const uploadedFiles = [];
      const fileErrors = [];

      for (const file of files) {
        try {
          const uploaded = await uploadMulterFileToGemini(file);
          uploadedFiles.push({
            fileId: uploaded.fileId,
            fileName: uploaded.fileName,
            mimeType: uploaded.mimeType,
            sourceMimeType: uploaded.sourceMimeType,
          });
          await cleanupMulterFiles([file]);
        } catch (uploadErr) {
          await cleanupMulterFiles([file]);
          fileErrors.push({
            fileName: file.originalname,
            error: uploadErr.message,
          });
        }
      }

      if (uploadedFiles.length === 0) {
        return res.status(500).json({
          error: "Failed to upload all files",
          errors: fileErrors,
        });
      }

      const fileIds = uploadedFiles.map((f) => f.fileId);

      if (session) {
        linkUploadedFilesToSession(session, uploadedFiles);
        await session.save();
      }

      const fileCount = session?.supportsMultipleUploads
        ? session?.uploadedFileIds?.length || fileIds.length
        : fileIds.length;
      const analysisMessage = buildPostUploadAnalysisMessage(
        session,
        null,
        fileCount
      );

      return res.status(200).json({
        fileIds,
        files: uploadedFiles,
        message:
          uploadedFiles.length > 1
            ? `${uploadedFiles.length} files uploaded successfully`
            : "File uploaded successfully",
        triggerAnalysis: session?.provider === "gemini",
        analysisMessage,
        conversationResumed: false,
        supportsMultipleUploads: session?.supportsMultipleUploads || false,
        totalUploadedFiles: session?.uploadedFileIds?.length || fileIds.length,
        uploadedFileIds: session?.uploadedFileIds || fileIds,
        fileId: fileIds[0],
        fileName: uploadedFiles[0]?.fileName,
        isDocUploaded: session?.isDocUploaded ?? true,
        isDocUploadRequired: session?.isDocUploadRequired ?? false,
        ...(fileErrors.length > 0 && { errors: fileErrors }),
      });
    } catch (error) {
      await cleanupMulterFiles(files);
      return res.status(500).json({
        error: "File upload failed",
        message: error.message,
      });
    }
  }
);

//Send Message
router.post("/send-message-stream", jwtAuth, async (req, res) => {
  try {
    const { sessionId, userMessage, fileId } = req.body;
    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });

    const userId = req.user.id;
    const isSpecialAccess = hasSpecialAccess(userId);
    const preflight = preflightChatTurn(session, { isSpecialAccess, requirePaid: true });
    if (!preflight.ok) {
      return res.status(preflight.status).json(preflight.body);
    }

    const assistant = await Assistant.findOne({ assistantId: session.assistantId });
    if (!assistant) {
      return res.status(404).json({ error: "Assistant not found" });
    }
    if (session.provider !== "gemini") {
      return res.status(400).json({ error: "Streaming is only supported for Gemini sessions" });
    }

    await executeChatTurnStream(req, res, {
      session,
      assistant,
      userMessage,
      fileId,
      isSpecialAccess,
      persistBeforeStreamDone: () => session.save(),
    });
    await session.save();
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to stream message" });
    }
  }
});

router.post("/send-message", jwtAuth, async (req, res) => {
  try {
    const { sessionId, userMessage, fileId } = req.body;
    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });
    // Check payment (skip for special access users)
    const userId = req.user.id;
    const isSpecialAccess = hasSpecialAccess(userId);
    const preflight = preflightChatTurn(session, {
      isSpecialAccess,
      requirePaid: true,
    });
    if (!preflight.ok) {
      return res.status(preflight.status).json(preflight.body);
    }

    if (isSpecialAccess && !session.isPaid) {
      session.isPaid = true;
      await session.save();
    }

    const assistant = await Assistant.findOne({ assistantId: session.assistantId });
    if (!assistant) {
      return res.status(404).json({ error: "Assistant not found" });
    }

    if (session.provider === "gemini") {
      const turn = await executeChatTurn({
        session,
        assistant,
        userMessage,
        fileId,
        isGuest: false,
        isSpecialAccess,
      });

      if (turn?.error) {
        return res.status(turn.status || 500).json(turn.body || { error: "Chat failed" });
      }

      await session.save();
      return res.json(turn);
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
      const { paymentCycle, paymentAmount } = preparePaymentBarrierCycle(session);
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

    applyDownloadSnapshot(session, sessionId, uploadInfo, cleanMessage);

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
        session.uploadedFileId = null;
        session.uploadedFileIds = [];
        session.uploadedFilesMeta = [];
        session.replaceNextUpload = true;
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

// Sync isPaid only when Razorpay webhook has recorded payment (never trust client alone).
router.post("/mark-payment", jwtAuth, async (req, res) => {
  const { sessionId } = req.body;
  const session = await Session.findById(sessionId);
  if (!session) return res.status(404).json({ error: "Session not found" });
  if (session.userId?.toString() !== req.user.id) {
    return res.status(403).json({ error: "Session not found" });
  }

  const webhookPaid = await hasWebhookConfirmedPayment({ sessionId });
  if (!webhookPaid) {
    return res.status(402).json({
      error: "Payment not confirmed",
      message: "Payment has not been confirmed by the payment provider yet.",
    });
  }

  if (!session.isPaid) {
    session.isPaid = true;
    await session.save();
  }
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

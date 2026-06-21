/**
 * Guest multipart upload + auto-resume chat (parity with assistantAPI /upload-document).
 */
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { Assistant } from "../model/assistant.model.js";
import {
  withTimeout,
  persistSessionDocumentSnapshot,
  extractUploadRequirement,
} from "../chat/messageControlParse.js";
import {
  buildGuestGeminiSystemInstruction,
  buildGuestOpenAiAdditionalInstructions,
  processGuestAssistantReply,
} from "../chat/guestSignupOffer.js";
import { getGuestSession, putGuestSession } from "../services/guestSessionStore.js";
import { verifyGuestToken } from "../services/guestToken.js";
import {
  buildGeminiGenerationConfig,
  resolveGeminiModel,
} from "../utils/geminiConfig.js";

const OPENAI_RUN_POLL_MAX_ATTEMPTS = 120;
const GEMINI_STREAM_TIMEOUT_MS = 120000;

function readGuestToken(req) {
  return req.get("guest-token") || req.get("Guest-Token");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function guestUploadDocumentHandler(req, res) {
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

    const files = req.files || (req.file ? [req.file] : []);
    const { guestSessionId } = req.body || {};
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No file(s) uploaded" });
    }
    if (!guestSessionId) {
      return res.status(400).json({ error: "guestSessionId is required in body" });
    }
    if (decoded.guestSessionId !== guestSessionId) {
      return res.status(403).json({ error: "guestSessionId does not match guest-token" });
    }

    const session = await getGuestSession(guestSessionId);
    if (!session) {
      const fs = await import("fs/promises");
      for (const file of files) {
        await fs.unlink(file.path).catch(() => {});
      }
      return res.status(404).json({ error: "Guest session not found or expired" });
    }
    if (session.anonymousId !== decoded.anonymousId) {
      return res.status(403).json({ error: "anonymousId does not match guest-token" });
    }
    if (session.assistantKey !== decoded.assistantKey) {
      return res.status(403).json({ error: "assistantKey does not match guest-token" });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const fs = await import("fs/promises");

    const uploadFileToGemini = async (file) => {
      const fileBuffer = await fs.readFile(file.path);
      let mimeType = file.mimetype;
      if (!mimeType || mimeType === "application/octet-stream") {
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
      let uploadResponse;
      try {
        uploadResponse = await ai.files.upload({
          file: file.path,
          config: {
            mimeType: mimeType,
            displayName: file.originalname || `document_${uuidv4()}`,
          },
        });
      } catch {
        uploadResponse = await ai.files.upload({
          file: fileBuffer,
          config: {
            mimeType: mimeType,
            displayName: file.originalname || `document_${uuidv4()}`,
          },
        });
      }
      const fileId =
        uploadResponse?.file?.uri ||
        uploadResponse?.file?.name ||
        uploadResponse?.uri ||
        uploadResponse?.fileId ||
        uploadResponse?.name;
      if (!fileId) {
        throw new Error("Failed to extract file ID from Gemini upload response");
      }
      return fileId;
    };

    const uploadedFiles = [];
    const fileErrors = [];

    for (const file of files) {
      try {
        const fileId = await uploadFileToGemini(file);
        uploadedFiles.push({ fileId, fileName: file.originalname });
        await fs.unlink(file.path).catch(() => {});
      } catch (uploadErr) {
        await fs.unlink(file.path).catch(() => {});
        fileErrors.push({ fileName: file.originalname, error: uploadErr.message });
      }
    }

    if (uploadedFiles.length === 0) {
      return res.status(500).json({
        error: "Failed to upload all files",
        errors: fileErrors,
      });
    }

    const fileIds = uploadedFiles.map((f) => f.fileId);
    let assistantReply = null;

    if (!session.uploadedFileIds) {
      session.uploadedFileIds = [];
    }
    for (const fileId of fileIds) {
      session.uploadedFileIds.push(fileId);
    }
    session.uploadedFileId = fileIds[fileIds.length - 1];
    session.isDocUploaded = true;
    session.isDocUploadRequired = false;

    try {
      const fileCount = session.supportsMultipleUploads
        ? session.uploadedFileIds?.length || 1
        : 1;
      const uploadMessage =
        fileCount > 1
          ? `${fileCount} documents uploaded successfully. Please analyze them.`
          : "Document uploaded successfully. Please analyze it.";

      if (session.provider === "gemini") {
        const aiGen = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const history = (session.messages || []).map((msg) => ({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }],
        }));
        const messageParts = [{ text: uploadMessage }];
        const filesToInclude = session.supportsMultipleUploads
          ? session.uploadedFileIds || fileIds
          : fileIds;
        for (const fileUri of filesToInclude) {
          if (fileUri) {
            messageParts.push({ fileData: { fileUri: fileUri } });
          }
        }
        history.push({ role: "user", parts: messageParts });
        const sourceConfig = session.geminiConfig || {};
        const model = resolveGeminiModel(sourceConfig);

        let systemInstructionText;
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
              systemInstructionText = await buildGuestGeminiSystemInstruction(
                assistant,
                session,
                filesToInclude
              );
            } catch (err) {
              console.warn(`Failed to load system instruction: ${err.message}`);
            }
          }
        } catch {
          // continue
        }

        const config = buildGeminiGenerationConfig({
          sourceConfig,
          systemInstructionText,
        });

        let assistantMessage = "";
        try {
          await withTimeout(
            (async () => {
              const response = await aiGen.models.generateContentStream({
                model,
                config,
                contents: history,
              });
              for await (const chunk of response) {
                if (chunk.text) assistantMessage += chunk.text;
              }
            })(),
            GEMINI_STREAM_TIMEOUT_MS,
            "Gemini stream"
          );
          const uploadInfo = extractUploadRequirement(assistantMessage);
          const cleanMessage = uploadInfo.cleanMessage || assistantMessage;
          assistantReply = cleanMessage;
          session.messages.push({ role: "user", content: uploadMessage });
          session.messages.push({ role: "assistant", content: cleanMessage });
          processGuestAssistantReply(session, uploadInfo, uploadMessage);
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
          const requiresReUpload =
            uploadInfo.requiresUpload && uploadInfo.uploadType === "re_upload";
          if (requiresReUpload) {
            session.isDocUploadRequired = true;
            session.isDocUploaded = false;
            if (!session.supportsMultipleUploads) {
              session.uploadedFileId = null;
              session.uploadedFileIds = [];
            }
          }
        } catch (geminiErr) {
          console.error(
            "Failed to generate assistant response after upload:",
            geminiErr
          );
        }
      } else if (session.provider === "openai") {
        await openai.beta.threads.messages.create(session.threadId, {
          role: "user",
          content: uploadMessage,
        });
        const additionalInstructions =
          buildGuestOpenAiAdditionalInstructions(session);
        const runPayload = { assistant_id: session.assistantId };
        if (additionalInstructions) {
          runPayload.additional_instructions = additionalInstructions;
        }
        const run = await openai.beta.threads.runs.create(
          session.threadId,
          runPayload
        );
        let runStatus;
        let attempts = 0;
        do {
          await new Promise((r) => setTimeout(r, 1000));
          runStatus = await openai.beta.threads.runs.retrieve(
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
        const messages = await openai.beta.threads.messages.list(session.threadId);
        const assistantMessage =
          messages.data[0].content[0].text.value || "No response";
        const uploadInfo = extractUploadRequirement(assistantMessage);
        const cleanMessage = uploadInfo.cleanMessage || assistantMessage;
        assistantReply = cleanMessage;
        session.messages.push({ role: "user", content: uploadMessage });
        session.messages.push({ role: "assistant", content: cleanMessage });
        processGuestAssistantReply(session, uploadInfo, uploadMessage);
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
        const requiresReUpload =
          uploadInfo.requiresUpload && uploadInfo.uploadType === "re_upload";
        if (requiresReUpload) {
          session.isDocUploadRequired = true;
          session.isDocUploaded = false;
          session.uploadedFileId = null;
        }
      }
    } catch (autoContinueErr) {
      console.error(
        "Failed to auto-continue conversation after upload:",
        autoContinueErr
      );
    }

    await putGuestSession(guestSessionId, session);

    return res.status(200).json({
      fileIds,
      files: uploadedFiles,
      message:
        uploadedFiles.length > 1
          ? `${uploadedFiles.length} files uploaded successfully`
          : "File uploaded successfully",
      assistantReply,
      conversationResumed: !!assistantReply,
      supportsMultipleUploads: session.supportsMultipleUploads || false,
      totalUploadedFiles: session.uploadedFileIds?.length || fileIds.length,
      uploadedFileIds: session.uploadedFileIds || fileIds,
      fileId: fileIds[0],
      fileName: uploadedFiles[0]?.fileName,
      ...(fileErrors.length > 0 && { errors: fileErrors }),
    });
  } catch (error) {
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

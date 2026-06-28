/**
 * Guest multipart upload — stores file on Gemini, then client streams analysis.
 */
import { Assistant } from "../model/assistant.model.js";
import { getGuestSession, putGuestSession } from "../services/guestSessionStore.js";
import { verifyGuestToken } from "../services/guestToken.js";
import {
  uploadMulterFileToGemini,
  cleanupMulterFiles,
  linkUploadedFilesToSession,
} from "../utils/geminiFileUpload.js";
import { buildPostUploadAnalysisMessage } from "../chat/uploadFlowHints.js";

function readGuestToken(req) {
  return req.get("guest-token") || req.get("Guest-Token");
}

export async function guestUploadDocumentHandler(req, res) {
  const files = req.files || (req.file ? [req.file] : []);

  try {
    const token = readGuestToken(req);
    if (!token) {
      await cleanupMulterFiles(files);
      return res.status(401).json({ error: "guest-token header required" });
    }

    let decoded;
    try {
      decoded = verifyGuestToken(token);
    } catch {
      await cleanupMulterFiles(files);
      return res.status(401).json({ error: "Invalid or expired guest-token" });
    }

    const { guestSessionId } = req.body || {};
    if (!files.length) {
      return res.status(400).json({ error: "No file(s) uploaded" });
    }
    if (!guestSessionId) {
      await cleanupMulterFiles(files);
      return res.status(400).json({ error: "guestSessionId is required in body" });
    }
    if (decoded.guestSessionId !== guestSessionId) {
      await cleanupMulterFiles(files);
      return res.status(403).json({ error: "guestSessionId does not match guest-token" });
    }

    const session = await getGuestSession(guestSessionId);
    if (!session) {
      await cleanupMulterFiles(files);
      return res.status(404).json({ error: "Guest session not found or expired" });
    }
    if (session.anonymousId !== decoded.anonymousId) {
      await cleanupMulterFiles(files);
      return res.status(403).json({ error: "anonymousId does not match guest-token" });
    }
    if (session.assistantKey !== decoded.assistantKey) {
      await cleanupMulterFiles(files);
      return res.status(403).json({ error: "assistantKey does not match guest-token" });
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
        fileErrors.push({ fileName: file.originalname, error: uploadErr.message });
      }
    }

    if (uploadedFiles.length === 0) {
      return res.status(500).json({
        error: "Failed to upload all files",
        errors: fileErrors,
      });
    }

    linkUploadedFilesToSession(session, uploadedFiles);
    await putGuestSession(guestSessionId, session);

    const fileIds = uploadedFiles.map((f) => f.fileId);
    const fileCount = session.supportsMultipleUploads
      ? session.uploadedFileIds?.length || fileIds.length
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
      triggerAnalysis: session.provider === "gemini",
      analysisMessage,
      conversationResumed: false,
      supportsMultipleUploads: session.supportsMultipleUploads || false,
      totalUploadedFiles: session.uploadedFileIds?.length || fileIds.length,
      uploadedFileIds: session.uploadedFileIds || fileIds,
      fileId: fileIds[0],
      fileName: uploadedFiles[0]?.fileName,
      isDocUploaded: session.isDocUploaded,
      isDocUploadRequired: session.isDocUploadRequired,
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

import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { GoogleGenAI } from "@google/genai";
import { resolveGeminiUploadMime } from "./uploadFileTypes.js";
import {
  extractTextFromMulterFile,
  isWordUpload,
} from "./documentTextExtract.js";

/** MIME types Gemini generateContent rejects even after Files API upload. */
const GEMINI_GENERATION_UNSUPPORTED_MIMES = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-word",
  "application/vnd.ms-office",
  "application/x-msword",
]);

export function isGeminiGenerationUnsupportedMime(mimeType) {
  return GEMINI_GENERATION_UNSUPPORTED_MIMES.has(
    String(mimeType || "").toLowerCase().trim()
  );
}

async function uploadBufferToGemini(ai, buffer, { mimeType, displayName }) {
  const os = await import("os");
  const tmpFile = path.join(
    os.tmpdir(),
    `ej-gemini-${uuidv4()}${mimeType === "text/plain" ? ".txt" : ""}`
  );
  await fs.writeFile(tmpFile, buffer);
  try {
    return await ai.files.upload({
      file: tmpFile,
      config: { mimeType, displayName },
    });
  } finally {
    await fs.unlink(tmpFile).catch(() => {});
  }
}

function resolveUploadedFileId(uploadResponse) {
  return (
    uploadResponse?.file?.uri ||
    uploadResponse?.file?.name ||
    uploadResponse?.uri ||
    uploadResponse?.fileId ||
    uploadResponse?.name ||
    null
  );
}

/**
 * Upload a multer temp file to Gemini Files API with extension-aware MIME.
 * Word documents are converted to plain text because Gemini cannot analyze DOC/DOCX MIME.
 */
export async function uploadMulterFileToGemini(file, { apiKey } = {}) {
  const ai = new GoogleGenAI({ apiKey: apiKey || process.env.GEMINI_API_KEY });
  const displayName = file.originalname || `document_${uuidv4()}`;
  const sourceMime = resolveGeminiUploadMime({
    mimetype: file.mimetype,
    originalname: file.originalname,
  });

  let uploadResponse;
  let analysisMime = sourceMime;

  if (isWordUpload({ mimetype: sourceMime, originalname: file.originalname })) {
    const extractedText = await extractTextFromMulterFile(file);
    const textBuffer = Buffer.from(extractedText, "utf8");
    uploadResponse = await uploadBufferToGemini(ai, textBuffer, {
      mimeType: "text/plain",
      displayName: `${path.basename(displayName, path.extname(displayName))}.txt`,
    });
    analysisMime = "text/plain";
  } else {
    const fileBuffer = await fs.readFile(file.path);
    try {
      uploadResponse = await ai.files.upload({
        file: file.path,
        config: { mimeType: sourceMime, displayName },
      });
    } catch {
      uploadResponse = await ai.files.upload({
        file: fileBuffer,
        config: { mimeType: sourceMime, displayName },
      });
    }
  }

  const fileId = resolveUploadedFileId(uploadResponse);
  if (!fileId) {
    throw new Error("Failed to extract file ID from Gemini upload response");
  }

  const fileRef = uploadResponse?.file?.name || uploadResponse?.name;
  if (fileRef) {
    await waitForGeminiFileActive(ai, fileRef);
  }

  return {
    fileId,
    mimeType: analysisMime,
    fileName: displayName,
    sourceMimeType: sourceMime,
  };
}

async function waitForGeminiFileActive(ai, fileName, { maxWaitMs = 90000 } = {}) {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    try {
      const meta = await ai.files.get({ name: fileName });
      const state = meta?.state || meta?.file?.state;
      if (state === "ACTIVE") return meta;
      if (state === "FAILED") {
        throw new Error("Gemini could not process the uploaded file");
      }
    } catch (err) {
      if (/FAILED/i.test(String(err?.message || ""))) throw err;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("Uploaded file is still processing — please try again in a moment");
}

export async function cleanupMulterFiles(files = []) {
  await Promise.all(
    files.map((file) =>
      file?.path ? fs.unlink(file.path).catch(() => {}) : Promise.resolve()
    )
  );
}

/** Attach Gemini file URIs to session after multipart upload. */
export function linkUploadedFilesToSession(session, uploadedFiles = []) {
  const shouldReplace =
    !session.supportsMultipleUploads ||
    session.replaceNextUpload === true ||
    session.isDocUploadRequired === true;

  if (shouldReplace) {
    session.uploadedFileIds = [];
    session.uploadedFilesMeta = [];
    session.replaceNextUpload = false;
  } else if (!session.uploadedFileIds) {
    session.uploadedFileIds = [];
  }
  if (!session.uploadedFilesMeta) {
    session.uploadedFilesMeta = [];
  }

  for (const item of uploadedFiles) {
    if (!item?.fileId) continue;
    session.uploadedFileIds.push(item.fileId);
    session.uploadedFilesMeta.push({
      fileId: item.fileId,
      fileName: item.fileName || null,
      mimeType: item.mimeType || null,
      sourceMimeType: item.sourceMimeType || null,
    });
  }

  const last = uploadedFiles[uploadedFiles.length - 1];
  if (last?.fileId) {
    session.uploadedFileId = last.fileId;
  }
  session.isDocUploaded = true;
  session.isDocUploadRequired = false;
  session.uploadAttempts = (session.uploadAttempts || 0) + 1;
}

export const POST_UPLOAD_ANALYSIS_MESSAGE =
  "Document uploaded successfully. Please analyze it.";

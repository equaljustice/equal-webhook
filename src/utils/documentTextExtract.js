import { promises as fs } from "fs";
import path from "path";
import mammoth from "mammoth";

const WORD_MIMES = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-word",
  "application/vnd.ms-office",
  "application/x-msword",
]);

const WORD_EXTENSIONS = new Set([".doc", ".docx"]);

export function isWordUpload({ mimetype, originalname } = {}) {
  const mime = String(mimetype || "").toLowerCase().trim();
  if (WORD_MIMES.has(mime)) return true;
  const ext = path.extname(String(originalname || "")).toLowerCase();
  return WORD_EXTENSIONS.has(ext);
}

/**
 * Extract plain text from a multer temp file (DOCX/DOC). Used because Gemini
 * generateContent does not accept Word MIME types even after Files API upload.
 */
export async function extractTextFromMulterFile(file) {
  if (!file?.path) {
    throw new Error("Uploaded file path is missing");
  }

  const buffer = await fs.readFile(file.path);
  const ext = path.extname(String(file.originalname || "")).toLowerCase();

  if (ext === ".doc") {
    throw new Error(
      "Legacy .doc format is not supported for analysis. Please upload PDF or DOCX."
    );
  }

  const result = await mammoth.extractRawText({ buffer });
  const text = String(result.value || "").trim();
  if (!text) {
    throw new Error(
      "Could not read text from the Word document. Please upload a PDF or paste the document text in chat."
    );
  }
  return text;
}

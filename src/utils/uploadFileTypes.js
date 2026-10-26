import path from "path";

/**
 * Gemini-safe chat upload allow list (keep in sync with frontend
 * chat-upload-validation.ts).
 * Legacy .doc excluded — analysis always failed after accept.
 */
const ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/jpg",
  "image/pjpeg",
  "image/webp",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".docx",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
]);

const GENERIC_MIMES = new Set([
  "",
  "application/octet-stream",
  "application/zip",
  "application/x-zip-compressed",
  "binary/octet-stream",
]);

/** Max size per uploaded chat document (10 MB). */
export const MAX_UPLOAD_FILE_BYTES = 10 * 1024 * 1024;

function normalizeExtension(originalname = "") {
  const ext = path.extname(String(originalname).trim()).toLowerCase();
  if (!ext) return "";
  const match = ext.slice(1).match(/^([a-z0-9]+)/);
  return match ? `.${match[1]}` : "";
}

export function isAllowedUploadFile({ mimetype, originalname } = {}) {
  const ext = normalizeExtension(originalname);
  if (ext && ALLOWED_EXTENSIONS.has(ext)) {
    return true;
  }

  const mime = String(mimetype || "").toLowerCase().trim();
  if (ALLOWED_MIMES.has(mime)) {
    return true;
  }

  if (GENERIC_MIMES.has(mime) && ext && ALLOWED_EXTENSIONS.has(ext)) {
    return true;
  }

  return false;
}

export function resolveGeminiUploadMime({ mimetype, originalname } = {}) {
  const ext = normalizeExtension(originalname);
  const byExt = {
    ".pdf": "application/pdf",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  };
  if (ext && byExt[ext]) {
    return byExt[ext];
  }

  const mime = String(mimetype || "").toLowerCase().trim();
  if (mime && ALLOWED_MIMES.has(mime)) {
    return mime;
  }

  return "application/pdf";
}

export const UPLOAD_TYPE_ERROR =
  "Invalid file type. Only PDF, DOCX, and images (JPG/JPEG/PNG/WEBP) are allowed.";

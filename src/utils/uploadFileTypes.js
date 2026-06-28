import path from "path";

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.ms-word",
  "application/vnd.ms-office",
  "application/x-msword",
  "image/jpeg",
  "image/png",
  "image/jpg",
  "image/pjpeg",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".jpg",
  ".jpeg",
  ".png",
]);

const GENERIC_MIMES = new Set([
  "",
  "application/octet-stream",
  "application/zip",
  "application/x-zip-compressed",
  "binary/octet-stream",
]);

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
    ".doc": "application/msword",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
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
  "Invalid file type. Only PDF, DOC, DOCX, and images are allowed.";

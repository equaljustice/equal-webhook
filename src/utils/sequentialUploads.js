/**
 * Uploads that arrive one document at a time (service bond: bond, then contract, then notice).
 * Off unless JOLLYJI_SEQUENTIAL_UPLOADS=true (deploy ≠ enable). When on:
 * - every file of the session's current upload set reaches the model, not just the last one;
 * - a new upload request after a file is already held re-opens the upload and ADDS to the set.
 */
export const isSequentialUploadsEnabled = () =>
  String(process.env.JOLLYJI_SEQUENTIAL_UPLOADS || "").toLowerCase() === "true";

/** Upload rounds per session before further upload requests are ignored (loop guard). */
export const MAX_UPLOAD_ROUNDS = 4;

/** "a.pdf, b.pdf" for the analysis message, so the model knows which documents it holds. */
export function uploadedFileNames(session) {
  return (session.uploadedFilesMeta || [])
    .map((f) => f?.fileName)
    .filter(Boolean)
    .join(", ");
}

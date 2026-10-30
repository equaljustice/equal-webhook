/**
 * PDF/Word download of the final document. Off unless JOLLYJI_DOC_DOWNLOAD_ENABLED=true
 * (Sahil 2026-10-30: download disabled on both sides). When off, every session reports
 * docDownloadAvailable:false and the download routes answer 404, whatever the
 * Assistant row says. The document snapshot is still saved: the payment guard uses it.
 */
export function isDocDownloadEnabled() {
  const v = process.env.JOLLYJI_DOC_DOWNLOAD_ENABLED;
  return v === "true" || v === "1";
}

/** Assistant flag as clients should see it. */
export function effectiveDocDownloadAvailable(assistantFlag) {
  return isDocDownloadEnabled() && assistantFlag === true;
}

/** Route guard: answers 404 and returns true when download is switched off. */
export function rejectWhenDocDownloadDisabled(res) {
  if (isDocDownloadEnabled()) return false;
  res.status(404).json({ error: "Document download is not available" });
  return true;
}

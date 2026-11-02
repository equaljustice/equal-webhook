import { test } from "node:test";
import assert from "node:assert/strict";
import { collectFilesToUse } from "../src/chat/chatTurnHandler.js";

test("collectFilesToUse attaches uploads when none consumed", () => {
  assert.deepEqual(collectFilesToUse({ uploadedFileId: "a" }), ["a"]);
  assert.deepEqual(
    collectFilesToUse({ supportsMultipleUploads: true, uploadedFileIds: ["a", "b"] }),
    ["a", "b"]
  );
});

test("collectFilesToUse skips consumed uploads but keeps new ones", () => {
  assert.deepEqual(collectFilesToUse({ uploadedFileId: "a", consumedFileIds: ["a"] }), []);
  assert.deepEqual(
    collectFilesToUse({ supportsMultipleUploads: true, uploadedFileIds: ["a", "b"], consumedFileIds: ["a"] }),
    ["b"]
  );
  assert.deepEqual(collectFilesToUse({ consumedFileIds: ["a"] }, "c"), ["c"]);
});

// Marriage 2nd/3rd register (local walk 2026-11-02): a new upload request after the first gift list
// went into a paid document must show the upload again; otherwise the user is stuck on
// "Please upload your gift list" with no upload panel.
test("a new upload request after every file was consumed starts a fresh upload", async () => {
  const { applyUploadFlagsFromResult } = await import("../src/chat/chatTurnHandler.js");
  const session = {
    isDocUploaded: true,
    isDocUploadRequired: false,
    uploadedFileId: "f1",
    uploadedFileIds: ["f1"],
    uploadedFilesMeta: [{ fileId: "f1" }],
    consumedFileIds: ["f1"],
    uploadAttempts: 2,
  };
  applyUploadFlagsFromResult(session, { requiresUpload: true, uploadType: "initial" });
  assert.equal(session.isDocUploadRequired, true);
  assert.equal(session.isDocUploaded, false);
  assert.deepEqual(session.uploadedFileIds, []);
  assert.equal(session.uploadAttempts, 0);
});

test("a repeat upload request while the current file is still in use is ignored (unchanged)", async () => {
  const { applyUploadFlagsFromResult } = await import("../src/chat/chatTurnHandler.js");
  const session = { isDocUploaded: true, uploadedFileId: "f2", uploadedFileIds: ["f2"], consumedFileIds: ["f1"], uploadAttempts: 1 };
  applyUploadFlagsFromResult(session, { requiresUpload: true, uploadType: "initial" });
  assert.equal(session.isDocUploaded, true);
  assert.equal(session.isDocUploadRequired, undefined);
});

import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { applyUploadFlagsFromResult, collectFilesToUse } from "../src/chat/chatTurnHandler.js";
import { linkUploadedFilesToSession } from "../src/utils/geminiFileUpload.js";
import { buildPostUploadAnalysisMessage } from "../src/chat/uploadFlowHints.js";

const on = () => (process.env.JOLLYJI_SEQUENTIAL_UPLOADS = "true");
afterEach(() => delete process.env.JOLLYJI_SEQUENTIAL_UPLOADS);

// Service bond walk 2026-11-02: bond + contract uploaded together on a single-upload assistant;
// only uploadedFileId (the contract) reached the model, which then kept asking for the bond.
test("flag on: every file of a single-upload batch reaches the model", () => {
  const session = { uploadedFileId: "b", uploadedFileIds: ["a", "b"] };
  assert.deepEqual(collectFilesToUse(session), ["b"]);
  on();
  assert.deepEqual(collectFilesToUse(session), ["a", "b"]);
});

test("flag on, multi-upload assistant: the next document request re-opens the upload and appends", () => {
  on();
  const session = {
    supportsMultipleUploads: true,
    isDocUploaded: true,
    uploadedFileId: "a",
    uploadedFileIds: ["a"],
    uploadedFilesMeta: [{ fileId: "a", fileName: "bond.pdf" }],
    uploadAttempts: 1,
  };
  applyUploadFlagsFromResult(session, { requiresUpload: true, uploadType: "initial" });
  assert.equal(session.isDocUploadRequired, true);
  assert.equal(session.isDocUploaded, false);
  linkUploadedFilesToSession(session, [{ fileId: "b", fileName: "contract.pdf" }]);
  assert.deepEqual(session.uploadedFileIds, ["a", "b"]);
  assert.equal(session.isDocUploaded, true);
  assert.equal(session.appendNextUpload, false);
  assert.match(
    buildPostUploadAnalysisMessage({ ...session, assistantKey: "service_bond" }, null, 2),
    /Files received so far: bond\.pdf, contract\.pdf\./
  );
});

test("upload rounds are capped", () => {
  on();
  const session = { supportsMultipleUploads: true, isDocUploaded: true, uploadedFileIds: ["a"], uploadAttempts: 4 };
  applyUploadFlagsFromResult(session, { requiresUpload: true, uploadType: "initial" });
  assert.equal(session.isDocUploaded, true);
  assert.equal(session.isDocUploadRequired, undefined);
});

test("single-upload assistants still ignore repeat requests with the flag on", () => {
  on();
  const session = { isDocUploaded: true, uploadedFileId: "a", uploadedFileIds: ["a"], uploadAttempts: 1 };
  applyUploadFlagsFromResult(session, { requiresUpload: true, uploadType: "initial" });
  assert.equal(session.isDocUploaded, true);
  assert.equal(session.isDocUploadRequired, undefined);
});

test("flag off: analysis message unchanged", () => {
  const msg = buildPostUploadAnalysisMessage({ uploadedFilesMeta: [{ fileName: "x.pdf" }] }, null, 1);
  assert.doesNotMatch(msg, /Files received/);
});

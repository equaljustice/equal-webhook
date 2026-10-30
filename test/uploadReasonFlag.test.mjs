// upload_reason without upload_required:true still asks for the upload (QA 2026-10-30 F6).
// Run: node --test test/uploadReasonFlag.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

import { extractUploadRequirement } from "../src/chat/messageControlParse.js";

const turn = (json) => `Please upload your Employment Contract (PDF, Word, or image).\n${JSON.stringify(json)}`;
const base = { upload_required: false, upload_type: null, upload_reason: null, session_terminated: false, termination_message: null, payment_required: false };

test("a reason with upload_required:false is an upload request", () => {
  const info = extractUploadRequirement(turn({ ...base, upload_reason: "Employment Contract required for assessment" }));
  assert.equal(info.requiresUpload, true);
  assert.equal(info.uploadType, "initial");
});

test("no reason (or a 'null' string) stays a normal turn", () => {
  assert.equal(extractUploadRequirement(turn(base)).requiresUpload, false);
  assert.equal(extractUploadRequirement(turn({ ...base, upload_reason: "null" })).requiresUpload, false);
});

test("an explicit re_upload keeps its type", () => {
  const info = extractUploadRequirement(turn({ ...base, upload_required: true, upload_type: "re_upload", upload_reason: "unclear scan" }));
  assert.equal(info.requiresUpload, true);
  assert.equal(info.uploadType, "re_upload");
});

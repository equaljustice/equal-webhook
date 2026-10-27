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

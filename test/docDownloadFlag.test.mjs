// Run: node --test test/docDownloadFlag.test.mjs
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  isDocDownloadEnabled,
  effectiveDocDownloadAvailable,
  rejectWhenDocDownloadDisabled,
} from "../src/chat/docDownloadFlag.js";

const prev = process.env.JOLLYJI_DOC_DOWNLOAD_ENABLED;
afterEach(() => {
  if (prev === undefined) delete process.env.JOLLYJI_DOC_DOWNLOAD_ENABLED;
  else process.env.JOLLYJI_DOC_DOWNLOAD_ENABLED = prev;
});

function fakeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => ((res.statusCode = c), res);
  res.json = (b) => ((res.body = b), res);
  return res;
}

test("unset: download off even when the assistant row allows it; routes 404", () => {
  delete process.env.JOLLYJI_DOC_DOWNLOAD_ENABLED;
  assert.equal(isDocDownloadEnabled(), false);
  assert.equal(effectiveDocDownloadAvailable(true), false);
  const res = fakeRes();
  assert.equal(rejectWhenDocDownloadDisabled(res), true);
  assert.equal(res.statusCode, 404);
});

test("enabled: the assistant row decides; routes pass", () => {
  process.env.JOLLYJI_DOC_DOWNLOAD_ENABLED = "true";
  assert.equal(effectiveDocDownloadAvailable(true), true);
  assert.equal(effectiveDocDownloadAvailable(false), false);
  assert.equal(effectiveDocDownloadAvailable(undefined), false);
  assert.equal(rejectWhenDocDownloadDisabled(fakeRes()), false);
});

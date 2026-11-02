import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { enforceLegacySessionGuards } from "../src/chat/sessionGuards.js";

afterEach(() => delete process.env.JOLLYJI_NO_TERMINATE_ON_QUESTION);
const batch = {
  sessionTerminated: true,
  terminationMessage: "Your session is over now.",
  batchForm: true,
  cleanMessage: "<h5><strong>Question 10:</strong></h5><h6>Were you paid?</h6>(a) Yes<br>(b) No",
};

test("flag off: model termination is trusted (unchanged)", () => {
  assert.equal(enforceLegacySessionGuards({}, batch).sessionTerminated, true);
});

test("flag on: a reply that asks questions does not end the chat", () => {
  process.env.JOLLYJI_NO_TERMINATE_ON_QUESTION = "true";
  const out = enforceLegacySessionGuards({}, batch);
  assert.equal(out.sessionTerminated, false);
  assert.equal(out.terminationMessage, null);
  const single = enforceLegacySessionGuards({}, { ...batch, batchForm: false });
  assert.equal(single.sessionTerminated, false);
});

test("flag on: a real closing message still ends the chat", () => {
  process.env.JOLLYJI_NO_TERMINATE_ON_QUESTION = "true";
  const out = enforceLegacySessionGuards({}, {
    sessionTerminated: true,
    batchForm: false,
    cleanMessage: "Thank you for using www.jollyji.in. Your session is over now.",
  });
  assert.equal(out.sessionTerminated, true);
});

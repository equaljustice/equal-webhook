// "text_input": true marks a typed-answer question in any language (2026-11-01, issue 1).
// Run: node --test test/textInputProtocol.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

import { extractUploadRequirement } from "../src/chat/messageControlParse.js";
import {
  applyTextInputDisplayMarker,
  TEXT_INPUT_MARKER_RE,
} from "../src/chat/textInputControl.js";
import { applyPromptHygiene } from "../src/chat/promptHygiene.js";

const base = { upload_required: false, session_terminated: false, payment_required: false, batch_form: false, multi_select: false };
const turn = (text, json) => `${text}\n${JSON.stringify(json)}`;

test("text_input:true is parsed and the JSON is stripped, whatever the language", () => {
  const info = extractUploadRequirement(turn("<p>प्रश्न 3: आपकी जन्म तिथि क्या है?</p>", { ...base, text_input: true }));
  assert.equal(info.textInput, true);
  assert.ok(!info.cleanMessage.includes("text_input"));
  assert.ok(info.cleanMessage.includes("प्रश्न 3"));
});

test("absent or false stays off", () => {
  assert.equal(extractUploadRequirement(turn("Q", base)).textInput, false);
  assert.equal(extractUploadRequirement(turn("Q", { ...base, text_input: "false" })).textInput, false);
  assert.equal(extractUploadRequirement("plain text, no JSON").textInput, false);
});

test("a control block holding only text_input is still recognised and stripped", () => {
  const info = extractUploadRequirement(turn("What is your name?", { text_input: true }));
  assert.equal(info.textInput, true);
  assert.equal(info.cleanMessage.trim(), "What is your name?");
});

test("marker is added once, and not to empty text", () => {
  const once = applyTextInputDisplayMarker("<p>Name?</p>", true);
  assert.match(once, TEXT_INPUT_MARKER_RE);
  assert.equal(applyTextInputDisplayMarker(once, true), once);
  assert.equal(applyTextInputDisplayMarker("<p>Name?</p>", false), "<p>Name?</p>");
  assert.equal(applyTextInputDisplayMarker("  ", true), "  ");
});

test("the model is told about text_input only when the flag is on", () => {
  const saved = { h: process.env.JOLLYJI_PROMPT_HYGIENE, t: process.env.JOLLYJI_TEXT_INPUT_PROTOCOL };
  try {
    delete process.env.JOLLYJI_PROMPT_HYGIENE;
    delete process.env.JOLLYJI_TEXT_INPUT_PROTOCOL;
    assert.equal(applyPromptHygiene("PROMPT EqualJustice"), "PROMPT EqualJustice");
    process.env.JOLLYJI_TEXT_INPUT_PROTOCOL = "true";
    const onlyInput = applyPromptHygiene("PROMPT EqualJustice");
    assert.ok(onlyInput.startsWith("PROMPT EqualJustice")); // no rebrand without hygiene
    assert.ok(onlyInput.includes('"text_input": true'));
    process.env.JOLLYJI_PROMPT_HYGIENE = "true";
    const both = applyPromptHygiene("PROMPT EqualJustice");
    assert.ok(both.includes("PROMPT JollyJi") && both.includes("JOLLYJI RULES") && both.includes("JOLLYJI INPUT RULE"));
  } finally {
    for (const [k, v] of [["JOLLYJI_PROMPT_HYGIENE", saved.h], ["JOLLYJI_TEXT_INPUT_PROTOCOL", saved.t]])
      v === undefined ? delete process.env[k] : (process.env[k] = v);
  }
});

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

test("server infers a typed answer when the model leaves the key out (flag on only)", async () => {
  const { resolveTextInput } = await import("../src/chat/textInputControl.js");
  const saved = process.env.JOLLYJI_TEXT_INPUT_PROTOCOL;
  const info = { textInput: false, multiSelect: false, batchForm: false, requiresUpload: false, paymentRequired: false, sessionTerminated: false };
  const details = "Question 2: कृपया पार्टी 1 के लिए निम्नलिखित विवरण प्रदान करें: पैन के अनुसार पूरा नाम, पैन नंबर, पता";
  try {
    delete process.env.JOLLYJI_TEXT_INPUT_PROTOCOL;
    assert.equal(resolveTextInput(info, details), false);
    assert.equal(resolveTextInput({ ...info, textInput: true }, "x"), true);
    process.env.JOLLYJI_TEXT_INPUT_PROTOCOL = "true";
    assert.equal(resolveTextInput(info, details), true);
    assert.equal(resolveTextInput(info, "আপনার নাম কী?"), true);
    assert.equal(resolveTextInput(info, "प्रश्न 2: कृपया पार्टी 1 के लिए विवरण प्रदान करें: नाम, पैन नंबर।"), true);
    assert.equal(resolveTextInput(info, "<p>প্রশ্ন ২: আপনার ঠিকানা লিখুন।</p>"), true);
    assert.equal(resolveTextInput(info, "<p>Party 1 details noted. Thank you.</p>"), false);
    assert.equal(resolveTextInput(info, "Question 1: NDA के लिए पार्टी 1 का प्रकार? (a) व्यक्ति<br>(b) कंपनी"), false);
    assert.equal(resolveTextInput(info, "पार्टी? (क) व्यक्ति (ख) कंपनी"), false);
    assert.equal(resolveTextInput(info, "<p>Here is your NDA draft.</p>"), false);
    assert.equal(resolveTextInput({ ...info, batchForm: true }, details), false);
    assert.equal(resolveTextInput({ ...info, paymentRequired: true }, details), false);
    assert.equal(resolveTextInput({ ...info, requiresUpload: true }, details), false);
  } finally {
    saved === undefined ? delete process.env.JOLLYJI_TEXT_INPUT_PROTOCOL : (process.env.JOLLYJI_TEXT_INPUT_PROTOCOL = saved);
  }
});

test("text_input is added to each prompt's JSON schema and to upload/payment/end examples", async () => {
  const { addTextInputToTemplates } = await import("../src/chat/textInputControl.js");
  const schema = '{\n  "session_terminated": true or false,\n  "payment_required": true or false\n}';
  assert.equal(addTextInputToTemplates(schema), '{\n  "session_terminated": true or false,\n  "payment_required": true or false,\n  "text_input": true or false\n}');
  assert.equal(addTextInputToTemplates('"payment_required": true or false,\n "x": 1'), '"payment_required": true or false,\n  "text_input": true or false,\n "x": 1');
  assert.equal(addTextInputToTemplates('{"upload_required": false, "payment_required": true}'), '{"upload_required": false, "payment_required": true, "text_input": false}');
  const dflt = '{"upload_required": false, "payment_required": false}';
  assert.equal(addTextInputToTemplates(dflt), dflt);
});

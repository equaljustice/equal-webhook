// Offline tests for control-JSON parsing (extractUploadRequirement).
// Run: node --test test/controlParse.test.mjs
import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

import { extractUploadRequirement } from "../src/chat/messageControlParse.js";

const prevProgress = process.env.JOLLYJI_PROGRESS_ENABLED;
beforeEach(() => {
  delete process.env.JOLLYJI_PROGRESS_ENABLED;
});
after(() => {
  if (prevProgress === undefined) delete process.env.JOLLYJI_PROGRESS_ENABLED;
  else process.env.JOLLYJI_PROGRESS_ENABLED = prevProgress;
});

// v2 marriage prompt schema (assets/prompts/marrige_planning.txt header).
const DEFAULT_JSON =
  '{"session_terminated": false, "termination_message": null, "payment_required": false, "batch_form": false, "multi_select": false, "upload_required": false, "upload_type": null, "upload_reason": null}';
const PAYMENT_JSON = DEFAULT_JSON.replace('"payment_required": false', '"payment_required": true');
const UPLOAD_JSON = DEFAULT_JSON.replace('"upload_required": false', '"upload_required": true')
  .replace('"upload_type": null', '"upload_type": "initial"')
  .replace('"upload_reason": null', '"upload_reason": "Gift list file"');
const TERMINATION_JSON = DEFAULT_JSON.replace('"session_terminated": false', '"session_terminated": true')
  .replace('"termination_message": null', '"termination_message": "Thank you. Your session is complete."');

const PAY_TEXT =
  "To generate your customized draft for Marriage Gift Ledger / Stridhan Register, please complete the payment.";
const Q_HTML =
  "<h5><strong>Question 1:</strong></h5><h6>Has the marriage already taken place?</h6>(a) Yes<br>(b) No<br>";

// EDITH 2026-10-20 raw capture (raw/goa-1.json), inline, progress nested in session_state.
const GOA =
  'Do you want to continue?<br>(a) Yes<br>(b) No<br>{"upload_required": false, "upload_type": null, "upload_reason": null, "session_terminated": false, "termination_message": null, "payment_required": false, "session_state": {"current_step": "q0", "language": "en", "answers": {"language": "en"}, "notice_paragraph_keys": [], "progress": 5, "batch_label": "Eligibility"}}';

function flags(r) {
  return {
    pay: r.paymentRequired,
    term: r.sessionTerminated,
    upl: r.requiresUpload,
    batch: r.batchForm,
  };
}

test("EDITH goa capture: no false terminate/upload, progress read from session_state", () => {
  for (const on of [false, true]) {
    if (on) process.env.JOLLYJI_PROGRESS_ENABLED = "true";
    else delete process.env.JOLLYJI_PROGRESS_ENABLED;
    const r = extractUploadRequirement(GOA);
    assert.deepEqual(flags(r), { pay: false, term: false, upl: false, batch: false }, `progress=${on}`);
    assert.equal(r.cleanMessage, "Do you want to continue?<br>(a) Yes<br>(b) No<br>");
    assert.equal(r.sessionState.current_step, "q0");
    if (on) {
      assert.equal(r.progress, 5);
      assert.equal(r.batchLabel, "Eligibility");
    } else {
      assert.equal(r.progress, undefined);
    }
  }
});

test("v2 default/payment/upload/termination JSON inline after HTML", () => {
  const cases = [
    [DEFAULT_JSON, { pay: false, term: false, upl: false, batch: false }],
    [PAYMENT_JSON, { pay: true, term: false, upl: false, batch: false }],
    [UPLOAD_JSON, { pay: false, term: false, upl: true, batch: false }],
    [TERMINATION_JSON, { pay: false, term: true, upl: false, batch: false }],
  ];
  for (const [json, want] of cases) {
    for (const sep of ["", " ", "\n", "\n\n"]) {
      const r = extractUploadRequirement(`${Q_HTML}${sep}${json}`);
      assert.deepEqual(flags(r), want, `${json.slice(0, 40)} sep=${JSON.stringify(sep)}`);
      assert.equal(r.cleanMessage, Q_HTML.trim());
    }
  }
  const up = extractUploadRequirement(`Please upload your gift list.${UPLOAD_JSON}`);
  assert.equal(up.uploadType, "initial");
  assert.equal(up.reason, "Gift list file");
  const t = extractUploadRequirement(`Goodbye.${TERMINATION_JSON}`);
  assert.equal(t.terminationMessage, "Thank you. Your session is complete.");
});

test("nested session_state (answers + progress) before or after the flags, inline", () => {
  process.env.JOLLYJI_PROGRESS_ENABLED = "true";
  const ss = '"session_state": {"current_step": "doc_payment", "language": "en", "answers": {"q1": "a", "doc": {"name": "ledger"}}, "progress": 90, "batch_label": "Documents"}';
  const first = `${PAY_TEXT} {${ss}, ${PAYMENT_JSON.slice(1)}`;
  const last = `${PAY_TEXT} ${PAYMENT_JSON.slice(0, -1)}, ${ss}}`;
  for (const msg of [first, last]) {
    const r = extractUploadRequirement(msg);
    assert.deepEqual(flags(r), { pay: true, term: false, upl: false, batch: false });
    assert.equal(r.cleanMessage, PAY_TEXT);
    assert.equal(r.sessionState.answers.doc.name, "ledger");
    assert.equal(r.progress, 90);
    assert.equal(r.batchLabel, "Documents");
  }
});

test("fenced and pretty-printed control JSON", () => {
  const fenced = extractUploadRequirement(`${PAY_TEXT}\n\`\`\`json\n${PAYMENT_JSON}\n\`\`\``);
  assert.deepEqual(flags(fenced), { pay: true, term: false, upl: false, batch: false });
  assert.equal(fenced.cleanMessage, PAY_TEXT);
  const pretty = extractUploadRequirement(`${PAY_TEXT}\n${JSON.stringify(JSON.parse(PAYMENT_JSON), null, 2)}`);
  assert.deepEqual(flags(pretty), { pay: true, term: false, upl: false, batch: false });
});

test("malformed JSON tail (missing brace / trailing comma) → no false terminate/upload", () => {
  for (const json of [DEFAULT_JSON, PAYMENT_JSON]) {
    for (const broken of [json.slice(0, -1), `${json.slice(0, -1)},}`]) {
      const r = extractUploadRequirement(`${Q_HTML}\n${broken}`);
      assert.equal(r.sessionTerminated, false, broken);
      assert.equal(r.requiresUpload, false, broken);
      assert.doesNotMatch(r.cleanMessage, /session_terminated|upload_required/);
    }
  }
});

test("payment sentence + malformed JSON → payment kept, no termination", () => {
  const r = extractUploadRequirement(`${PAY_TEXT}\n${PAYMENT_JSON.slice(0, -1)}`);
  assert.deepEqual(flags(r), { pay: true, term: false, upl: false, batch: false });
  assert.equal(r.cleanMessage, PAY_TEXT);
});

test("no control JSON at all → legacy keyword fallback unchanged", () => {
  const up = extractUploadRequirement("Please upload your rent agreement.");
  assert.equal(up.requiresUpload, true);
  assert.equal(up.uploadType, "initial");
  const end = extractUploadRequirement("Your session is over now. You can exit or start a new session.");
  assert.equal(end.sessionTerminated, true);
  const plain = extractUploadRequirement(PAY_TEXT);
  assert.deepEqual(flags(plain), { pay: false, term: false, upl: false, batch: false });
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dropGeneratedDocOptions,
  endsWithClosingAfterDocument,
  generatedDocTitles,
} from "../src/chat/docMenuDedupe.js";

const doc = (title) => ({
  role: "assistant",
  content: `<h5><strong>${title}</strong></h5><p>${"Body of the document. ".repeat(60)}</p>`,
});

// F&F last-pick walk (2026-11-03): (c) re-offered after it was generated first.
const ffMenu =
  "<h5><strong>Which document do you wish to generate?</strong></h5>\n(a) Detailed F&amp;F Statutory Audit &amp; Recalculation Statement<br>\n(c) Formal Notice to HR for Statutory Non-Compliance &amp; FnF Delay<br>";

test("titles come from earlier document replies only", () => {
  const titles = generatedDocTitles([
    { role: "assistant", content: "Which document do you wish to generate?" },
    doc("Formal Notice to HR for Statutory Non-Compliance & FnF Delay"),
    { role: "user", content: "(a) Generate another document" },
  ]);
  assert.deepEqual(titles, ["Formal Notice to HR for Statutory Non-Compliance & FnF Delay"]);
});

test("an already generated document is dropped from the menu", () => {
  const { html, dropped } = dropGeneratedDocOptions(ffMenu, [
    "Formal Notice to HR for Statutory Non-Compliance & FnF Delay",
    "Soft-Toned Clarification & Rectification Email to HR / Finance",
  ]);
  assert.equal(dropped.length, 1);
  assert.match(html, /\(a\) Detailed F&amp;F/);
  assert.doesNotMatch(html, /Formal Notice/);
});

test("label and title wording may differ slightly (emp / salary)", () => {
  const menu = "Which document do you wish to generate?<br>(a) Notice to the employer<br>(b) Police Complaint<br>";
  const { html } = dropGeneratedDocOptions(menu, ["Notice to Employer"]);
  assert.doesNotMatch(html, /Notice to the employer/);
  assert.match(html, /\(b\) Police Complaint/);
});

test("never empties the menu, and leaves other replies alone", () => {
  const menu = "Which document do you wish to generate?<br>(a) Police Complaint<br>";
  assert.equal(dropGeneratedDocOptions(menu, ["Police Complaint"]).html, menu);
  const nextStep = "Next step<br>(a) Generate another document<br>(b) End session";
  assert.equal(dropGeneratedDocOptions(nextStep, ["Police Complaint"]).html, nextStep);
});

test("salary menu shape: first option right after the heading tag", () => {
  // Verbatim from the salary last-pick walk (2026-11-03), RP notice already generated.
  const menu =
    "<h5><strong>Document selection</strong></h5><h6>Which document do you wish to generate?</h6>(a) Notice to the employer<br>(b) Notice to resolution professional / liquidator<br>";
  const { html, dropped } = dropGeneratedDocOptions(menu, ["Notice to Resolution Professional / Liquidator"]);
  assert.deepEqual(dropped, ["Notice to resolution professional / liquidator"]);
  assert.match(html, /<\/h6>\(a\) Notice to the employer<br>$/);
});

test("a document that ends with the closing thank-you ends the chat", () => {
  const body = `<strong>Detailed F&amp;F Statutory Audit</strong><br>${"Finding. ".repeat(120)}`;
  const closing = "<br>Thank you for using www.jollyji.in. You can reach out to askjolly@jollyji.in for any further help.";
  assert.equal(endsWithClosingAfterDocument(body + closing), true);
  // Still asking: emp's "Next step" menu after the thank-you.
  assert.equal(
    endsWithClosingAfterDocument(body + closing + "<br>Next step<br>(a) Yes — generate the other document<br>(b) No — end session"),
    false
  );
  // Salary's short stand-alone thank-you before the document menu is not a document.
  assert.equal(endsWithClosingAfterDocument(closing), false);
  // A document with no closing line keeps the chat open.
  assert.equal(endsWithClosingAfterDocument(body), false);
});

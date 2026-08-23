#!/usr/bin/env node
/**
 * Second-pass fixes found during full use-case audit.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const PROMPTS = path.join(path.dirname(fileURLToPath(import.meta.url)), "../assets/prompts");
const DOC_SEL_BLOCK = fs.readFileSync(
  path.join(PROMPTS, "_document_selection_protocol_block.txt"),
  "utf8"
).trimEnd();

const SKIP = new Set([
  "_common_control_protocol.txt",
  "_payment_checkpoints.examples.txt",
  "_upload_protocol_block.txt",
  "_document_selection_protocol_block.txt",
  "_language_selection_block.txt",
  "_document_language_block.txt",
]);

function fixAll(text) {
  let t = text;

  t = t.replace(
    /(📌 CATEGORY 2 — FINAL OUTPUT FORMATTING \(USE-CASE SPECIFIC\))\nCATEGORY 2 — FINAL OUTPUT FORMATTING \(USE-CASE SPECIFIC\)\n/g,
    "$1\n"
  );

  t = t.replace(
    /(Apply 📌 PAYMENT_CHECKPOINTS id `[^`]+` and the shared Payment Engine\.\n)(?:\n?\1)+/g,
    "$1"
  );

  t = t.replace(
    /FORMATTING REQUIREMENTS FOR HTML RENDERING" and (?:spacing rules at the top of this file|anti-gap rules where present)/gi,
    "FORMATTING — CATEGORY 1 at the top of this file"
  );
  t = t.replace(
    /the formatting sections at the top of this file \("FORMATTING REQUIREMENTS FOR HTML RENDERING" and anti-gap rules where present\)/gi,
    "📌 FORMATTING — CATEGORY 1 at the top of this file"
  );
  t = t.replace(
    /"FORMATTING REQUIREMENTS FOR HTML RENDERING" and spacing rules at the top of this file/gi,
    "📌 FORMATTING — CATEGORY 1 at the top of this file"
  );

  t = t.replace(
    /📌 PAYMENT_CHECKPOINTS \(ONLY these — see body barriers for exact copy\)/,
    "📌 PAYMENT_CHECKPOINTS (ONLY these)"
  );

  t = t.replace(
    /\n2\. Set "payment_required": true in the JSON output\.\n/,
    "\n2. Apply 📌 PAYMENT_CHECKPOINTS and the shared Payment Engine.\n"
  );

  // Multi-document use-cases: barrier title said "FINAL OUTPUT" but checkpoint is before_each_document
  t = t.replace(
    /(📌 PAYMENT BARRIER BEFORE FINAL OUTPUT GENERATION\n(?:[^\n]*\n){0,3}?)Apply 📌 PAYMENT_CHECKPOINTS id `before_final_output`/g,
    "$1Apply 📌 PAYMENT_CHECKPOINTS id `before_each_document`"
  );


  return t;
}

function removeHeaderDocBlock(text) {
  return text.replace("\n\n" + DOC_SEL_BLOCK, "").replace(DOC_SEL_BLOCK + "\n\n", "");
}

function addBatchDisplay(text) {
  if (/📌 BATCH DISPLAY \(MANDATORY\)/.test(text)) return text;
  if (/## QUESTIONNAIRE BATCHES/.test(text)) {
    return text.replace(
      /## QUESTIONNAIRE BATCHES\n\n/,
      "## QUESTIONNAIRE BATCHES\n\n📌 BATCH DISPLAY (MANDATORY)\nPresent all questions of the current BATCH together in one message with \"batch_form\": true. Use user-facing question numbers only. Never show internal \"Batch 1\" labels to the user.\n\n"
    );
  }
  if (/QUESTIONNAIRE BATCHES\nBATCH 1:/.test(text)) {
    return text.replace(
      /QUESTIONNAIRE BATCHES\n/,
      "QUESTIONNAIRE BATCHES\n\n📌 BATCH DISPLAY (MANDATORY)\nPresent all questions of the current BATCH together in one message with \"batch_form\": true. Use user-facing question numbers only. Never show internal \"Batch 1\" labels to the user.\n\n"
    );
  }
  return text;
}

function fixRentDocPaymentGate(text) {
  if (/📌 PAYMENT GATE — document generation/.test(text)) return text;
  return text.replace(
    /📌 PAYMENT BARRIER 2 \(ADDITIONAL DOCUMENT\)\nFor the FIRST document chosen after Batch 1:[^\n]*\n(?:Apply 📌 PAYMENT_CHECKPOINTS id `extra_document` and the shared Payment Engine\.\n\n?)*/,
    "📌 PAYMENT GATE — document generation\nFirst document after Batch 1: covered by checkpoint `after_batch_1` (Rs. 499/-). Each additional document: apply checkpoint `extra_document` before generating. Do NOT set document_ready.\n\n"
  );
}

function fixEmpTermination(text) {
  return text.replace(
    /Stage A — after the user completes the full Q&A flow \(Part F done\), BEFORE showing Part G:\n3\. DO NOT show Part G yet\. STOP and wait for payment\.\nApply/,
    "Stage A — after Part F complete, BEFORE showing Part G:\nApply"
  );
}

function fixMarrigePlanning(text) {
  return text
    .replace(
      /📌 PAYMENT BARRIER 1 \(MANDATORY BEFORE FIRST ADVICE\)\nAfter Q&A is completed[^\n]*:\n1\. Inform user:[^\n]*\nApply/,
      "📌 PAYMENT BARRIER 1 (MANDATORY BEFORE FIRST ADVICE)\nAfter Q&A is completed (including any dynamic follow-up questions):\nApply"
    )
    .replace(
      /6\. JSON CONTROL: During dynamic follow-up questions before first advice, use default JSON with "payment_required": false\n\n/,
      ""
    );
}

function fixCheckWill(text) {
  return text.replace(
    /Apply 📌 PAYMENT_CHECKPOINTS id `after_batch_1` and the shared Payment Engine\.\n\nStep 4 — Identify gaps/,
    "Apply 📌 PAYMENT_CHECKPOINTS id `before_gap_assessment` and the shared Payment Engine.\n\nStep 4 — Identify gaps"
  );
}

const CUSTOM_DOC_HEADER_REMOVE = new Set([
  "salary_non_payment_intructions.txt",
  "upi_fraud.txt",
]);

const files = fs
  .readdirSync(PROMPTS)
  .filter((f) => f.endsWith(".txt") && !SKIP.has(f))
  .sort();

for (const f of files) {
  const fp = path.join(PROMPTS, f);
  let t = fs.readFileSync(fp, "utf8");
  const before = t;

  t = fixAll(t);
  if (CUSTOM_DOC_HEADER_REMOVE.has(f)) t = removeHeaderDocBlock(t);
  if (f === "getSecurityDeposite.txt" || f === "tenantEviction.txt") {
    t = addBatchDisplay(t);
    t = fixRentDocPaymentGate(t);
  }
  if (f === "emp_termination_intructions.txt") t = fixEmpTermination(t);
  if (f === "marrige_planning.txt") t = fixMarrigePlanning(t);
  if (f === "check_will_intructions.txt") t = fixCheckWill(t);

  if (t !== before) {
    fs.writeFileSync(fp, t.endsWith("\n") ? t : t + "\n", "utf8");
    console.log(`fixed ${f}`);
  } else {
    console.log(`ok    ${f}`);
  }
}

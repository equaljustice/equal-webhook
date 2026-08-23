#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const PROMPTS = path.join(path.dirname(fileURLToPath(import.meta.url)), "../assets/prompts");
const SKIP = new Set([
  "_common_control_protocol.txt",
  "_payment_checkpoints.examples.txt",
  "_upload_protocol_block.txt",
  "_document_selection_protocol_block.txt",
  "_language_selection_block.txt",
  "_document_language_block.txt",
]);

const DOC_LANG_FILES = new Set([
  "salary_non_payment_intructions.txt",
  "upi_fraud.txt",
  "senior_citizen.txt",
  "getSecurityDeposite.txt",
  "tenantEviction.txt",
  "will_instructions.txt",
  "make_my_rent_agreement.txt",
  "flight_cancellation_intructions.txt",
]);

const files = fs.readdirSync(PROMPTS).filter((f) => f.endsWith(".txt") && !SKIP.has(f)).sort();

for (const f of files) {
  const raw = fs.readFileSync(path.join(PROMPTS, f), "utf8");
  const t = raw.trimStart();
  const issues = [];

  if (!t.startsWith("📌 CONFIDENTIALITY\n")) issues.push("missing common header");
  if (!/📌 PAYMENT_CHECKPOINTS \(ONLY these/.test(t)) issues.push("missing PAYMENT_CHECKPOINTS table");
  if (!/📌 Q&A MODE FOR THIS USE-CASE: (batch|sequential)/.test(t))
    issues.push("missing Q&A MODE tag");
  if (!/📌 LANGUAGE SELECTION \(FIRST STEP — SAME EVERYWHERE\)/.test(t))
    issues.push("missing shared LANGUAGE block in header");
  if (/🟢\s*1\.\s*LANGUAGE SELECTION|🟢\s*LANGUAGE SELECTION \(first turn\)|📌\s*\*\*LANGUAGE SELECTION\*\*|^📌\s*LANGUAGE SELECTION\nFirst step:/m.test(t))
    issues.push("duplicate LANGUAGE block still in body");
  if (/🟢\s*\d+\.\s*STRICT QUESTION FLOW|STRICT QUESTION FLOW & RESPONSE FLOW|^🟢\s*\d+\.\s*STRICT FLOW\n/m.test(t))
    issues.push("duplicate STRICT QUESTION FLOW in body");
  if (/^TERMINATION POLICY\nAfter:/m.test(t) || /^🟢\s*\d+\.\s*TERMINATION POLICY\n/m.test(t))
    issues.push("duplicate TERMINATION mechanism in body");
  if (/📌 MAINTAINER NOTE/.test(t)) issues.push("MAINTAINER NOTE still present");
  if (/📌 JSON CONTROL PROTOCOL|PART 0 —|FORMATTING REQUIREMENTS FOR HTML RENDERING/.test(t))
    issues.push("legacy control section in body");
  if (/"document_ready":\s*true|Set "document_ready": true/i.test(t))
    issues.push("document_ready:true forbidden");
  if ((t.match(/📌 UPLOAD PROTOCOL \(MANDATORY/g) || []).length > 1)
    issues.push("duplicate UPLOAD PROTOCOL");
  if ((t.match(/📌 DOCUMENT SELECTION MENU/g) || []).length > 1)
    issues.push("duplicate DOCUMENT SELECTION");
  if ((t.match(/📌 DOWNLOAD \/ document_ready JSON/g) || []).length > 1)
    issues.push("duplicate DOWNLOAD block");
  if (/CATEGORY 2 — FINAL OUTPUT FORMATTING \(USE-CASE SPECIFIC\)\nCATEGORY 2 — FINAL OUTPUT FORMATTING/.test(t))
    issues.push("duplicate CATEGORY 2 header line");
  if (/SECTION B\s*[–—\-]\s*ERROR HANDLING/.test(t)) issues.push("duplicate SECTION B ERROR HANDLING in body");
  if (/Ask one question and sub-question at a time/.test(t) && /BATCH 1:|## QUESTIONNAIRE BATCHES|📌 BATCH QUESTION ARCHITECTURE/.test(t))
    issues.push("one-question rule conflicts with defined Batches");
  if (/Set "payment_required": true in the JSON/.test(t)) issues.push("verbose payment JSON mechanics in body");
  if (/PAYMENT BARRIER/.test(t) && !/Apply 📌 PAYMENT_CHECKPOINTS id/.test(t))
    issues.push("payment barrier not compacted to checkpoint pointer");
  if (/you MUST trigger the payment barrier/i.test(t))
    issues.push("verbose payment barrier narrative still in body");
  if (/📌 DOCUMENT LANGUAGE RULES:/.test(t))
    issues.push("duplicate DOCUMENT LANGUAGE RULES in body");
  if (/After user has selected one document to be generated, if the question answer session is not in English/.test(t))
    issues.push("duplicate document-language paragraph in body");
  const waitBloat =
    (t.match(/^Wait for the user to (?:ans|complete|answer|give|select) /gm) || []).length +
    (t.match(/^Wait for user to /gm) || []).length;
  if (waitBloat > 0) issues.push(`wait-line bloat still in body (${waitBloat})`);
  if (DOC_LANG_FILES.has(f) && !/📌 DOCUMENT LANGUAGE \(WHEN GENERATING A DOCUMENT\)/.test(t))
    issues.push("missing shared DOCUMENT LANGUAGE block in header");

  const hasBatchDef = /BATCH 1:|## QUESTIONNAIRE BATCHES|📌 BATCH QUESTION ARCHITECTURE/.test(t);
  if (hasBatchDef && !/batch_form": true/.test(t.slice(t.indexOf("BATCH") || 0)))
    issues.push("batch defined but no batch_form guidance in batch section");

  console.log(issues.length ? `❌ ${f}\n   ${issues.join("\n   ")}` : `✅ ${f}`);
}

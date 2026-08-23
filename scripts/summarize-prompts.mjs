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
]);

function extractCheckpoints(t) {
  const m = t.match(/📌 PAYMENT_CHECKPOINTS \(ONLY these\)\n([\s\S]*?)(?=\n\n(?:📌|SECTION|🟢|##|📌 \*\*))/);
  if (!m) return [];
  return [...m[1].matchAll(/- id: (\S+)/g)].map((x) => x[1]);
}

function mode(t) {
  if (/📌 BATCH QUESTION ARCHITECTURE|## QUESTIONNAIRE BATCHES|📌 BATCH DISPLAY/.test(t))
    return "batch";
  if (/Until Batches are defined/.test(t)) return "sequential (batches TBD)";
  if (/Ask one question and sub-question at a time|Exactly one question per assistant message/.test(t))
    return "sequential";
  return "mixed";
}

const files = fs.readdirSync(PROMPTS).filter((f) => f.endsWith(".txt") && !SKIP.has(f)).sort();

for (const f of files) {
  const t = fs.readFileSync(path.join(PROMPTS, f), "utf8");
  const bodyStart = t.search(/^(SECTION A|🟢 1\.|📌 BATCH|📌 \*\*LANGUAGE|## QUESTIONNAIRE)/m);
  const headerLen = bodyStart > 0 ? bodyStart : 0;
  const flags = {
    upload: /📌 UPLOAD PROTOCOL \(MANDATORY/.test(t.slice(0, headerLen + 500)),
    docSelHeader: /📌 DOCUMENT SELECTION MENU \(MANDATORY HTML/.test(t.slice(0, headerLen)),
    docSelBody: /DOCUMENT SELECTION|Part G|Which document do you wish/.test(t.slice(headerLen)),
    multiSelectInBody: /select all that apply|data-ej-multi-select/.test(t.slice(headerLen)),
  };
  const cps = extractCheckpoints(t);
  console.log(
    `${f}\n  mode=${mode(t)} | checkpoints=[${cps.join(", ")}] | upload=${flags.upload} | docMenu=${flags.docSelHeader || flags.docSelBody}${flags.multiSelectInBody ? " | multi-select Q" : ""}\n`
  );
}

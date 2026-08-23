#!/usr/bin/env node
/**
 * Replace duplicated control headers in prompt use-cases with
 * _common_control_protocol.txt + per-file PAYMENT_CHECKPOINTS.
 * Domain Q&A / templates below the language/flow start are preserved.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS = path.join(__dirname, "../assets/prompts");

const COMMON = fs.readFileSync(
  path.join(PROMPTS, "_common_control_protocol.txt"),
  "utf8"
).trimEnd();

const UPLOAD = fs.readFileSync(
  path.join(PROMPTS, "_upload_protocol_block.txt"),
  "utf8"
).trimEnd();

const DOC_SEL = fs.readFileSync(
  path.join(PROMPTS, "_document_selection_protocol_block.txt"),
  "utf8"
).trimEnd();

const LANGUAGE = fs.readFileSync(
  path.join(PROMPTS, "_language_selection_block.txt"),
  "utf8"
).trimEnd();

const DOC_LANG = fs.readFileSync(
  path.join(PROMPTS, "_document_language_block.txt"),
  "utf8"
).trimEnd();

/** Skip shared/meta files */
const SKIP = new Set([
  "_common_control_protocol.txt",
  "_payment_checkpoints.examples.txt",
  "_upload_protocol_block.txt",
  "_document_selection_protocol_block.txt",
  "_language_selection_block.txt",
  "_document_language_block.txt",
]);

/** Per-file Q&A mode — batch only where Batches are defined in the body. */
const QA_MODE = {
  "getSecurityDeposite.txt": "batch",
  "tenantEviction.txt": "batch",
  "livein_agreement.txt": "batch",
  "make_my_rent_agreement.txt": "batch",
};

/** Include shared document-language block (session vs English ask). */
const DOC_LANGUAGE_FILES = new Set([
  "salary_non_payment_intructions.txt",
  "upi_fraud.txt",
  "senior_citizen.txt",
  "getSecurityDeposite.txt",
  "tenantEviction.txt",
  "will_instructions.txt",
  "make_my_rent_agreement.txt",
  "flight_cancellation_intructions.txt",
]);

/**
 * Per-use-case payment tables. Mechanism is always the common Payment Engine.
 * Keep narrative PAYMENT BARRIER sections in the body — this table is the source of truth for when/amounts.
 */
const CHECKPOINTS = {
  "getSecurityDeposite.txt": `📌 PAYMENT_CHECKPOINTS (ONLY these)
  - id: after_batch_1
    when: All applicable Batch 1 questions answered validly
    amount_inr: 499
    message: "To continue assessment and generate your personalized legal document, please complete the payment of Rs. 499/-."
    unlocks: Batch 2 and later
    once: true
  - id: extra_document
    when: Any document after the first document in this session
    amount_inr: 199
    message: "To generate this additional document, please complete the payment of Rs. 199/-."
    unlocks: Generate that selected document
    once: false
First document after Batch 1 is covered by Rs. 499/- (no second pay).`,

  "tenantEviction.txt": `📌 PAYMENT_CHECKPOINTS (ONLY these)
  - id: after_batch_1
    when: All applicable Batch 1 questions answered validly
    amount_inr: 499
    message: "To continue assessment and generate your personalized legal document, please complete the payment of Rs. 499/-."
    unlocks: Batch 2 and later
    once: true
  - id: extra_document
    when: Any document after the first document in this session
    amount_inr: 199
    message: "To generate this additional document, please complete the payment of Rs. 199/-."
    unlocks: Generate that selected document
    once: false
First document after Batch 1 is covered by Rs. 499/- (no second pay).`,

  "livein_agreement.txt": `📌 PAYMENT_CHECKPOINTS (ONLY these)
  - id: after_batch_1
    when: All applicable Batch 1 questions answered validly
    message: "Please complete the payment to start further assessment."
    unlocks: Batch 2 and later Batches — NOT the Agreement yet
    once: true
  - id: before_signing_guide
    when: Final Agreement body already delivered; before signing-process guidance
    message: "Please complete the payment to receive the process of signing."
    unlocks: Signing-process guidance only
    once: true
Completion of Batch 2/3/intermediate Batches is NOT a payment gate.`,

  "sir_assessment.txt": `📌 PAYMENT_CHECKPOINTS (ONLY these — see body barriers for exact copy)
  - id: before_main_assessment
    when: User opts into detailed SIR assessment / Q2.6 path
    amount_inr: 9
    message: "To start your detailed SIR - Citizenship assessment, please complete the payment of Rs. 9/-."
    unlocks: Detailed SIR assessment questions/output
    once: true
  - id: before_rti
    when: User opts into RTI Application
    amount_inr: 5
    message: "To receive your RTI Application, please complete the payment of Rs. 5/-."
    unlocks: RTI Application body
    once: false
  - id: before_notice_upload_eval
    when: User opts into AI notice evaluation upload
    amount_inr: 5
    message: "To upload your notice for AI evaluation, please complete the payment of Rs. 5/-."
    unlocks: upload_required path for notice
    once: false
Until Batches are defined in THIS file: ask one question per turn ("batch_form": false). When Batches are added, use batch mode.`,

  "check_will_intructions.txt": `📌 PAYMENT_CHECKPOINTS (ONLY these)
  - id: before_gap_assessment
    when: Step 3 summary confirmed; before Step 4 gap assessment
    message: "Please complete the payment to receive your gap assessment."
    unlocks: Gap assessment output
    once: true
  - id: before_signing_guide
    when: User selects Yes for signing process (Ques E); before signing guide
    message: "Please complete the payment to receive the signing process."
    unlocks: Signing-process guidance
    once: true`,

  "goa_inheritance.txt": `📌 PAYMENT_CHECKPOINTS (ONLY these)
  - id: after_q6
    when: Q6 answered; before Part 2 (Q7+)
    message: "To receive additional expert-designed questions and your personalized guidance, please complete the payment."
    unlocks: Part 2 questions and first guidance
    once: true
  - id: before_each_followup
    when: User submits each follow-up question in the Q16 loop
    message: "Please complete the payment to receive your follow-up guidance."
    unlocks: Answer that follow-up
    once: false`,

  "check_my_rent_agreement.txt": `📌 PAYMENT_CHECKPOINTS (ONLY these)
  - id: before_tds
    when: Q5/Q6 path triggers paid TDS assessment
    message: "Please complete the payment to receive your personalized TDS assessment."
    unlocks: TDS fact questions / TDS assessment
    once: false
  - id: before_agreement_assessment
    when: Path triggers paid agreement assessment
    message: "Please complete the payment to receive your agreement assessment."
    unlocks: Agreement assessment output
    once: false
Never quote rupee amounts in chat — payment UI shows the amount.`,

  "marrige_planning.txt": `📌 PAYMENT_CHECKPOINTS (ONLY these)
  - id: before_first_advice
    when: All applicable Q&A complete; before first final advice
    message: "Please complete the payment to receive your personalized advice."
    unlocks: First advice / guidance output
    once: true
  - id: before_each_document
    when: Before EACH document template generation in Phase 3
    message: "Please complete the payment to generate this document."
    unlocks: That document body
    once: false`,

  "makeMyNda.txt": `📌 PAYMENT_CHECKPOINTS (ONLY these)
  - id: before_final_or_signing
    when: After applicable Q&A, before final NDA output and/or before signing-process guidance as defined in THIS file
    message: "Please complete the payment to receive your personalized NDA / next paid step."
    unlocks: Paid NDA output or signing guidance for that checkpoint
    once: false`,

  "flight_cancellation_intructions.txt": `📌 PAYMENT_CHECKPOINTS (ONLY these)
  - id: before_final_output
    when: All applicable Q&A complete; before final output
    message: "Please complete the payment to receive your personalized output."
    unlocks: Final personalized output
    once: true`,

  "gst_arrest.txt": `📌 PAYMENT_CHECKPOINTS (ONLY these)
  - id: before_final_assessment
    when: All applicable Q&A complete; before final assessment
    amount_inr: 9
    message: "Please complete the payment of a small token fee of Rupees 9 (Nine) to receive your personalized assessment."
    unlocks: Final personalized assessment
    once: true`,

  "tax_residency_intructions.txt": `📌 PAYMENT_CHECKPOINTS (ONLY these)
  - id: before_final_output
    when: All applicable Q&A complete; before final output
    message: "Please complete the payment to receive your personalized output."
    unlocks: Final personalized output
    once: true`,

  "pre_nuptial_intructions.txt": `📌 PAYMENT_CHECKPOINTS (ONLY these)
  - id: before_final_output
    when: All applicable Q&A complete; before final output
    message: "Please complete the payment to receive your personalized output."
    unlocks: Final personalized output
    once: true`,

  "side_project_intructions.txt": `📌 PAYMENT_CHECKPOINTS (ONLY these)
  - id: before_final_output
    when: All applicable Q&A complete; before final output
    message: "Please complete the payment to receive your personalized output."
    unlocks: Final personalized output
    once: true`,

  "service_bond_intructions.txt": `📌 PAYMENT_CHECKPOINTS (ONLY these)
  - id: before_final_output
    when: All applicable Q&A complete; before final output
    message: "Please complete the payment to receive your personalized output."
    unlocks: Final personalized output
    once: true`,

  "hindu_inheritance.txt": `📌 PAYMENT_CHECKPOINTS (ONLY these)
  - id: before_each_paid_output
    when: Immediately before each paid guidance/document output (including follow-up stages)
    message: "Please complete the payment to receive your personalized guidance."
    unlocks: That paid output only
    once: false`,

  "senior_citizen.txt": `📌 PAYMENT_CHECKPOINTS (ONLY these)
  - id: before_each_document
    when: Immediately before generating each paid document (including every additional document)
    message: "Please complete the payment to receive your personalized document."
    unlocks: That document body only
    once: false`,

  "upi_fraud.txt": `📌 PAYMENT_CHECKPOINTS (ONLY these)
  - id: before_each_document
    when: Immediately before generating each paid document (including every additional document)
    message: "Please complete the payment to receive your personalized document."
    unlocks: That document body only
    once: false`,

  "salary_non_payment_intructions.txt": `📌 PAYMENT_CHECKPOINTS (ONLY these)
  - id: before_each_document
    when: Immediately before generating each paid document (including every additional document)
    message: "Please complete the payment to receive your personalized document."
    unlocks: That document body only
    once: false`,

  "emp_termination_intructions.txt": `📌 PAYMENT_CHECKPOINTS (ONLY these)
  - id: before_part_g_or_document
    when: (A) after Q&A before Part G menu, (B) after Part G selection before document, (C) before any additional document later
    message: "Please complete the payment to continue / receive your document."
    unlocks: Part G options or that document body
    once: false`,

  "make_my_rent_agreement.txt": `📌 PAYMENT_CHECKPOINTS (ONLY these)
  - id: after_batch_1
    when: Group 0 + Groups 1A/1B/1C complete (including all "Other / specify" follow-ups); before Batch 2
    message: "For further assessment to create your Rent Agreement, please complete the payment."
    unlocks: Batch 2 and all later Q&A (not the Agreement yet)
    once: true
  - id: before_tds
    when: User selects Yes to TDS upsell (Stamp duty / TDS section Q2)
    amount_inr: 49
    message: "Please complete the payment of Rs. 49 for your TDS assessment."
    unlocks: TDS questions and TDS assessment output
    once: false
  - id: before_final_agreement
    when: All applicable Q&A complete (Batch 2 subjects + stamp duty/TDS path); before full Agreement output
    message: "Please complete the payment to receive your personalized Rent Agreement."
    unlocks: Full Agreement body
    once: true
First payment unlocks Batch 2 only. TDS payment unlocks TDS path only. Final payment unlocks Agreement generation.`,

  "will_instructions.txt": `📌 PAYMENT_CHECKPOINTS (ONLY these)
  - id: before_each_document
    when: Immediately before generating each paid will / document output (including additional cycles)
    message: "Please complete the payment to receive your personalized will document."
    unlocks: That document body only
    once: false`,

  "cheque_bouncing.txt": `📌 PAYMENT_CHECKPOINTS (ONLY these)
  - id: before_notice
    when: Before customized cheque bouncing notice
    message: "Please complete the payment to receive your personalized cheque bouncing notice."
    unlocks: Notice body
    once: false
  - id: before_advice
    when: Before customized advice on due dates / court / win probability
    message: "Please complete the payment to receive your personalized advice."
    unlocks: Advice body
    once: false
  - id: before_synopsis
    when: Before draft synopsis (if user selected that paid path)
    message: "Please complete the payment to receive your draft synopsis."
    unlocks: Synopsis body
    once: false`,
};

const DOMAIN_START_RE =
  /^(🟢\s*1\.|🟢\s*LANGUAGE|🟢\s*2\.|##\s*QUESTIONNAIRE|SECTION A\s*[—\-]|You are not a general chatbot|ROLE AND EXPERTISE|SECTION C\s*[—\-]\s*ELIGIBILITY|SECTION C\s*[—\-]\s*HIGH-LEVEL|📌\s*INSTRUCTION ROADMAP\nPART 0)/m;

function bodySearchStart(text) {
  if (!text.startsWith("📌 CONFIDENTIALITY")) return 0;
  const domainRe =
    /^(📌 BATCH QUESTION ARCHITECTURE|SECTION A|🟢 1\.|🟢 LANGUAGE|## QUESTIONNAIRE|📌 \*\*LANGUAGE)/m;
  const dm = text.match(domainRe);
  if (dm && dm.index > 400) return dm.index;
  return 0;
}

/** Find where domain/flow content starts (preserve from here). */
function findDomainStart(text, filename) {
  const from = bodySearchStart(text);
  const slice = text.slice(from);

  if (filename === "livein_agreement.txt") {
    const m = slice.match(/^📌\s*BATCH QUESTION ARCHITECTURE/m);
    if (!m) throw new Error("livein: missing BATCH QUESTION ARCHITECTURE");
    return from + m.index;
  }

  if (
    filename === "getSecurityDeposite.txt" ||
    filename === "tenantEviction.txt"
  ) {
    const m =
      slice.match(/^##\s*QUESTIONNAIRE BATCHES/m) ||
      slice.match(/^QUESTIONNAIRE BATCHES\n/m) ||
      slice.match(/^SECTION A\s*[—\-–]/m) ||
      slice.match(/^🟢\s*2\.\s*INITIAL MESSAGE/m) ||
      slice.match(/^📌\s*\*\*LANGUAGE SELECTION\*\*/m) ||
      slice.match(/^📌\s*LANGUAGE SELECTION\nFirst step/m) ||
      slice.match(/^📌\s*\*\*FLOW RULES/m);
    if (!m) throw new Error(`${filename}: missing domain start`);
    return from + m.index;
  }

  const legacyFlat = {
    "service_bond_intructions.txt": /^Ask user to decide what service/m,
    "side_project_intructions.txt": /^Q1\. Ask the user to upload/m,
    "tax_residency_intructions.txt": /^Which financial year are you going/m,
  };
  if (legacyFlat[filename]) {
    const m = slice.match(legacyFlat[filename]);
    if (!m) throw new Error(`${filename}: missing legacy flat domain start`);
    return from + m.index;
  }

  // Prefer last "SECTION A – UNIVERSAL BEHAVIOR" (roadmap may list it early)
  const sectionAs = [...slice.matchAll(/^SECTION A\s*[–—\-]\s*UNIVERSAL BEHAVIOR/gm)];
  if (sectionAs.length) return from + sectionAs[sectionAs.length - 1].index;

  const ordered = [
    /^🟢\s*1\.\s*LANGUAGE SELECTION/m,
    /^🟢\s*LANGUAGE SELECTION/m,
    /^🟢\s*1\.\s*LANGUAGE\b/m,
    /^🟢\s*1\.\s*ROLE/m,
    /^You are an expert/m,
    /^You are not a general chatbot/m,
    /^##\s*QUESTIONNAIRE BATCHES/m,
  ];
  for (const re of ordered) {
    const m = slice.match(re);
    if (m) return from + m.index;
  }

  throw new Error(`Cannot find domain start in ${filename}`);
}

/** Remove obsolete control JSON blocks that sit inside preserved domain (live-in). */
function scrubLegacyControlFromDomain(domain, filename) {
  if (filename !== "livein_agreement.txt") return domain;
  return domain.replace(
    /\n📌 CONTROL JSON \+ BATCH \+ PAYMENT[\s\S]*?(?=\n📌 USER ANSWER HANDLING FOR BATCHES)/,
    "\n"
  );
}

function needsUpload(domain) {
  return (
    /Prompt the user to upload/i.test(domain) ||
    /AGREEMENT UPLOAD ASSESSMENT/i.test(domain) ||
    /upload your (notice|document|agreement|will|rent)/i.test(domain) ||
    /Illegibility Protocol/i.test(domain) ||
    /upload_required path for notice/i.test(domain) ||
    /upload the (notice|document|agreement)/i.test(domain)
  );
}

function domainNeedsDocSelection(domain) {
  if (/📌 DOCUMENT SELECTION MENU \(MANDATORY —(?! quick-pick)/.test(domain))
    return false;
  return (
    /Which document do you wish to generate/i.test(domain) ||
    /Generate another document/i.test(domain) ||
    /document selection menu/i.test(domain) ||
    /PART G.*document/i.test(domain)
  );
}

function extractCategory2(text, filename) {
  const patterns = [
    /CATEGORY 2:[\s\S]*?(?=CRITICAL RULES FOR BOTH|📌\s*JSON CONTROL|📌\s*CONTROL JSON|═{10,}\s*\nCRITICAL)/i,
    /CATEGORY 2\s*[—\-][\s\S]*?(?=📌\s*JSON CONTROL|📌\s*CONTROL JSON|📌\s*PAYMENT)/i,
    /FINAL OUTPUT \/ GENERATED LEGAL DOCUMENTS:[\s\S]*?(?=SPACING & ANTI-GAP|📌\s*JSON|📌\s*CONTROL)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[0].length > 80 && m[0].length < 6000) {
      let block = m[0].trim();
      if (block.startsWith("📌 CATEGORY 2")) return block + "\n";
      return (
        "📌 CATEGORY 2 — FINAL OUTPUT FORMATTING (USE-CASE SPECIFIC)\n" +
        block +
        "\n"
      );
    }
  }
  // livein Category 2 lives in the body — header uses pointer only (handled above)
  if (/CATEGORY 2:[\s\S]{200,}/i.test(text) && /Live-in|AGREEMENT/i.test(text)) {
    return `📌 CATEGORY 2 — FINAL OUTPUT FORMATTING (USE-CASE SPECIFIC)
Follow the Agreement / final-document HTML spacing rules already defined later in THIS file (PREAMBLE, clauses, <br>/<br><br>). Do not flatten the Agreement with Category 1 Q&A spacing.
`;
  }
  return `📌 CATEGORY 2 — FINAL OUTPUT FORMATTING (USE-CASE SPECIFIC)
Follow any final-document / notice / guidance formatting rules stated later in THIS file. Do not use Category 1 Q&A spacing for long legal documents. Do NOT set document_ready.
`;
}

function stripAskOneQuestion(domain) {
  return domain
    .replace(
      /^- Ask exactly one question per assistant message during Q&A flow\.\s*$/gim,
      "- Q&A mode: if THIS file defines Batches, present each Batch together with batch_form true; otherwise one question per turn (batch_form false)."
    )
    .replace(
      /^•\s*Exactly one question per assistant message:.*$/gim,
      "• Q&A mode: Batches together when defined in THIS file; otherwise one question per turn."
    )
    .replace(
      /- Ask exactly one question per assistant message during Q&A flow\./gi,
      "- Prefer Batches when defined in THIS file; otherwise one question per turn."
    );
}

function qaModeTag(filename) {
  const mode = QA_MODE[filename] || "sequential";
  return `📌 Q&A MODE FOR THIS USE-CASE: ${mode}`;
}

function buildHeader(filename, original, domain) {
  const parts = [
    COMMON,
    "",
    extractCategory2(original, filename),
    "",
    CHECKPOINTS[filename] ||
      `📌 PAYMENT_CHECKPOINTS (ONLY these)
  - id: before_final_output
    when: All applicable Q&A complete; before paid final output
    message: "Please complete the payment to receive your personalized output."
    unlocks: Final paid output
    once: true`,
    "",
    qaModeTag(filename),
    "",
    LANGUAGE,
  ];

  if (needsUpload(domain)) {
    parts.push("", UPLOAD);
  }
  if (domainNeedsDocSelection(domain)) {
    parts.push("", DOC_SEL);
  }
  if (DOC_LANGUAGE_FILES.has(filename)) {
    parts.push("", DOC_LANG);
  }

  parts.push("");
  return parts.join("\n");
}

function applyFile(filename) {
  const fp = path.join(PROMPTS, filename);
  const original = fs.readFileSync(fp, "utf8");
  const domainStart = findDomainStart(original, filename);
  let domain = original.slice(domainStart);
  domain = scrubLegacyControlFromDomain(domain, filename);
  domain = stripAskOneQuestion(domain);

  // Avoid duplicating CATEGORY 2 / upload already in domain for livein (keeps long formatting)
  const header = buildHeader(filename, original, domain);
  const next = header + "\n" + domain;
  if (next === original) {
    return { filename, status: "unchanged" };
  }
  fs.writeFileSync(fp, next.endsWith("\n") ? next : next + "\n", "utf8");
  return {
    filename,
    status: "updated",
    before: original.length,
    after: next.length,
    domainStart,
  };
}

const files = fs
  .readdirSync(PROMPTS)
  .filter((f) => f.endsWith(".txt") && !SKIP.has(f) && !f.startsWith("_"));

const results = [];
for (const f of files.sort()) {
  if (!CHECKPOINTS[f]) {
    console.warn("No checkpoint map for", f, "— using default once-pay");
  }
  try {
    results.push(applyFile(f));
  } catch (e) {
    results.push({ filename: f, status: "error", error: e.message });
  }
}

for (const r of results) {
  if (r.status === "updated") {
    console.log(
      `OK  ${r.filename}  (${r.before} → ${r.after} bytes, domain@${r.domainStart})`
    );
  } else if (r.status === "error") {
    console.error(`ERR ${r.filename}: ${r.error}`);
  } else {
    console.log(`--  ${r.filename}`);
  }
}

const err = results.filter((r) => r.status === "error");
process.exit(err.length ? 1 : 0);

#!/usr/bin/env node
/**
 * Normalize assistant instruction prompts for current server protocol.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const promptsDir = path.join(__dirname, "../assets/prompts");

const SKIP = new Set([
  "_upload_protocol_block.txt",
  "_document_selection_protocol_block.txt",
]);

const MULTI_DOC_UPLOAD_OVERRIDES = `Overrides from default (combine only as allowed below):
1) PAYMENT CHECKPOINT (repeatable): after all applicable Q&A is completed and just before each final output generation — including each additional document if the user chooses to generate another document. Every new document cycle MUST have its own payment checkpoint before that document is generated.
   - Set: "payment_required": true
   - Keep: "session_terminated": false
   - Do NOT generate final output while payment_required is true.
2) FINAL DOCUMENT OUTPUT: After the server confirms payment (webhook), generate the complete paid output in one turn. Set "payment_required": false. Do NOT use "document_ready" — the server saves download automatically.
3) FINAL TERMINATION CHECKPOINT: only when the user confirms no further document is needed and closing message is shown.
   - Set: "session_terminated": true and provide "termination_message"
   - Set: "payment_required": false`;

const NO_UPLOAD_OVERRIDES = (repeatable) => `Allowed overrides from default:
1) PAYMENT CHECKPOINT (${repeatable ? "repeatable" : "once"}): after all applicable Q&A is completed and just before final output generation.
   - Set: "payment_required": true
   - Keep: "session_terminated": false
   - Do NOT generate final output while payment_required is true.
2) FINAL DOCUMENT OUTPUT: After the server confirms payment (webhook), generate the complete paid output in one turn. Set "payment_required": false. Do NOT use "document_ready" — the server saves download automatically.
3) FINAL TERMINATION CHECKPOINT: after final closing message (session over).
   - Set: "session_terminated": true and provide "termination_message"
   - Set: "payment_required": false`;

const CHECK_RENT_OVERRIDES = `Allowed overrides from default:
1) UPLOAD: per Q3 rules and 📌 UPLOAD PROTOCOL (below) — set upload JSON on upload/re-upload requests only; otherwise keep upload fields at default.
2) PAYMENT CHECKPOINT: when Q5 or Q6 opt-in triggers paid TDS or agreement assessment — set "payment_required": true; keep "session_terminated": false; do NOT generate paid output while payment_required is true. Never quote rupee amounts or fees — the payment UI shows the correct amount (first paid service in the session vs subsequent paid service).
3) FINAL DOCUMENT OUTPUT: After the server confirms payment (webhook), generate the complete paid output in one turn. Set "payment_required": false. Do NOT use "document_ready" — the server saves download automatically.
4) FINAL TERMINATION: after closing message — set "session_terminated": true with "termination_message"; set "payment_required": false.`;

function fixContent(content, filename) {
  let c = content;

  // --- Phase 1: document_ready removal (schema, defaults, wording) ---
  c = c.replace(/,?\s*\n\s*"document_ready":\s*true or false\s*\n/g, "\n");
  c = c.replace(/"document_ready":\s*true or false,?\s*\n?/g, "");
  c = c.replace(/,\s*"document_ready":\s*false/g, "");
  c = c.replace(/"document_ready":\s*false,?\s*/g, "");
  c = c.replace(
    /payment_required must be false and document_ready must be false/gi,
    "payment_required must be false"
  );
  c = c.replace(
    /"payment_required":\s*false and "document_ready":\s*false/gi,
    '"payment_required": false'
  );
  c = c.replace(
    /"payment_required":\s*false,\s*and "document_ready":\s*false/gi,
    '"payment_required": false'
  );
  c = c.replace(
    /keep "payment_required":\s*false and "document_ready":\s*false/gi,
    'keep "payment_required": false'
  );
  c = c.replace(
    /Keep:\s*"session_terminated":\s*false and "document_ready":\s*false/gi,
    'Keep: "session_terminated": false'
  );
  c = c.replace(
    /`session_terminated:\s*true`,\s*`payment_required:\s*false`,\s*`document_ready:\s*false`/gi,
    "`session_terminated: true`, `payment_required: false`"
  );
  c = c.replace(/^.*Trigger "document_ready".*$\n?/gim, "");
  c = c.replace(/^.*Never set document_ready.*$\n?/gim, "");

  // Checklist / roadmap wording
  c = c.replace(/document_ready \(repeatable\)/gi, "final document output");
  c = c.replace(/document_ready when/gi, "final output when");
  c = c.replace(/document_ready JSON/gi, "final output");
  c = c.replace(/document_ready rule/gi, "final output rule");
  c = c.replace(/document_ready turn/gi, "final document turn");
  c = c.replace(/payment \/ document_ready \/ termination/gi, "payment / termination");
  c = c.replace(/upload \+ payment \+ document_ready \+ termination/gi, "upload + payment + termination");
  c = c.replace(/session\/payment\/document_ready/gi, "session/payment");
  c = c.replace(/session \/ payment \/ document_ready/gi, "session / payment");
  c = c.replace(/Termination\/payment\/document_ready/gi, "Termination/payment");
  c = c.replace(/PAYMENT \+ DOCUMENT_READY \+/gi, "PAYMENT + ");
  c = c.replace(/alignment with JSON document_ready/gi, "alignment with JSON final output");
  c = c.replace(
    /allowed overrides \(payment \/ document_ready \/ termination\)/gi,
    "allowed overrides (payment / termination)"
  );
  c = c.replace(
    /overrides for payment \(repeatable\), document_ready \(repeatable\), final termination/gi,
    "overrides for payment (repeatable), final termination"
  );
  c = c.replace(
    /payment loops, document_ready, optional next document/gi,
    "payment loops, optional next document"
  );
  c = c.replace(
    /set JSON per rules including "document_ready": true when appropriate/gi,
    'set "payment_required": false after complete document output'
  );
  c = c.replace(/when "document_ready": true/gi, "for final downloadable documents");
  c = c.replace(/\(payment \/ document_ready \/ termination\)/gi, "(payment / termination)");
  c = c.replace(/in the same turn as document_ready/gi, "in the final document turn");
  c = c.replace(
    /📌 FINAL WILL OUTPUT FORMAT \(MANDATORY — document_ready turn\)/gi,
    "📌 FINAL WILL OUTPUT FORMAT (MANDATORY — final document turn)"
  );

  // --- Phase 2: repair corruption from aggressive replacements ---
  c = c.replace(
    /Keep: "session_terminated": false and - Do NOT/g,
    'Keep: "session_terminated": false\n   - Do NOT'
  );
  c = c.replace(
    /Set: "payment_required": false and 📌 UPLOAD/g,
    'Set: "payment_required": false\n\n📌 UPLOAD'
  );
  c = c.replace(
    /Set: "payment_required": false and Hard guards:/g,
    'Set: "payment_required": false\n\nHard guards:'
  );
  c = c.replace(/keep "session_terminated": false and ;/g, 'keep "session_terminated": false;');
  c = c.replace(/set "payment_required": false and \./g, 'set "payment_required": false.');
  c = c.replace(
    /keep "payment_required": false and unless/g,
    'keep "payment_required": false unless'
  );
  c = c.replace(
    /"payment_required" must be false and "document_ready" must be false/g,
    '"payment_required" must be false'
  );

  // Remove orphan document_ready setter lines (keep "Do NOT use" guidance lines)
  c = c.replace(/^\s*- Set: "document_ready": true[^\n]*\n/gm, "");
  c = c.replace(
    /^\s*- If that same turn also includes only a brief follow-up question, still set document_ready true[^\n]*\n/gm,
    ""
  );

  // Dedupe payment_required lines after document generation
  c = c.replace(
    /- Keep "payment_required": false\n\s*- Set "payment_required": false after the complete document body is output\. Do NOT use "document_ready"\./g,
    '- Set "payment_required": false after the complete document body is output. Do NOT use "document_ready".'
  );
  c = c.replace(/- "payment_required": false\n- - "session_terminated": false/g, '- "payment_required": false\n- "session_terminated": false');

  // Replace broken override blocks with canonical templates
  if (["upi_fraud.txt", "senior_citizen.txt", "salary_non_payment_intructions.txt", "emp_termination_intructions.txt"].includes(filename)) {
    c = c.replace(
      /Overrides from default \(combine only as allowed below\):[\s\S]*?(?=\n📌 UPLOAD PROTOCOL)/,
      `${MULTI_DOC_UPLOAD_OVERRIDES}\n\n`
    );
  }
  if (filename === "will_instructions.txt") {
    c = c.replace(
      /Allowed overrides from default:[\s\S]*?(?=\nHard guards:)/,
      `${NO_UPLOAD_OVERRIDES(false)}\n\n`
    );
  }
  if (filename === "make_my_rent_agreement.txt") {
    c = c.replace(
      /Allowed overrides from default:[\s\S]*?(?=\nHard guards:)/,
      `${NO_UPLOAD_OVERRIDES(true)}\n\n`
    );
  }
  if (filename === "check_my_rent_agreement.txt") {
    c = c.replace(
      /Allowed overrides from default:[\s\S]*?(?=\n📌 UPLOAD PROTOCOL)/,
      `${CHECK_RENT_OVERRIDES}\n\n`
    );
    c = c.replace(
      /- If any independent early termination rule applies, keep "payment_required": false and unless that rule states otherwise\./,
      '- If any independent early termination rule applies, keep "payment_required": false unless that rule states otherwise.'
    );
    c = c.replace(
      /^\s*- Set "payment_required": false after the complete document body is output\. Do NOT use "document_ready"\.\n(?=- Ask exactly one question)/m,
      ""
    );
  }

  if (["make_my_rent_agreement.txt", "will_instructions.txt"].includes(filename)) {
    c = c.replace(
      /- If any independent early termination rule applies, keep "payment_required": false and unless that rule states otherwise\./,
      '- If any independent early termination rule applies, keep "payment_required": false unless that rule states otherwise.'
    );
  }

  if (filename === "hindu_inheritance.txt") {
    c = c.replace(/PAYMENT CHECKPOINT \(once\)/gi, "PAYMENT CHECKPOINT (repeatable)");
    c = c.replace(/session_complete\s*=\s*true/gi, '"session_terminated": true');
    c = c.replace(/"session_complete":\s*true/gi, '"session_terminated": true');
  }

  // emp_termination: user menu (a)(b) not (i)(ii)
  if (filename === "emp_termination_intructions.txt") {
    c = c.replace(
      "(i) Part of mass layoff\n(ii) Probation either not extended nor converted to permanent",
      "(a) Part of mass layoff\n(b) Probation either not extended nor converted to permanent"
    );
  }

  // cheque_bouncing: Q13 options for chip parser
  if (filename === "cheque_bouncing.txt") {
    c = c.replace(
      /Q13\. Do you want to claim any interest, damages, and cost[^\n]*\n(?:a\.|\(a\)) Yes\s*\n(?:b\.|\(b\)) No/g,
      "Q13. Do you want to claim any interest, damages, and cost (including cost of creating this notice on www.equaljustice.ai and any legal fees paid to a lawyer) over and above the amount of the cheque, or amount unpaid under the cheque, if there are part-payments made?\n(a) Yes\n(b) No"
    );
  }

  c = c.replace(
    /"session_terminated": true, "payment_required": false, and \./g,
    '"session_terminated": true, "payment_required": false (and provide termination_message in JSON).'
  );

  // Document selection menus (multi-doc)
  if (filename === "upi_fraud.txt") {
    c = c.replace(
      /After Q&A completion and before each payment checkpoint, ask this as one standalone question \(single message\):\nWhich document do you wish to generate\?\n\(a\) Letter to the bank[\s\S]*?Allow exactly one selection per generation cycle\./,
      `After Q&A completion and before each payment checkpoint, ask this as one standalone question (single message) using HTML:
<h6>Which document do you wish to generate?</h6>
(a) Letter to the bank [recommended if not already sent]<br>
(b) Letter to the RBI Banking Ombudsman<br>
(c) Police Complaint<br>
(d) RTI Application to a public sector bank<br>
[Rule: INTERNAL ONLY — After user selects (d), share the RTI explanation verbatim in italics with │ prefix as specified below. Never put [Rule:…] text inside option labels.]
Allow exactly one selection per generation cycle.`
    );
    c = c.replace(
      /After generating each document, ask user one standalone confirmation question:\n\(a\) Generate another document\n\(b\) End session/,
      `After generating each document, ask user one standalone confirmation question using HTML:
<h6>Would you like to:</h6>
(a) Generate another document<br>
(b) End session`
    );
  }

  if (filename === "senior_citizen.txt") {
    c = c.replace(
      /After Q&A completion and before each payment checkpoint, ask this as one standalone question \(single message\):\nWhich document do you wish to generate\?\n\(a\) I want to first know my rights\n\(b\) I want to create a notice to the person\n\(c\) I want to create court document \/ file a case\n\(d\) \[Rule:[^\n]+\n\nAfter user has selected/,
      `After Q&A completion and before each payment checkpoint, ask this as one standalone question (single message) using HTML:
<h6>Which document do you wish to generate?</h6>
Show ONLY applicable options. Use clean labels only — one per line with <br>:
(a) Know my rights<br>
(b) Notice to the person<br>
(c) Court document / file a case<br>
(d) Police complaint<br>
[Rule: INTERNAL ONLY — Omit (d) unless any of: Q3.2/3.3/3.4/3.5 is (b), Q3.4.1 is (a), Q4.3 is (d), Q4.4.2 is (a), Q5.1 is (b), or Q6 reveals a criminal offence. Renumber visible options consecutively if (d) is omitted. Never put [Rule:…] inside option labels.]

After user has selected`
    );
    c = c.replace(
      /After generating each document, ask user one standalone confirmation question:\n\(a\) Generate another document\n\(b\) End session/,
      `After generating each document, ask user one standalone confirmation question using HTML:
<h6>Would you like to:</h6>
(a) Generate another document<br>
(b) End session`
    );
  }

  // Webhook-only payment trust (all files)
  c = c.replace(
    /When the user sends a message AFTER payment is completed \(the system (?:may|will) send a confirmation message like "[^"]+"\), THEN/g,
    "When the server confirms payment via webhook (you may receive a system message such as \"Payment completed...\" — do NOT treat user-typed payment claims as proof), THEN"
  );
  c = c.replace(
    /When the user sends a message AFTER payment is completed \(e\.g\. "[^"]+"\), THEN/g,
    "When the server confirms payment via webhook (you may receive a system message such as \"Payment completed...\" — do NOT treat user-typed payment claims as proof), THEN"
  );
  c = c.replace(
    /When the user sends a message AFTER payment is completed \(the system will send a confirmation message like "[^"]+"\), set "payment_required": false and proceed:/,
    'When the server confirms payment via webhook (you may receive a system message such as "Payment completed..." — do NOT treat user-typed payment claims as proof), set "payment_required": false and proceed:'
  );

  return c;
}

const files = fs
  .readdirSync(promptsDir)
  .filter((f) => f.endsWith(".txt") && !SKIP.has(f));

let changed = 0;
for (const file of files) {
  const fp = path.join(promptsDir, file);
  const before = fs.readFileSync(fp, "utf8");
  const after = fixContent(before, file);
  if (after !== before) {
    fs.writeFileSync(fp, after);
    changed++;
    console.log("updated:", file);
  } else {
    console.log("unchanged:", file);
  }
}
console.log(`Done. ${changed}/${files.length} files updated.`);

#!/usr/bin/env node
/**
 * Remove duplicated control/format/upload/payment-barrier sections from prompt
 * bodies after common protocol was prepended. Conservative: never deletes domain Q&A.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS = path.join(__dirname, "../assets/prompts");

const UPLOAD_BLOCK = fs.readFileSync(
  path.join(PROMPTS, "_upload_protocol_block.txt"),
  "utf8"
).trimEnd();

const DOC_SEL_BLOCK = fs.readFileSync(
  path.join(PROMPTS, "_document_selection_protocol_block.txt"),
  "utf8"
).trimEnd();

const LANGUAGE_BLOCK = fs.readFileSync(
  path.join(PROMPTS, "_language_selection_block.txt"),
  "utf8"
).trimEnd();

const DOC_LANG_BLOCK = fs.readFileSync(
  path.join(PROMPTS, "_document_language_block.txt"),
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

function collapseBlankLines(text) {
  return text.replace(/\n{4,}/g, "\n\n\n");
}

function splitHeaderBody(text) {
  const maintainer = text.match(
    /^([\s\S]*?)^📌 MAINTAINER NOTE\n[^\n]*\n\n/m
  );
  if (maintainer) {
    return {
      header: maintainer[1].trimEnd() + "\n",
      body: text.slice(maintainer[0].length),
    };
  }
  if (text.startsWith("📌 CONFIDENTIALITY")) {
    const domainRe =
      /^(📌 BATCH QUESTION ARCHITECTURE|SECTION A|🟢 2\.|🟢 1\.|🟢 LANGUAGE|## QUESTIONNAIRE|QUESTIONNAIRE BATCHES|📌 \*\*LANGUAGE|📌 CLOSING MESSAGE|Ask user to decide what service|Which financial year are you going|^Q1\. Ask the user to upload)/m;
    const dm = text.match(domainRe);
    if (dm && dm.index > 400) {
      return {
        header: text.slice(0, dm.index).trimEnd() + "\n",
        body: text.slice(dm.index),
      };
    }
  }
  return { header: "", body: text };
}

function domainNeedsUpload(body) {
  return (
    /Prompt the user to upload/i.test(body) ||
    /AGREEMENT UPLOAD ASSESSMENT/i.test(body) ||
    /upload your (notice|document|agreement|will|rent)/i.test(body) ||
    /Illegibility Protocol/i.test(body) ||
    /upload_required path for notice/i.test(body)
  );
}

function domainNeedsDocSelection(body) {
  if (/📌 DOCUMENT SELECTION MENU \(MANDATORY —(?! quick-pick)/.test(body))
    return false;
  return (
    /Which document do you wish to generate/i.test(body) ||
    /Generate another document/i.test(body) ||
    /document selection menu/i.test(body) ||
    /PART G.*document/i.test(body)
  );
}

function trimHeader(header, body) {
  let h = header;
  if (!domainNeedsUpload(body)) {
    h = h.replace("\n\n" + UPLOAD_BLOCK, "").replace(UPLOAD_BLOCK + "\n\n", "");
  }
  if (!domainNeedsDocSelection(body)) {
    h = h.replace("\n\n" + DOC_SEL_BLOCK, "").replace(DOC_SEL_BLOCK + "\n\n", "");
  }
  return h.trimEnd() + "\n";
}

function removeRepeatedBlock(text, block) {
  if (!block) return text;
  let out = text;
  while (out.includes(block)) {
    out = out.replace("\n\n" + block, "").replace(block + "\n\n", "");
    out = out.replace(block, "");
  }
  return out;
}

function isSectionStart(line) {
  return /^(?:📌|SECTION |BATCH |🟢 |PART |═{10,}|## |If Q|Q\d+\.|Finally,|STAMP DUTY|AGREEMENT UPLOAD|Certain additional)/.test(
    line
  );
}

function isPaymentMechanicLine(line) {
  return /payment_required|webhook|Payment completed|DO NOT generate|Set "payment|STOP here|Upon receiving system signal|Inform the user.*payment|Message user.*payment/i.test(
    line
  );
}

function inferCheckpointId(title) {
  const t = title.toLowerCase();
  if (/post batch 1|barrier 1 \(post|checkpoint 1\)|batch 2 and onwards/.test(t))
    return "after_batch_1";
  if (/additional document|barrier 2|extra document/.test(t))
    return "extra_document";
  if (/signing|checkpoint 2/.test(t)) return "before_signing_guide";
  if (/gap|identification of gaps|checkpoint 1\)/.test(t)) return "before_gap_assessment";
  if (/notice upload|uploaded notice|ai reading/.test(t))
    return "before_notice_upload_eval";
  if (/next questions|main assessment/.test(t)) return "before_main_assessment";
  if (/after_q6|after q6/.test(t)) return "after_q6";
  if (/follow-?up|each follow/.test(t)) return "before_each_followup";
  if (/first advice/.test(t)) return "before_first_advice";
  if (/tds/.test(t)) return "before_tds";
  if (/agreement assessment/.test(t)) return "before_agreement_assessment";
  if (/final assessment/.test(t)) return "before_final_assessment";
  if (/final will|final output|final agreement|before final|customized nda/.test(t))
    return "before_final_output";
  if (/part g|two stages|repeatable/.test(t)) return "before_part_g_or_document";
  if (/each document|each paid/.test(t)) return "before_each_document";
  if (/cheque bouncing notice/.test(t)) return "before_notice";
  if (/due dates|win probability/.test(t)) return "before_advice";
  if (/synopsis/.test(t)) return "before_synopsis";
  if (/personalized questions and first/.test(t)) return "before_each_paid_output";
  if (/second answer/.test(t)) return "before_each_paid_output";
  return "see PAYMENT_CHECKPOINTS table";
}

function compactPaymentBarriersLineWise(body) {
  const lines = body.split("\n");
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const isBarrier =
      /^📌\s*(?:\*+\s*)?PAYMENT BARRIERS?/i.test(line) ||
      /^PAYMENT BARRIER/i.test(line);

    if (!isBarrier) {
      out.push(line);
      i++;
      continue;
    }

    const title = line.replace(/\*+/g, "").trim();
    i++;
    const trigger = [];

    while (i < lines.length) {
      const l = lines[i];
      if (isSectionStart(l)) break;
      if (!l.trim()) {
        i++;
        continue;
      }
      if (/^-{3,}$/.test(l.trim())) {
        i++;
        continue;
      }
      if (isPaymentMechanicLine(l)) {
        i++;
        continue;
      }
      if (/^\d+\.\s/.test(l.trim()) && isPaymentMechanicLine(l)) {
        i++;
        continue;
      }
      trigger.push(l);
      i++;
      if (trigger.length >= 2) break;
    }

    while (i < lines.length) {
      const l = lines[i];
      if (isSectionStart(l)) break;
      if (!l.trim()) {
        i++;
        continue;
      }
      if (/^-{3,}$/.test(l.trim())) {
        i++;
        continue;
      }
      if (isPaymentMechanicLine(l) || /^\d+\.\s.*(?:payment|JSON|wait|Stop)/i.test(l)) {
        i++;
        continue;
      }
      break;
    }

    const id = inferCheckpointId(title);
    out.push(title.startsWith("📌") ? title : `📌 ${title}`);
    for (const t of trigger.slice(0, 3)) out.push(t);
    out.push(
      `Apply 📌 PAYMENT_CHECKPOINTS id \`${id}\` and the shared Payment Engine.`
    );
    out.push("");
  }

  return out.join("\n");
}

function extractClosingMessages(block) {
  const main =
    block.match(
      /Display this closing message verbatim:\s*\n["""]?(Your session is over[^\n"""]+)/i
    )?.[1]?.trim() ||
    block.match(/["""]?(Your session is over now[^"""\n]+)/i)?.[1]?.trim() ||
    block.match(/<em>(Your session is over[^<]+)<\/em>/i)?.[1]?.trim();
  const post = block
    .match(/reply only:\s*\n["""]?(Your session is over[^\n"""]+)/i)?.[1]
    ?.trim();
  return { main, post };
}

function stripLanguageFromBody(b) {
  let out = b;
  out = out.replace(
    /^🟢\s*1\.\s*LANGUAGE SELECTION[\s\S]*?(?=^🟢\s*\d+\.|^SECTION [A-Z–—]|^═{10,}|^## )/m,
    ""
  );
  out = out.replace(
    /^🟢\s*1\.\s*LANGUAGE\b[\s\S]*?(?=^🟢\s*\d+\.|^SECTION [A-Z–—]|^═{10,})/m,
    ""
  );
  out = out.replace(
    /^🟢\s*LANGUAGE SELECTION \(first turn\)[\s\S]*?Conduct the entire session in the selected language\.\n\n/m,
    ""
  );
  out = out.replace(
    /^📌\s*\*{1,2}\s*LANGUAGE SELECTION\*{0,2}\s*\n[\s\S]*?(?=^---\n|^## QUESTIONNAIRE|^📌 \*\*FLOW|^📌 \*\*INITIAL|^QUESTIONNAIRE BATCHES)/m,
    ""
  );
  out = out.replace(
    /^📌\s*LANGUAGE SELECTION\nFirst step:[\s\S]*?(?=^QUESTIONNAIRE BATCHES|^## QUESTIONNAIRE|^📌 BATCH)/m,
    ""
  );
  out = out.replace(
    /^LANGUAGE SELECTION \(MANDATORY START\)[\s\S]*?(?=^CHAT UI|^FIRST MESSAGE|^TERMINATION|^Ask user|^Q1\.|^Which financial)/m,
    ""
  );
  return out;
}

function stripStrictQuestionFlow(b) {
  let out = b;
  out = out.replace(
    /^🟢\s*\d+\.\s*STRICT QUESTION FLOW[\s\S]*?(?=^🟢\s*\d+\.|^SECTION [A-Z–—]|^═{10,}|^📌 )/m,
    ""
  );
  out = out.replace(
    /^🟢\s*\d+\.\s*STRICT FLOW\n[\s\S]*?(?=^🟢\s*\d+\.|^SECTION [A-Z–—]|^═{10,})/m,
    ""
  );
  out = out.replace(
    /^STRICT QUESTION FLOW & RESPONSE FLOW[\s\S]*?(?=^TERMINATION POLICY|^🟢\s*\d+\.|^SECTION [A-Z–—]|^═{10,})/m,
    ""
  );
  return out;
}

function stripUnnumberedTermination(b) {
  return b.replace(
    /^TERMINATION POLICY\nAfter:[\s\S]*?(?=^Ask user to decide|^📌 UPLOAD|^For both \(a\)|^Which financial year|^Q1\.|^If Q1)/m,
    (block) => {
      const { main, post } = extractClosingMessages(block);
      let out = "📌 CLOSING MESSAGE (verbatim when THIS file instructs session close)\n";
      if (main) out += `"${main}"\n`;
      if (post) out += `Post-close repeat (if user messages again): "${post}"\n`;
      out += "Apply 📌 TERMINATION rules at the top of this file.\n\n";
      return out;
    }
  );
}

function stripTerminationMechanism(b, filename) {
  if (filename === "goa_inheritance.txt") {
    if (!/Apply 📌 TERMINATION rules/.test(b)) {
      b = b.replace(
        /^(🟢 TERMINATION POLICY\n)/m,
        "$1Apply 📌 TERMINATION rules at the top of this file for JSON/session mechanics.\n"
      );
    }
    return b;
  }

  if (/^TERMINATION POLICY\nAfter:/m.test(b) && !/^🟢\s*\d+\.\s*TERMINATION POLICY/m.test(b)) {
    return stripUnnumberedTermination(b);
  }

  return b.replace(
    /^🟢\s*\d+\.\s*TERMINATION POLICY[\s\S]*?(?=^🟢\s*\d+\.|^SECTION [A-Z–—]|^═{10,}|^📌 CLOSING|^PART |^## )/m,
    (block) => {
      const hasAnotherDoc = /another document|Generate another document/i.test(block);
      const { main, post } = extractClosingMessages(block);

      if (hasAnotherDoc) {
        let kept = block
          .replace(
            /^🟢\s*\d+\.\s*TERMINATION POLICY\n/,
            "📌 SESSION END & MULTI-DOCUMENT LOOP (this use-case)\n"
          )
          .replace(/\n\d+\.\s*End the session immediately[^\n]*\n/g, "\n")
          .replace(
            /\nIf the user types anything after this closing message[\s\S]*?No further content[^\n]*\n/g,
            "\n"
          )
          .replace(/Display this closing message verbatim:\n/g, "");
        let out = kept.trimEnd() + "\n";
        if (main) {
          out += `\n📌 CLOSING MESSAGE (verbatim when user ends session — no more documents)\n"${main}"\n`;
          if (post) out += `Post-close repeat (if user messages again): "${post}"\n`;
        }
        out += "Apply 📌 TERMINATION rules at the top of this file.\n\n";
        return out;
      }

      if (!main) {
        return "📌 CLOSING MESSAGE\nApply 📌 TERMINATION rules at the top of this file.\n\n";
      }
      let out =
        "📌 CLOSING MESSAGE (verbatim when THIS file instructs session close)\n" +
        `"${main}"\n`;
      if (post) out += `Post-close repeat (if user messages again): "${post}"\n`;
      out += "Apply 📌 TERMINATION rules at the top of this file.\n\n";
      return out;
    }
  );
}

function stripChatUILayout(b, filename) {
  if (filename === "check_will_intructions.txt") {
    return b.replace(
      /^🟢\s*3\.\s*CHAT UI & LAYOUT[\s\S]*?(?=^SECTION C)/m,
      `🟢 3. WILL-SPECIFIC FORMATTING (Q&A vs final Will text)
- Part headings: <h3>Part Title</h3>
- Follow Category 1 for Q&A; Category 2 / Will body rules below for final Will text.
Apply 📌 FORMATTING CONTRACT at the top of this file.

`
    );
  }
  return b.replace(
    /^🟢\s*\d+\.\s*CHAT UI & LAYOUT[\s\S]*?(?=^SECTION [A-Z–—]|^═{10,}|^📌 |^PART |^## )/m,
    ""
  ).replace(
    /^CHAT UI & LAYOUT\n[\s\S]*?(?=^TERMINATION POLICY|^Which financial|^Q1\.|^Ask user)/m,
    ""
  );
}

function stripRoleModeGeneric(b) {
  return b.replace(
    /(🟢\s*\d+\.\s*ROLE\s*\/\s*MODE[^\n]*\n(?:[^\n]*\n)*?)(Therefore:[\s\S]*?)(?=^🟢\s*\d+\.|^SECTION [A-Z–—]|^═{10,}|^📌 )/m,
    (_, head) =>
      head.trimEnd() + "\nApply 📌 ROLE / MODE rules at the top of this file.\n\n"
  );
}

function stripFormattingGovernedLines(b) {
  return b.replace(/^•?\s*Formatting is fully governed by[^\n]*\n/gm, "");
}

function stripWaitLines(b) {
  // Sequencing bloat covered by 📌 Q&A FLOW — keep language-selection wait in header only.
  return b
    .replace(/^Wait for the user to ans[^\n]*\n/gim, "")
    .replace(/^Wait for the user to complete[^\n]*\n/gim, "")
    .replace(/^Wait for the user to answer[^\n]*\n/gim, "")
    .replace(/^Wait for the user to give[^\n]*\n/gim, "")
    .replace(/^Wait for the user to select[^\n]*\n/gim, "")
    .replace(/^Wait for the user to confirm[^\n]*\n/gim, "")
    .replace(/^Wait for the user to make[^\n]*\n/gim, "")
    .replace(/^Wait for the user to (?:provide|upload|decide|pick|choose a document)[^\n]*\n/gim, "")
    .replace(/^Wait for user to [^\n]*\n/gim, "")
    .replace(/^Wait for answer, then ask[^\n]*\n/gim, "")
    .replace(/^Wait for the user['']s answer before[^\n]*\n/gim, "")
    .replace(/^\[WAIT FOR THE USER TO COMPLETE[^\]]*\]\n/gim, "")
    .replace(/^Wait for the user ans Q[^\n]*\n/gim, "")
    .replace(/^Wait for the user to answer Q[^\n]*\n/gim, "")
    .replace(/^Wait for user to answer Q[^\n]*\n/gim, "");
}

function stripDocumentLanguageFromBody(b) {
  let out = b;
  out = out.replace(
    /^📌\s*DOCUMENT LANGUAGE RULES:[\s\S]*?(?=^---\n|^SPECIAL CONDITIONAL|^📌 |^BATCH |^## |^SECTION )/m,
    "Apply 📌 DOCUMENT LANGUAGE rules at the top of this file.\n\n"
  );
  out = out.replace(
    /^After user has selected one document to be generated, if the question answer session is not in English, ask user whether the user would like to generate the document in the language selected for the question-answer session or in English\. As per the choice made by the user on the language of the document, generate the document in that language\.\n+/gm,
    "Apply 📌 DOCUMENT LANGUAGE rules at the top of this file.\n\n"
  );
  out = out.replace(
    /^If chats are in English → generate the (?:Will|Agreement) in English\.[\s\S]*?(?=^Apply 📌 PAYMENT_CHECKPOINTS|^📌 |^SECTION |^Finally,|^Now |^Generate )/m,
    "Apply 📌 DOCUMENT LANGUAGE rules at the top of this file.\n\n"
  );
  out = out.replace(
    /^Finally, if the chats are in English language then create a draft letter in English language\. However, if the chats are in a language other than English then ask the user whether the user would want the draft letter in the language selected for the chats or in English language, and create the letter in the language desired by the user\.\n+/gm,
    "Apply 📌 DOCUMENT LANGUAGE rules at the top of this file.\n\n"
  );
  out = removeRepeatedBlock(out, DOC_LANG_BLOCK);
  return out;
}

function stripPaymentBarrierNarrative(b) {
  let out = b;
  out = out.replace(
    /^.*you MUST trigger the payment barrier[^\n]*\n/gim,
    ""
  );
  out = out.replace(
    /^\d+\.\s*Inform user:\s*"[^"]*payment[^"]*"\.?(?:\s*\(translate[^\)]*\))?\n/gim,
    ""
  );
  out = out.replace(
    /^Inform (?:the )?user:\s*"[^"]*payment[^"]*"\.?\n/gim,
    ""
  );
  out = out.replace(
    /^After all applicable Q&A is complete AND after document type selection and document language choice \(if applicable\),[^\n]*\n/gim,
    ""
  );
  out = out.replace(
    /^After the user completes the full Q&A flow and is about to receive[^\n]*\n/gim,
    ""
  );
  out = out.replace(
    /^After the user completes the full Q&A flow and, if selected, the TDS information flow and is about to receive[^\n]*\n/gim,
    ""
  );
  out = out.replace(/^After Q&A is completed:\n/gm, "");
  out = out.replace(
    /^After Q&A is completed \(including any dynamic follow-up questions\):\n/gm,
    ""
  );
  out = out.replace(
    /(Apply 📌 PAYMENT_CHECKPOINTS id `[^`]+` and the shared Payment Engine\.\n)(?:\n?\1)+/g,
    "$1"
  );
  return out;
}

function removeBodySections(body, filename) {
  let b = body;

  b = stripLanguageFromBody(b);
  b = stripStrictQuestionFlow(b);
  b = stripRoleModeGeneric(b);
  b = stripTerminationMechanism(b, filename);
  b = stripChatUILayout(b, filename);
  b = stripFormattingGovernedLines(b);
  b = stripWaitLines(b);
  b = stripDocumentLanguageFromBody(b);
  b = removeRepeatedBlock(b, LANGUAGE_BLOCK);

  b = b.replace(
    /^📌\s*INSTRUCTION ROADMAP[\s\S]*?(?=^(?:SECTION A|🟢|## QUESTIONNAIRE|📌 BATCH|📌 \*\*LANGUAGE))/m,
    ""
  );
  b = b.replace(
    /^PART 0\s*[—\-][\s\S]*?(?=^(?:SECTION A|🟢|## QUESTIONNAIRE|📌 BATCH))/m,
    ""
  );

  const stop =
    "(?=^(?:📌|SECTION |🟢 |## |═{10,}|PART |BATCH |CRITICAL RULES|📌 USER ANSWER|📌 FORMAT FOR EACH))";
  for (const title of [
    "FORMATTING REQUIREMENTS FOR HTML RENDERING",
    "FORMATTING REQUIREMENTS",
    "JSON CONTROL PROTOCOL",
    "NO EXTRA WHITESPACE & ANTI-GAP RULES",
    "NO EXTRA WHITESPACE",
    "CONTROL JSON \\+ BATCH \\+ PAYMENT",
    "IRRELEVANT / EXIT OPTION GUARD",
    "IRRELEVANT OPTION GUARD",
    "CRITICAL FLOW GUARD",
    "CRITICAL DISPLAY NUMBERING",
    "THESE INSTRUCTIONS ARE THE BRAIN",
    "DOWNLOAD / document_ready JSON",
    "ANOTHER DOCUMENT PROMPT",
    "DOCUMENT SELECTION MENU \\(MANDATORY HTML",
  ]) {
    b = b.replace(new RegExp(`^📌\\s*${title}[\\s\\S]*?${stop}`, "gim"), "");
  }

  // Duplicate SECTION B — ERROR HANDLING (now in _common_control_protocol.txt)
  b = b.replace(
    /^_{0,40}\nSECTION B\s*[–—\-]\s*ERROR HANDLING[\s\S]*?(?=^_{0,40}\n(?:SECTION C|SECTION D|═{10,})|^SECTION C|^SECTION D|^═{10,})/m,
    ""
  );
  b = b.replace(
    /^═{10,}\s*\nSECTION B\s*[–—\-]\s*ERROR HANDLING[\s\S]*?(?=^═{10,}\s*\nSECTION C)/m,
    ""
  );
  b = b.replace(/^⚠️ ERROR HANDLING\n[\s\S]*?(?=^SECTION C|^═{10,}|^SECTION D)/m, "");

  b = removeRepeatedBlock(b, UPLOAD_BLOCK);
  b = removeRepeatedBlock(b, DOC_SEL_BLOCK);

  // Duplicate Category 2 in body when header already has the full extract
  if (filename !== "livein_agreement.txt") {
    b = b.replace(
      /^═{10,}\s*\nCATEGORY 2: FINAL RESPONSE[\s\S]*?^═{10,}\s*\nCRITICAL RULES FOR BOTH CATEGORIES[\s\S]*?(?=^📌 USER ANSWER|^SECTION A)/m,
      ""
    );
  }

  b = compactPaymentBarriersLineWise(b);
  b = stripPaymentBarrierNarrative(b);

  b = b.replace(
    /PART 0 "FORMATTING REQUIREMENTS FOR HTML RENDERING" and "NO EXTRA WHITESPACE & ANTI-GAP RULES" above/gi,
    "📌 FORMATTING — CATEGORY 1 and Category 2 rules at the top of this file"
  );
  b = b.replace(/JSON CONTROL PROTOCOL/gi, "Control JSON / Payment Engine at the top of this file");
  b = b.replace(/JSON Control Protocol/g, "PAYMENT_CHECKPOINTS and Payment Engine");

  b = b.replace(
    /\nIf user does not want another document:\n1\.\s*[\u201c\u201d"""]?Your session is over[^\n]*\n_{5,}\n/g,
    "\nIf user does not want another document: show 📌 CLOSING MESSAGE verbatim and apply 📌 TERMINATION rules.\n\n"
  );

  return b;
}

function cleanupFile(filename) {
  const fp = path.join(PROMPTS, filename);
  const original = fs.readFileSync(fp, "utf8");
  const { header, body } = splitHeaderBody(original);
  const trimmedHeader = trimHeader(header, body);
  const cleanedBody = removeBodySections(body, filename);
  const next = collapseBlankLines(trimmedHeader + "\n" + cleanedBody.trimStart()).trimStart();
  const normalized = next.endsWith("\n") ? next : next + "\n";

  if (normalized === original) {
    return { filename, status: "unchanged", before: original.length };
  }
  fs.writeFileSync(fp, normalized, "utf8");
  return {
    filename,
    status: "cleaned",
    before: original.length,
    after: normalized.length,
    saved: original.length - normalized.length,
  };
}

const files = fs
  .readdirSync(PROMPTS)
  .filter((f) => f.endsWith(".txt") && !SKIP.has(f) && !f.startsWith("_"));

const results = [];
for (const f of files.sort()) {
  try {
    results.push(cleanupFile(f));
  } catch (e) {
    results.push({ filename: f, status: "error", error: e.message });
  }
}

for (const r of results) {
  if (r.status === "cleaned") {
    console.log(`OK  ${r.filename}  (${r.before} → ${r.after}, −${r.saved} bytes)`);
  } else if (r.status === "error") {
    console.error(`ERR ${r.filename}: ${r.error}`);
  } else {
    console.log(`--  ${r.filename}`);
  }
}

process.exit(results.some((r) => r.status === "error") ? 1 : 0);

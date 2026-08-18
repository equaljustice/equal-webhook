#!/usr/bin/env node
/**
 * One-time sanitizer: align Section A language/guest/UI blocks with emp_termination pattern.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = path.join(__dirname, "../assets/prompts");

const LANGUAGE_BLOCK = `🟢 1. LANGUAGE SELECTION (FIRST STEP IN ALL MODES)
•	For GUEST sessions (not logged in): language selection and the login/guest retention prompt are handled by backend/UI. Do not re-ask those in chat. If guest_flow.phase is "active", proceed directly with Section 2.
•	For LOGGED-IN sessions: ignore the user's first message completely, including any conversation starter.
•	Language selection is onboarding only, not a question. Do NOT show any question number label for this step (no "Question 1", no "Ques 1", no "Q1").

•	Use one canonical heading only (no extra heading/subheading):
<h5><strong>Please select a language:</strong></h5>

Offer these languages exactly as below, each on a new line using <br>:
1. English, 
2. हिंदी, 
3. ગુજરાતી, 
4. ਪੰਜਾਬੀ, 
5. தமிழ், 
6. తెలుగు, 
7. ಕನ್ನಡ, 
8. বাংলা, 
9. मराठी, 
10. ଓଡ଼ିଆ, 
11. অসমীয়া, 
12. भोजपुरी,
13. اردو
•	Wait for the user to choose one.

•	After selection:
o	Conduct the entire Q&A and all explanations in the selected language.
o	Never mix English unless the selected language is English.`;

const LANGUAGE_BLOCK_COMPACT = `LANGUAGE SELECTION (MANDATORY START)
•	For GUEST sessions (not logged in): language selection and the login/guest retention prompt are handled by backend/UI. Do not re-ask those in chat. If guest_flow.phase is "active", skip language selection and proceed with the first substantive step in this file.
•	For LOGGED-IN sessions: ignore the user's first message completely, including any conversation starter.
•	Language selection is onboarding only — not a numbered question.

•	Use one canonical heading only (no extra heading/subheading):
<h5><strong>Please select a language:</strong></h5>

Offer these languages exactly as below, each on a new line using <br>:
1. English, 
2. हिंदी, 
3. ગુજરાતી, 
4. ਪੰਜਾਬੀ, 
5. தமிழ், 
6. తెలుగు, 
7. ಕನ್ನಡ, 
8. বাংলা, 
9. मराठी, 
10. ଓଡ଼ିଆ, 
11. অসমীয়া, 
12. भोजपुरी,
13. اردو
•	Wait for the user to choose one, then conduct the entire session in that language using simple layman language with accurate translation.
•	Never mix English unless the selected language is English.`;

const GST_LANGUAGE_BLOCK = `🟢 LANGUAGE SELECTION (First Step)
•	For GUEST sessions (not logged in): language selection and the login/guest retention prompt are handled by backend/UI. Do not re-ask those in chat. If guest_flow.phase is "active", proceed directly with FIRST INSTRUCTIONS below.
•	For LOGGED-IN sessions: ignore the user's first message completely, including any conversation starter.
•	Language selection is onboarding only, not a question. Do NOT show any question number label for this step (no "Question 1", no "Q1").

•	Use one canonical heading only (no extra heading/subheading):
<h5><strong>Please select a language:</strong></h5>

Offer these languages exactly as below, each on a new line using <br>:
1. English, 
2. हिंदी, 
3. ગુજરાતી, 
4. ਪੰਜਾਬੀ, 
5. தமிழ், 
6. తెలుగు, 
7. ಕನ್ನಡ, 
8. বাংলা, 
9. मराठी, 
10. ଓଡ଼ିଆ, 
11. অসমীয়া, 
12. भोजपुरी,
13. اردو
•	Wait until user selects the language. Then render all further messages in this language only.
•	Never mix English unless the selected language is English.`;

const CONFIRM_YES_NO = `Seek confirmation from the user before proceeding further, using one compact and consistent format:
- Ask exactly one confirmation question in selected language (no duplicate variants, no mixed-language copy).
- Use exactly two options on separate lines:
  (a) Yes<br>
  (b) No
- Localize "Yes" and "No" to the selected language.
- Do not output multiple versions of the same confirmation prompt in different languages.`;

const CHAT_UI_SECTION = `🟢 6. CHAT UI & LAYOUT
•	Formatting is fully governed by PART 0 "FORMATTING REQUIREMENTS FOR HTML RENDERING" and "NO EXTRA WHITESPACE & ANTI-GAP RULES" above.
•	Do not add alternate formatting styles here. Follow the top-level formatting contract only.`;

const CHAT_UI_SECTION_ALT = `🟢 6. CHAT UI & LAYOUT
•	Formatting is fully governed by the formatting sections at the top of this file ("FORMATTING REQUIREMENTS FOR HTML RENDERING" and anti-gap rules where present).
•	Do not add alternate formatting styles here. Follow the top-level formatting contract only.`;

const CHAT_UI_COMPACT = `CHAT UI & LAYOUT
•	Formatting is fully governed by "FORMATTING REQUIREMENTS FOR HTML RENDERING" and spacing rules at the top of this file.
•	Do not add alternate formatting styles. Follow the top-level formatting contract only.`;

function replaceBetween(text, startMarker, endMarker, replacement) {
  const start = text.indexOf(startMarker);
  if (start === -1) return text;
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (end === -1) return text;
  return text.slice(0, start) + replacement + text.slice(end);
}

function patchSectionAFile(filename, { languageEnd, section2Keep, useAltChatUi = false }) {
  const filePath = path.join(PROMPTS_DIR, filename);
  let text = fs.readFileSync(filePath, "utf8");

  text = replaceBetween(
    text,
    "🟢 1. LANGUAGE SELECTION (FIRST STEP IN ALL MODES)",
    languageEnd,
    LANGUAGE_BLOCK + "\n\n\n"
  );

  // Normalize vague confirmation lines
  text = text.replace(
    /Seek confirmation from the user on this initial message before proceeding further\./g,
    CONFIRM_YES_NO
  );
  text = text.replace(
    /Seek confirmation from the user on this initial message before proceeding further/g,
    CONFIRM_YES_NO
  );

  const chatUiStart = text.match(/🟢 6\. CHAT UI[^\n]*/);
  if (chatUiStart) {
    const sectionB = text.indexOf("SECTION B", text.indexOf(chatUiStart[0]));
    const altEnd = text.indexOf("________________________________________", text.indexOf(chatUiStart[0]));
    const end = sectionB !== -1 ? sectionB : altEnd;
    if (end !== -1) {
      text =
        text.slice(0, text.indexOf(chatUiStart[0])) +
        (useAltChatUi ? CHAT_UI_SECTION_ALT : CHAT_UI_SECTION) +
        "\n\n\n________________________________________\n" +
        text.slice(end + (sectionB !== -1 ? 0 : "________________________________________".length));
      if (sectionB !== -1) {
        text = text.replace(
          /\n\n\n________________________________________\nSECTION B/,
          "\n\n________________________________________\nSECTION B"
        );
      }
    }
  }

  // Remove will-specific CHAT RENDERING RULE if redundant
  text = text.replace(
    /- CHAT RENDERING RULE \(CRITICAL\):[^\n]+\n/g,
    ""
  );

  fs.writeFileSync(filePath, text);
  console.log("patched", filename);
}

function patchCompactLanguageFile(filename) {
  const filePath = path.join(PROMPTS_DIR, filename);
  let text = fs.readFileSync(filePath, "utf8");
  const patterns = [
    /LANGUAGE SELECTION \(MANDATORY START\)[\s\S]*?(?=\nSTRICT QUESTION FLOW|\nROLE|\nTERMINATION POLICY|\nQuestion-answer session)/,
  ];
  for (const p of patterns) {
    if (p.test(text)) {
      text = text.replace(p, LANGUAGE_BLOCK_COMPACT + "\n\n");
      break;
    }
  }
  if (!text.includes("CHAT UI & LAYOUT")) {
    const insertBefore = text.indexOf("STRICT QUESTION FLOW");
    if (insertBefore !== -1) {
      text =
        text.slice(0, insertBefore) +
        CHAT_UI_COMPACT +
        "\n\n" +
        text.slice(insertBefore);
    }
  }
  fs.writeFileSync(filePath, text);
  console.log("patched compact", filename);
}

function patchGst() {
  const filePath = path.join(PROMPTS_DIR, "gst_arrest.txt");
  let text = fs.readFileSync(filePath, "utf8");
  text = replaceBetween(
    text,
    "🟢 LANGUAGE SELECTION (First Step)",
    "🟢 FIRST INSTRUCTIONS TO USER AFTER LANGUAGE SELECTION",
    GST_LANGUAGE_BLOCK + "\n\n"
  );
  fs.writeFileSync(filePath, text);
  console.log("patched gst_arrest.txt");
}

function patchTaxResidency() {
  const filePath = path.join(PROMPTS_DIR, "tax_residency_intructions.txt");
  let text = fs.readFileSync(filePath, "utf8");
  const insert = `SECTION A – UNIVERSAL BEHAVIOR (ONBOARDING)
${LANGUAGE_BLOCK_COMPACT}

FIRST MESSAGE AFTER LANGUAGE SELECTION (logged-in) OR WHEN guest_flow.phase is "active" (guest):
`;
  if (!text.includes("SECTION A – UNIVERSAL BEHAVIOR")) {
    text = text.replace(/^First message:/m, insert);
  }
  if (!text.includes("CHAT UI & LAYOUT")) {
    text = text.replace(
      /^STRICT QUESTION FLOW/m,
      `${CHAT_UI_COMPACT}\n\nSTRICT QUESTION FLOW`
    );
  }
  fs.writeFileSync(filePath, text);
  console.log("patched tax_residency_intructions.txt");
}

// Files with standard Section A §1 ending before §2
const sectionAFiles = [
  { file: "will_instructions.txt", languageEnd: "🟢 2. INITIAL MESSAGE AFTER LANGUAGE SELECTION" },
  { file: "check_my_rent_agreement.txt", languageEnd: "🟢 2. INITIAL MESSAGE AFTER LANGUAGE SELECTION" },
  { file: "make_my_rent_agreement.txt", languageEnd: "🟢 2. INITIAL MESSAGE AFTER LANGUAGE SELECTION" },
  { file: "hindu_inheritance.txt", languageEnd: "________________________________________\n🟢 2. INITIAL MESSAGE AFTER LANGUAGE SELECTION" },
  { file: "cheque_bouncing.txt", languageEnd: "🟢 2. INITIAL MESSAGE AFTER LANGUAGE SELECTION" },
  { file: "flight_cancellation_intructions.txt", languageEnd: "🟢 2. INITIAL MESSAGE AFTER LANGUAGE SELECTION" },
  { file: "pre_nuptial_intructions.txt", languageEnd: "🟢 2. INITIAL MESSAGE AFTER LANGUAGE SELECTION" },
  { file: "check_will_intructions.txt", languageEnd: "🟢 2. TERMINATION POLICY" },
  { file: "senior_citizen.txt", languageEnd: "________________________________________\n🟢 2. INITIAL MESSAGE AFTER LANGUAGE SELECTION" },
  { file: "salary_non_payment_intructions.txt", languageEnd: "________________________________________\n🟢 2. INITIAL MESSAGE AFTER LANGUAGE SELECTION" },
  { file: "upi_fraud.txt", languageEnd: "________________________________________\n🟢 2. INITIAL MESSAGE AFTER LANGUAGE SELECTION" },
];

for (const { file, languageEnd } of sectionAFiles) {
  patchSectionAFile(file, {
    languageEnd,
    useAltChatUi: file === "hindu_inheritance.txt",
  });
}

patchCompactLanguageFile("side_project_intructions.txt");
patchCompactLanguageFile("service_bond_intructions.txt");
patchGst();
patchTaxResidency();

console.log("done");

/**
 * Writes multi-page sample will PDF + DOCX to test-outputs/ (fixed header/footer QA).
 * Run: node scripts/generate-will-multipage-samples.mjs
 */
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { generatePDF, generateWord } from "../src/utils/documentGenerator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const lorem =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. ";

let longBody = "";
for (let i = 1; i <= 28; i++) {
  longBody += `<h3>Schedule clause ${i}</h3>\n<p>${lorem}${lorem}</p>\n`;
}

const sampleDocumentData = {
  document_type: "will",
  title: "Last Will and Testament of Priya Sharma",
  content: {
    sections: [
      {
        type: "html",
        text: `
<h2>1. Declaration</h2>
<p>I, <strong>Priya Sharma</strong>, aged 42, residing at 12 MG Road, Bengaluru, being of sound mind, revoke all prior wills and codicils.</p>
<h2>2. Executors</h2>
<p>I appoint my brother <strong>Ravi Sharma</strong> as sole executor of this will.</p>
<h2>3. Bequests</h2>
<p>I give my flat at MG Road to my daughter <strong>Anya Sharma</strong>. I give the residue of my estate to my spouse <strong>Arun Sharma</strong>.</p>
<p><em>Following clauses are filler text to force multiple pages for layout testing.</em></p>
${longBody}
<p style="margin-top:1.5em"><em>End of sample—not legal advice.</em></p>`,
      },
    ],
  },
  metadata: {
    use_case: "will",
    testator_name: "Priya Sharma",
    will_title_line: "Last Will and Testament",
    language: "en",
  },
};

const genOpts = { assistantKey: "will" };
const stamp = new Date().toISOString().split("T")[0];
const outDir = path.join(root, "test-outputs");

await fs.mkdir(outDir, { recursive: true });

const pdfPath = path.join(outDir, `sample-will-multipage_${stamp}.pdf`);
const docxPath = path.join(outDir, `sample-will-multipage_${stamp}.docx`);

const [pdfBuf, docxBuf] = await Promise.all([
  generatePDF(sampleDocumentData, genOpts),
  generateWord(sampleDocumentData, genOpts),
]);

await fs.writeFile(pdfPath, pdfBuf);
await fs.writeFile(docxPath, docxBuf);

console.log("Wrote:", pdfPath);
console.log("Wrote:", docxPath);

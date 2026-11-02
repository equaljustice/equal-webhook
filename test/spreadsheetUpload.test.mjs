// Excel/CSV uploads go to Gemini as text (Sahil 2026-11-02: "allow excel sheets", F&F).
// Run: node --test test/spreadsheetUpload.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "module";

import { extractSpreadsheetText, isSpreadsheetUpload } from "../src/utils/spreadsheetText.js";
import { isAllowedUploadFile, uploadTypeError } from "../src/utils/uploadFileTypes.js";

const JSZip = createRequire(createRequire(import.meta.url).resolve("mammoth"))("jszip");

async function workbook() {
  const zip = new JSZip();
  zip.file("xl/workbook.xml", `<workbook xmlns:r="r"><sheets><sheet name="F&amp;F" sheetId="1" r:id="rId1"/><sheet name="Salary" sheetId="2" r:id="rId2"/></sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="/xl/worksheets/sheet2.xml"/></Relationships>`);
  zip.file("xl/sharedStrings.xml", `<sst><si><t>Component</t></si><si><t>Amount (Rs.)</t></si><si><r><t>Leave </t></r><r><t xml:space="preserve">encashment</t></r></si><si><t>Paid on</t></si></sst>`);
  zip.file("xl/styles.xml", `<styleSheet><numFmts><numFmt numFmtId="164" formatCode="dd\\-mmm\\-yyyy"/></numFmts><cellXfs><xf numFmtId="0"/><xf numFmtId="164"/><xf numFmtId="14"/><xf numFmtId="4"/></cellXfs></styleSheet>`);
  zip.file("xl/worksheets/sheet1.xml", `<worksheet><sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
    <row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" s="3"><v>16000</v></c></row>
    <row r="3"><c r="A3" t="s"><v>3</v></c><c r="C3" s="1"><v>46331</v></c></row>
    <row r="4"><c r="A4" t="inlineStr"><is><t>Laptop &amp; asset recovery</t></is></c><c r="B4"><v>-25000</v></c></row>
    <row r="5"><c r="A5"/></row>
  </sheetData></worksheet>`);
  zip.file("xl/worksheets/sheet2.xml", `<worksheet><sheetData><row r="1"><c r="A1" t="str"><v>Basic</v></c><c r="B1"><v>40000</v></c><c r="C1" s="2"><v>44348</v></c></row></sheetData></worksheet>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

test("an .xlsx becomes readable text: every sheet, shared/rich/inline strings, numbers and dates", async () => {
  const text = await extractSpreadsheetText(await workbook(), "ff-statement.xlsx");
  assert.equal(
    text,
    [
      "Sheet: F&F",
      "Component | Amount (Rs.)",
      "Leave encashment | 16000",
      "Paid on |  | 05-Nov-2026",
      "Laptop & asset recovery | -25000",
      "",
      "Sheet: Salary",
      "Basic | 40000 | 01-Jun-2021",
    ].join("\n"),
  );
});

test("a CSV is passed through as text", async () => {
  const text = await extractSpreadsheetText(Buffer.from("﻿Component,Amount\nGratuity,0\n"), "ff.csv");
  assert.equal(text, "Component,Amount\nGratuity,0");
});

test("a broken or empty workbook gives the user a clear message", async () => {
  const zip = new JSZip();
  zip.file("hello.txt", "x");
  await assert.rejects(extractSpreadsheetText(await zip.generateAsync({ type: "nodebuffer" }), "x.xlsx"), /save it as \.xlsx/);
  await assert.rejects(extractSpreadsheetText(Buffer.from(" \n"), "x.csv"), /looks empty/);
});

test("spreadsheets are accepted only with JOLLYJI_SPREADSHEET_UPLOADS=true; legacy .xls never", () => {
  const xlsx = { originalname: "ff.xlsx", mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  delete process.env.JOLLYJI_SPREADSHEET_UPLOADS;
  assert.equal(isAllowedUploadFile(xlsx), false);
  assert.match(uploadTypeError(), /Only PDF, DOCX, and images/);
  process.env.JOLLYJI_SPREADSHEET_UPLOADS = "true";
  assert.equal(isAllowedUploadFile(xlsx), true);
  assert.equal(isAllowedUploadFile({ originalname: "ff.csv", mimetype: "" }), true);
  assert.equal(isAllowedUploadFile({ originalname: "old.xls", mimetype: "application/vnd.ms-excel" }), false);
  assert.equal(isAllowedUploadFile({ originalname: "slip.pdf", mimetype: "application/pdf" }), true);
  assert.match(uploadTypeError(), /Excel \(XLSX\/CSV\)/);
  assert.equal(isSpreadsheetUpload(xlsx), true);
  delete process.env.JOLLYJI_SPREADSHEET_UPLOADS;
});

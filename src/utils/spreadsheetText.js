import path from "path";
import { createRequire } from "module";

// Gemini cannot read Excel, so spreadsheets go to it as text, like Word does (documentTextExtract.js).
// An .xlsx is a zip of XML parts; mammoth already ships jszip 3 (package-lock pins it), so load
// that copy rather than adding a dependency. The top-level jszip in the tree is an old 2.x.
const requireFromMammoth = createRequire(createRequire(import.meta.url).resolve("mammoth"));
const JSZip = requireFromMammoth("jszip");

const SPREADSHEET_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "application/csv",
  "text/comma-separated-values",
]);
const SPREADSHEET_EXTENSIONS = new Set([".xlsx", ".csv"]);

/** Cap on the text handed to the model per workbook (a payroll export can be huge). */
const MAX_TEXT_CHARS = 200_000;
// Built-in Excel number formats that are dates (ECMA-376 §18.8.30).
const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 22, 27, 30, 36, 45, 46, 47, 50, 57]);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function isSpreadsheetUpload({ mimetype, originalname } = {}) {
  const ext = path.extname(String(originalname || "")).toLowerCase();
  if (SPREADSHEET_EXTENSIONS.has(ext)) return true;
  return SPREADSHEET_MIMES.has(String(mimetype || "").toLowerCase().trim());
}

function unescapeXml(s) {
  return String(s)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

/** All <t> runs of one shared/inline string, joined (rich text splits a cell into runs). */
const runsText = (xml) => unescapeXml([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(""));

const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];

function columnIndex(ref) {
  const letters = String(ref || "").match(/^[A-Z]+/)?.[0] || "";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Excel serial (1900 system) → "05-Nov-2026". */
function serialToDate(serial) {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return String(serial);
  return `${String(d.getUTCDate()).padStart(2, "0")}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}

/** Style index → true when that cell format shows a date. */
function dateStyles(stylesXml) {
  if (!stylesXml) return [];
  const custom = new Map(
    [...stylesXml.matchAll(/<numFmt\b[^>]*>/g)].map((m) => [Number(attr(m[0], "numFmtId")), unescapeXml(attr(m[0], "formatCode") || "")]),
  );
  const isDateFormat = (id) => {
    if (BUILTIN_DATE_FORMATS.has(id)) return true;
    const code = (custom.get(id) || "").replace(/"[^"]*"|\[[^\]]*\]/g, "");
    return /[dmy]/i.test(code) && !/^[#0.,%\s]*$/.test(code);
  };
  const cellXfs = stylesXml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] || "";
  return [...cellXfs.matchAll(/<xf\b[^>]*>/g)].map((m) => isDateFormat(Number(attr(m[0], "numFmtId") || 0)));
}

function sheetRows(sheetXml, shared, isDateStyle) {
  const rows = [];
  for (const row of sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cell of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const head = cell[1];
      const body = cell[2] || "";
      const type = attr(head, "t");
      const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value = "";
      if (type === "s") value = shared[Number(raw)] ?? "";
      else if (type === "inlineStr") value = runsText(body);
      else if (type === "b") value = raw === "1" ? "TRUE" : "FALSE";
      else if (raw != null) {
        const num = Number(raw);
        value = !type && isDateStyle[Number(attr(head, "s") || 0)] && Number.isFinite(num) ? serialToDate(num) : unescapeXml(raw);
      }
      cells[columnIndex(attr(head, "r"))] = value.replace(/\s+/g, " ").trim();
    }
    const line = Array.from(cells, (v) => v ?? "").join(" | ").replace(/(\s\|\s?)+$/, "");
    if (line.replace(/[|\s]/g, "")) rows.push(line);
  }
  return rows;
}

/** Workbook → "Sheet: <name>" sections with one " | "-separated line per row. */
export async function extractXlsxText(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const read = async (name) => (zip.file(name) ? zip.file(name).async("string") : "");
  const workbook = await read("xl/workbook.xml");
  if (!workbook) throw new Error("This Excel file could not be read. Please save it as .xlsx and upload again.");
  const rels = await read("xl/_rels/workbook.xml.rels");
  const targets = new Map([...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => [attr(m[0], "Id"), attr(m[0], "Target")]));
  const shared = [...(await read("xl/sharedStrings.xml")).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => runsText(m[1]));
  const isDateStyle = dateStyles(await read("xl/styles.xml"));

  const parts = [];
  for (const sheet of workbook.matchAll(/<sheet\b[^>]*>/g)) {
    const target = targets.get(attr(sheet[0], "r:id"));
    if (!target) continue;
    const file = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
    const rows = sheetRows(await read(file), shared, isDateStyle);
    if (rows.length) parts.push(`Sheet: ${unescapeXml(attr(sheet[0], "name") || "Sheet")}\n${rows.join("\n")}`);
  }
  return parts.join("\n\n");
}

/** Text of an uploaded .xlsx or .csv (multer temp file buffer), ready to send as text/plain. */
export async function extractSpreadsheetText(buffer, originalname = "") {
  const ext = path.extname(String(originalname)).toLowerCase();
  const text = (ext === ".csv" ? buffer.toString("utf8").replace(/^﻿/, "") : await extractXlsxText(buffer)).trim();
  if (!text) throw new Error("The spreadsheet looks empty. Please check the file and upload again.");
  return text.length > MAX_TEXT_CHARS ? `${text.slice(0, MAX_TEXT_CHARS)}\n[… spreadsheet truncated]` : text;
}

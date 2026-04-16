import puppeteer from "puppeteer";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
  DOCUMENT_CONFIG,
  DOCUMENT_TEMPLATE_PROFILE,
  ASSISTANT_KEY_TO_DOCUMENT_TEMPLATE,
} from "../../constants.js";

const VALID_TEMPLATE_PROFILES = new Set(
  Object.values(DOCUMENT_TEMPLATE_PROFILE)
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate formatted timestamp string in IST
 * @returns {string} Formatted timestamp in IST
 */
function getFormattedTimestamp() {
  const now = new Date();
  const options = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  };
  return now.toLocaleString("en-IN", options) + " IST";
}

/**
 * Convert structured document data to HTML content
 * Preserves HTML formatting from chat messages
 * @param {Object} documentData - Structured document data from assistant
 * @returns {string} HTML content
 */
function convertDocumentDataToHTML(documentData) {
  if (
    !documentData ||
    !documentData.content ||
    !documentData.content.sections
  ) {
    return "";
  }

  let html = "";

  for (const section of documentData.content.sections) {
    if (!section || !section.type) continue;

    switch (section.type) {
      case "heading":
        const level = section.level || 1;
        const headingTag = `h${Math.min(Math.max(level, 1), 6)}`;
        const headingText = section.text || "";
        if (headingText.includes("<") && headingText.includes(">")) {
          html += `<${headingTag}>${headingText}</${headingTag}>`;
        } else {
          html += `<${headingTag}><strong>${headingText}</strong></${headingTag}>`;
        }
        break;

      case "paragraph":
        const paraText = section.text || "";
        const processedPara = paraText
          .replace(/\n\n/g, "</p><p>")
          .replace(/\n/g, "<br>");
        html += `<p>${processedPara}</p>`;
        break;

      case "list":
        if (section.items && Array.isArray(section.items)) {
          html += "<ul>";
          for (const item of section.items) {
            if (item) {
              html += `<li>${item}</li>`;
            }
          }
          html += "</ul>";
        }
        break;

      case "will_text":
        const willText = section.text || "";
        const escapedWill = escapeHtml(willText).replace(/\n/g, "<br>");
        html += `<div class="will-text">${escapedWill}</div>`;
        break;

      case "legal_notice":
        const noticeText = section.text || "";
        const processedNotice = noticeText
          .replace(/\n\n/g, "</p><p>")
          .replace(/\n/g, "<br>");
        html += `<div class="legal-notice"><p>${processedNotice}</p></div>`;
        break;

      case "signature":
        html += `<div class="signature-block">`;
        if (section.text) {
          html += `<p>${section.text}</p>`;
        }
        html += `<div class="signature-line">${section.label || "Signature"}</div>`;
        html += `</div>`;
        break;

      case "html":
      case "raw":
        // Raw HTML passthrough - used when document content is the actual
        // final chat response (already fully formatted with HTML tags)
        html += section.text || "";
        break;

      case "disclaimer":
        html += `<div class="disclaimer">${section.text || ""}</div>`;
        break;

      default:
        if (section.text) {
          const defaultText = section.text
            .replace(/\n\n/g, "</p><p>")
            .replace(/\n/g, "<br>");
          html += `<p>${defaultText}</p>`;
        }
    }
  }

  return html;
}

/**
 * Escape HTML special characters
 * @param {string} text
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Fallback when assistantKey is missing or unmapped (older sessions, tests).
 * @param {Object|null} documentData
 * @returns {string} DOCUMENT_TEMPLATE_PROFILE value
 */
function inferTemplateProfileFromDocumentData(documentData) {
  if (!documentData) return DOCUMENT_TEMPLATE_PROFILE.DEFAULT;
  const type = String(documentData.document_type || "").toLowerCase();
  const useCase = String(documentData.metadata?.use_case || "").toLowerCase();
  const hay = `${type} ${useCase}`.replace(/_/g, " ");
  if (
    /\bwill\b|last will|my will|make will|create my will|testament/.test(hay)
  ) {
    return DOCUMENT_TEMPLATE_PROFILE.WILL;
  }
  return DOCUMENT_TEMPLATE_PROFILE.DEFAULT;
}

/**
 * Resolve layout profile: explicit options → assistant key map → stored metadata → heuristic.
 * @param {Object|null} documentData
 * @param {{ assistantKey?: string|null, templateProfile?: string|null }} [options]
 * @returns {string} DOCUMENT_TEMPLATE_PROFILE value
 */
export function resolveDocumentTemplateProfile(documentData, options = {}) {
  const fromOptions = options.templateProfile;
  if (
    fromOptions &&
    VALID_TEMPLATE_PROFILES.has(String(fromOptions).toLowerCase())
  ) {
    return String(fromOptions).toLowerCase();
  }
  const fromMeta = documentData?.metadata?.template_profile;
  if (
    fromMeta &&
    VALID_TEMPLATE_PROFILES.has(String(fromMeta).toLowerCase())
  ) {
    return String(fromMeta).toLowerCase();
  }
  const assistantKey = options.assistantKey || null;
  if (assistantKey && ASSISTANT_KEY_TO_DOCUMENT_TEMPLATE[assistantKey]) {
    return ASSISTANT_KEY_TO_DOCUMENT_TEMPLATE[assistantKey];
  }
  return inferTemplateProfileFromDocumentData(documentData);
}

/**
 * Last-will layout (header title + name, signature footer, margins).
 * @param {Object|null} documentData
 * @param {{ assistantKey?: string|null, templateProfile?: string|null }} [options]
 * @returns {boolean}
 */
export function isWillDocumentLayout(documentData, options = {}) {
  return (
    resolveDocumentTemplateProfile(documentData, options) ===
    DOCUMENT_TEMPLATE_PROFILE.WILL
  );
}

/**
 * @param {Object} documentData
 * @returns {{ mainTitle: string, name: string }}
 */
export function resolveWillHeader(documentData) {
  const mainTitle =
    (documentData.metadata?.will_title_line || "").trim() ||
    "Last Will and Testament";
  let name = (documentData.metadata?.testator_name || "").trim();
  if (!name) {
    const title = documentData.title || "";
    const m = title.match(/\bof\s+(.+)$/i);
    if (m) name = m[1].trim();
  }
  if (!name) name = "[Name]";
  return { mainTitle, name };
}

/**
 * PDF header/footer templates run in a separate Chromium print context. Use **px**
 * (not pt) and **tables** (not flex): pt/flex often render at wrong scale and overlap body text.
 */

/**
 * Will PDF footer: full-width signature rules (px + nested tables for Chromium print).
 */
function buildWillPdfSignaturesTable(testatorName) {
  const n = escapeHtml(testatorName);
  const rule = "border-bottom:1px solid #222;";
  const lab = "font-size:11px;line-height:1.3;white-space:nowrap;vertical-align:bottom;padding:0;";
  const lineCell =
    "vertical-align:bottom;width:100%;" + rule + "height:16px;padding:0 0 3px 0;";
  return (
    `<table style="width:100%;border-collapse:collapse;margin:0;padding:0;` +
    `color:#111;font-family:Arial,Helvetica,sans-serif;">` +
    `<tr><td colspan="2" style="padding:0 0 2px;font-size:12px;font-weight:bold;letter-spacing:0.02em;">` +
    `Signatures</td></tr>` +
    // Testator signature (long line)
    `<tr><td colspan="2" style="padding:0 0 4px 0;">` +
    `<table style="width:100%;border-collapse:collapse;margin:0;padding:0;"><tr>` +
    `<td style="${lab}padding-right:6px;">Testator Signature — <strong>${n}</strong></td>` +
    `<td style="${lineCell}">&#8203;</td>` +
    `</tr></table></td></tr>` +
    // Spacer similar to "<br><br>" in the example
    `<tr><td colspan="2" style="padding:0 0 2px 0;font-size:0;line-height:0;height:10px;">&#8203;</td></tr>` +
    // All witnesses signature (single long line for all witnesses)
    `<tr><td colspan="2" style="padding:0 0 0 0;">` +
    `<table style="width:100%;border-collapse:collapse;margin:0;padding:0;"><tr>` +
    `<td style="${lab}padding-right:6px;">All Witnesses Signature</td>` +
    `<td style="${lineCell}">&#8203;</td>` +
    `</tr></table></td></tr>` +
    `</table>`
  );
}

/**
 * PDF print header: title + name (left), Page N (right), horizontal rule.
 */
function buildWillPdfHeaderTemplate(mainTitle, name) {
  const esc = escapeHtml;
  return (
    `<div style="width:100%;box-sizing:border-box;padding:2px 48px 0;` +
    `font-family:Arial,Helvetica,sans-serif;color:#111;-webkit-print-color-adjust:exact;">` +
    `<table style="width:100%;border-collapse:collapse;margin:0;padding:0;">` +
    `<tr>` +
    `<td style="width:75%;vertical-align:top;padding:0;">` +
    `<div style="font-size:11px;font-weight:bold;line-height:1.25;">${esc(mainTitle)}</div>` +
    `<div style="font-size:10px;line-height:1.25;margin-top:1px;">${esc(name)}</div>` +
    `</td>` +
    `<td style="width:25%;vertical-align:top;text-align:right;white-space:nowrap;` +
    `padding:0 0 0 6px;font-size:10px;line-height:1.25;">` +
    `Page-<span class="pageNumber"></span>` +
    `</td></tr></table>` +
    `<div style="border-bottom:1px solid #333;margin-top:3px;font-size:0;line-height:0;">&#8203;</div>` +
    `</div>`
  );
}

/**
 * PDF print footer: rule, "Signatures", testator + witnesses (repeats every page).
 */
function buildWillPdfFooterTemplate(testatorName) {
  return (
    `<div style="width:100%;box-sizing:border-box;padding:0 48px 2px;` +
    `font-family:Arial,Helvetica,sans-serif;color:#111;-webkit-print-color-adjust:exact;">` +
    `<div style="border-top:1px solid #333;margin:0 0 1px;font-size:0;line-height:0;">&#8203;</div>` +
    `${buildWillPdfSignaturesTable(testatorName)}` +
    `</div>`
  );
}

/**
 * Default PDF: document title + Page N + rule; footer rule only.
 */
function buildDefaultPdfHeaderTemplate(docTitle) {
  const esc = escapeHtml;
  const t = esc(docTitle || "Document");
  return (
    `<div style="width:100%;box-sizing:border-box;padding:2px 48px 0;` +
    `font-family:Arial,Helvetica,sans-serif;color:#111;-webkit-print-color-adjust:exact;">` +
    `<table style="width:100%;border-collapse:collapse;margin:0;padding:0;">` +
    `<tr>` +
    `<td style="vertical-align:middle;padding:0;font-size:11px;font-weight:bold;line-height:1.2;">${t}</td>` +
    `<td style="vertical-align:middle;text-align:right;white-space:nowrap;padding:0 0 0 8px;` +
    `font-size:10px;line-height:1.2;">Page-<span class="pageNumber"></span></td>` +
    `</tr></table>` +
    `<div style="border-bottom:1px solid #333;margin-top:3px;font-size:0;line-height:0;">&#8203;</div>` +
    `</div>`
  );
}

function buildDefaultPdfFooterTemplate() {
  return (
    `<div style="width:100%;box-sizing:border-box;padding:2px 48px;` +
    `font-family:Arial,Helvetica,sans-serif;">` +
    `<div style="border-top:1px solid #333;font-size:0;line-height:0;">&#8203;</div>` +
    `</div>`
  );
}

/**
 * Word header: title, name, bottom rule (page number is first line of footer for DOCX).
 */
function buildWillWordHeaderHtml(mainTitle, name) {
  const n = escapeHtml(name);
  const t = escapeHtml(mainTitle);
  return (
    `<table style="width:100%;border-collapse:collapse;font-family:'Times New Roman',Times,serif;color:#1a1a1a;">` +
    `<tr><td style="border:none;border-bottom:1px solid #333;padding:0 0 4px 0;vertical-align:top;">` +
    `<p style="margin:0;font-size:11pt;"><strong>${t}</strong></p>` +
    `<p style="margin:2px 0 0;font-size:10pt;">${n}</p>` +
    `</td></tr></table>`
  );
}

/**
 * Word footer: line 1 = Page + PAGE field; line 2 = rule + Signatures + lines (two &lt;p&gt; so PAGE stays on line 1).
 */
function buildWillWordFooterHtml(testatorName) {
  const n = escapeHtml(testatorName);
  const line =
    "border-bottom:1px solid #222;vertical-align:bottom;height:17px;padding:0;";
  return (
    `<div style="width:100%;font-family:'Times New Roman',Times,serif;color:#1a1a1a;">` +
    `<p style="margin:0;text-align:right;font-size:10pt;">Page-</p>` +
    `<div style="margin:2px 0 0;padding-top:3px;border-top:1px solid #333;">` +
    `<table width="100%" style="border-collapse:collapse;" cellpadding="0" cellspacing="0">` +
    `<tr><td colspan="4" style="padding:0 0 2px;font-size:11pt;"><strong>Signatures</strong></td></tr>` +
    // Testator signature (long line)
    `<tr><td colspan="4" style="padding:0 0 3px 0;">` +
    `<table width="100%" style="border-collapse:collapse;" cellpadding="0" cellspacing="0"><tr>` +
    `<td style="white-space:nowrap;font-size:10pt;vertical-align:bottom;padding:0 6px 2px 0;">` +
    `Testator Signature — <strong>${n}</strong></td>` +
    `<td style="${line}width:100%;">&#8203;</td>` +
    `</tr></table></td></tr>` +
    // Spacer similar to "<br><br>"
    `<tr><td colspan="4" style="padding:0 0 2px 0;font-size:0;line-height:0;height:14px;">&#8203;</td></tr>` +
    // All witnesses signature (single long line) - keep outer table cells
    // so html-to-docx reliably renders the label text.
    `<tr>` +
    `<td width="11%" style="white-space:nowrap;font-size:10pt;vertical-align:bottom;padding:0 6px 0 0;">All Witnesses Signature</td>` +
    `<td colspan="3" style="${line}padding-top:3px;">&#8203;</td>` +
    `</tr>` +
    `</table></div></div>`
  );
}

/**
 * Load and process HTML template
 * @param {Object} documentData - Structured document data
 * @returns {Promise<string>} Processed HTML
 */
async function loadHTMLTemplate(documentData, genOptions = {}) {
  const templatePath = path.join(
    __dirname,
    "../../",
    DOCUMENT_CONFIG.templates.headerFooterHtml
  );

  let template = await fs.readFile(templatePath, "utf-8");

  const title = documentData.title || "Document";
  const timestamp = getFormattedTimestamp();

  const content = convertDocumentDataToHTML(documentData);

  template = template.replace(/{{TITLE}}/g, title);
  template = template.replace(/{{TIMESTAMP}}/g, timestamp);
  template = template.replace(/{{CONTENT}}/g, content);
  const will = isWillDocumentLayout(documentData, genOptions);
  template = template.replace(
    /{{BODY_CLASS}}/g,
    will ? "will-print pdf-content-safe" : "pdf-content-safe"
  );

  return template;
}

/**
 * Generate PDF document from structured data
 * Clean layout: content + small page number bottom-right, timestamp & email at end of doc
 * @param {Object} documentData - Structured document data
 * @param {{ assistantKey?: string|null, templateProfile?: string|null }} [genOptions] - from session / admin map
 * @returns {Promise<Buffer>} PDF buffer
 */
export async function generatePDF(documentData, genOptions = {}) {
  if (!documentData) {
    throw new Error("Document data is required");
  }

  let html = await loadHTMLTemplate(documentData, genOptions);

  const willLayout = isWillDocumentLayout(documentData, genOptions);
  /*
   * Chromium lays out page breaks using @page margins. If @page margin is 0 but
   * page.pdf({ margin }) reserves space for header/footer, body text can still
   * paginate for the full sheet and overlap the footer. Sync @page to the same
   * insets and use preferCSSPageSize + zero PDF margins.
   */
  const pageMarginCss = willLayout
    ? "132px 48px 182px 48px"
    : "60px 48px 30px 48px";
  html = html.replace(
    /@page\s*\{[^}]*\}/s,
    `@page { size: A4; margin: ${pageMarginCss}; }`
  );

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--disable-extensions",
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });

  try {
    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    const { mainTitle, name } = willLayout
      ? resolveWillHeader(documentData)
      : { mainTitle: "", name: "" };

    const headerTemplate = willLayout
      ? buildWillPdfHeaderTemplate(mainTitle, name)
      : buildDefaultPdfHeaderTemplate(documentData.title || "Document");

    const footerTemplate = willLayout
      ? buildWillPdfFooterTemplate(name)
      : buildDefaultPdfFooterTemplate();

    const pdfBuffer = await page.pdf({
      format: DOCUMENT_CONFIG.pdf.format,
      preferCSSPageSize: true,
      margin: {
        top: "0px",
        right: "0px",
        bottom: "0px",
        left: "0px",
      },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate,
    });

    return pdfBuffer;
  } catch (error) {
    if (
      error.message.includes("libglib") ||
      error.message.includes("shared libraries")
    ) {
      throw new Error(
        "PDF generation failed: Missing system dependencies. Please install: " +
          "apt-get install -y libglib2.0-0 libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 " +
          "libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 " +
          "libgbm1 libasound2 libpango-1.0-0 libcairo2 libatspi2.0-0"
      );
    }
    throw error;
  } finally {
    await browser.close();
  }
}

/**
 * Generate Word document from structured data
 * Uses html-to-docx for proper Node.js DOCX generation
 * Clean layout matching PDF: content + end-of-doc info + page numbers
 * @param {Object} documentData - Structured document data
 * @param {{ assistantKey?: string|null, templateProfile?: string|null }} [genOptions]
 * @returns {Promise<Buffer>} Word document buffer
 */
export async function generateWord(documentData, genOptions = {}) {
  if (!documentData) {
    throw new Error("Document data is required");
  }

  let HTMLtoDOCX;
  try {
    const module = await import("html-to-docx");
    HTMLtoDOCX = module.default || module;
  } catch (importError) {
    throw new Error(
      `Failed to import html-to-docx: ${importError.message}. Run: npm install html-to-docx`
    );
  }

  const contentHtml = convertDocumentDataToHTML(documentData);
  const timestamp = getFormattedTimestamp();
  const willLayout = isWillDocumentLayout(documentData, genOptions);
  const { mainTitle, name } = willLayout
    ? resolveWillHeader(documentData)
    : { mainTitle: "", name: "" };
  const brandEmail = DOCUMENT_CONFIG.branding.email;

  const wordBodyInset = willLayout
    ? "padding-top: 1.5pt; padding-bottom: 2.5pt;"
    : "padding-top: 1.5pt; padding-bottom: 2pt;";

  const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: 'Times New Roman', Times, serif;
          font-size: 12pt;
          line-height: 1.7;
          color: #1a1a1a;
          ${wordBodyInset}
        }
        h1, h2, h3, h4, h5, h6 {
          font-weight: bold;
          color: #1a1a1a;
        }
        h1 { font-size: 18pt; }
        h2 { font-size: 15pt; }
        h3 { font-size: 13pt; }
        h4 { font-size: 12pt; }
        h5 { font-size: 12pt; }
        h6 { font-size: 11pt; font-weight: normal; }
        p {
          margin: 8px 0;
          text-align: justify;
          line-height: 1.7;
        }
        strong { font-weight: bold; }
        em { font-style: italic; color: #555; }
        u { text-decoration: underline; }
        ul, ol {
          margin: 10px 0;
          padding-left: 30px;
        }
        li { margin: 5px 0; line-height: 1.6; }
        .will-text {
          white-space: pre-wrap;
          font-family: 'Times New Roman', serif;
          line-height: 1.9;
          margin: 15px 0;
          padding: 10px 15px;
          border-left: 3px solid #22743a;
        }
        .legal-notice {
          font-family: 'Times New Roman', serif;
          line-height: 1.8;
          margin: 12px 0;
          text-align: justify;
        }
        .signature-block { margin-top: 40px; }
        .signature-line {
          border-top: 1px solid #333;
          width: 250px;
          margin-top: 35px;
          padding-top: 5px;
          font-size: 11pt;
        }
        .disclaimer {
          margin-top: 25px;
          padding: 10px 12px;
          border: 1px solid #ddd;
          font-size: 9pt;
          color: #777;
          line-height: 1.5;
        }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; font-size: 11pt; }
        th { font-weight: bold; }
      </style>
    </head>
    <body>
      ${contentHtml}
      <p style="margin-top: 40px; font-size: 9pt; color: #999;">
        ${timestamp}<br>
        ${brandEmail}
      </p>
    </body>
    </html>
  `;

  const headerHTML = willLayout
    ? buildWillWordHeaderHtml(mainTitle, name)
    : `<table style="width:100%;border-collapse:collapse;font-family:'Times New Roman',serif;">
        <tr><td style="border:none;border-bottom:1px solid #333;padding:0 0 4px 0;">
          <p style="margin:0;font-size:11pt;"><strong>${escapeHtml(documentData.title || "Document")}</strong></p>
        </td></tr></table>`;

  const footerHTML = willLayout
    ? buildWillWordFooterHtml(name)
    : `
    <div style="width:100%; text-align: right; font-size: 8pt; color: #aaa;">
      <span></span>
    </div>
  `;

  const docxMargins = willLayout
    ? {
        top: 1760,
        right: 1440,
        bottom: 2320,
        left: 1440,
        header: 820,
        footer: 1320,
      }
    : {
        top: 1520,
        right: 1440,
        bottom: 1180,
        left: 1440,
        header: 620,
        footer: 540,
      };

  let docxBuffer;
  try {
    docxBuffer = await HTMLtoDOCX(fullHtml, headerHTML, {
      table: { row: { cantSplit: true } },
      header: Boolean(headerHTML),
      footer: true,
      pageNumber: true,
      orientation: "portrait",
      margins: docxMargins,
      title: documentData.title || "Document",
      font: "Times New Roman",
      fontSize: 24,
      decodeUnicode: true,
    }, footerHTML);
  } catch (generationError) {
    console.error("DOCX generation error details:", generationError);
    throw new Error(
      `Word document generation failed: ${generationError.message}`
    );
  }

  if (Buffer.isBuffer(docxBuffer)) {
    return docxBuffer;
  } else if (docxBuffer instanceof ArrayBuffer) {
    return Buffer.from(docxBuffer);
  } else if (docxBuffer instanceof Uint8Array) {
    return Buffer.from(docxBuffer);
  } else if (
    docxBuffer &&
    typeof docxBuffer === "object" &&
    docxBuffer.type === "Buffer"
  ) {
    return Buffer.from(docxBuffer.data);
  } else {
    return Buffer.from(docxBuffer);
  }
}

/**
 * Generate document in specified format
 * @param {Object} documentData - Structured document data
 * @param {string} format - 'pdf' or 'word'
 * @param {{ assistantKey?: string|null, templateProfile?: string|null }} [genOptions] - e.g. { assistantKey: session.assistantKey }
 * @returns {Promise<Buffer>} Document buffer
 */
export async function generateDocument(
  documentData,
  format = "pdf",
  genOptions = {}
) {
  if (format === "pdf") {
    return await generatePDF(documentData, genOptions);
  } else if (format === "word" || format === "docx") {
    return await generateWord(documentData, genOptions);
  } else {
    throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * Get filename for document download
 * @param {Object} documentData - Structured document data
 * @param {string} format - 'pdf' or 'word'
 * @returns {string} Filename
 */
export function getDocumentFilename(documentData, format = "pdf") {
  const documentType = documentData.document_type || "document";
  const extension = format === "word" || format === "docx" ? "docx" : "pdf";
  const timestamp = new Date().toISOString().split("T")[0];
  return `${documentType}_${timestamp}.${extension}`;
}

/**
 * Export for use by preview server
 */
export { convertDocumentDataToHTML, loadHTMLTemplate, getFormattedTimestamp };

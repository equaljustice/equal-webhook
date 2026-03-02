import puppeteer from "puppeteer";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { DOCUMENT_CONFIG } from "../../constants.js";

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
 * Load and process HTML template
 * @param {Object} documentData - Structured document data
 * @returns {Promise<string>} Processed HTML
 */
async function loadHTMLTemplate(documentData) {
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

  return template;
}

/**
 * Generate PDF document from structured data
 * Clean layout: content + small page number bottom-right, timestamp & email at end of doc
 * @param {Object} documentData - Structured document data
 * @returns {Promise<Buffer>} PDF buffer
 */
export async function generatePDF(documentData) {
  if (!documentData) {
    throw new Error("Document data is required");
  }

  const html = await loadHTMLTemplate(documentData);

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

    // Minimal: only a small page number bottom-right, no header
    const pdfBuffer = await page.pdf({
      format: DOCUMENT_CONFIG.pdf.format,
      margin: {
        top: "50px",
        right: "50px",
        bottom: "50px",
        left: "50px",
      },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `<span></span>`,
      footerTemplate: `
        <div style="width: 100%; padding: 0 50px; text-align: right;">
          <span style="font-size: 8px; color: #aaa; font-family: Arial, sans-serif;"><span class="pageNumber"></span></span>
        </div>
      `,
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
 * @returns {Promise<Buffer>} Word document buffer
 */
export async function generateWord(documentData) {
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

  // Content + end-of-doc info (timestamp + email) — same as PDF template
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
        equal@equaljustice.ai
      </p>
    </body>
    </html>
  `;

  // No header for DOCX
  const headerHTML = null;

  // Small page number only
  const footerHTML = `
    <div style="width:100%; text-align: right; font-size: 8pt; color: #aaa;">
      <span></span>
    </div>
  `;

  let docxBuffer;
  try {
    docxBuffer = await HTMLtoDOCX(fullHtml, headerHTML, {
      table: { row: { cantSplit: true } },
      footer: true,
      pageNumber: true,
      orientation: "portrait",
      margins: {
        top: 1440,
        right: 1440,
        bottom: 1440,
        left: 1440,
      },
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
 * @returns {Promise<Buffer>} Document buffer
 */
export async function generateDocument(documentData, format = "pdf") {
  if (format === "pdf") {
    return await generatePDF(documentData);
  } else if (format === "word" || format === "docx") {
    return await generateWord(documentData);
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

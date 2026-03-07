/**
 * Document Extractor Service
 * Extracts plain text from heterogeneous document formats.
 *
 * Position in the ingestion pipeline:
 *   [THIS SERVICE] → normalization → classification → chunking → embeddings
 *
 * Supported formats: .pdf  .docx  .xlsx  .csv  .txt  .md
 *
 * All extractors are:
 *  - Deterministic (same bytes → same text)
 *  - Self-contained (no external HTTP calls)
 *  - Buffer-only (NEVER reads files from disk)
 */

import { Buffer } from "buffer";
import path from "path";
import mammoth from "mammoth";
import ExcelJS from "exceljs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024; // 25 MB

/**
 * Normalize extracted text
 */
function cleanText(text: string): string {
  return text
    .replace(/\f/g, "\n\n")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * Extract PDF text
 */
async function extractPdf(buffer: Buffer): Promise<string> {
  if (!buffer || buffer.length === 0) {
    throw new Error("PDF buffer is empty");
  }

  const result = await pdfParse(buffer);

  if (!result || !result.text) {
    throw new Error("PDF extraction failed: empty result");
  }

  return cleanText(result.text);
}

/**
 * Extract DOCX text
 */
async function extractDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return cleanText(result.value);
}

/**
 * Extract XLSX text
 */
async function extractXlsx(buffer: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  let text = "";

  workbook.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      text += values.join(" ") + "\n";
    });
  });

  return cleanText(text);
}

/**
 * Extract plain text
 */
function extractPlain(buffer: Buffer): string {
  return cleanText(buffer.toString("utf-8"));
}

/**
 * Main extraction entry point
 */
export async function extractDocumentContent(
  buffer: Buffer,
  filename: string
): Promise<string> {
  if (buffer.length > MAX_DOCUMENT_SIZE) {
    throw new Error(
      `Document too large: ${buffer.length} bytes (limit ${MAX_DOCUMENT_SIZE})`
    );
  }

  const ext = path.extname(filename).toLowerCase();

  if (!ext) {
    throw new Error(`File has no extension: ${filename}`);
  }

  switch (ext) {
    case ".pdf":
      return extractPdf(buffer);

    case ".docx":
      return extractDocx(buffer);

    case ".xlsx":
    case ".xls":
      return extractXlsx(buffer);

    case ".txt":
    case ".md":
    case ".csv":
      return extractPlain(buffer);

    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

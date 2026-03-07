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

import { Buffer } from 'buffer';
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';
import pdfParse from 'pdf-parse';

const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024; // 25 MB

/**
 * Clean extracted text by normalizing whitespace and removing
 * form feed characters and other noise.
 */
function cleanText(text: string): string {
  return text
    .replace(/\f/g, '\n\n')           // form feeds → paragraph breaks
    .replace(/\s+\n/g, '\n')          // trailing whitespace on lines
    .replace(/[ \t]+/g, ' ')          // collapse multiple spaces/tabs
    .trim();
}

/**
 * Extract textual content from a document buffer.
 *
 * Format is detected from the file extension (case-insensitive).
 * Throws for unrecognised extensions so the caller can surface the error
 * cleanly rather than silently ingesting garbage bytes.
 *
 * This function ONLY processes the provided buffer and NEVER reads files
 * from disk. It is safe for use in Supabase ingestion pipelines.
 *
 * @param buffer   - Raw file bytes (never null)
 * @param filename - Original filename including extension
 * @returns Plain text ready for the normalization step
 */
export async function extractDocumentContent(
  buffer: Buffer,
  filename: string
): Promise<string> {
  // ── Safety guard: size limit ──────────────────────────────────────────
  if (buffer.length > MAX_DOCUMENT_SIZE) {
    throw new Error(
      `Document too large for ingestion: ${buffer.length} bytes (limit: ${MAX_DOCUMENT_SIZE} bytes)`
    );
  }

  // ── Detect file type from extension ────────────────────────────────────
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();

  if (!ext) {
    throw new Error(`No file extension for: ${filename}`);
  }

  // ── PDF extraction ────────────────────────────────────────────────────
  if (ext === '.pdf') {
    const result = await pdfParse(buffer);
    return cleanText(result.text);
  }

  // ── DOCX extraction ───────────────────────────────────────────────────
  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ buffer });
    return cleanText(result.value);
  }

  // ── XLSX/XLS extraction ───────────────────────────────────────────────
  if (ext === '.xlsx' || ext === '.xls') {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    let text = '';
    workbook.eachSheet((sheet) => {
      sheet.eachRow((row) => {
        text += (row.values?.join(' ') ?? '') + '\n';
      });
    });

    return cleanText(text);
  }

  // ── Plain text extraction (TXT, MD, CSV) ──────────────────────────────
  if (ext === '.txt' || ext === '.md' || ext === '.csv') {
    return cleanText(buffer.toString('utf-8'));
  }

  // ── Unsupported format ────────────────────────────────────────────────
  throw new Error(`Unsupported file type: ${ext}`);
}

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
 *  - Logged at entry and exit with byte / character counts
 */

import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { log, warn } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Internal: format-specific extractors
// ---------------------------------------------------------------------------

/**
 * PDF — extract text page by page using pdf-parse.
 * Pages are separated by a blank line so that paragraph-boundary chunking
 * does not merge content from adjacent pages.
 */
async function extractPdf(buffer: Buffer): Promise<string> {
  const result = await pdfParse(buffer, {
    // Custom page render: emit text then a separator so page breaks survive
    pagerender(pageData: any) {
      return pageData.getTextContent().then((content: any) => {
        return content.items.map((item: any) => item.str).join(' ');
      });
    },
  });

  // result.text already concatenates all pages; we return it directly.
  // pdf-parse inserts form-feed characters (\f) between pages — convert to
  // double newlines so the normalizer can detect paragraph boundaries.
  return result.text.replace(/\f/g, '\n\n');
}

/**
 * DOCX — extract raw text via mammoth.
 * mammoth.extractRawText() strips all formatting and returns only content,
 * which is what we want for embedding (style noise removed).
 */
async function extractDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });

  if (result.messages.length > 0) {
    warn('[Extractor] mammoth warnings:', result.messages.map((m: any) => m.message).join('; '));
  }

  return result.value;
}

/**
 * XLSX — convert each worksheet into a pipe-delimited textual table.
 *
 * Output format for each sheet:
 *   Sheet: <name>
 *   Col A | Col B | Col C
 *   val1  | val2  | val3
 *   ...
 *
 * Multiple sheets are separated by blank lines.
 * Empty sheets are skipped.
 */
async function extractXlsx(buffer: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sections: string[] = [];

  workbook.eachSheet((worksheet) => {
    const rows: string[] = [];

    worksheet.eachRow((row) => {
      // Resolve cell values to plain strings; handle date, formula, richText
      const cells = (row.values as ExcelJS.CellValue[])
        .slice(1) // row.values[0] is always undefined (1-indexed)
        .map((cell) => {
          if (cell === null || cell === undefined) return '';
          if (typeof cell === 'object' && 'richText' in cell) {
            // RichText — concatenate runs
            return (cell as ExcelJS.CellRichTextValue).richText
              .map((r) => r.text)
              .join('');
          }
          if (typeof cell === 'object' && 'result' in cell) {
            // Formula — use computed result
            return String((cell as ExcelJS.CellFormulaValue).result ?? '');
          }
          return String(cell);
        });

      if (cells.some((c) => c.trim().length > 0)) {
        rows.push(cells.join(' | '));
      }
    });

    if (rows.length > 0) {
      sections.push(`Sheet: ${worksheet.name}\n${rows.join('\n')}`);
    }
  });

  return sections.join('\n\n');
}

/**
 * CSV — parse with PapaParse and render as pipe-delimited rows.
 * The first row is treated as a header and re-emitted verbatim so that
 * column semantics are preserved in the text.
 */
function extractCsv(buffer: Buffer): string {
  const raw = buffer.toString('utf-8');

  const result = Papa.parse<string[]>(raw, {
    skipEmptyLines: true,
  });

  if (result.errors.length > 0) {
    warn(
      '[Extractor] PapaParse warnings:',
      result.errors.map((e) => e.message).join('; ')
    );
  }

  return (result.data as string[][])
    .map((row) => row.join(' | '))
    .join('\n');
}

/**
 * TXT / MD — straight UTF-8 decode.
 * No transformation: the normalizer downstream handles whitespace cleanup.
 */
function extractPlainText(buffer: Buffer): string {
  return buffer.toString('utf-8');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract textual content from a document buffer.
 *
 * Format is detected from the file extension (case-insensitive).
 * Throws for unrecognised extensions so the caller can surface the error
 * cleanly rather than silently ingesting garbage bytes.
 *
 * @param fileBuffer - Raw file bytes
 * @param filename   - Original filename including extension
 * @returns Plain text ready for the normalization step
 */
export async function extractDocumentContent(
  fileBuffer: Buffer,
  filename: string
): Promise<string> {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';

  log(`[Extractor] Detected file type: .${ext} (${fileBuffer.length} bytes)`);

  let text: string;

  switch (ext) {
    case 'pdf':
      text = await extractPdf(fileBuffer);
      break;

    case 'docx':
      text = await extractDocx(fileBuffer);
      break;

    case 'xlsx':
      text = await extractXlsx(fileBuffer);
      break;

    case 'csv':
      text = extractCsv(fileBuffer);
      break;

    case 'txt':
    case 'md':
      text = extractPlainText(fileBuffer);
      break;

    default:
      throw new Error(
        `Unsupported document type: .${ext || '(no extension)'}`
      );
  }

  log(`[Extractor] Extracted ${text.length} characters from ${filename}`);

  return text;
}

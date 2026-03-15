import { Buffer } from "buffer";
import mammoth from "mammoth";
import ExcelJS from "exceljs";
import { runGoogleVisionOCR, shouldTryOCR } from '@/services/ai/google-vision-ocr.service';

// Browser-safe file extension extraction (replaces Node.js path.extname for browser environment)
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.substring(lastDot).toLowerCase();
}

let pdfjsLib: any | null = null;
async function loadPdfJs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsLib;
}

const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024;
const COLUMN_GAP_THRESHOLD = 20; // Gap size threshold for column separator
const WORD_GAP_THRESHOLD = 5; // Gap size threshold for word space
const Y_THRESHOLD_DEFAULT = 5; // Default Y-coordinate clustering threshold (pixels)

function cleanText(text: string): string {
  return text
    .replace(/\f/g, "\n\n")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * Coordinate-aware PDF text reconstruction.
 * Groups text items by visual line (Y coordinate), sorts by column (X coordinate),
 * and reconstructs with proper spacing to preserve table structure.
 */
interface TextItem {
  str: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  index: number; // for stable sorting
}

/**
 * Extract coordinate information from a pdfjs text item.
 * pdfjs transform array is [a, b, c, d, e, f] where:
 *   e = x position (transform[4])
 *   f = y position (transform[5])
 */
function extractCoordinates(item: any, index: number): TextItem {
  const x = item.transform?.[4] ?? 0;
  const y = item.transform?.[5] ?? 0;
  const str = item.str ?? "";
  // Estimate width from string length if not provided (fallback: 3 pixels per character)
  const width = item.width ?? (str.length * 3);
  const height = item.height ?? 0;

  return {
    str,
    x,
    y,
    width,
    height,
    index,
  };
}

/**
 * Compute the average Y coordinate of a line.
 * Used to ensure lines are ordered top-to-bottom consistently.
 */
function averageY(line: TextItem[]): number {
  if (line.length === 0) return 0;
  const sum = line.reduce((acc, item) => acc + item.y, 0);
  return sum / line.length;
}

/**
 * Group text items by visual line using Y coordinate clustering.
 * Items with similar Y values (within threshold) are grouped together.
 *
 * Algorithm:
 * 1. Sort items by Y descending (top to bottom)
 * 2. Group consecutive items with Y difference < threshold
 * 3. Sort lines by average Y to ensure correct top-to-bottom ordering
 * 4. Return groups representing visual lines
 */
function groupByLine(items: TextItem[], yThreshold: number = Y_THRESHOLD_DEFAULT): TextItem[][] {
  if (items.length === 0) return [];

  // Sort by Y descending (top to bottom in standard PDF coordinates after normalization)
  const sorted = [...items].sort((a, b) => {
    // Primary: Y coordinate (descending)
    if (Math.abs(b.y - a.y) > yThreshold) {
      return b.y - a.y;
    }
    // Tie-breaker: stable sort by original index
    return a.index - b.index;
  });

  const lines: TextItem[][] = [];
  let currentLine: TextItem[] = [];
  let lastY = sorted[0].y;

  for (const item of sorted) {
    // Start new line if Y distance exceeds threshold
    if (Math.abs(item.y - lastY) > yThreshold) {
      if (currentLine.length > 0) {
        lines.push(currentLine);
      }
      currentLine = [item];
      lastY = item.y;
    } else {
      currentLine.push(item);
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  // Ensure lines are ordered top-to-bottom by average Y coordinate
  lines.sort((a, b) => averageY(b) - averageY(a));

  return lines;
}

/**
 * Reconstruct a single line by sorting items by X coordinate and
 * joining with appropriate spacing to preserve columns.
 *
 * Algorithm:
 * 1. Sort items in line by X coordinate (left to right)
 * 2. Calculate spacing between consecutive items
 * 3. Use spacing to determine if items form columns (large gap) or continuous text (small gap)
 * 4. Join with space or pipe separator based on gap size
 */
function reconstructLine(items: TextItem[]): string {
  if (items.length === 0) return "";

  // Sort items left to right (by X coordinate)
  // Tie-breaker: stable sort by original index for determinism
  const sorted = [...items].sort((a, b) => {
    if (Math.abs(a.x - b.x) > 1) {
      return a.x - b.x;
    }
    return a.index - b.index;
  });

  const parts: string[] = [];
  let lastX = sorted[0].x;
  let lastWidth = sorted[0].width ?? 0;

  for (const item of sorted) {
    // Calculate gap between end of last item and start of current item
    const gap = item.x - (lastX + lastWidth);

    // Add spacing based on gap size
    if (parts.length > 0) {
      if (gap > COLUMN_GAP_THRESHOLD) {
        // Large gap (column separator) — use pipe for clarity
        parts.push(" | ");
      } else if (gap > WORD_GAP_THRESHOLD) {
        // Medium gap (word separator) — use single space
        parts.push(" ");
      } else if (gap > 0) {
        // Small gap (ligature/kerning) — no space
        // (item should be concatenated)
      }
      // gap <= 0: items overlap, no space
    }

    parts.push(item.str);
    lastX = item.x;
    lastWidth = item.width ?? 0;
  }

  return parts.join("");
}

async function extractPdf(buffer: Buffer): Promise<string> {
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;

  let text = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // Extract coordinate information from all items
    const items: TextItem[] = (content.items ?? [])
      .map((item: any, index: number) => extractCoordinates(item, index))
      .filter((item) => item.str.trim().length > 0); // Skip empty and whitespace-only items

    if (items.length === 0) {
      // Empty page
      text += "\n\n";
      continue;
    }

    // Group items by visual line (using improved Y threshold)
    const lines = groupByLine(items, Y_THRESHOLD_DEFAULT);

    // Reconstruct each line
    const pageText = lines.map((line) => reconstructLine(line)).join("\n");

    text += pageText + "\n\n";
  }

  const cleanedText = cleanText(text);

  // ── OCR Fallback: If pdfjs returns empty text (scanned PDF), try Google Vision OCR ──
  if (shouldTryOCR(cleanedText)) {
    console.log("[EXTRACTION] pdfjs extraction returned empty text (scanned PDF detected)");
    console.log("[EXTRACTION] Attempting Google Cloud Vision OCR fallback...");

    try {
      const ocrText = await runGoogleVisionOCR(buffer, "document.pdf");
      console.log("[EXTRACTION] ✅ OCR fallback successful");
      console.log("[EXTRACTION] pdfjs extraction length: 0");
      console.log("[EXTRACTION] OCR fallback length:", ocrText.length, "chars");
      return ocrText;
    } catch (ocrError) {
      const errorMsg = ocrError instanceof Error ? ocrError.message : String(ocrError);
      console.error("[EXTRACTION] ❌ OCR fallback failed:", errorMsg);
      // If OCR also fails, throw error (don't return empty string)
      throw new Error(
        `TEXT_EXTRACTION_FAILED: pdfjs returned empty text and OCR fallback failed: ${errorMsg}`
      );
    }
  }

  return cleanedText;
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return cleanText(result.value);
}

async function extractXlsx(buffer: Buffer): Promise<string> {

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  let text = "";

  workbook.eachSheet(sheet => {
    sheet.eachRow(row => {
      text += (row.values?.join(" ") ?? "") + "\n";
    });
  });

  return cleanText(text);
}

function extractPlain(buffer: Buffer): string {
  return cleanText(buffer.toString("utf-8"));
}

export async function extractDocumentContent(
  buffer: Buffer,
  filename: string
): Promise<string> {

  if (buffer.length > MAX_DOCUMENT_SIZE) {
    throw new Error(`Document too large: ${buffer.length}`);
  }

  console.log("[EXTRACT] Processing file:", filename);
  const ext = getFileExtension(filename);

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

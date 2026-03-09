import { Buffer } from "buffer";
import path from "path";
import mammoth from "mammoth";
import ExcelJS from "exceljs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.js";

const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024;

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
  const width = item.width ?? 0;
  const height = item.height ?? 0;

  return {
    str: item.str ?? "",
    x,
    y,
    width,
    height,
    index,
  };
}

/**
 * Group text items by visual line using Y coordinate clustering.
 * Items with similar Y values (within threshold) are grouped together.
 *
 * Algorithm:
 * 1. Sort items by Y descending (top to bottom)
 * 2. Group consecutive items with Y difference < threshold
 * 3. Return groups representing visual lines
 */
function groupByLine(items: TextItem[], yThreshold: number = 3): TextItem[][] {
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
 * 4. Join with space or tab based on gap size
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
      if (gap > 20) {
        // Large gap (column separator) — use multiple spaces/pipe for clarity
        parts.push(" | ");
      } else if (gap > 5) {
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
  const loadingTask = pdfjs.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;

  let text = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // Extract coordinate information from all items
    const items: TextItem[] = (content.items ?? [])
      .map((item: any, index: number) => extractCoordinates(item, index))
      .filter((item) => item.str.length > 0); // Skip empty items

    if (items.length === 0) {
      // Empty page
      text += "\n\n";
      continue;
    }

    // Group items by visual line
    const lines = groupByLine(items, 3); // 3-unit threshold for Y clustering

    // Reconstruct each line
    const pageText = lines.map((line) => reconstructLine(line)).join("\n");

    text += pageText + "\n\n";
  }

  return cleanText(text);
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

  const ext = path.extname(filename).toLowerCase();

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

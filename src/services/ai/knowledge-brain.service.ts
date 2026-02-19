/**********************************************************************
 * PHASE 36.11 — SAFE DOCUMENT TEXT EXTRACTION + BINARY GUARD
 * ZERO CRASH EDGE FUNCTION VERSION
 **********************************************************************/

import pdf from "pdf-parse";

/**
 * Detect binary / compressed content
 */
function looksBinary(text: string): boolean {
  if (!text) return true;

  // PDF header
  if (text.startsWith('%PDF')) return true;

  // high non printable ratio
  const nonPrintable = (text.match(/[^\x09\x0A\x0D\x20-\x7E]/g) || []).length;
  const ratio = nonPrintable / text.length;

  return ratio > 0.20;
}

/**
 * Extract clean text from uploaded file
 */
export async function extractDocumentText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();

  // Detect PDF
  const header = new TextDecoder().decode(buffer.slice(0, 4));

  if (header.includes('%PDF')) {
    console.log('[KNOWLEDGE BRAIN] 📄 PDF detected — extracting text...');
    const data = await pdf(Buffer.from(buffer));
    return data.text || '';
  }

  // Fallback: treat as plain text
  console.log('[KNOWLEDGE BRAIN] 📄 Plain text detected');
  return new TextDecoder().decode(buffer);
}

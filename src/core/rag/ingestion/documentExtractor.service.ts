/**
 * RAG — Document Extractor Service
 * Extracts readable text from documents (PDF or plain text).
 * Isolates all PDF.js logic.
 */

import { extractPdfText } from '@/lib/pdfExtract';
import { log, warn } from '@/lib/logger';

/**
 * Extract readable text from a File (PDF or plain text).
 * Never returns binary data.
 */
export async function extractDocumentText(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);

    const header = String.fromCharCode(
      uint8Array[0],
      uint8Array[1],
      uint8Array[2],
      uint8Array[3]
    );

    if (header === '%PDF') {
      log('[RAG:Extractor] 📄 PDF detected - extracting text...');
      try {
        const extractedText = await extractPdfText(file);
        log('[RAG:Extractor] ✅ PDF text extracted:', extractedText.length, 'chars');
        return extractedText;
      } catch (pdfError) {
        console.error('[RAG:Extractor] ❌ PDF parsing error:', pdfError);
        return '';
      }
    }

    log('[RAG:Extractor] 📝 Plain text file detected');
    const text = new TextDecoder().decode(uint8Array);
    log('[RAG:Extractor] ✅ Text decoded:', text.length, 'chars');
    return text;
  } catch (err) {
    console.error('[RAG:Extractor] ❌ Document extraction error:', err);
    return '';
  }
}

/**
 * Returns true if a chunk contains binary/non-printable data.
 */
export function isBinaryChunk(content: string): boolean {
  if (!content) return false;

  if (content.includes('%PDF')) {
    warn('[RAG:Extractor] Binary chunk skipped: PDF header detected');
    return true;
  }

  let nonPrintable = 0;
  for (let i = 0; i < content.length; i++) {
    const code = content.charCodeAt(i);
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      nonPrintable++;
    }
  }

  const ratio = nonPrintable / content.length;
  if (ratio > 0.2) {
    warn(`[RAG:Extractor] Binary chunk skipped: ${(ratio * 100).toFixed(1)}% non-printable`);
    return true;
  }

  return false;
}

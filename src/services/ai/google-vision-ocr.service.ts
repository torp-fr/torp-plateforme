/**
 * Google Cloud Vision OCR Service
 * Fallback for scanned PDFs and image-only documents
 *
 * Uses Google Cloud Vision API to extract text from images
 * when pdfjs returns empty text (e.g., scanned PDFs without embedded text)
 *
 * Caching: SHA-256 hash of the file buffer is used as cache key.
 * Results are stored in the `ocr_cache` table to avoid paying for the same
 * file twice (Google Vision: ~$1.50/1000 pages).
 */

import { createHash } from 'crypto';
import { supabase } from '@/lib/supabase';
import { log, warn, error as logError } from '@/lib/logger';

export interface GoogleVisionOCRResult {
  text: string;
  confidence: number;
  pages_processed: number;
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

/**
 * Compute SHA-256 hash of a Buffer (used as cache key).
 */
export function computeFileHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Look up the OCR result cache for a given file hash.
 * Returns the cached text or null if not found.
 */
async function getCachedOCR(fileHash: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('ocr_cache')
    .select('extracted_text, id')
    .eq('file_hash', fileHash)
    .single();

  if (error || !data) return null;

  // Update last_accessed_at for LRU-style eviction (best-effort)
  supabase
    .from('ocr_cache')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => undefined)
    .catch(() => undefined);

  log('[OCR:GoogleVision] ✅ Cache HIT for hash', fileHash.slice(0, 12) + '...');
  return data.extracted_text;
}

/**
 * Persist an OCR result to the cache table.
 */
async function saveCachedOCR(
  fileHash: string,
  result: GoogleVisionOCRResult,
  byteSize: number
): Promise<void> {
  const { error } = await supabase.from('ocr_cache').insert({
    file_hash:       fileHash,
    extracted_text:  result.text,
    confidence:      result.confidence,
    pages_processed: result.pages_processed,
    byte_size:       byteSize,
    created_at:      new Date().toISOString(),
    last_accessed_at: new Date().toISOString(),
  });

  if (error) {
    // Duplicate key = another process cached it concurrently — harmless
    if (!error.message?.includes('duplicate') && !error.message?.includes('unique')) {
      warn('[OCR:GoogleVision] Failed to write OCR cache:', error.message);
    }
  } else {
    log('[OCR:GoogleVision] ✅ Cached OCR result for hash', fileHash.slice(0, 12) + '...');
  }
}

// ── Main API ──────────────────────────────────────────────────────────────────

/**
 * Extract text from a PDF using Google Cloud Vision OCR.
 * Called when pdfjs returns empty text for scanned PDFs.
 *
 * Results are cached by SHA-256 hash of the input buffer to avoid
 * charging for the same document twice.
 */
export async function runGoogleVisionOCR(
  buffer: Buffer,
  filename?: string
): Promise<string> {
  log('[OCR:GoogleVision] 🔍 Starting Google Cloud Vision OCR');
  log('[OCR:GoogleVision] File size:', buffer.length, 'bytes');

  if (!buffer || buffer.length === 0) {
    throw new Error('OCR_FAILED: Empty buffer provided');
  }

  // ── Cache lookup ────────────────────────────────────────────────────────
  const fileHash = computeFileHash(buffer);
  const cached   = await getCachedOCR(fileHash);

  if (cached !== null) {
    return cached;
  }

  log('[OCR:GoogleVision] Cache MISS — calling Google Vision API');

  try {
    // Convert buffer to base64 for Vision API
    const base64Data = buffer.toString('base64');

    // Call Edge Function to handle Google Vision API
    // (Edge Functions have access to Google Cloud credentials via Supabase secrets)
    const { data, error: invokeError } = await supabase.functions.invoke(
      'google-vision-ocr',
      {
        body: {
          imageData: base64Data,
          mimeType:  'application/pdf',
          filename:  filename || 'document.pdf',
        },
      }
    );

    if (invokeError) {
      log('[OCR:GoogleVision] ❌ Edge Function error:', invokeError.message);
      throw new Error(`OCR_FAILED: ${invokeError.message}`);
    }

    if (!data || !data.text) {
      throw new Error('OCR_FAILED: No text extracted from Vision API');
    }

    const extractedText = data.text as string;
    log('[OCR:GoogleVision] ✅ OCR completed');
    log('[OCR:GoogleVision] Extracted text length:', extractedText.length, 'chars');
    log('[OCR:GoogleVision] Confidence:', data.confidence ?? 'N/A');

    // ── Persist to cache ──────────────────────────────────────────────────
    const ocrResult: GoogleVisionOCRResult = {
      text:            extractedText,
      confidence:      typeof data.confidence === 'number' ? data.confidence : 0.5,
      pages_processed: typeof data.pages_processed === 'number' ? data.pages_processed : 1,
    };

    // Fire-and-forget — don't block the caller on cache write
    saveCachedOCR(fileHash, ocrResult, buffer.length).catch(() => undefined);

    return extractedText;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log('[OCR:GoogleVision] ❌ OCR failed:', errorMsg);
    throw new Error(`OCR_FAILED: ${errorMsg}`);
  }
}

/**
 * Simple wrapper to check if OCR should be attempted
 * Returns true if text extraction seems to have failed
 */
export function shouldTryOCR(extractedText: string | null | undefined): boolean {
  return !extractedText || extractedText.trim().length === 0;
}

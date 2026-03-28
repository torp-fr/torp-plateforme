/**
 * Google Cloud Vision OCR Service
 * Fallback for scanned PDFs and image-only documents
 *
 * Uses Google Cloud Vision API to extract text from images
 * when pdfjs returns empty text (e.g., scanned PDFs without embedded text)
 */

import { supabase } from '@/lib/supabase';
import { log, warn, error as logError } from '@/lib/logger';

export interface GoogleVisionOCRResult {
  text: string;
  confidence: number;
  pages_processed: number;
}

/**
 * Extract text from a PDF using Google Cloud Vision OCR
 * Called when pdfjs returns empty text for scanned PDFs
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

  try {
    // Convert buffer to base64 for Vision API
    const base64Data = buffer.toString('base64');
    log('[OCR:GoogleVision] Buffer converted to base64');

    // Call Edge Function to handle Google Vision API
    // (Edge Functions have access to Google Cloud credentials via Supabase secrets)
    const { data, error: invokeError } = await supabase.functions.invoke(
      'google-vision-ocr',
      {
        body: {
          imageData: base64Data,
          mimeType: 'application/pdf',
          filename: filename || 'document.pdf',
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

    const extractedText = data.text;
    log('[OCR:GoogleVision] ✅ OCR completed');
    log('[OCR:GoogleVision] Extracted text length:', extractedText.length, 'chars');
    log('[OCR:GoogleVision] Confidence:', data.confidence ?? 'N/A');

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

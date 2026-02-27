/**
 * Centralized PDF.js Configuration
 * Handles worker setup, font configuration, and StrictMode safety
 *
 * ⚠️ CRITICAL: This must be initialized once at app startup
 */

import * as pdfjsLib from 'pdfjs-dist';

// Import worker as URL (Vite-compatible)
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Single initialization guard (StrictMode safe)
let isInitialized = false;

/**
 * Initialize PDF.js with proper worker and font configuration
 * Safe to call multiple times - only runs once
 */
export function initPdfJs() {
  // Guard against double initialization (important for React 18 StrictMode)
  if (isInitialized) {
    return;
  }

  try {
    // Configure worker source
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

    // Configure standard fonts URL
    // CRITICAL: This must point to actual font files
    // Hosting locally: /public/pdfjs-standard-fonts/
    pdfjsLib.GlobalWorkerOptions.standardFontDataUrl =
      '/pdfjs-standard-fonts/';

    isInitialized = true;

    if (import.meta.env.DEV) {
      console.log('✅ PDF.js initialized successfully');
      console.log('   - Worker:', pdfWorker);
      console.log('   - Fonts:', pdfjsLib.GlobalWorkerOptions.standardFontDataUrl);
    }
  } catch (error) {
    console.error('❌ PDF.js initialization failed:', error);
    throw new Error(
      'PDF.js initialization failed. Check worker and font paths.'
    );
  }
}

/**
 * Get configured PDF.js library
 * Only use after initPdfJs() has been called
 */
export function getPdfJs() {
  if (!isInitialized) {
    throw new Error(
      'PDF.js not initialized. Call initPdfJs() at app startup.'
    );
  }
  return pdfjsLib;
}

/**
 * PHASE 40: Verify PDF.js is properly initialized
 * Runtime guard to catch configuration issues before extraction
 * Returns detailed diagnostic information for production troubleshooting
 */
export function verifyPdfJsInitialization(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check 1: isInitialized flag
  if (!isInitialized) {
    errors.push('PDF.js initialization flag not set (initPdfJs not called)');
  }

  // Check 2: Worker source configured
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    errors.push('PDF.js worker source not configured');
  }

  // Check 3: Standard font data URL configured (CRITICAL FOR PRODUCTION)
  if (!pdfjsLib.GlobalWorkerOptions.standardFontDataUrl) {
    errors.push('PDF.js standardFontDataUrl not configured - will fail to extract fonts in PDFs');
  }

  // Check 4: Verify font URL is accessible (log for debugging)
  const fontUrl = pdfjsLib.GlobalWorkerOptions.standardFontDataUrl;
  if (fontUrl && import.meta.env.DEV) {
    console.log('[PDF.JS] Font URL configured:', fontUrl);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Reset initialization (testing only)
 */
export function resetPdfJs() {
  isInitialized = false;
}

export default pdfjsLib;

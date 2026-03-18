/**
 * Centralized PDF.js Configuration
 * Handles worker setup, font configuration, and StrictMode safety
 *
 * ⚠️ CRITICAL: This must be initialized once at app startup
 */

// Single initialization guard (StrictMode safe)
let isInitialized = false;
let pdfjsLib: any | null = null;

export async function loadPdfJs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsLib;
}

/**
 * Initialize PDF.js with proper worker and font configuration
 * Safe to call multiple times - only runs once
 */
export async function initPdfJs() {
  // Guard against double initialization (important for React 18 StrictMode)
  if (isInitialized) {
    return;
  }

  try {
    const lib = await loadPdfJs();

    // Configure worker source (browser/Vite only — ?url is a Vite-specific feature)
    try {
      const { default: pdfWorker } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url' as any);
      lib.GlobalWorkerOptions.workerSrc = pdfWorker;
    } catch {
      // Worker URL import not available in Node.js / non-Vite environments — safe to skip
    }

    // Configure standard fonts URL
    // CRITICAL: This must point to actual font files
    // Hosting locally: /public/pdfjs-standard-fonts/
    lib.GlobalWorkerOptions.standardFontDataUrl = '/pdfjs-standard-fonts/';

    isInitialized = true;

    if (import.meta.env?.DEV) {
      console.log('✅ PDF.js initialized successfully');
      console.log('   - Fonts:', lib.GlobalWorkerOptions.standardFontDataUrl);
    }
  } catch (error) {
    console.error('❌ PDF.js initialization failed:', error);
    // Don't throw - PDF features are optional and shouldn't crash the entire app
    isInitialized = true; // Mark as initialized to prevent repeated attempts
  }
}

/**
 * Get configured PDF.js library
 * Returns a Promise — caller must await
 */
export async function getPdfJs() {
  return await loadPdfJs();
}

/**
 * PHASE 40: Verify PDF.js is properly initialized
 * Runtime guard to catch configuration issues before extraction
 * Returns detailed diagnostic information for production troubleshooting
 */
export async function verifyPdfJsInitialization(): Promise<{ isValid: boolean; errors: string[] }> {
  const errors: string[] = [];
  const lib = await loadPdfJs();

  // Check 1: isInitialized flag
  if (!isInitialized) {
    errors.push('PDF.js initialization flag not set (initPdfJs not called)');
  }

  // Check 2: Worker source configured
  if (!lib.GlobalWorkerOptions.workerSrc) {
    errors.push('PDF.js worker source not configured');
  }

  // Check 3: Standard font data URL configured (CRITICAL FOR PRODUCTION)
  if (!lib.GlobalWorkerOptions.standardFontDataUrl) {
    errors.push('PDF.js standardFontDataUrl not configured - will fail to extract fonts in PDFs');
  }

  // Check 4: Verify font URL is accessible (log for debugging)
  const fontUrl = lib.GlobalWorkerOptions.standardFontDataUrl;
  if (fontUrl && import.meta.env?.DEV) {
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
  pdfjsLib = null;
}

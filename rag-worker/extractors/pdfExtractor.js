import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

// Note: Workers are browser-only. In Node.js, disable workers entirely.
// Workers cause "Setting up fake worker failed" errors in Node environments.

export async function extractPdfText(arrayBuffer) {
  try {
    // Convert ArrayBuffer to Uint8Array (required by pdfjs legacy build)
    const uint8Array = new Uint8Array(arrayBuffer);

    console.log(`  [PDF] Converting ArrayBuffer to Uint8Array for pdfjs`);
    console.log(`  [PDF] Uint8Array length: ${uint8Array.length} bytes`);

    // Disable workers for Node.js environment
    const loadingTask = pdfjs.getDocument({
      data: uint8Array,
      disableWorker: true,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    });
    const pdf = await loadingTask.promise;

    console.log(`  [PDF] ✅ PDF loaded successfully (${pdf.numPages} pages)`);

    let text = "";
    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex++) {
      const page = await pdf.getPage(pageIndex);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => item.str).join(" ");
      text += pageText + "\n\n";
    }

    const trimmed = text.replace(/\s+\n/g, "\n").trim();

    // Check if extraction returned meaningful text
    if (!trimmed || trimmed.length < 100) {
      console.warn(`  [PDF] Native extraction failed or returned too little text (${trimmed?.length || 0} chars)`);
      console.warn(`  [PDF] Triggering OCR fallback for scanned PDF`);

      // Return signal for OCR fallback
      return {
        text: "",
        pageCount: pdf.numPages,
        confidence: "native_failed",
        requiresOCR: true,
      };
    }

    console.log(`  [PDF] ✅ Extracted ${trimmed.length} characters from ${pdf.numPages} pages`);

    return {
      text: trimmed,
      pageCount: pdf.numPages,
      confidence: "native",
    };
  } catch (error) {
    console.error(`  [PDF] Native extraction failed: ${error.message}`);
    console.warn(`  [PDF] Triggering OCR fallback due to extraction error`);

    // Return signal for OCR fallback on error
    return {
      text: "",
      pageCount: 0,
      confidence: "native_error",
      requiresOCR: true,
      error: error.message,
    };
  }
}

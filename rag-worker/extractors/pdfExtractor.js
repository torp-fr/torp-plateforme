import pdf from "pdf-parse";
import { runGoogleVisionOCR, runOpenAIOCR } from "../services/ocrService.js";

// Minimum characters from native extraction before OCR is triggered.
// Scanned PDFs typically return 0-100 chars; a real text PDF returns thousands.
const MIN_NATIVE_CHARS = 1500;

export async function extractPdfText(arrayBuffer) {
  const buffer = Buffer.from(arrayBuffer);

  console.log(`  [PDF] Buffer size: ${buffer.length} bytes`);

  // ── Step 1: Native extraction via pdf-parse ─────────────────────────────

  let nativeText = "";
  let pageCount = 0;

  try {
    const data = await pdf(buffer);
    nativeText = (data.text || "").trim();
    pageCount = data.numpages || 0;
    console.log(`  [PDF] Native extraction: ${nativeText.length} chars, ${pageCount} pages`);
  } catch (nativeError) {
    console.warn(`  [PDF] Native extraction threw: ${nativeError.message}`);
    // Continue to OCR — do not rethrow
  }

  // ── Step 2: OCR fallback if native text is insufficient ─────────────────

  if (nativeText.length >= MIN_NATIVE_CHARS) {
    console.log(`  [PDF] ✅ Native extraction sufficient (${nativeText.length} chars)`);
    return {
      text: nativeText,
      pageCount,
      confidence: "native",
      requiresOCR: false,
    };
  }

  console.log(
    `  [PDF] Native extraction insufficient (${nativeText.length} chars < ${MIN_NATIVE_CHARS}) — switching to OCR`
  );

  // ── Step 2a: Google Vision ───────────────────────────────────────────────

  try {
    console.log("[OCR] Running Google Vision OCR");
    const ocrText = await runGoogleVisionOCR(buffer);
    console.log("[OCR] Google Vision OCR success");
    return {
      text: ocrText,
      pageCount,
      confidence: "google_ocr",
      requiresOCR: false,
      source: "google_ocr",
    };
  } catch (googleError) {
    console.warn(`  [PDF] Google Vision failed: ${googleError.message}`);
    console.log("[OCR] Falling back to OpenAI OCR");
  }

  // ── Step 2b: OpenAI Vision fallback ─────────────────────────────────────

  try {
    const ocrText = await runOpenAIOCR(buffer);
    console.log("[OCR] OpenAI Vision OCR success");
    return {
      text: ocrText,
      pageCount,
      confidence: "openai_ocr",
      requiresOCR: false,
      source: "openai_ocr",
    };
  } catch (openaiError) {
    console.error(`  [PDF] OpenAI Vision also failed: ${openaiError.message}`);
  }

  // ── Step 3: Both OCR providers failed ───────────────────────────────────

  console.error("  [PDF] All extraction methods failed — document will be skipped");
  return {
    text: "",
    pageCount,
    confidence: "all_failed",
    requiresOCR: true,
    error: "Native extraction and all OCR fallbacks failed",
  };
}

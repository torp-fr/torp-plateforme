/**
 * OCR Service — dual-provider fallback
 *
 * Provider chain:
 *   1. Google Vision (documentTextDetection on PNG images)
 *   2. OpenAI Vision (gpt-4.1-mini on PNG images)
 *
 * PDFs are converted to PNG images (up to MAX_PAGES pages) via pdftocairo.
 * Both functions accept a Node.js Buffer and return a plain string (all pages
 * concatenated in order).
 * All errors are thrown so the caller can handle the fallback chain.
 *
 * ── Poppler installation (required for pdftocairo) ───────────────────────────
 *
 * pdftocairo must be available in the Poppler bin dir before the worker can
 * convert PDFs to PNG.
 *
 * Windows — install via Chocolatey (recommended):
 *   choco install poppler -y
 *
 * Verify installation:
 *   pdftocairo -v
 *
 * If pdftocairo is not found, conversion will throw and OCR will fail.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import vision from "@google-cloud/vision";
import OpenAI from "openai";

const execFileAsync = promisify(execFile);

// Resolve Poppler bin dir relative to this file (rag-worker/services/ocrService.js).
// ../../tools/ → monorepo root / tools — correct regardless of launch directory.
// Override with POPPLER_PATH env var if needed.
import { fileURLToPath } from "url";
const __serviceDir = path.dirname(fileURLToPath(import.meta.url));
const POPPLER_PATH = process.env.POPPLER_PATH
  ? process.env.POPPLER_PATH
  : path.resolve(__serviceDir, "../../tools/poppler/poppler-25.12.0/Library/bin");

console.log("[OCR] Using Poppler path:", POPPLER_PATH);

// Maximum pages to OCR per document. Prevents memory explosion on 200+ page PDFs.
const MAX_PAGES = 20;

// ────────────────────────────────────────────────────────────────────────────
// PDF → PNG conversion (multi-page)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Convert up to MAX_PAGES pages of a PDF buffer to PNG Buffers.
 *
 * Writes a temporary PDF, runs pdftocairo to produce one PNG per page in a
 * unique temp subdirectory, then reads all PNGs back as Buffers.
 *
 * @param {Buffer} pdfBuffer
 * @returns {Promise<{ pdfPath: string, outDir: string, pages: Array<{ buffer: Buffer, imagePath: string }> }>}
 * @throws if pdftocairo is not found, conversion fails, or no PNGs are produced
 */
async function convertPdfToImages(pdfBuffer) {
  console.log("[TRACE] convertPdfToImages called");
  process.env.PATH = `${POPPLER_PATH};${process.env.PATH}`;

  const popplerBin = path.join(POPPLER_PATH, "pdftocairo.exe");
  if (!fs.existsSync(popplerBin)) {
    throw new Error(
      `[OCR] pdftocairo.exe not found at: ${popplerBin}\n` +
      `  Expected Poppler bin dir: ${POPPLER_PATH}\n` +
      `  Set POPPLER_PATH env var to override.`
    );
  }

  const tmpDir = os.tmpdir();
  const id = `ocr-${Date.now()}`;
  const pdfPath = path.join(tmpDir, `${id}.pdf`);

  // Unique subdirectory so readdirSync only finds our PNGs
  const outDir = path.join(tmpDir, id);
  fs.mkdirSync(outDir);

  // pdftocairo names output files as: <outputBase>-<N>.png
  const outputBase = path.join(outDir, "page");

  fs.writeFileSync(pdfPath, pdfBuffer);

  console.log(`[OCR] Converting PDF to PNG (up to ${MAX_PAGES} pages)...`);
  console.log("[OCR] Using Poppler path:", POPPLER_PATH);

  await execFileAsync(
    popplerBin,
    ["-png", "-f", "1", "-l", String(MAX_PAGES), pdfPath, outputBase]
  );

  // Read all generated PNGs, sorted numerically by page number (robust to
  // zero-padding differences across Poppler versions).
  const allFiles = fs.readdirSync(outDir)
    .filter(f => f.endsWith(".png"))
    .sort((a, b) => {
      const numA = parseInt(a.replace(/\D+/g, ""), 10);
      const numB = parseInt(b.replace(/\D+/g, ""), 10);
      return numA - numB;
    });

  if (allFiles.length === 0) {
    throw new Error(`[OCR] pdftocairo produced no PNG files in: ${outDir}`);
  }

  console.log(`[OCR] PDF → PNG: ${allFiles.length} page(s) generated`);

  const pages = allFiles.map(f => {
    const imagePath = path.join(outDir, f);
    return { buffer: fs.readFileSync(imagePath), imagePath };
  });

  return { pdfPath, outDir, pages };
}

// ────────────────────────────────────────────────────────────────────────────
// Google Vision OCR
// ────────────────────────────────────────────────────────────────────────────

/**
 * Run Google Vision documentTextDetection on a PDF buffer.
 * Converts up to MAX_PAGES pages to PNG and OCRs each in order.
 *
 * @param {Buffer} buffer - PDF buffer
 * @returns {Promise<string>} extracted text (all pages concatenated)
 * @throws if credentials missing, conversion fails, API fails, or no text detected
 */
export async function runGoogleVisionOCR(buffer) {
  console.log("[TRACE] runGoogleVisionOCR called");
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!raw) {
    throw new Error("[OCR] GOOGLE_SERVICE_ACCOUNT_JSON missing");
  }

  let credentials;
  try {
    credentials = JSON.parse(raw);

    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }

  } catch (e) {
    throw new Error("[OCR] Invalid GOOGLE_SERVICE_ACCOUNT_JSON");
  }

  console.log("[OCR TRACE] project:", credentials?.project_id);
  console.log("[OCR TRACE] Google Vision client init HERE");

  const visionClient = new vision.ImageAnnotatorClient({
    credentials: credentials,
    projectId: credentials.project_id,
  });

  console.log("[OCR DEBUG] Using multi-page OCR");
  const { pdfPath, outDir, pages } = await convertPdfToImages(buffer);
  console.log(`[OCR DEBUG] Pages generated: ${pages.length}`);

  console.log(`[OCR] Running Google Vision OCR on ${pages.length} page(s)`);

  const pageTexts = [];
  try {
    for (let i = 0; i < pages.length; i++) {
      let result;
      try {
        [result] = await visionClient.documentTextDetection({
          image: { content: pages[i].buffer },
        });
      } catch (err) {
        console.warn(`[OCR] Google Vision failed on page ${i + 1}: ${err.message}`);
        throw err;
      }

      const text = result.fullTextAnnotation?.text;
      const chars = text?.trim().length || 0;
      console.log(`[OCR] Page ${i + 1}/${pages.length}: ${chars} chars`);

      if (text && text.trim().length > 0) {
        pageTexts.push(text.trim());
      }
    }
  } finally {
    try { fs.unlinkSync(pdfPath); } catch (_) { /* non-critical */ }
    try { fs.rmSync(outDir, { recursive: true, force: true }); } catch (_) { /* non-critical */ }
  }

  if (pageTexts.length === 0) {
    throw new Error("[OCR] Google Vision returned no text");
  }

  const fullText = pageTexts.join("\n\n");
  console.log(`[OCR] Google Vision success: ${fullText.length} chars across ${pageTexts.length} page(s)`);

  return fullText;
}

// ────────────────────────────────────────────────────────────────────────────
// OpenAI Vision OCR
// ────────────────────────────────────────────────────────────────────────────

/**
 * Run OpenAI Vision OCR on a PDF buffer (gpt-4.1-mini).
 * Converts up to MAX_PAGES pages to PNG and OCRs each in order.
 *
 * @param {Buffer} buffer - PDF buffer
 * @returns {Promise<string>} extracted text (all pages concatenated)
 * @throws if API key missing, conversion fails, API fails, or no text returned
 */
export async function runOpenAIOCR(buffer) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("[OCR] OPENAI_API_KEY environment variable not set");
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  console.log("[OCR DEBUG] Using multi-page OCR");
  const { pdfPath, outDir, pages } = await convertPdfToImages(buffer);
  console.log(`[OCR DEBUG] Pages generated: ${pages.length}`);

  console.log(`[OCR] Falling back to OpenAI Vision on ${pages.length} page(s)`);

  const pageTexts = [];
  try {
    for (let i = 0; i < pages.length; i++) {
      const base64 = pages[i].buffer.toString("base64");

      let response;
      try {
        response = await openai.responses.create({
          model: "gpt-4.1-mini",
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: "Extract all readable text from this document.",
                },
                {
                  type: "input_image",
                  image_url: `data:image/png;base64,${base64}`,
                },
              ],
            },
          ],
        });
      } catch (err) {
        console.warn(`[OCR] OpenAI Vision failed on page ${i + 1}: ${err.message}`);
        throw err;
      }

      const text = response.output_text;
      const chars = text?.trim().length || 0;
      console.log(`[OCR] Page ${i + 1}/${pages.length}: ${chars} chars`);

      if (text && text.trim().length > 0) {
        pageTexts.push(text.trim());
      }
    }
  } finally {
    try { fs.unlinkSync(pdfPath); } catch (_) { /* non-critical */ }
    try { fs.rmSync(outDir, { recursive: true, force: true }); } catch (_) { /* non-critical */ }
  }

  if (pageTexts.length === 0) {
    throw new Error("[OCR] OpenAI Vision returned no text");
  }

  const fullText = pageTexts.join("\n\n");
  console.log(`[OCR] OpenAI Vision success: ${fullText.length} chars across ${pageTexts.length} page(s)`);

  return fullText;
}

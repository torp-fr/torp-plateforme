/**
 * OCR Service — dual-provider fallback
 *
 * Provider chain:
 *   1. Google Vision (documentTextDetection on PNG image)
 *   2. OpenAI Vision (gpt-4.1-mini on PNG image)
 *
 * PDFs are converted to a PNG image of the first page via pdf-poppler
 * (pure Node.js — no GraphicsMagick or Ghostscript required).
 * Both functions accept a Node.js Buffer and return a plain string.
 * All errors are thrown so the caller can handle the fallback chain.
 *
 * ── Poppler installation (required for pdf-poppler) ──────────────────────────
 *
 * pdf-poppler is a Node.js wrapper around the Poppler binary pdftoppm.
 * pdftoppm must be available in PATH before the worker can convert PDFs to PNG.
 *
 * Windows — install via Chocolatey (recommended):
 *   choco install poppler -y
 *
 * Windows — alternative via winget:
 *   winget install --id=GnuWin32.Poppler
 *
 * Verify installation:
 *   pdftoppm -v
 *
 * If pdftoppm is not found, pdf.convert() will throw and OCR will fail.
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

const POPPLER_PATH = path.resolve(
  process.cwd(),
  "..",
  "tools",
  "poppler",
  "poppler-25.12.0",
  "Library",
  "bin"
);

const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
const visionClient = new vision.ImageAnnotatorClient({ credentials });

// ────────────────────────────────────────────────────────────────────────────
// PDF → PNG conversion
// ────────────────────────────────────────────────────────────────────────────

/**
 * Convert the first page of a PDF buffer to a PNG Buffer.
 * Uses pdf-poppler (pure Node.js — no GraphicsMagick or Ghostscript).
 *
 * Writes a temporary PDF file, converts page 1 to PNG, reads the result.
 * Callers are responsible for deleting pdfPath and imagePath via try/finally.
 *
 * @param {Buffer} pdfBuffer
 * @returns {Promise<{ buffer: Buffer, pdfPath: string, imagePath: string }>}
 * @throws if conversion fails or the expected output file is not produced
 */
async function convertPdfToImage(pdfBuffer) {
  process.env.PATH = `${POPPLER_PATH};${process.env.PATH}`;

  const tmpDir = os.tmpdir();
  const id = `ocr-${Date.now()}`;
  const pdfPath = path.join(tmpDir, `${id}.pdf`);
  const outputBase = path.join(tmpDir, id);
  const imagePath = `${outputBase}.png`;

  fs.writeFileSync(pdfPath, pdfBuffer);

  console.log("[OCR] Converting PDF first page to PNG...");
  console.log("[OCR] Using Poppler path:", POPPLER_PATH);

  const conversionResult = await execFileAsync(
    path.join(POPPLER_PATH, "pdftocairo.exe"),
    ["-png", "-singlefile", "-f", "1", "-l", "1", pdfPath, outputBase]
  );

  console.log("[OCR] pdf-poppler conversion result:", conversionResult);

  if (!fs.existsSync(imagePath)) {
    throw new Error(`[OCR] pdftocairo did not produce output at: ${imagePath}`);
  }

  const buffer = fs.readFileSync(imagePath);

  console.log("[OCR] PDF → PNG conversion complete:", buffer.length, "bytes");

  return { buffer, pdfPath, imagePath };
}

// ────────────────────────────────────────────────────────────────────────────
// Google Vision OCR
// ────────────────────────────────────────────────────────────────────────────

/**
 * Run Google Vision documentTextDetection on a PDF buffer.
 * Converts the first page to PNG before sending to the API.
 *
 * @param {Buffer} buffer - PDF buffer
 * @returns {Promise<string>} extracted text
 * @throws if credentials missing, conversion fails, API fails, or no text detected
 */
export async function runGoogleVisionOCR(buffer) {
  const { buffer: imageBuffer, pdfPath, imagePath } = await convertPdfToImage(buffer);

  console.log("[OCR] Running Google Vision OCR");

  let result;
  try {
    [result] = await visionClient.documentTextDetection({
      image: { content: imageBuffer },
    });
  } catch (err) {
    console.warn("[OCR] Google Vision failed:", err.message);
    throw err;
  } finally {
    try { fs.unlinkSync(pdfPath); } catch (_) { /* non-critical */ }
    try { fs.unlinkSync(imagePath); } catch (_) { /* non-critical */ }
  }

  const text = result.fullTextAnnotation?.text;

  if (!text || text.trim().length === 0) {
    throw new Error("[OCR] Google Vision returned no text");
  }

  const trimmed = text.trim();
  console.log("[OCR] Google Vision success:", trimmed.length, "chars");

  return trimmed;
}

// ────────────────────────────────────────────────────────────────────────────
// OpenAI Vision OCR
// ────────────────────────────────────────────────────────────────────────────

/**
 * Run OpenAI Vision OCR on a PDF buffer (gpt-4.1-mini).
 * Converts the first page to PNG, encodes as base64 data URL.
 *
 * @param {Buffer} buffer - PDF buffer
 * @returns {Promise<string>} extracted text
 * @throws if API key missing, conversion fails, API fails, or no text returned
 */
export async function runOpenAIOCR(buffer) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("[OCR] OPENAI_API_KEY environment variable not set");
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const { buffer: imageBuffer, pdfPath, imagePath } = await convertPdfToImage(buffer);

  let response;
  try {
    const base64 = imageBuffer.toString("base64");

    console.log("[OCR] Falling back to OpenAI Vision");

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
  } finally {
    try { fs.unlinkSync(pdfPath); } catch (_) { /* non-critical */ }
    try { fs.unlinkSync(imagePath); } catch (_) { /* non-critical */ }
  }

  const text = response.output_text;

  if (!text || text.trim().length === 0) {
    throw new Error("[OCR] OpenAI Vision returned no text");
  }

  const trimmed = text.trim();
  console.log("[OCR] OpenAI Vision success:", trimmed.length, "chars");

  return trimmed;
}

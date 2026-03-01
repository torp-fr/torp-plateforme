import vision from "@google-cloud/vision";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function extractImageText(arrayBuffer, fileName) {
  try {
    // Create temporary file from arrayBuffer
    const tempDir = path.join(__dirname, "..", "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.join(tempDir, `ocr-${Date.now()}-${fileName}`);
    fs.writeFileSync(tempFilePath, Buffer.from(arrayBuffer));

    try {
      // Initialize Google Vision client with Service Account credentials
      const client = new vision.ImageAnnotatorClient();

      console.log(`  🔍 Running Google Vision OCR on ${fileName}...`);

      // Use documentTextDetection for better OCR results
      const [result] = await client.documentTextDetection(tempFilePath);
      const fullTextAnnotation = result.fullTextAnnotation;

      if (!fullTextAnnotation || !fullTextAnnotation.text) {
        throw new Error("No text detected in image");
      }

      const text = fullTextAnnotation.text.trim();

      if (!text || text.length === 0) {
        throw new Error("Image OCR returned empty text");
      }

      console.log(`  ✅ Google Vision OCR completed (${text.length} chars)`);

      return {
        text: text,
        confidence: "ocr",
        detections: fullTextAnnotation.pages?.length || 1,
      };
    } finally {
      // Clean up temporary file
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.warn(`⚠️ Failed to clean up temp file: ${cleanupError.message}`);
      }
    }
  } catch (error) {
    throw new Error(`Image OCR failed: ${error.message}`);
  }
}

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

    // Sanitize filename to prevent ENOENT path errors (remove directory components)
    const safeFileName = path.basename(fileName);

    const tempFilePath = path.join(tempDir, `ocr-${Date.now()}-${safeFileName}`);
    fs.writeFileSync(tempFilePath, Buffer.from(arrayBuffer));

    try {
      // Initialize Google Vision client with Service Account credentials
      const client = new vision.ImageAnnotatorClient();

      console.log(`  🔍 Running Google Vision OCR on ${fileName}...`);

      // Use textDetection for OCR results
      const [result] = await client.textDetection(tempFilePath);
      const text = result.textAnnotations?.[0]?.description;

      if (!text || text.trim().length === 0) {
        throw new Error("No text detected in image");
      }

      const trimmedText = text.trim();

      console.log(`  ✅ Google Vision OCR completed (${trimmedText.length} chars)`);

      return {
        text: trimmedText,
        confidence: "ocr",
        detections: result.textAnnotations?.length || 0,
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

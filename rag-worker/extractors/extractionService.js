import { extractPdfText } from "./pdfExtractor.js";
import { extractDocxText } from "./wordExtractor.js";
import { extractXlsxText } from "./excelExtractor.js";
import { extractImageText } from "./visionExtractor.js";

const MIME_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
};

export async function extractDocumentText(arrayBuffer, fileName, mimeType) {
  console.log("[TRACE] extractDocumentText called");
  console.log(`  📋 Extracting text from: ${fileName}`);

  const fileExt = getFileExtension(fileName).toLowerCase();
  const normalizedMimeType = (mimeType || "").toLowerCase();

  // PDF: native extraction → Google Vision OCR → OpenAI OCR (all handled inside pdfExtractor)
  if (
    fileExt === "pdf" ||
    normalizedMimeType === MIME_TYPES.pdf
  ) {
    console.log("[TRACE] PDF branch → extractPdfText");
    console.log(`  📄 PDF detected - attempting native extraction...`);

    const result = await extractPdfText(arrayBuffer);

    // pdfExtractor handles all OCR internally — return result directly.
    // requiresOCR: true means all providers failed; worker will mark document as failed.
    return result;
  }

  // DOCX
  if (
    fileExt === "docx" ||
    normalizedMimeType === MIME_TYPES.docx
  ) {
    console.log(`  📘 DOCX detected`);
    return await extractDocxText(arrayBuffer);
  }

  // XLSX
  if (
    fileExt === "xlsx" ||
    normalizedMimeType === MIME_TYPES.xlsx
  ) {
    console.log(`  📊 XLSX detected`);
    return await extractXlsxText(arrayBuffer);
  }

  // Images
  if (
    ["jpg", "jpeg", "png"].includes(fileExt) ||
    ["image/jpeg", "image/png"].includes(normalizedMimeType)
  ) {
    console.log(`  🖼️ Image detected - using OCR`);
    try {
      return await extractImageText(arrayBuffer, fileName);
    } catch (imgError) {
      console.warn(`  [OCR] Image extraction failed, skipping: ${imgError.message}`);
      return { text: "", confidence: "ocr_failed", skipped: true, reason: imgError.message };
    }
  }

  // Plain text
  if (
    fileExt === "txt" ||
    normalizedMimeType === MIME_TYPES.txt
  ) {
    console.log(`  📝 Text file detected`);
    const uint8Array = new Uint8Array(arrayBuffer);
    const text = new TextDecoder().decode(uint8Array);

    if (!text || text.trim().length === 0) {
      throw new Error("Text extraction returned empty content");
    }

    return {
      text: text.trim(),
      confidence: "native",
    };
  }

  throw new Error(
    `Unsupported file format: ${fileExt} (MIME: ${mimeType})`
  );
}

function getFileExtension(fileName) {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

export function detectSourceType(mimeType, fileName) {
  const fileExt = getFileExtension(fileName).toLowerCase();
  const normalizedMimeType = (mimeType || "").toLowerCase();

  if (fileExt === "pdf" || normalizedMimeType === MIME_TYPES.pdf) {
    return "pdf";
  }
  if (fileExt === "docx" || normalizedMimeType === MIME_TYPES.docx) {
    return "docx";
  }
  if (fileExt === "xlsx" || normalizedMimeType === MIME_TYPES.xlsx) {
    return "xlsx";
  }
  if (
    ["jpg", "jpeg", "png"].includes(fileExt) ||
    ["image/jpeg", "image/png"].includes(normalizedMimeType)
  ) {
    return "image_ocr";
  }
  if (fileExt === "txt" || normalizedMimeType === MIME_TYPES.txt) {
    return "text";
  }

  return "unknown";
}

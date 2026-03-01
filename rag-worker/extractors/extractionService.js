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
  console.log(`  📋 Extracting text from: ${fileName}`);

  const fileExt = getFileExtension(fileName).toLowerCase();
  const normalizedMimeType = (mimeType || "").toLowerCase();

  // PDF with fallback to Vision OCR
  if (
    fileExt === "pdf" ||
    normalizedMimeType === MIME_TYPES.pdf
  ) {
    console.log(`  📄 PDF detected - attempting native extraction...`);
    try {
      const result = await extractPdfText(arrayBuffer);

      if (result.text.trim().length < 500) {
        console.log(
          `  ⚠️ PDF extraction too short (${result.text.length} chars) - falling back to OCR`
        );
        return await extractImageText(arrayBuffer, fileName);
      }

      return result;
    } catch (error) {
      console.log(
        `  ⚠️ PDF native extraction failed: ${error.message} - falling back to OCR`
      );
      return await extractImageText(arrayBuffer, fileName);
    }
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
    return await extractImageText(arrayBuffer, fileName);
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

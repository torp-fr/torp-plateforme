import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { fileURLToPath } from "url";
import path from "path";

// Configure worker for Node.js ESM environment
const __dirname = path.dirname(fileURLToPath(import.meta.url));
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/legacy/build/pdf.worker.mjs",
  import.meta.url
).toString();

export async function extractPdfText(arrayBuffer) {
  try {
    const buffer = Buffer.from(arrayBuffer);
    const loadingTask = pdfjs.getDocument({ data: buffer });
    const pdf = await loadingTask.promise;

    let text = "";
    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex++) {
      const page = await pdf.getPage(pageIndex);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => item.str).join(" ");
      text += pageText + "\n\n";
    }

    const trimmed = text.replace(/\s+\n/g, "\n").trim();

    if (!trimmed) {
      throw new Error("PDF extraction returned empty text");
    }

    return {
      text: trimmed,
      pageCount: pdf.numPages,
      confidence: "native",
    };
  } catch (error) {
    throw new Error(`PDF extraction failed: ${error.message}`);
  }
}

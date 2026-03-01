import pdf from "pdf-parse";

export async function extractPdfText(arrayBuffer) {
  try {
    const buffer = Buffer.from(arrayBuffer);
    const pdfData = await pdf(buffer);
    const text = pdfData.text || "";

    if (!text || text.trim().length === 0) {
      throw new Error("PDF extraction returned empty text");
    }

    return {
      text: text.trim(),
      pageCount: pdfData.numpages,
      confidence: "native",
    };
  } catch (error) {
    throw new Error(`PDF extraction failed: ${error.message}`);
  }
}

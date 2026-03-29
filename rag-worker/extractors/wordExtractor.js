import mammoth from "mammoth";

export async function extractDocxText(arrayBuffer) {
  try {
    const buffer = Buffer.from(arrayBuffer);
    const result = await mammoth.extractRawText({ buffer });

    const text = result.value || "";

    if (!text || text.trim().length === 0) {
      throw new Error("DOCX extraction returned empty text");
    }

    return {
      text: text.trim(),
      warnings: result.messages || [],
      confidence: "native",
    };
  } catch (error) {
    throw new Error(`DOCX extraction failed: ${error.message}`);
  }
}

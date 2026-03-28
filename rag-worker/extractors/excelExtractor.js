import XLSX from "xlsx";

export async function extractXlsxText(arrayBuffer) {
  try {
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: "buffer" });

    let fullText = "";
    const sheets = [];

    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const csvData = XLSX.utils.sheet_to_csv(worksheet);
      fullText += `\n\n=== Sheet: ${sheetName} ===\n${csvData}`;
      sheets.push(sheetName);
    });

    if (!fullText || fullText.trim().length === 0) {
      throw new Error("XLSX extraction returned empty text");
    }

    return {
      text: fullText.trim(),
      sheetCount: sheets.length,
      sheets,
      confidence: "native",
    };
  } catch (error) {
    throw new Error(`XLSX extraction failed: ${error.message}`);
  }
}

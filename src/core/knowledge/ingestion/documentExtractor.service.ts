import { Buffer } from "buffer";
import path from "path";
import mammoth from "mammoth";
import ExcelJS from "exceljs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.js";

const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024;

function cleanText(text: string): string {
  return text
    .replace(/\f/g, "\n\n")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

async function extractPdf(buffer: Buffer): Promise<string> {

  const loadingTask = pdfjs.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;

  let text = "";

  for (let i = 1; i <= pdf.numPages; i++) {

    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    const strings = content.items.map((item: any) => item.str);

    text += strings.join(" ") + "\n\n";
  }

  return cleanText(text);
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return cleanText(result.value);
}

async function extractXlsx(buffer: Buffer): Promise<string> {

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  let text = "";

  workbook.eachSheet(sheet => {
    sheet.eachRow(row => {
      text += (row.values?.join(" ") ?? "") + "\n";
    });
  });

  return cleanText(text);
}

function extractPlain(buffer: Buffer): string {
  return cleanText(buffer.toString("utf-8"));
}

export async function extractDocumentContent(
  buffer: Buffer,
  filename: string
): Promise<string> {

  if (buffer.length > MAX_DOCUMENT_SIZE) {
    throw new Error(`Document too large: ${buffer.length}`);
  }

  const ext = path.extname(filename).toLowerCase();

  switch (ext) {

    case ".pdf":
      return extractPdf(buffer);

    case ".docx":
      return extractDocx(buffer);

    case ".xlsx":
    case ".xls":
      return extractXlsx(buffer);

    case ".txt":
    case ".md":
    case ".csv":
      return extractPlain(buffer);

    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

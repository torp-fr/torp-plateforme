/**
 * Test: pdfjs-dist PDF extraction
 *
 * Downloads a PDF from Supabase Storage and extracts text
 * using pdfjs-dist/legacy/build/pdf.mjs
 *
 * Usage:
 *   npx tsx scripts/testPdfJs.ts
 *   npx tsx scripts/testPdfJs.ts <document_id>
 */

import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
import { Buffer } from "buffer"
import * as pdfjsLib from "pdfjs-dist"

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise

  let fullText = ""

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .map((item: any) => item.str || "")
      .join(" ")
    fullText += pageText + "\n"
  }

  return fullText
}

async function main() {
  console.log("PDFJS-DIST TEST STARTED")

  const targetId = process.argv[2] ?? null
  let doc: any

  if (targetId) {
    console.log("Fetching specific document:", targetId)
    const { data, error } = await supabase
      .from("knowledge_documents")
      .select("id,title,file_path,mime_type")
      .eq("id", targetId)
      .single()

    if (error || !data) {
      console.error("Document not found:", error?.message)
      return
    }

    doc = data
  } else {
    console.log("Fetching most recent PDF document")
    const { data, error } = await supabase
      .from("knowledge_documents")
      .select("id,title,file_path,mime_type")
      .not("file_path", "is", null)
      .like("file_path", "%.pdf")
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      console.error("No PDF document found:", error?.message)
      return
    }

    doc = data
  }

  console.log("\nDocument:")
  console.log("  id:", doc.id)
  console.log("  title:", doc.title)
  console.log("  path:", doc.file_path)

  console.log("\nDownloading file from storage...")
  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from("knowledge-files")
    .download(doc.file_path)

  if (downloadError || !fileBlob) {
    console.error("Download failed:", downloadError?.message)
    return
  }

  const arrayBuffer = await fileBlob.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  console.log(`Downloaded ${buffer.length} bytes`)

  console.log("\nExtracting text with pdfjs-dist...")
  try {
    const text = await extractTextFromPdf(buffer)
    console.log(`PDF pages: ${text.split("\n").filter(l => l.trim()).length}`)
    console.log(`Text length: ${text.length}`)
    console.log("\nFirst 300 characters:")
    console.log(text.slice(0, 300))
  } catch (err: any) {
    console.error("Extraction failed:", err.message)
    return
  }

  console.log("\nTEST COMPLETED")
}

main().catch(err => {
  console.error("TEST FAILED:", err)
})

/**
 * Test: PDF Extraction with Coordinate-Aware Reconstruction
 *
 * Demonstrates the improved PDF text extraction that preserves
 * table structure using item coordinates.
 *
 * Usage:
 *   npx tsx scripts/testPdfExtraction.ts
 */

import "dotenv/config"
import { createClient } from "@supabase/supabase-js"
import { extractDocumentContent } from "../src/core/knowledge/ingestion/documentExtractor.service"

// Validate required environment variables
console.log("[ENV] Validating Supabase configuration...")
console.log("[ENV] SUPABASE_URL:", process.env.SUPABASE_URL ? "✅" : "❌")
console.log(
  "[ENV] SERVICE_ROLE_KEY:",
  process.env.SUPABASE_SERVICE_ROLE_KEY
    ? "✅ " + process.env.SUPABASE_SERVICE_ROLE_KEY.slice(0, 10) + "..."
    : "❌"
)

if (!process.env.SUPABASE_URL) {
  throw new Error("❌ SUPABASE_URL environment variable is not set")
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("❌ SUPABASE_SERVICE_ROLE_KEY environment variable is not set")
}

console.log("[ENV] ✅ Environment validation passed\n")

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log("PDF EXTRACTION TEST STARTED\n")

  // Fetch a PDF document from Supabase
  const { data: docs, error: fetchError } = await supabase
    .from("knowledge_documents")
    .select("id,title,file_path,mime_type")
    .like("file_path", "%.pdf")
    .limit(1)
    .single()

  if (fetchError || !docs) {
    console.error("No PDF document found in knowledge_documents")
    return
  }

  console.log("Document:", docs.title)
  console.log("File path:", docs.file_path)
  console.log("")

  // Download PDF from storage (matches worker implementation)
  console.log("[DOWNLOAD] Starting file download from Supabase Storage...")
  console.log("[DOWNLOAD] bucket:", "documents")
  console.log("[DOWNLOAD] path:", docs.file_path)

  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from("documents")
    .download(docs.file_path)

  if (downloadError) {
    console.error("[DOWNLOAD ERROR]", downloadError)
    const errDetail =
      downloadError?.message ||
      (downloadError && typeof downloadError === "object"
        ? JSON.stringify(downloadError)
        : String(downloadError)) ||
      "unknown error"
    console.error("[DOWNLOAD ERROR] detail:", errDetail)
    throw new Error(`Storage download failed: ${errDetail}`)
  }

  if (!fileBlob) {
    console.error("[DOWNLOAD ERROR] Download returned null data")
    throw new Error("Download returned null data (file not found or inaccessible)")
  }

  const arrayBuffer = await fileBlob.arrayBuffer()

  console.log("[BUFFER] Conversion complete")
  console.log("[BUFFER] byteLength:", arrayBuffer.byteLength)

  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    console.error("[BUFFER ERROR] ArrayBuffer is empty or invalid")
    throw new Error("Downloaded file buffer is empty")
  }

  const buffer = Buffer.from(arrayBuffer)
  console.log("[DOWNLOAD] ✅ Downloaded and validated", buffer.length, "bytes\n")

  // Extract text using improved coordinate-aware algorithm
  console.log("Extracting text with coordinate-aware reconstruction...")
  let text: string

  try {
    text = await extractDocumentContent(buffer, docs.file_path)
  } catch (err: any) {
    console.error("Extraction failed:", err.message)
    return
  }

  console.log("Extracted:", text.length, "characters")
  console.log("")

  // Display sample of extracted text
  console.log("==============================")
  console.log("EXTRACTED TEXT (first 1000 chars)")
  console.log("==============================")
  console.log(text.slice(0, 1000))
  console.log("==============================")
  console.log("")

  // Analysis of structure
  const lines = text.split("\n")
  const tableLines = lines.filter(l => l.includes(" | "))
  const avgLineLength = lines.reduce((sum, l) => sum + l.length, 0) / lines.length

  console.log("Analysis:")
  console.log("  Total lines:", lines.length)
  console.log("  Lines with table structure (|):", tableLines.length)
  console.log("  Average line length:", avgLineLength.toFixed(1), "chars")
  console.log("")

  if (tableLines.length > 0) {
    console.log("Sample table lines:")
    tableLines.slice(0, 3).forEach((line, i) => {
      console.log(`  [${i + 1}] ${line}`)
    })
  }

  console.log("")
  console.log("TEST COMPLETED")
}

main().catch(err => {
  console.error("TEST FAILED:", err)
})

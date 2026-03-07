/**
 * Test: Document Text Extraction
 *
 * Downloads the most recently uploaded knowledge document from Supabase
 * Storage, extracts its text, and prints the first 500 characters.
 *
 * Usage:
 *   npx tsx scripts/testDocumentExtraction.ts
 *   npx tsx scripts/testDocumentExtraction.ts <document_id>
 */

console.log("DOCUMENT EXTRACTION TEST LOADED")

import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
import { Buffer } from "buffer"
import { extractDocumentContent } from "../src/core/knowledge/ingestion/documentExtractor.service"

dotenv.config()

console.log("DOCUMENT EXTRACTION TEST STARTED")

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("MAIN FUNCTION RUNNING")

  // If a document ID was passed as CLI arg, fetch that document.
  // Otherwise, pick the most recently uploaded pending/failed document.
  const targetId = process.argv[2] ?? null

  let doc: any

  if (targetId) {
    console.log(`Looking up document: ${targetId}`)
    const { data, error } = await supabase
      .from("knowledge_documents")
      .select("id, title, file_path, mime_type, ingestion_status")
      .eq("id", targetId)
      .single()

    if (error || !data) {
      console.error("Document not found:", error?.message)
      return
    }
    doc = data
  } else {
    console.log("Fetching most recent document with a file_path…")
    const { data, error } = await supabase
      .from("knowledge_documents")
      .select("id, title, file_path, mime_type, ingestion_status")
      .not("file_path", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      console.error("No document found:", error?.message)
      return
    }
    doc = data
  }

  console.log("\n==============================")
  console.log("  DOCUMENT")
  console.log("==============================")
  console.log("id:      ", doc.id)
  console.log("title:   ", doc.title)
  console.log("status:  ", doc.ingestion_status)
  console.log("path:    ", doc.file_path)
  console.log("mime:    ", doc.mime_type)
  console.log("==============================\n")

  if (!doc.file_path) {
    console.error("Document has no file_path — cannot download")
    return
  }

  // ── Step 1: Download from Supabase Storage ──────────────────────────────
  console.log("STEP 1: downloading file from storage")
  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from("knowledge-files")
    .download(doc.file_path)

  if (downloadError || !fileBlob) {
    console.error("Download failed:", downloadError?.message ?? "no data")
    return
  }

  const arrayBuffer = await fileBlob.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  console.log(`Downloaded ${buffer.length} bytes`)

  // ── Step 2: Extract text ────────────────────────────────────────────────
  console.log("STEP 2: extracting text")
  const filename = doc.file_path.split("/").pop() ?? doc.title ?? "document"

  let rawText: string
  try {
    rawText = await extractDocumentContent(buffer, filename)
  } catch (err: any) {
    console.error("Extraction failed:", err.message)
    return
  }

  console.log(`Extracted ${rawText.length} characters`)

  // ── Step 3: Print first 500 chars ──────────────────────────────────────
  console.log("\n==============================")
  console.log("  EXTRACTED TEXT (first 500 chars)")
  console.log("==============================")
  console.log(rawText.slice(0, 500))
  console.log("==============================\n")

  console.log("SCRIPT COMPLETED")
}

main().catch(err => {
  console.error("SCRIPT FAILED:", err)
})

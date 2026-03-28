/**
 * Test: PDF Extraction via rag-worker extractor (pdf-parse)
 *
 * Downloads a document from Supabase Storage and runs it through
 * the production extractor used by the RAG worker.
 *
 * Usage:
 *   npx tsx scripts/testPdfExtraction.ts <storage_path>
 *
 * Example:
 *   npx tsx scripts/testPdfExtraction.ts knowledge-documents/1773604173269-713532582-DTU-31-3-P2-Charpente-en-Bois-Assemblees-Par-Connecteurs-Metalliques-Ou-Goussets-CCS.pdf
 */

import "../rag-worker/config/loadEnv.js";
import { createClient } from "@supabase/supabase-js"
import { extractPdfText } from "../rag-worker/extractors/pdfExtractor.js"

async function main() {
  const filePath = process.argv[2]

  if (!filePath) {
    console.error("Usage: npx tsx scripts/testPdfExtraction.ts <storage_path>")
    console.error("")
    console.error("Example:")
    console.error("  npx tsx scripts/testPdfExtraction.ts knowledge-documents/my-doc.pdf")
    process.exit(1)
  }

  // Validate env
  console.log("[ENV] Validating Supabase configuration...")
  console.log("[ENV] SUPABASE_URL:", process.env.SUPABASE_URL ? "✅" : "❌")
  console.log(
    "[ENV] SERVICE_ROLE_KEY:",
    process.env.SUPABASE_SERVICE_ROLE_KEY
      ? "✅ " + process.env.SUPABASE_SERVICE_ROLE_KEY.slice(0, 10) + "..."
      : "❌"
  )

  if (!process.env.SUPABASE_URL) {
    throw new Error("SUPABASE_URL environment variable is not set")
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is not set")
  }

  console.log(
    "[ENV] GOOGLE_SERVICE_ACCOUNT_JSON:",
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON
      ? "✅ loaded (" + process.env.GOOGLE_SERVICE_ACCOUNT_JSON.length + " chars)"
      : "❌ missing"
  )
  console.log("[ENV] ✅ Environment validation passed")
  console.log("")

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // Download from Supabase Storage
  console.log("PDF EXTRACTION TEST")
  console.log("===================")
  console.log("Bucket:     ", "documents")
  console.log("Storage path:", filePath)
  console.log("")

  console.log("[DOWNLOAD] Downloading from Supabase Storage...")

  const { data, error } = await supabase.storage
    .from("documents")
    .download(filePath)

  if (error) {
    const detail =
      error.message ||
      (typeof error === "object" ? JSON.stringify(error) : String(error))
    console.error("[DOWNLOAD ERROR]", detail)
    throw new Error(`Storage download failed: ${detail}`)
  }

  if (!data) {
    throw new Error("Download returned null (file not found or inaccessible)")
  }

  const arrayBuffer = await data.arrayBuffer()

  console.log("[DOWNLOAD] ✅ Downloaded", arrayBuffer.byteLength, "bytes")
  console.log("")

  if (arrayBuffer.byteLength === 0) {
    throw new Error("Downloaded file is empty (0 bytes)")
  }

  // Run extraction through the rag-worker extractor
  console.log("Running extractPdfText()...")
  console.log("")

  const result = await extractPdfText(arrayBuffer)

  // Diagnostics
  console.log("===================")
  console.log("RESULTS")
  console.log("===================")
  console.log("Pages:       ", result.pageCount ?? "n/a")
  console.log("Text length: ", result.text?.length ?? 0)
  console.log("Confidence:  ", result.confidence ?? "n/a")
  console.log("Requires OCR:", result.requiresOCR)
  if (result.error) {
    console.log("Error:       ", result.error)
  }
  console.log("")

  if (result.text && result.text.length > 0) {
    console.log("===================")
    console.log("PREVIEW (first 500 chars)")
    console.log("===================")
    console.log(result.text.slice(0, 500))
    console.log("===================")
  } else {
    console.warn("No text extracted.")
    if (result.requiresOCR) {
      console.warn("Document flagged for OCR fallback.")
    }
  }

  console.log("")
  console.log("TEST COMPLETED")
}

main().catch(err => {
  console.error("TEST FAILED:", err.message || err)
  process.exit(1)
})
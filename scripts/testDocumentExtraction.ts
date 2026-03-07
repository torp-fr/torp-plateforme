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

async function main() {
  console.log("MAIN FUNCTION RUNNING")

  const targetId = process.argv[2] ?? null
  let doc: any

  if (targetId) {
    console.log("Fetching specific document:", targetId)
    const { data, error } = await supabase
      .from("knowledge_documents")
      .select("id,title,file_path,mime_type,ingestion_status")
      .eq("id", targetId)
      .single()

    if (error || !data) {
      console.error("Document not found:", error?.message)
      return
    }

    doc = data
  } else {
    console.log("Fetching most recent document with file_path")
    const { data, error } = await supabase
      .from("knowledge_documents")
      .select("id,title,file_path,mime_type,ingestion_status")
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

  console.log("")
  console.log("==============================")
  console.log("DOCUMENT")
  console.log("==============================")

  console.log("id:", doc.id)
  console.log("title:", doc.title)
  console.log("status:", doc.ingestion_status)
  console.log("path:", doc.file_path)
  console.log("mime:", doc.mime_type)

  console.log("==============================")
  console.log("")

  if (!doc.file_path) {
    console.error("Document has no file_path")
    return
  }

  console.log("STEP 1: downloading file from storage")

  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from("knowledge-files")
    .download(doc.file_path)

  if (downloadError || !fileBlob) {
    console.error("Download failed:", downloadError?.message)
    return
  }

  const arrayBuffer = await fileBlob.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  console.log("Downloaded", buffer.length, "bytes")

  console.log("STEP 2: extracting text")

  const filename = doc.file_path.split("/").pop() ?? "document"
  let text: string

  try {
    text = await extractDocumentContent(buffer, filename)
  } catch (err: any) {
    console.error("Extraction failed:", err.message)
    return
  }

  console.log("Extracted", text.length, "characters")

  console.log("")
  console.log("==============================")
  console.log("EXTRACTED TEXT (first 500 chars)")
  console.log("==============================")

  console.log(text.slice(0, 500))

  console.log("==============================")
  console.log("")

  console.log("SCRIPT COMPLETED")
}

main().catch(err => {
  console.error("SCRIPT FAILED:", err)
})

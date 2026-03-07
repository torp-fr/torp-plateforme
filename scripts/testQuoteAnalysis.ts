console.log("QUOTE ANALYSIS SCRIPT LOADED")

import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"

dotenv.config()

console.log("QUOTE ANALYSIS SCRIPT STARTED")

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

const quoteItem = {
  description: "Poteau béton 30x30",
  price: 450,
  unit: "ml"
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a French-formatted price string to a float.
 * Handles "225,00", "1.250,00", "1 250,00".
 * Returns null if the value is not a valid number.
 */
function parsePrice(raw: string): number | null {
  // Remove spaces used as thousands separator, remove dot thousands separator,
  // then replace comma decimal separator with a dot.
  const normalized = raw.trim().replace(/\s/g, "").replace(/\.(?=\d{3})/g, "").replace(",", ".")
  const n = parseFloat(normalized)
  return isNaN(n) ? null : n
}

/**
 * Extract the price value from a chunk's content.
 *
 * Priority order:
 *  1. 4th column of a pipe-delimited price row: | code | desc | unit | price |
 *  2. Any standalone decimal number with comma in the text (fallback)
 *
 * Returns null if no numeric price could be found.
 */
function extractPriceFromContent(content: string): number | null {
  // Try structured price line: | code | description | unit | price |
  const pipeMatch = /^\|\s*[\d.]+\s*\|[^|]+\|[^|]{1,15}\|\s*([\d][\d\s.,]*)\s*\|/m.exec(content)
  if (pipeMatch) {
    return parsePrice(pipeMatch[1])
  }

  // Fallback: find a number like 225,00 or 1.250,00 in plain text
  const numMatch = /\b(\d[\d\s.]*,\d{2})\b/.exec(content)
  if (numMatch) {
    return parsePrice(numMatch[1])
  }

  return null
}

/**
 * Compute risk level from percentage difference.
 *   diff >= 50 %  → HIGH
 *   diff >= 20 %  → MEDIUM
 *   otherwise     → LOW
 */
function riskLevel(diffPercent: number): string {
  const abs = Math.abs(diffPercent)
  if (abs >= 50) return "HIGH"
  if (abs >= 20) return "MEDIUM"
  return "LOW"
}

/**
 * Format a signed percentage for display: "+100 %" / "-12 %"
 */
function fmtDiff(diffPercent: number): string {
  const sign = diffPercent >= 0 ? "+" : ""
  return `${sign}${diffPercent.toFixed(0)}%`
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("MAIN FUNCTION RUNNING")

  const { description, price: quotedPrice, unit } = quoteItem

  console.log("\n==============================")
  console.log("  QUOTE ANALYSIS")
  console.log("==============================")
  console.log("Item:        ", description)
  console.log("Quoted price:", quotedPrice, `€/${unit}`)
  console.log("==============================\n")

  // ── Step 1: Generate embedding ────────────────────────────────────────────

  console.log("STEP 1: generating embedding for description")

  const { data: embedData, error: embedError } =
    await supabase.functions.invoke("generate-embedding", {
      body: { inputs: [description] }
    })

  if (embedError) {
    console.error("Embedding error:", embedError)
    return
  }

  const embedding = embedData.embeddings[0]
  console.log("Embedding length:", embedding.length)

  // ── Step 2: Hybrid RAG search ─────────────────────────────────────────────

  console.log("STEP 2: calling hybrid match_knowledge_chunks")

  const { data: results, error: searchError } =
    await supabase.rpc("match_knowledge_chunks", {
      query_embedding: embedding,
      query_text: description,
      match_count: 3
    })

  if (searchError) {
    console.error("Search error:", searchError)
    return
  }

  console.log("Chunks returned:", results?.length ?? 0)

  // ── Step 3: Extract price references from chunks ──────────────────────────

  console.log("STEP 3: extracting price references from chunks")

  interface PriceRef {
    price: number
    documentId: string
    similarity: number
    content: string
  }

  const priceRefs: PriceRef[] = []

  if (results && results.length > 0) {
    for (const chunk of results) {
      const extracted = extractPriceFromContent(chunk.content)
      if (extracted !== null) {
        priceRefs.push({
          price: extracted,
          documentId: chunk.document_id,
          similarity: chunk.similarity,
          content: chunk.content.trim()
        })
      }
    }
  }

  // ── Step 4: Compute market statistics ────────────────────────────────────

  console.log("STEP 4: computing market statistics")

  if (priceRefs.length === 0) {
    console.log("\n==============================")
    console.log("  ANALYSIS RESULT")
    console.log("==============================")
    console.log("Item:        ", description)
    console.log("Quoted price:", quotedPrice, `€/${unit}`)
    console.log("Market refs:  No price references found in knowledge base.")
    console.log("==============================\n")
    console.log("SCRIPT COMPLETED")
    return
  }

  const avgMarketPrice =
    priceRefs.reduce((sum, r) => sum + r.price, 0) / priceRefs.length

  const diffPercent = ((quotedPrice - avgMarketPrice) / avgMarketPrice) * 100
  const risk = riskLevel(diffPercent)

  // ── Step 5: Print analysis ────────────────────────────────────────────────

  console.log("\n==============================")
  console.log("  ANALYSIS RESULT")
  console.log("==============================")
  console.log("Item:        ", description)
  console.log("Quoted price:", quotedPrice, `€/${unit}`)
  console.log("------------------------------")
  console.log("Market references found:", priceRefs.length)

  priceRefs.forEach((ref, i) => {
    console.log(`  [${i + 1}] ${ref.price} €/${unit}  (similarity: ${ref.similarity.toFixed(3)})`)
    console.log(`       source: ${ref.documentId}`)
    console.log(`       content: ${ref.content.slice(0, 80)}${ref.content.length > 80 ? "…" : ""}`)
  })

  console.log("------------------------------")
  console.log("Market avg:  ", avgMarketPrice.toFixed(2), `€/${unit}`)
  console.log("Difference:  ", fmtDiff(diffPercent))
  console.log("Risk level:  ", risk)
  console.log("==============================\n")

  console.log("SCRIPT COMPLETED")
}

main().catch(err => {
  console.error("SCRIPT FAILED:", err)
})

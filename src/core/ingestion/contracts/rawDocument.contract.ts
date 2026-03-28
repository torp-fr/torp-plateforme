/**
 * Raw Document Contract
 * Represents unprocessed document input from any source
 * No transformation has been applied
 */

export interface RawDocument {
  id: string
  source: "pdf" | "docx" | "ocr" | "manual"
  uploadedAt: Date
  rawBuffer?: Buffer
  rawText?: string
  metadata: Record<string, unknown>
}

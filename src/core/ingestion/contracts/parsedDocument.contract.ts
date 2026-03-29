/**
 * Parsed Document Contract
 * Represents document after text extraction and block parsing
 * Ready for data extraction
 */

export interface ParsedDocument {
  documentId: string
  text: string
  blocks: {
    index: number
    content: string
  }[]
}

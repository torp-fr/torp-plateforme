/**
 * Extracted Knowledge Contract
 * Generic contract for extracted knowledge from documents
 * No normalization has been applied
 */

export interface ExtractedKnowledge {
  documentId: string
  rawEntities: unknown
  extractionConfidence: number
}

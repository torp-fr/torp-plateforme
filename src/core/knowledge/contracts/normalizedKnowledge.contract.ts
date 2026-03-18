/**
 * Normalized Knowledge Contract
 * Generic contract for normalized knowledge
 * After standardization and structuring
 */

export interface NormalizedKnowledge {
  documentId: string
  structuredContent: unknown
  normalizationScore: number
}

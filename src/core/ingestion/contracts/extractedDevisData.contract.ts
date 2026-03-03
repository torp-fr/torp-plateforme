/**
 * Extracted Devis Data Contract
 * Represents structured data extracted from parsed document
 * May contain null/optional fields - extraction may be incomplete
 */

export interface ExtractedDevisData {
  documentId: string
  entreprise?: {
    nom?: string
    siret?: string
    rge?: boolean
  }
  lots: {
    label: string
    description?: string
    price?: number
  }[]
  totalAmount?: number
  extractionConfidence: number
}

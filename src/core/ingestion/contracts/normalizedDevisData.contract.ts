/**
 * Normalized Devis Data Contract
 * Represents data after normalization and standardization
 * All required fields are present and validated
 */

export interface NormalizedDevisData {
  documentId: string
  entreprise: {
    nom: string
    siret?: string
    rge?: boolean
  }
  lots: {
    category: string
    normalizedLabel: string
    price: number
  }[]
  totalAmount: number
  normalizationScore: number
}

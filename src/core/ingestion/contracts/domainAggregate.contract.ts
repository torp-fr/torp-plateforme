/**
 * Domain Aggregate Contract
 * Represents domain model aggregates for business logic
 * Separated from data structures - domain-driven design
 */

export interface LotAggregate {
  category: string
  label: string
  price: number
}

export interface EntrepriseAggregate {
  nom: string
  siret?: string
  rge?: boolean
}

export interface DevisAggregate {
  id: string
  entreprise: EntrepriseAggregate
  lots: LotAggregate[]
  totalAmount: number
}

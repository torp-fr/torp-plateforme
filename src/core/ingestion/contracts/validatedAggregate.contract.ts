/**
 * Validated Aggregate Contract
 * Represents domain aggregate after validation
 * Includes trust and quality metrics
 */

import { DevisAggregate } from "./domainAggregate.contract"

export interface ValidationReport {
  isValid: boolean
  issues: string[]
  trustScore: number
}

export interface ValidatedDevisAggregate {
  aggregate: DevisAggregate
  validationReport: ValidationReport
}

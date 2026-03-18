/**
 * Validated Knowledge Aggregate Contract
 * Generic contract for validated knowledge aggregates
 * Includes validation and confidence metrics
 */

import { KnowledgeAggregate } from "./knowledgeAggregate.contract"

export interface KnowledgeValidationReport {
  isValid: boolean
  confidenceScore: number
  issues: string[]
}

export interface ValidatedKnowledgeAggregate {
  aggregate: KnowledgeAggregate
  validationReport: KnowledgeValidationReport
}

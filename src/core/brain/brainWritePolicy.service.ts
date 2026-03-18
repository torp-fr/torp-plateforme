/**
 * Brain Write Policy Service
 * Enforces strict rules before data persistence to knowledge brain
 * Acts as gatekeeper for data quality and trust thresholds
 */

import { ValidatedKnowledgeAggregate } from "../knowledge/contracts"

export class BrainWritePolicy {
  static canPersist(validated: ValidatedKnowledgeAggregate): { allowed: boolean; reason?: string } {
    const { aggregate, validationReport } = validated

    if (!validationReport.isValid) {
      return { allowed: false, reason: "Validation failed" }
    }

    if (validationReport.confidenceScore < 0.6) {
      return { allowed: false, reason: "Confidence score below threshold" }
    }

    if (!aggregate.content) {
      return { allowed: false, reason: "Empty content" }
    }

    return { allowed: true }
  }
}

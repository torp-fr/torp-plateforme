/**
 * Brain Write Policy Service
 * Enforces strict rules before data persistence to knowledge brain
 * Acts as gatekeeper for data quality and trust thresholds
 */

import { ValidatedDevisAggregate } from "../ingestion/contracts"

export class BrainWritePolicy {
  static canPersist(validated: ValidatedDevisAggregate): { allowed: boolean; reason?: string } {
    const { aggregate, validationReport } = validated

    if (!validationReport.isValid) {
      return { allowed: false, reason: "Validation failed" }
    }

    if (validationReport.trustScore < 0.6) {
      return { allowed: false, reason: "Trust score below threshold" }
    }

    if (!aggregate.lots || aggregate.lots.length === 0) {
      return { allowed: false, reason: "No valid lots found" }
    }

    if (aggregate.totalAmount <= 0) {
      return { allowed: false, reason: "Invalid total amount" }
    }

    return { allowed: true }
  }
}

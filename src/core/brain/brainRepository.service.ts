/**
 * Brain Repository Service
 * Handles persistence of validated data to knowledge brain
 * This layer ONLY receives validated aggregates after policy checks
 */

import { ValidatedDevisAggregate } from "../ingestion/contracts"

export class BrainRepository {
  async persist(validated: ValidatedDevisAggregate): Promise<void> {
    // TODO: Implement Supabase write logic
    // This layer must ONLY receive validated aggregates
    console.log("Persisting validated devis:", validated.aggregate.id)
  }
}

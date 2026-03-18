/**
 * Knowledge Aggregate Contract
 * Generic domain model aggregate for knowledge
 * Domain-driven design - independent of specific document types
 */

export interface KnowledgeAggregate {
  id: string
  type: string
  content: unknown
  metadata: Record<string, unknown>
}

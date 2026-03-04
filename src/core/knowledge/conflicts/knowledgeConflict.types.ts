/**
 * Knowledge Conflict Detection Types
 * MVP: Detect conflicts between documents using embedding similarity
 */

/**
 * Types of conflicts that can be detected
 */
export type ConflictType =
  | 'numerical_conflict'      // Different numbers for same thing (pricing, dates)
  | 'regulatory_conflict'     // Contradictory regulatory information
  | 'semantic_contradiction'  // Contradictory information/advice
  | 'source_priority_conflict'; // Different sources claim authority

/**
 * A single detected conflict between two documents
 */
export interface KnowledgeConflict {
  id?: string;                    // UUID (if persisted)
  documentA: string;              // Document A ID
  documentB: string;              // Document B ID
  chunkA?: string;                // Chunk A ID (optional)
  chunkB?: string;                // Chunk B ID (optional)
  similarityScore: number;        // 0.0-1.0 (cosine similarity)
  conflictScore: number;          // 0.0-1.0 (conflict severity)
  conflictType: ConflictType;     // Type of conflict
  conflictReason?: string;        // Human-readable explanation
  detectedAt?: string;            // ISO timestamp
  status?: 'unreviewed' | 'reviewed' | 'resolved' | 'ignored';
}

/**
 * Result of conflict detection run
 */
export interface ConflictDetectionResult {
  documentId: string;
  conflictsDetected: number;
  conflicts: KnowledgeConflict[];
  processingTimeMs: number;
}

/**
 * Options for conflict detection
 */
export interface ConflictDetectionOptions {
  similarityThreshold?: number;  // Default: 0.92 (very similar = high conflict risk)
  maxComparisons?: number;       // Default: 500 (safety limit)
  conflictTypes?: ConflictType[]; // Restrict to specific types
}

/**
 * Summary statistics for conflict detection
 */
export interface ConflictStatistics {
  totalConflicts: number;
  unreviewedCount: number;
  byType: Record<ConflictType, number>;
  avgConflictScore: number;
  highSeverityCount: number;  // score > 0.8
}

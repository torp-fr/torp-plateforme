/**
 * Shared Execution Context for Engine Pipeline
 * This context flows through all engines in the orchestration sequence,
 * allowing each engine to build upon the work of previous engines.
 *
 * Design Pattern: Context Object for sequential engine execution
 * Each engine receives this context, processes it, and enriches it with results.
 */

export interface EngineExecutionContext {
  /**
   * Project identifier - passed through entire pipeline
   */
  projectId: string;

  /**
   * Original project data from the orchestrator input
   */
  projectData: any;

  /**
   * Context Engine Results
   * Output from contextEngine: detected lots, spaces, flags
   * Used as input by subsequent engines
   */
  context?: {
    detectedLots?: Array<{
      id: string;
      reference: string;
      address?: string;
      confidencePercentage: number;
    }>;
    spaces?: Array<{
      id: string;
      type: string;
      description?: string;
    }>;
    flags?: Array<{
      type: string;
      severity: 'error' | 'warning' | 'info';
      message: string;
    }>;
    summary?: string;
  };

  /**
   * Lot Engine Results (placeholder for future)
   * Will contain lot validation and enrichment results
   */
  lots?: any;

  /**
   * Rule Engine Results (placeholder for future)
   * Will contain rule evaluation results
   */
  rules?: any;

  /**
   * Enrichment Engine Results (placeholder for future)
   * Will contain enriched project data
   */
  enrichments?: any;

  /**
   * RAG Engine Results (placeholder for future)
   * Will contain retrieved context from knowledge base
   */
  rag?: any;

  /**
   * Audit Engine Results (placeholder for future)
   * Will contain audit trail and validation results
   */
  audit?: any;

  /**
   * Audit Report - Structured output from Audit Engine
   * Contains executive summary, risk assessment, compliance findings, and recommendations
   */
  auditReport?: any;

  /**
   * Audit Snapshot - Point-in-time version record from Audit Snapshot Manager
   * Captures immutable audit state for versioning and trend analysis
   */
  auditSnapshot?: any;

  /**
   * Enterprise Engine Results
   * Evaluation of structural reliability of the enterprise
   */
  enterprise?: any;

  /**
   * Pricing Engine Results
   * Evaluation of pricing coherence relative to complexity
   */
  pricing?: any;

  /**
   * Quality Engine Results
   * Evaluation of quote professional quality
   */
  quality?: any;

  /**
   * Global Scoring Results
   * Combined weighted TORP score from all pillars
   */
  globalScore?: any;

  /**
   * Trust Capping Results
   * Intelligent grade capping based on Trust Framework Registry
   * Contains coherence checks, price anomalies, and blocking obligations
   */
  trustCappingResult?: any;

  /**
   * Official professional grade after trust capping.
   * This is the only grade that should be used externally.
   */
  finalProfessionalGrade?: string;

  /**
   * Timestamp when execution started (ISO 8601)
   */
  executionStartTime?: string;

  /**
   * Sequential phase tracking
   * Helps identify which engine is currently executing
   */
  currentPhase?: 'context' | 'lots' | 'rules' | 'enrichment' | 'rag' | 'audit';
}

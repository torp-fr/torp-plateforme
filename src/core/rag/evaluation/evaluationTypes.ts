/**
 * RAG Evaluation Suite — Shared Types
 *
 * Used by all evaluation services. Never import from production RAG code here
 * to keep the evaluation layer fully decoupled.
 */

// ---------------------------------------------------------------------------
// Dataset
// ---------------------------------------------------------------------------

export interface EvaluationQuestion {
  /** Unique identifier for this test case (e.g. "regulation_001"). */
  id: string;
  /** Natural-language question sent to the RAG pipeline. */
  question: string;
  /**
   * Keywords that must appear in the retrieved chunks to count as a recall hit.
   * Optional — if absent, recall defaults to 1.0 (no expectation).
   */
  expectedKeywords?: string[];
  /**
   * Document source IDs that should appear in the retrieval results.
   * Informational only (not used in automated scoring yet).
   */
  expectedSources?: string[];
}

// ---------------------------------------------------------------------------
// Per-question result
// ---------------------------------------------------------------------------

export interface EvaluationResult {
  /** Matches EvaluationQuestion.id. */
  questionId: string;
  /** Fraction of expectedKeywords found in retrieved chunks. Range: [0, 1]. */
  retrievalRecall: number;
  /** Mean relevance/similarity score of returned chunks. Range: [0, 1]. */
  rerankerScore: number;
  /** LLM-answer support score from the grounding validator. Range: [0, 100]. */
  groundingScore: number;
  /** Ratio of citation markers to factual sentences. Range: [0, 1]. */
  citationScore: number;
  /** End-to-end wall-clock time for retrieval + context + LLM generation (ms). */
  latencyMs: number;
  /** true when groundingScore < 70 (grounding validator threshold). */
  hallucination: boolean;
}

// ---------------------------------------------------------------------------
// Aggregate report
// ---------------------------------------------------------------------------

export interface EvaluationReport {
  totalQuestions: number;
  /** Mean retrievalRecall across all questions. */
  avgRecall: number;
  /** Mean groundingScore across all questions. */
  avgGrounding: number;
  /** Mean citationScore across all questions. */
  avgCitationScore: number;
  /** Fraction of questions flagged as hallucinations. */
  hallucinationRate: number;
  /** Mean latencyMs across all questions. */
  avgLatencyMs: number;
}

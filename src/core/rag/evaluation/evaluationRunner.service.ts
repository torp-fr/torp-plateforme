/**
 * RAG Evaluation Suite — Evaluation Runner
 *
 * Orchestrates the full evaluation loop:
 *   1. Load dataset
 *   2. For each question, run the real RAG pipeline (read-only)
 *   3. Compute all metrics
 *   4. Return EvaluationResult[]
 *
 * Concurrency is limited to MAX_CONCURRENCY parallel questions to avoid
 * overwhelming rate limits and to produce stable latency measurements.
 *
 * Safety: this file only calls existing public APIs. It does NOT modify any
 * production data or pipeline behaviour.
 */

import { searchRelevantKnowledge } from '../retrieval/hybridSearch.service';
import { validateGrounding } from '../validation/grounding.service';
import { ragService } from '../rag.service';
import { aiOrchestrator } from '@/services/ai/aiOrchestrator.service';
import { loadDataset } from './evaluationDataset.service';
import {
  computeRetrievalRecall,
  computeRerankerScore,
  computeCitationScore,
} from './evaluationMetrics.service';
import { EvaluationQuestion, EvaluationResult } from './evaluationTypes';
import { log, warn } from '@/lib/logger';

/** Maximum number of questions evaluated in parallel. */
const MAX_CONCURRENCY = 3;

// ---------------------------------------------------------------------------
// Single-question evaluation
// ---------------------------------------------------------------------------

/**
 * Run the full RAG pipeline for one question and compute all metrics.
 *
 * Pipeline steps (in order, all timed together):
 *   1. searchRelevantKnowledge  → retrieved chunks
 *   2. ragService.injectKnowledgeContext → context-enriched prompt
 *      (hits retrieval cache from step 1, so no duplicate LLM/DB calls)
 *   3. aiOrchestrator.generateCompletion → LLM answer
 *
 * Metrics computed after timing:
 *   - retrievalRecall   (keyword overlap in chunks vs expectedKeywords)
 *   - rerankerScore     (mean chunk relevance score)
 *   - groundingScore    (validateGrounding supportScore, 0-100)
 *   - citationScore     (citation markers vs sentence count, 0-1)
 *   - hallucination     (groundingScore < 70)
 */
async function runSingleEvaluation(
  question: EvaluationQuestion,
): Promise<EvaluationResult> {
  const start = Date.now();

  // 1. Retrieve relevant chunks (populates retrieval cache for step 2)
  const retrievedChunks = await searchRelevantKnowledge(question.question);

  // 2. Build context-injected prompt (retrieval cache hit — no extra DB round-trip)
  const enrichedPrompt = await ragService.injectKnowledgeContext(
    question.question,
  );

  // 3. Generate LLM answer from enriched prompt
  const llmResult = await aiOrchestrator.generateCompletion(enrichedPrompt);

  const latencyMs = Date.now() - start;

  // 4. Grounding validation
  const grounding = validateGrounding(llmResult.content, retrievedChunks);

  // 5. Metric computation
  const retrievalRecall = computeRetrievalRecall(
    retrievedChunks,
    question.expectedKeywords,
  );
  const rerankerScore = computeRerankerScore(retrievedChunks);
  const groundingScore = grounding.supportScore; // 0-100
  const citationScore = computeCitationScore(llmResult.content);
  const hallucination = groundingScore < 70;

  return {
    questionId: question.id,
    retrievalRecall,
    rerankerScore,
    groundingScore,
    citationScore,
    latencyMs,
    hallucination,
  };
}

// ---------------------------------------------------------------------------
// Batch runner
// ---------------------------------------------------------------------------

/**
 * Evaluate all questions in the dataset with bounded concurrency.
 *
 * Questions are processed in batches of MAX_CONCURRENCY. Failed questions
 * produce a zero-score result (not thrown) so the full report is always
 * complete.
 *
 * @param datasetPath - Optional override for the dataset file path.
 */
export async function runEvaluation(
  datasetPath?: string,
): Promise<EvaluationResult[]> {
  const questions = loadDataset(datasetPath);

  log(
    `[RAG:Eval] 🚀 Starting evaluation — ${questions.length} question(s), ` +
      `max concurrency: ${MAX_CONCURRENCY}`,
  );

  const results: EvaluationResult[] = [];

  for (let i = 0; i < questions.length; i += MAX_CONCURRENCY) {
    const batch = questions.slice(i, i + MAX_CONCURRENCY);

    const batchResults = await Promise.all(
      batch.map(async (q): Promise<EvaluationResult> => {
        try {
          const result = await runSingleEvaluation(q);
          log(
            `[RAG:Eval] ✓ ${q.id} — recall=${result.retrievalRecall.toFixed(2)} ` +
              `grounding=${result.groundingScore.toFixed(1)}% ` +
              `latency=${result.latencyMs}ms`,
          );
          return result;
        } catch (err) {
          warn(
            `[RAG:Eval] ⚠️ Question "${q.id}" failed: ${(err as Error).message}`,
          );
          // Return a zero-score sentinel so the report is always complete
          return {
            questionId: q.id,
            retrievalRecall: 0,
            rerankerScore: 0,
            groundingScore: 0,
            citationScore: 0,
            latencyMs: 0,
            hallucination: true,
          };
        }
      }),
    );

    results.push(...batchResults);

    const done = Math.min(i + MAX_CONCURRENCY, questions.length);
    log(`[RAG:Eval] Progress: ${done} / ${questions.length}`);
  }

  log(`[RAG:Eval] ✅ Evaluation complete — ${results.length} result(s)`);
  return results;
}

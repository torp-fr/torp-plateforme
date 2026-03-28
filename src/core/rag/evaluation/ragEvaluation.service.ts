/**
 * RAG Evaluation Suite — Top-level Orchestrator
 *
 * Single entry point for programmatic use:
 *
 *   import { runRagEvaluation } from '@/core/rag/evaluation/ragEvaluation.service';
 *   const { report, results, csvPath } = await runRagEvaluation({ exportCsv: true });
 *
 * Does NOT modify any production service or data.
 */

import { runEvaluation } from './evaluationRunner.service';
import {
  generateReport,
  formatReport,
  exportCsv,
} from './evaluationReport.service';
import { EvaluationResult, EvaluationReport } from './evaluationTypes';
import { log } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface RagEvaluationOptions {
  /** Absolute path to the dataset JSON file. Defaults to evaluation/rag-test-dataset.json. */
  datasetPath?: string;
  /** When true, write a CSV of per-question results alongside the report. */
  exportCsv?: boolean;
  /** Absolute path for the CSV output file. Defaults to <cwd>/evaluation-results.csv. */
  csvOutputPath?: string;
}

export interface RagEvaluationOutput {
  results: EvaluationResult[];
  report: EvaluationReport;
  /** Absolute path of the written CSV file, present only when exportCsv was true. */
  csvPath?: string;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Run the full RAG evaluation suite.
 *
 * @returns results (per-question), report (aggregates), and optionally csvPath.
 */
export async function runRagEvaluation(
  options: RagEvaluationOptions = {},
): Promise<RagEvaluationOutput> {
  log('[RAG:Eval] 🔬 RAG evaluation suite starting');

  const results = await runEvaluation(options.datasetPath);
  const report = generateReport(results);

  let csvPath: string | undefined;
  if (options.exportCsv) {
    csvPath = exportCsv(results, options.csvOutputPath);
    log('[RAG:Eval] 📄 CSV exported to:', csvPath);
  }

  log('[RAG:Eval] 🏁 Evaluation suite complete');
  return { results, report, csvPath };
}

export { formatReport } from './evaluationReport.service';
export type { EvaluationResult, EvaluationReport } from './evaluationTypes';

/**
 * RAG Evaluation Suite — Report Generation
 *
 * Three exports:
 *   generateReport(results)  → EvaluationReport (aggregate statistics)
 *   formatReport(report)     → human-readable string for CLI output
 *   exportCsv(results, path) → writes CSV file, returns the file path
 */

import fs from 'fs';
import path from 'path';
import { EvaluationResult, EvaluationReport } from './evaluationTypes';

// ---------------------------------------------------------------------------
// Aggregate statistics
// ---------------------------------------------------------------------------

/**
 * Compute aggregate statistics across all evaluation results.
 * Returns zeroed report for empty input.
 */
export function generateReport(results: EvaluationResult[]): EvaluationReport {
  if (results.length === 0) {
    return {
      totalQuestions: 0,
      avgRecall: 0,
      avgGrounding: 0,
      avgCitationScore: 0,
      hallucinationRate: 0,
      avgLatencyMs: 0,
    };
  }

  const mean = (key: keyof EvaluationResult): number =>
    results.reduce((sum, r) => sum + (r[key] as number), 0) / results.length;

  return {
    totalQuestions: results.length,
    avgRecall: mean('retrievalRecall'),
    avgGrounding: mean('groundingScore'),
    avgCitationScore: mean('citationScore'),
    hallucinationRate:
      results.filter((r) => r.hallucination).length / results.length,
    avgLatencyMs: mean('latencyMs'),
  };
}

// ---------------------------------------------------------------------------
// CLI-friendly formatted output
// ---------------------------------------------------------------------------

/**
 * Render an EvaluationReport as a human-readable string suitable for
 * console output or log files.
 */
export function formatReport(report: EvaluationReport): string {
  const line = '═══════════════════════════════════════';
  return [
    '',
    line,
    '  RAG EVALUATION REPORT',
    line,
    `  Questions tested:       ${report.totalQuestions}`,
    `  Avg retrieval recall:   ${(report.avgRecall * 100).toFixed(1)}%`,
    `  Avg grounding score:    ${report.avgGrounding.toFixed(1)}%`,
    `  Citation accuracy:      ${(report.avgCitationScore * 100).toFixed(1)}%`,
    `  Hallucination rate:     ${(report.hallucinationRate * 100).toFixed(1)}%`,
    `  Avg latency:            ${(report.avgLatencyMs / 1000).toFixed(2)}s`,
    line,
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

/**
 * Write evaluation results to a CSV file.
 *
 * Columns: question_id, recall, grounding_score, citation_score, latency, hallucination
 *
 * @param results    - Array of per-question results.
 * @param outputPath - Optional absolute path for the output file.
 *                     Defaults to <project-root>/evaluation-results.csv.
 * @returns The absolute path of the written file.
 */
export function exportCsv(
  results: EvaluationResult[],
  outputPath?: string,
): string {
  const filePath =
    outputPath ?? path.join(process.cwd(), 'evaluation-results.csv');

  const header =
    'question_id,recall,grounding_score,citation_score,latency,hallucination\n';

  const rows = results
    .map((r) =>
      [
        r.questionId,
        r.retrievalRecall.toFixed(4),
        r.groundingScore.toFixed(2),
        r.citationScore.toFixed(4),
        r.latencyMs,
        r.hallucination,
      ].join(','),
    )
    .join('\n');

  fs.writeFileSync(filePath, header + rows, 'utf-8');
  return filePath;
}

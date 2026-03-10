/**
 * RAG Evaluation CLI
 *
 * Usage:
 *   pnpm ts-node scripts/run-rag-evaluation.ts
 *   pnpm ts-node scripts/run-rag-evaluation.ts --csv
 *   pnpm ts-node scripts/run-rag-evaluation.ts --dataset /path/to/custom-dataset.json
 *   pnpm ts-node scripts/run-rag-evaluation.ts --csv --output /path/to/results.csv
 *
 * Options:
 *   --csv              Export per-question results to CSV (evaluation-results.csv)
 *   --dataset <path>   Override the default dataset path
 *   --output <path>    Override the default CSV output path
 *
 * Exit codes:
 *   0  — evaluation complete (regardless of scores)
 *   1  — fatal error (dataset missing, pipeline unreachable, etc.)
 */

import { runRagEvaluation, formatReport } from '../src/core/rag/evaluation/ragEvaluation.service';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): {
  exportCsv: boolean;
  datasetPath?: string;
  csvOutputPath?: string;
} {
  const exportCsv = argv.includes('--csv');

  const datasetIdx = argv.indexOf('--dataset');
  const datasetPath =
    datasetIdx !== -1 && argv[datasetIdx + 1]
      ? argv[datasetIdx + 1]
      : undefined;

  const outputIdx = argv.indexOf('--output');
  const csvOutputPath =
    outputIdx !== -1 && argv[outputIdx + 1] ? argv[outputIdx + 1] : undefined;

  return { exportCsv, datasetPath, csvOutputPath };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const { report, csvPath } = await runRagEvaluation({
    exportCsv: args.exportCsv,
    datasetPath: args.datasetPath,
    csvOutputPath: args.csvOutputPath,
  });

  console.log(formatReport(report));

  if (csvPath) {
    console.log(`CSV results exported to: ${csvPath}`);
  }
}

main().catch((err: Error) => {
  console.error('\n[RAG:Eval] Fatal error:', err.message);
  process.exit(1);
});

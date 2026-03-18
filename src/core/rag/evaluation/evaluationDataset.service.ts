/**
 * RAG Evaluation Suite — Dataset Loader
 *
 * Loads evaluation questions from a JSON file.
 * Default path: <project-root>/evaluation/rag-test-dataset.json
 *
 * Node.js only (uses fs). Not intended for browser/Next.js runtime.
 */

import fs from 'fs';
import path from 'path';
import { EvaluationQuestion } from './evaluationTypes';

const DEFAULT_DATASET_PATH = path.join(
  process.cwd(),
  'evaluation',
  'rag-test-dataset.json',
);

/**
 * Load evaluation questions from a JSON file.
 *
 * @param datasetPath - Absolute path to the dataset file.
 *                      Defaults to evaluation/rag-test-dataset.json at project root.
 * @throws if the file does not exist or is not valid JSON.
 */
export function loadDataset(datasetPath?: string): EvaluationQuestion[] {
  const filePath = datasetPath ?? DEFAULT_DATASET_PATH;

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `[RAG:Eval] Dataset file not found: ${filePath}\n` +
        'Create evaluation/rag-test-dataset.json at the project root.',
    );
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(
      `[RAG:Eval] Dataset must be a JSON array of EvaluationQuestion objects.`,
    );
  }

  return parsed as EvaluationQuestion[];
}

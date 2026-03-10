/**
 * RAG — Query Decomposition Service
 * Splits a complex, multi-part question into independent sub-queries so that
 * each aspect can be retrieved separately, improving recall for compound questions.
 *
 * Pipeline position:
 *   rewriteQuery() → decomposeQuery() → per-sub-query retrieval → merge → rerank
 */

import { aiOrchestrator } from '@/services/ai/aiOrchestrator.service';
import { log, warn } from '@/lib/logger';

const DECOMPOSE_SYSTEM_PROMPT =
  'You are a search query analyser for a technical construction documentation database. ' +
  'When given a compound question, break it into the smallest independent search queries needed. ' +
  'Return ONLY a valid JSON array of strings — no explanation, no markdown fences.';

/**
 * Decompose `query` into one or more independent search sub-queries.
 *
 * If the query is already a single, focused question the model should return a
 * single-element array. Falls back to `[query]` on any parse or API failure so
 * the retrieval pipeline is never blocked.
 */
export async function decomposeQuery(query: string): Promise<string[]> {
  try {
    const prompt =
      `Split the following question into independent search queries ` +
      `if it contains multiple questions.\n` +
      `Return a JSON array of queries.\n\n` +
      `Question: ${query}`;

    const { content } = await aiOrchestrator.generateCompletion(prompt, {
      systemPrompt: DECOMPOSE_SYSTEM_PROMPT,
      temperature: 0.1,
      maxTokens: 256,
    } as any);

    const raw = content.trim();
    if (!raw) {
      warn('[RAG:QueryDecomposition] ⚠️ Empty response — using original query');
      return [query];
    }

    const parsed: unknown = JSON.parse(raw);

    if (
      !Array.isArray(parsed) ||
      parsed.length === 0 ||
      !parsed.every((q) => typeof q === 'string' && q.trim().length > 0)
    ) {
      warn('[RAG:QueryDecomposition] ⚠️ Unexpected response shape — using original query');
      return [query];
    }

    const subQueries = (parsed as string[]).map((q) => q.trim());
    log('[RAG:QueryDecomposition] 🔀 Decomposed into', subQueries.length, 'sub-queries:', subQueries);
    return subQueries;
  } catch (err) {
    warn('[RAG:QueryDecomposition] ⚠️ Decomposition failed — using original query:', (err as Error).message);
    return [query];
  }
}

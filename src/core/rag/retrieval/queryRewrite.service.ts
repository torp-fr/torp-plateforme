/**
 * RAG — Query Rewrite Service
 * Rewrites the raw user query to maximise retrieval quality before
 * the hybrid search stage.
 *
 * Pipeline position:
 *   raw query → rewriteQuery() → keywordSearch / semanticSearch
 */

import { aiOrchestrator } from '@/services/ai/aiOrchestrator.service';
import { log, warn } from '@/lib/logger';

const REWRITE_SYSTEM_PROMPT =
  'You are a search query optimiser for a technical construction documentation database. ' +
  'Return only the rewritten query — no explanation, no punctuation around it.';

/**
 * Rewrite a user query to improve retrieval of technical documentation.
 * Falls back to the original query if the AI call fails or returns an empty string.
 */
export async function rewriteQuery(query: string): Promise<string> {
  try {
    const prompt =
      `Rewrite the following search query to maximise retrieval of technical documentation.\n` +
      `Query: ${query}\n` +
      `Return only the rewritten query.`;

    const { content } = await aiOrchestrator.generateCompletion(prompt, {
      systemPrompt: REWRITE_SYSTEM_PROMPT,
      temperature: 0.2,
      maxTokens: 128,
    } as any);

    const rewritten = content.trim();

    if (!rewritten) {
      warn('[RAG:QueryRewrite] ⚠️ Empty rewrite — using original query');
      return query;
    }

    log('[RAG:QueryRewrite] ✏️ Rewritten:', { original: query, rewritten });
    return rewritten;
  } catch (err) {
    warn('[RAG:QueryRewrite] ⚠️ Rewrite failed — using original query:', (err as Error).message);
    return query;
  }
}

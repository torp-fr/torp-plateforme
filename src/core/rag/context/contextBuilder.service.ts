/**
 * RAG — Context Builder Service
 * Builds the prompt context section from retrieved knowledge chunks.
 */

import { SearchResult, MarketPriceReference } from '../types';
import { log } from '@/lib/logger';

const MAX_CONTEXT_CHARS = 4000;

/**
 * Build a formatted context section from retrieved knowledge documents.
 * Fills the context window up to MAX_CONTEXT_CHARS instead of applying a
 * fixed per-chunk truncation, so high-quality chunks can use the full budget.
 *
 * Neighbour expansion: after adding each ranked chunk, the service attempts
 * to also include adjacent chunks (numeric id ± 1) from the same retrieved
 * set, provided the context budget allows. This improves completeness when a
 * passage spans multiple chunks that were ranked apart.
 */
export function buildKnowledgeContextSection(knowledge: SearchResult[]): string {
  if (knowledge.length === 0) return '';

  // Index all retrieved chunks by their numeric id for O(1) neighbour lookup.
  // Non-numeric ids simply won't resolve neighbours (safe no-op).
  const byNumericId = new Map<number, SearchResult>();
  for (const k of knowledge) {
    const n = parseInt(k.id, 10);
    if (!isNaN(n)) byNumericId.set(n, k);
  }

  const lines: string[] = [];
  const included = new Set<string>();
  let used = 0;
  let label = 1;

  const tryAppend = (k: SearchResult): boolean => {
    if (included.has(k.id)) return true;
    const line = `[${label}] [${k.source}] ${k.category.toUpperCase()}: ${k.content}`;
    if (used + line.length > MAX_CONTEXT_CHARS) return false;
    lines.push(line);
    used += line.length;
    included.add(k.id);
    label++;
    return true;
  };

  for (const k of knowledge) {
    // Skip chunks already pulled in as a neighbour of an earlier primary chunk
    if (included.has(k.id)) continue;

    // Primary chunk — if it doesn't fit, the budget is exhausted
    if (!tryAppend(k)) break;

    // Neighbour expansion: try chunk id-1 then chunk id+1
    const n = parseInt(k.id, 10);
    if (!isNaN(n)) {
      for (const neighborId of [n - 1, n + 1]) {
        const neighbor = byNumericId.get(neighborId);
        if (neighbor) tryAppend(neighbor); // silently skip if budget is exhausted
      }
    }
  }

  log('[RAG:ContextBuilder] 📐 Context budget used:', used, '/', MAX_CONTEXT_CHARS, 'chars —', lines.length, 'chunks');

  return `\n\nRELEVANT KNOWLEDGE BASE (${lines.length} documents):\n${lines.join('\n')}`;
}

/**
 * Build a market price context section.
 */
export function buildMarketPriceContext(
  type_travaux: string,
  region: string,
  pricing: MarketPriceReference
): string {
  return (
    `\n\nMARKET CONTEXT:\n` +
    `Work Type: ${type_travaux}\n` +
    `Region: ${region}\n` +
    `Market Price Range: €${pricing.min_price} - €${pricing.max_price}\n` +
    `Average: €${pricing.avg_price}\n` +
    `Reliability: ${pricing.reliability_score}%`
  );
}

/**
 * Inject knowledge context into an existing prompt.
 */
export function injectContextIntoPrompt(
  prompt: string,
  contextSection: string,
  priceContext: string
): string {
  const enriched = prompt + contextSection + priceContext;
  log('[RAG:ContextBuilder] 🎉 Context injected — enhanced prompt ready');
  return enriched;
}

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
 */
export function buildKnowledgeContextSection(knowledge: SearchResult[]): string {
  if (knowledge.length === 0) return '';

  const lines: string[] = [];
  let used = 0;

  for (let i = 0; i < knowledge.length; i++) {
    const k = knowledge[i];
    const line = `[${i + 1}] [${k.source}] ${k.category.toUpperCase()}: ${k.content}`;
    if (used + line.length > MAX_CONTEXT_CHARS) break;
    lines.push(line);
    used += line.length;
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

/**
 * RAG — Context Builder Service
 * Builds the prompt context section from retrieved knowledge chunks.
 */

import { SearchResult, MarketPriceReference } from '../types';
import { log } from '@/lib/logger';

/**
 * Build a formatted context section from retrieved knowledge documents.
 */
export function buildKnowledgeContextSection(knowledge: SearchResult[]): string {
  if (knowledge.length === 0) return '';

  return `\n\nRELEVANT KNOWLEDGE BASE (${knowledge.length} documents):\n${knowledge
    .map((k, i) => `[${i + 1}] [${k.source}] ${k.category.toUpperCase()}: ${k.content.substring(0, 200)}...`)
    .join('\n')}`;
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

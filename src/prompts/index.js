/**
 * Extraction Strategy Router
 * Maps extraction_strategy to appropriate prompt template
 * Central point for strategy-driven prompt selection
 */

import { strictObligationsPrompt } from './strictObligationsPrompt.js';
import { legalObligationsPrompt } from './legalObligationsPrompt.js';
import { bestPracticesPrompt } from './bestPracticesPrompt.js';
import { contextualInsightsPrompt } from './contextualInsightsPrompt.js';

/**
 * Get extraction prompt based on strategy
 * @param {string} strategy - Extraction strategy ('strict_obligations', 'legal_obligations_only', 'best_practices', 'contextual_insights')
 * @param {string} chunkContent - Document chunk content
 * @returns {string} Complete prompt for LLM
 */
export function getExtractionPrompt(strategy, chunkContent) {
  switch (strategy) {
    case 'strict_obligations':
      return strictObligationsPrompt(chunkContent);

    case 'legal_obligations_only':
      return legalObligationsPrompt(chunkContent);

    case 'best_practices':
      return bestPracticesPrompt(chunkContent);

    case 'contextual_insights':
      return contextualInsightsPrompt(chunkContent);

    default:
      // Default to legal obligations (balanced approach)
      return legalObligationsPrompt(chunkContent);
  }
}

/**
 * Validate extraction strategy
 * @param {string} strategy - Strategy to validate
 * @returns {boolean} True if valid strategy
 */
export function isValidStrategy(strategy) {
  const validStrategies = [
    'strict_obligations',
    'legal_obligations_only',
    'best_practices',
    'contextual_insights'
  ];
  return validStrategies.includes(strategy);
}

/**
 * Get default strategy for document category
 * Maps canonical TORP document category to recommended extraction strategy.
 * @param {string} category - Document category (DTU | EUROCODE | CODE_CONSTRUCTION | NORME | GUIDE_TECHNIQUE | JURISPRUDENCE | PRIX_BTP)
 * @returns {string} Recommended extraction strategy
 */
export function getDefaultStrategyForCategory(category) {
  const categoryMapping = {
    'DTU':               'strict_obligations',
    'EUROCODE':          'strict_obligations',
    'NORME':             'strict_obligations',
    'CODE_CONSTRUCTION': 'legal_obligations_only',
    'JURISPRUDENCE':     'legal_obligations_only',
    'GUIDE_TECHNIQUE':   'best_practices',
    'PRIX_BTP':          'contextual_insights',
  };

  return categoryMapping[category] || 'legal_obligations_only';
}

export default {
  getExtractionPrompt,
  isValidStrategy,
  getDefaultStrategyForCategory
};

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
 * Maps document category to recommended extraction strategy
 * @param {string} category - Document category (DTU, EUROCODE, REGULATION, BEST_PRACTICE, etc.)
 * @returns {string} Recommended extraction strategy
 */
export function getDefaultStrategyForCategory(category) {
  const categoryMapping = {
    'DTU': 'strict_obligations',
    'EUROCODE': 'strict_obligations',
    'NORM': 'strict_obligations',
    'REGULATION': 'legal_obligations_only',
    'LEGAL': 'legal_obligations_only',
    'GUIDELINE': 'best_practices',
    'BEST_PRACTICE': 'best_practices',
    'TECHNICAL_GUIDE': 'best_practices',
    'TRAINING': 'contextual_insights',
    'MANUAL': 'contextual_insights',
    'HANDBOOK': 'contextual_insights',
    'SUSTAINABILITY': 'best_practices',
    'ENERGY_EFFICIENCY': 'best_practices',
    'LIABILITY': 'legal_obligations_only',
    'WARRANTY': 'legal_obligations_only',
    'CASE_STUDY': 'contextual_insights',
    'LESSONS_LEARNED': 'contextual_insights'
  };

  return categoryMapping[category] || 'legal_obligations_only';
}

export default {
  getExtractionPrompt,
  isValidStrategy,
  getDefaultStrategyForCategory
};

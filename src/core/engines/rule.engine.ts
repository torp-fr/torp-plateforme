/**
 * Rule Engine v1.0
 * Minimal rule evaluation engine for declarative obligations
 * Pure structuring - no AI, no external APIs, no Supabase, no scoring
 */

import { EngineExecutionContext } from '@/core/platform/engineExecutionContext';
import { getRulesByCategory } from '@/core/rules/ruleRegistry';

/**
 * Rule obligation structure
 */
export interface RuleObligation {
  category: string;
  obligation: string;
  source?: string;
}

/**
 * Rule Engine result
 */
export interface RuleEngineResult {
  obligations: string[];
  uniqueObligations: string[];
  obligationCount: number;
  ruleCount: number;
  categorySummary: Record<string, number>;
  meta: {
    engineVersion: string;
    createdAt: string;
    processingTime: number;
  };
}

/**
 * Run Rule Engine - evaluate declarative rules based on lots
 * Input: EngineExecutionContext with normalized lots from Lot Engine
 * Output: Set of obligations based on lot categories
 */
export async function runRuleEngine(
  executionContext: EngineExecutionContext
): Promise<RuleEngineResult> {
  const startTime = Date.now();

  try {
    console.log('[RuleEngine] Starting rule evaluation');

    // Extract normalized lots from execution context
    const normalizedLots = executionContext.lots?.normalizedLots || [];

    // Collect obligations based on lot categories
    const obligations: string[] = [];
    const categoryTriggers: Record<string, number> = {};

    normalizedLots.forEach((lot: any) => {
      const category = lot.category || 'unknown';

      // Track which categories trigger rules
      categoryTriggers[category] = (categoryTriggers[category] || 0) + 1;

      // Get rules for this category from the centralized registry
      const rules = getRulesByCategory(category);

      // Collect obligations from matching rules
      rules.forEach((rule) => {
        obligations.push(rule.obligation);
      });
    });

    // Deduplicate obligations while preserving order
    const uniqueObligations = Array.from(new Set(obligations));

    // Build category summary
    const categorySummary = categoryTriggers;

    const processingTime = Date.now() - startTime;

    const result: RuleEngineResult = {
      obligations,
      uniqueObligations,
      obligationCount: obligations.length,
      ruleCount: uniqueObligations.length,
      categorySummary,
      meta: {
        engineVersion: '1.0',
        createdAt: new Date().toISOString(),
        processingTime,
      },
    };

    console.log('[RuleEngine] Rule evaluation completed', {
      totalObligations: obligations.length,
      uniqueRules: uniqueObligations.length,
      categories: Object.keys(categoryTriggers),
      processingTime,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[RuleEngine] Error during rule evaluation', error);

    // Return graceful error result
    return {
      obligations: [],
      uniqueObligations: [],
      obligationCount: 0,
      ruleCount: 0,
      categorySummary: {},
      meta: {
        engineVersion: '1.0',
        createdAt: new Date().toISOString(),
        processingTime: Date.now() - startTime,
      },
    };
  }
}

/**
 * Get Rule Engine metadata
 * Describes engine capabilities
 */
export function getRuleEngineMetadata() {
  return {
    id: 'ruleEngine',
    name: 'Rule Engine',
    version: '1.0',
    description: 'Evaluate declarative rules based on lot categories',
    capabilities: [
      'Category-based obligation inference',
      'Obligation deduplication',
      'Category summary',
      'Rule composition',
    ],
    inputs: ['normalizedLots from lotEngine'],
    outputs: ['obligations', 'uniqueObligations', 'ruleCount'],
    dependencies: ['lotEngine', 'contextEngine'],
    rules: {
      electricite: [
        'Vérifier conformité NFC 15-100',
        'Vérifier déclaration conformité électrique',
        'Vérifier assurance responsabilité civile',
      ],
      plomberie: [
        'Vérifier conformité normes eau potable',
        'Vérifier assurance dommages',
      ],
      toiture: [
        'Vérifier déclaration préalable en mairie',
        'Vérifier conformité code construction',
        'Vérifier couverture assurance décennale',
      ],
      generic: [
        'Établir devis détaillé',
        'Vérifier garanties décennales',
      ],
    },
  };
}

/**
 * Rule Engine v1.0
 * Minimal rule evaluation engine for declarative obligations
 * Pure structuring - no AI, no external APIs, no Supabase, no scoring
 */

import { EngineExecutionContext } from '@/core/platform/engineExecutionContext';
import { getRulesByCategory, getRuleById } from '@/core/rules/ruleRegistry';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

/**
 * Rule obligation structure with type, severity and weight
 */
export interface RuleObligation {
  id: string;
  category: string;
  obligation: string;
  ruleType: 'legal' | 'regulatory' | 'advisory' | 'commercial';
  severity: 'low' | 'medium' | 'high' | 'critical';
  weight: number;
  source?: string;
}

/**
 * Rule Engine result with weighted obligations and type classification
 */
export interface RuleEngineResult {
  obligations: string[];
  uniqueObligations: string[];
  detailedObligations: RuleObligation[];
  uniqueDetailedObligations: RuleObligation[];
  obligationCount: number;
  ruleCount: number;
  totalWeight: number;
  severityBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  typeBreakdown: {
    legal: number;
    regulatory: number;
    advisory: number;
    commercial: number;
  };
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
 * Output: Set of obligations with severity and weight for scoring
 */
export async function runRuleEngine(
  executionContext: EngineExecutionContext
): Promise<RuleEngineResult> {
  const startTime = Date.now();

  try {
    log('[RuleEngine] Starting rule evaluation');

    // Extract normalized lots from execution context
    const normalizedLots = executionContext.lots?.normalizedLots || [];

    // Collect obligations based on lot categories
    const obligations: string[] = [];
    const detailedObligations: RuleObligation[] = [];
    const categoryTriggers: Record<string, number> = {};
    let totalWeight = 0;

    const severityBreakdown = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    const typeBreakdown = {
      legal: 0,
      regulatory: 0,
      advisory: 0,
      commercial: 0,
    };

    normalizedLots.forEach((lot: any) => {
      const category = lot.category || 'unknown';

      // Track which categories trigger rules
      categoryTriggers[category] = (categoryTriggers[category] || 0) + 1;

      // Get rules for this category from the centralized registry
      const rules = getRulesByCategory(category);

      // Collect obligations from matching rules with type, severity and weight
      rules.forEach((rule) => {
        obligations.push(rule.obligation);

        const detailedObligation: RuleObligation = {
          id: rule.id,
          category: rule.category,
          obligation: rule.obligation,
          ruleType: rule.ruleType,
          severity: rule.severity,
          weight: rule.weight,
          source: rule.source,
        };

        detailedObligations.push(detailedObligation);
        totalWeight += rule.weight;
        severityBreakdown[rule.severity]++;
        typeBreakdown[rule.ruleType]++;
      });
    });

    // Deduplicate obligations while preserving order
    const uniqueObligations = Array.from(new Set(obligations));

    // Deduplicate detailed obligations by ID (preserve detailed info, eliminate duplicates)
    const seenIds = new Set<string>();
    const uniqueDetailedObligations: RuleObligation[] = [];

    detailedObligations.forEach((oblig) => {
      if (!seenIds.has(oblig.id)) {
        seenIds.add(oblig.id);
        uniqueDetailedObligations.push(oblig);
      }
    });

    // Build category summary
    const categorySummary = categoryTriggers;

    const processingTime = Date.now() - startTime;

    const result: RuleEngineResult = {
      obligations,
      uniqueObligations,
      detailedObligations,
      uniqueDetailedObligations,
      obligationCount: obligations.length,
      ruleCount: uniqueObligations.length,
      totalWeight,
      severityBreakdown,
      typeBreakdown,
      categorySummary,
      meta: {
        engineVersion: '1.0',
        createdAt: new Date().toISOString(),
        processingTime,
      },
    };

    log('[RuleEngine] Rule evaluation completed', {
      totalObligations: obligations.length,
      uniqueRules: uniqueObligations.length,
      totalWeight,
      severityBreakdown,
      typeBreakdown,
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
      detailedObligations: [],
      uniqueDetailedObligations: [],
      obligationCount: 0,
      ruleCount: 0,
      totalWeight: 0,
      severityBreakdown: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      typeBreakdown: {
        legal: 0,
        regulatory: 0,
        advisory: 0,
        commercial: 0,
      },
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

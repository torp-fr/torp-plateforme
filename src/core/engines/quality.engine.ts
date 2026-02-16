/**
 * Quality Engine v1.0
 * Evaluate quote professional quality
 * Pure rule-based scoring - no external APIs
 */

import { EngineExecutionContext } from '@/core/platform/engineExecutionContext';

/**
 * Quality breakdown scores
 */
export interface QualityBreakdown {
  descriptionScore: number;   // 0-5: Description completeness
  materialsScore: number;     // 0-5: Materials specification
  legalMentionsScore: number; // 0-5: Legal mentions
  clarityScore: number;       // 0-5: Breakdown clarity
}

/**
 * Quality Engine Result
 */
export interface QualityEngineResult {
  qualityScore: number;      // 0-20 raw
  breakdown: QualityBreakdown;
  normalizedScore: number;   // 0-20 normalized
  meta: {
    engineVersion: string;
    createdAt: string;
  };
}

/**
 * Calculate description score
 */
function calculateDescriptionScore(context: EngineExecutionContext): number {
  try {
    const projectData = context.projectData || {};
    const description = projectData.description || '';

    if (typeof description === 'string') {
      const wordCount = description.split(/\s+/).filter((w) => w.length > 0).length;

      // Excellent if 100+ words
      if (wordCount >= 100) {
        return 5;
      }

      // Good if 50+ words
      if (wordCount >= 50) {
        return 4;
      }

      // Partial if 20+ words
      if (wordCount >= 20) {
        return 2;
      }
    }

    return 0;
  } catch (error) {
    console.warn('[QualityEngine] Error calculating description score', error);
    return 0;
  }
}

/**
 * Calculate materials score
 */
function calculateMaterialsScore(context: EngineExecutionContext): number {
  try {
    const materials = context.projectData?.materials || null;

    if (materials) {
      if (Array.isArray(materials) && materials.length > 0) {
        return 5;
      }

      if (typeof materials === 'string' && materials.length > 20) {
        return 5;
      }
    }

    return 0;
  } catch (error) {
    console.warn('[QualityEngine] Error calculating materials score', error);
    return 0;
  }
}

/**
 * Calculate legal mentions score
 */
function calculateLegalMentionsScore(context: EngineExecutionContext): number {
  try {
    const projectData = context.projectData || {};
    const description = projectData.description || '';
    const legalMentions = projectData.legalMentions || [];

    // Check for keywords in description
    const legalKeywords = [
      'norme',
      'conformit',
      'legal',
      'droit',
      'r\u00e9glementation',
      'article',
      'loi',
      'd\u00e9cret',
      'obligation',
    ];

    let keywordCount = 0;

    if (typeof description === 'string') {
      const lowerDesc = description.toLowerCase();
      keywordCount = legalKeywords.filter((kw) => lowerDesc.includes(kw)).length;
    }

    // Also count explicit legal mentions
    const totalMentions = keywordCount + (Array.isArray(legalMentions) ? legalMentions.length : 0);

    // Excellent if 3+ mentions
    if (totalMentions >= 3) {
      return 5;
    }

    // Good if 1-2 mentions
    if (totalMentions >= 1) {
      return 3;
    }

    return 0;
  } catch (error) {
    console.warn('[QualityEngine] Error calculating legal mentions score', error);
    return 0;
  }
}

/**
 * Calculate clarity score based on breakdown structure
 */
function calculateClarityScore(context: EngineExecutionContext): number {
  try {
    const lotsCount = context.lots?.normalizedLots?.length || 0;
    const obligationCount = context.rules?.obligationCount || 0;
    const lineItems = context.projectData?.lineItems || [];

    let clarityScore = 0;

    // Points for lot breakdown
    if (lotsCount >= 2) {
      clarityScore += 2;
    } else if (lotsCount === 1) {
      clarityScore += 1;
    }

    // Points for obligation clarity
    if (obligationCount >= 5) {
      clarityScore += 2;
    } else if (obligationCount >= 2) {
      clarityScore += 1;
    }

    // Points for line item structure
    if (Array.isArray(lineItems) && lineItems.length >= 5) {
      clarityScore += 1;
    }

    return Math.min(clarityScore, 5);
  } catch (error) {
    console.warn('[QualityEngine] Error calculating clarity score', error);
    return 0;
  }
}

/**
 * Run Quality Engine
 */
export async function runQualityEngine(
  executionContext: EngineExecutionContext
): Promise<QualityEngineResult> {
  const startTime = Date.now();

  try {
    console.log('[QualityEngine] Starting quality evaluation');

    // Calculate individual scores
    const descriptionScore = calculateDescriptionScore(executionContext);
    const materialsScore = calculateMaterialsScore(executionContext);
    const legalMentionsScore = calculateLegalMentionsScore(executionContext);
    const clarityScore = calculateClarityScore(executionContext);

    // Calculate raw total (5+5+5+5 = 0-20)
    const qualityScore = descriptionScore + materialsScore + legalMentionsScore + clarityScore;

    // Normalize to 0-20
    const normalizedScore = Math.min(Math.max(qualityScore, 0), 20);

    const result: QualityEngineResult = {
      qualityScore,
      breakdown: {
        descriptionScore,
        materialsScore,
        legalMentionsScore,
        clarityScore,
      },
      normalizedScore,
      meta: {
        engineVersion: '1.0',
        createdAt: new Date().toISOString(),
      },
    };

    console.log('[QualityEngine] Evaluation complete', {
      qualityScore: result.qualityScore,
      normalizedScore: result.normalizedScore,
      processingTime: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    console.error('[QualityEngine] Unexpected error', error);

    // Return fallback result
    return {
      qualityScore: 0,
      breakdown: {
        descriptionScore: 0,
        materialsScore: 0,
        legalMentionsScore: 0,
        clarityScore: 0,
      },
      normalizedScore: 0,
      meta: {
        engineVersion: '1.0',
        createdAt: new Date().toISOString(),
      },
    };
  }
}

/**
 * Get Quality Engine metadata
 */
export function getQualityEngineMetadata() {
  return {
    id: 'qualityEngine',
    name: 'Quality Engine',
    version: '1.0',
    description: 'Evaluate quote professional quality',
    scoringMaximum: 20,
    breakdown: {
      descriptionScore: { max: 5, description: 'Project description completeness' },
      materialsScore: { max: 5, description: 'Materials specification' },
      legalMentionsScore: { max: 5, description: 'Legal/regulatory mentions' },
      clarityScore: { max: 5, description: 'Breakdown clarity' },
    },
    thresholds: {
      descriptionWords: '100+ words = 5pts, 50+ = 4pts, 20+ = 2pts',
      materialsRequired: 'Array of items or 20+ char string',
      legalKeywords: [
        'norme',
        'conformité',
        'legal',
        'droit',
        'réglementation',
        'article',
        'loi',
        'décret',
        'obligation',
      ],
      clarityLots: '2+ lots = 2pts, 1 lot = 1pt',
    },
  };
}

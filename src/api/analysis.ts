/**
 * Analysis API
 * Endpoints pour les commandes d'analyse automatisées
 */

import { getCurrentUser } from '@/lib/supabase';
import { analysisCommands } from '@/services/analysis';
import type { ExtractedQuote } from '@/services/scoring/contextual-scoring.service';
import type { WorkType } from '@/types/ProjectContext';

/**
 * Analyser un devis complet avec contexte
 * POST /api/analysis/analyze
 */
export async function analyzeQuote(
  projectContextId: string,
  quote: ExtractedQuote
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const result = await analysisCommands.analyzeQuoteCommand(
      projectContextId,
      quote
    );

    return result;
  } catch (error) {
    console.error('❌ Analyze quote error:', error);
    throw error;
  }
}

/**
 * Rechercher documents par type de travail
 * GET /api/analysis/search?workType=peinture
 */
export async function searchByWorkType(workType: WorkType) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const results = await analysisCommands.searchByWorkTypeCommand(workType);
    return results;
  } catch (error) {
    console.error('❌ Search error:', error);
    throw error;
  }
}

/**
 * Récupérer tarifs régionaux
 * GET /api/analysis/pricing/:region?workType=peinture
 */
export async function getPricingByRegion(
  region: string,
  workType?: WorkType
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const results = await analysisCommands.getPricingByRegionCommand(
      region,
      workType
    );

    return results;
  } catch (error) {
    console.error('❌ Pricing error:', error);
    throw error;
  }
}

/**
 * Valider un devis contre les normes
 * POST /api/analysis/validate
 */
export async function validateQuote(
  quote: ExtractedQuote,
  workType: WorkType
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const validation = await analysisCommands.validateAgainstNormsCommand(
      quote,
      workType
    );

    return validation;
  } catch (error) {
    console.error('❌ Validation error:', error);
    throw error;
  }
}

/**
 * Générer recommandations
 * POST /api/analysis/:projectContextId/recommendations
 */
export async function generateRecommendations(
  projectContextId: string,
  score: any
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const recommendations = await analysisCommands.generateRecommendationsCommand(
      score,
      projectContextId
    );

    return recommendations;
  } catch (error) {
    console.error('❌ Recommendations error:', error);
    throw error;
  }
}

/**
 * Récupérer l'historique des analyses
 * GET /api/analysis/:projectContextId/history
 */
export async function getAnalysisHistory(projectContextId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const history = await analysisCommands.getAnalysisHistoryCommand(
      projectContextId
    );

    return history;
  } catch (error) {
    console.error('❌ History error:', error);
    throw error;
  }
}

/**
 * Recherche complexe multi-critères
 * POST /api/analysis/search-complex
 */
export async function complexSearch(
  query: string,
  projectContextId?: string
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const results = await analysisCommands.complexSearchCommand(
      query,
      projectContextId
    );

    return results;
  } catch (error) {
    console.error('❌ Complex search error:', error);
    throw error;
  }
}

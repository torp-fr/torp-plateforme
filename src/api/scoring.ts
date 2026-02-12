/**
 * Scoring API
 * Endpoints pour l'analyse et le scoring des devis avec contexte
 */

import { getCurrentUser } from '@/lib/supabase';
import { contextualScoringService } from '@/services/scoring';
import type { ExtractedQuote } from '@/services/scoring/contextual-scoring.service';

/**
 * Analyser un devis avec contexte complet
 */
export async function analyzeQuoteWithContext(
  quote: ExtractedQuote,
  projectContextId: string
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const result = await contextualScoringService.scoreQuoteWithContext(
      quote,
      projectContextId
    );

    return result;
  } catch (error) {
    console.error('❌ Scoring error:', error);
    throw error;
  }
}

/**
 * Analyser un devis sans contexte projet (fallback)
 */
export async function analyzeQuote(quote: ExtractedQuote) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    // Sans contexte, retourner un résultat basique
    return {
      globalScore: 500,
      maxScore: 1000,
      grade: 'C',
      pourcentage: 50,
      pointsForts: [],
      pointsFaibles: ['Pas de contexte projet fourni'],
      recommandations: ['Créer un contexte projet pour une analyse précise'],
      kbReferences: [],
      analyzedAt: new Date().toISOString(),
      contextUsed: {
        projectType: 'unknown',
        workTypes: [],
        kbChunksUsed: 0,
      },
    };
  } catch (error) {
    console.error('❌ Analysis error:', error);
    throw error;
  }
}

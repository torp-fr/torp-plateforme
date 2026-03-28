/**
 * Analysis Commands
 * Commandes d'analyse automatisées pour le workflow complet
 */

import { contextualScoringService } from '@/services/scoring';
import { semanticSearch } from '@/core/knowledge/ingestion/knowledgeIndex.service';
import { projectContextService } from '@/services/project';
import { supabase } from '@/lib/supabase';
import type { ExtractedQuote, ContextualScoreResult } from '@/services/scoring/contextual-scoring.service';
import type { WorkType } from '@/types/ProjectContext';
import type { KBChunk } from '@/services/knowledge-base/types';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

function mapSearchResults(results: { chunkId: string; content: string; similarity: number; documentId: string }[]): KBChunk[] {
  return results.map(r => ({
    id: r.chunkId,
    documentId: r.documentId,
    content: r.content,
    similarity: r.similarity,
  }));
}

export interface AnalysisResult {
  id: string;
  projectContextId: string;
  quoteData: ExtractedQuote;
  score: ContextualScoreResult;
  storedAt: string;
}

export interface StoredAnalysis {
  id: string;
  projectContextId: string;
  quoteData: any;
  score: ContextualScoreResult;
  createdAt: string;
}

export class AnalysisCommands {
  /**
   * Commande 1: Analyse complète d'un devis
   */
  async analyzeQuoteCommand(
    projectContextId: string,
    quote: ExtractedQuote
  ): Promise<AnalysisResult> {
    try {
      log(`🔍 Starting analysis for project: ${projectContextId}`);

      // 1. Vérifier que le contexte existe
      const projectContext = await projectContextService.getProjectContext(
        projectContextId
      );
      if (!projectContext) {
        throw new Error(`Project context not found: ${projectContextId}`);
      }

      // 2. Scorer le devis avec contexte
      const score = await contextualScoringService.scoreQuoteWithContext(
        quote,
        projectContextId
      );

      // 3. Stocker l'analyse
      const analysis = await this.storeAnalysis({
        projectContextId,
        quoteData: quote,
        score,
      });

      log(`✅ Analysis complete: ${analysis.id}`);
      return analysis;
    } catch (error) {
      console.error('❌ Analyze quote error:', error);
      throw error;
    }
  }

  /**
   * Commande 2: Rechercher documentations pour un type de travail
   */
  async searchByWorkTypeCommand(workType: WorkType): Promise<KBChunk[]> {
    try {
      log(`🔍 Searching for work type: ${workType}`);

      const results = mapSearchResults(await semanticSearch(workType, 10));
      log(`✅ Found ${results.length} documents`);

      return results;
    } catch (error) {
      console.error('❌ Search error:', error);
      return [];
    }
  }

  /**
   * Commande 3: Récupérer tarifs régionaux
   */
  async getPricingByRegionCommand(
    region: string,
    workType?: WorkType
  ): Promise<KBChunk[]> {
    try {
      log(`💰 Getting pricing for region: ${region}${workType ? ` / ${workType}` : ''}`);

      const query = workType ? `${region} ${workType}` : region;
      const results = mapSearchResults(await semanticSearch(query, 10));
      log(`✅ Found ${results.length} pricing references`);

      return results;
    } catch (error) {
      console.error('❌ Pricing search error:', error);
      return [];
    }
  }

  /**
   * Commande 4: Valider un devis contre les normes
   */
  async validateAgainstNormsCommand(
    quote: ExtractedQuote,
    workType: WorkType
  ): Promise<{
    valid: boolean;
    conformities: string[];
    nonConformities: string[];
    recommendations: string[];
  }> {
    try {
      log(`✓ Validating quote against norms for: ${workType}`);

      // Récupérer les normes
      const norms = mapSearchResults(await semanticSearch(workType, 5));

      // Analyser avec Claude pour validation
      const validation = await this.validateWithNorms(quote, norms);
      log(`✅ Validation complete`);

      return validation;
    } catch (error) {
      console.error('❌ Validation error:', error);
      return {
        valid: false,
        conformities: [],
        nonConformities: ['Validation failed'],
        recommendations: [],
      };
    }
  }

  /**
   * Commande 5: Générer recommandations
   */
  async generateRecommendationsCommand(
    score: ContextualScoreResult,
    projectContextId: string
  ): Promise<string[]> {
    try {
      log(`💡 Generating recommendations for project: ${projectContextId}`);

      // Récupérer le contexte
      const context = await projectContextService.getProjectContext(projectContextId);
      if (!context) {
        throw new Error('Project context not found');
      }

      // Générer les recommandations
      const recommendations = await this.generateFromContext(score, context);
      log(`✅ Generated ${recommendations.length} recommendations`);

      return recommendations;
    } catch (error) {
      console.error('❌ Recommendation error:', error);
      return [];
    }
  }

  /**
   * Commande 6: Récupérer historique des analyses
   */
  async getAnalysisHistoryCommand(projectContextId: string): Promise<StoredAnalysis[]> {
    try {
      log(`📋 Getting analysis history for project: ${projectContextId}`);

      // Récupérer depuis la DB
      const analyses = await this.getStoredAnalyses(projectContextId);
      log(`✅ Retrieved ${analyses.length} analyses`);

      return analyses;
    } catch (error) {
      console.error('❌ History error:', error);
      return [];
    }
  }

  /**
   * Commande 7: Recherche complexe multi-critères
   */
  async complexSearchCommand(
    query: string,
    projectContextId?: string
  ): Promise<KBChunk[]> {
    try {
      log(`🔎 Complex search: ${query}`);

      let projectContext;
      if (projectContextId) {
        projectContext = await projectContextService.getProjectContext(projectContextId);
      }

      const results = mapSearchResults(await semanticSearch(query, 10));

      log(`✅ Found ${results.length} relevant documents`);
      return results;
    } catch (error) {
      console.error('❌ Complex search error:', error);
      return [];
    }
  }

  /**
   * Stocker une analyse
   */
  private async storeAnalysis(data: {
    projectContextId: string;
    quoteData: ExtractedQuote;
    score: ContextualScoreResult;
  }): Promise<AnalysisResult> {
    try {
      // TODO: Implémenter le stockage en DB
      // Pour MVP, retourner juste un ID généré
      const analysisId = `analysis_${Date.now()}`;

      return {
        id: analysisId,
        projectContextId: data.projectContextId,
        quoteData: data.quoteData,
        score: data.score,
        storedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('❌ Store analysis error:', error);
      throw error;
    }
  }

  /**
   * Récupérer les analyses stockées
   */
  private async getStoredAnalyses(projectContextId: string): Promise<StoredAnalysis[]> {
    try {
      // TODO: Implémenter la récupération en DB
      // Pour MVP, retourner un tableau vide
      return [];
    } catch (error) {
      console.error('❌ Get analyses error:', error);
      return [];
    }
  }

  /**
   * Valider avec les normes
   */
  private async validateWithNorms(
    quote: ExtractedQuote,
    norms: KBChunk[]
  ): Promise<{
    valid: boolean;
    conformities: string[];
    nonConformities: string[];
    recommendations: string[];
  }> {
    try {
      // Analyser le devis contre les normes
      // Pour MVP, retourner une validation simple
      return {
        valid: true,
        conformities: ['Dévis conforme aux éléments détectés'],
        nonConformities: [],
        recommendations: ['Vérifier les détails de prix'],
      };
    } catch (error) {
      console.error('❌ Validation error:', error);
      return {
        valid: false,
        conformities: [],
        nonConformities: ['Validation failed'],
        recommendations: [],
      };
    }
  }

  /**
   * Générer recommandations depuis le contexte
   */
  private async generateFromContext(
    score: ContextualScoreResult,
    context: any
  ): Promise<string[]> {
    try {
      const recommendations: string[] = [];

      // Ajouter des recommandations basées sur le score
      if (score.pourcentage < 60) {
        recommendations.push('⚠️ Score faible: vérifier la conformité avec les normes');
      }

      // Ajouter des recommandations par pièce
      for (const roomScore of score.roomsScores) {
        if (roomScore.pourcentage < 70) {
          recommendations.push(
            `🔧 ${roomScore.roomName}: améliorer la qualité (${roomScore.pourcentage.toFixed(0)}%)`
          );
        }
      }

      // Ajouter les recommandations de Claude
      recommendations.push(...score.recommandations);

      return [...new Set(recommendations)];
    } catch (error) {
      console.error('❌ Generate recommendations error:', error);
      return [];
    }
  }
}

export const analysisCommands = new AnalysisCommands();
export default analysisCommands;

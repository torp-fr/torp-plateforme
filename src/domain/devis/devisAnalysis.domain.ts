/**
 * DOMAIN LAYER: Devis Analysis
 *
 * PHASE 37: Domain-Driven Design - Business Logic Orchestration
 *
 * Responsibilité:
 * - Orchestrer le flux métier complet: Upload → Analyse → Enrichissement → Scoring
 * - Isoler la logique métier de la couche d'accès aux données
 * - Coordonner les appels aux services AI (torpAnalyzer, knowledgeBrain)
 *
 * Points clés:
 * - NE PAS modifier aiOrchestrator (reste inchangé)
 * - NE PAS modifier telemetry (reste transparent)
 * - Orchestrateur métier uniquement (business logic layer)
 * - Contrats clairs: Input → Domain → Output
 *
 * Flux:
 * 1. Réception données (texte PDF, métadonnées projet)
 * 2. Vectorization contexte projet (DEMAND)
 * 3. Extraction données structurées devis (PROPOSITION)
 * 4. Analyse TORP (profondeur métier)
 * 5. Enrichissement knowledge brain (contexte)
 * 6. Structure scoring préparé
 * 7. Retour résultat à l'infrastructure
 */

import type {
  TorpAnalysisResult,
  ExtractedDevisData,
} from '@/services/ai/torp-analyzer.service';

import { torpAnalyzerService } from '@/services/ai/torp-analyzer.service';
import { knowledgeBrainService } from '@/services/ai/knowledge-brain.service';

import type {
  ProjectContextEmbeddings,
  DevisProposalVector,
  ComparisonResult,
} from '@/services/ai/embeddings';
import {
  projectContextEmbeddingsService,
  devisProposalEmbeddingsService,
} from '@/services/ai/embeddings';

// ============================================================================
// DOMAIN INTERFACES - Contrats métier
// ============================================================================

/**
 * Input métier: données nécessaires pour analyser un devis
 */
export interface DevisAnalysisInput {
  // Données essentielles
  devisText: string; // Texte extrait du PDF
  devisId: string; // Identifiant unique du devis
  userId: string; // Propriétaire du devis

  // Métadonnées projet (optionnel mais recommandé)
  projectMetadata?: {
    nom?: string; // Nom du projet
    typeTravaux?: string; // Type de travaux
    budget?: string | number; // Budget
    surface?: number | string; // Surface
    description?: string; // Description
    delaiSouhaite?: string; // Délai
    urgence?: string; // Urgence (high, medium, low)
    contraintes?: string; // Contraintes
    userType?: 'B2B' | 'B2C' | 'admin'; // Type d'utilisateur
  };

  // Configuration analyse
  analyzeOptions?: {
    includeKnowledgeEnrichment?: boolean; // Incluir enrichissement knowledge brain (défaut: true)
    includeMarketComparison?: boolean; // Incluir comparaison marché (défaut: true)
  };
}

/**
 * Résultat métier: structure complète d'analyse
 */
export interface DevisAnalysisOutput {
  // Identification
  devisId: string;
  userId: string;
  analyzedAt: string;
  dureeAnalyse: number; // en secondes

  // Extraction structurée (PROPOSITION)
  extractedData: ExtractedDevisData | null;
  proposalEmbeddings: DevisProposalVector | null;

  // Vectorisation contexte (DEMAND)
  demandEmbeddings: ProjectContextEmbeddings | null;

  // Comparaison DEMAND vs PROPOSITION
  demandVsProposalComparison: ComparisonResult | null;

  // Analyse TORP complète
  torAnalysisResult: TorpAnalysisResult;

  // Enrichissement knowledge brain
  knowledgeEnrichment?: {
    similarDocuments: Array<{
      id: string;
      relevanceScore: number;
      context: string;
    }>;
    contextualInsights: string[];
  };

  // Scoring préparé pour persistence
  scoringStructure: {
    scoreGlobal: number;
    grade: string;
    scoreEntreprise: number;
    scorePrix: number;
    scoreCompletude: number;
    scoreConformite: number;
    scoreDelais: number;
    scoreInnovationDurable: number | null;
    scoreTransparence: number | null;
  };

  // Métadonnées d'exécution
  executionMetadata: {
    extractionSuccess: boolean;
    vectorizationSuccess: boolean;
    analysisSuccess: boolean;
    enrichmentSuccess: boolean;
    errors: Array<{
      stage: string;
      message: string;
      severity: 'error' | 'warning';
    }>;
  };
}

// ============================================================================
// DOMAIN SERVICE
// ============================================================================

export class DevisAnalysisDomain {
  /**
   * Orchestrer l'analyse complète d'un devis
   *
   * @param input - Données d'entrée métier
   * @returns Résultat d'analyse structuré
   *
   * Étapes:
   * 1. Extraire données structurées (PROPOSITION)
   * 2. Vectoriser contexte projet (DEMAND)
   * 3. Comparer DEMAND vs PROPOSITION
   * 4. Analyser avec TORP
   * 5. Enrichir avec knowledge brain
   * 6. Préparer structure scoring
   */
  static async analyzeDevis(input: DevisAnalysisInput): Promise<DevisAnalysisOutput> {
    const startTime = Date.now();
    const errors: Array<{ stage: string; message: string; severity: 'error' | 'warning' }> = [];

    console.log(`[DOMAIN] Starting devis analysis for ${input.devisId}...`);

    // --------
    // STEP 1: Extract structured data (PROPOSITION)
    // --------
    let extractedData: ExtractedDevisData | null = null;
    let proposalEmbeddings: DevisProposalVector | null = null;

    try {
      console.log(`[DOMAIN] STEP 1 - Extracting proposal data...`);
      extractedData = await torpAnalyzerService.extractDevisDataDirect(input.devisText);

      if (extractedData) {
        proposalEmbeddings = devisProposalEmbeddingsService.vectorizeDevisProposal(extractedData);
        console.log(`[DOMAIN] ✅ Proposal extracted and vectorized`);
      } else {
        console.warn(`[DOMAIN] ⚠️ No extracted data from devis`);
        errors.push({
          stage: 'extraction',
          message: 'Could not extract structured data from devis text',
          severity: 'warning',
        });
      }
    } catch (error) {
      console.error(`[DOMAIN] ❌ Extraction failed:`, error);
      errors.push({
        stage: 'extraction',
        message: error instanceof Error ? error.message : 'Unknown extraction error',
        severity: 'error',
      });
    }

    // --------
    // STEP 2: Vectorize project context (DEMAND)
    // --------
    let demandEmbeddings: ProjectContextEmbeddings | null = null;

    if (input.projectMetadata?.nom || input.projectMetadata?.typeTravaux) {
      try {
        console.log(`[DOMAIN] STEP 2 - Vectorizing project context (DEMAND)...`);

        const projectContextData = {
          name: input.projectMetadata?.nom || '',
          type: input.projectMetadata?.typeTravaux || '',
          budget: input.projectMetadata?.budget,
          surface:
            typeof input.projectMetadata?.surface === 'number'
              ? String(input.projectMetadata.surface)
              : input.projectMetadata?.surface,
          startDate: undefined,
          endDate: input.projectMetadata?.delaiSouhaite,
          description: input.projectMetadata?.description,
          urgency: input.projectMetadata?.urgence,
          constraints: input.projectMetadata?.contraintes,
        };

        demandEmbeddings = projectContextEmbeddingsService.vectorizeProjectContext(projectContextData);
        console.log(`[DOMAIN] ✅ Project context vectorized (DEMAND)`);
      } catch (error) {
        console.error(`[DOMAIN] ⚠️ Demand vectorization failed:`, error);
        errors.push({
          stage: 'demand_vectorization',
          message: error instanceof Error ? error.message : 'Unknown vectorization error',
          severity: 'warning',
        });
      }
    } else {
      console.log(`[DOMAIN] ⓘ No project metadata provided, skipping DEMAND vectorization`);
    }

    // --------
    // STEP 3: Compare DEMAND vs PROPOSITION
    // --------
    let demandVsProposalComparison: ComparisonResult | null = null;

    if (demandEmbeddings && proposalEmbeddings) {
      try {
        console.log(`[DOMAIN] STEP 3 - Comparing DEMAND vs PROPOSITION...`);
        demandVsProposalComparison = devisProposalEmbeddingsService.compareVectors(
          demandEmbeddings,
          proposalEmbeddings
        );
        console.log(`[DOMAIN] ✅ Comparison complete (Alignment: ${demandVsProposalComparison.alignmentScore}/100)`);
      } catch (error) {
        console.error(`[DOMAIN] ⚠️ Comparison failed:`, error);
        errors.push({
          stage: 'demand_proposal_comparison',
          message: error instanceof Error ? error.message : 'Unknown comparison error',
          severity: 'warning',
        });
      }
    }

    // --------
    // STEP 4: TORP Analysis
    // --------
    let torAnalysisResult: TorpAnalysisResult;

    try {
      console.log(`[DOMAIN] STEP 4 - Running TORP analysis...`);

      const enrichedMetadata = {
        ...input.projectMetadata,
        userType: input.projectMetadata?.userType || 'B2C',
      };

      torAnalysisResult = await torpAnalyzerService.analyzeDevis(input.devisText, enrichedMetadata as any);

      console.log(`[DOMAIN] ✅ TORP analysis complete (Score: ${torAnalysisResult.scoreGlobal}/1000 - ${torAnalysisResult.grade})`);
    } catch (error) {
      console.error(`[DOMAIN] ❌ TORP analysis failed:`, error);
      errors.push({
        stage: 'torp_analysis',
        message: error instanceof Error ? error.message : 'Unknown TORP analysis error',
        severity: 'error',
      });
      throw error; // TORP analysis is critical, must not fail
    }

    // --------
    // STEP 5: Knowledge Brain Enrichment (optional)
    // --------
    let knowledgeEnrichment: DevisAnalysisOutput['knowledgeEnrichment'] = undefined;

    if (input.analyzeOptions?.includeKnowledgeEnrichment !== false) {
      try {
        console.log(`[DOMAIN] STEP 5 - Enriching with knowledge brain...`);

        // Search for similar documents in knowledge brain
        const searchQuery = `${input.projectMetadata?.typeTravaux || ''} ${input.projectMetadata?.description || ''}`.trim();

        if (searchQuery.length > 5) {
          // Only search if we have meaningful query
          const similarDocs = await knowledgeBrainService.searchSimilarDocuments(
            searchQuery,
            {
              limit: 3,
              minRelevance: 0.5,
            }
          );

          knowledgeEnrichment = {
            similarDocuments: similarDocs.map((doc) => ({
              id: doc.id,
              relevanceScore: doc.relevanceScore,
              context: doc.content.substring(0, 200), // Preview
            })),
            contextualInsights: [
              `Basé sur ${similarDocs.length} documents similaires trouvés`,
              'Enrichissement complété avec le knowledge brain',
            ],
          };

          console.log(`[DOMAIN] ✅ Knowledge enrichment complete (${similarDocs.length} documents trouvés)`);
        }
      } catch (error) {
        console.warn(`[DOMAIN] ⚠️ Knowledge enrichment failed:`, error);
        errors.push({
          stage: 'knowledge_enrichment',
          message: error instanceof Error ? error.message : 'Unknown enrichment error',
          severity: 'warning',
        });
      }
    }

    // --------
    // STEP 6: Prepare scoring structure
    // --------
    const scoringStructure = {
      scoreGlobal: torAnalysisResult.scoreGlobal,
      grade: torAnalysisResult.grade,
      scoreEntreprise: torAnalysisResult.scoreEntreprise?.fiabilite || 0,
      scorePrix: torAnalysisResult.scorePrix?.vsMarche || 0,
      scoreCompletude: torAnalysisResult.scoreCompletude?.justificatifs || 0,
      scoreConformite: torAnalysisResult.scoreConformite?.legal || 0,
      scoreDelais: torAnalysisResult.scoreDelais?.stabilite || 0,
      scoreInnovationDurable: torAnalysisResult.scoreInnovationDurable || null,
      scoreTransparence: torAnalysisResult.scoreTransparence || null,
    };

    const dureeAnalyse = Math.round((Date.now() - startTime) / 1000);

    console.log(`[DOMAIN] ✅ Analysis complete (${dureeAnalyse}s total, ${errors.length} warning(s))`);

    // --------
    // Return structured result
    // --------
    return {
      devisId: input.devisId,
      userId: input.userId,
      analyzedAt: new Date().toISOString(),
      dureeAnalyse,

      extractedData,
      proposalEmbeddings,

      demandEmbeddings,
      demandVsProposalComparison,

      torAnalysisResult,

      knowledgeEnrichment,

      scoringStructure,

      executionMetadata: {
        extractionSuccess: extractedData !== null,
        vectorizationSuccess: demandEmbeddings !== null || proposalEmbeddings !== null,
        analysisSuccess: torAnalysisResult !== null,
        enrichmentSuccess: knowledgeEnrichment !== undefined,
        errors,
      },
    };
  }

  /**
   * Extraire juste les données structurées sans analyse complète
   * (Utile pour validation précoce)
   */
  static async extractDevisDataOnly(devisText: string): Promise<ExtractedDevisData | null> {
    try {
      console.log(`[DOMAIN] Extracting devis data only...`);
      return await torpAnalyzerService.extractDevisDataDirect(devisText);
    } catch (error) {
      console.error(`[DOMAIN] Extraction failed:`, error);
      return null;
    }
  }
}

// ============================================================================
// CONVENIENCE EXPORT - fonction publique
// ============================================================================

/**
 * Analyse un devis en passant par la couche domain métier
 * @param input Données d'entrée structurées
 * @returns Résultat d'analyse complet
 */
export async function analyzeDevisDomain(input: DevisAnalysisInput): Promise<DevisAnalysisOutput> {
  return DevisAnalysisDomain.analyzeDevis(input);
}

/**
 * Supabase Devis Service
 * Real devis/quotes management using Supabase
 */

import { supabase } from '@/lib/supabase';
import { env } from '@/config/env';
import { DevisData, TorpAnalysisResult } from '@/types/torp';
import type { Database } from '@/types/supabase';
import { STORAGE_BUCKETS } from '@/constants/storage';
import { pdfExtractorService } from '@/services/pdf/pdf-extractor.service';
import { torpAnalyzerService } from '@/services/ai/torp-analyzer.service';
import {
  projectContextEmbeddingsService,
  devisProposalEmbeddingsService,
  type ProjectContextData,
  type ProjectContextEmbeddings,
  type DevisProposalVector,
  type ComparisonResult,
} from '@/services/ai/embeddings';

type DbDevis = Database['public']['Tables']['devis']['Row'];
type DbDevisInsert = Database['public']['Tables']['devis']['Insert'];

/**
 * Extended metadata including project context
 */
export type DevisMetadata = {
  nom?: string;                                          // Project name
  typeTravaux?: string;
  budget?: string;
  surface?: number | string;
  description?: string;
  delaiSouhaite?: string;
  urgence?: string;
  contraintes?: string;
  userType?: 'B2B' | 'B2C' | 'admin';
  // Context embeddings (auto-generated)
  projectContextEmbeddings?: any;
};

/**
 * Map database devis to app DevisData format
 */
function mapDbDevisToAppDevis(dbDevis: DbDevis): DevisData {
  return {
    id: dbDevis.id,
    projectId: dbDevis.project_id,
    projectName: dbDevis.nom_projet || undefined,
    companyId: dbDevis.company_id || undefined,
    devisNumber: dbDevis.devis_number || undefined,
    status: dbDevis.status,
    amount: dbDevis.amount,
    currency: dbDevis.currency || 'EUR',
    fileUrl: dbDevis.file_url,
    fileName: dbDevis.file_name,
    fileSize: dbDevis.file_size || undefined,
    fileType: dbDevis.file_type || undefined,
    extractedData: dbDevis.extracted_data as Record<string, unknown> || undefined,
    lineItems: dbDevis.line_items as Array<Record<string, unknown>> || undefined,
    analyzedAt: dbDevis.analyzed_at || undefined,
    analysisDuration: dbDevis.analysis_duration || undefined,
    analysisResult: dbDevis.analysis_result as Record<string, unknown> || undefined,
    scoreTotal: dbDevis.score_total || undefined,
    grade: dbDevis.grade || undefined,
    recommendations: dbDevis.recommendations as Array<Record<string, unknown>> || undefined,
    detectedOvercosts: dbDevis.detected_overcosts || undefined,
    potentialSavings: dbDevis.potential_savings || undefined,
    createdAt: dbDevis.created_at || undefined,
    updatedAt: dbDevis.updated_at || undefined,
  };
}

export class SupabaseDevisService {
  /**
   * Upload and analyze a devis file
   * @param userId - User ID who owns the devis
   * @param file - PDF file to analyze
   * @param projectName - Name of the project
   * @param metadata - Optional metadata (type, budget, etc.)
   */
  async uploadDevis(
    userId: string,
    file: File,
    projectName: string,
    metadata?: DevisMetadata
  ): Promise<{ id: string; status: string }> {
    console.log('[SAFE MODE] Upload START');

    // Use the userId passed from the authenticated context
    if (!userId) {
      throw new Error('User ID is required to upload a devis');
    }

    const authenticatedUserId = userId;

    // Validate file
    if (file.size > env.upload.maxFileSize) {
      throw new Error(`File size exceeds ${env.upload.maxFileSize / 1024 / 1024}MB limit`);
    }

    const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    if (!env.upload.allowedTypes.includes(fileExtension)) {
      throw new Error(`File type ${fileExtension} not allowed`);
    }

    // Generate unique file path
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${authenticatedUserId}/${timestamp}_${sanitizedFileName}`;

    console.log('[SAFE MODE] Uploading to storage:', { filePath, fileSize: file.size });

    try {
      // DIAGNOSTIC: Test bucket access
      console.log('[SAFE MODE] Testing bucket access...');
      const { data: testList, error: testError } = await supabase.storage
        .from(STORAGE_BUCKETS.DEVIS)
        .list('', { limit: 1 });
      console.log('[SAFE MODE] Bucket test result:', {
        testListCount: testList?.length ?? null,
        testError: testError?.message ?? null,
      });

      // STEP 1: Upload file to storage (NO timeout wrapper)
      console.log('[SAFE MODE] About to call storage.upload()');
      const uploadStart = performance.now();

      // Detect if upload hangs
      const hangDetector = setTimeout(() => {
        console.warn('[SAFE MODE] ⚠️ Upload still pending after 8 seconds - possible freeze');
      }, 8000);

      const { data: uploadedFile, error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKETS.DEVIS)
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        });

      clearTimeout(hangDetector);
      const uploadEnd = performance.now();
      const uploadDuration = uploadEnd - uploadStart;

      console.log('[SAFE MODE] Upload finished in ms:', uploadDuration.toFixed(0));

      if (uploadError) {
        console.error('[SAFE MODE] Upload FULL ERROR:', uploadError);
        console.error('[SAFE MODE] Error details:', {
          message: uploadError.message,
          statusCode: uploadError.statusCode,
          status: uploadError.status,
        });
        throw uploadError;
      }

      console.log('[SAFE MODE] Upload DONE');

      // Get public URL for the file
      const { data: { publicUrl } } = supabase.storage
        .from(STORAGE_BUCKETS.DEVIS)
        .getPublicUrl(filePath);

      // STEP 2: Insert DB record (NO analysis trigger)
      const devisInsert: DbDevisInsert = {
        user_id: authenticatedUserId,
        nom_projet: projectName,
        type_travaux: metadata?.typeTravaux || null,
        montant_total: 0,
        file_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        status: 'uploaded',
      };

      console.log('[SAFE MODE] Inserting DB record');

      const { data: devisData, error: insertError } = await supabase
        .from('devis')
        .insert(devisInsert)
        .select()
        .single();

      if (insertError) {
        console.error('[SAFE MODE] DB INSERT FAILED:', insertError);
        throw new Error(`Failed to create devis record: ${insertError.message}`);
      }

      console.log('[SAFE MODE] DB INSERT DONE');

      // Return uploaded status (NO "analyzing")
      return {
        id: devisData.id,
        status: 'uploaded',
      };
    } catch (error) {
      console.error('[SAFE MODE] Upload process error:', error);
      throw error;
    }
  }

  /**
   * Analyze a devis file using AI (TORP methodology)
   * Enriches metadata with project context embeddings
   */
  async analyzeDevisById(devisId: string, file?: File, metadata?: DevisMetadata): Promise<void> {
    const startTime = Date.now();

    try {
      console.log(`[Devis] Starting analysis for ${devisId}...`);

      // If file not provided, fetch it from storage
      let devisFile = file;
      if (!devisFile) {
        const { data: devisData } = await supabase
          .from('devis')
          .select('file_url, file_name')
          .eq('id', devisId)
          .single();

        if (!devisData) {
          throw new Error('Devis not found');
        }

        // Download file from storage
        const filePath = new URL(devisData.file_url).pathname.split('/').slice(-3).join('/');
        const { data: fileData, error: downloadError } = await supabase.storage
          .from(STORAGE_BUCKETS.DEVIS)
          .download(filePath);

        if (downloadError || !fileData) {
          throw new Error('Failed to download devis file');
        }

        devisFile = new File([fileData], devisData.file_name, { type: 'application/pdf' });
      }

      // Step 1: Extract text from PDF
      console.log(`[Devis] Extracting text from PDF...`);
      const devisText = await pdfExtractorService.extractText(devisFile);

      // Step 1.5: Vectorize project context (DEMAND) if available
      let enrichedMetadata: DevisMetadata = { ...metadata, userType: metadata?.userType || 'B2C' };
      let demandEmbeddings: ProjectContextEmbeddings | null = null;

      if (metadata?.nom || metadata?.typeTravaux || metadata?.budget || metadata?.surface) {
        console.log(`[Devis] Vectorizing project context (DEMAND)...`);
        const projectContextData: ProjectContextData = {
          name: metadata?.nom || '',
          type: metadata?.typeTravaux || '',
          budget: metadata?.budget,
          surface: typeof metadata?.surface === 'number' ? String(metadata.surface) : metadata?.surface,
          startDate: undefined,
          endDate: metadata?.delaiSouhaite,
          description: metadata?.description,
          urgency: metadata?.urgence,
          constraints: metadata?.contraintes,
        };

        demandEmbeddings = projectContextEmbeddingsService.vectorizeProjectContext(projectContextData);
        const contextSummary = projectContextEmbeddingsService.generateContextSummary(projectContextData);

        enrichedMetadata.projectContextEmbeddings = demandEmbeddings;

        console.log(`[Devis] Demand vectorized:`, {
          typeEmbedding: demandEmbeddings.typeEmbedding,
          budgetRange: demandEmbeddings.budgetRange.category,
          surfaceRange: demandEmbeddings.surfaceRange.category,
          urgencyLevel: demandEmbeddings.urgencyLevel,
          contextFactors: demandEmbeddings.contextualFactors.length,
        });

        console.log(`[Devis] Demand summary:\n${contextSummary}`);
      }

      // Step 1.6: Extract structured data & vectorize proposal (PROPOSITION)
      console.log(`[Devis] Extracting and vectorizing devis proposal (PROPOSITION)...`);
      let proposalEmbeddings: DevisProposalVector | null = null;
      let demandVsProposalComparison: ComparisonResult | null = null;

      // Extract structured data from devis text
      const extractedData = await torpAnalyzerService.extractDevisDataDirect(devisText);

      if (extractedData) {
        proposalEmbeddings = devisProposalEmbeddingsService.vectorizeDevisProposal(extractedData);

        console.log(`[Devis] Proposal vectorized:`, {
          typeVecteur: proposalEmbeddings.typeVecteur,
          prixTotal: proposalEmbeddings.prixVecteur.montantTotal,
          transparence: proposalEmbeddings.prixVecteur.transparence,
          entrepriseName: proposalEmbeddings.entrepriseVecteur.nom,
          conformiteScore: proposalEmbeddings.entrepriseVecteur.scoreConformite,
        });

        // Compare DEMAND vs PROPOSITION vectors
        if (demandEmbeddings && proposalEmbeddings) {
          console.log(`[Devis] Comparing demand vs proposal vectors...`);
          demandVsProposalComparison = devisProposalEmbeddingsService.compareVectors(
            demandEmbeddings,
            proposalEmbeddings
          );

          console.log(`[Devis] Alignment score: ${demandVsProposalComparison.alignmentScore}/100`);
          console.log(`[Devis] Gaps found: ${demandVsProposalComparison.gapAnalysis.length}`);
          console.log(`[Devis] Recommendations: ${demandVsProposalComparison.recommendations.length}`);

          // Log gaps
          demandVsProposalComparison.gapAnalysis.forEach(gap => {
            console.log(`  - [${gap.severity.toUpperCase()}] ${gap.category}: ${gap.description}`);
          });
        }
      }

      // Step 2: Run TORP analysis
      console.log(`[Devis] Running TORP analysis... (userType: ${enrichedMetadata.userType || 'B2C'})`);
      const analysis = await torpAnalyzerService.analyzeDevis(devisText, enrichedMetadata as any);

      // Step 3: Save results to database
      console.log(`[Devis] Saving analysis results...`);

      // Get user session token (same approach as uploadDevis)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAuthKey = `sb-${supabaseUrl.split('//')[1].split('.')[0]}-auth-token`;
      const sessionData = localStorage.getItem(supabaseAuthKey);

      let accessToken = import.meta.env.VITE_SUPABASE_ANON_KEY;
      // Use official Supabase SDK to update analysis results
      const analysisUpdate = {
        status: 'analyzed',
        analyzed_at: new Date().toISOString(),
        analysis_duration: analysis.dureeAnalyse,
        score_total: analysis.scoreGlobal,
        grade: analysis.grade,
        score_entreprise: analysis.scoreEntreprise,
        score_prix: analysis.scorePrix,
        score_completude: analysis.scoreCompletude,
        score_conformite: analysis.scoreConformite,
        score_delais: analysis.scoreDelais,
        score_innovation_durable: analysis.scoreInnovationDurable || null,
        score_transparence: analysis.scoreTransparence || null,
        recommendations: {
          ...analysis.recommandations,
          budgetRealEstime: analysis.budgetRealEstime || 0,
          margeNegociation: analysis.margeNegociation,
        },
        // Sauvegarder les données extraites pour enrichissement et géocodage
        extracted_data: analysis.extractedData || null,
        // Sauvegarder l'adresse du chantier directement
        adresse_chantier: analysis.extractedData?.travaux?.adresseChantier || null,
        detected_overcosts: analysis.surcoutsDetectes,
        potential_savings: analysis.scorePrix.economiesPotentielles || 0,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('devis')
        .update(analysisUpdate)
        .eq('id', devisId);

      if (updateError) {
        console.error('[DevisService] Database update error:', updateError);
        throw new Error(`Failed to save analysis: ${updateError.message}`);
      }

      console.log('[DevisService] Analysis results saved successfully');

      // Envoyer notification à l'utilisateur
      try {
        // Récupérer les infos du devis et de l'utilisateur
        const { data: devisInfo } = await supabase
          .from('devis')
          .select('user_id, nom_projet')
          .eq('id', devisId)
          .single();

        if (devisInfo?.user_id) {
          const { data: userInfo } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('id', devisInfo.user_id)
            .single();

          if (userInfo) {
            console.log('[DevisService] Analyse complète pour l\'utilisateur');
          }
        }
      } catch (notifError) {
        // Ne pas bloquer l'analyse si la notification échoue
        console.error('[DevisService] Erreur envoi notification:', notifError);
      }

      const totalDuration = Math.round((Date.now() - startTime) / 1000);
      console.log(`[Devis] Analysis complete for ${devisId} - ${totalDuration}s total - Score: ${analysis.scoreGlobal}/1000 (${analysis.grade})`);
    } catch (error) {
      console.error(`[Devis] Analysis failed for ${devisId}:`, error);

      // Update status to indicate failure using REST API
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAuthKey = `sb-${supabaseUrl.split('//')[1].split('.')[0]}-auth-token`;
        const sessionData = localStorage.getItem(supabaseAuthKey);

        // Update status back to uploaded using SDK
        await supabase
          .from('devis')
          .update({
            status: 'uploaded',
            updated_at: new Date().toISOString(),
          })
          .eq('id', devisId)
          .catch(updateError => {
            console.error('[DevisService] Failed to update status after error:', updateError);
          });
      } catch (updateError) {
        console.error('[DevisService] Failed to update status after error:', updateError);
      }

      throw error;
    }
  }

  /**
   * Get analysis result for a devis
   */
  async getAnalysis(devisId: string): Promise<TorpAnalysisResult> {
    const { data, error } = await supabase
      .from('devis')
      .select('*')
      .eq('id', devisId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch devis: ${error.message}`);
    }

    if (data.status !== 'analyzed') {
      throw new Error(`Devis is not yet analyzed. Current status: ${data.status}`);
    }

    // Map database fields to TorpAnalysisResult
    const analysis: TorpAnalysisResult = {
      id: `analysis-${devisId}`,
      devisId: devisId,
      scoreGlobal: data.score_total || 0,
      grade: data.grade || 'N/A',

      scoreEntreprise: (data.score_entreprise as any) || {
        fiabilite: 0,
        santeFinnaciere: 0,
        anciennete: 0,
        assurances: 0,
        certifications: 0,
        reputation: 0,
        risques: [],
        benefices: [],
      },

      scorePrix: (data.score_prix as any) || {
        vsMarche: 0,
        transparence: 0,
        coherence: 0,
        margeEstimee: 0,
        ajustementQualite: 0,
        economiesPotentielles: 0,
      },

      scoreCompletude: (data.score_completude as any) || {
        elementsManquants: [],
        incohérences: [],
        conformiteNormes: 0,
        risquesTechniques: [],
      },

      scoreConformite: (data.score_conformite as any) || {
        assurances: false,
        plu: false,
        normes: false,
        accessibilite: false,
        defauts: [],
      },

      scoreDelais: (data.score_delais as any) || {
        realisme: 0,
        vsMarche: 0,
        planningDetaille: false,
        penalitesRetard: false,
      },

      recommandations: (data.recommendations as any) || [],

      surcoutsDetectes: data.detected_overcosts || 0,
      budgetRealEstime: (data.recommendations as any)?.budgetRealEstime || data.amount || 0,
      margeNegociation: (data.recommendations as any)?.margeNegociation || {
        min: data.amount ? data.amount * 0.95 : 0,
        max: data.amount ? data.amount * 1.05 : 0,
      },

      dateAnalyse: data.analyzed_at ? new Date(data.analyzed_at) : new Date(),
      dureeAnalyse: data.analysis_duration || 0,
    };

    return analysis;
  }

  /**
   * Get all devis for a user - FIXED
   * Récupère directement par user_id au lieu de passer par projects
   */
  async getUserDevis(userId: string): Promise<DevisData[]> {
    const { data: devisList, error: devisError } = await supabase
      .from('devis')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false});

    if (devisError) {
      throw new Error(`Failed to fetch devis: ${devisError.message}`);
    }

    return (devisList || []).map(mapDbDevisToAppDevis);
  }

  /**
   * Get count of user devis - NEW
   * Pour afficher le compteur dans le dashboard
   */
  async getUserDevisCount(userId: string): Promise<{
    total: number;
    analyzed: number;
    analyzing: number;
  }> {
    const { data, error } = await supabase
      .from('devis')
      .select('status')
      .eq('user_id', userId);

    if (error) {
      console.error('[DevisService] Error counting devis:', error);
      return { total: 0, analyzed: 0, analyzing: 0 };
    }

    const total = (data || []).length;
    const analyzed = (data || []).filter(d => d.status === 'analyzed').length;
    const analyzing = (data || []).filter(d => d.status === 'analyzing').length;

    return { total, analyzed, analyzing };
  }

  /**
   * Get recent analyzed devis - NEW
   * Pour la page "Mes analyses"
   */
  async getUserAnalyzedDevis(userId: string, limit: number = 10): Promise<DevisData[]> {
    const { data, error } = await supabase
      .from('devis')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'analyzed')
      .order('analyzed_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[DevisService] Error fetching analyzed devis:', error);
      throw new Error(`Failed to fetch analyzed devis: ${error.message}`);
    }

    return (data || []).map(mapDbDevisToAppDevis);
  }

  /**
   * Get devis for a specific project
   */
  async getProjectDevis(projectId: string): Promise<DevisData[]> {
    const { data, error } = await supabase
      .from('devis')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch project devis: ${error.message}`);
    }

    return data.map(mapDbDevisToAppDevis);
  }

  /**
   * Compare multiple devis
   */
  async compareDevis(devisIds: string[]): Promise<{
    comparison: Record<string, unknown>;
    recommendation: string;
  }> {
    if (devisIds.length < 2) {
      throw new Error('At least 2 devis are required for comparison');
    }

    // Fetch all devis
    const { data: devisList, error } = await supabase
      .from('devis')
      .select('*')
      .in('id', devisIds);

    if (error) {
      throw new Error(`Failed to fetch devis for comparison: ${error.message}`);
    }

    if (!devisList || devisList.length < 2) {
      throw new Error('Could not find enough devis to compare');
    }

    // TODO: Implement real comparison logic using AI
    // For now, return basic comparison
    const comparison = {
      devis: devisList.map(d => ({
        id: d.id,
        amount: d.amount,
        score: d.score_total,
        grade: d.grade,
      })),
      bestValue: devisList.reduce((best, current) =>
        (current.score_total || 0) > (best.score_total || 0) ? current : best
      ).id,
      lowestPrice: devisList.reduce((lowest, current) =>
        current.amount < lowest.amount ? current : lowest
      ).id,
    };

    const recommendation = 'Comparison feature coming soon with AI-powered recommendations';

    return { comparison, recommendation };
  }

  /**
   * Request AI assistance for a devis
   */
  async askAI(devisId: string, question: string): Promise<string> {
    if (!question.trim()) {
      throw new Error('Question is required');
    }

    // Fetch devis data
    const { data: devis, error } = await supabase
      .from('devis')
      .select('*')
      .eq('id', devisId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch devis: ${error.message}`);
    }

    // TODO: Call AI service (OpenAI/Claude) with devis context
    // For now, return a mock response
    const mockResponse = `Based on your devis analysis, here's what I can tell you about "${question}":

This feature will use AI to provide detailed answers about your devis once the AI integration is complete.
The system will analyze the devis content, pricing, and recommendations to give you personalized advice.`;

    return mockResponse;
  }

  /**
   * Update devis status
   */
  async updateDevisStatus(devisId: string, status: DbDevis['status']): Promise<void> {
    const { error } = await supabase
      .from('devis')
      .update({ status })
      .eq('id', devisId);

    if (error) {
      throw new Error(`Failed to update devis status: ${error.message}`);
    }
  }

  /**
   * Delete a devis (and its file)
   */
  async deleteDevis(devisId: string): Promise<void> {
    // Fetch devis to get file path
    const { data: devis, error: fetchError } = await supabase
      .from('devis')
      .select('file_url')
      .eq('id', devisId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch devis: ${fetchError.message}`);
    }

    // Extract file path from URL
    const url = new URL(devis.file_url);
    const pathParts = url.pathname.split('/');
    const filePath = pathParts.slice(-3).join('/'); // userId/projectId/filename

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKETS.DEVIS)
      .remove([filePath]);

    if (storageError) {
      console.error('Failed to delete file from storage:', storageError);
      // Continue with database deletion even if storage deletion fails
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('devis')
      .delete()
      .eq('id', devisId);

    if (deleteError) {
      throw new Error(`Failed to delete devis: ${deleteError.message}`);
    }
  }
}

export const devisService = new SupabaseDevisService();
export default devisService;

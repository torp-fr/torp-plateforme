/**
 * Supabase Devis Service
 * Real devis/quotes management using Supabase
 */

import { supabase } from '@/lib/supabase';
import { env } from '@/config/env';
import { DevisData, TorpAnalysisResult } from '@/types/torp';
import type { Database } from '@/types/supabase';
import { pdfExtractorService } from '@/services/pdf/pdf-extractor.service';
import { torpAnalyzerService } from '@/services/ai/torp-analyzer.service';
import { notificationService } from '@/services/notifications/notification.service';

type DbDevis = Database['public']['Tables']['devis']['Row'];
type DbDevisInsert = Database['public']['Tables']['devis']['Insert'];

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
    metadata?: {
      typeTravaux?: string;
      budget?: string;
      surface?: number;
      description?: string;
      delaiSouhaite?: string;
      urgence?: string;
      contraintes?: string;
    }
  ): Promise<{ id: string; status: string }> {
    console.log('[DevisService] uploadDevis called with userId:', userId);

    // Use the userId passed from the authenticated context
    // Note: Session check was causing timeout on Vercel, so we trust the React context authentication
    if (!userId) {
      throw new Error('User ID is required to upload a devis');
    }

    const authenticatedUserId = userId;
    console.log('[DevisService] Using authenticated userId:', authenticatedUserId);

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

    // Upload file to Supabase Storage
    console.log('[DevisService] Uploading file to Storage:', {
      bucket: 'devis-uploads',
      filePath,
      fileSize: file.size,
      fileType: file.type
    });

    // Use direct REST API instead of SDK to avoid blocking issue
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    // Get user session token from localStorage (where Supabase stores it)
    const supabaseAuthKey = `sb-${supabaseUrl.split('//')[1].split('.')[0]}-auth-token`;
    const sessionData = localStorage.getItem(supabaseAuthKey);

    let accessToken;
    if (sessionData) {
      try {
        const session = JSON.parse(sessionData);
        accessToken = session.access_token;
        console.log('[DevisService] Using user session token for upload');
      } catch (e) {
        console.error('[DevisService] Failed to parse session:', e);
      }
    }

    // Fallback to anon key if no session token
    if (!accessToken) {
      accessToken = import.meta.env.VITE_SUPABASE_ANON_KEY;
      console.log('[DevisService] Using anon key as fallback');
    }

    console.log('[DevisService] Using direct API upload...');
    const uploadUrl = `${supabaseUrl}/storage/v1/object/devis-uploads/${filePath}`;

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': file.type,
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('[DevisService] Storage upload error:', errorText);
      throw new Error(`Failed to upload file: ${uploadResponse.status} ${errorText}`);
    }

    const uploadData = await uploadResponse.json();
    console.log('[DevisService] File uploaded successfully:', uploadData);

    // Get public URL for the file
    const { data: { publicUrl } } = supabase.storage
      .from('devis-uploads')
      .getPublicUrl(filePath);

    // Create devis record in database
    const devisInsert: DbDevisInsert = {
      user_id: authenticatedUserId,
      nom_projet: projectName,
      type_travaux: metadata?.typeTravaux || null,
      montant_total: 0, // Will be updated after analysis
      file_url: publicUrl,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      status: 'uploaded',
    };

    console.log('[DevisService] Inserting devis record:', devisInsert);

    // Use direct REST API for insert as well (SDK blocks like storage.upload did)
    const insertUrl = `${supabaseUrl}/rest/v1/devis`;
    const insertResponse = await fetch(insertUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(devisInsert),
    });

    if (!insertResponse.ok) {
      const errorText = await insertResponse.text();
      console.error('[DevisService] Database insert error:', errorText);
      // Clean up uploaded file if database insert fails
      const deleteUrl = `${supabaseUrl}/storage/v1/object/devis-uploads/${filePath}`;
      await fetch(deleteUrl, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      throw new Error(`Failed to create devis record: ${insertResponse.status} ${errorText}`);
    }

    const devisDataArray = await insertResponse.json();
    const devisData = devisDataArray[0];
    console.log('[DevisService] Devis record created successfully:', devisData);

    // Trigger async analysis - update status to analyzing
    const updateUrl = `${supabaseUrl}/rest/v1/devis?id=eq.${devisData.id}`;
    await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ status: 'analyzing' }),
    });

    // Start analysis in background (don't await to avoid blocking upload response)
    this.analyzeDevisById(devisData.id, file, metadata).catch((error) => {
      console.error(`[Devis] Analysis failed for ${devisData.id}:`, error);
      // Update status to failed
      supabase
        .from('devis')
        .update({ status: 'uploaded' })
        .eq('id', devisData.id);
    });

    return {
      id: devisData.id,
      status: 'analyzing',
    };
  }

  /**
   * Analyze a devis file using AI (TORP methodology)
   */
  async analyzeDevisById(devisId: string, file?: File, metadata?: { region?: string; typeTravaux?: string }): Promise<void> {
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
          .from('devis-uploads')
          .download(filePath);

        if (downloadError || !fileData) {
          throw new Error('Failed to download devis file');
        }

        devisFile = new File([fileData], devisData.file_name, { type: 'application/pdf' });
      }

      // Step 1: Extract text from PDF
      console.log(`[Devis] Extracting text from PDF...`);
      const devisText = await pdfExtractorService.extractText(devisFile);

      // Step 2: Run TORP analysis
      console.log(`[Devis] Running TORP analysis...`);
      const analysis = await torpAnalyzerService.analyzeDevis(devisText, metadata);

      // Step 3: Save results to database
      console.log(`[Devis] Saving analysis results...`);

      // Get user session token (same approach as uploadDevis)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAuthKey = `sb-${supabaseUrl.split('//')[1].split('.')[0]}-auth-token`;
      const sessionData = localStorage.getItem(supabaseAuthKey);

      let accessToken = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (sessionData) {
        try {
          const session = JSON.parse(sessionData);
          accessToken = session.access_token;
        } catch (e) {
          console.error('[DevisService] Failed to parse session:', e);
        }
      }

      // Use direct REST API to avoid blocking issue
      const updateUrl = `${supabaseUrl}/rest/v1/devis?id=eq.${devisId}`;
      const updateResponse = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
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
        }),
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error('[DevisService] Database update error:', errorText);
        throw new Error(`Failed to save analysis: ${updateResponse.status} ${errorText}`);
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
            .from('users')
            .select('email, name')
            .eq('id', devisInfo.user_id)
            .single();

          if (userInfo) {
            await notificationService.notifyAnalysisComplete({
              userId: devisInfo.user_id,
              userEmail: userInfo.email || '',
              userName: userInfo.name || 'Utilisateur',
              projectName: devisInfo.nom_projet || 'Projet sans nom',
              entrepriseName: 'Entreprise', // TODO: extract from analysis if available
              grade: analysis.grade,
              score: analysis.scoreGlobal,
              analysisId: devisId,
            });
            console.log('[DevisService] Notification envoyée à l\'utilisateur');
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

        let accessToken = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (sessionData) {
          try {
            const session = JSON.parse(sessionData);
            accessToken = session.access_token;
          } catch (e) {
            console.error('[DevisService] Failed to parse session:', e);
          }
        }

        const updateUrl = `${supabaseUrl}/rest/v1/devis?id=eq.${devisId}`;
        await fetch(updateUrl, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            status: 'uploaded',
            updated_at: new Date().toISOString(),
          }),
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
      .from('devis-uploads')
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

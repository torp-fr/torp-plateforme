/**
 * Service Vision IA - Analyse de photos
 * Utilise GPT-4 Vision pour analyser photos de chantier et diagnostics bâtiment
 */

import { supabase } from '@/lib/supabase';

// =============================================================================
// TYPES
// =============================================================================

export interface PhotoAnalysisResult {
  lotDetected: string | null;
  lotName: string | null;
  progressEstimate: number;
  qualityScore: number;
  issues: PhotoIssue[];
  recommendations: string[];
  confidence: number;
  analysisDate: string;
}

export interface PhotoIssue {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  location?: string;
  suggestedAction?: string;
}

export interface DiagnosticPhotoAnalysis {
  pathologies: Pathology[];
  overallCondition: 'bon' | 'moyen' | 'dégradé' | 'critique';
  urgentAttention: boolean;
  estimatedRepairCost?: { min: number; max: number };
  recommendations: string[];
  confidence: number;
  analysisDate: string;
}

export interface Pathology {
  type: string;
  description: string;
  severity: 1 | 2 | 3 | 4 | 5;
  location: string;
  possibleCauses: string[];
  recommendedActions: string[];
  estimatedRepairCost?: { min: number; max: number };
}

export interface BatchAnalysisResult {
  photos: Array<{
    photoId: string;
    photoUrl: string;
    analysis: DiagnosticPhotoAnalysis | PhotoAnalysisResult;
    error?: string;
  }>;
  summary: {
    totalPhotos: number;
    analyzedPhotos: number;
    failedPhotos: number;
    overallCondition?: string;
    criticalIssuesCount: number;
  };
}

// =============================================================================
// SERVICE
// =============================================================================

class VisionService {
  /**
   * Analyser une photo de chantier via Edge Function
   */
  async analyzeConstructionPhoto(
    imageUrl: string,
    context?: {
      lotCode?: string;
      projectType?: string;
      expectedPhase?: string;
    }
  ): Promise<PhotoAnalysisResult> {
    const { data, error } = await supabase.functions.invoke('analyze-photo', {
      body: {
        imageUrl,
        analysisType: 'construction',
        context,
      },
    });

    if (error) {
      console.error('Vision analysis error:', error);
      throw new Error(`Analyse photo échouée: ${error.message}`);
    }

    return {
      ...data,
      analysisDate: new Date().toISOString(),
    };
  }

  /**
   * Analyser une photo pour diagnostic bâtiment
   */
  async analyzeDiagnosticPhoto(
    imageUrl: string,
    buildingInfo?: {
      yearBuilt?: number;
      type?: string;
      knownIssues?: string[];
    }
  ): Promise<DiagnosticPhotoAnalysis> {
    const { data, error } = await supabase.functions.invoke('analyze-photo', {
      body: {
        imageUrl,
        analysisType: 'diagnostic',
        context: buildingInfo,
      },
    });

    if (error) {
      console.error('Diagnostic vision error:', error);
      throw new Error(`Analyse diagnostic échouée: ${error.message}`);
    }

    return {
      ...data,
      analysisDate: new Date().toISOString(),
    };
  }

  /**
   * Analyser plusieurs photos en batch
   */
  async analyzePhotosBatch(
    photos: Array<{ id: string; url: string }>,
    analysisType: 'construction' | 'diagnostic',
    context?: Record<string, unknown>
  ): Promise<BatchAnalysisResult> {
    const results: BatchAnalysisResult['photos'] = [];
    let criticalIssuesCount = 0;

    // Process photos in parallel with concurrency limit
    const BATCH_SIZE = 3;
    for (let i = 0; i < photos.length; i += BATCH_SIZE) {
      const batch = photos.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async (photo) => {
          try {
            const analysis = analysisType === 'diagnostic'
              ? await this.analyzeDiagnosticPhoto(photo.url, context as { yearBuilt?: number; type?: string })
              : await this.analyzeConstructionPhoto(photo.url, context as { lotCode?: string });

            // Count critical issues
            if (analysisType === 'diagnostic') {
              const diagAnalysis = analysis as DiagnosticPhotoAnalysis;
              criticalIssuesCount += diagAnalysis.pathologies.filter(p => p.severity >= 4).length;
            } else {
              const constructionAnalysis = analysis as PhotoAnalysisResult;
              criticalIssuesCount += constructionAnalysis.issues.filter(i => i.severity === 'critical').length;
            }

            return {
              photoId: photo.id,
              photoUrl: photo.url,
              analysis,
            };
          } catch (error) {
            return {
              photoId: photo.id,
              photoUrl: photo.url,
              analysis: null,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        })
      );

      // Process results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value as BatchAnalysisResult['photos'][0]);
        } else {
          results.push({
            photoId: batch[index].id,
            photoUrl: batch[index].url,
            analysis: {} as DiagnosticPhotoAnalysis,
            error: result.status === 'rejected' ? result.reason?.message : 'Analysis failed',
          });
        }
      });
    }

    const analyzedPhotos = results.filter(r => !r.error).length;
    const failedPhotos = results.filter(r => r.error).length;

    // Calculate overall condition for diagnostic analysis
    let overallCondition: string | undefined;
    if (analysisType === 'diagnostic' && analyzedPhotos > 0) {
      const conditions = results
        .filter(r => !r.error && r.analysis)
        .map(r => (r.analysis as DiagnosticPhotoAnalysis).overallCondition);

      const conditionScores = { 'critique': 4, 'dégradé': 3, 'moyen': 2, 'bon': 1 };
      const avgScore = conditions.reduce((sum, c) => sum + (conditionScores[c] || 0), 0) / conditions.length;

      if (avgScore >= 3.5) overallCondition = 'critique';
      else if (avgScore >= 2.5) overallCondition = 'dégradé';
      else if (avgScore >= 1.5) overallCondition = 'moyen';
      else overallCondition = 'bon';
    }

    return {
      photos: results,
      summary: {
        totalPhotos: photos.length,
        analyzedPhotos,
        failedPhotos,
        overallCondition,
        criticalIssuesCount,
      },
    };
  }

  /**
   * Vérifier si l'URL de l'image est accessible
   */
  async validateImageUrl(imageUrl: string): Promise<boolean> {
    try {
      const response = await fetch(imageUrl, { method: 'HEAD' });
      const contentType = response.headers.get('content-type');
      return response.ok && contentType?.startsWith('image/');
    } catch {
      return false;
    }
  }

  /**
   * Convertir une image locale en URL accessible (via Supabase Storage)
   */
  async uploadImageForAnalysis(
    file: File,
    projectId: string
  ): Promise<string> {
    const fileName = `vision-analysis/${projectId}/${Date.now()}-${file.name}`;

    const { data, error } = await supabase.storage
      .from('phase0-photos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      throw new Error(`Erreur upload image: ${error.message}`);
    }

    const { data: urlData } = supabase.storage
      .from('phase0-photos')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  }
}

export const visionService = new VisionService();
export default visionService;

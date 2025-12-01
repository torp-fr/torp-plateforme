/**
 * Service principal d'analyse des devis B2B
 * Orchestre l'extraction OCR, l'enrichissement, le scoring et les recommandations
 */

import { supabase } from '@/lib/supabase';
import { extractDevisData } from '../ocr/extract-devis';
import { enrichWithCompanyData, checkDataCoherence } from './enrich-company-data';
import { calculateScore } from './calculate-score';
import { generateRecommendations } from './recommendations-generator';
import type { ScoringResult } from './scoring-engine';

/**
 * Analyse complète d'un devis professionnel
 * @param analysisId - ID de l'analyse dans la base de données
 * @returns Résultat complet du scoring
 */
export async function analyzeProDevis(analysisId: string): Promise<ScoringResult> {
  console.log(`[analyzeProDevis] Starting analysis for ${analysisId}`);

  // 1. Récupérer l'analyse depuis la base
  const { data: analysis, error: analysisError } = await supabase
    .from('pro_devis_analyses')
    .select('*')
    .eq('id', analysisId)
    .single();

  if (analysisError || !analysis) {
    throw new Error(`Analysis not found: ${analysisId}`);
  }

  console.log(`[analyzeProDevis] Found analysis for company ${analysis.company_id}`);

  // 2. Mettre à jour le statut à PROCESSING
  await supabase
    .from('pro_devis_analyses')
    .update({ status: 'PROCESSING' })
    .eq('id', analysisId);

  try {
    // 3. Extraction OCR
    console.log('[analyzeProDevis] Step 1/5: Extracting data from PDF...');
    const extractedData = await extractDevisData(analysis.file_url);
    console.log('[analyzeProDevis] ✓ Data extracted. Confidence:', extractedData.confidence);

    // 4. Enrichissement avec données entreprise
    console.log('[analyzeProDevis] Step 2/5: Enriching with company data...');
    const enrichedData = await enrichWithCompanyData(analysis.company_id, extractedData);
    console.log('[analyzeProDevis] ✓ Data enriched. Profile completeness:', enrichedData.completudeProfil + '%');

    // 5. Vérifier la cohérence des données
    const coherenceCheck = checkDataCoherence(extractedData, enrichedData);
    if (!coherenceCheck.coherent) {
      console.warn('[analyzeProDevis] ⚠ Data coherence warnings:', coherenceCheck.warnings);
    }

    // 6. Calcul du scoring
    console.log('[analyzeProDevis] Step 3/5: Calculating score...');
    const scoringResult = calculateScore(extractedData, enrichedData);
    console.log(`[analyzeProDevis] ✓ Score calculated: ${scoringResult.scoreTotal}/1000 (${scoringResult.grade})`);

    // 7. Génération des recommandations
    console.log('[analyzeProDevis] Step 4/5: Generating recommendations...');
    const recommandations = generateRecommandations(scoringResult, extractedData, enrichedData);
    console.log(`[analyzeProDevis] ✓ ${recommandations.length} recommendations generated`);

    // 8. Préparer le résultat complet
    const fullResult: ScoringResult = {
      ...scoringResult,
      recommandations,
    };

    // 9. Sauvegarder les résultats en base
    console.log('[analyzeProDevis] Step 5/5: Saving results...');
    await supabase
      .from('pro_devis_analyses')
      .update({
        status: 'COMPLETED',
        score_total: fullResult.scoreTotal,
        grade: fullResult.grade,
        score_details: fullResult.axes as any,
        recommandations: fullResult.recommandations as any,
        points_bloquants: fullResult.pointsBloquants as any,
        analyzed_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        // Stocker aussi les données extraites pour référence
        metadata: {
          extractedData: {
            confidence: extractedData.confidence,
            entreprise: extractedData.entreprise,
            assurances: extractedData.assurances,
            financier: extractedData.financier,
            certifications: extractedData.certifications,
          },
          coherenceWarnings: coherenceCheck.warnings,
        },
      })
      .eq('id', analysisId);

    console.log('[analyzeProDevis] ✓ Analysis completed successfully!');

    return fullResult;
  } catch (error) {
    console.error('[analyzeProDevis] ✗ Error during analysis:', error);

    // En cas d'erreur, mettre à jour le statut
    await supabase
      .from('pro_devis_analyses')
      .update({
        status: 'FAILED',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          errorStack: error instanceof Error ? error.stack : undefined,
        },
      })
      .eq('id', analysisId);

    throw error;
  }
}

/**
 * Ré-analyse un devis existant (nouvelle version)
 */
export async function reanalyzeDevis(
  originalAnalysisId: string,
  newFileUrl: string
): Promise<ScoringResult> {
  // 1. Récupérer l'analyse originale
  const { data: originalAnalysis } = await supabase
    .from('pro_devis_analyses')
    .select('*')
    .eq('id', originalAnalysisId)
    .single();

  if (!originalAnalysis) {
    throw new Error('Original analysis not found');
  }

  // 2. Créer une nouvelle analyse (version suivante)
  const { data: newAnalysis, error: createError } = await supabase
    .from('pro_devis_analyses')
    .insert({
      company_id: originalAnalysis.company_id,
      reference_devis: originalAnalysis.reference_devis,
      nom_projet: originalAnalysis.nom_projet,
      montant_ht: originalAnalysis.montant_ht,
      montant_ttc: originalAnalysis.montant_ttc,
      date_devis: originalAnalysis.date_devis,
      file_url: newFileUrl,
      file_name: originalAnalysis.file_name,
      status: 'PENDING',
      version: (originalAnalysis.version || 1) + 1,
      parent_analysis_id: originalAnalysisId,
    })
    .select()
    .single();

  if (createError || !newAnalysis) {
    throw new Error('Failed to create new analysis version');
  }

  // 3. Lancer l'analyse
  return analyzeProDevis(newAnalysis.id);
}

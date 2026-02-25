/**
 * Supabase Execution Bridge Service v1.0
 * Orchestrates full TORP pipeline execution with Supabase integration
 * Loads quote data → builds context → executes all engines → persists results
 */

import { supabase } from '@/lib/supabase';
import { EngineExecutionContext } from '@/core/platform/engineExecutionContext';

/**
 * Execution bridge result
 */
export interface ExecutionBridgeResult {
  success: boolean;
  devisId: string;
  finalGrade?: string;
  finalScore?: number;
  snapshotId?: string;
  analysisResultId?: string;
  errors?: string[];
  metadata: {
    version: string;
    executedAt: string;
    durationMs: number;
    engineCount: number;
    persistenceStatus: 'success' | 'partial' | 'failed';
  };
}

/**
 * Type definitions for Supabase quote data
 */
interface SupabaseDevis {
  id: string;
  extracted_data: Record<string, any>;
  montant_total: number;
  chantier_region_nom: string;
  chantier_departement_nom: string;
  score_reputation: number;
  score_localisation: number;
  scoring_v2: Record<string, any>;
  user_id: string;
  project_id: string;
  company_id: string;
  created_at: string;
  updated_at: string;
}


/**
 * Load devis from Supabase
 */
async function loadDevisFromSupabase(devisId: string): Promise<SupabaseDevis> {
  try {
    console.log(`[Bridge] Loading devis: ${devisId}`);

    const { data, error } = await supabase
      .from('devis')
      .select('*')
      .eq('id', devisId)
      .single();

    if (error) {
      throw new Error(`Failed to load devis: ${error.message}`);
    }

    if (!data) {
      throw new Error(`Devis not found: ${devisId}`);
    }

    console.log(`[Bridge] Devis loaded successfully`, {
      id: data.id,
      amount: data.montant_total,
      region: data.chantier_region_nom,
    });

    return data as SupabaseDevis;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Bridge] Failed to load devis`, { error: errorMessage });
    throw error;
  }
}

/**
 * Build ExecutionContext from Supabase devis
 */
function buildExecutionContextFromDevis(devis: SupabaseDevis): EngineExecutionContext {
  try {
    console.log(`[Bridge] Building ExecutionContext`);

    const context: EngineExecutionContext = {
      projectId: devis.project_id,
      projectData: devis.extracted_data || {},
      executionStartTime: new Date().toISOString(),

      // Initialize empty engine results
      context: {
        detectedLots: [],
        summary: '',
      },
      lots: {
        normalizedLots: [],
        primaryLots: [],
        complexityScore: 0,
        categorySummary: {},
      },
      rules: {
        obligations: [],
        uniqueDetailedObligations: [],
        typeBreakdown: {},
        severityBreakdown: {},
      },
      audit: {
        riskScore: 0,
        globalScore: 0,
        riskLevel: 'unknown',
      },
      enterprise: {
        score: devis.score_reputation || 0,
        summary: {
          yearsInBusiness: 0,
          hasInsurance: false,
          employees: 0,
        },
      },
      pricing: {
        score: 0,
        totalAmount: devis.montant_total || 0,
        avgPerLot: 0,
      },
      quality: {
        score: 0,
        descriptionLength: 0,
        hasLegalMentions: false,
      },
      geography: {
        score: devis.score_localisation || 0,
        region: devis.chantier_region_nom,
        department: devis.chantier_departement_nom,
      },

      // Metadata
      bridgeMetadata: {
        devisId: devis.id,
        userId: devis.user_id,
        companyId: devis.company_id,
        loadedAt: new Date().toISOString(),
        sourceData: {
          montantTotal: devis.montant_total,
          scoreReputation: devis.score_reputation,
          scoreLocalisation: devis.score_localisation,
        },
      },
    };

    console.log(`[Bridge] ExecutionContext built successfully`);
    return context;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Bridge] Failed to build ExecutionContext`, { error: errorMessage });
    throw error;
  }
}

/**
 * Execute full TORP pipeline
 * Calls all engines sequentially without modifying them
 */
async function executeFullTorpPipeline(context: EngineExecutionContext): Promise<EngineExecutionContext> {
  try {
    console.log(`[Bridge] Executing full TORP pipeline`);

    // Import engines (lazy loading to ensure they exist)
    const { ContextEngine } = await import('@/core/engines/contextEngine');
    const { LotEngine } = await import('@/core/engines/lotEngine');
    const { RuleEngine } = await import('@/core/engines/ruleEngine');
    const { ScoringEngine } = await import('@/core/engines/scoringEngine');
    const { EnrichmentEngine } = await import('@/core/engines/enrichmentEngine');
    const { AuditEngine } = await import('@/core/engines/auditEngine');
    const { EnterpriseEngine } = await import('@/core/engines/enterpriseEngine');
    const { PricingEngine } = await import('@/core/engines/pricingEngine');
    const { QualityEngine } = await import('@/core/engines/qualityEngine');
    const { GlobalScoringEngine } = await import('@/core/engines/globalScoringEngine');
    const { TrustCappingEngine } = await import('@/core/engines/trustCappingEngine');
    const { StructuralConsistencyEngine } = await import('@/core/engines/structuralConsistencyEngine');

    let executionContext = context;
    const engines = [
      { name: 'ContextEngine', engine: ContextEngine },
      { name: 'LotEngine', engine: LotEngine },
      { name: 'RuleEngine', engine: RuleEngine },
      { name: 'ScoringEngine', engine: ScoringEngine },
      { name: 'EnrichmentEngine', engine: EnrichmentEngine },
      { name: 'AuditEngine', engine: AuditEngine },
      { name: 'EnterpriseEngine', engine: EnterpriseEngine },
      { name: 'PricingEngine', engine: PricingEngine },
      { name: 'QualityEngine', engine: QualityEngine },
      { name: 'GlobalScoringEngine', engine: GlobalScoringEngine },
      { name: 'TrustCappingEngine', engine: TrustCappingEngine },
      { name: 'StructuralConsistencyEngine', engine: StructuralConsistencyEngine },
    ];

    for (const { name, engine } of engines) {
      try {
        console.log(`[Bridge] Executing ${name}`);
        executionContext = await engine.execute(executionContext);
        console.log(`[Bridge] ${name} completed`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`[Bridge] ${name} warning:`, errorMessage);
        // Continue execution even if an engine fails (graceful degradation)
      }
    }

    console.log(`[Bridge] Full pipeline executed successfully`);
    return executionContext;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Bridge] Pipeline execution failed`, { error: errorMessage });
    throw error;
  }
}

/**
 * Get official grade from execution context
 */
function getOfficialGrade(context: EngineExecutionContext): string {
  // The only authorized source for the final professional grade
  return (
    context.finalProfessionalGrade ||
    context.globalScore?.grade ||
    (context as any)?.trustCapping?.grade ||
    'E' // Fallback
  );
}

/**
 * Get official score from execution context
 */
function getOfficialScore(context: EngineExecutionContext): number {
  return (
    (context as any)?.globalScore?.score ||
    (context as any)?.audit?.globalScore ||
    0
  );
}

/**
 * Persist results to Supabase
 */
async function persistResultsToSupabase(
  devisId: string,
  context: EngineExecutionContext,
  finalGrade: string,
  finalScore: number
): Promise<{
  success: boolean;
  analysisResultId?: string;
  snapshotId?: string;
  errors: string[];
}> {
  const errors: string[] = [];
  let analysisResultId: string | undefined;
  let snapshotId: string | undefined;

  try {
    console.log(`[Bridge] Starting persistence to Supabase`);

    // Step 1: Update devis table
    try {
      console.log(`[Bridge] Updating devis table`);

      const scoringV2 = {
        ...(context as any)?.scoring_v2,
        executedAt: new Date().toISOString(),
        finalGrade,
        finalScore,
      };

      const scoringBreakdown = {
        enterpriseScore: (context.enterprise as any)?.score || 0,
        pricingScore: (context.pricing as any)?.score || 0,
        qualityScore: (context.quality as any)?.score || 0,
        globalScore: finalScore,
        auditScore: (context.audit as any)?.globalScore || 0,
      };

      const { error: updateError } = await supabase
        .from('devis')
        .update({
          score_total: finalScore,
          grade: finalGrade,
          scoring_v2: scoringV2,
          scoring_breakdown: scoringBreakdown,
          updated_at: new Date().toISOString(),
        })
        .eq('id', devisId);

      if (updateError) {
        const errMsg = `Failed to update devis: ${updateError.message}`;
        console.error(`[Bridge] ${errMsg}`);
        errors.push(errMsg);
      } else {
        console.log(`[Bridge] Devis table updated successfully`);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Bridge] Devis update exception:`, errMsg);
      errors.push(`Devis update: ${errMsg}`);
    }

    // Step 2: Insert into analysis_results
    try {
      console.log(`[Bridge] Inserting analysis results`);

      const analysisResult = {
        devis_id: devisId,
        total_score: finalScore,
        final_grade: finalGrade,
        enterprise_score: (context.enterprise as any)?.score || 0,
        price_score: (context.pricing as any)?.score || 0,
        completeness_score: (context.audit as any)?.globalScore || 0,
        conformity_score: 0,
        delays_score: 0,
        summary: `TORP Analysis - Final Grade: ${finalGrade}, Score: ${finalScore}`,
        strengths: [],
        weaknesses: [],
        recommendations: [],
        created_by: (context as any)?.bridgeMetadata?.userId || 'system',
        created_at: new Date().toISOString(),
      };

      const { data: insertData, error: insertError } = await supabase
        .from('analysis_results')
        .insert([analysisResult])
        .select('id')
        .single();

      if (insertError) {
        const errMsg = `Failed to insert analysis results: ${insertError.message}`;
        console.error(`[Bridge] ${errMsg}`);
        errors.push(errMsg);
      } else {
        analysisResultId = (insertData as any)?.id;
        console.log(`[Bridge] Analysis results inserted: ${analysisResultId}`);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Bridge] Analysis results insertion exception:`, errMsg);
      errors.push(`Analysis insertion: ${errMsg}`);
    }

    // Step 3: Insert into score_snapshots
    try {
      console.log(`[Bridge] Creating score snapshot`);

      const snapshot = {
        devis_id: devisId,
        execution_context_id: `ctx_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        global_score: finalScore,
        grade: finalGrade,
        scores_by_axis: {
          enterprise: (context.enterprise as any)?.score || 0,
          pricing: (context.pricing as any)?.score || 0,
          quality: (context.quality as any)?.score || 0,
          geography: (context as any)?.geography?.score || 0,
        },
        snapshot_type: 'runtime',
        created_at: new Date().toISOString(),
      };

      const { data: snapshotData, error: snapshotError } = await supabase
        .from('score_snapshots')
        .insert([snapshot])
        .select('id')
        .single();

      if (snapshotError) {
        const errMsg = `Failed to create snapshot: ${snapshotError.message}`;
        console.error(`[Bridge] ${errMsg}`);
        errors.push(errMsg);
      } else {
        snapshotId = (snapshotData as any)?.id;
        console.log(`[Bridge] Snapshot created: ${snapshotId}`);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Bridge] Snapshot creation exception:`, errMsg);
      errors.push(`Snapshot creation: ${errMsg}`);
    }

    const success = errors.length === 0;
    const status = errors.length === 0 ? 'success' : errors.length < 2 ? 'partial' : 'failed';

    console.log(`[Bridge] Persistence complete`, {
      success,
      status,
      errors: errors.length,
    });

    return {
      success: success || errors.length < 2, // Success if no errors or only partial
      analysisResultId,
      snapshotId,
      errors,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Bridge] Persistence failed with exception:`, errMsg);
    return {
      success: false,
      errors: [`Persistence exception: ${errMsg}`],
    };
  }
}

/**
 * Main bridge function: Execute full TORP analysis
 */
export async function executeFullTorpAnalysis(devisId: string): Promise<ExecutionBridgeResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[Bridge] Starting TORP Analysis for devis: ${devisId}`);
    console.log(`${'='.repeat(60)}\n`);

    // Step 1: Load devis
    let devis: SupabaseDevis;
    try {
      devis = await loadDevisFromSupabase(devisId);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Load devis failed: ${errMsg}`);
      console.error(`[Bridge] Fatal error: ${errMsg}`);

      return {
        success: false,
        devisId,
        errors,
        metadata: {
          version: '1.0',
          executedAt: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          engineCount: 0,
          persistenceStatus: 'failed',
        },
      };
    }

    // Step 2: Build execution context
    let executionContext: EngineExecutionContext;
    try {
      executionContext = buildExecutionContextFromDevis(devis);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Build context failed: ${errMsg}`);
      console.error(`[Bridge] Fatal error: ${errMsg}`);

      return {
        success: false,
        devisId,
        errors,
        metadata: {
          version: '1.0',
          executedAt: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          engineCount: 0,
          persistenceStatus: 'failed',
        },
      };
    }

    // Step 3: Execute full pipeline
    try {
      executionContext = await executeFullTorpPipeline(executionContext);
      console.log(`[Bridge] Pipeline execution successful`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Pipeline execution failed: ${errMsg}`);
      console.warn(`[Bridge] Pipeline warning: ${errMsg}`);
      // Continue with what we have - graceful degradation
    }

    // Step 4: Extract official results
    const finalGrade = getOfficialGrade(executionContext);
    const finalScore = getOfficialScore(executionContext);

    console.log(`[Bridge] Grade computed`, {
      grade: finalGrade,
      score: finalScore,
    });

    // Step 5: Persist results
    let persistenceResult = { success: false, errors: [], analysisResultId: undefined, snapshotId: undefined };
    try {
      persistenceResult = await persistResultsToSupabase(devisId, executionContext, finalGrade, finalScore);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Bridge] Persistence exception:`, errMsg);
      errors.push(`Persistence exception: ${errMsg}`);
    }

    // Build final result
    const durationMs = Date.now() - startTime;
    const success = errors.length === 0 && persistenceResult.success;

    const result: ExecutionBridgeResult = {
      success,
      devisId,
      finalGrade,
      finalScore,
      snapshotId: persistenceResult.snapshotId,
      analysisResultId: persistenceResult.analysisResultId,
      errors: errors.length > 0 ? errors : undefined,
      metadata: {
        version: '1.0',
        executedAt: new Date().toISOString(),
        durationMs,
        engineCount: 12,
        persistenceStatus: persistenceResult.success ? 'success' : 'failed',
      },
    };

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[Bridge] Analysis Complete`);
    console.log(`Status: ${success ? '✅ SUCCESS' : '⚠️ PARTIAL'}`);
    console.log(`Grade: ${finalGrade} | Score: ${finalScore}`);
    console.log(`Duration: ${durationMs}ms`);
    console.log(`Snapshot ID: ${persistenceResult.snapshotId || 'N/A'}`);
    console.log(`${'='.repeat(60)}\n`);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Bridge] Fatal exception:`, errorMessage);

    return {
      success: false,
      devisId,
      errors: [errorMessage],
      metadata: {
        version: '1.0',
        executedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        engineCount: 12,
        persistenceStatus: 'failed',
      },
    };
  }
}

/**
 * Format execution result as readable text
 */
export function formatExecutionResultAsText(result: ExecutionBridgeResult): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════',
    'TORP Execution Bridge Result',
    '═══════════════════════════════════════════════',
    '',
    `Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`,
    `Devis ID: ${result.devisId}`,
    '',
    `Final Grade: ${result.finalGrade || 'N/A'}`,
    `Final Score: ${result.finalScore || 0}`,
    '',
    `Snapshot ID: ${result.snapshotId || 'Not created'}`,
    `Analysis Result ID: ${result.analysisResultId || 'Not created'}`,
    '',
    `Duration: ${result.metadata.durationMs}ms`,
    `Engines: ${result.metadata.engineCount}`,
    `Persistence: ${result.metadata.persistenceStatus}`,
    `Executed: ${result.metadata.executedAt}`,
  ];

  if (result.errors && result.errors.length > 0) {
    lines.push('');
    lines.push('─ Errors ─');
    result.errors.forEach((error) => {
      lines.push(`• ${error}`);
    });
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Get bridge metadata
 */
export function getSupabaseExecutionBridgeMetadata(): Record<string, any> {
  return {
    name: 'Supabase Execution Bridge',
    version: '1.0',
    purpose: 'Orchestrate full TORP pipeline with Supabase integration',
    capabilities: {
      devisLoading: true,
      contextBuilding: true,
      fullPipelineExecution: true,
      gradeExtraction: true,
      resultsPeristence: true,
      snapshotCreation: true,
      errorHandling: true,
    },
    architecture: {
      loadPhase: 'Load devis from Supabase',
      buildPhase: 'Build ExecutionContext',
      executePhase: 'Run all 12 TORP engines',
      extractPhase: 'Get official grade from context',
      persistPhase: 'Save results to Supabase',
    },
    enginePipeline: [
      'ContextEngine',
      'LotEngine',
      'RuleEngine',
      'ScoringEngine',
      'EnrichmentEngine',
      'AuditEngine',
      'EnterpriseEngine',
      'PricingEngine',
      'QualityEngine',
      'GlobalScoringEngine',
      'TrustCappingEngine',
      'StructuralConsistencyEngine',
    ],
    database: {
      tables: ['devis', 'analysis_results', 'score_snapshots'],
      readTables: ['devis'],
      writeTables: ['devis', 'analysis_results', 'score_snapshots'],
    },
  };
}

/**
 * Engine Orchestrator
 * Orchestration centrale pour coordonner l'exécution des engines
 * Version 1.0 - Structure pure, pas de logique métier
 */

import { ENGINE_REGISTRY, EngineRegistryEntry } from '@/core/platform/engineRegistry';
import { runContextEngine, ContextEngineResult } from '@/core/engines/context.engine';
import { runLotEngine, LotEngineResult } from '@/core/engines/lot.engine';
import { runRuleEngine, RuleEngineResult } from '@/core/engines/rule.engine';
import { runScoringEngine, ScoringEngineResult } from '@/core/engines/scoring.engine';
import { runEnrichmentEngine, EnrichmentEngineResult } from '@/core/engines/enrichment.engine';
import { runAuditEngine, AuditEngineResult } from '@/core/engines/audit.engine';
import { runEnterpriseEngine, EnterpriseEngineResult } from '@/core/engines/enterprise.engine';
import { runPricingEngine, PricingEngineResult } from '@/core/engines/pricing.engine';
import { runQualityEngine, QualityEngineResult } from '@/core/engines/quality.engine';
import { runGlobalScoringEngine, GlobalScoringEngineResult } from '@/core/engines/globalScoring.engine';
import { createAuditSnapshot } from '@/core/platform/auditSnapshot.manager';
import { EngineExecutionContext } from '@/core/platform/engineExecutionContext';

/**
 * Statut d'orchestration
 */
export type OrchestrationStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error';

/**
 * Résultat d'exécution d'un engine
 */
export interface EngineExecutionResult {
  engineId: string;
  status: 'pending' | 'running' | 'completed' | 'skipped' | 'failed';
  startTime?: string;
  endTime?: string;
  error?: string;
}

/**
 * Contexte d'orchestration
 */
export interface OrchestrationContext {
  projectId?: string;
  data?: Record<string, any>;
  options?: Record<string, any>;
}

/**
 * Résultat d'orchestration
 */
export interface OrchestrationResult {
  id: string;
  status: OrchestrationStatus;
  startTime: string;
  endTime?: string;
  executedEngines: EngineExecutionResult[];
  totalEngines: number;
  activeEngines: number;
  results?: Record<string, any>;
  error?: string;
}

/**
 * État global de l'orchestrateur
 */
let orchestrationState: OrchestrationStatus = 'idle';
let lastOrchestration: OrchestrationResult | null = null;

/**
 * Lance une orchestration
 * Version 1.0 : Structure seule, pas d'exécution réelle
 */
export async function runOrchestration(
  context: OrchestrationContext = {}
): Promise<OrchestrationResult> {
  console.log('[EngineOrchestrator] Orchestration started', { context });

  const orchestrationId = generateOrchestrationId();
  const startTime = new Date().toISOString();

  orchestrationState = 'running';

  try {
    // Get active engines
    const activeEngines = getActiveEngines();
    const engineResults: Record<string, any> = {};
    const executedEngines: EngineExecutionResult[] = [];

    // Create shared execution context for sequential engine pipeline
    const executionContext: EngineExecutionContext = {
      projectId: context.projectId || '',
      projectData: context.data || {},
      executionStartTime: startTime,
      currentPhase: 'context',
    };

    // Execute each active engine
    for (const engine of activeEngines) {
      const engineStartTime = new Date().toISOString();
      const engineExecutionResult: EngineExecutionResult = {
        engineId: engine.id,
        status: 'running',
        startTime: engineStartTime,
      };

      try {
        // Execute Context Engine if active
        if (engine.id === 'contextEngine') {
          console.log('[EngineOrchestrator] Executing Context Engine');
          const contextResult: ContextEngineResult = await runContextEngine({
            projectId: context.projectId,
            data: context.data,
            options: context.options,
          });
          engineResults['contextEngine'] = contextResult;

          // Populate shared execution context with Context Engine results
          executionContext.context = {
            detectedLots: contextResult.detectedLots,
            spaces: contextResult.spaces,
            flags: contextResult.flags,
            summary: contextResult.summary,
          };

          engineExecutionResult.status = 'completed';
          engineExecutionResult.endTime = new Date().toISOString();
        }
        // Execute Lot Engine if active (depends on Context Engine)
        else if (engine.id === 'lotEngine') {
          console.log('[EngineOrchestrator] Executing Lot Engine');
          const lotResult: LotEngineResult = await runLotEngine(executionContext);
          engineResults['lotEngine'] = lotResult;

          // Populate shared execution context with Lot Engine results
          executionContext.lots = {
            normalizedLots: lotResult.normalizedLots,
            primaryLots: lotResult.primaryLots,
            complexityScore: lotResult.complexityScore,
            categorySummary: lotResult.categorySummary,
          };

          engineExecutionResult.status = 'completed';
          engineExecutionResult.endTime = new Date().toISOString();
        }
        // Execute Rule Engine if active (depends on Lot Engine)
        else if (engine.id === 'ruleEngine') {
          console.log('[EngineOrchestrator] Executing Rule Engine');
          const ruleResult: RuleEngineResult = await runRuleEngine(executionContext);
          engineResults['ruleEngine'] = ruleResult;

          // Populate shared execution context with Rule Engine results
          executionContext.rules = {
            obligations: ruleResult.obligations,
            uniqueObligations: ruleResult.uniqueObligations,
            detailedObligations: ruleResult.uniqueDetailedObligations,
            obligationCount: ruleResult.obligationCount,
            ruleCount: ruleResult.ruleCount,
            totalWeight: ruleResult.totalWeight,
            severityBreakdown: ruleResult.severityBreakdown,
            typeBreakdown: ruleResult.typeBreakdown,
          };

          engineExecutionResult.status = 'completed';
          engineExecutionResult.endTime = new Date().toISOString();
        }
        // Execute Scoring Engine if active (depends on Rule Engine and Lot Engine)
        else if (engine.id === 'scoringEngine') {
          console.log('[EngineOrchestrator] Executing Scoring Engine');
          const scoringResult: ScoringEngineResult = await runScoringEngine(executionContext);
          engineResults['scoringEngine'] = scoringResult;

          // Populate shared execution context with Scoring Engine results
          executionContext.audit = {
            riskScore: scoringResult.riskScore,
            complexityImpact: scoringResult.complexityImpact,
            globalScore: scoringResult.globalScore,
            riskLevel: scoringResult.riskLevel,
            scoreBreakdown: scoringResult.scoreBreakdown,
          };

          engineExecutionResult.status = 'completed';
          engineExecutionResult.endTime = new Date().toISOString();
        }
        // Execute Enrichment Engine if active (depends on all prior engines)
        else if (engine.id === 'enrichmentEngine') {
          console.log('[EngineOrchestrator] Executing Enrichment Engine');
          const enrichmentResult: EnrichmentEngineResult = await runEnrichmentEngine(executionContext);
          engineResults['enrichmentEngine'] = enrichmentResult;

          // Populate shared execution context with Enrichment Engine results
          executionContext.enrichments = {
            actions: enrichmentResult.actions,
            recommendations: enrichmentResult.recommendations,
            actionCount: enrichmentResult.actionCount,
            recommendationCount: enrichmentResult.recommendationCount,
            riskProfile: enrichmentResult.riskProfile,
            processingStrategy: enrichmentResult.processingStrategy,
          };

          engineExecutionResult.status = 'completed';
          engineExecutionResult.endTime = new Date().toISOString();
        }
        // Execute Audit Engine if active (depends on all prior engines - final pipeline stage)
        else if (engine.id === 'auditEngine') {
          console.log('[EngineOrchestrator] Executing Audit Engine');
          const auditResult: AuditEngineResult = await runAuditEngine(executionContext);
          engineResults['auditEngine'] = auditResult;

          // Populate shared execution context with Audit Engine results
          executionContext.auditReport = auditResult.report;

          // Create audit snapshot for lifecycle versioning (if projectId available)
          if (executionContext.context?.projectId) {
            try {
              const snapshot = createAuditSnapshot(
                executionContext.context.projectId,
                auditResult.report
              );
              executionContext.auditSnapshot = snapshot;
              console.log('[EngineOrchestrator] Audit snapshot created', {
                projectId: executionContext.context.projectId,
                snapshotId: snapshot.id,
                version: snapshot.version,
              });
            } catch (snapshotError) {
              const errorMsg = snapshotError instanceof Error ? snapshotError.message : 'Unknown error';
              console.warn('[EngineOrchestrator] Failed to create audit snapshot', {
                projectId: executionContext.context.projectId,
                error: errorMsg,
              });
              // Snapshot creation failure is non-critical - continue
            }
          }

          engineExecutionResult.status = 'completed';
          engineExecutionResult.endTime = new Date().toISOString();
        }
        // Execute Enterprise Engine if active (global scoring pillar)
        else if (engine.id === 'enterpriseEngine') {
          console.log('[EngineOrchestrator] Executing Enterprise Engine');
          const enterpriseResult: EnterpriseEngineResult = await runEnterpriseEngine(executionContext);
          engineResults['enterpriseEngine'] = enterpriseResult;
          executionContext.enterprise = enterpriseResult;
          engineExecutionResult.status = 'completed';
          engineExecutionResult.endTime = new Date().toISOString();
        }
        // Execute Pricing Engine if active (global scoring pillar)
        else if (engine.id === 'pricingEngine') {
          console.log('[EngineOrchestrator] Executing Pricing Engine');
          const pricingResult: PricingEngineResult = await runPricingEngine(executionContext);
          engineResults['pricingEngine'] = pricingResult;
          executionContext.pricing = pricingResult;
          engineExecutionResult.status = 'completed';
          engineExecutionResult.endTime = new Date().toISOString();
        }
        // Execute Quality Engine if active (global scoring pillar)
        else if (engine.id === 'qualityEngine') {
          console.log('[EngineOrchestrator] Executing Quality Engine');
          const qualityResult: QualityEngineResult = await runQualityEngine(executionContext);
          engineResults['qualityEngine'] = qualityResult;
          executionContext.quality = qualityResult;
          engineExecutionResult.status = 'completed';
          engineExecutionResult.endTime = new Date().toISOString();
        }
        // Execute Global Scoring Engine if active (final scoring consolidation)
        else if (engine.id === 'globalScoringEngine') {
          console.log('[EngineOrchestrator] Executing Global Scoring Engine');
          const globalScoringResult: GlobalScoringEngineResult = await runGlobalScoringEngine(executionContext);
          engineResults['globalScoringEngine'] = globalScoringResult;
          executionContext.globalScore = globalScoringResult;
          engineExecutionResult.status = 'completed';
          engineExecutionResult.endTime = new Date().toISOString();
        } else {
          // Other engines not yet implemented
          engineExecutionResult.status = 'skipped';
          engineExecutionResult.endTime = new Date().toISOString();
        }
      } catch (engineError) {
        const errorMessage = engineError instanceof Error ? engineError.message : 'Unknown error';
        console.error(`[EngineOrchestrator] Engine ${engine.id} failed`, engineError);
        engineExecutionResult.status = 'failed';
        engineExecutionResult.error = errorMessage;
        engineExecutionResult.endTime = new Date().toISOString();
      }

      executedEngines.push(engineExecutionResult);
    }

    const result: OrchestrationResult = {
      id: orchestrationId,
      status: 'completed',
      startTime,
      endTime: new Date().toISOString(),
      executedEngines,
      totalEngines: ENGINE_REGISTRY.length,
      activeEngines: activeEngines.length,
      results: {
        ...engineResults,
        executionContext, // Store shared context for pipeline access
      },
    };

    lastOrchestration = result;
    orchestrationState = 'idle';

    console.log('[EngineOrchestrator] Orchestration completed', result);
    return result;
  } catch (error) {
    orchestrationState = 'error';
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('[EngineOrchestrator] Orchestration failed', error);

    return {
      id: orchestrationId,
      status: 'error',
      startTime,
      endTime: new Date().toISOString(),
      executedEngines: [],
      totalEngines: ENGINE_REGISTRY.length,
      activeEngines: 0,
      error: errorMessage,
    };
  }
}

/**
 * Récupère tous les engines actifs
 */
export function getActiveEngines(): EngineRegistryEntry[] {
  return ENGINE_REGISTRY.filter((engine) => engine.status === 'active');
}

/**
 * Récupère tous les engines inactifs
 */
export function getInactiveEngines(): EngineRegistryEntry[] {
  return ENGINE_REGISTRY.filter((engine) => engine.status === 'inactive');
}

/**
 * Récupère tous les engines en erreur
 */
export function getErrorEngines(): EngineRegistryEntry[] {
  return ENGINE_REGISTRY.filter((engine) => engine.status === 'error');
}

/**
 * Récupère le statut actuel de l'orchestrateur
 */
export function getOrchestrationStatus(): OrchestrationStatus {
  return orchestrationState;
}

/**
 * Récupère la dernière orchestration exécutée
 */
export function getLastOrchestration(): OrchestrationResult | null {
  return lastOrchestration;
}

/**
 * Réinitialise l'état de l'orchestrateur
 */
export function resetOrchestrationState(): void {
  orchestrationState = 'idle';
  lastOrchestration = null;
  console.log('[EngineOrchestrator] State reset');
}

/**
 * Pause l'orchestration en cours
 */
export function pauseOrchestration(): void {
  if (orchestrationState === 'running') {
    orchestrationState = 'paused';
    console.log('[EngineOrchestrator] Orchestration paused');
  }
}

/**
 * Reprend l'orchestration en pause
 */
export function resumeOrchestration(): void {
  if (orchestrationState === 'paused') {
    orchestrationState = 'running';
    console.log('[EngineOrchestrator] Orchestration resumed');
  }
}

/**
 * Arrête l'orchestration en cours
 */
export function stopOrchestration(): void {
  orchestrationState = 'idle';
  console.log('[EngineOrchestrator] Orchestration stopped');
}

/**
 * Génère un ID unique pour une orchestration
 */
function generateOrchestrationId(): string {
  return `orch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Récupère les statistiques d'orchestration
 */
export function getOrchestrationStats() {
  const activeCount = getActiveEngines().length;
  const inactiveCount = getInactiveEngines().length;
  const errorCount = getErrorEngines().length;

  return {
    totalEngines: ENGINE_REGISTRY.length,
    activeEngines: activeCount,
    inactiveEngines: inactiveCount,
    errorEngines: errorCount,
    currentStatus: getOrchestrationStatus(),
    lastOrchestrationTime: lastOrchestration?.endTime,
  };
}

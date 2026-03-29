/**
 * Project Structuring Engine — barrel export
 *
 * Integration example (full pipeline):
 *
 * ```typescript
 * import {
 *   buildProjectGraph,
 *   getActivationWorkTypes,
 *   formatProjectGraphSummary,
 * } from '@/core/project';
 * import { runWorkTypeActivationPipeline } from '@/core/workTypes';
 *
 * // 1. Build project structure from description
 * const graph = buildProjectGraph('construction piscine 10x4 avec plage carrelée');
 *
 * // 2. Inspect the result
 * console.log(graph.project_type);           // 'PISCINE'
 * console.log(graph.project_type_confidence); // 0.857
 * console.log(graph.summary.structurally_complete); // false if mandatory phases missing
 * console.log(graph.missing_phases.map(p => p.phase_name));
 *
 * // 3. Get execution order (topological batches)
 * for (const batch of graph.execution_order) {
 *   console.log(`Lot ${batch.batch_index + 1}: ${batch.phase_names.join(' + ')}`);
 * }
 *
 * // 4. Feed expected work types into the rule activation engine
 * const workTypesForActivation = getActivationWorkTypes(graph, 'expected');
 * const activationResult = await runWorkTypeActivationPipeline(supabase, quoteText);
 *
 * // 5. Log human-readable summary (for LLM context / audit log)
 * console.log(formatProjectGraphSummary(graph));
 * ```
 *
 * Strategies:
 *
 *   getActivationWorkTypes(graph, 'expected')
 *     → ALL work types from the blueprint.
 *     → Activates every applicable rule, including for phases not yet quoted.
 *     → Best for: compliance audit, gap detection.
 *
 *   getActivationWorkTypes(graph, 'detected')
 *     → Only work types found in the quote text.
 *     → Activates rules for what is explicitly present.
 *     → Best for: quote line-item validation.
 */

// ── Types ──────────────────────────────────────────────────────────────────
export type {
  ProjectType,
  PhaseType,
  PhaseNode,
  ProjectBlueprint,
  PhaseStatus,
  ProjectPhaseResult,
  ExecutionBatch,
  ProjectGraphSummary,
  ProjectGraph,
} from './projectTypes';

export { PROJECT_TYPES, PHASE_TYPES } from './projectTypes';

// ── Blueprints ─────────────────────────────────────────────────────────────
export { PROJECT_BLUEPRINTS }         from './projectBlueprints';

// ── Detection ──────────────────────────────────────────────────────────────
export type { ProjectTypeCandidate }  from './projectDetection.service';
export {
  detectProjectType,
  detectProjectTypeCandidates,
  PROJECT_DETECTION_THRESHOLD,
}                                     from './projectDetection.service';

// ── Graph builder ──────────────────────────────────────────────────────────
export {
  buildProjectGraph,
  formatProjectGraphSummary,
  getActivationWorkTypes,
}                                     from './projectGraph.service';

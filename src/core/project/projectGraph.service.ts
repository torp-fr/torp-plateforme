/**
 * Project Graph Service
 *
 * Builds a structured project graph from a free-text project description.
 *
 * Pipeline:
 *
 *   1. detectProjectType(text)          → primary ProjectType + confidence
 *   2. Load blueprint for that type     → PhaseNode[]
 *   3. detectWorkTypes(text)            → DetectedWorkType[] (from workType engine)
 *   4. Map detected work types → phases → PhaseStatus per phase
 *   5. Topological sort (Kahn's BFS)    → ExecutionBatch[]
 *   6. Compute coverage statistics      → ProjectGraphSummary
 *   7. Return ProjectGraph
 *
 * Phase status logic:
 *
 *   detected  — at least one of the phase's work_types was detected in the text
 *               with confidence ≥ WORK_TYPE_COVERAGE_THRESHOLD
 *   missing   — mandatory phase with zero detected work types
 *   optional  — non-mandatory phase with zero detected work types
 *
 * Integration with rule activation:
 *
 *   The returned ProjectGraph.expected_work_types contains ALL work types from
 *   the blueprint — this is the input to activateRules() to fetch the complete
 *   applicable rule set (even for phases not yet quoted).
 *
 *   ProjectGraph.detected_work_types is the subset actually found in the text —
 *   used by the verifiability engine to decide verifiable vs non_verifiable.
 *
 * Topological sort:
 *   Implements Kahn's algorithm. Phases with no unmet dependencies are placed
 *   in batch 0. Each pass removes ready phases and resolves their dependents.
 *   Cycles in depends_on produce an error (should never occur with valid blueprints).
 */

import type { WorkType }             from '@/core/workTypes/workTypes';
import { detectWorkTypes }           from '@/core/workTypes/workTypeDetection.service';
import type {
  ProjectGraph,
  ProjectPhaseResult,
  ProjectGraphSummary,
  ExecutionBatch,
  PhaseStatus,
  PhaseType,
}                                    from './projectTypes';
import { detectProjectType }         from './projectDetection.service';
import { PROJECT_BLUEPRINTS }        from './projectBlueprints';

// =============================================================================
// Constants
// =============================================================================

/**
 * Minimum work type detection confidence required for a phase to be considered
 * "detected". Below this, a detected work type is too weak to credit the phase.
 */
const WORK_TYPE_COVERAGE_THRESHOLD = 0.15;

// =============================================================================
// Reverse index: WorkType → PhaseType[]
// =============================================================================

/**
 * For a given blueprint, build a reverse map from WorkType to the list of
 * PhaseTypes that include that work type. Used to credit phase coverage from
 * detected work types.
 */
function buildWorkTypeToPhases(
  phases: ReturnType<typeof PROJECT_BLUEPRINTS[keyof typeof PROJECT_BLUEPRINTS]['phases']>,
): Map<WorkType, PhaseType[]> {
  const map = new Map<WorkType, PhaseType[]>();
  for (const phase of phases) {
    for (const wt of phase.work_types) {
      const existing = map.get(wt) ?? [];
      existing.push(phase.id);
      map.set(wt, existing);
    }
  }
  return map;
}

// =============================================================================
// Phase status computation
// =============================================================================

function computePhaseResults(
  phases: ReturnType<typeof PROJECT_BLUEPRINTS[keyof typeof PROJECT_BLUEPRINTS]['phases']>,
  detectedWorkTypes: WorkType[],
): ProjectPhaseResult[] {
  const detectedSet = new Set(detectedWorkTypes);

  return phases.map((phase): ProjectPhaseResult => {
    const detected_work_types = phase.work_types.filter((wt) => detectedSet.has(wt));
    const coverage = phase.work_types.length > 0
      ? detected_work_types.length / phase.work_types.length
      : 0;

    let status: PhaseStatus;
    if (detected_work_types.length > 0) {
      status = 'detected';
    } else if (phase.mandatory) {
      status = 'missing';
    } else {
      status = 'optional';
    }

    return {
      phase_id:            phase.id,
      phase_name:          phase.name,
      status,
      work_types:          phase.work_types,
      detected_work_types,
      coverage:            Math.round(coverage * 1000) / 1000,
      depends_on:          phase.depends_on,
      parallel_with:       phase.parallel_with,
      mandatory:           phase.mandatory,
    };
  });
}

// =============================================================================
// Topological sort — Kahn's algorithm
// =============================================================================

/**
 * Produce chronological execution batches from a phase list with depends_on edges.
 * Returns an array of batches where each batch contains phases that can run
 * concurrently (all their dependencies are in prior batches).
 *
 * @throws {Error} if a dependency cycle is detected (invalid blueprint)
 */
function topologicalSort(
  phases: ProjectPhaseResult[],
): ExecutionBatch[] {
  const phaseMap = new Map(phases.map((p) => [p.phase_id, p]));
  // in-degree: number of unresolved dependencies
  const inDegree = new Map<PhaseType, number>();
  // adjacents: for each phase, which phases depend on it
  const dependents = new Map<PhaseType, PhaseType[]>();

  for (const phase of phases) {
    if (!inDegree.has(phase.phase_id)) {
      inDegree.set(phase.phase_id, 0);
    }
    for (const dep of phase.depends_on) {
      // dep → phase: dep must finish before phase starts
      // Increment in-degree of phase for each dependency
      inDegree.set(phase.phase_id, (inDegree.get(phase.phase_id) ?? 0) + 1);
      const list = dependents.get(dep) ?? [];
      list.push(phase.phase_id);
      dependents.set(dep, list);
    }
  }

  const batches: ExecutionBatch[] = [];
  // Start with phases that have no dependencies
  let ready = phases
    .filter((p) => (inDegree.get(p.phase_id) ?? 0) === 0)
    .map((p) => p.phase_id);

  let batchIndex = 0;

  while (ready.length > 0) {
    batches.push({
      batch_index:  batchIndex,
      phase_ids:    ready,
      phase_names:  ready.map((id) => phaseMap.get(id)?.phase_name ?? id),
    });

    const nextReady: PhaseType[] = [];
    for (const phaseId of ready) {
      for (const dependent of (dependents.get(phaseId) ?? [])) {
        const newDegree = (inDegree.get(dependent) ?? 1) - 1;
        inDegree.set(dependent, newDegree);
        if (newDegree === 0) {
          nextReady.push(dependent);
        }
      }
    }

    ready = nextReady;
    batchIndex++;
  }

  // Cycle detection: if any phase still has inDegree > 0, there is a cycle
  const remaining = phases.filter((p) => (inDegree.get(p.phase_id) ?? 0) > 0);
  if (remaining.length > 0) {
    // Graceful degradation: append remaining phases as a final batch rather than throwing
    console.error(
      `[PROJECT_GRAPH] Dependency cycle detected in phases: ${remaining.map((p) => p.phase_id).join(', ')}. ` +
      `These phases will be appended to the last batch.`,
    );
    batches.push({
      batch_index:  batchIndex,
      phase_ids:    remaining.map((p) => p.phase_id),
      phase_names:  remaining.map((p) => p.phase_name),
    });
  }

  return batches;
}

// =============================================================================
// Summary computation
// =============================================================================

function buildSummary(phases: ProjectPhaseResult[], expectedWt: WorkType[], detectedWt: WorkType[]): ProjectGraphSummary {
  const mandatory         = phases.filter((p) => p.mandatory);
  const mandatoryDetected = mandatory.filter((p) => p.status === 'detected');

  const expectedSet  = new Set(expectedWt);
  const detectedSet  = new Set(detectedWt);
  const intersection = [...detectedSet].filter((wt) => expectedSet.has(wt));

  const mandatory_coverage   = mandatory.length > 0
    ? mandatoryDetected.length / mandatory.length
    : 1;

  const work_type_coverage   = expectedSet.size > 0
    ? intersection.length / expectedSet.size
    : 0;

  return {
    total_phases:             phases.length,
    detected_phases:          phases.filter((p) => p.status === 'detected').length,
    missing_mandatory_phases: phases.filter((p) => p.status === 'missing').length,
    mandatory_coverage:       Math.round(mandatory_coverage * 1000) / 1000,
    work_type_coverage:       Math.round(work_type_coverage * 1000) / 1000,
    structurally_complete:    phases.filter((p) => p.status === 'missing').length === 0,
  };
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Build a structured project graph from a free-text project description.
 *
 * This is a pure, synchronous function — no DB calls, no side effects.
 * It calls detectWorkTypes() internally; if you already have detected work
 * types pass them as the optional second argument to avoid recomputation.
 *
 * @param text                    - Raw project description
 * @param preDetectedWorkTypes    - Optional pre-computed work type detections
 *                                  (from a prior detectWorkTypes call)
 * @returns ProjectGraph — fully annotated project structure
 */
export function buildProjectGraph(
  text: string,
  preDetectedWorkTypes?: ReturnType<typeof detectWorkTypes>,
): ProjectGraph {
  // ── 1. Detect project type ─────────────────────────────────────────────────
  const { project_type, confidence } = detectProjectType(text);

  // ── 2. Load blueprint ──────────────────────────────────────────────────────
  const blueprint = PROJECT_BLUEPRINTS[project_type];

  // ── 3. Detect work types ───────────────────────────────────────────────────
  const rawDetected = preDetectedWorkTypes ?? detectWorkTypes(text);
  const detected_work_types: WorkType[] = rawDetected
    .filter((d) => d.confidence >= WORK_TYPE_COVERAGE_THRESHOLD)
    .map((d) => d.work_type);

  // ── 4. Compute expected work types (union of all blueprint phase work_types) ─
  const expectedSet = new Set<WorkType>();
  for (const phase of blueprint.phases) {
    for (const wt of phase.work_types) {
      expectedSet.add(wt);
    }
  }
  const expected_work_types = Array.from(expectedSet);

  // ── 5. Compute phase results ───────────────────────────────────────────────
  const phases         = computePhaseResults(blueprint.phases, detected_work_types);
  const missing_phases = phases.filter((p) => p.status === 'missing');

  // ── 6. Topological sort ────────────────────────────────────────────────────
  const execution_order = topologicalSort(phases);

  // ── 7. Summary ─────────────────────────────────────────────────────────────
  const summary = buildSummary(phases, expected_work_types, detected_work_types);

  return {
    source_text:             text,
    project_type,
    project_type_confidence: confidence,
    phases,
    missing_phases,
    detected_work_types,
    expected_work_types,
    execution_order,
    summary,
  };
}

/**
 * Produce a human-readable text summary of a project graph.
 * Used in audit logs and LLM prompt context injection.
 */
export function formatProjectGraphSummary(graph: ProjectGraph): string {
  const lines: string[] = [
    `Projet : ${graph.project_type} (confiance ${Math.round(graph.project_type_confidence * 100)}%)`,
    `Phases : ${graph.summary.total_phases} au total, ${graph.summary.detected_phases} détectées`,
  ];

  if (graph.missing_phases.length > 0) {
    const names = graph.missing_phases.map((p) => p.phase_name).join(', ');
    lines.push(`⚠ Phases obligatoires manquantes : ${names}`);
  }

  lines.push(
    `Couverture corps d'état : ${Math.round(graph.summary.work_type_coverage * 100)}%`,
  );

  lines.push(`\nOrdre d'exécution :`);
  for (const batch of graph.execution_order) {
    const label = batch.phase_names.join(' + ');
    lines.push(`  Lot ${batch.batch_index + 1} : ${label}`);
  }

  return lines.join('\n');
}

/**
 * Integrate the project graph with the work type activation pipeline.
 *
 * Returns the work types to pass to activateRules():
 *   - strategy 'expected' : use ALL blueprint work types → activates every
 *     applicable rule for the project type, even for unquoted phases.
 *     Best for audit / compliance checking.
 *   - strategy 'detected' : use only the work types found in the quote text →
 *     activates rules for what is explicitly present.
 *     Best for quote validation.
 *
 * @param graph    - Project graph produced by buildProjectGraph()
 * @param strategy - 'expected' | 'detected' (default: 'expected')
 */
export function getActivationWorkTypes(
  graph: ProjectGraph,
  strategy: 'expected' | 'detected' = 'expected',
): WorkType[] {
  return strategy === 'expected' ? graph.expected_work_types : graph.detected_work_types;
}

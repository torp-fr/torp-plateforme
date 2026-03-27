/**
 * Project Structuring Engine — Core Types
 *
 * A ProjectType represents the nature of the construction project being quoted.
 * It is the top-level classifier that selects the applicable blueprint and
 * drives phase inference, trade detection, and rule activation.
 *
 * Hierarchy:
 *
 *   ProjectType         — what kind of project (PISCINE, MAISON_INDIVIDUELLE…)
 *     └── ProjectBlueprint — canonical phase sequence for this project type
 *           └── PhaseNode  — one construction phase (TERRASSEMENT, FONDATIONS…)
 *                 └── WorkType[] — work trades active during this phase
 *
 * Design:
 *   - ProjectType is inferred from free text (project description, devis title)
 *   - PhaseNode is narrower than ProjectType and broader than WorkType
 *   - A phase may span multiple work types (GROS_OEUVRE → STRUCTURE + MACONNERIE)
 *   - A work type may appear in multiple phases (ELECTRICITE in LOTS_TECHNIQUES
 *     and FINITIONS for testing)
 *   - Phase dependencies form a DAG; topological sort gives execution batches
 */

import type { WorkType } from '@/core/workTypes/workTypes';

// =============================================================================
// Project Type
// =============================================================================

export const PROJECT_TYPES = [
  'PISCINE',             // Bassin de natation (structure béton / coque)
  'MAISON_INDIVIDUELLE', // Construction neuve maison individuelle
  'RENOVATION',          // Rénovation intérieure d'un bien existant
  'EXTENSION',           // Extension / agrandissement d'un bâtiment existant
  'TERRASSE',            // Terrasse extérieure (bois, carrelage, béton)
  'AMENAGEMENT_COMBLE',  // Aménagement des combles perdus ou habitables
  'LOCAL_COMMERCIAL',    // Aménagement ou rénovation de local commercial
  'GROS_OEUVRE_NEUF',    // Gros-œuvre seul (dalle, murs, planchers)
  'VRD',                 // Voirie et Réseaux Divers (voirie, canalisations)
  'APPARTEMENT',         // Rénovation d'appartement (second œuvre uniquement)
] as const;

export type ProjectType = typeof PROJECT_TYPES[number];

// =============================================================================
// Phase Type
// =============================================================================

/**
 * Construction phases — more granular than WorkType, scoped to a project phase.
 *
 * A phase is a logical grouping of work types that form a coherent step in the
 * construction sequence. Phase IDs are stable across project types and can be
 * referenced in dependency definitions.
 */
export const PHASE_TYPES = [
  // ── Site preparation ──────────────────────────────────────────────────────
  'VRD',                    // Voirie, réseaux, accès chantier
  'TERRASSEMENT',           // Décapage, fouilles, évacuation terres
  'FONDATIONS',             // Semelles, longrines, micropieux
  'DRAINAGE',               // Drains périphériques, regard, puisard

  // ── Structural shell ─────────────────────────────────────────────────────
  'GROS_OEUVRE',            // Maçonnerie, béton armé, voiles, planchers
  'CHARPENTE_COUVERTURE',   // Charpente + toiture + zinguerie
  'HORS_EAU_HORS_AIR',     // Menuiseries extérieures posées

  // ── Waterproofing & envelope ──────────────────────────────────────────────
  'ETANCHEITE',             // Étanchéité toiture-terrasse / piscine
  'FACADE',                 // Ravalement, bardage, ITE
  'ISOLATION_THERMIQUE',    // Isolation complémentaire (ITI / ITE)

  // ── Technical lots ────────────────────────────────────────────────────────
  'PLOMBERIE',              // Canalisations, sanitaires, alimentation
  'ELECTRICITE',            // Tableau, câblage, prises, éclairage
  'CHAUFFAGE_VMC',          // Chauffage, VMC, climatisation
  'RESEAUX_HYDRAULIQUES',   // Filtration, pompes, hydraulique piscine

  // ── Interior dry works ────────────────────────────────────────────────────
  'CHAPE',                  // Chape, ragréage
  'CLOISONS_DOUBLAGE',      // Cloisons, doublages, plafonds
  'MENUISERIES_INT',        // Portes intérieures, placards

  // ── Finishes ──────────────────────────────────────────────────────────────
  'REVETEMENTS_SOL',        // Parquet, carrelage, sol souple
  'REVETEMENTS_MURS',       // Faïence, peinture murs
  'ENDUITS_PEINTURE',       // Enduit, peinture, finition
  'FINITIONS',              // Phase finale : menuiserie fine, quincaillerie, nettoyage

  // ── Demolition / diagnosis ────────────────────────────────────────────────
  'DIAGNOSTIC',             // Diagnostics amiante, plomb, structure
  'DEMOLITION',             // Démolition, dépose, curage

  // ── Exterior ──────────────────────────────────────────────────────────────
  'STRUCTURE_BOIS',         // Ossature bois terrasse / extension bois
  'REVETEMENT_TERRASSE',    // Lames bois, carrelage ext., composite
  'GARDE_CORPS',            // Garde-corps, balustrades, main courante
  'MARGELLES_PLAGE',        // Margelles et plage piscine

  // ── Jointure (extension) ──────────────────────────────────────────────────
  'JONCTION',               // Liaison thermique + structurale avec l'existant
] as const;

export type PhaseType = typeof PHASE_TYPES[number];

// =============================================================================
// Phase Node — single node in the project graph
// =============================================================================

export interface PhaseNode {
  /** Phase identifier — stable, used as dependency reference */
  id: PhaseType;
  /** Human-readable French label */
  name: string;
  /**
   * Phase IDs that must be fully complete before this phase can start.
   * Empty array = no hard dependencies (can start at project launch).
   */
  depends_on: PhaseType[];
  /**
   * Phase IDs that can run concurrently with this phase once their
   * own depends_on is satisfied. Informational — used for scheduling.
   */
  parallel_with: PhaseType[];
  /** Work types that are active during this phase */
  work_types: WorkType[];
  /**
   * If true, the absence of this phase in a quote is flagged as a
   * structural gap — a missing mandatory phase raises a critical alert.
   */
  mandatory: boolean;
  /**
   * Rough typical duration in working days.
   * Used for scheduling display only — not for compliance checking.
   */
  typical_duration_days: number;
}

// =============================================================================
// Project Blueprint — canonical phase sequence for a project type
// =============================================================================

export interface ProjectBlueprint {
  project_type: ProjectType;
  /** One-line French description of the project type */
  description: string;
  /**
   * Ordered list of phases (topological order — used as default display order).
   * The buildProjectGraph function re-derives the true execution order from
   * depends_on, so the array order here is for readability only.
   */
  phases: PhaseNode[];
  /** Keywords used to detect this project type from free text (lowercase, no diacritics) */
  detection_keywords: string[];
  /** Phrases (weight 2) used to detect this project type from free text */
  detection_phrases: string[];
}

// =============================================================================
// Project Graph — output of buildProjectGraph()
// =============================================================================

/** Status of a phase relative to the detected quote content */
export type PhaseStatus =
  | 'detected'   // At least one work type for this phase was found in the quote text
  | 'expected'   // Phase is in blueprint and some coverage found, but incomplete
  | 'missing'    // Mandatory phase with zero work type coverage in the quote
  | 'optional';  // Non-mandatory phase with zero coverage — not a problem

export interface ProjectPhaseResult {
  phase_id:          PhaseType;
  phase_name:        string;
  status:            PhaseStatus;
  work_types:        WorkType[];
  /** Subset of work_types that were actually detected in the quote text */
  detected_work_types: WorkType[];
  /** Fraction of phase work types detected in the quote [0, 1] */
  coverage:          number;
  depends_on:        PhaseType[];
  parallel_with:     PhaseType[];
  mandatory:         boolean;
}

/**
 * A batch in the execution order.
 * All phases in a batch can run concurrently (all their depends_on are in
 * prior batches). Batches are ordered chronologically.
 */
export interface ExecutionBatch {
  batch_index:  number;
  phase_ids:    PhaseType[];
  phase_names:  string[];
}

/** Project-level summary statistics */
export interface ProjectGraphSummary {
  total_phases:             number;
  detected_phases:          number;
  missing_mandatory_phases: number;
  /** Fraction of mandatory phases that have some coverage [0, 1] */
  mandatory_coverage:       number;
  /** Fraction of expected work types detected in the quote [0, 1] */
  work_type_coverage:       number;
  /** True when all mandatory phases have at least one detected work type */
  structurally_complete:    boolean;
}

/**
 * Full output of buildProjectGraph().
 * Consumed by the Rule Engine, Audit Engine, and frontend graph display.
 */
export interface ProjectGraph {
  /** Input text that was analysed */
  source_text:              string;
  /** Detected project type */
  project_type:             ProjectType;
  /** Confidence in the project type detection [0, 1] */
  project_type_confidence:  number;
  /** All phases from the blueprint, annotated with detection status */
  phases:                   ProjectPhaseResult[];
  /** Mandatory phases with zero work type coverage */
  missing_phases:           ProjectPhaseResult[];
  /** Work types found in the quote text (from detectWorkTypes) */
  detected_work_types:      WorkType[];
  /**
   * All work types expected for this project type (union of all phase work_types).
   * Used by activateRules() to fetch the full applicable rule set.
   */
  expected_work_types:      WorkType[];
  /**
   * Chronological execution batches from topological sort.
   * Each batch contains phases that can run in parallel.
   */
  execution_order:          ExecutionBatch[];
  summary:                  ProjectGraphSummary;
}

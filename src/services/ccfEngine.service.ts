/**
 * CCF Engine Service — Cahier des Charges Fonctionnel
 *
 * Parses a free-text user intent into a structured ProjectContext that feeds
 * the Context Engine (contextEngine.service.ts).
 *
 * This service is:
 *   - Pure (no DB, no AI calls, no side effects)
 *   - Deterministic (same input → same output)
 *   - French-language optimised (accented forms, verb conjugations)
 *
 * Pipeline:
 *   CCFInput (intent string) → normalise → detect → CCFResult
 *
 * CCFResult maps directly to ProjectContext:
 *   project_type  → ProjectContext.project_type
 *   building_type → ProjectContext.building_type
 *   constraints   → ProjectContext.constraints
 *   location      → ProjectContext.location (passed through from CCFInput)
 */

import {
  BUILDING_TYPE_PATTERNS,
  LOCATION_PATTERNS,
  ABF_RE,
  ZONE_SISMIQUE_RE,
  ZONE_CLIMATIQUE_RE,
} from '@/core/nlp/patterns';

// =============================================================================
// Types
// =============================================================================

export interface CCFInput {
  /** Free-text user intent in French, e.g. "Je veux rénover la toiture de ma maison" */
  intent: string;
  /** Optional explicit location; passed through to CCFResult unchanged */
  location?: string;
}

export interface CCFResult {
  project_type: 'neuf' | 'renovation';
  /** Detected occupancy type */
  building_type?: string;
  /** Primary work category (plomberie, toiture, structure…) */
  inferred_work_type?: string;
  /** Regulatory or safety constraints inferred from work type */
  constraints?: string[];
  /** Passed through from CCFInput.location */
  location?: string;
  /**
   * Confidence in the project_type classification: 0–1.
   * Low confidence means both neuf and renovation signals were found or neither.
   */
  classification_confidence: number;
  /**
   * Human-readable parse trace for debugging.
   * Lists every signal that contributed to the result.
   */
  parse_trace: string[];
}

// =============================================================================
// Normalisation
// =============================================================================

/**
 * Lower-case, remove diacritics, collapse punctuation.
 * Keeps spaces — word-boundary matching relies on them.
 */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacriticals
    .replace(/['''`]/g, ' ')          // smart quotes → space
    .replace(/[-–—]/g, ' ')           // dashes → space
    .replace(/[^a-z0-9\s]/g, ' ')     // drop everything else
    .replace(/\s+/g, ' ')
    .trim();
}

// =============================================================================
// Step 1 — project_type classification
// =============================================================================

interface ClassificationResult {
  project_type: 'neuf' | 'renovation';
  confidence: number;
  signals: string[];
}

/**
 * Verb / keyword patterns that strongly indicate new construction.
 * Ordered from most specific to most general.
 */
const NEUF_PATTERNS: ReadonlyArray<{ re: RegExp; label: string }> = [
  { re: /\b(construction\s+neuve?|batiment\s+neuf|ouvrage\s+neuf)\b/,      label: 'construction neuve' },
  { re: /\bconstruire\b/,                                                   label: 'construire' },
  { re: /\bcreation\s+d[eu]\b/,                                             label: 'création de' },
  { re: /\bcreer\b/,                                                        label: 'créer' },
  { re: /\binstaller\b/,                                                    label: 'installer' },
  { re: /\binstallation\s+(d[eu]|neuve?|complete)\b/,                       label: 'installation neuve' },
  { re: /\bajouter\b/,                                                      label: 'ajouter' },
  { re: /\bpose\s+(d[eu]|neuve?)\b/,                                        label: 'pose neuve' },
  { re: /\bposer\b/,                                                        label: 'poser' },
  { re: /\boutillage\s+neuf\b/,                                             label: 'outillage neuf' },
  { re: /\bneufs?\b/,                                                       label: 'neuf (adj)' },
];

/**
 * Patterns that strongly indicate renovation of existing work.
 */
const RENOVATION_PATTERNS: ReadonlyArray<{ re: RegExp; label: string }> = [
  { re: /\br[ée]novation\b/,                                                label: 'rénovation' },
  { re: /\br[ée]nover\b/,                                                   label: 'rénover' },
  { re: /\br[ée]fection\b/,                                                 label: 'réfection' },
  { re: /\brefaire\b/,                                                      label: 'refaire' },
  { re: /\bremplacer\b/,                                                    label: 'remplacer' },
  { re: /\bremplacement\b/,                                                 label: 'remplacement' },
  { re: /\br[ée]habilitation\b/,                                            label: 'réhabilitation' },
  { re: /\br[ée]habiliter\b/,                                               label: 'réhabiliter' },
  { re: /\br[ée]paration\b/,                                                label: 'réparation' },
  { re: /\br[ée]parer\b/,                                                   label: 'réparer' },
  { re: /\bremise\s+en\s+[ée]tat\b/,                                       label: 'remise en état' },
  { re: /\bmise\s+en\s+conformit[ée]\b/,                                   label: 'mise en conformité' },
  { re: /\bexistant\b/,                                                     label: 'existant' },
  { re: /\bvieilli|v[ée]tuste\b/,                                           label: 'vétuste' },
];

function classifyProjectType(norm: string): ClassificationResult {
  const neufSignals: string[] = [];
  const renovSignals: string[] = [];

  for (const { re, label } of NEUF_PATTERNS) {
    if (re.test(norm)) neufSignals.push(label);
  }
  for (const { re, label } of RENOVATION_PATTERNS) {
    if (re.test(norm)) renovSignals.push(label);
  }

  const neufScore  = neufSignals.length;
  const renovScore = renovSignals.length;
  const total      = neufScore + renovScore;

  // Default to renovation when ambiguous (safer — stricter checking)
  if (total === 0) {
    return { project_type: 'renovation', confidence: 0.4, signals: ['no signal — default'] };
  }

  if (neufScore > renovScore) {
    const confidence = Math.min(0.6 + (neufScore - renovScore) * 0.1, 1.0);
    return { project_type: 'neuf', confidence, signals: neufSignals };
  }

  if (renovScore > neufScore) {
    const confidence = Math.min(0.6 + (renovScore - neufScore) * 0.1, 1.0);
    return { project_type: 'renovation', confidence, signals: renovSignals };
  }

  // Equal signals — ambiguous, lean renovation
  return {
    project_type: 'renovation',
    confidence:   0.45,
    signals:      [...neufSignals, ...renovSignals, '(tie — default renovation)'],
  };
}

// =============================================================================
// Step 2 — work type detection
// =============================================================================

interface WorkTypeEntry {
  label: string;
  patterns: ReadonlyArray<RegExp>;
}

const WORK_TYPES: ReadonlyArray<WorkTypeEntry> = [
  {
    label:    'piscine',
    patterns: [/\bpiscine\b/, /\bbassin\s+(de\s+)?nage\b/, /\bnage\s+libre\b/],
  },
  {
    label:    'toiture',
    patterns: [/\btoiture\b/, /\btoit\b/, /\bcouverture\b/, /\btuile\b/, /\bardoise\b/, /\bzinc\b/, /\bcharpente\b/],
  },
  {
    label:    'plomberie',
    patterns: [/\bplomberie\b/, /\bcanalisation\b/, /\btuyau\b/, /\brobinet\b/, /\bsanitaire\b/, /\bchauffe.eau\b/, /\bchauffage\b/, /\bradiateu[rx]\b/],
  },
  {
    label:    'electricite',
    patterns: [/\b[ée]lectricit[ée]\b/, /\b[ée]lectrique\b/, /\btableau\s+[ée]lectrique\b/, /\bprises?\b/, /\bcâblage\b/, /\billumination\b/, /\b[ée]clairage\b/],
  },
  {
    label:    'structure',
    patterns: [/\bstructure\b/, /\bossature\b/, /\bfondation\b/, /\bpoteau\b/, /\bpoutre\b/, /\bdall[ée]\b/, /\bmur\s+porteur\b/, /\bsous.sol\b/, /\bvide\s+sanitaire\b/],
  },
  {
    label:    'isolation',
    patterns: [/\bisolation\b/, /\bisoler\b/, /\bisolant\b/, /\bcombles?\b/, /\blaine\s+(de\s+verre|min[ée]rale)\b/],
  },
  {
    label:    'menuiserie',
    patterns: [/\bmenuiserie\b/, /\bfen[êe]tre\b/, /\bporte\b/, /\bvitrage\b/, /\bvolet\b/, /\bvélux\b/],
  },
  {
    label:    'revetement',
    patterns: [/\br[êe]vetement\b/, /\bcarrelage\b/, /\bparquet\b/, /\bpeinture\b/, /\bend[ûu]it\b/, /\bcr[êe]pi\b/],
  },
  {
    label:    'assainissement',
    patterns: [/\bassainissement\b/, /\bfosse\s+septique\b/, /\btout.à.l[''`]?[ée]gout\b/, /\b[ée]vacuation\b/],
  },
];

function detectWorkType(norm: string): string | undefined {
  for (const { label, patterns } of WORK_TYPES) {
    if (patterns.some((re) => re.test(norm))) return label;
  }
  return undefined;
}

// =============================================================================
// Step 3 — building type detection (delegates to shared NLP patterns)
// =============================================================================

function detectBuildingType(norm: string): string | undefined {
  // Uses canonical BUILDING_TYPE_PATTERNS from @/core/nlp/patterns
  for (const { re, label } of BUILDING_TYPE_PATTERNS) {
    if (re.test(norm)) return label;
  }
  return undefined;
}

// =============================================================================
// Step 4 — constraint inference
// =============================================================================

interface ConstraintRule {
  /** Work type that triggers this constraint */
  work_type: string;
  /** Constraint label added to the result */
  constraint: string;
  /** Why this constraint is relevant (for trace output) */
  reason: string;
}

const CONSTRAINT_RULES: ReadonlyArray<ConstraintRule> = [
  { work_type: 'piscine',        constraint: 'urbanisme',          reason: 'piscine > 10m² requiert permis d\'aménager' },
  { work_type: 'piscine',        constraint: 'sécurité baignade',  reason: 'norme NF P90-306 sécurité piscine privative' },
  { work_type: 'toiture',        constraint: 'sécurité en hauteur',reason: 'intervention en toiture → EPI et plans de prévention' },
  { work_type: 'toiture',        constraint: 'DTU 40',             reason: 'travaux de couverture soumis DTU série 40' },
  { work_type: 'structure',      constraint: 'eurocode',           reason: 'calculs de structure → Eurocodes 0/1/2/7/8' },
  { work_type: 'structure',      constraint: 'permis de construire',reason: 'modification structurelle > 20m² nécessite permis' },
  { work_type: 'electricite',    constraint: 'NF C 15-100',        reason: 'installation électrique → norme NF C 15-100' },
  { work_type: 'electricite',    constraint: 'consuel',            reason: 'attestation Consuel obligatoire avant raccordement' },
  { work_type: 'plomberie',      constraint: 'DTU 60',             reason: 'plomberie sanitaire → DTU 60.1 / 60.11' },
  { work_type: 'assainissement', constraint: 'assainissement non collectif', reason: 'ANC → contrôle SPANC obligatoire' },
  { work_type: 'isolation',      constraint: 'RE 2020',            reason: 'travaux isolation → conformité RE 2020 ou BBC Rénovation' },
];

function inferConstraints(workType: string | undefined): Array<{ constraint: string; reason: string }> {
  if (!workType) return [];
  return CONSTRAINT_RULES.filter((r) => r.work_type === workType);
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Parse a free-text French intent into a structured CCFResult.
 *
 * @param input - User intent + optional explicit location
 * @returns Structured project context ready for contextEngine.applyContextToRules()
 *
 * @example
 * parseCCF({ intent: "Je veux installer une piscine dans mon jardin" })
 * // → { project_type: "neuf", inferred_work_type: "piscine",
 * //     constraints: ["urbanisme", "sécurité baignade"], … }
 *
 * @example
 * parseCCF({ intent: "Rénover la toiture de mon appartement", location: "littoral" })
 * // → { project_type: "renovation", building_type: "appartement",
 * //     inferred_work_type: "toiture",
 * //     constraints: ["sécurité en hauteur", "DTU 40"],
 * //     location: "littoral" }
 *
 * @example
 * parseCCF({ intent: "Construire une extension de maison avec dalle béton" })
 * // → { project_type: "neuf", building_type: "maison",
 * //     inferred_work_type: "structure",
 * //     constraints: ["eurocode", "permis de construire"] }
 */
export function parseCCF(input: CCFInput): CCFResult {
  const norm = normalise(input.intent);
  const trace: string[] = [`normalised: "${norm}"`];

  // 1. project_type
  const { project_type, confidence, signals } = classifyProjectType(norm);
  trace.push(`project_type="${project_type}" (confidence=${confidence.toFixed(2)}) via [${signals.join(', ')}]`);

  // 2. work type
  const inferred_work_type = detectWorkType(norm);
  if (inferred_work_type) {
    trace.push(`work_type="${inferred_work_type}"`);
  } else {
    trace.push('work_type=undefined (no pattern matched)');
  }

  // 3. building type
  const building_type = detectBuildingType(norm);
  if (building_type) {
    trace.push(`building_type="${building_type}"`);
  } else {
    trace.push('building_type=undefined (no pattern matched)');
  }

  // 4. constraints
  const inferredConstraints = inferConstraints(inferred_work_type);
  const constraints = inferredConstraints.length > 0
    ? inferredConstraints.map((c) => c.constraint)
    : undefined;

  for (const { constraint, reason } of inferredConstraints) {
    trace.push(`constraint="${constraint}" ← ${reason}`);
  }

  return {
    project_type,
    building_type,
    inferred_work_type,
    constraints,
    location: input.location,
    classification_confidence: confidence,
    parse_trace: trace,
  };
}

/**
 * Convert a CCFResult directly into a ProjectContext for the Context Engine.
 *
 * Drops the CCF-specific fields (classification_confidence, parse_trace,
 * inferred_work_type) and returns only what contextEngine needs.
 */
export function ccfToProjectContext(result: CCFResult) {
  return {
    project_type:  result.project_type,
    building_type: result.building_type,
    location:      result.location,
    constraints:   result.constraints,
  };
}

// =============================================================================
// ProjectDefinition — extended project model
// =============================================================================

export interface RegulatoryContext {
  /**
   * Plan Local d'Urbanisme applies.
   * True when a "permis de construire" or "urbanisme" constraint is present.
   */
  plu?: boolean;
  /**
   * Architectes des Bâtiments de France review required.
   * True when intent references a protected site or historical monument.
   */
  abf?: boolean;
  /**
   * Seismic zone code (e.g. "2", "3", "4").
   * Extracted from the location string when present.
   */
  zone_sismique?: string;
  /**
   * Thermal/climatic zone code (e.g. "H1a", "H2b", "H3").
   * Extracted from the location string when present.
   */
  zone_climatique?: string;
}

export interface DocumentSet {
  /**
   * Cahier des Clauses Techniques Particulières.
   * Required for structural work, new builds, and complex projects.
   */
  cctp?: boolean;
  /**
   * Cahier des Clauses Administratives Particulières.
   * Required on large or ERP/IGH projects where contract formalism matters.
   */
  ccap?: boolean;
  /**
   * Dossier des Ouvrages Exécutés (as-built documentation).
   * Required on renovations and all complex projects.
   */
  doe?: boolean;
}

export type ComplexityLevel = 'simple' | 'intermediate' | 'complex';

/**
 * Detailed breakdown of the complexity score for auditability.
 *
 * Each factor contributes independently — the total determines the level.
 * Exposing the breakdown lets downstream services explain their decisions.
 */
export interface ComplexityScore {
  /** Raw point total */
  total: number;
  /** Derived tier */
  level: ComplexityLevel;
  /** Per-dimension contribution */
  breakdown: {
    work_type:    number;
    building_type: number;
    regulatory:   number;
    constraints:  number;
  };
}

/**
 * Data returned by the GEORISQUES API.
 * See: https://georisques.gouv.fr/api/v1
 * Populated downstream — never set by this service.
 */
export interface GeorisquesData {
  /** Seismic hazard zone (0–5) at the parcel location */
  zone_sismique?: string;
  /** Flood risk zone label (e.g. "Zone inondable", "TRI") */
  zone_inondable?: string;
  /** Clay shrink-swell risk level (faible / moyen / fort / très fort) */
  retrait_gonflement?: 'faible' | 'moyen' | 'fort' | 'très fort';
  /** Radon potential (1 = low, 2 = moderate, 3 = high) */
  radon?: 1 | 2 | 3;
  /** Whether underground cavities are mapped nearby */
  cavites?: boolean;
  /** Whether the parcel is in a natural risk prevention plan perimeter */
  ppr?: boolean;
}

/**
 * Data returned by the French Cadastre / Géoportail API.
 * Populated downstream — never set by this service.
 */
export interface CadastreData {
  /** National parcel identifier (e.g. "75056000AA0012") */
  parcel_id?: string;
  /** Parcel surface in m² */
  surface_m2?: number;
  /** INSEE commune code */
  commune_code?: string;
  /** Commune name */
  commune?: string;
  /** Cadastral section */
  section?: string;
  /** Parcel number within section */
  numero?: string;
}

/**
 * Data returned by the Géoportail Urbanisme (GPU) API.
 * Populated downstream — never set by this service.
 */
export interface UrbanismeData {
  /** PLU zone code at the parcel (e.g. "UA", "UB", "N", "A", "AU") */
  zone_plu?: string;
  /** Human-readable zone label */
  zone_label?: string;
  /** Maximum building height in metres (from règlement de zone) */
  hauteur_max_m?: number;
  /** Minimum setback from public road in metres */
  recul_min_m?: number;
  /** Emprise au sol coefficient (0–1) */
  emprise_sol?: number;
  /** Active servitudes on the parcel */
  servitudes?: string[];
}

/**
 * External data slots — populated downstream by enrichment workers.
 * This service never fills these fields — it only reserves the shape.
 */
export interface ExternalContext {
  /** Data from the GEORISQUES national risk database */
  georisques?: GeorisquesData;
  /** Data from the French Cadastre / Géoportail */
  cadastre?: CadastreData;
  /** Data from the Géoportail Urbanisme (PLU, servitudes) */
  urbanisme?: UrbanismeData;
}

export interface ProjectDefinition {
  /** Original user intent, preserved verbatim */
  intent: string;

  // ── Core classification (from CCFResult) ─────────────────────────────────
  project_type:   'neuf' | 'renovation';
  work_type?:     string;
  building_type?: string;
  location?:      string;

  // ── Enrichments ───────────────────────────────────────────────────────────
  /** Regulatory framework applicable to this project */
  regulatory_context?: RegulatoryContext;

  /** Inferred regulatory and safety constraints */
  constraints: string[];

  /** Documents typically required for this project type */
  documents?: DocumentSet;

  /** Estimated project complexity tier */
  complexity_level: ComplexityLevel;

  /**
   * Full complexity score with per-factor breakdown.
   * Lets consumers understand WHY a project is complex.
   */
  complexity_score: ComplexityScore;

  /**
   * External data slots — populated downstream by enrichment workers.
   * Never set by this service.
   */
  external_context?: ExternalContext;

  // ── Provenance ────────────────────────────────────────────────────────────
  /** Classification confidence 0–1 from parseCCF */
  classification_confidence: number;
  /** Full parse trace for debugging */
  parse_trace: string[];
}

// =============================================================================
// Complexity — score-based engine
// =============================================================================

/**
 * Work type point contributions.
 *
 * Points reflect regulatory burden and specialist oversight required —
 * NOT inherent difficulty. A toiture on a house (1 pt) is simple;
 * the same toiture on an IGH adds 4 pts from building type → complex.
 *
 * 0  — surface finishes, no regulatory weight
 * 1  — enclosed-system trades, DTU-governed, standard practice
 * 2  — environmental or groundwater risk
 * 3  — structural calculations or safety engineering required
 */
const WORK_TYPE_SCORES: Readonly<Record<string, number>> = {
  structure:      3,
  piscine:        3,
  assainissement: 2,
  toiture:        1,
  plomberie:      1,
  electricite:    1,
  isolation:      1,
  menuiserie:     0,
  revetement:     0,
};

/**
 * Building type point contributions.
 *
 * 0  — private residential: limited regulatory overlay
 * 1  — industrial / commercial: additional fire / environmental rules
 * 2  — collective housing: shared systems, co-ownership legal layer
 * 3  — ERP: public safety regulations, accessibility, fire safety
 * 4  — IGH: full fire-safety regime, structural controls
 */
const BUILDING_TYPE_SCORES: Readonly<Record<string, number>> = {
  'IGH':               4,
  'ERP':               3,
  'immeuble collectif': 2,
  'industriel':        1,
  'tertiaire':         1,
  'maison individuelle': 0,
  'maison':            0,
  'appartement':       0,
};

/**
 * Thresholds for complexity tier classification.
 *
 * Score 0–2 → simple       (no specialist oversight required)
 * Score 3–5 → intermediate (DTU compliance, some specialist involvement)
 * Score 6+  → complex      (full engineering / regulatory stack)
 *
 * Thresholds are intentionally low so context modifiers (ABF, seismic zone)
 * can push a nominally-intermediate project to complex.
 */
const COMPLEXITY_THRESHOLDS: Readonly<{ complex: number; intermediate: number }> = {
  complex:      6,
  intermediate: 3,
};

function levelFromScore(score: number): ComplexityLevel {
  if (score >= COMPLEXITY_THRESHOLDS.complex)      return 'complex';
  if (score >= COMPLEXITY_THRESHOLDS.intermediate) return 'intermediate';
  return 'simple';
}

/**
 * Score-based complexity assessment.
 *
 * Factors:
 *   work_type     — base technical weight (0–3)
 *   building_type — occupancy risk multiplier (0–4)
 *   regulatory    — ABF overlay (+2), seismic zone (+1 or +2), PLU (+1)
 *   constraints   — proxy for total regulatory burden (≥3 adds 1, ≥5 adds 2)
 *
 * Each factor is independent — complexity emerges from their combination,
 * not from rigid bucket membership.
 *
 * Examples:
 *   toiture + maison               → 1+0+0+0 = 1   → simple
 *   toiture + ERP                  → 1+3+0+0 = 4   → intermediate
 *   toiture + ERP + ABF            → 1+3+2+0 = 6   → complex
 *   structure + IGH + sismique 3   → 3+4+2+0 = 9   → complex
 *   piscine + appartement + PLU    → 3+0+1+1 = 5   → intermediate
 *   isolation + maison             → 1+0+0+1 = 2   → simple
 *   isolation + maison + RE 2020   → 1+0+0+1 = 2   → simple   (correct: routine insulation)
 */
export function computeComplexity(
  workType:    string | undefined,
  buildingType: string | undefined,
  constraints: string[],
  regulatory:  RegulatoryContext | undefined,
): ComplexityScore {
  // ── work_type ─────────────────────────────────────────────────────────────
  const wtScore = workType !== undefined
    ? (WORK_TYPE_SCORES[workType] ?? 0)
    : 0;

  // ── building_type ─────────────────────────────────────────────────────────
  const btScore = buildingType !== undefined
    ? (BUILDING_TYPE_SCORES[buildingType] ?? 0)
    : 0;

  // ── regulatory overlay ────────────────────────────────────────────────────
  let regScore = 0;
  if (regulatory) {
    // ABF: full heritage review process (+2)
    if (regulatory.abf) regScore += 2;
    // PLU: urbanisme filing required (+1)
    if (regulatory.plu) regScore += 1;
    // Seismic zone: determines structural calculation regime
    if (regulatory.zone_sismique) {
      const zoneNum = parseInt(regulatory.zone_sismique, 10);
      if (zoneNum >= 3) regScore += 2; // high seismicity — Eurocode 8 full calc
      else if (zoneNum >= 1) regScore += 1; // low/medium — simplified rules
    }
    // Thermal zone: adds energy-performance compliance burden
    // Kept at 0 pts — zone alone doesn't change specialist requirements
  }

  // ── constraints count (proxy for regulatory surface area) ─────────────────
  let cScore = 0;
  if (constraints.length >= 5) cScore = 2;
  else if (constraints.length >= 3) cScore = 1;

  const total = wtScore + btScore + regScore + cScore;

  return {
    total,
    level: levelFromScore(total),
    breakdown: {
      work_type:    wtScore,
      building_type: btScore,
      regulatory:   regScore,
      constraints:  cScore,
    },
  };
}

// =============================================================================
// Document detection
// =============================================================================

/**
 * Determine which contractual documents are expected for the project.
 *
 * CCTP — always produced for new structural work or complex projects
 * CCAP — produced when formal contract management is warranted (ERP, IGH, complex)
 * DOE  — produced for all renovations and all complex projects (as-built record)
 */
function deriveDocuments(
  projectType: 'neuf' | 'renovation',
  workType: string | undefined,
  buildingType: string | undefined,
  complexity: ComplexityLevel,
): DocumentSet | undefined {
  const isComplex   = complexity === 'complex';
  const isERP_IGH   = buildingType === 'ERP' || buildingType === 'IGH';
  const isStructural = workType === 'structure';

  const cctp = (projectType === 'neuf' && isStructural) || isComplex || isERP_IGH;
  const ccap = isComplex || isERP_IGH;
  const doe  = projectType === 'renovation' || isComplex;

  // Return undefined when no documents are flagged (simple interior work)
  if (!cctp && !ccap && !doe) return undefined;

  const docs: DocumentSet = {};
  if (cctp) docs.cctp = true;
  if (ccap) docs.ccap = true;
  if (doe)  docs.doe  = true;
  return docs;
}

// =============================================================================
// Regulatory context detection (regex imported from @/core/nlp/patterns)
// =============================================================================

function deriveRegulatoryContext(
  location: string | undefined,
  constraints: string[],
  normalisedIntent: string,
): RegulatoryContext | undefined {
  const ctx: RegulatoryContext = {};

  // PLU: permis de construire or urbanisme constraint present
  if (constraints.includes('urbanisme') || constraints.includes('permis de construire')) {
    ctx.plu = true;
  }

  // ABF: sensitive site keywords in the intent
  if (ABF_RE.test(normalisedIntent)) {
    ctx.abf = true;
  }

  if (location) {
    const normLoc = location.toLowerCase();

    const sisMatch = normLoc.match(ZONE_SISMIQUE_RE);
    if (sisMatch) ctx.zone_sismique = sisMatch[1].toLowerCase();

    const climMatch = normLoc.match(ZONE_CLIMATIQUE_RE);
    if (climMatch) ctx.zone_climatique = climMatch[1].toUpperCase();
  }

  return Object.keys(ctx).length > 0 ? ctx : undefined;
}

// =============================================================================
// Public API — buildProjectDefinition
// =============================================================================

/**
 * Build a full ProjectDefinition from a user intent.
 *
 * Internally calls parseCCF() then layers on:
 *   - complexity_level  derived from work_type + building_type
 *   - documents         inferred from project type, work, occupancy, complexity
 *   - regulatory_context  from location string + constraint signals + intent
 *   - external_data     undefined placeholder (populated downstream)
 *
 * All existing parseCCF exports are untouched.
 *
 * @example
 * buildProjectDefinition({ intent: "Construire une piscine pour mon ERP" })
 * // {
 * //   project_type: "neuf", work_type: "piscine", building_type: "ERP",
 * //   complexity_level: "complex",
 * //   constraints: ["urbanisme", "sécurité baignade"],
 * //   regulatory_context: { plu: true },
 * //   documents: { cctp: true, ccap: true, doe: false },
 * // }
 *
 * @example
 * buildProjectDefinition({
 *   intent: "Rénover la toiture d'une maison classée monument historique",
 *   location: "zone sismique 2"
 * })
 * // {
 * //   project_type: "renovation", work_type: "toiture", building_type: "maison",
 * //   complexity_level: "intermediate",
 * //   constraints: ["sécurité en hauteur", "DTU 40"],
 * //   regulatory_context: { abf: true, zone_sismique: "2" },
 * //   documents: { doe: true },
 * //   location: "zone sismique 2"
 * // }
 *
 * @example
 * buildProjectDefinition({ intent: "Poser du parquet dans mon appartement" })
 * // {
 * //   project_type: "neuf", work_type: "revetement", building_type: "appartement",
 * //   complexity_level: "simple",
 * //   constraints: [],
 * //   regulatory_context: undefined,
 * //   documents: undefined,
 * // }
 */
export function buildProjectDefinition(input: CCFInput): ProjectDefinition {
  // ── Step 1: reuse existing CCF parsing ────────────────────────────────────
  const ccf  = parseCCF(input);
  const norm = input.intent
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');

  const constraints = ccf.constraints ?? [];

  // ── Step 2: regulatory context (needed as input to complexity) ────────────
  const regulatory_context = deriveRegulatoryContext(input.location, constraints, norm);

  // ── Step 3: complexity — score-based, uses all four factors ───────────────
  const complexity_score = computeComplexity(
    ccf.inferred_work_type,
    ccf.building_type,
    constraints,
    regulatory_context,
  );
  const complexity_level = complexity_score.level;

  // ── Step 4: documents ─────────────────────────────────────────────────────
  const documents = deriveDocuments(
    ccf.project_type,
    ccf.inferred_work_type,
    ccf.building_type,
    complexity_level,
  );

  // ── Step 5: extend parse trace ────────────────────────────────────────────
  const trace = [...ccf.parse_trace];
  trace.push(
    `complexity="${complexity_level}" ` +
    `(score=${complexity_score.total}: ` +
    `work=${complexity_score.breakdown.work_type} ` +
    `building=${complexity_score.breakdown.building_type} ` +
    `regulatory=${complexity_score.breakdown.regulatory} ` +
    `constraints=${complexity_score.breakdown.constraints})`,
  );
  if (documents) {
    const docFlags = Object.entries(documents)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(', ');
    trace.push(`documents=[${docFlags}]`);
  } else {
    trace.push('documents=none');
  }
  if (regulatory_context) {
    trace.push(`regulatory_context=${JSON.stringify(regulatory_context)}`);
  }

  return {
    intent:          input.intent,
    project_type:    ccf.project_type,
    work_type:       ccf.inferred_work_type,
    building_type:   ccf.building_type,
    location:        input.location,
    regulatory_context,
    constraints,
    documents,
    complexity_level,
    complexity_score,
    external_context: undefined,
    classification_confidence: ccf.classification_confidence,
    parse_trace:     trace,
  };
}

/**
 * Convert a ProjectDefinition directly into a ProjectContext for the Context Engine.
 * Merges regulatory constraints with inferred constraints.
 */
export function projectDefinitionToContext(def: ProjectDefinition) {
  const regulatoryConstraints: string[] = [];
  if (def.regulatory_context?.plu)            regulatoryConstraints.push('PLU');
  if (def.regulatory_context?.abf)            regulatoryConstraints.push('ABF');
  if (def.regulatory_context?.zone_sismique)  regulatoryConstraints.push(`zone sismique ${def.regulatory_context.zone_sismique}`);
  if (def.regulatory_context?.zone_climatique) regulatoryConstraints.push(`zone climatique ${def.regulatory_context.zone_climatique}`);

  const allConstraints = [...def.constraints, ...regulatoryConstraints];

  return {
    project_type:  def.project_type,
    building_type: def.building_type,
    location:      def.location,
    constraints:   allConstraints.length > 0 ? allConstraints : undefined,
  };
}

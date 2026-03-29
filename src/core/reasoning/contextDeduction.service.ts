/**
 * Context Deduction Engine
 * Déduit les domaines de règles implicites à partir du type de projet.
 *
 * Exemple:
 *   deduceImpliedDomains("piscine")
 *   → ['structure', 'hydraulique', 'électrique', 'sécurité', 'thermique']
 *
 * Les domaines retournés correspondent EXACTEMENT aux valeurs de la colonne
 * `domain` de la table `rules` en base de données.
 */

/** Domaines valides dans la table `rules` (exhaustif). */
export const VALID_DB_DOMAINS = [
  'structure',
  'sécurité',
  'thermique',
  'hydraulique',
  'sismique',
  'incendie',
  'accessibilité',
  'acoustique',
  'électrique',
] as const;

export type RuleDomain = (typeof VALID_DB_DOMAINS)[number];

export interface ProjectTypeTaxonomyEntry {
  domains: RuleDomain[];
  confidence: 'high' | 'medium' | 'low';
  description: string;
}

/**
 * Taxonomie des types de projets et leurs domaines de règles implicites.
 * Clés: snake_case, minuscules, sans accents (normalisées par deduceImpliedDomains).
 */
export const PROJECT_TYPE_TAXONOMY: Record<string, ProjectTypeTaxonomyEntry> = {
  // ── Logement neuf ────────────────────────────────────────────────────────
  maison_neuve: {
    domains: ['structure', 'thermique', 'électrique', 'hydraulique', 'sécurité', 'acoustique', 'accessibilité'],
    confidence: 'high',
    description: 'Nouvelle construction résidentielle complète',
  },
  construction_neuve: {
    domains: ['structure', 'thermique', 'électrique', 'hydraulique', 'sécurité', 'acoustique', 'accessibilité'],
    confidence: 'high',
    description: 'Construction neuve générique',
  },

  // ── Rénovation / amélioration ─────────────────────────────────────────────
  renovation: {
    domains: ['structure', 'thermique', 'électrique', 'hydraulique', 'sécurité'],
    confidence: 'high',
    description: 'Rénovation d\'un bâtiment existant',
  },
  renovation_complete: {
    domains: ['structure', 'thermique', 'électrique', 'hydraulique', 'sécurité', 'acoustique', 'accessibilité'],
    confidence: 'high',
    description: 'Rénovation complète (tous corps d\'état)',
  },
  extension: {
    domains: ['structure', 'thermique', 'électrique', 'hydraulique', 'sécurité'],
    confidence: 'medium',
    description: 'Agrandissement d\'un bâtiment existant',
  },
  surélévation: {
    domains: ['structure', 'sismique', 'thermique', 'électrique', 'hydraulique', 'sécurité'],
    confidence: 'medium',
    description: 'Surélévation — charge supplémentaire sur structure existante',
  },

  // ── Spécialisé eau / piscine ──────────────────────────────────────────────
  piscine: {
    domains: ['structure', 'hydraulique', 'électrique', 'sécurité', 'thermique'],
    confidence: 'high',
    description: 'Construction de piscine (structure + systèmes eau/électrique)',
  },
  piscine_enterree: {
    domains: ['structure', 'hydraulique', 'électrique', 'sécurité', 'thermique'],
    confidence: 'high',
    description: 'Piscine enterrée',
  },
  piscine_hors_sol: {
    domains: ['hydraulique', 'électrique', 'sécurité'],
    confidence: 'medium',
    description: 'Piscine hors sol (structure allégée)',
  },
  spa: {
    domains: ['hydraulique', 'électrique', 'sécurité', 'thermique'],
    confidence: 'medium',
    description: 'Spa / balnéothérapie',
  },

  // ── Bâtiments collectifs / ERP ────────────────────────────────────────────
  immeuble_erp: {
    domains: ['structure', 'sécurité', 'incendie', 'accessibilité', 'électrique', 'hydraulique', 'acoustique', 'thermique', 'sismique'],
    confidence: 'high',
    description: 'Immeuble ERP — tous les domaines requis',
  },
  erp: {
    domains: ['structure', 'sécurité', 'incendie', 'accessibilité', 'électrique', 'hydraulique', 'acoustique', 'thermique', 'sismique'],
    confidence: 'high',
    description: 'Établissement recevant du public',
  },
  local_commercial: {
    domains: ['structure', 'sécurité', 'incendie', 'accessibilité', 'électrique', 'hydraulique', 'acoustique', 'thermique'],
    confidence: 'high',
    description: 'Local commercial',
  },
  immeuble_collectif: {
    domains: ['structure', 'sécurité', 'incendie', 'accessibilité', 'électrique', 'hydraulique', 'acoustique', 'thermique', 'sismique'],
    confidence: 'high',
    description: 'Immeuble collectif résidentiel',
  },
  batiment_industriel: {
    domains: ['structure', 'sécurité', 'incendie', 'électrique', 'hydraulique', 'thermique', 'sismique'],
    confidence: 'high',
    description: 'Bâtiment industriel / entrepôt',
  },

  // ── Gros œuvre ────────────────────────────────────────────────────────────
  gros_oeuvre: {
    domains: ['structure', 'sismique', 'sécurité'],
    confidence: 'high',
    description: 'Gros œuvre — structure + fondations',
  },
  fondations: {
    domains: ['structure', 'sismique', 'sécurité'],
    confidence: 'high',
    description: 'Travaux de fondations',
  },
  charpente: {
    domains: ['structure', 'sécurité', 'thermique'],
    confidence: 'high',
    description: 'Charpente bois ou métallique',
  },

  // ── Corps d\'état techniques ───────────────────────────────────────────────
  electricite_seule: {
    domains: ['électrique', 'sécurité'],
    confidence: 'high',
    description: 'Travaux électriques isolés',
  },
  plomberie_seule: {
    domains: ['hydraulique', 'sécurité'],
    confidence: 'high',
    description: 'Travaux de plomberie isolés',
  },
  toiture_seule: {
    domains: ['structure', 'thermique'],
    confidence: 'high',
    description: 'Travaux de toiture isolés',
  },
  chauffage_seule: {
    domains: ['thermique', 'sécurité'],
    confidence: 'medium',
    description: 'Installation de chauffage',
  },
  climatisation: {
    domains: ['thermique', 'électrique', 'sécurité'],
    confidence: 'medium',
    description: 'Installation de climatisation / CVC',
  },
  ventilation: {
    domains: ['thermique', 'sécurité', 'acoustique'],
    confidence: 'medium',
    description: 'Ventilation / VMC',
  },
  isolation_seule: {
    domains: ['thermique', 'acoustique'],
    confidence: 'medium',
    description: 'Travaux d\'isolation thermique ou acoustique',
  },
  facade: {
    domains: ['structure', 'thermique', 'sécurité'],
    confidence: 'medium',
    description: 'Ravalement ou isolation extérieure de façade',
  },
  assainissement: {
    domains: ['hydraulique', 'sécurité'],
    confidence: 'high',
    description: 'Assainissement / réseau EU/EP',
  },

  // ── Défaut / inconnu ──────────────────────────────────────────────────────
  autre: {
    domains: ['structure'],
    confidence: 'low',
    description: 'Type de projet non spécifié — domaine minimal par défaut',
  },
  unknown: {
    domains: ['structure'],
    confidence: 'low',
    description: 'Type de projet inconnu — domaine minimal par défaut',
  },
};

// ---------------------------------------------------------------------------
// Normalisation de la clé
// ---------------------------------------------------------------------------

function normalizeProjectType(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .normalize('NFD')                    // décompose les accents
    .replace(/[\u0300-\u036f]/g, '')     // supprime les diacritiques
    .replace(/\s+/g, '_')               // espaces → underscores
    .replace(/[^a-z0-9_]/g, '');        // retire tout le reste
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

/**
 * Déduit les domaines de règles applicables pour un type de projet.
 *
 * @param projectType - Type du projet (ex: "piscine", "maison neuve", "ERP")
 * @returns Tableau de domaines DB valides (jamais vide — fallback: ['structure'])
 */
export function deduceImpliedDomains(projectType: string | null | undefined): RuleDomain[] {
  if (!projectType) return ['structure'];

  const key = normalizeProjectType(projectType);
  const entry = PROJECT_TYPE_TAXONOMY[key];

  if (!entry) {
    return ['structure'];
  }

  return entry.domains;
}

/**
 * Enrichit projectData avec les champs de déduction de contexte.
 * À appeler dans l'orchestrateur AVANT runLotEngine.
 */
export function enrichWithImpliedDomains(
  projectData: Record<string, any>
): Record<string, any> & { impliedDomains: RuleDomain[]; contextDeductionConfidence: string } {
  const projectType =
    projectData?.type ??
    projectData?.project_type ??
    projectData?.projectType ??
    'unknown';

  const key = normalizeProjectType(String(projectType));
  const entry = PROJECT_TYPE_TAXONOMY[key];
  const impliedDomains = entry?.domains ?? ['structure'];
  const contextDeductionConfidence = entry?.confidence ?? 'low';

  return {
    ...projectData,
    impliedDomains,
    contextDeductionConfidence,
  };
}

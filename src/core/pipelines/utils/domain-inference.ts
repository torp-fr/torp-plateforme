// ─────────────────────────────────────────────────────────────────────────────
// domain-inference.ts — BTP domain mapping
// Maps project/item context → applicable regulatory domains, DTU, normes, certifications
// ─────────────────────────────────────────────────────────────────────────────

import type { ProjectType } from '../types/index.js';

export interface DomainProfile {
  /** Primary domain (e.g. 'thermique', 'électrique') */
  primary: string;
  /** All applicable domains for this project type */
  domains: string[];
  /** Applicable DTU references */
  dtu: string[];
  /** French normes (NF, NF DTU, etc.) */
  normes: string[];
  /** Required contractor certifications (RGE, Qualibat…) */
  certifications: string[];
  /** Mandatory administrative permits */
  permits: string[];
}

// ── Static mapping tables ────────────────────────────────────────────────────

const DOMAIN_PROFILES: Record<ProjectType, DomainProfile> = {
  piscine: {
    primary: 'hydraulique',
    domains: ['hydraulique', 'électrique', 'structure', 'finitions'],
    dtu: ['DTU 65.11', 'DTU 60.1'],
    normes: ['NF P90-308', 'NF C 15-100'],
    certifications: ['Qualipiscine', 'Qualibat'],
    permits: ['Déclaration préalable (>10m²)', 'Permis de construire (>100m² ou > 1,8m)'],
  },
  renovation: {
    primary: 'multi-corps',
    domains: ['structure', 'thermique', 'électrique', 'hydraulique', 'finitions', 'enveloppe'],
    dtu: ['DTU 20.1', 'DTU 45.11', 'DTU 60.1', 'DTU 69.1'],
    normes: ['NF C 15-100', 'NF DTU 36.5', 'RT2012 / RE2020'],
    certifications: ['RGE', 'Qualibat', 'QualiPAC'],
    permits: ['Déclaration préalable si modif aspect extérieur', 'Permis de construire si extension >20m²'],
  },
  extension: {
    primary: 'structure',
    domains: ['structure', 'enveloppe', 'thermique', 'électrique', 'hydraulique'],
    dtu: ['DTU 20.1', 'DTU 31.1', 'DTU 45.11'],
    normes: ['Eurocodes EC2/EC5', 'RE2020', 'NF C 15-100'],
    certifications: ['Qualibat', 'RGE'],
    permits: ['Permis de construire (>20m² ou zone PLU)', 'Déclaration préalable (5-20m²)'],
  },
  construction_neuve: {
    primary: 'structure',
    domains: ['structure', 'enveloppe', 'thermique', 'électrique', 'hydraulique', 'finitions'],
    dtu: ['DTU 13.3', 'DTU 20.1', 'DTU 31.2', 'DTU 45.11', 'DTU 60.1'],
    normes: ['Eurocodes', 'RE2020', 'NF C 15-100', 'NF P01-012'],
    certifications: ['Qualibat', 'RGE', 'NF Habitat'],
    permits: ['Permis de construire', 'Déclaration ouverture chantier (DOC)', 'DAACT'],
  },
  maison_neuve: {
    primary: 'structure',
    domains: ['structure', 'enveloppe', 'thermique', 'électrique', 'hydraulique', 'finitions'],
    dtu: ['DTU 13.3', 'DTU 20.1', 'DTU 31.2', 'DTU 45.11', 'DTU 60.1'],
    normes: ['Eurocodes', 'RE2020', 'NF C 15-100', 'CCMI (loi 90-1129)'],
    certifications: ['Qualibat', 'RGE', 'NF Habitat HQE'],
    permits: ['Permis de construire', 'DOC', 'DAACT'],
  },
  toiture: {
    primary: 'couverture',
    domains: ['structure', 'couverture', 'enveloppe'],
    dtu: ['DTU 40.11', 'DTU 40.21', 'DTU 40.22', 'DTU 40.23', 'DTU 40.41', 'DTU 43.1'],
    normes: ['NF P34-301', 'NF EN 1873', 'NF DTU 40.35'],
    certifications: ['Qualibat 33x', 'Qualirenov'],
    permits: ['Déclaration préalable si modif aspect extérieur en zone ABF'],
  },
  electricite_seule: {
    primary: 'électrique',
    domains: ['électrique'],
    dtu: ['DTU 70.1'],
    normes: ['NF C 15-100', 'NF C 14-100', 'NF EN 60439'],
    certifications: ['Qualifelec', 'RGE Elec+'],
    permits: [],
  },
  plomberie_seule: {
    primary: 'hydraulique',
    domains: ['hydraulique'],
    dtu: ['DTU 60.1', 'DTU 60.11', 'DTU 65.10'],
    normes: ['NF P40-201', 'NF EN 806', 'XP P41-220'],
    certifications: ['Qualibat 52x', 'QualiPAC'],
    permits: [],
  },
  isolation: {
    primary: 'thermique',
    domains: ['thermique', 'enveloppe'],
    dtu: ['DTU 45.11', 'DTU 45.10', 'DTU 20.1'],
    normes: ['RT2012 / RE2020', 'NF EN ISO 6946', 'Th-BCE'],
    certifications: ['RGE', 'Qualibat 71x', 'PACTE'],
    permits: [],
  },
  chauffage: {
    primary: 'thermique',
    domains: ['thermique', 'hydraulique'],
    dtu: ['DTU 65.3', 'DTU 65.4', 'DTU 65.10', 'DTU 65.11'],
    normes: ['NF EN 12831', 'NF EN 12828', 'RE2020'],
    certifications: ['QualiPAC', 'RGE', 'Qualigaz', 'Qualibat 54x'],
    permits: [],
  },
  fenetre: {
    primary: 'enveloppe',
    domains: ['enveloppe', 'thermique'],
    dtu: ['DTU 36.5', 'DTU 37.1'],
    normes: ['NF EN 14351-1', 'NF DTU 36.5', 'Th-BCE Uw'],
    certifications: ['Qualibat 44x', 'RGE', 'LABEL ACOTHERM'],
    permits: ['Déclaration préalable si modification aspect en ABF'],
  },
  cuisine: {
    primary: 'finitions',
    domains: ['finitions', 'hydraulique', 'électrique'],
    dtu: ['DTU 60.1', 'DTU 70.1', 'DTU 36.5'],
    normes: ['NF E 51-121', 'NF C 15-100'],
    certifications: ['Qualibat'],
    permits: [],
  },
  salle_de_bain: {
    primary: 'finitions',
    domains: ['finitions', 'hydraulique', 'électrique'],
    dtu: ['DTU 52.2', 'DTU 60.1', 'DTU 70.1'],
    normes: ['NF C 15-100 (zone humide)', 'NF P61-301'],
    certifications: ['Qualibat'],
    permits: [],
  },
  autre: {
    primary: 'divers',
    domains: ['divers'],
    dtu: [],
    normes: [],
    certifications: ['Qualibat'],
    permits: [],
  },
};

// ── Category → domain override ───────────────────────────────────────────────

const CATEGORY_DOMAIN_MAP: Record<string, string> = {
  electricite:    'électrique',
  plomberie:      'hydraulique',
  toiture:        'couverture',
  structure:      'structure',
  chauffage:      'thermique',
  isolation:      'thermique',
  menuiserie:     'enveloppe',
  carrelage:      'finitions',
  peinture:       'finitions',
  terrassement:   'structure',
  charpente:      'couverture',
  zinguerie:      'couverture',
  maçonnerie:     'structure',
  plâtrerie:      'finitions',
  carreleur:      'finitions',
  revêtement:     'finitions',
  ventilation:    'thermique',
  climatisation:  'thermique',
  échafaudage:    'divers',
  démolition:     'structure',
};

// ── Exports ──────────────────────────────────────────────────────────────────

/**
 * Get the full regulatory domain profile for a given project type.
 * Never returns undefined — falls back to 'autre'.
 */
export function getDomainProfile(projectType: ProjectType): DomainProfile {
  return DOMAIN_PROFILES[projectType] ?? DOMAIN_PROFILES.autre;
}

/**
 * Map a line-item category string to its regulatory domain.
 * Used for per-item domain tagging in parsed devis.
 */
export function inferItemDomain(category: string): string {
  const normalized = category.toLowerCase().trim();
  return CATEGORY_DOMAIN_MAP[normalized] ?? 'divers';
}

/**
 * Check whether a domain requires an RGE-certified contractor.
 * MaPrimeRénov' and CEE bonuses are conditioned on this.
 */
export function requiresRGE(domain: string): boolean {
  const rge_domains = new Set(['thermique', 'enveloppe', 'couverture', 'électrique']);
  return rge_domains.has(domain);
}

/**
 * Infer applicable DTUs for a given category keyword.
 * Returns an empty array if no mapping exists.
 */
export function inferDTUsForCategory(category: string): string[] {
  const map: Record<string, string[]> = {
    electricite:   ['DTU 70.1'],
    plomberie:     ['DTU 60.1', 'DTU 60.11'],
    toiture:       ['DTU 40.11', 'DTU 40.21', 'DTU 40.41'],
    structure:     ['DTU 20.1', 'DTU 13.3'],
    chauffage:     ['DTU 65.3', 'DTU 65.10'],
    isolation:     ['DTU 45.11', 'DTU 45.10'],
    menuiserie:    ['DTU 36.5', 'DTU 37.1'],
    carrelage:     ['DTU 52.2'],
    peinture:      [],
    charpente:     ['DTU 31.1', 'DTU 31.2'],
    etancheite:    ['DTU 43.1', 'DTU 43.3'],
    terrassement:  ['DTU 12'],
    maçonnerie:    ['DTU 20.1'],
    plâtrerie:     ['DTU 25.1', 'DTU 25.41'],
    ventilation:   ['DTU 68.1', 'DTU 68.3'],
  };
  return map[category.toLowerCase()] ?? [];
}

/**
 * Score how well a contractor's declared activity matches the devis domain.
 * Returns 0–1 (1 = perfect match).
 */
export function scoreContractorDomainMatch(
  contractorActivity: string,
  devisDomain: string
): number {
  const activity = contractorActivity.toLowerCase();
  const domain = devisDomain.toLowerCase();

  // Direct match
  if (activity.includes(domain)) return 1.0;

  // Partial aliases
  const aliases: Record<string, string[]> = {
    électrique: ['electricite', 'elec', 'courant fort', 'courant faible'],
    hydraulique: ['plombier', 'plomberie', 'sanitaire', 'chauffagiste'],
    thermique: ['chauffage', 'pompe à chaleur', 'pac', 'climatisation', 'vmc'],
    structure: ['gros oeuvre', 'maçon', 'béton', 'fondation'],
    couverture: ['couvreur', 'toiture', 'charpente', 'zinguerie'],
    enveloppe: ['menuisier', 'menuiserie', 'fenêtre', 'façade'],
    finitions: ['peintre', 'carreleur', 'plaquiste', 'revêtement'],
  };

  const alts = aliases[domain] ?? [];
  if (alts.some(a => activity.includes(a))) return 0.8;

  // Generic BTP — plausible but not specialised
  if (activity.includes('btp') || activity.includes('tous corps d')) return 0.5;

  return 0.2;
}

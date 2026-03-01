/**
 * Doctrine Source Registry (Phase 30)
 * Centralized registry of authoritative sources for doctrine activation
 * Defines source types, authority levels, legal weights
 */

export type SourceType = 'DTU' | 'NORME' | 'GUIDE' | 'JURISPRUDENCE' | 'TECHNIQUE' | 'GUIDE_ADEME';

export interface DoctrineSource {
  id: string;
  name: string;
  sourceType: SourceType;
  description: string;
  authorityLevel: 1 | 2 | 3 | 4 | 5; // 5 = highest (DTU, law), 1 = lowest (guide)
  legalWeight: 1 | 2 | 3 | 4 | 5; // 5 = legally binding, 1 = advisory
  enforceable: boolean;
  sectorTags: string[]; // construction types: 'batiment', 'renovation', 'extension', etc
  issuingAuthority?: string; // AFNOR, ADEME, Ministry, etc
  validFrom?: string; // ISO 8601 date
  validUntil?: string; // ISO 8601 date or null for indefinite
  documentUrl?: string;
  externalReference?: string;
}

/**
 * Standard Doctrine Sources Registry
 * Pre-defined authoritative sources for French construction
 */
export const DOCTRINE_SOURCES_REGISTRY: DoctrineSource[] = [
  // DTU (Highly authoritative)
  {
    id: 'dtu-20-1',
    name: 'DTU 20.1 - Travaux de bâtiment - Exécution des ouvrages - Gros œuvre',
    sourceType: 'DTU',
    description: 'Règles de bonne exécution du gros œuvre',
    authorityLevel: 5,
    legalWeight: 5,
    enforceable: true,
    sectorTags: ['batiment', 'gros-oeuvre', 'renovation', 'extension'],
    issuingAuthority: 'AFNOR',
    validFrom: '2015-01-01',
  },
  {
    id: 'dtu-25-41',
    name: 'DTU 25.41 - Revêtements de façade - Revêtements scellés',
    sourceType: 'DTU',
    description: 'Revêtements scellés de façade - Exécution',
    authorityLevel: 5,
    legalWeight: 5,
    enforceable: true,
    sectorTags: ['facade', 'batiment'],
    issuingAuthority: 'AFNOR',
    validFrom: '2015-06-01',
  },
  {
    id: 'dtu-43-3',
    name: 'DTU 43.3 - Travaux de bâtiment - Plaques de plâtre',
    sourceType: 'DTU',
    description: 'Conception et exécution des cloisons en plaques de plâtre',
    authorityLevel: 5,
    legalWeight: 5,
    enforceable: true,
    sectorTags: ['interieur', 'cloisons', 'batiment'],
    issuingAuthority: 'AFNOR',
    validFrom: '2013-05-01',
  },

  // Normes NFC
  {
    id: 'nfc-15-100',
    name: 'NF C 15-100 - Installations électriques basse tension',
    sourceType: 'NORME',
    description: 'Norme française pour installations électriques',
    authorityLevel: 5,
    legalWeight: 5,
    enforceable: true,
    sectorTags: ['electricite', 'batiment', 'renovation'],
    issuingAuthority: 'AFNOR',
    validFrom: '2015-01-01',
  },
  {
    id: 'nfc-15-100-2',
    name: 'NF C 15-100 Amendement 2 - Mise à jour électrique',
    sourceType: 'NORME',
    description: 'Amendement technique à NF C 15-100',
    authorityLevel: 5,
    legalWeight: 5,
    enforceable: true,
    sectorTags: ['electricite', 'batiment'],
    issuingAuthority: 'AFNOR',
    validFrom: '2020-01-01',
  },

  // ADEME Guides
  {
    id: 'guide-ademe-reno-2024',
    name: 'Guide ADEME - Rénovation Énergétique 2024',
    sourceType: 'GUIDE_ADEME',
    description: 'Bonnes pratiques pour rénovation énergétique',
    authorityLevel: 3,
    legalWeight: 3,
    enforceable: false,
    sectorTags: ['renovation', 'energetique', 'batiment'],
    issuingAuthority: 'ADEME',
    validFrom: '2024-01-01',
  },
  {
    id: 'guide-ademe-qualite-rge',
    name: 'Guide ADEME - Qualité RGE',
    sourceType: 'GUIDE_ADEME',
    description: 'Guide de qualité pour artisans RGE',
    authorityLevel: 4,
    legalWeight: 4,
    enforceable: false,
    sectorTags: ['rge', 'qualite', 'renovation'],
    issuingAuthority: 'ADEME',
    validFrom: '2023-01-01',
  },

  // Jurisprudence (advisory)
  {
    id: 'cas-cass-2023-01',
    name: 'Jurisprudence - Cour de Cassation 2023',
    sourceType: 'JURISPRUDENCE',
    description: 'Jurisprudence relative aux responsabilités construction',
    authorityLevel: 2,
    legalWeight: 3,
    enforceable: false,
    sectorTags: ['responsabilite', 'construction'],
    issuingAuthority: 'Cour de Cassation',
    validFrom: '2023-01-01',
  },

  // Technique Fabricants
  {
    id: 'tech-isover-isolation',
    name: 'Fiche technique Isover - Isolation thermique',
    sourceType: 'TECHNIQUE',
    description: 'Fiche technique produit isolation thermique',
    authorityLevel: 2,
    legalWeight: 2,
    enforceable: false,
    sectorTags: ['isolation', 'thermique', 'renovation'],
    issuingAuthority: 'Isover',
    validFrom: '2023-06-01',
  },
];

/**
 * Get source by ID
 */
export function getDoctrineSource(sourceId: string): DoctrineSource | undefined {
  return DOCTRINE_SOURCES_REGISTRY.find((s) => s.id === sourceId);
}

/**
 * Get sources by sector
 */
export function getSourcesBySector(sector: string): DoctrineSource[] {
  return DOCTRINE_SOURCES_REGISTRY.filter((s) => s.sectorTags.includes(sector));
}

/**
 * Get sources by type
 */
export function getSourcesByType(sourceType: SourceType): DoctrineSource[] {
  return DOCTRINE_SOURCES_REGISTRY.filter((s) => s.sourceType === sourceType);
}

/**
 * Get enforceable sources only
 */
export function getEnforceableSources(): DoctrineSource[] {
  return DOCTRINE_SOURCES_REGISTRY.filter((s) => s.enforceable);
}

/**
 * Calculate authority score (0-100) based on authority and legal weight
 */
export function calculateSourceAuthorityScore(source: DoctrineSource): number {
  return ((source.authorityLevel + source.legalWeight) / 10) * 100;
}

/**
 * Check if source is valid on given date
 */
export function isSourceValidOnDate(source: DoctrineSource, date: Date): boolean {
  const dateStr = date.toISOString().split('T')[0];
  if (source.validFrom && dateStr < source.validFrom) {
    return false;
  }
  if (source.validUntil && dateStr > source.validUntil) {
    return false;
  }
  return true;
}

/**
 * Get all valid sources for a sector on given date
 */
export function getValidSourcesForSector(sector: string, date: Date): DoctrineSource[] {
  return getSourcesBySector(sector).filter((s) => isSourceValidOnDate(s, date));
}

export default DOCTRINE_SOURCES_REGISTRY;

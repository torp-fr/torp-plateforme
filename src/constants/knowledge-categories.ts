/**
 * Knowledge Category Labels — French UI Mappings
 *
 * Re-exports the canonical TORP taxonomy from documentCategories.ts
 * and provides helper functions for UI display.
 */

import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  type DocumentCategory,
} from './documentCategories';

export { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABELS };
export type { DocumentCategory };

// Kept for backward compatibility with existing call-sites.
export const KNOWLEDGE_CATEGORY_LABELS: Record<DocumentCategory, { label: string; description: string }> = {
  DTU: {
    label: 'DTU — Documents Techniques Unifiés',
    description: 'Documents techniques officiels de construction (ex. DTU 36.5, DTU 13.3)',
  },
  EUROCODE: {
    label: 'Eurocodes',
    description: 'Normes de calcul structurelles européennes (ex. EN 1990, EN 1992)',
  },
  CODE_CONSTRUCTION: {
    label: 'Code de la construction',
    description: 'Textes réglementaires officiels (CCH, RE2020, arrêtés)',
  },
  NORME: {
    label: 'Normes (AFNOR / ISO)',
    description: 'Normes AFNOR, ISO et standards techniques (ex. NF EN ISO 6946)',
  },
  GUIDE_TECHNIQUE: {
    label: 'Guide technique',
    description: 'Guides techniques fabricants, CSTB et recommandations professionnelles',
  },
  JURISPRUDENCE: {
    label: 'Jurisprudence',
    description: 'Décisions de justice, responsabilité décennale, dommage ouvrage',
  },
  PRIX_BTP: {
    label: 'Référentiel tarifaire BTP',
    description: 'Données de tarification et références de marché (ex. 80–120 €/m²)',
  },
};

export function getCategoryLabel(category: string): string {
  return KNOWLEDGE_CATEGORY_LABELS[category as DocumentCategory]?.label ?? category;
}

export function getCategoryDescription(category: string): string {
  return KNOWLEDGE_CATEGORY_LABELS[category as DocumentCategory]?.description ?? '';
}

export function getAllCategories() {
  return DOCUMENT_CATEGORIES.map(id => ({
    id,
    label: KNOWLEDGE_CATEGORY_LABELS[id].label,
    description: KNOWLEDGE_CATEGORY_LABELS[id].description,
  }));
}

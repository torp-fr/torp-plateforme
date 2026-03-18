/**
 * Canonical document categories used for corpus routing in the TORP RAG platform.
 * These categories control which documents are retrieved during QA orchestration.
 *
 * Single source of truth — all components, services, and prompts must import from here.
 */

export const DOCUMENT_CATEGORIES = [
  'DTU',
  'EUROCODE',
  'CODE_CONSTRUCTION',
  'NORMES',
  'GUIDE_TECHNIQUE',
  'JURISPRUDENCE',
  'PRIX_BTP',
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  DTU:               'DTU — Documents Techniques Unifiés',
  EUROCODE:          'Eurocodes',
  CODE_CONSTRUCTION: 'Code de la construction',
  NORMES:            'Normes (AFNOR / ISO)',
  GUIDE_TECHNIQUE:   'Guide technique',
  JURISPRUDENCE:     'Jurisprudence',
  PRIX_BTP:          'Référentiel tarifaire BTP',
};

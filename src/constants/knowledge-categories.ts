/**
 * PHASE 36: Knowledge Category Labels - French UI Mappings
 * Maps database enums to user-friendly French labels and hints
 */

export const KNOWLEDGE_CATEGORY_LABELS: Record<string, { label: string; description: string; examples: string[] }> = {
  DTU: {
    label: 'DTU - Documents Techniques Unifiés',
    description: 'Documents techniques officiels et normes de construction',
    examples: [
      'DTU 36.5 - Menuiseries extérieures',
      'DTU 13.3 - Fondations',
      'DTU 20.1 - Travaux de maçonnerie',
      'DTU 23.1 - Charpentes en bois',
    ],
  },
  EUROCODE: {
    label: 'Eurocodes',
    description: 'Normes de calcul structurelles européennes',
    examples: [
      'EN 1990 - Bases de calcul',
      'EN 1991 - Charges',
      'EN 1992 - Béton armé',
      'EN 1995 - Structures bois',
    ],
  },
  NORM: {
    label: 'Normes',
    description: 'Normes AFNOR, ISO et standards techniques',
    examples: [
      'NF EN ISO 6946 - Résistance thermique',
      'NF P 75-301 - Menuiseries',
      'NF EN 13501-1 - Classification feu',
    ],
  },
  REGULATION: {
    label: 'Réglementation',
    description: 'Textes réglementaires officiels et lois',
    examples: [
      'Code de la construction et de l\'habitation',
      'RE2020 - Réglementation énergétique',
      'RGE - Reconnu Garant Environnement',
      'Arrêtés préfectoraux',
    ],
  },
  GUIDELINE: {
    label: 'Guide officiel',
    description: 'Guides ministériels et recommandations officielles',
    examples: [
      'Guide rénovation thermique',
      'Guide Habiter Mieux',
      'Guide de bonnes pratiques ADEME',
      'Recommandations CSTB',
    ],
  },
  BEST_PRACTICE: {
    label: 'Bonnes pratiques',
    description: 'Recommandations métier et bonnes pratiques éprouvées',
    examples: [
      'Bonnes pratiques isolation thermique',
      'Guide rénovation écologique',
      'Standards qualité construction',
      'Protocoles validation chantier',
    ],
  },
  TECHNICAL_GUIDE: {
    label: 'Guide technique',
    description: 'Guides techniques fabricants et spécialistes',
    examples: [
      'Guide technique fenêtres PVC',
      'Guide pose pompe à chaleur',
      'Guide mise en œuvre matériaux',
      'Fiches techniques produits',
    ],
  },
  TRAINING: {
    label: 'Formation',
    description: 'Matériel pédagogique et supports de formation',
    examples: [
      'Module RE2020',
      'Formation isolation thermique',
      'Certification RGE',
      'Cours normes construction',
    ],
  },
  MANUAL: {
    label: 'Manuel',
    description: 'Manuels utilisateur et guides d\'utilisation',
    examples: [
      'Manuel installation PAC',
      'Guide utilisation logiciel',
      'Notice technique appareil',
      'Mode d\'emploi équipement',
    ],
  },
  HANDBOOK: {
    label: 'Référentiel',
    description: 'Référentiels métier et guide complets',
    examples: [
      'Référentiel qualité construction',
      'Handbook isolation',
      'Manuel construction durable',
      'Référentiel audit énergétique',
    ],
  },
  SUSTAINABILITY: {
    label: 'Développement durable',
    description: 'Normes et guides environnementaux',
    examples: [
      'HQE - Haute Qualité Environnementale',
      'Certification BREEAM',
      'Label Énergie Positive',
      'Standards construction durable',
    ],
  },
  ENERGY_EFFICIENCY: {
    label: 'Efficacité énergétique',
    description: 'Normes et réglementations énergétiques',
    examples: [
      'RE2020 - Réglementation énergétique',
      'DPE - Diagnostic Performance Énergétique',
      'Classe énergétique bâtiment',
      'Performance thermique éléments',
    ],
  },
  LEGAL: {
    label: 'Cadre juridique',
    description: 'Aspects juridiques et légaux',
    examples: [
      'Conditions générales de vente',
      'Responsabilité contractuelle',
      'Droit du consommateur',
      'Conditions d\'exercice',
    ],
  },
  LIABILITY: {
    label: 'Responsabilités',
    description: 'Responsabilités civile et décennale',
    examples: [
      'Responsabilité civile décennale',
      'Assurance dommage ouvrage',
      'Couverture responsabilité',
      'Limites couverture assurance',
    ],
  },
  WARRANTY: {
    label: 'Garanties',
    description: 'Conditions et durées de garantie',
    examples: [
      'Garantie décennale construction',
      'Garantie produit fabricant',
      'Conditions garantie',
      'Durée protection éléments',
    ],
  },
  CASE_STUDY: {
    label: 'Étude de cas',
    description: 'Retours d\'expérience et études de rénovation',
    examples: [
      'Rénovation maison année 1980',
      'Isolation toiture réussie',
      'Cas rénovation complexe',
      'Exemple projet similaire',
    ],
  },
  LESSONS_LEARNED: {
    label: 'Retours d\'expérience',
    description: 'Leçons tirées d\'erreurs ou de succès',
    examples: [
      'Erreurs fréquentes isolation',
      'Succès installations PAC',
      'Problèmes courants menuiseries',
      'Points d\'attention chantier',
    ],
  },
  PRICING_REFERENCE: {
    label: 'Référentiel tarifaire',
    description: 'Données de tarification et références de marché',
    examples: [
      'Rénovation thermique: 80-120€/m²',
      'Pompe à chaleur: 8000-15000€',
      'Fenêtres PVC: 200-400€/m²',
      'Isolation combles: 20-40€/m²',
    ],
  },
};

/**
 * Get French label for category
 */
export function getCategoryLabel(category: string): string {
  return KNOWLEDGE_CATEGORY_LABELS[category]?.label || category;
}

/**
 * Get category description
 */
export function getCategoryDescription(category: string): string {
  return KNOWLEDGE_CATEGORY_LABELS[category]?.description || '';
}

/**
 * Get example suggestions for category
 */
export function getCategoryExamples(category: string): string[] {
  return KNOWLEDGE_CATEGORY_LABELS[category]?.examples || [];
}

/**
 * Get all categories with labels
 */
export function getAllCategories() {
  return Object.entries(KNOWLEDGE_CATEGORY_LABELS).map(([key, value]) => ({
    id: key,
    label: value.label,
    description: value.description,
  }));
}

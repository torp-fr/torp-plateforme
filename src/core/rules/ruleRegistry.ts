/**
 * Rule Registry
 * Centralized declarative rules for all lot categories
 * Easy to extend without modifying engine logic
 */

/**
 * Individual rule definition
 */
export interface Rule {
  id: string;
  category: 'electricite' | 'plomberie' | 'toiture' | 'generic';
  obligation: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  weight: number;
  source?: string;
}

/**
 * Complete rule registry
 * All obligations are mapped here in a declarative manner
 * Rules are evaluated in order by the Rule Engine
 */
export const RULE_REGISTRY: Rule[] = [
  // Electricité rules
  {
    id: 'ELEC_NFC15100',
    category: 'electricite',
    obligation: 'Vérifier conformité NFC 15-100',
    severity: 'critical',
    weight: 15,
    source: 'Code construction français',
  },
  {
    id: 'ELEC_DECLARATION',
    category: 'electricite',
    obligation: 'Vérifier déclaration conformité électrique',
    severity: 'high',
    weight: 10,
    source: 'Norme AFNOR',
  },
  {
    id: 'ELEC_ASSURANCE',
    category: 'electricite',
    obligation: 'Vérifier assurance responsabilité civile',
    severity: 'high',
    weight: 10,
    source: 'Obligation légale',
  },

  // Plomberie rules
  {
    id: 'PLOMB_EAU',
    category: 'plomberie',
    obligation: 'Vérifier conformité normes eau potable',
    severity: 'high',
    weight: 10,
    source: 'Code sanitaire',
  },
  {
    id: 'PLOMB_ASSURANCE',
    category: 'plomberie',
    obligation: 'Vérifier assurance dommages',
    severity: 'medium',
    weight: 7,
    source: 'Obligation légale',
  },

  // Toiture rules
  {
    id: 'TOIT_DECLARATION',
    category: 'toiture',
    obligation: 'Vérifier déclaration préalable en mairie',
    severity: 'high',
    weight: 10,
    source: 'Code urbanisme',
  },
  {
    id: 'TOIT_CODE',
    category: 'toiture',
    obligation: 'Vérifier conformité code construction',
    severity: 'critical',
    weight: 15,
    source: 'Code construction français',
  },
  {
    id: 'TOIT_DECENNALE',
    category: 'toiture',
    obligation: 'Vérifier couverture assurance décennale',
    severity: 'high',
    weight: 10,
    source: 'Loi LATREILLE',
  },

  // Generic rules (apply to all categories except unknown)
  {
    id: 'GENERIC_DEVIS',
    category: 'generic',
    obligation: 'Établir devis détaillé',
    severity: 'low',
    weight: 3,
    source: 'Bonne pratique',
  },
  {
    id: 'GENERIC_GARANTIES',
    category: 'generic',
    obligation: 'Vérifier garanties décennales',
    severity: 'high',
    weight: 10,
    source: 'Obligation légale',
  },
];

/**
 * Get rules for a specific category
 * Used by Rule Engine for targeted obligation collection
 */
export function getRulesByCategory(category: string): Rule[] {
  if (category === 'unknown') {
    return [];
  }

  // Get category-specific rules
  const categoryRules = RULE_REGISTRY.filter((rule) => rule.category === category);

  // Add generic rules (apply to all known categories)
  const genericRules = RULE_REGISTRY.filter((rule) => rule.category === 'generic');

  return [...categoryRules, ...genericRules];
}

/**
 * Get all available rules
 */
export function getAllRules(): Rule[] {
  return RULE_REGISTRY;
}

/**
 * Get rule by ID
 */
export function getRuleById(id: string): Rule | undefined {
  return RULE_REGISTRY.find((rule) => rule.id === id);
}

/**
 * Get statistics about rules
 */
export function getRuleStats() {
  const categoryStats: Record<string, number> = {};

  RULE_REGISTRY.forEach((rule) => {
    if (rule.category !== 'generic') {
      categoryStats[rule.category] = (categoryStats[rule.category] || 0) + 1;
    }
  });

  const genericCount = RULE_REGISTRY.filter((rule) => rule.category === 'generic').length;

  return {
    totalRules: RULE_REGISTRY.length,
    genericRules: genericCount,
    categoryRules: categoryStats,
    categories: Object.keys(categoryStats),
  };
}

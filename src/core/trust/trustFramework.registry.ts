/**
 * Trust Framework Registry
 * Centralized business-level registry for professional reliability assessment
 * Phase 22: Trust Framework Foundation
 *
 * This registry defines:
 * - Expected characteristics for each lot type
 * - Risk profiles for each obligation type
 * - Compliance requirements
 * - Grade-blocking conditions
 *
 * Pure metadata registry - no engine logic
 */

import { TrustFrameworkRegistry, LotTrustProfile, ObligationTrustProfile } from './trustTypes';

/**
 * Main Trust Framework Registry
 * Business rules and metadata for TORP scoring system
 */
export const TRUST_FRAMEWORK_REGISTRY: TrustFrameworkRegistry = {
  // ==========================================
  // LOT TRUST PROFILES
  // ==========================================
  lots: {
    // HIGH CRITICALITY LOTS
    gros_oeuvre: {
      lotType: 'gros_oeuvre',
      criticality: 'critical',
      expectedObligations: [
        'GENERIC_DEVIS',
        'GROS_STRUCTURE',
        'GENERIC_GARANTIES',
        'ADMIN_PERMIS',
      ],
      priceRange: {
        minPerUnit: 500,
        maxPerUnit: 5000,
      },
      minimumDescriptionLength: 150,
      description: 'Structural works (foundations, walls, frames)',
      relatedKeywords: ['fondation', 'mur', 'structure', 'ossature'],
    },

    electricite: {
      lotType: 'electricite',
      criticality: 'high',
      expectedObligations: [
        'ELEC_NFC15100',
        'ELEC_DECLARATION',
        'GENERIC_DEVIS',
        'GENERIC_GARANTIES',
      ],
      priceRange: {
        minPerUnit: 100,
        maxPerUnit: 2000,
      },
      minimumDescriptionLength: 100,
      description: 'Electrical installation (wiring, panels, fixtures)',
      relatedKeywords: ['électricité', 'installation', 'nfc 15-100', 'tableau'],
    },

    toiture: {
      lotType: 'toiture',
      criticality: 'high',
      expectedObligations: [
        'TOIT_CODE',
        'GENERIC_DEVIS',
        'GENERIC_GARANTIES',
        'TOIT_NORMS',
      ],
      priceRange: {
        minPerUnit: 200,
        maxPerUnit: 3000,
      },
      minimumDescriptionLength: 100,
      description: 'Roofing works (covering, insulation, drainage)',
      relatedKeywords: ['toiture', 'toit', 'couverture', 'charpente'],
    },

    // MEDIUM CRITICALITY LOTS
    plomberie: {
      lotType: 'plomberie',
      criticality: 'medium',
      expectedObligations: [
        'PLOMB_EAU',
        'GENERIC_DEVIS',
        'GENERIC_GARANTIES',
        'PLOMB_NORMS',
      ],
      priceRange: {
        minPerUnit: 80,
        maxPerUnit: 1500,
      },
      minimumDescriptionLength: 80,
      description: 'Plumbing works (water supply, drainage, fixtures)',
      relatedKeywords: ['plomberie', 'eau', 'sanitaires', 'tuyauterie'],
    },

    chauffage: {
      lotType: 'chauffage',
      criticality: 'medium',
      expectedObligations: [
        'GENERIC_DEVIS',
        'GENERIC_GARANTIES',
        'CHAUF_NORMS',
        'CHAUF_EFFICIENCY',
      ],
      priceRange: {
        minPerUnit: 150,
        maxPerUnit: 2000,
      },
      minimumDescriptionLength: 100,
      description: 'Heating system (boiler, radiators, pipes)',
      relatedKeywords: ['chauffage', 'radiateur', 'chaudière', 'tuyauterie'],
    },

    // LOW CRITICALITY LOTS
    peinture: {
      lotType: 'peinture',
      criticality: 'low',
      expectedObligations: [
        'GENERIC_DEVIS',
        'GENERIC_GARANTIES',
        'PEINTURE_PREP',
      ],
      priceRange: {
        minPerUnit: 20,
        maxPerUnit: 300,
      },
      minimumDescriptionLength: 50,
      description: 'Painting works (walls, ceilings, trim)',
      relatedKeywords: ['peinture', 'peintre', 'couleur', 'finition'],
    },

    menuiserie: {
      lotType: 'menuiserie',
      criticality: 'low',
      expectedObligations: [
        'GENERIC_DEVIS',
        'GENERIC_GARANTIES',
        'MENU_QUALITY',
      ],
      priceRange: {
        minPerUnit: 50,
        maxPerUnit: 1000,
      },
      minimumDescriptionLength: 70,
      description: 'Carpentry works (doors, windows, built-ins)',
      relatedKeywords: ['menuiserie', 'portes', 'fenêtres', 'bois'],
    },

    carrelage: {
      lotType: 'carrelage',
      criticality: 'medium',
      expectedObligations: [
        'GENERIC_DEVIS',
        'GENERIC_GARANTIES',
        'CARRE_PREP',
      ],
      priceRange: {
        minPerUnit: 50,
        maxPerUnit: 800,
      },
      minimumDescriptionLength: 80,
      description: 'Tiling works (bathroom, kitchen, floors)',
      relatedKeywords: ['carrelage', 'tuile', 'salle de bain', 'cuisine'],
    },
  },

  // ==========================================
  // OBLIGATION TRUST PROFILES
  // ==========================================
  obligations: {
    // CRITICAL SAFETY OBLIGATIONS
    ELEC_NFC15100: {
      obligationId: 'ELEC_NFC15100',
      riskType: 'safety',
      severity: 'critical',
      description: 'French electrical code compliance (NFC 15-100)',
      blocksGradeAbove: 'B',
      relatedLots: ['electricite'],
      keywords: ['nfc 15-100', 'électricité', 'conformité', 'sécurité'],
    },

    TOIT_CODE: {
      obligationId: 'TOIT_CODE',
      riskType: 'safety',
      severity: 'high',
      description: 'Roofing code compliance (DTU, building standards)',
      blocksGradeAbove: 'C',
      relatedLots: ['toiture'],
      keywords: ['toiture', 'norme', 'étanchéité', 'dtu'],
    },

    PLOMB_EAU: {
      obligationId: 'PLOMB_EAU',
      riskType: 'safety',
      severity: 'high',
      description: 'Water system code compliance (DTU 60.11)',
      blocksGradeAbove: 'C',
      relatedLots: ['plomberie'],
      keywords: ['plomberie', 'eau', 'étanchéité', 'normes'],
    },

    // ADMINISTRATIVE OBLIGATIONS
    GENERIC_DEVIS: {
      obligationId: 'GENERIC_DEVIS',
      riskType: 'administrative',
      severity: 'high',
      description: 'Quote must be detailed and itemized',
      blocksGradeAbove: 'D',
      relatedLots: ['gros_oeuvre', 'electricite', 'toiture', 'plomberie', 'peinture', 'menuiserie', 'carrelage'],
      keywords: ['devis', 'détail', 'estimation', 'prix'],
    },

    GENERIC_GARANTIES: {
      obligationId: 'GENERIC_GARANTIES',
      riskType: 'financial',
      severity: 'high',
      description: 'Warranty period and terms must be specified',
      blocksGradeAbove: 'C',
      relatedLots: ['gros_oeuvre', 'electricite', 'toiture', 'plomberie', 'peinture', 'menuiserie', 'carrelage'],
      keywords: ['garantie', 'décennale', 'assurance', 'responsabilité'],
    },

    ADMIN_PERMIS: {
      obligationId: 'ADMIN_PERMIS',
      riskType: 'administrative',
      severity: 'critical',
      description: 'Building permits and regulatory compliance',
      blocksGradeAbove: 'B',
      relatedLots: ['gros_oeuvre'],
      keywords: ['permis', 'autorisation', 'démarche', 'administrative'],
    },

    // TECHNICAL OBLIGATIONS
    ELEC_DECLARATION: {
      obligationId: 'ELEC_DECLARATION',
      riskType: 'technical',
      severity: 'high',
      description: 'Electrical work declaration (CONSUEL)',
      blocksGradeAbove: 'C',
      relatedLots: ['electricite'],
      keywords: ['consuel', 'déclaration', 'contrôle', 'électrique'],
    },

    TOIT_NORMS: {
      obligationId: 'TOIT_NORMS',
      riskType: 'technical',
      severity: 'medium',
      description: 'Roofing technical norms (DTU)',
      blocksGradeAbove: undefined,
      relatedLots: ['toiture'],
      keywords: ['dtu', 'technique', 'norme', 'professionnel'],
    },

    PLOMB_NORMS: {
      obligationId: 'PLOMB_NORMS',
      riskType: 'technical',
      severity: 'medium',
      description: 'Plumbing technical norms (DTU 60)',
      blocksGradeAbove: undefined,
      relatedLots: ['plomberie'],
      keywords: ['dtu', 'technique', 'norme', 'professionnel'],
    },

    CHAUF_NORMS: {
      obligationId: 'CHAUF_NORMS',
      riskType: 'technical',
      severity: 'medium',
      description: 'Heating system technical norms',
      blocksGradeAbove: undefined,
      relatedLots: ['chauffage'],
      keywords: ['norme', 'technique', 'performance', 'efficacité'],
    },

    CHAUF_EFFICIENCY: {
      obligationId: 'CHAUF_EFFICIENCY',
      riskType: 'technical',
      severity: 'medium',
      description: 'Energy efficiency certification',
      blocksGradeAbove: undefined,
      relatedLots: ['chauffage'],
      keywords: ['efficacité', 'énergie', 'certification', 'performance'],
    },

    PEINTURE_PREP: {
      obligationId: 'PEINTURE_PREP',
      riskType: 'technical',
      severity: 'low',
      description: 'Proper surface preparation required',
      blocksGradeAbove: undefined,
      relatedLots: ['peinture'],
      keywords: ['préparation', 'surface', 'technique', 'professionnel'],
    },

    MENU_QUALITY: {
      obligationId: 'MENU_QUALITY',
      riskType: 'technical',
      severity: 'low',
      description: 'Quality carpentry standards',
      blocksGradeAbove: undefined,
      relatedLots: ['menuiserie'],
      keywords: ['qualité', 'bois', 'technique', 'finition'],
    },

    CARRE_PREP: {
      obligationId: 'CARRE_PREP',
      riskType: 'technical',
      severity: 'medium',
      description: 'Proper substrate preparation for tiling',
      blocksGradeAbove: undefined,
      relatedLots: ['carrelage'],
      keywords: ['préparation', 'surface', 'technique', 'qualité'],
    },

    // COMMERCIAL OBLIGATIONS
    GENERIC_CONDITIONS: {
      obligationId: 'GENERIC_CONDITIONS',
      riskType: 'commercial',
      severity: 'medium',
      description: 'General terms and conditions specified',
      blocksGradeAbove: undefined,
      relatedLots: ['gros_oeuvre', 'electricite', 'toiture', 'plomberie'],
      keywords: ['conditions', 'termes', 'commercial', 'contrat'],
    },

    GROS_STRUCTURE: {
      obligationId: 'GROS_STRUCTURE',
      riskType: 'safety',
      severity: 'critical',
      description: 'Structural integrity and load-bearing capacity',
      blocksGradeAbove: 'A',
      relatedLots: ['gros_oeuvre'],
      keywords: ['structure', 'porteur', 'stabilité', 'fondation'],
    },
  },

  // ==========================================
  // REGISTRY METADATA
  // ==========================================
  metadata: {
    version: '1.0',
    createdAt: new Date().toISOString(),
    description: 'TORP Trust Framework Registry v1.0 - Centralized business rules and metadata for professional reliability assessment',
  },
};

/**
 * Get lot profile by type
 */
export function getLotProfile(lotType: string): LotTrustProfile | null {
  return TRUST_FRAMEWORK_REGISTRY.lots[lotType] || null;
}

/**
 * Get obligation profile by ID
 */
export function getObligationProfile(obligationId: string): ObligationTrustProfile | null {
  return TRUST_FRAMEWORK_REGISTRY.obligations[obligationId] || null;
}

/**
 * Get all lot types
 */
export function getAllLotTypes(): string[] {
  return Object.keys(TRUST_FRAMEWORK_REGISTRY.lots);
}

/**
 * Get all obligation IDs
 */
export function getAllObligationIds(): string[] {
  return Object.keys(TRUST_FRAMEWORK_REGISTRY.obligations);
}

/**
 * Get lots by criticality
 */
export function getLotsByCriticality(criticality: string): LotTrustProfile[] {
  return Object.values(TRUST_FRAMEWORK_REGISTRY.lots).filter(
    (lot) => lot.criticality === criticality
  );
}

/**
 * Get obligations by risk type
 */
export function getObligationsByRiskType(riskType: string): ObligationTrustProfile[] {
  return Object.values(TRUST_FRAMEWORK_REGISTRY.obligations).filter(
    (obl) => obl.riskType === riskType
  );
}

/**
 * Get obligations by severity
 */
export function getObligationsBySeverity(severity: string): ObligationTrustProfile[] {
  return Object.values(TRUST_FRAMEWORK_REGISTRY.obligations).filter(
    (obl) => obl.severity === severity
  );
}

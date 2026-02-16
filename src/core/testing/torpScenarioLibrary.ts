/**
 * TORP Scenario Library v1.0
 * Pre-defined test scenarios for business logic validation
 * Pure data structures - no logic execution
 */

/**
 * Scenario definition for TORP testing
 */
export interface TorpTestScenario {
  name: string;
  description: string;
  input: {
    enterpriseProfile: {
      name: string;
      yearsInBusiness: number;
      hasInsurance: boolean;
      structure: 'sole' | 'eirl' | 'sarl' | 'sas' | 'sa';
      registeredEmployees: number;
    };
    lots: Array<{
      type: string;
      description: string;
    }>;
    pricing: {
      totalAmount: number;
      breakdown: Record<string, number>;
    };
    quality: {
      descriptionLength: number;
      hasLegalMentions: boolean;
      materialQuality: 'poor' | 'average' | 'good' | 'excellent';
    };
    obligations: Array<{
      type: string;
      obligationId: string;
    }>;
  };
  expectedOutcome: {
    shouldHaveImbalance: boolean;
    expectedFlagTypes: string[];
    expectedGradeRange: [string, string]; // [min, max]
  };
}

/**
 * Scenario 1: Perfect Enterprise
 * Strong everything - should result in grade A with no imbalances
 */
export const SCENARIO_PERFECT_ENTERPRISE: TorpTestScenario = {
  name: 'Perfect Enterprise',
  description: 'Strong enterprise, high compliance, good pricing, excellent quality',
  input: {
    enterpriseProfile: {
      name: 'Excellent Construction SARL',
      yearsInBusiness: 15,
      hasInsurance: true,
      structure: 'sarl',
      registeredEmployees: 12,
    },
    lots: [
      { type: 'electricite', description: 'Complete electrical installation' },
      { type: 'plomberie', description: 'Full plumbing system' },
    ],
    pricing: {
      totalAmount: 15000,
      breakdown: {
        electricite: 6000,
        plomberie: 5000,
        other: 4000,
      },
    },
    quality: {
      descriptionLength: 1500,
      hasLegalMentions: true,
      materialQuality: 'excellent',
    },
    obligations: [
      { type: 'ELEC_NFC15100', obligationId: 'elec_nfc' },
      { type: 'ELEC_DECLARATION', obligationId: 'elec_decl' },
      { type: 'GENERIC_DEVIS', obligationId: 'devis' },
      { type: 'GENERIC_GARANTIES', obligationId: 'garanties' },
    ],
  },
  expectedOutcome: {
    shouldHaveImbalance: false,
    expectedFlagTypes: [],
    expectedGradeRange: ['A', 'A'],
  },
};

/**
 * Scenario 2: Strong Compliance but Weak Enterprise
 * High compliance scores but weak enterprise profile
 * Should trigger enterpriseRiskMismatch
 */
export const SCENARIO_COMPLIANCE_WITHOUT_ENTERPRISE: TorpTestScenario = {
  name: 'Strong Compliance but Weak Enterprise',
  description: 'High compliance and quality, but enterprise is too weak for grade A',
  input: {
    enterpriseProfile: {
      name: 'Small New Company',
      yearsInBusiness: 1,
      hasInsurance: false,
      structure: 'sole',
      registeredEmployees: 1,
    },
    lots: [
      { type: 'electricite', description: 'Excellent electrical design' },
      { type: 'plomberie', description: 'Professional plumbing' },
    ],
    pricing: {
      totalAmount: 12000,
      breakdown: {
        electricite: 5000,
        plomberie: 4000,
        other: 3000,
      },
    },
    quality: {
      descriptionLength: 2000,
      hasLegalMentions: true,
      materialQuality: 'excellent',
    },
    obligations: [
      { type: 'ELEC_NFC15100', obligationId: 'elec_nfc' },
      { type: 'ELEC_DECLARATION', obligationId: 'elec_decl' },
      { type: 'GENERIC_DEVIS', obligationId: 'devis' },
    ],
  },
  expectedOutcome: {
    shouldHaveImbalance: true,
    expectedFlagTypes: ['enterpriseRiskMismatch'],
    expectedGradeRange: ['B', 'C'],
  },
};

/**
 * Scenario 3: Suspicious Pricing
 * Pricing is too low relative to work complexity
 * Should trigger price anomalies and possible capping
 */
export const SCENARIO_SUSPICIOUS_PRICING: TorpTestScenario = {
  name: 'Suspicious Pricing',
  description: 'Work scope is large but pricing is suspiciously low',
  input: {
    enterpriseProfile: {
      name: 'Budget Construction Ltd',
      yearsInBusiness: 8,
      hasInsurance: true,
      structure: 'sarl',
      registeredEmployees: 6,
    },
    lots: [
      { type: 'gros_oeuvre', description: 'Foundation and structural work' },
      { type: 'electricite', description: 'Electrical system' },
      { type: 'plomberie', description: 'Plumbing system' },
    ],
    pricing: {
      totalAmount: 3000,
      breakdown: {
        gros_oeuvre: 500,
        electricite: 1000,
        plomberie: 800,
        other: 700,
      },
    },
    quality: {
      descriptionLength: 800,
      hasLegalMentions: false,
      materialQuality: 'average',
    },
    obligations: [
      { type: 'GROS_STRUCTURE', obligationId: 'gros_struct' },
      { type: 'GENERIC_DEVIS', obligationId: 'devis' },
    ],
  },
  expectedOutcome: {
    shouldHaveImbalance: true,
    expectedFlagTypes: [],
    expectedGradeRange: ['D', 'E'],
  },
};

/**
 * Scenario 4: Critical Lot with Weak Enterprise
 * High-risk lot (gros_oeuvre) assigned to weak enterprise
 * Should trigger criticalLotEnterpriseWeakness
 */
export const SCENARIO_CRITICAL_LOT_WEAK_ENTERPRISE: TorpTestScenario = {
  name: 'Critical Lot with Weak Enterprise',
  description: 'Critical structural work assigned to weak enterprise',
  input: {
    enterpriseProfile: {
      name: 'Startup Builders',
      yearsInBusiness: 2,
      hasInsurance: false,
      structure: 'eirl',
      registeredEmployees: 2,
    },
    lots: [
      { type: 'gros_oeuvre', description: 'Complete structural renovation' },
      { type: 'toiture', description: 'Roof system replacement' },
    ],
    pricing: {
      totalAmount: 25000,
      breakdown: {
        gros_oeuvre: 15000,
        toiture: 8000,
        other: 2000,
      },
    },
    quality: {
      descriptionLength: 1200,
      hasLegalMentions: true,
      materialQuality: 'good',
    },
    obligations: [
      { type: 'GROS_STRUCTURE', obligationId: 'gros_struct' },
      { type: 'TOIT_CODE', obligationId: 'toit_code' },
      { type: 'GENERIC_DEVIS', obligationId: 'devis' },
    ],
  },
  expectedOutcome: {
    shouldHaveImbalance: true,
    expectedFlagTypes: ['criticalLotEnterpriseWeakness'],
    expectedGradeRange: ['C', 'E'],
  },
};

/**
 * Scenario 5: High Quality but Low Pricing
 * Excellent quote documentation but suspiciously low pricing
 * Should trigger pricingQualityMismatch
 */
export const SCENARIO_QUALITY_WITHOUT_PRICING: TorpTestScenario = {
  name: 'High Quality but Low Pricing',
  description: 'Professional documentation masks low pricing anomalies',
  input: {
    enterpriseProfile: {
      name: 'Professional Experts SARL',
      yearsInBusiness: 20,
      hasInsurance: true,
      structure: 'sarl',
      registeredEmployees: 15,
    },
    lots: [
      { type: 'electricite', description: 'Premium electrical installation with smart controls' },
      { type: 'plomberie', description: 'High-end plumbing with thermal regulation' },
    ],
    pricing: {
      totalAmount: 4000,
      breakdown: {
        electricite: 1500,
        plomberie: 1200,
        other: 1300,
      },
    },
    quality: {
      descriptionLength: 2500,
      hasLegalMentions: true,
      materialQuality: 'excellent',
    },
    obligations: [
      { type: 'ELEC_NFC15100', obligationId: 'elec_nfc' },
      { type: 'ELEC_DECLARATION', obligationId: 'elec_decl' },
      { type: 'GENERIC_DEVIS', obligationId: 'devis' },
    ],
  },
  expectedOutcome: {
    shouldHaveImbalance: true,
    expectedFlagTypes: ['pricingQualityMismatch'],
    expectedGradeRange: ['B', 'D'],
  },
};

/**
 * Scenario 6: Fake Good Score Blocked by Obligation
 * Appears good on paper but grade-blocking obligation restricts final grade
 * Should trigger grade capping
 */
export const SCENARIO_BLOCKED_BY_OBLIGATION: TorpTestScenario = {
  name: 'Fake Good Score Blocked by Obligation',
  description: 'High scores but grade-blocking obligation prevents high grade',
  input: {
    enterpriseProfile: {
      name: 'Competent Builders Inc',
      yearsInBusiness: 12,
      hasInsurance: true,
      structure: 'sas',
      registeredEmployees: 10,
    },
    lots: [
      { type: 'electricite', description: 'Complete electrical system upgrade' },
      { type: 'plomberie', description: 'Full plumbing renovation' },
    ],
    pricing: {
      totalAmount: 14000,
      breakdown: {
        electricite: 6000,
        plomberie: 5000,
        other: 3000,
      },
    },
    quality: {
      descriptionLength: 1800,
      hasLegalMentions: true,
      materialQuality: 'excellent',
    },
    obligations: [
      { type: 'ELEC_NFC15100', obligationId: 'elec_nfc' }, // Blocks A
      { type: 'ELEC_DECLARATION', obligationId: 'elec_decl' }, // Blocks C
      { type: 'GENERIC_DEVIS', obligationId: 'devis' },
      { type: 'GENERIC_GARANTIES', obligationId: 'garanties' },
    ],
  },
  expectedOutcome: {
    shouldHaveImbalance: false,
    expectedFlagTypes: [],
    expectedGradeRange: ['B', 'B'],
  },
};

/**
 * Scenario 7: Compliance vs Quality Contradiction
 * High compliance but very poor quality description
 * Should trigger complianceQualityMismatch
 */
export const SCENARIO_COMPLIANCE_WITHOUT_QUALITY: TorpTestScenario = {
  name: 'Compliance Without Quality',
  description: 'High compliance but poor quality description contradicts scoring',
  input: {
    enterpriseProfile: {
      name: 'Compliant but Sloppy Ltd',
      yearsInBusiness: 10,
      hasInsurance: true,
      structure: 'sarl',
      registeredEmployees: 8,
    },
    lots: [
      { type: 'electricite', description: 'Works' }, // Minimal description
      { type: 'plomberie', description: 'Plumbing' }, // Minimal description
    ],
    pricing: {
      totalAmount: 10000,
      breakdown: {
        electricite: 4000,
        plomberie: 3500,
        other: 2500,
      },
    },
    quality: {
      descriptionLength: 150, // Very short
      hasLegalMentions: false,
      materialQuality: 'poor',
    },
    obligations: [
      { type: 'ELEC_NFC15100', obligationId: 'elec_nfc' },
      { type: 'GENERIC_DEVIS', obligationId: 'devis' },
    ],
  },
  expectedOutcome: {
    shouldHaveImbalance: true,
    expectedFlagTypes: ['complianceQualityMismatch'],
    expectedGradeRange: ['C', 'D'],
  },
};

/**
 * Collection of all test scenarios
 */
export const TORP_TEST_SCENARIOS: Record<string, TorpTestScenario> = {
  'perfect-enterprise': SCENARIO_PERFECT_ENTERPRISE,
  'compliance-without-enterprise': SCENARIO_COMPLIANCE_WITHOUT_ENTERPRISE,
  'suspicious-pricing': SCENARIO_SUSPICIOUS_PRICING,
  'critical-lot-weak-enterprise': SCENARIO_CRITICAL_LOT_WEAK_ENTERPRISE,
  'quality-without-pricing': SCENARIO_QUALITY_WITHOUT_PRICING,
  'blocked-by-obligation': SCENARIO_BLOCKED_BY_OBLIGATION,
  'compliance-without-quality': SCENARIO_COMPLIANCE_WITHOUT_QUALITY,
};

/**
 * Get a scenario by name
 */
export function getScenario(scenarioName: string): TorpTestScenario | undefined {
  return TORP_TEST_SCENARIOS[scenarioName.toLowerCase()];
}

/**
 * Get all available scenario names
 */
export function listAllScenarios(): string[] {
  return Object.keys(TORP_TEST_SCENARIOS);
}

/**
 * Get scenario summary for display
 */
export function getScenarioSummary(scenario: TorpTestScenario): string {
  return `[${scenario.name}] ${scenario.description}`;
}

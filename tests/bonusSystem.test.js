/**
 * Test Suite - Bonus System Integration Tests
 * Tests complets du système de bonus avec pondération et persistence
 */

const {
  calculateThematicScore,
  calculateBonusPoints,
  BONUS_RULES,
} = require('../src/engines/thematicScoringEngine');

describe('Bonus System Integration', () => {
  // ============================================================================
  // BONUS CALCULATION ACCURACY
  // ============================================================================

  describe('Bonus Calculation Accuracy', () => {
    test('Regulatory excellence bonus should be exactly +3', () => {
      const themeScores = {
        regulatory: { score: 95, breakdown: {} },
        risk: { score: 70, breakdown: {} },
        technical: { score: 70, breakdown: {} },
        transparency: { score: 70, breakdown: {} },
        optimization: { score: 70, breakdown: {} },
      };

      const analysisData = {
        regulatoryFindings: {
          nonCompliantItems: ['Item'],
        },
        riskFindings: {
          criticalRisks: ['Risk'],
        },
      };

      const bonus = calculateBonusPoints(themeScores, analysisData);
      expect(bonus.bonusPoints).toBe(3);
    });

    test('Risk excellence bonus should be exactly +2', () => {
      const themeScores = {
        regulatory: { score: 70, breakdown: {} },
        risk: { score: 92, breakdown: {} },
        technical: { score: 70, breakdown: {} },
        transparency: { score: 70, breakdown: {} },
        optimization: { score: 70, breakdown: {} },
      };

      const analysisData = {
        regulatoryFindings: {
          nonCompliantItems: ['Item'],
        },
        riskFindings: {
          criticalRisks: [],
        },
      };

      const bonus = calculateBonusPoints(themeScores, analysisData);
      expect(bonus.bonusBreakdown.riskExcellence.points).toBe(2);
    });

    test('Transparency excellence bonus should be exactly +2', () => {
      const themeScores = {
        regulatory: { score: 70, breakdown: {} },
        risk: { score: 70, breakdown: {} },
        technical: { score: 70, breakdown: {} },
        transparency: { score: 97, breakdown: {} },
        optimization: { score: 70, breakdown: {} },
      };

      const analysisData = {
        regulatoryFindings: {
          nonCompliantItems: ['Item'],
        },
        riskFindings: {
          criticalRisks: ['Risk'],
        },
      };

      const bonus = calculateBonusPoints(themeScores, analysisData);
      expect(bonus.bonusBreakdown.transparencyExcellence.points).toBe(2);
    });

    test('Zero critical/non-compliant bonus should be exactly +2', () => {
      const themeScores = {
        regulatory: { score: 70, breakdown: {} },
        risk: { score: 70, breakdown: {} },
        technical: { score: 70, breakdown: {} },
        transparency: { score: 70, breakdown: {} },
        optimization: { score: 70, breakdown: {} },
      };

      const analysisData = {
        regulatoryFindings: {
          nonCompliantItems: [],
        },
        riskFindings: {
          criticalRisks: [],
        },
      };

      const bonus = calculateBonusPoints(themeScores, analysisData);
      expect(bonus.bonusBreakdown.zeroNonCompliantAndCriticalRisk.points).toBe(2);
    });
  });

  // ============================================================================
  // BONUS CAPPING TESTS
  // ============================================================================

  describe('Bonus Capping (Maximum 5 Points)', () => {
    test('Sum of all bonus conditions should cap at 5', () => {
      const themeScores = {
        regulatory: { score: 95, breakdown: {} },
        risk: { score: 92, breakdown: {} },
        technical: { score: 95, breakdown: {} },
        transparency: { score: 98, breakdown: {} },
        optimization: { score: 95, breakdown: {} },
      };

      const analysisData = {
        regulatoryFindings: {
          nonCompliantItems: [],
        },
        riskFindings: {
          criticalRisks: [],
        },
      };

      const bonus = calculateBonusPoints(themeScores, analysisData);

      // Total eligible: 3 + 2 + 2 + 2 = 9
      expect(bonus.totalEligibleBonus).toBe(9);
      // But capped at 5
      expect(bonus.bonusPoints).toBe(5);
      expect(bonus.bonusCapApplied).toBe(true);
    });

    test('Bonus should never exceed max allowed (5)', () => {
      const themeScores = {
        regulatory: { score: 100, breakdown: {} },
        risk: { score: 100, breakdown: {} },
        technical: { score: 100, breakdown: {} },
        transparency: { score: 100, breakdown: {} },
        optimization: { score: 100, breakdown: {} },
      };

      const analysisData = {
        regulatoryFindings: {
          nonCompliantItems: [],
        },
        riskFindings: {
          criticalRisks: [],
        },
      };

      const bonus = calculateBonusPoints(themeScores, analysisData);
      expect(bonus.bonusPoints).toBeLessThanOrEqual(BONUS_RULES.maxBonus);
      expect(bonus.bonusPoints).toBe(5);
    });

    test('Partial bonus should not be capped unnecessarily', () => {
      const themeScores = {
        regulatory: { score: 95, breakdown: {} },
        risk: { score: 70, breakdown: {} },
        technical: { score: 70, breakdown: {} },
        transparency: { score: 70, breakdown: {} },
        optimization: { score: 70, breakdown: {} },
      };

      const analysisData = {
        regulatoryFindings: {
          nonCompliantItems: ['Item'],
        },
        riskFindings: {
          criticalRisks: ['Risk'],
        },
      };

      const bonus = calculateBonusPoints(themeScores, analysisData);
      expect(bonus.bonusPoints).toBe(3);
      expect(bonus.bonusCapApplied).toBe(false);
    });
  });

  // ============================================================================
  // FINAL SCORE WITH BONUS INTEGRATION
  // ============================================================================

  describe('Final Score with Bonus Application', () => {
    test('Final score should equal brut score plus bonus (no cap)', async () => {
      const input = {
        projectId: 'PROJ-TEST',
        devisId: 'DV-TEST',
        complexityWeights: {
          regulatory: 0.2,
          risk: 0.2,
          technical: 0.2,
          transparency: 0.2,
          optimization: 0.2,
        },
        analysisData: {
          regulatoryFindings: {
            missingClauses: [],
            invalidReferences: [],
            nonCompliantItems: [],
          },
          riskFindings: {
            criticalRisks: [],
            moderateRisks: [],
          },
          technicalFindings: {
            incoherences: [],
            omissions: [],
          },
          transparencyFindings: {
            unclearLines: [],
            missingDetails: [],
          },
          optimizationFindings: {
            improvementOpportunities: [],
          },
        },
      };

      const result = await calculateThematicScore(input);

      const expectedFinal = Math.min(
        Math.round((result.weightedScoreBrut + result.bonusPoints) * 100) / 100,
        100,
      );
      expect(result.weightedScore).toBe(expectedFinal);
    });

    test('Final score should be capped at 100', async () => {
      const input = {
        projectId: 'PROJ-CAP-TEST',
        devisId: 'DV-CAP-TEST',
        complexityWeights: {
          regulatory: 1.0,
          risk: 0,
          technical: 0,
          transparency: 0,
          optimization: 0,
        },
        analysisData: {
          regulatoryFindings: {
            missingClauses: [],
            invalidReferences: [],
            nonCompliantItems: [],
          },
          riskFindings: {
            criticalRisks: [],
            moderateRisks: [],
          },
          technicalFindings: {
            incoherences: [],
            omissions: [],
          },
          transparencyFindings: {
            unclearLines: [],
            missingDetails: [],
          },
          optimizationFindings: {
            improvementOpportunities: [],
          },
        },
      };

      const result = await calculateThematicScore(input);

      expect(result.weightedScore).toBeLessThanOrEqual(100);
    });

    test('Bonus should not affect individual theme scores', async () => {
      const input = {
        projectId: 'PROJ-THEME-TEST',
        devisId: 'DV-THEME-TEST',
        complexityWeights: {
          regulatory: 0.25,
          risk: 0.25,
          technical: 0.20,
          transparency: 0.15,
          optimization: 0.15,
        },
        analysisData: {
          regulatoryFindings: {
            missingClauses: ['Clause'],
            invalidReferences: [],
            nonCompliantItems: [],
          },
          riskFindings: {
            criticalRisks: [],
            moderateRisks: [],
          },
          technicalFindings: {
            incoherences: [],
            omissions: [],
          },
          transparencyFindings: {
            unclearLines: [],
            missingDetails: [],
          },
          optimizationFindings: {
            improvementOpportunities: [],
          },
        },
      };

      const result = await calculateThematicScore(input);

      // Regulatory should be 97 (100 - 3 for one missing clause)
      expect(result.scores.regulatory.score).toBe(97);
      // Other scores should be 100
      expect(result.scores.risk.score).toBe(100);
      expect(result.scores.technical.score).toBe(100);
      expect(result.scores.transparency.score).toBe(100);
      expect(result.scores.optimization.score).toBe(100);
    });
  });

  // ============================================================================
  // BONUS THRESHOLD BOUNDARIES
  // ============================================================================

  describe('Bonus Threshold Boundaries', () => {
    test('Regulatory 90.00 exactly should trigger bonus', () => {
      const themeScores = {
        regulatory: { score: 90.00, breakdown: {} },
        risk: { score: 70, breakdown: {} },
        technical: { score: 70, breakdown: {} },
        transparency: { score: 70, breakdown: {} },
        optimization: { score: 70, breakdown: {} },
      };

      const analysisData = {
        regulatoryFindings: { nonCompliantItems: ['Item'] },
        riskFindings: { criticalRisks: ['Risk'] },
      };

      const bonus = calculateBonusPoints(themeScores, analysisData);
      expect(bonus.bonusBreakdown.regulatoryExcellence.awarded).toBe(true);
    });

    test('Regulatory 89.99 should not trigger bonus', () => {
      const themeScores = {
        regulatory: { score: 89.99, breakdown: {} },
        risk: { score: 70, breakdown: {} },
        technical: { score: 70, breakdown: {} },
        transparency: { score: 70, breakdown: {} },
        optimization: { score: 70, breakdown: {} },
      };

      const analysisData = {
        regulatoryFindings: { nonCompliantItems: ['Item'] },
        riskFindings: { criticalRisks: ['Risk'] },
      };

      const bonus = calculateBonusPoints(themeScores, analysisData);
      expect(bonus.bonusBreakdown.regulatoryExcellence.awarded).toBe(false);
    });

    test('Risk 90.00 exactly should trigger bonus', () => {
      const themeScores = {
        regulatory: { score: 70, breakdown: {} },
        risk: { score: 90.00, breakdown: {} },
        technical: { score: 70, breakdown: {} },
        transparency: { score: 70, breakdown: {} },
        optimization: { score: 70, breakdown: {} },
      };

      const analysisData = {
        regulatoryFindings: { nonCompliantItems: ['Item'] },
        riskFindings: { criticalRisks: [] },
      };

      const bonus = calculateBonusPoints(themeScores, analysisData);
      expect(bonus.bonusBreakdown.riskExcellence.awarded).toBe(true);
    });

    test('Transparency 95.00 exactly should trigger bonus', () => {
      const themeScores = {
        regulatory: { score: 70, breakdown: {} },
        risk: { score: 70, breakdown: {} },
        technical: { score: 70, breakdown: {} },
        transparency: { score: 95.00, breakdown: {} },
        optimization: { score: 70, breakdown: {} },
      };

      const analysisData = {
        regulatoryFindings: { nonCompliantItems: ['Item'] },
        riskFindings: { criticalRisks: ['Risk'] },
      };

      const bonus = calculateBonusPoints(themeScores, analysisData);
      expect(bonus.bonusBreakdown.transparencyExcellence.awarded).toBe(true);
    });

    test('Transparency 94.99 should not trigger bonus', () => {
      const themeScores = {
        regulatory: { score: 70, breakdown: {} },
        risk: { score: 70, breakdown: {} },
        technical: { score: 70, breakdown: {} },
        transparency: { score: 94.99, breakdown: {} },
        optimization: { score: 70, breakdown: {} },
      };

      const analysisData = {
        regulatoryFindings: { nonCompliantItems: ['Item'] },
        riskFindings: { criticalRisks: ['Risk'] },
      };

      const bonus = calculateBonusPoints(themeScores, analysisData);
      expect(bonus.bonusBreakdown.transparencyExcellence.awarded).toBe(false);
    });
  });

  // ============================================================================
  // BONUS PERSISTENCE FIELDS
  // ============================================================================

  describe('Bonus Persistence Fields', () => {
    test('Result should include all bonus persistence fields', async () => {
      const input = {
        projectId: 'PROJ-PERSIST',
        devisId: 'DV-PERSIST',
        complexityWeights: {
          regulatory: 0.2,
          risk: 0.2,
          technical: 0.2,
          transparency: 0.2,
          optimization: 0.2,
        },
        analysisData: {
          regulatoryFindings: {
            missingClauses: [],
            invalidReferences: [],
            nonCompliantItems: [],
          },
          riskFindings: {
            criticalRisks: [],
            moderateRisks: [],
          },
          technicalFindings: {
            incoherences: [],
            omissions: [],
          },
          transparencyFindings: {
            unclearLines: [],
            missingDetails: [],
          },
          optimizationFindings: {
            improvementOpportunities: [],
          },
        },
      };

      const result = await calculateThematicScore(input);

      expect(result).toHaveProperty('weightedScoreBrut');
      expect(result).toHaveProperty('bonusPoints');
      expect(result).toHaveProperty('bonusBreakdown');
      expect(result).toHaveProperty('weightedScore');
    });

    test('Bonus breakdown should be JSON serializable', async () => {
      const input = {
        projectId: 'PROJ-JSON',
        devisId: 'DV-JSON',
        complexityWeights: {
          regulatory: 0.2,
          risk: 0.2,
          technical: 0.2,
          transparency: 0.2,
          optimization: 0.2,
        },
        analysisData: {
          regulatoryFindings: {
            missingClauses: [],
            invalidReferences: [],
            nonCompliantItems: [],
          },
          riskFindings: {
            criticalRisks: [],
            moderateRisks: [],
          },
          technicalFindings: {
            incoherences: [],
            omissions: [],
          },
          transparencyFindings: {
            unclearLines: [],
            missingDetails: [],
          },
          optimizationFindings: {
            improvementOpportunities: [],
          },
        },
      };

      const result = await calculateThematicScore(input);

      const serialized = JSON.stringify(result.bonusBreakdown);
      const deserialized = JSON.parse(serialized);

      expect(deserialized).toBeDefined();
      expect(Object.keys(deserialized).length).toBeGreaterThan(0);
    });

    test('Engine version should be in result', async () => {
      const input = {
        projectId: 'PROJ-VERSION',
        devisId: 'DV-VERSION',
        complexityWeights: {
          regulatory: 0.2,
          risk: 0.2,
          technical: 0.2,
          transparency: 0.2,
          optimization: 0.2,
        },
        analysisData: {
          regulatoryFindings: {
            missingClauses: [],
            invalidReferences: [],
            nonCompliantItems: [],
          },
          riskFindings: {
            criticalRisks: [],
            moderateRisks: [],
          },
          technicalFindings: {
            incoherences: [],
            omissions: [],
          },
          transparencyFindings: {
            unclearLines: [],
            missingDetails: [],
          },
          optimizationFindings: {
            improvementOpportunities: [],
          },
        },
      };

      const result = await calculateThematicScore(input);

      expect(result.engineVersion).toBe('v1.1_stable');
    });
  });

  // ============================================================================
  // BONUS DETERMINISM & CONSISTENCY
  // ============================================================================

  describe('Bonus Determinism & Consistency', () => {
    test('Same input always produces same bonus', async () => {
      const input = {
        projectId: 'PROJ-DET',
        devisId: 'DV-DET',
        complexityWeights: {
          regulatory: 0.25,
          risk: 0.25,
          technical: 0.20,
          transparency: 0.15,
          optimization: 0.15,
        },
        analysisData: {
          regulatoryFindings: {
            missingClauses: ['Clause 1'],
            invalidReferences: [],
            nonCompliantItems: [],
          },
          riskFindings: {
            criticalRisks: [],
            moderateRisks: [],
          },
          technicalFindings: {
            incoherences: [],
            omissions: [],
          },
          transparencyFindings: {
            unclearLines: [],
            missingDetails: [],
          },
          optimizationFindings: {
            improvementOpportunities: [],
          },
        },
      };

      const result1 = await calculateThematicScore(input);
      const result2 = await calculateThematicScore(input);
      const result3 = await calculateThematicScore(input);

      expect(result1.bonusPoints).toBe(result2.bonusPoints);
      expect(result2.bonusPoints).toBe(result3.bonusPoints);
    });

    test('Bonus breakdown consistency across runs', async () => {
      const input = {
        projectId: 'PROJ-BD-CONST',
        devisId: 'DV-BD-CONST',
        complexityWeights: {
          regulatory: 0.2,
          risk: 0.2,
          technical: 0.2,
          transparency: 0.2,
          optimization: 0.2,
        },
        analysisData: {
          regulatoryFindings: {
            missingClauses: [],
            invalidReferences: [],
            nonCompliantItems: [],
          },
          riskFindings: {
            criticalRisks: [],
            moderateRisks: [],
          },
          technicalFindings: {
            incoherences: [],
            omissions: [],
          },
          transparencyFindings: {
            unclearLines: [],
            missingDetails: [],
          },
          optimizationFindings: {
            improvementOpportunities: [],
          },
        },
      };

      const result1 = await calculateThematicScore(input);
      const result2 = await calculateThematicScore(input);

      expect(JSON.stringify(result1.bonusBreakdown)).toBe(
        JSON.stringify(result2.bonusBreakdown)
      );
    });
  });

  // ============================================================================
  // EDGE CASES FOR BONUS
  // ============================================================================

  describe('Bonus System Edge Cases', () => {
    test('All conditions met should result in maximum bonus (5)', () => {
      const themeScores = {
        regulatory: { score: 95, breakdown: {} },
        risk: { score: 95, breakdown: {} },
        technical: { score: 95, breakdown: {} },
        transparency: { score: 98, breakdown: {} },
        optimization: { score: 95, breakdown: {} },
      };

      const analysisData = {
        regulatoryFindings: { nonCompliantItems: [] },
        riskFindings: { criticalRisks: [] },
      };

      const bonus = calculateBonusPoints(themeScores, analysisData);
      expect(bonus.bonusPoints).toBe(5);
    });

    test('No conditions met should result in zero bonus', () => {
      const themeScores = {
        regulatory: { score: 85, breakdown: {} },
        risk: { score: 85, breakdown: {} },
        technical: { score: 85, breakdown: {} },
        transparency: { score: 85, breakdown: {} },
        optimization: { score: 85, breakdown: {} },
      };

      const analysisData = {
        regulatoryFindings: { nonCompliantItems: ['Item'] },
        riskFindings: { criticalRisks: ['Risk'] },
      };

      const bonus = calculateBonusPoints(themeScores, analysisData);
      expect(bonus.bonusPoints).toBe(0);
    });

    test('Only regulatory excellence should award +3', () => {
      const themeScores = {
        regulatory: { score: 95, breakdown: {} },
        risk: { score: 85, breakdown: {} },
        technical: { score: 85, breakdown: {} },
        transparency: { score: 85, breakdown: {} },
        optimization: { score: 85, breakdown: {} },
      };

      const analysisData = {
        regulatoryFindings: { nonCompliantItems: ['Item'] },
        riskFindings: { criticalRisks: ['Risk'] },
      };

      const bonus = calculateBonusPoints(themeScores, analysisData);
      expect(bonus.bonusPoints).toBe(3);
    });
  });
});

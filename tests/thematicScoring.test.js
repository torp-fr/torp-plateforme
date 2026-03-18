/**
 * Test Suite - Thematic Scoring Engine v1.1_stable
 * Tests déterministes avec couverture complète du scoring et du système de bonus
 */

const {
  calculateThematicScore,
  calculateThemeScores,
  calculateWeightedScore,
  calculateBonusPoints,
  determineGradeLetter,
  validateInput,
  validateWeights,
  validateAnalysisData,
  ENGINE_VERSION,
  BONUS_RULES,
  GRADE_SCALE,
} = require('../src/engines/thematicScoringEngine');

describe('Thematic Scoring Engine v1.1_stable', () => {
  // ============================================================================
  // VERSION & CONFIGURATION
  // ============================================================================

  describe('Version & Configuration', () => {
    test('ENGINE_VERSION should be v1.1_stable', () => {
      expect(ENGINE_VERSION).toBe('v1.1_stable');
    });

    test('BONUS_RULES should define max bonus of 5', () => {
      expect(BONUS_RULES.maxBonus).toBe(5);
    });

    test('BONUS_RULES should define all required bonus conditions', () => {
      expect(BONUS_RULES.regulatoryExcellence).toBeDefined();
      expect(BONUS_RULES.riskExcellence).toBeDefined();
      expect(BONUS_RULES.transparencyExcellence).toBeDefined();
      expect(BONUS_RULES.zeroNonCompliantAndCriticalRisk).toBeDefined();
    });

    test('GRADE_SCALE should have exactly 5 grades', () => {
      expect(GRADE_SCALE.length).toBe(5);
      expect(GRADE_SCALE.map(g => g.letter)).toEqual(['A', 'B', 'C', 'D', 'E']);
    });
  });

  // ============================================================================
  // VALIDATION TESTS
  // ============================================================================

  describe('Weights Validation', () => {
    test('Valid weights should pass validation', () => {
      const weights = {
        regulatory: 0.25,
        risk: 0.25,
        technical: 0.20,
        transparency: 0.15,
        optimization: 0.15,
      };
      const result = validateWeights(weights);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('Weights sum to 1.0 exactly', () => {
      const weights = {
        regulatory: 0.2,
        risk: 0.2,
        technical: 0.2,
        transparency: 0.2,
        optimization: 0.2,
      };
      const result = validateWeights(weights);
      expect(result.isValid).toBe(true);
    });

    test('Invalid weights sum should fail', () => {
      const weights = {
        regulatory: 0.5,
        risk: 0.5,
        technical: 0.5,
        transparency: 0.2,
        optimization: 0.2,
      };
      const result = validateWeights(weights);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Somme des poids invalide');
    });

    test('Missing weights should fail', () => {
      const weights = {
        regulatory: 0.5,
        risk: 0.5,
      };
      const result = validateWeights(weights);
      expect(result.isValid).toBe(false);
    });

    test('Negative weights should fail', () => {
      const weights = {
        regulatory: -0.1,
        risk: 0.3,
        technical: 0.3,
        transparency: 0.3,
        optimization: 0.2,
      };
      const result = validateWeights(weights);
      expect(result.isValid).toBe(false);
    });

    test('Weights > 1 should fail', () => {
      const weights = {
        regulatory: 1.5,
        risk: 0.2,
        technical: 0.2,
        transparency: 0.2,
        optimization: 0.2,
      };
      const result = validateWeights(weights);
      expect(result.isValid).toBe(false);
    });
  });

  describe('Analysis Data Validation', () => {
    const validAnalysisData = {
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
    };

    test('Valid analysis data should pass validation', () => {
      const result = validateAnalysisData(validAnalysisData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('Missing theme should fail', () => {
      const data = { ...validAnalysisData };
      delete data.regulatoryFindings;
      const result = validateAnalysisData(data);
      expect(result.isValid).toBe(false);
    });

    test('Non-array findings should fail', () => {
      const data = { ...validAnalysisData };
      data.regulatoryFindings.missingClauses = 'not an array';
      const result = validateAnalysisData(data);
      expect(result.isValid).toBe(false);
    });
  });

  // ============================================================================
  // THEME SCORES CALCULATION
  // ============================================================================

  describe('Theme Scores Calculation', () => {
    test('Perfect scores (no findings) should be 100 for all themes', () => {
      const analysisData = {
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
      };

      const scores = calculateThemeScores(analysisData);
      expect(scores.regulatory.score).toBe(100);
      expect(scores.risk.score).toBe(100);
      expect(scores.technical.score).toBe(100);
      expect(scores.transparency.score).toBe(100);
      expect(scores.optimization.score).toBe(100);
    });

    test('All critical findings should result in minimum scores', () => {
      const analysisData = {
        regulatoryFindings: {
          missingClauses: Array(10).fill('Missing'),
          invalidReferences: Array(10).fill('Invalid'),
          nonCompliantItems: Array(10).fill('Non-compliant'),
        },
        riskFindings: {
          criticalRisks: Array(10).fill('Critical'),
          moderateRisks: Array(10).fill('Moderate'),
        },
        technicalFindings: {
          incoherences: Array(10).fill('Incoherence'),
          omissions: Array(10).fill('Omission'),
        },
        transparencyFindings: {
          unclearLines: Array(10).fill('Unclear'),
          missingDetails: Array(10).fill('Missing detail'),
        },
        optimizationFindings: {
          improvementOpportunities: Array(10).fill('Opportunity'),
        },
      };

      const scores = calculateThemeScores(analysisData);
      expect(scores.regulatory.score).toBe(0);
      expect(scores.risk.score).toBe(0);
      expect(scores.technical.score).toBe(0);
      expect(scores.transparency.score).toBe(0);
      expect(scores.optimization.score).toBe(0);
    });

    test('Deterministic: same input should always produce same scores', () => {
      const analysisData = {
        regulatoryFindings: {
          missingClauses: ['Clause 1', 'Clause 2'],
          invalidReferences: ['Ref 1'],
          nonCompliantItems: ['Item 1'],
        },
        riskFindings: {
          criticalRisks: ['Risk 1'],
          moderateRisks: ['Risk 2', 'Risk 3'],
        },
        technicalFindings: {
          incoherences: [],
          omissions: ['Omission 1'],
        },
        transparencyFindings: {
          unclearLines: [],
          missingDetails: [],
        },
        optimizationFindings: {
          improvementOpportunities: [],
        },
      };

      const scores1 = calculateThemeScores(analysisData);
      const scores2 = calculateThemeScores(analysisData);
      const scores3 = calculateThemeScores(analysisData);

      expect(scores1.regulatory.score).toBe(scores2.regulatory.score);
      expect(scores2.regulatory.score).toBe(scores3.regulatory.score);
      expect(scores1.risk.score).toBe(scores2.risk.score);
      expect(scores2.risk.score).toBe(scores3.risk.score);
    });
  });

  // ============================================================================
  // WEIGHTED SCORE CALCULATION
  // ============================================================================

  describe('Weighted Score Calculation', () => {
    const themeScores = {
      regulatory: { score: 90, breakdown: {} },
      risk: { score: 85, breakdown: {} },
      technical: { score: 80, breakdown: {} },
      transparency: { score: 95, breakdown: {} },
      optimization: { score: 75, breakdown: {} },
    };

    test('Should calculate correct weighted score', () => {
      const weights = {
        regulatory: 0.25,
        risk: 0.25,
        technical: 0.20,
        transparency: 0.15,
        optimization: 0.15,
      };

      const score = calculateWeightedScore(themeScores, weights);
      const expected = (90 * 0.25) + (85 * 0.25) + (80 * 0.20) + (95 * 0.15) + (75 * 0.15);
      expect(score).toBeCloseTo(expected, 2);
    });

    test('Weighted score should be rounded to 2 decimals', () => {
      const weights = {
        regulatory: 0.333,
        risk: 0.333,
        technical: 0.167,
        transparency: 0.167,
        optimization: 0,
      };

      const score = calculateWeightedScore(themeScores, weights);
      expect(Number(score.toFixed(2))).toBe(score);
    });

    test('Equal weighting should be arithmetic mean', () => {
      const weights = {
        regulatory: 0.2,
        risk: 0.2,
        technical: 0.2,
        transparency: 0.2,
        optimization: 0.2,
      };

      const score = calculateWeightedScore(themeScores, weights);
      const mean = (90 + 85 + 80 + 95 + 75) / 5;
      expect(score).toBeCloseTo(mean, 2);
    });
  });

  // ============================================================================
  // BONUS SYSTEM TESTS
  // ============================================================================

  describe('Bonus System', () => {
    test('No bonus when conditions not met', () => {
      const themeScores = {
        regulatory: { score: 80, breakdown: {} },
        risk: { score: 80, breakdown: {} },
        technical: { score: 80, breakdown: {} },
        transparency: { score: 80, breakdown: {} },
        optimization: { score: 80, breakdown: {} },
      };

      const analysisData = {
        regulatoryFindings: {
          nonCompliantItems: ['Item 1'],
        },
        riskFindings: {
          criticalRisks: ['Risk 1'],
        },
      };

      const bonus = calculateBonusPoints(themeScores, analysisData);
      expect(bonus.bonusPoints).toBe(0);
    });

    test('Regulatory excellence bonus (+3) when score >= 90', () => {
      const themeScores = {
        regulatory: { score: 95, breakdown: {} },
        risk: { score: 80, breakdown: {} },
        technical: { score: 80, breakdown: {} },
        transparency: { score: 80, breakdown: {} },
        optimization: { score: 80, breakdown: {} },
      };

      const analysisData = {
        regulatoryFindings: {
          nonCompliantItems: ['Item 1'],
        },
        riskFindings: {
          criticalRisks: ['Risk 1'],
        },
      };

      const bonus = calculateBonusPoints(themeScores, analysisData);
      expect(bonus.bonusBreakdown.regulatoryExcellence.awarded).toBe(true);
      expect(bonus.bonusBreakdown.regulatoryExcellence.points).toBe(3);
    });

    test('Risk excellence bonus (+2) when score >= 90', () => {
      const themeScores = {
        regulatory: { score: 80, breakdown: {} },
        risk: { score: 92, breakdown: {} },
        technical: { score: 80, breakdown: {} },
        transparency: { score: 80, breakdown: {} },
        optimization: { score: 80, breakdown: {} },
      };

      const analysisData = {
        regulatoryFindings: {
          nonCompliantItems: ['Item 1'],
        },
        riskFindings: {
          criticalRisks: [],
        },
      };

      const bonus = calculateBonusPoints(themeScores, analysisData);
      expect(bonus.bonusBreakdown.riskExcellence.awarded).toBe(true);
      expect(bonus.bonusBreakdown.riskExcellence.points).toBe(2);
    });

    test('Transparency excellence bonus (+2) when score >= 95', () => {
      const themeScores = {
        regulatory: { score: 80, breakdown: {} },
        risk: { score: 80, breakdown: {} },
        technical: { score: 80, breakdown: {} },
        transparency: { score: 95, breakdown: {} },
        optimization: { score: 80, breakdown: {} },
      };

      const analysisData = {
        regulatoryFindings: {
          nonCompliantItems: ['Item 1'],
        },
        riskFindings: {
          criticalRisks: ['Risk 1'],
        },
      };

      const bonus = calculateBonusPoints(themeScores, analysisData);
      expect(bonus.bonusBreakdown.transparencyExcellence.awarded).toBe(true);
      expect(bonus.bonusBreakdown.transparencyExcellence.points).toBe(2);
    });

    test('Zero critical/non-compliant bonus (+2) when no findings', () => {
      const themeScores = {
        regulatory: { score: 80, breakdown: {} },
        risk: { score: 80, breakdown: {} },
        technical: { score: 80, breakdown: {} },
        transparency: { score: 80, breakdown: {} },
        optimization: { score: 80, breakdown: {} },
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
      expect(bonus.bonusBreakdown.zeroNonCompliantAndCriticalRisk.awarded).toBe(true);
      expect(bonus.bonusBreakdown.zeroNonCompliantAndCriticalRisk.points).toBe(2);
    });

    test('Maximum bonus should not exceed 5 points', () => {
      const themeScores = {
        regulatory: { score: 95, breakdown: {} },
        risk: { score: 95, breakdown: {} },
        technical: { score: 95, breakdown: {} },
        transparency: { score: 96, breakdown: {} },
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
      expect(bonus.bonusPoints).toBe(5);
      expect(bonus.bonusCapApplied).toBe(true);
    });

    test('Bonus is deterministic: same input produces same bonus', () => {
      const themeScores = {
        regulatory: { score: 92, breakdown: {} },
        risk: { score: 88, breakdown: {} },
        technical: { score: 85, breakdown: {} },
        transparency: { score: 96, breakdown: {} },
        optimization: { score: 80, breakdown: {} },
      };

      const analysisData = {
        regulatoryFindings: {
          nonCompliantItems: [],
        },
        riskFindings: {
          criticalRisks: [],
        },
      };

      const bonus1 = calculateBonusPoints(themeScores, analysisData);
      const bonus2 = calculateBonusPoints(themeScores, analysisData);
      const bonus3 = calculateBonusPoints(themeScores, analysisData);

      expect(bonus1.bonusPoints).toBe(bonus2.bonusPoints);
      expect(bonus2.bonusPoints).toBe(bonus3.bonusPoints);
      expect(bonus1.bonusPoints).toBe(5);
    });
  });

  // ============================================================================
  // GRADE DETERMINATION
  // ============================================================================

  describe('Grade Letter Determination', () => {
    test('Score 100 should be grade A', () => {
      expect(determineGradeLetter(100)).toBe('A');
    });

    test('Score 85 should be grade A (boundary)', () => {
      expect(determineGradeLetter(85)).toBe('A');
    });

    test('Score 84.99 should be grade B', () => {
      expect(determineGradeLetter(84.99)).toBe('B');
    });

    test('Score 75 should be grade B (boundary)', () => {
      expect(determineGradeLetter(75)).toBe('B');
    });

    test('Score 74.99 should be grade C', () => {
      expect(determineGradeLetter(74.99)).toBe('C');
    });

    test('Score 60 should be grade C (boundary)', () => {
      expect(determineGradeLetter(60)).toBe('C');
    });

    test('Score 59.99 should be grade D', () => {
      expect(determineGradeLetter(59.99)).toBe('D');
    });

    test('Score 45 should be grade D (boundary)', () => {
      expect(determineGradeLetter(45)).toBe('D');
    });

    test('Score 44.99 should be grade E', () => {
      expect(determineGradeLetter(44.99)).toBe('E');
    });

    test('Score 0 should be grade E', () => {
      expect(determineGradeLetter(0)).toBe('E');
    });
  });

  // ============================================================================
  // INTEGRATION TESTS - FULL PIPELINE
  // ============================================================================

  describe('Complete Scoring Pipeline (Integration)', () => {
    const validInput = {
      projectId: 'PROJ-TEST',
      devisId: 'DV-TEST',
      complexityWeights: {
        regulatory: 0.25,
        risk: 0.25,
        technical: 0.20,
        transparency: 0.15,
        optimization: 0.15,
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

    test('Valid input should return proper result object', async () => {
      const result = await calculateThematicScore(validInput);

      expect(result).toHaveProperty('scores');
      expect(result).toHaveProperty('weightedScoreBrut');
      expect(result).toHaveProperty('bonusPoints');
      expect(result).toHaveProperty('weightedScore');
      expect(result).toHaveProperty('gradeLetter');
      expect(result).toHaveProperty('executionId');
      expect(result).toHaveProperty('engineVersion');
      expect(result.engineVersion).toBe('v1.1_stable');
    });

    test('Perfect scores should have no bonus', async () => {
      const result = await calculateThematicScore(validInput);

      expect(result.scores.regulatory.score).toBe(100);
      expect(result.scores.risk.score).toBe(100);
      expect(result.scores.technical.score).toBe(100);
      expect(result.scores.transparency.score).toBe(100);
      expect(result.scores.optimization.score).toBe(100);
      expect(result.weightedScoreBrut).toBe(100);
      expect(result.bonusPoints).toBe(0);
      expect(result.weightedScore).toBe(100);
    });

    test('Score should be deterministic', async () => {
      const result1 = await calculateThematicScore(validInput);
      const result2 = await calculateThematicScore(validInput);
      const result3 = await calculateThematicScore(validInput);

      expect(result1.weightedScore).toBe(result2.weightedScore);
      expect(result2.weightedScore).toBe(result3.weightedScore);
      expect(result1.gradeLetter).toBe(result2.gradeLetter);
      expect(result2.gradeLetter).toBe(result3.gradeLetter);
    });

    test('Final score should never exceed 100', async () => {
      const input = {
        ...validInput,
        complexityWeights: {
          regulatory: 1.0,
          risk: 0,
          technical: 0,
          transparency: 0,
          optimization: 0,
        },
      };

      const result = await calculateThematicScore(input);
      expect(result.weightedScore).toBeLessThanOrEqual(100);
    });

    test('Final score should never be negative', async () => {
      const criticalInput = {
        ...validInput,
        analysisData: {
          regulatoryFindings: {
            missingClauses: Array(20).fill('Missing'),
            invalidReferences: Array(20).fill('Invalid'),
            nonCompliantItems: Array(20).fill('Non-compliant'),
          },
          riskFindings: {
            criticalRisks: Array(20).fill('Critical'),
            moderateRisks: Array(20).fill('Moderate'),
          },
          technicalFindings: {
            incoherences: Array(20).fill('Incoherence'),
            omissions: Array(20).fill('Omission'),
          },
          transparencyFindings: {
            unclearLines: Array(20).fill('Unclear'),
            missingDetails: Array(20).fill('Missing'),
          },
          optimizationFindings: {
            improvementOpportunities: Array(20).fill('Opportunity'),
          },
        },
      };

      const result = await calculateThematicScore(criticalInput);
      expect(result.weightedScore).toBeGreaterThanOrEqual(0);
    });

    test('Bonus should not modify theme scores', async () => {
      const input = {
        ...validInput,
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

      // Theme scores should be 100 (no findings)
      expect(result.scores.regulatory.score).toBe(100);
      expect(result.scores.risk.score).toBe(100);
      expect(result.scores.technical.score).toBe(100);
      expect(result.scores.transparency.score).toBe(100);
      expect(result.scores.optimization.score).toBe(100);
    });

    test('Should handle invalid input gracefully', async () => {
      const invalidInput = {
        projectId: 'PROJ-TEST',
        devisId: 'DV-TEST',
        complexityWeights: {
          regulatory: 0.5,
          risk: 0.5,
        },
        analysisData: validInput.analysisData,
      };

      await expect(calculateThematicScore(invalidInput)).rejects.toThrow();
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    test('Transparency score exactly 95 should trigger bonus', () => {
      const themeScores = {
        regulatory: { score: 80, breakdown: {} },
        risk: { score: 80, breakdown: {} },
        technical: { score: 80, breakdown: {} },
        transparency: { score: 95, breakdown: {} },
        optimization: { score: 80, breakdown: {} },
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
      expect(bonus.bonusBreakdown.transparencyExcellence.awarded).toBe(true);
    });

    test('Transparency score 94.99 should not trigger bonus', () => {
      const themeScores = {
        regulatory: { score: 80, breakdown: {} },
        risk: { score: 80, breakdown: {} },
        technical: { score: 80, breakdown: {} },
        transparency: { score: 94.99, breakdown: {} },
        optimization: { score: 80, breakdown: {} },
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
      expect(bonus.bonusBreakdown.transparencyExcellence.awarded).toBe(false);
    });

    test('Grade boundary at 45.00 should be D', () => {
      expect(determineGradeLetter(45.00)).toBe('D');
    });

    test('Grade boundary at 44.99 should be E', () => {
      expect(determineGradeLetter(44.99)).toBe('E');
    });

    test('Single finding should reduce score correctly', () => {
      const analysisData = {
        regulatoryFindings: {
          missingClauses: ['One clause'],
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
      };

      const scores = calculateThemeScores(analysisData);
      expect(scores.regulatory.score).toBe(97); // 100 - 3 (one missing clause)
    });
  });

  // ============================================================================
  // PERSISTENCE TESTS
  // ============================================================================

  describe('Persistence Interface', () => {
    test('Result should include all required fields for persistence', async () => {
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

      // Fields required for persistence
      expect(result).toHaveProperty('scores');
      expect(result).toHaveProperty('weightedScoreBrut');
      expect(result).toHaveProperty('bonusPoints');
      expect(result).toHaveProperty('bonusBreakdown');
      expect(result).toHaveProperty('weightedScore');
      expect(result).toHaveProperty('gradeLetter');
      expect(result).toHaveProperty('weights');
      expect(result).toHaveProperty('executionId');
      expect(result).toHaveProperty('engineVersion');
      expect(result).toHaveProperty('timestamp');
    });

    test('Bonus breakdown should be persistable as JSON', async () => {
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

      // Should be able to serialize to JSON without error
      const json = JSON.stringify(result.bonusBreakdown);
      expect(typeof json).toBe('string');
      expect(json.length).toBeGreaterThan(0);

      // Should be able to deserialize
      const parsed = JSON.parse(json);
      expect(parsed).toBeDefined();
    });
  });
});

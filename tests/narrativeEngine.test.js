/**
 * Test Suite - Audit Narrative Engine
 * Tests déterministes pour la génération de rapports narratifs
 */

const {
  generateAuditNarrative,
  performDeterministicAnalysis,
  generateNarrativeSections,
  generateExecutiveSummary,
  identifyRegulatoryReferences,
  validateAuditInput,
  NARRATIVE_RULES,
  REGULATORY_REFERENCES,
} = require('../src/engines/auditNarrativeEngine');

describe('Audit Narrative Engine', () => {
  // ============================================================================
  // VALIDATION TESTS
  // ============================================================================

  describe('Input Validation', () => {
    const validInput = {
      scoringProfile: {
        scores: {
          regulatory: { score: 80 },
          risk: { score: 75 },
          technical: { score: 85 },
          transparency: { score: 90 },
          optimization: { score: 80 },
        },
        weightedScore: 82.5,
        gradeLetter: 'B',
      },
      analysisData: {
        regulatoryFindings: { missingClauses: [], invalidReferences: [], nonCompliantItems: [] },
        riskFindings: { criticalRisks: [], moderateRisks: [] },
        technicalFindings: { incoherences: [], omissions: [] },
        transparencyFindings: { unclearLines: [], missingDetails: [] },
        optimizationFindings: { improvementOpportunities: [] },
      },
      projectContext: {
        projectId: 'PROJ-TEST',
        devisId: 'DV-TEST',
      },
      userProfile: {
        type: 'B2B',
      },
    };

    test('Valid input should pass validation', () => {
      const result = validateAuditInput(validInput);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('Missing scoringProfile should fail', () => {
      const invalid = { ...validInput };
      delete invalid.scoringProfile;
      const result = validateAuditInput(invalid);
      expect(result.isValid).toBe(false);
    });

    test('Invalid gradeLetter should fail', () => {
      const invalid = { ...validInput };
      invalid.scoringProfile.gradeLetter = 'F';
      const result = validateAuditInput(invalid);
      expect(result.isValid).toBe(false);
    });

    test('Invalid userProfile type should fail', () => {
      const invalid = { ...validInput };
      invalid.userProfile.type = 'B3B';
      const result = validateAuditInput(invalid);
      expect(result.isValid).toBe(false);
    });

    test('Missing projectContext should fail', () => {
      const invalid = { ...validInput };
      delete invalid.projectContext;
      const result = validateAuditInput(invalid);
      expect(result.isValid).toBe(false);
    });
  });

  // ============================================================================
  // DETERMINISTIC ANALYSIS TESTS
  // ============================================================================

  describe('Deterministic Analysis', () => {
    test('Regulatory score < 70 should trigger regulatory insight', () => {
      const scoringProfile = {
        scores: {
          regulatory: { score: 65 },
          risk: { score: 80 },
          technical: { score: 80 },
          transparency: { score: 80 },
          optimization: { score: 80 },
        },
        weightedScore: 77,
        gradeLetter: 'B',
      };

      const analysisData = {
        regulatoryFindings: { missingClauses: [], invalidReferences: [], nonCompliantItems: [] },
        riskFindings: { criticalRisks: [], moderateRisks: [] },
        technicalFindings: { incoherences: [], omissions: [] },
        transparencyFindings: { unclearLines: [], missingDetails: [] },
        optimizationFindings: { improvementOpportunities: [] },
      };

      const analysis = performDeterministicAnalysis(scoringProfile, analysisData);
      const hasRegulatoryInsight = analysis.keyInsights.some(
        insight => insight.theme === 'regulatory'
      );
      expect(hasRegulatoryInsight).toBe(true);
    });

    test('Risk score < 60 should trigger risk insight', () => {
      const scoringProfile = {
        scores: {
          regulatory: { score: 80 },
          risk: { score: 55 },
          technical: { score: 80 },
          transparency: { score: 80 },
          optimization: { score: 80 },
        },
        weightedScore: 75,
        gradeLetter: 'B',
      };

      const analysisData = {
        regulatoryFindings: { missingClauses: [], invalidReferences: [], nonCompliantItems: [] },
        riskFindings: { criticalRisks: [], moderateRisks: [] },
        technicalFindings: { incoherences: [], omissions: [] },
        transparencyFindings: { unclearLines: [], missingDetails: [] },
        optimizationFindings: { improvementOpportunities: [] },
      };

      const analysis = performDeterministicAnalysis(scoringProfile, analysisData);
      const hasRiskInsight = analysis.keyInsights.some(
        insight => insight.theme === 'risk'
      );
      expect(hasRiskInsight).toBe(true);
    });

    test('Transparency score > 85 should generate positive highlight', () => {
      const scoringProfile = {
        scores: {
          regulatory: { score: 80 },
          risk: { score: 80 },
          technical: { score: 80 },
          transparency: { score: 90 },
          optimization: { score: 80 },
        },
        weightedScore: 82,
        gradeLetter: 'B',
      };

      const analysisData = {
        regulatoryFindings: { missingClauses: [], invalidReferences: [], nonCompliantItems: [] },
        riskFindings: { criticalRisks: [], moderateRisks: [] },
        technicalFindings: { incoherences: [], omissions: [] },
        transparencyFindings: { unclearLines: [], missingDetails: [] },
        optimizationFindings: { improvementOpportunities: [] },
      };

      const analysis = performDeterministicAnalysis(scoringProfile, analysisData);
      const hasPositiveHighlight = analysis.positiveHighlights.some(
        h => h.theme === 'transparency'
      );
      expect(hasPositiveHighlight).toBe(true);
    });

    test('Grade A should generate excellence highlight', () => {
      const scoringProfile = {
        scores: {
          regulatory: { score: 95 },
          risk: { score: 95 },
          technical: { score: 95 },
          transparency: { score: 95 },
          optimization: { score: 95 },
        },
        weightedScore: 95,
        gradeLetter: 'A',
      };

      const analysisData = {
        regulatoryFindings: { missingClauses: [], invalidReferences: [], nonCompliantItems: [] },
        riskFindings: { criticalRisks: [], moderateRisks: [] },
        technicalFindings: { incoherences: [], omissions: [] },
        transparencyFindings: { unclearLines: [], missingDetails: [] },
        optimizationFindings: { improvementOpportunities: [] },
      };

      const analysis = performDeterministicAnalysis(scoringProfile, analysisData);
      const hasGlobalHighlight = analysis.positiveHighlights.some(
        h => h.theme === 'global'
      );
      expect(hasGlobalHighlight).toBe(true);
    });

    test('Grade C should identify axes for improvement', () => {
      const scoringProfile = {
        scores: {
          regulatory: { score: 50 },
          risk: { score: 50 },
          technical: { score: 50 },
          transparency: { score: 50 },
          optimization: { score: 50 },
        },
        weightedScore: 50,
        gradeLetter: 'C',
      };

      const analysisData = {
        regulatoryFindings: { missingClauses: [], invalidReferences: [], nonCompliantItems: [] },
        riskFindings: { criticalRisks: [], moderateRisks: [] },
        technicalFindings: { incoherences: [], omissions: [] },
        transparencyFindings: { unclearLines: [], missingDetails: [] },
        optimizationFindings: { improvementOpportunities: [] },
      };

      const analysis = performDeterministicAnalysis(scoringProfile, analysisData);
      const hasGlobalInsight = analysis.keyInsights.some(
        insight => insight.theme === 'global'
      );
      expect(hasGlobalInsight).toBe(true);
    });

    test('Analysis should be deterministic', () => {
      const scoringProfile = {
        scores: {
          regulatory: { score: 72 },
          risk: { score: 65 },
          technical: { score: 78 },
          transparency: { score: 81 },
          optimization: { score: 88 },
        },
        weightedScore: 76.8,
        gradeLetter: 'B',
      };

      const analysisData = {
        regulatoryFindings: { missingClauses: [], invalidReferences: [], nonCompliantItems: [] },
        riskFindings: { criticalRisks: [], moderateRisks: [] },
        technicalFindings: { incoherences: [], omissions: [] },
        transparencyFindings: { unclearLines: [], missingDetails: [] },
        optimizationFindings: { improvementOpportunities: [] },
      };

      const analysis1 = performDeterministicAnalysis(scoringProfile, analysisData);
      const analysis2 = performDeterministicAnalysis(scoringProfile, analysisData);
      const analysis3 = performDeterministicAnalysis(scoringProfile, analysisData);

      expect(analysis1.keyInsights.length).toBe(analysis2.keyInsights.length);
      expect(analysis2.keyInsights.length).toBe(analysis3.keyInsights.length);
      expect(analysis1.positiveHighlights.length).toBe(analysis2.positiveHighlights.length);
    });
  });

  // ============================================================================
  // NARRATIVE SECTIONS GENERATION
  // ============================================================================

  describe('Narrative Sections Generation', () => {
    test('B2B user should receive technical strengths', () => {
      const deterministicAnalysis = {
        keyInsights: [],
        actionItems: [],
        positiveHighlights: [],
      };

      const scores = {
        regulatory: { score: 80 },
        risk: { score: 70 },
        technical: { score: 75 },
        transparency: { score: 86 },
        optimization: { score: 78 },
      };

      const sections = generateNarrativeSections('B2B', deterministicAnalysis, scores);

      expect(sections.strengths).toBeDefined();
      expect(Array.isArray(sections.strengths)).toBe(true);
    });

    test('B2C user should receive pedagogical language', () => {
      const deterministicAnalysis = {
        keyInsights: [],
        actionItems: [],
        positiveHighlights: [],
      };

      const scores = {
        regulatory: { score: 80 },
        risk: { score: 70 },
        technical: { score: 75 },
        transparency: { score: 86 },
        optimization: { score: 78 },
      };

      const sections = generateNarrativeSections('B2C', deterministicAnalysis, scores);

      expect(sections.strengths).toBeDefined();
      expect(Array.isArray(sections.strengths)).toBe(true);
    });

    test('Low regulatory score should generate weakness', () => {
      const deterministicAnalysis = {
        keyInsights: [],
        actionItems: [],
        positiveHighlights: [],
      };

      const scores = {
        regulatory: { score: 65 },
        risk: { score: 70 },
        technical: { score: 75 },
        transparency: { score: 86 },
        optimization: { score: 78 },
      };

      const sections = generateNarrativeSections('B2B', deterministicAnalysis, scores);

      expect(sections.weaknesses.length).toBeGreaterThan(0);
    });

    test('High transparency should generate strength', () => {
      const deterministicAnalysis = {
        keyInsights: [],
        actionItems: [],
        positiveHighlights: [],
      };

      const scores = {
        regulatory: { score: 80 },
        risk: { score: 70 },
        technical: { score: 75 },
        transparency: { score: 90 },
        optimization: { score: 78 },
      };

      const sections = generateNarrativeSections('B2B', deterministicAnalysis, scores);

      expect(sections.strengths.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // EXECUTIVE SUMMARY GENERATION
  // ============================================================================

  describe('Executive Summary Generation', () => {
    test('B2B grade A should mention excellence', () => {
      const summary = generateExecutiveSummary(
        { weightedScore: 95, gradeLetter: 'A' },
        'B2B',
        { projectId: 'PROJ-1', devisId: 'DV-1' }
      );

      expect(summary).toContain('excellence');
    });

    test('B2C grade A should be reassuring', () => {
      const summary = generateExecutiveSummary(
        { weightedScore: 95, gradeLetter: 'A' },
        'B2C',
        { projectId: 'PROJ-1', devisId: 'DV-1' }
      );

      expect(summary).toContain('Excellent');
    });

    test('B2B grade D should mention intervention', () => {
      const summary = generateExecutiveSummary(
        { weightedScore: 35, gradeLetter: 'D' },
        'B2B',
        { projectId: 'PROJ-1', devisId: 'DV-1' }
      );

      expect(summary.toLowerCase()).toContain('intervention');
    });

    test('B2C grade D should offer guidance', () => {
      const summary = generateExecutiveSummary(
        { weightedScore: 35, gradeLetter: 'D' },
        'B2C',
        { projectId: 'PROJ-1', devisId: 'DV-1' }
      );

      expect(summary.toLowerCase()).toContain('attention');
    });

    test('Executive summary should include devis info', () => {
      const summary = generateExecutiveSummary(
        { weightedScore: 85, gradeLetter: 'A' },
        'B2B',
        { projectId: 'PROJ-ABC', devisId: 'DV-XYZ' }
      );

      expect(summary).toContain('DV-XYZ');
    });
  });

  // ============================================================================
  // REGULATORY REFERENCES IDENTIFICATION
  // ============================================================================

  describe('Regulatory References Identification', () => {
    test('RGPD should be identified when RGPD mentioned', () => {
      const analysisData = {
        regulatoryFindings: {
          nonCompliantItems: ['Absence de mention RGPD'],
        },
        technicalFindings: {},
      };

      const references = identifyRegulatoryReferences(analysisData, {
        regulatory: { score: 70 },
      });

      const hasRGPD = references.some(ref => ref.shortCode === 'RGPD');
      expect(hasRGPD).toBe(true);
    });

    test('Should return at least one reference', () => {
      const analysisData = {
        regulatoryFindings: {
          nonCompliantItems: ['Item'],
        },
        riskFindings: {},
        technicalFindings: {},
      };

      const references = identifyRegulatoryReferences(analysisData, {
        regulatory: { score: 70 },
      });

      expect(references.length).toBeGreaterThan(0);
    });

    test('References should have required fields', () => {
      const analysisData = {
        regulatoryFindings: {
          nonCompliantItems: ['Item'],
        },
        riskFindings: {},
        technicalFindings: {},
      };

      const references = identifyRegulatoryReferences(analysisData, {
        regulatory: { score: 70 },
      });

      references.forEach(ref => {
        expect(ref).toHaveProperty('shortCode');
        expect(ref).toHaveProperty('title');
        expect(ref).toHaveProperty('reason');
      });
    });
  });

  // ============================================================================
  // FULL INTEGRATION TESTS
  // ============================================================================

  describe('Complete Narrative Pipeline (Integration)', () => {
    const validInput = {
      scoringProfile: {
        scores: {
          regulatory: { score: 72, breakdown: {} },
          risk: { score: 65, breakdown: {} },
          technical: { score: 78, breakdown: {} },
          transparency: { score: 81, breakdown: {} },
          optimization: { score: 88, breakdown: {} },
        },
        weightedScore: 76.8,
        gradeLetter: 'B',
      },
      analysisData: {
        regulatoryFindings: {
          missingClauses: ['Clause 1'],
          invalidReferences: [],
          nonCompliantItems: [],
        },
        riskFindings: {
          criticalRisks: [],
          moderateRisks: ['Risk 1'],
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
      projectContext: {
        projectId: 'PROJ-TEST',
        devisId: 'DV-TEST-001',
        projectName: 'Test Project',
      },
      userProfile: {
        type: 'B2B',
      },
    };

    test('Should generate complete report with all sections', async () => {
      const report = await generateAuditNarrative(validInput);

      expect(report).toHaveProperty('executiveSummary');
      expect(report).toHaveProperty('strengths');
      expect(report).toHaveProperty('weaknesses');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('detailedAnalysis');
      expect(report).toHaveProperty('regulatoryReferences');
      expect(report).toHaveProperty('auditId');
      expect(report).toHaveProperty('timestamp');
    });

    test('Report should never modify scoring data', async () => {
      const originalScore = validInput.scoringProfile.weightedScore;
      const originalGrade = validInput.scoringProfile.gradeLetter;

      const report = await generateAuditNarrative(validInput);

      expect(report.scoringProfile.weightedScore).toBe(originalScore);
      expect(report.scoringProfile.gradeLetter).toBe(originalGrade);
    });

    test('Report should include original scoring profile', async () => {
      const report = await generateAuditNarrative(validInput);

      expect(report.scoringProfile).toEqual(validInput.scoringProfile);
    });

    test('Narrative should be deterministic', async () => {
      const report1 = await generateAuditNarrative(validInput);
      const report2 = await generateAuditNarrative(validInput);

      expect(report1.strengths).toEqual(report2.strengths);
      expect(report1.weaknesses).toEqual(report2.weaknesses);
    });

    test('B2B and B2C should produce different narratives', async () => {
      const b2bInput = { ...validInput, userProfile: { type: 'B2B' } };
      const b2cInput = { ...validInput, userProfile: { type: 'B2C' } };

      const b2bReport = await generateAuditNarrative(b2bInput);
      const b2cReport = await generateAuditNarrative(b2cInput);

      // The summaries should differ in tone
      expect(b2bReport.executiveSummary).not.toBe(b2cReport.executiveSummary);
    });

    test('Invalid input should throw error', async () => {
      const invalidInput = {
        scoringProfile: {
          scores: {},
          weightedScore: 50,
          gradeLetter: 'F', // Invalid grade
        },
        analysisData: {},
        projectContext: {},
        userProfile: { type: 'B2B' },
      };

      await expect(generateAuditNarrative(invalidInput)).rejects.toThrow();
    });
  });

  // ============================================================================
  // NARRATIVE INTEGRITY TESTS
  // ============================================================================

  describe('Narrative Integrity', () => {
    test('Report should never modify input scoring profile', async () => {
      const input = {
        scoringProfile: {
          scores: {
            regulatory: { score: 80, breakdown: {} },
            risk: { score: 75, breakdown: {} },
            technical: { score: 85, breakdown: {} },
            transparency: { score: 90, breakdown: {} },
            optimization: { score: 80, breakdown: {} },
          },
          weightedScore: 82.0,
          gradeLetter: 'B',
        },
        analysisData: {
          regulatoryFindings: { missingClauses: [], invalidReferences: [], nonCompliantItems: [] },
          riskFindings: { criticalRisks: [], moderateRisks: [] },
          technicalFindings: { incoherences: [], omissions: [] },
          transparencyFindings: { unclearLines: [], missingDetails: [] },
          optimizationFindings: { improvementOpportunities: [] },
        },
        projectContext: {
          projectId: 'PROJ-TEST',
          devisId: 'DV-TEST',
        },
        userProfile: {
          type: 'B2B',
        },
      };

      const originalScores = JSON.stringify(input.scoringProfile.scores);

      await generateAuditNarrative(input);

      expect(JSON.stringify(input.scoringProfile.scores)).toBe(originalScores);
    });

    test('Theme scores in report should match input exactly', async () => {
      const input = {
        scoringProfile: {
          scores: {
            regulatory: { score: 88, breakdown: { test: 'data' } },
            risk: { score: 92, breakdown: { test: 'data' } },
            technical: { score: 85, breakdown: { test: 'data' } },
            transparency: { score: 96, breakdown: { test: 'data' } },
            optimization: { score: 82, breakdown: { test: 'data' } },
          },
          weightedScore: 88.6,
          gradeLetter: 'A',
        },
        analysisData: {
          regulatoryFindings: { missingClauses: [], invalidReferences: [], nonCompliantItems: [] },
          riskFindings: { criticalRisks: [], moderateRisks: [] },
          technicalFindings: { incoherences: [], omissions: [] },
          transparencyFindings: { unclearLines: [], missingDetails: [] },
          optimizationFindings: { improvementOpportunities: [] },
        },
        projectContext: {
          projectId: 'PROJ-TEST',
          devisId: 'DV-TEST',
        },
        userProfile: {
          type: 'B2B',
        },
      };

      const report = await generateAuditNarrative(input);

      expect(report.scoringProfile.scores.regulatory.score).toBe(88);
      expect(report.scoringProfile.scores.risk.score).toBe(92);
      expect(report.scoringProfile.scores.technical.score).toBe(85);
      expect(report.scoringProfile.scores.transparency.score).toBe(96);
      expect(report.scoringProfile.scores.optimization.score).toBe(82);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    test('Grade A with perfect scores should celebrate excellence', async () => {
      const input = {
        scoringProfile: {
          scores: {
            regulatory: { score: 100, breakdown: {} },
            risk: { score: 100, breakdown: {} },
            technical: { score: 100, breakdown: {} },
            transparency: { score: 100, breakdown: {} },
            optimization: { score: 100, breakdown: {} },
          },
          weightedScore: 100,
          gradeLetter: 'A',
        },
        analysisData: {
          regulatoryFindings: { missingClauses: [], invalidReferences: [], nonCompliantItems: [] },
          riskFindings: { criticalRisks: [], moderateRisks: [] },
          technicalFindings: { incoherences: [], omissions: [] },
          transparencyFindings: { unclearLines: [], missingDetails: [] },
          optimizationFindings: { improvementOpportunities: [] },
        },
        projectContext: {
          projectId: 'PROJ-PERFECT',
          devisId: 'DV-PERFECT',
        },
        userProfile: {
          type: 'B2B',
        },
      };

      const report = await generateAuditNarrative(input);

      expect(report.strengths.length).toBeGreaterThan(0);
    });

    test('Grade E with all critical findings should flag concerns', async () => {
      const input = {
        scoringProfile: {
          scores: {
            regulatory: { score: 20, breakdown: {} },
            risk: { score: 10, breakdown: {} },
            technical: { score: 30, breakdown: {} },
            transparency: { score: 25, breakdown: {} },
            optimization: { score: 15, breakdown: {} },
          },
          weightedScore: 20,
          gradeLetter: 'E',
        },
        analysisData: {
          regulatoryFindings: {
            missingClauses: Array(5).fill('Missing'),
            invalidReferences: Array(5).fill('Invalid'),
            nonCompliantItems: Array(5).fill('Non-compliant'),
          },
          riskFindings: {
            criticalRisks: Array(5).fill('Critical'),
            moderateRisks: Array(5).fill('Moderate'),
          },
          technicalFindings: {
            incoherences: Array(5).fill('Incoherence'),
            omissions: Array(5).fill('Omission'),
          },
          transparencyFindings: {
            unclearLines: Array(5).fill('Unclear'),
            missingDetails: Array(5).fill('Missing'),
          },
          optimizationFindings: {
            improvementOpportunities: Array(5).fill('Opportunity'),
          },
        },
        projectContext: {
          projectId: 'PROJ-CRITICAL',
          devisId: 'DV-CRITICAL',
        },
        userProfile: {
          type: 'B2B',
        },
      };

      const report = await generateAuditNarrative(input);

      expect(report.weaknesses.length).toBeGreaterThan(0);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    test('Boundary score 85.00 should be grade A', async () => {
      const input = {
        scoringProfile: {
          scores: {
            regulatory: { score: 85, breakdown: {} },
            risk: { score: 85, breakdown: {} },
            technical: { score: 85, breakdown: {} },
            transparency: { score: 85, breakdown: {} },
            optimization: { score: 85, breakdown: {} },
          },
          weightedScore: 85.0,
          gradeLetter: 'A',
        },
        analysisData: {
          regulatoryFindings: { missingClauses: [], invalidReferences: [], nonCompliantItems: [] },
          riskFindings: { criticalRisks: [], moderateRisks: [] },
          technicalFindings: { incoherences: [], omissions: [] },
          transparencyFindings: { unclearLines: [], missingDetails: [] },
          optimizationFindings: { improvementOpportunities: [] },
        },
        projectContext: {
          projectId: 'PROJ-BOUNDARY',
          devisId: 'DV-BOUNDARY',
        },
        userProfile: {
          type: 'B2B',
        },
      };

      const report = await generateAuditNarrative(input);

      expect(report.scoringProfile.gradeLetter).toBe('A');
    });
  });
});

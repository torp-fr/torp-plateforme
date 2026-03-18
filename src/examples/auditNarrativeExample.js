/**
 * Example Usage - Audit Narrative Engine
 * Démonstration complète du moteur de rapport d'audit narratif
 *
 * @module auditNarrativeExample
 */

const { generateAuditNarrative } = require('../engines/auditNarrativeEngine');
const { createAuditReportPersistenceAdapter } = require('../adapters/auditReportPersistenceAdapter');

/**
 * Exemple d'audit B2B avec devis complexe
 */
async function exampleB2BAudit() {
  const input = {
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
        missingClauses: [
          'Clause de confidentialité détaillée',
          'Clause de résiliation anticipée',
        ],
        invalidReferences: ['Référence à loi LOLF non applicable au privé'],
        nonCompliantItems: [
          'Absence de mention RGPD explicite',
        ],
      },
      riskFindings: {
        criticalRisks: [],
        moderateRisks: [
          'Absence de plan de continuité de service',
          'Responsabilité en cas de perte de données insuffisamment couverte',
        ],
      },
      technicalFindings: {
        incoherences: ['SLA 99.9% en haute disponibilité mais pas de redondance mentionnée'],
        omissions: [
          'Détails d\'infrastructure',
        ],
      },
      transparencyFindings: {
        unclearLines: ['Définition de "mise à disposition" ambiguë'],
        missingDetails: [
          'Processus de support peu précis',
        ],
      },
      optimizationFindings: {
        improvementOpportunities: [
          'Intégration API pour automatisation',
          'Cache applicatif recommandé',
        ],
      },
    },
    projectContext: {
      projectId: 'PROJ-2024-B2B-001',
      devisId: 'DV-2024-B2B-98765',
      projectName: 'Infrastructure Cloud Entreprise',
      industry: 'Technologie',
      isPublicMarket: false,
      includesOnSiteWork: false,
    },
    userProfile: {
      type: 'B2B',
      role: 'Responsable Procurement',
      company: 'TechCorp SA',
    },
  };

  try {
    const report = await generateAuditNarrative(input);

    console.log('\n=== RAPPORT D\'AUDIT B2B ===\n');
    console.log(`Projet: ${input.projectContext.projectName}`);
    console.log(`Devis: ${input.projectContext.devisId}`);
    console.log(`Grade: ${report.scoringProfile.gradeLetter}`);
    console.log(`Score: ${report.scoringProfile.weightedScore}/100\n`);

    console.log('RÉSUMÉ EXÉCUTIF:');
    console.log(report.executiveSummary);
    console.log('\nFORCES:');
    report.strengths.forEach(strength => console.log(`  ✓ ${strength}`));
    console.log('\nFAIBLESSES:');
    report.weaknesses.forEach(weakness => console.log(`  ✗ ${weakness}`));

    console.log('\nRECOMMANDATIONS:');
    report.recommendations.forEach(rec => {
      console.log(`  • [${rec.priority}] ${rec.text}`);
    });

    console.log('\nRÉFÉRENCES RÉGLEMENTAIRES:');
    report.regulatoryReferences.forEach(ref => {
      console.log(`  • ${ref.shortCode}: ${ref.title}`);
      console.log(`    Raison: ${ref.reason}`);
    });

    return report;
  } catch (error) {
    console.error('Erreur:', error.message);
    throw error;
  }
}

/**
 * Exemple d'audit B2C avec devis résidentiel
 */
async function exampleB2CAudit() {
  const input = {
    scoringProfile: {
      scores: {
        regulatory: { score: 62, breakdown: {} },
        risk: { score: 55, breakdown: {} },
        technical: { score: 68, breakdown: {} },
        transparency: { score: 59, breakdown: {} },
        optimization: { score: 45, breakdown: {} },
      },
      weightedScore: 57.8,
      gradeLetter: 'C',
    },
    analysisData: {
      regulatoryFindings: {
        missingClauses: [
          'Garantie décennale non détaillée',
          'Clause de responsabilité civile manquante',
        ],
        invalidReferences: [],
        nonCompliantItems: [
          'Absence de délai de rétractation mentionné',
        ],
      },
      riskFindings: {
        criticalRisks: [],
        moderateRisks: [
          'Aucune assurance décennale menée',
          'Responsabilité en cas de défaut non couvertes',
        ],
      },
      technicalFindings: {
        incoherences: [],
        omissions: [
          'Matériaux utilisés peu précisés',
          'Planning de réalisation absent',
        ],
      },
      transparencyFindings: {
        unclearLines: [
          'Conditions de paiement peu claires (échelonnement?)',
          'Garantie: durée et couverture?',
        ],
        missingDetails: [
          'Modalités d\'accès au chantier',
          'Qui fournit les matériaux?',
        ],
      },
      optimizationFindings: {
        improvementOpportunities: [
          'Plans détaillés manquants',
        ],
      },
    },
    projectContext: {
      projectId: 'PROJ-2024-B2C-042',
      devisId: 'DV-2024-B2C-12345',
      projectName: 'Rénovation salle de bain',
      industry: 'Bâtiment - Résidentiel',
      isPublicMarket: false,
      includesOnSiteWork: true,
    },
    userProfile: {
      type: 'B2C',
      role: 'Propriétaire',
      company: null,
    },
  };

  try {
    const report = await generateAuditNarrative(input);

    console.log('\n=== RAPPORT D\'AUDIT B2C ===\n');
    console.log(`Projet: ${input.projectContext.projectName}`);
    console.log(`Devis: ${input.projectContext.devisId}`);
    console.log(`Avis: ${report.scoringProfile.gradeLetter}`);
    console.log(`Confiance: ${report.scoringProfile.weightedScore}/100\n`);

    console.log('ANALYSE:');
    console.log(report.executiveSummary);
    console.log('\nCE QUI VA BIEN:');
    report.strengths.forEach(strength => console.log(`  ✓ ${strength}`));
    console.log('\nCE QUI MÉRITE ATTENTION:');
    report.weaknesses.forEach(weakness => console.log(`  ⚠ ${weakness}`));

    console.log('\nNOS CONSEILS:');
    report.recommendations.forEach(rec => {
      console.log(`  → ${rec.text}`);
    });

    return report;
  } catch (error) {
    console.error('Erreur:', error.message);
    throw error;
  }
}

/**
 * Exemple d'audit A-grade avec devis excellent
 */
async function exampleExcellentAudit() {
  const input = {
    scoringProfile: {
      scores: {
        regulatory: { score: 95, breakdown: {} },
        risk: { score: 92, breakdown: {} },
        technical: { score: 88, breakdown: {} },
        transparency: { score: 96, breakdown: {} },
        optimization: { score: 91, breakdown: {} },
      },
      weightedScore: 92.4,
      gradeLetter: 'A',
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
        improvementOpportunities: [
          'Intégration avec outils tiers possible',
        ],
      },
    },
    projectContext: {
      projectId: 'PROJ-2024-EXCELLENT',
      devisId: 'DV-2024-PERFECT-99999',
      projectName: 'Infrastructure Enterprise Cloud Complète',
      industry: 'Technologie',
      isPublicMarket: false,
      includesOnSiteWork: false,
    },
    userProfile: {
      type: 'B2B',
      role: 'CTO',
      company: 'Fortune 500 Corp',
    },
  };

  try {
    const report = await generateAuditNarrative(input);

    console.log('\n=== RAPPORT D\'AUDIT EXCELLENT ===\n');
    console.log(`Projet: ${input.projectContext.projectName}`);
    console.log(`Grade: ${report.scoringProfile.gradeLetter} - Score: ${report.scoringProfile.weightedScore}/100\n`);

    console.log('✓ ' + report.executiveSummary);

    return report;
  } catch (error) {
    console.error('Erreur:', error.message);
    throw error;
  }
}

/**
 * Exemple d'audit critique avec devis problématique
 */
async function exampleCriticalAudit() {
  const input = {
    scoringProfile: {
      scores: {
        regulatory: { score: 35, breakdown: {} },
        risk: { score: 28, breakdown: {} },
        technical: { score: 45, breakdown: {} },
        transparency: { score: 32, breakdown: {} },
        optimization: { score: 20, breakdown: {} },
      },
      weightedScore: 32.0,
      gradeLetter: 'E',
    },
    analysisData: {
      regulatoryFindings: {
        missingClauses: [
          'Clause RGPD',
          'Clause de confidentialité',
          'Clause de responsabilité',
          'Clause de résiliation',
          'Clause SLA',
        ],
        invalidReferences: [
          'Référence à lois obsolètes',
          'Référence à décrets abrogés',
        ],
        nonCompliantItems: [
          'Absence totale de conformité RGPD',
          'Non-respect des délais de paiement légaux',
          'Clauses d\'exonération illégales',
        ],
      },
      riskFindings: {
        criticalRisks: [
          'Aucune assurance responsabilité civile mentionnée',
          'Risque de perte complète des données',
          'Responsabilité exclusive du client impossible',
        ],
        moderateRisks: [
          'Pas de plan de continuité de service',
          'Mécanisme d\'escalade absent',
        ],
      },
      technicalFindings: {
        incoherences: [
          'SLA 99.99% avec infrastructure simple',
          'Chiffrement non-mentionné malgré données sensibles',
        ],
        omissions: [
          'Aucun détail technique fourni',
          'Architecture complètement absente',
          'Monitoring totalement absent',
        ],
      },
      transparencyFindings: {
        unclearLines: [
          'Définitions vagues de tous les termes clés',
          'Responsabilités complètement flues',
        ],
        missingDetails: [
          'Aucun détail sur les tarifs',
          'Processus de facturation mystérieux',
        ],
      },
      optimizationFindings: {
        improvementOpportunities: [],
      },
    },
    projectContext: {
      projectId: 'PROJ-2024-CRITICAL',
      devisId: 'DV-2024-RED-FLAG-00001',
      projectName: 'Contrat Cloud Suspect',
      industry: 'Technologie',
      isPublicMarket: false,
      includesOnSiteWork: false,
    },
    userProfile: {
      type: 'B2B',
      role: 'Responsable Légal',
      company: 'Risk-Aware Corp',
    },
  };

  try {
    const report = await generateAuditNarrative(input);

    console.log('\n=== ⚠ RAPPORT D\'AUDIT CRITIQUE ⚠ ===\n');
    console.log(`Projet: ${input.projectContext.projectName}`);
    console.log(`Grade: ${report.scoringProfile.gradeLetter} - Score: ${report.scoringProfile.weightedScore}/100\n`);

    console.log('🚨 ' + report.executiveSummary);

    console.log('\nFAIBLESSES CRITIQUES:');
    report.weaknesses.forEach(weakness => console.log(`  ❌ ${weakness}`));

    console.log('\nACTIONS REQUISES:');
    report.recommendations.forEach(rec => {
      console.log(`  [${rec.priority}] ${rec.text}`);
    });

    return report;
  } catch (error) {
    console.error('Erreur:', error.message);
    throw error;
  }
}

/**
 * Exemple avec persistence en base de données
 */
async function exampleWithPersistence(databaseClient) {
  const input = {
    scoringProfile: {
      scores: {
        regulatory: { score: 80, breakdown: {} },
        risk: { score: 75, breakdown: {} },
        technical: { score: 82, breakdown: {} },
        transparency: { score: 86, breakdown: {} },
        optimization: { score: 78, breakdown: {} },
      },
      weightedScore: 80.2,
      gradeLetter: 'A',
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
    projectContext: {
      projectId: 'PROJ-2024-PERSIST',
      devisId: 'DV-2024-PERSIST-77777',
      projectName: 'Test Persistence',
      industry: 'Test',
    },
    userProfile: {
      type: 'B2B',
      role: 'Test Role',
    },
  };

  const persistenceAdapter = createAuditReportPersistenceAdapter(databaseClient);

  try {
    const report = await generateAuditNarrative(input, {
      persistenceAdapter,
    });

    console.log('✓ Rapport généré et persisté avec succès');
    console.log(`Audit ID: ${report.auditId}`);
    console.log(`Grade: ${report.scoringProfile.gradeLetter}`);

    return report;
  } catch (error) {
    console.error('Erreur:', error.message);
    throw error;
  }
}

/**
 * Exemple d'analyse comparative multi-devis
 */
async function exampleComparativeAnalysis() {
  console.log('\n=== ANALYSE COMPARATIVE MULTI-DEVIS ===\n');

  const scenarios = [
    {
      name: 'Devis Standard',
      score: 72.5,
      grade: 'B',
    },
    {
      name: 'Devis Premium',
      score: 88.3,
      grade: 'A',
    },
    {
      name: 'Devis Économique',
      score: 48.2,
      grade: 'D',
    },
    {
      name: 'Devis Concurrence',
      score: 65.9,
      grade: 'C',
    },
  ];

  scenarios.forEach((scenario, index) => {
    console.log(`${index + 1}. ${scenario.name}`);
    console.log(`   Score: ${scenario.score}/100`);
    console.log(`   Grade: ${scenario.grade}`);
    if (scenario.grade <= 'C') {
      console.log(`   ⚠️ Attention: modifications requises`);
    }
    console.log();
  });

  // Identifier le meilleur devis
  const best = scenarios.reduce((prev, current) =>
    current.score > prev.score ? current : prev
  );
  console.log(`\n✓ Recommandation: ${best.name} (Score: ${best.score}, Grade: ${best.grade})`);
}

/**
 * Export des exemples
 */
module.exports = {
  exampleB2BAudit,
  exampleB2CAudit,
  exampleExcellentAudit,
  exampleCriticalAudit,
  exampleWithPersistence,
  exampleComparativeAnalysis,
};

// Exécution si appelé directement
if (require.main === module) {
  (async () => {
    try {
      await exampleB2BAudit();
      await exampleB2CAudit();
      await exampleExcellentAudit();
      await exampleCriticalAudit();
      await exampleComparativeAnalysis();
    } catch (error) {
      console.error('Erreur:', error);
      process.exit(1);
    }
  })();
}

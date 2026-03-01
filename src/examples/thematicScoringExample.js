/**
 * Example Usage - Thematic Scoring Engine
 * Démonstration complète du moteur de scoring thématique
 *
 * @module thematicScoringExample
 */

const { calculateThematicScore } = require('../engines/thematicScoringEngine');
const { createScoringPersistenceAdapter } = require('../adapters/scoringPersistenceAdapter');

/**
 * Exemple complet avec données structurées
 */
async function exampleBasicUsage() {
  const input = {
    projectId: 'PROJ-2024-001',
    devisId: 'DV-2024-12345',
    complexityWeights: {
      regulatory: 0.25,
      risk: 0.25,
      technical: 0.20,
      transparency: 0.15,
      optimization: 0.15,
    },
    analysisData: {
      regulatoryFindings: {
        missingClauses: [
          'Clause de confidentialité manquante',
          'Clause de délai de rétention absente',
        ],
        invalidReferences: [
          'Référence à loi obsolète',
        ],
        nonCompliantItems: [
          'Absence de conformité RGPD',
          'Non-respect SLA légaux',
        ],
      },
      riskFindings: {
        criticalRisks: [
          'Risque de continuité de service non adressé',
        ],
        moderateRisks: [
          'Gestion des incidents insuffisante',
          'Plan de secours inadéquat',
        ],
      },
      technicalFindings: {
        incoherences: [
          'Infrastructure décrite incompatible avec charges',
          'API non-versionnée',
        ],
        omissions: [
          'Stratégie de cache manquante',
          'Monitoring absent',
        ],
      },
      transparencyFindings: {
        unclearLines: [
          'SLA formulation ambiguë',
          'Processus de facturation peu clair',
        ],
        missingDetails: [
          'Détails de support incomplets',
          'Escalade procédure manquante',
        ],
      },
      optimizationFindings: {
        improvementOpportunities: [
          'Compression de payload possible',
          'Batch processing envisageable',
          'Migration cloud recommandée',
        ],
      },
    },
  };

  try {
    const result = await calculateThematicScore(input);

    console.log('\n=== RÉSULTAT DU SCORING THÉMATIQUE ===\n');
    console.log(`Projet: ${input.projectId}`);
    console.log(`Devis: ${input.devisId}\n`);

    console.log('SCORES THÉMATIQUES:');
    console.log(`  • Conformité Réglementaire: ${result.scores.regulatory.score}/100`);
    console.log(`  • Gestion des Risques: ${result.scores.risk.score}/100`);
    console.log(`  • Cohérence Technique: ${result.scores.technical.score}/100`);
    console.log(`  • Transparence: ${result.scores.transparency.score}/100`);
    console.log(`  • Optimisation: ${result.scores.optimization.score}/100\n`);

    console.log(`SCORE PONDÉRÉ GLOBAL: ${result.weightedScore}/100`);
    console.log(`GRADE: ${result.gradeLetter}`);
    console.log(`\nExecution ID: ${result.executionId}`);
    console.log(`Timestamp: ${result.timestamp}`);

    return result;
  } catch (error) {
    console.error('Erreur lors du scoring:', error.message);
    throw error;
  }
}

/**
 * Exemple avec persistence en base de données
 */
async function exampleWithPersistence(databaseClient) {
  const input = {
    projectId: 'PROJ-2024-002',
    devisId: 'DV-2024-54321',
    complexityWeights: {
      regulatory: 0.30,
      risk: 0.30,
      technical: 0.15,
      transparency: 0.15,
      optimization: 0.10,
    },
    analysisData: {
      regulatoryFindings: {
        missingClauses: ['Clause de résiliation'],
        invalidReferences: [],
        nonCompliantItems: ['Conformité partielle RGPD'],
      },
      riskFindings: {
        criticalRisks: [],
        moderateRisks: ['Backup insuffisant'],
      },
      technicalFindings: {
        incoherences: [],
        omissions: ['Documentation incomplète'],
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

  // Créer l'adaptateur de persistence
  const persistenceAdapter = createScoringPersistenceAdapter(databaseClient);

  try {
    const result = await calculateThematicScore(input, {
      persistenceAdapter,
    });

    console.log('✓ Scoring calculé et persisté avec succès');
    console.log(`Score pondéré: ${result.weightedScore}`);
    console.log(`Grade: ${result.gradeLetter}`);

    return result;
  } catch (error) {
    console.error('Erreur:', error.message);
    throw error;
  }
}

/**
 * Exemple avec différentes pondérations
 */
async function exampleDifferentWeights() {
  const baseInput = {
    projectId: 'PROJ-2024-003',
    devisId: 'DV-2024-99999',
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

  // Scénario 1: Pondération équilibrée
  const scenario1 = {
    ...baseInput,
    complexityWeights: {
      regulatory: 0.2,
      risk: 0.2,
      technical: 0.2,
      transparency: 0.2,
      optimization: 0.2,
    },
  };

  // Scénario 2: Focus sur compliance
  const scenario2 = {
    ...baseInput,
    projectId: 'PROJ-2024-004',
    devisId: 'DV-2024-88888',
    complexityWeights: {
      regulatory: 0.40,
      risk: 0.30,
      technical: 0.10,
      transparency: 0.10,
      optimization: 0.10,
    },
  };

  console.log('\n=== COMPARAISON DE SCÉNARIOS ===\n');

  const result1 = await calculateThematicScore(scenario1);
  console.log(`Scénario 1 (Équilibré): ${result1.weightedScore} - Grade ${result1.gradeLetter}`);

  const result2 = await calculateThematicScore(scenario2);
  console.log(`Scénario 2 (Focus Compliance): ${result2.weightedScore} - Grade ${result2.gradeLetter}`);
}

/**
 * Exemple de détection de cas limites
 */
async function exampleEdgeCases() {
  console.log('\n=== TESTS CAS LIMITES ===\n');

  // Test 1: Perfect score
  const perfectInput = {
    projectId: 'PROJ-PERFECT',
    devisId: 'DV-PERFECT',
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

  const perfect = await calculateThematicScore(perfectInput);
  console.log(`✓ Perfect Score: ${perfect.weightedScore} (expected: 100.00, grade: A)`);

  // Test 2: Worst case score
  const worstInput = {
    projectId: 'PROJ-WORST',
    devisId: 'DV-WORST',
    complexityWeights: {
      regulatory: 0.2,
      risk: 0.2,
      technical: 0.2,
      transparency: 0.2,
      optimization: 0.2,
    },
    analysisData: {
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
    },
  };

  const worst = await calculateThematicScore(worstInput);
  console.log(`✓ Worst Case: ${worst.weightedScore} (minimum: 0.00, grade: E)`);
}

/**
 * Test de validation des erreurs
 */
async function exampleErrorHandling() {
  console.log('\n=== GESTION DES ERREURS ===\n');

  // Test 1: Poids invalides
  try {
    await calculateThematicScore({
      projectId: 'TEST',
      devisId: 'TEST',
      complexityWeights: {
        regulatory: 0.5,
        risk: 0.5,
        technical: 0.5, // Somme > 1
        transparency: 0.2,
        optimization: 0.2,
      },
      analysisData: {
        regulatoryFindings: { missingClauses: [], invalidReferences: [], nonCompliantItems: [] },
        riskFindings: { criticalRisks: [], moderateRisks: [] },
        technicalFindings: { incoherences: [], omissions: [] },
        transparencyFindings: { unclearLines: [], missingDetails: [] },
        optimizationFindings: { improvementOpportunities: [] },
      },
    });
  } catch (error) {
    console.log(`✓ Validation poids: ${error.message.substring(0, 50)}...`);
  }

  // Test 2: Données manquantes
  try {
    await calculateThematicScore({
      projectId: 'TEST',
      devisId: 'TEST',
      complexityWeights: {
        regulatory: 0.2,
        risk: 0.2,
        technical: 0.2,
        transparency: 0.2,
        optimization: 0.2,
      },
      analysisData: {
        regulatoryFindings: { missingClauses: [], invalidReferences: [], nonCompliantItems: [] },
        // riskFindings manquant!
        technicalFindings: { incoherences: [], omissions: [] },
        transparencyFindings: { unclearLines: [], missingDetails: [] },
        optimizationFindings: { improvementOpportunities: [] },
      },
    });
  } catch (error) {
    console.log(`✓ Validation données: ${error.message.substring(0, 50)}...`);
  }
}

/**
 * Export des exemples
 */
module.exports = {
  exampleBasicUsage,
  exampleWithPersistence,
  exampleDifferentWeights,
  exampleEdgeCases,
  exampleErrorHandling,
};

// Exécution si appelé directement
if (require.main === module) {
  (async () => {
    try {
      await exampleBasicUsage();
      await exampleDifferentWeights();
      await exampleEdgeCases();
      await exampleErrorHandling();
    } catch (error) {
      console.error('Erreur:', error);
      process.exit(1);
    }
  })();
}

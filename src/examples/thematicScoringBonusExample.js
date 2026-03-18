/**
 * Example Usage - Thematic Scoring Engine v1.1_stable (with Bonus System)
 * Démonstration du système de bonus positif plafonné
 *
 * @module thematicScoringBonusExample
 */

const { calculateThematicScore, ENGINE_VERSION, BONUS_RULES } = require('../engines/thematicScoringEngine');

/**
 * Exemple 1: Devis avec scoring excellent mais sans bonus (risques présents)
 */
async function exampleNoBonus() {
  console.log('\n=== EXEMPLE 1: Scoring sans bonus ===\n');

  const input = {
    projectId: 'PROJ-NO-BONUS',
    devisId: 'DV-NO-BONUS-001',
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
        nonCompliantItems: ['Absence de mention RGPD'],
      },
      riskFindings: {
        criticalRisks: ['Risque majeur identifié'],
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

  try {
    const result = await calculateThematicScore(input);

    console.log(`Projet: ${input.projectId}`);
    console.log(`Engine Version: ${result.engineVersion}`);
    console.log(`\nScores thématiques:`);
    console.log(`  • Regulatory: ${result.scores.regulatory.score}/100`);
    console.log(`  • Risk: ${result.scores.risk.score}/100`);
    console.log(`  • Technical: ${result.scores.technical.score}/100`);
    console.log(`  • Transparency: ${result.scores.transparency.score}/100`);
    console.log(`  • Optimization: ${result.scores.optimization.score}/100`);

    console.log(`\nScore pondéré (avant bonus): ${result.weightedScoreBrut}/100`);
    console.log(`Bonus appliqué: ${result.bonusPoints} points`);
    console.log(`Score final: ${result.weightedScore}/100`);
    console.log(`Grade: ${result.gradeLetter}`);

    console.log(`\nDétail des bonus:`);
    Object.entries(result.bonusBreakdown).forEach(([key, value]) => {
      if (value.awarded) {
        console.log(`  ✓ ${key}: +${value.points} points`);
      } else {
        console.log(`  ✗ ${key}: 0 points (condition non remplie)`);
      }
    });

    return result;
  } catch (error) {
    console.error('Erreur:', error.message);
    throw error;
  }
}

/**
 * Exemple 2: Devis excellentissime avec tous les bonus (95+ partout)
 */
async function exampleMaxBonus() {
  console.log('\n=== EXEMPLE 2: Scoring avec bonus maximal ===\n');

  const input = {
    projectId: 'PROJ-MAX-BONUS',
    devisId: 'DV-MAX-BONUS-001',
    complexityWeights: {
      regulatory: 0.20,
      risk: 0.20,
      technical: 0.20,
      transparency: 0.20,
      optimization: 0.20,
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

  try {
    const result = await calculateThematicScore(input);

    console.log(`Projet: ${input.projectId}`);
    console.log(`Engine Version: ${result.engineVersion}`);
    console.log(`\nScores thématiques:`);
    console.log(`  • Regulatory: ${result.scores.regulatory.score}/100`);
    console.log(`  • Risk: ${result.scores.risk.score}/100`);
    console.log(`  • Technical: ${result.scores.technical.score}/100`);
    console.log(`  • Transparency: ${result.scores.transparency.score}/100`);
    console.log(`  • Optimization: ${result.scores.optimization.score}/100`);

    console.log(`\nScore pondéré (avant bonus): ${result.weightedScoreBrut}/100`);
    console.log(`Bonus disponible: ${result.bonusPoints} points (max: ${BONUS_RULES.maxBonus})`);
    console.log(`Score final: ${result.weightedScore}/100`);
    console.log(`Grade: ${result.gradeLetter}`);

    console.log(`\nBonus appliqués:`);
    Object.entries(result.bonusBreakdown).forEach(([key, value]) => {
      if (value.awarded) {
        console.log(`  ✓ ${key}: +${value.points} points`);
      }
    });

    return result;
  } catch (error) {
    console.error('Erreur:', error.message);
    throw error;
  }
}

/**
 * Exemple 3: Devis avec bonus partiel (quelques excellences)
 */
async function examplePartialBonus() {
  console.log('\n=== EXEMPLE 3: Scoring avec bonus partiel ===\n');

  const input = {
    projectId: 'PROJ-PARTIAL-BONUS',
    devisId: 'DV-PARTIAL-BONUS-001',
    complexityWeights: {
      regulatory: 0.30,
      risk: 0.30,
      technical: 0.15,
      transparency: 0.15,
      optimization: 0.10,
    },
    analysisData: {
      regulatoryFindings: {
        missingClauses: [],
        invalidReferences: [],
        nonCompliantItems: [],
      },
      riskFindings: {
        criticalRisks: [],
        moderateRisks: ['Risque modéré'],
      },
      technicalFindings: {
        incoherences: [],
        omissions: ['Détail technique'],
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

  try {
    const result = await calculateThematicScore(input);

    console.log(`Projet: ${input.projectId}`);
    console.log(`Engine Version: ${result.engineVersion}`);
    console.log(`\nScores thématiques:`);
    console.log(`  • Regulatory: ${result.scores.regulatory.score}/100`);
    console.log(`  • Risk: ${result.scores.risk.score}/100`);
    console.log(`  • Technical: ${result.scores.technical.score}/100`);
    console.log(`  • Transparency: ${result.scores.transparency.score}/100`);
    console.log(`  • Optimization: ${result.scores.optimization.score}/100`);

    console.log(`\nScore pondéré (avant bonus): ${result.weightedScoreBrut}/100`);
    console.log(`Bonus appliqué: ${result.bonusPoints}/${BONUS_RULES.maxBonus} points`);
    console.log(`Score final: ${result.weightedScore}/100`);
    console.log(`Grade: ${result.gradeLetter}`);

    console.log(`\nAnalyse des bonus:`);
    Object.entries(result.bonusBreakdown).forEach(([key, value]) => {
      if (value.awarded) {
        console.log(`  ✓ ${key}: +${value.points} points`);
      } else {
        console.log(`  ✗ ${key}: Non déclenché (score: ${value.currentScore})`);
      }
    });

    return result;
  } catch (error) {
    console.error('Erreur:', error.message);
    throw error;
  }
}

/**
 * Exemple 4: Démonstration du plafond du score final (max 100)
 */
async function exampleScoreCapping() {
  console.log('\n=== EXEMPLE 4: Démonstration du plafond (max 100) ===\n');

  const input = {
    projectId: 'PROJ-CAPPING-TEST',
    devisId: 'DV-CAPPING-001',
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

  try {
    const result = await calculateThematicScore(input);

    console.log(`Projet: ${input.projectId}`);
    console.log(`Configuration: 100% regulatory, 0% autres`);
    console.log(`\nScore regulatory (100% poids): ${result.scores.regulatory.score}/100`);
    console.log(`Score pondéré brut: ${result.weightedScoreBrut}/100`);
    console.log(`Bonus: ${result.bonusPoints} points`);
    console.log(`Score avant plafond: ${(result.weightedScoreBrut + result.bonusPoints).toFixed(2)}`);
    console.log(`Score final (plafonné): ${result.weightedScore}/100`);

    if (result.weightedScore === 100) {
      console.log(`\n✓ Plafond correctement appliqué: score maintenu à 100.00 max`);
    }

    return result;
  } catch (error) {
    console.error('Erreur:', error.message);
    throw error;
  }
}

/**
 * Exemple 5: Comparaison avant/après pour plusieurs devis
 */
async function exampleComparisonBeforeAfterBonus() {
  console.log('\n=== EXEMPLE 5: Comparaison d\'impact du bonus ===\n');

  const scenarios = [
    {
      name: 'Bon devis',
      projectId: 'PROJ-GOOD',
      regulatory: 92,
      risk: 85,
      transparency: 90,
      nonCompliant: 1,
      criticalRisks: 1,
    },
    {
      name: 'Devis excellent',
      projectId: 'PROJ-EXCELLENT',
      regulatory: 95,
      risk: 92,
      transparency: 97,
      nonCompliant: 0,
      criticalRisks: 0,
    },
    {
      name: 'Devis moyen',
      projectId: 'PROJ-AVERAGE',
      regulatory: 75,
      risk: 70,
      transparency: 72,
      nonCompliant: 2,
      criticalRisks: 0,
    },
  ];

  console.log('Synthèse des bonuses appliqués:\n');
  console.log('Devis\t\t| Regulatory | Risk | Transparency | No Crit Risk | Total Bonus | Score Final');
  console.log(''.padEnd(90, '-'));

  for (const scenario of scenarios) {
    let bonusCount = 0;
    let description = `${scenario.name.padEnd(12)}`;

    if (scenario.regulatory >= 90) bonusCount++;
    description += `| ${scenario.regulatory >= 90 ? '✓' : '✗'}`;

    if (scenario.risk >= 90) bonusCount++;
    description += `\t| ${scenario.risk >= 90 ? '✓' : '✗'}`;

    if (scenario.transparency >= 95) bonusCount++;
    description += `\t| ${scenario.transparency >= 95 ? '✓' : '✗'}`;

    if (scenario.nonCompliant === 0 && scenario.criticalRisks === 0) bonusCount++;
    description += `\t| ${scenario.nonCompliant === 0 && scenario.criticalRisks === 0 ? '✓' : '✗'}`;

    description += `\t| ${bonusCount}/${BONUS_RULES.maxBonus}`;

    const avgScore = (scenario.regulatory + scenario.risk + scenario.transparency) / 3;
    const finalScore = Math.min(avgScore + bonusCount, 100);

    description += `\t| ${finalScore.toFixed(1)}/100`;

    console.log(description);
  }

  console.log('\nLégende: ✓ = condition remplie, ✗ = condition non remplie');
}

/**
 * Exemple 6: Affichage de la configuration des bonus
 */
async function exampleBonusConfiguration() {
  console.log('\n=== CONFIGURATION DES BONUS (v1.1_stable) ===\n');

  console.log(`Engine Version: ${ENGINE_VERSION}`);
  console.log(`\nRègles de bonus:\n`);

  Object.entries(BONUS_RULES).forEach(([key, rule]) => {
    if (key !== 'maxBonus') {
      console.log(`${key}:`);
      console.log(`  Condition: ${rule.condition}`);
      console.log(`  Points: +${rule.points}`);
      console.log();
    }
  });

  console.log(`Bonus maximum plafonné: ${BONUS_RULES.maxBonus} points`);
  console.log(`Score final plafonné: 100.00 max`);
  console.log('\nGaranties:');
  console.log('  ✓ Les scores thématiques ne sont jamais modifiés');
  console.log('  ✓ Les bonus sont appliqués APRÈS la pondération');
  console.log('  ✓ Le score final ne peut pas dépasser 100.00');
  console.log('  ✓ Tous les bonus sont tracés et persistés');
  console.log('  ✓ Les bonus n\'affectent jamais la note (grade reste basé sur score final)');
}

/**
 * Export des exemples
 */
module.exports = {
  exampleNoBonus,
  exampleMaxBonus,
  examplePartialBonus,
  exampleScoreCapping,
  exampleComparisonBeforeAfterBonus,
  exampleBonusConfiguration,
};

// Exécution si appelé directement
if (require.main === module) {
  (async () => {
    try {
      await exampleNoBonus();
      await exampleMaxBonus();
      await examplePartialBonus();
      await exampleScoreCapping();
      await exampleComparisonBeforeAfterBonus();
      await exampleBonusConfiguration();
    } catch (error) {
      console.error('Erreur:', error);
      process.exit(1);
    }
  })();
}

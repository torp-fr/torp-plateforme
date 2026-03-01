/**
 * Thematic Scoring Engine
 * Moteur de scoring 100% déterministe, audit-proof et reproductible
 * Version: v1.1_stable - Inclut système de bonus positif plafonné
 *
 * @module thematicScoringEngine
 * @requires logger
 * @requires database
 */

/**
 * Version du moteur de scoring
 * @constant {string}
 */
const ENGINE_VERSION = 'v1.1_stable';

/**
 * Configuration des règles de bonus positif
 * @constant {Object}
 */
const BONUS_RULES = {
  regulatoryExcellence: {
    threshold: 90,
    points: 3,
    condition: 'regulatory_score >= 90',
  },
  riskExcellence: {
    threshold: 90,
    points: 2,
    condition: 'risk_score >= 90',
  },
  transparencyExcellence: {
    threshold: 95,
    points: 2,
    condition: 'transparency_score >= 95',
  },
  zeroNonCompliantAndCriticalRisk: {
    threshold: 0,
    points: 2,
    condition: 'nonCompliantItems.length === 0 AND criticalRisks.length === 0',
  },
  maxBonus: 5,
};

/**
 * Configuration de scoring pour chaque thème
 * @constant {Object}
 */
const SCORING_CONFIG = {
  regulatory: {
    name: 'Conformité Réglementaire',
    baseScore: 100,
    penalties: {
      nonCompliantItem: 10,
      invalidReference: 5,
      missingClause: 3,
    },
    floor: 0,
  },
  risk: {
    name: 'Gestion des Risques',
    baseScore: 100,
    penalties: {
      criticalRisk: 15,
      moderateRisk: 7,
    },
    floor: 0,
  },
  technical: {
    name: 'Cohérence Technique',
    baseScore: 100,
    penalties: {
      incoherence: 8,
      omission: 5,
    },
    floor: 0,
  },
  transparency: {
    name: 'Transparence',
    baseScore: 100,
    penalties: {
      unclearLine: 5,
      missingDetail: 5,
    },
    floor: 0,
  },
  optimization: {
    name: 'Optimisation',
    baseScore: 100,
    penalties: {
      improvementOpportunity: 4,
    },
    floor: 0,
  },
};

/**
 * Grade scale configuration
 * @constant {Array}
 */
const GRADE_SCALE = [
  { letter: 'A', minScore: 85 },
  { letter: 'B', minScore: 75 },
  { letter: 'C', minScore: 60 },
  { letter: 'D', minScore: 45 },
  { letter: 'E', minScore: 0 },
];

/**
 * Logger utility - structured logging
 * @type {Object}
 */
const createLogger = () => ({
  info: (message, context = {}) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message,
      context,
    }));
  },
  warn: (message, context = {}) => {
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'WARN',
      message,
      context,
    }));
  },
  error: (message, context = {}) => {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message,
      context,
    }));
  },
  debug: (message, context = {}) => {
    if (process.env.DEBUG === 'true') {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'DEBUG',
        message,
        context,
      }));
    }
  },
});

/**
 * Validation des poids
 * @param {Object} complexityWeights - Les poids de scoring
 * @returns {Object} { isValid: boolean, errors: Array<string> }
 */
function validateWeights(complexityWeights) {
  const errors = [];

  if (!complexityWeights || typeof complexityWeights !== 'object') {
    errors.push('complexityWeights doit être un objet');
    return { isValid: false, errors };
  }

  const requiredKeys = ['regulatory', 'risk', 'technical', 'transparency', 'optimization'];
  const providedKeys = Object.keys(complexityWeights);

  const missingKeys = requiredKeys.filter(key => !providedKeys.includes(key));
  if (missingKeys.length > 0) {
    errors.push(`Poids manquants: ${missingKeys.join(', ')}`);
  }

  let weightSum = 0;
  const weights = {};

  for (const [key, value] of Object.entries(complexityWeights)) {
    if (!requiredKeys.includes(key)) {
      errors.push(`Poids invalide: ${key}`);
      continue;
    }

    if (typeof value !== 'number' || value < 0 || value > 1) {
      errors.push(`Poids ${key} invalide: ${value} (doit être entre 0 et 1)`);
      continue;
    }

    weights[key] = value;
    weightSum += value;
  }

  // Vérifier que la somme est exactement 1.0 (avec tolérance de 0.0001)
  const weightSumRounded = Math.round(weightSum * 10000) / 10000;
  if (Math.abs(weightSumRounded - 1.0) > 0.0001) {
    errors.push(`Somme des poids invalide: ${weightSumRounded} (doit être 1.0)`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    weights: errors.length === 0 ? weights : null,
  };
}

/**
 * Validation des données d'analyse
 * @param {Object} analysisData - Les données d'analyse structurées
 * @returns {Object} { isValid: boolean, errors: Array<string> }
 */
function validateAnalysisData(analysisData) {
  const errors = [];

  if (!analysisData || typeof analysisData !== 'object') {
    errors.push('analysisData doit être un objet');
    return { isValid: false, errors };
  }

  const requiredThemes = ['regulatoryFindings', 'riskFindings', 'technicalFindings', 'transparencyFindings', 'optimizationFindings'];

  for (const theme of requiredThemes) {
    if (!analysisData[theme]) {
      errors.push(`Thème manquant: ${theme}`);
    } else if (typeof analysisData[theme] !== 'object') {
      errors.push(`${theme} doit être un objet`);
    }
  }

  // Validation spécifique pour regulatory
  if (analysisData.regulatoryFindings) {
    const reg = analysisData.regulatoryFindings;
    if (!Array.isArray(reg.missingClauses) || !Array.isArray(reg.invalidReferences) || !Array.isArray(reg.nonCompliantItems)) {
      errors.push('regulatoryFindings: missingClauses, invalidReferences, nonCompliantItems doivent être des tableaux');
    }
  }

  // Validation spécifique pour risk
  if (analysisData.riskFindings) {
    const risk = analysisData.riskFindings;
    if (!Array.isArray(risk.criticalRisks) || !Array.isArray(risk.moderateRisks)) {
      errors.push('riskFindings: criticalRisks, moderateRisks doivent être des tableaux');
    }
  }

  // Validation spécifique pour technical
  if (analysisData.technicalFindings) {
    const tech = analysisData.technicalFindings;
    if (!Array.isArray(tech.incoherences) || !Array.isArray(tech.omissions)) {
      errors.push('technicalFindings: incoherences, omissions doivent être des tableaux');
    }
  }

  // Validation spécifique pour transparency
  if (analysisData.transparencyFindings) {
    const transp = analysisData.transparencyFindings;
    if (!Array.isArray(transp.unclearLines) || !Array.isArray(transp.missingDetails)) {
      errors.push('transparencyFindings: unclearLines, missingDetails doivent être des tableaux');
    }
  }

  // Validation spécifique pour optimization
  if (analysisData.optimizationFindings) {
    const opt = analysisData.optimizationFindings;
    if (!Array.isArray(opt.improvementOpportunities)) {
      errors.push('optimizationFindings: improvementOpportunities doit être un tableau');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Calcule le score pour un thème spécifique
 * @param {string} theme - Nom du thème
 * @param {Object} findings - Données des findings pour ce thème
 * @returns {Object} { score: number, breakdown: Object }
 */
function calculateThemeScore(theme, findings) {
  const config = SCORING_CONFIG[theme];
  if (!config) {
    throw new Error(`Thème invalide: ${theme}`);
  }

  let score = config.baseScore;
  const breakdown = {};

  // Calculer les pénalités basées sur la configuration
  for (const [key, penalty] of Object.entries(config.penalties)) {
    const count = findings[key] ? findings[key].length : 0;
    const deduction = count * penalty;
    breakdown[key] = {
      count,
      penalty,
      deduction,
    };
    score -= deduction;
  }

  // Appliquer le plancher
  score = Math.max(score, config.floor);
  // S'assurer que le score ne dépasse pas 100
  score = Math.min(score, 100);

  return {
    score,
    breakdown,
    floor: config.floor,
  };
}

/**
 * Calcule tous les scores thématiques
 * @param {Object} analysisData - Les données d'analyse
 * @returns {Object} Scores pour chaque thème
 */
function calculateThemeScores(analysisData) {
  const scores = {};

  scores.regulatory = calculateThemeScore('regulatory', analysisData.regulatoryFindings);
  scores.risk = calculateThemeScore('risk', analysisData.riskFindings);
  scores.technical = calculateThemeScore('technical', analysisData.technicalFindings);
  scores.transparency = calculateThemeScore('transparency', analysisData.transparencyFindings);
  scores.optimization = calculateThemeScore('optimization', analysisData.optimizationFindings);

  return scores;
}

/**
 * Calcule le score pondéré global
 * @param {Object} themeScores - Les scores des thèmes
 * @param {Object} weights - Les poids de chaque thème
 * @returns {number} Score pondéré arrondi à 2 décimales
 */
function calculateWeightedScore(themeScores, weights) {
  const weightedScore =
    (themeScores.regulatory.score * weights.regulatory) +
    (themeScores.risk.score * weights.risk) +
    (themeScores.technical.score * weights.technical) +
    (themeScores.transparency.score * weights.transparency) +
    (themeScores.optimization.score * weights.optimization);

  // Arrondir à 2 décimales
  return Math.round(weightedScore * 100) / 100;
}

/**
 * Calcule les bonus positifs appliqués au score pondéré
 * Système de bonus plafonné pour récompenser l'excellence
 * @param {Object} themeScores - Les scores des thèmes
 * @param {Object} analysisData - Les données d'analyse brutes
 * @returns {Object} { bonusPoints: number, bonusBreakdown: Object }
 */
function calculateBonusPoints(themeScores, analysisData) {
  const bonusBreakdown = {};
  let totalBonus = 0;

  // Bonus 1: Excellence en conformité réglementaire
  if (themeScores.regulatory.score >= BONUS_RULES.regulatoryExcellence.threshold) {
    bonusBreakdown.regulatoryExcellence = {
      threshold: BONUS_RULES.regulatoryExcellence.threshold,
      awarded: true,
      points: BONUS_RULES.regulatoryExcellence.points,
    };
    totalBonus += BONUS_RULES.regulatoryExcellence.points;
  } else {
    bonusBreakdown.regulatoryExcellence = {
      threshold: BONUS_RULES.regulatoryExcellence.threshold,
      awarded: false,
      points: 0,
      currentScore: themeScores.regulatory.score,
    };
  }

  // Bonus 2: Excellence en gestion des risques
  if (themeScores.risk.score >= BONUS_RULES.riskExcellence.threshold) {
    bonusBreakdown.riskExcellence = {
      threshold: BONUS_RULES.riskExcellence.threshold,
      awarded: true,
      points: BONUS_RULES.riskExcellence.points,
    };
    totalBonus += BONUS_RULES.riskExcellence.points;
  } else {
    bonusBreakdown.riskExcellence = {
      threshold: BONUS_RULES.riskExcellence.threshold,
      awarded: false,
      points: 0,
      currentScore: themeScores.risk.score,
    };
  }

  // Bonus 3: Excellence en transparence
  if (themeScores.transparency.score >= BONUS_RULES.transparencyExcellence.threshold) {
    bonusBreakdown.transparencyExcellence = {
      threshold: BONUS_RULES.transparencyExcellence.threshold,
      awarded: true,
      points: BONUS_RULES.transparencyExcellence.points,
    };
    totalBonus += BONUS_RULES.transparencyExcellence.points;
  } else {
    bonusBreakdown.transparencyExcellence = {
      threshold: BONUS_RULES.transparencyExcellence.threshold,
      awarded: false,
      points: 0,
      currentScore: themeScores.transparency.score,
    };
  }

  // Bonus 4: Zéro non-conformités réglementaires ET zéro risques critiques
  const nonCompliantCount = analysisData.regulatoryFindings?.nonCompliantItems?.length || 0;
  const criticalRiskCount = analysisData.riskFindings?.criticalRisks?.length || 0;

  if (nonCompliantCount === 0 && criticalRiskCount === 0) {
    bonusBreakdown.zeroNonCompliantAndCriticalRisk = {
      condition: 'nonCompliantItems = 0 AND criticalRisks = 0',
      awarded: true,
      points: BONUS_RULES.zeroNonCompliantAndCriticalRisk.points,
    };
    totalBonus += BONUS_RULES.zeroNonCompliantAndCriticalRisk.points;
  } else {
    bonusBreakdown.zeroNonCompliantAndCriticalRisk = {
      condition: 'nonCompliantItems = 0 AND criticalRisks = 0',
      awarded: false,
      points: 0,
      nonCompliantCount,
      criticalRiskCount,
    };
  }

  // Appliquer le plafond de bonus (max 5 points)
  const cappedBonus = Math.min(totalBonus, BONUS_RULES.maxBonus);

  return {
    bonusPoints: cappedBonus,
    totalEligibleBonus: totalBonus,
    bonusBreakdown,
    bonusCapApplied: totalBonus > BONUS_RULES.maxBonus,
  };
}

/**
 * Détermine le grade letter basé sur le score
 * @param {number} score - Score pondéré
 * @returns {string} Grade letter (A, B, C, D, E)
 */
function determineGradeLetter(score) {
  for (const grade of GRADE_SCALE) {
    if (score >= grade.minScore) {
      return grade.letter;
    }
  }
  return 'E'; // Fallback
}

/**
 * Valide les paramètres d'entrée
 * @param {Object} input - Données d'entrée
 * @param {string} input.projectId - ID du projet
 * @param {string} input.devisId - ID du devis
 * @param {Object} input.complexityWeights - Poids de scoring
 * @param {Object} input.analysisData - Données d'analyse
 * @returns {Object} { isValid: boolean, errors: Array<string> }
 */
function validateInput(input) {
  const errors = [];

  if (!input || typeof input !== 'object') {
    errors.push('Input doit être un objet');
    return { isValid: false, errors };
  }

  if (!input.projectId || typeof input.projectId !== 'string') {
    errors.push('projectId est requis et doit être une chaîne');
  }

  if (!input.devisId || typeof input.devisId !== 'string') {
    errors.push('devisId est requis et doit être une chaîne');
  }

  const weightsValidation = validateWeights(input.complexityWeights);
  if (!weightsValidation.isValid) {
    errors.push(...weightsValidation.errors);
  }

  const analysisValidation = validateAnalysisData(input.analysisData);
  if (!analysisValidation.isValid) {
    errors.push(...analysisValidation.errors);
  }

  return {
    isValid: errors.length === 0,
    errors,
    weights: weightsValidation.weights,
  };
}

/**
 * Moteur de scoring principal
 * Exécute le pipeline complet: scores thématiques → score pondéré → bonus → score final
 * @param {Object} input - Données d'entrée
 * @param {string} input.projectId - ID du projet
 * @param {string} input.devisId - ID du devis
 * @param {Object} input.complexityWeights - Poids de scoring
 * @param {Object} input.analysisData - Données d'analyse
 * @param {Object} options - Options de configuration
 * @param {Function} options.persistenceAdapter - Fonction pour persister les résultats
 * @returns {Promise<Object>} Résultats du scoring avec bonus
 */
async function calculateThematicScore(input, options = {}) {
  const logger = createLogger();

  const startTime = Date.now();
  const executionId = generateExecutionId();

  logger.info('Démarrage du calcul de scoring thématique', {
    executionId,
    projectId: input.projectId,
    devisId: input.devisId,
    engineVersion: ENGINE_VERSION,
  });

  try {
    // Validation des entrées
    const inputValidation = validateInput(input);
    if (!inputValidation.isValid) {
      logger.error('Validation des entrées échouée', {
        executionId,
        errors: inputValidation.errors,
      });
      throw new Error(`Validation échouée: ${inputValidation.errors.join('; ')}`);
    }

    const weights = inputValidation.weights;

    // ÉTAPE 1: Calcul des scores thématiques
    const themeScores = calculateThemeScores(input.analysisData);

    logger.debug('Étape 1 - Scores thématiques calculés', {
      executionId,
      scores: Object.entries(themeScores).reduce((acc, [key, val]) => {
        acc[key] = val.score;
        return acc;
      }, {}),
    });

    // ÉTAPE 2: Calcul du score pondéré brut
    const weightedScoreBrut = calculateWeightedScore(themeScores, weights);

    logger.debug('Étape 2 - Score pondéré brut calculé', {
      executionId,
      weightedScoreBrut,
    });

    // Validation du score pondéré brut
    if (weightedScoreBrut < 0 || weightedScoreBrut > 100) {
      logger.error('Score pondéré brut invalide', {
        executionId,
        weightedScoreBrut,
      });
      throw new Error(`Score pondéré brut invalide: ${weightedScoreBrut}`);
    }

    // ÉTAPE 3: Calcul des bonus positifs
    const bonusCalculation = calculateBonusPoints(themeScores, input.analysisData);
    const bonusPoints = bonusCalculation.bonusPoints;

    logger.info('Étape 3 - Bonus positifs calculés', {
      executionId,
      bonusPoints,
      bonusBreakdown: bonusCalculation.bonusBreakdown,
      bonusCapApplied: bonusCalculation.bonusCapApplied,
    });

    // ÉTAPE 4: Calcul du score final avec bonus plafonné à 100
    const weightedScoreFinal = Math.min(
      Math.round((weightedScoreBrut + bonusPoints) * 100) / 100,
      100,
    );

    logger.debug('Étape 4 - Score final calculé', {
      executionId,
      weightedScoreBrut,
      bonusPoints,
      weightedScoreFinal,
    });

    // ÉTAPE 5: Détermination du grade basé sur le score final
    const gradeLetter = determineGradeLetter(weightedScoreFinal);

    logger.info('Étape 5 - Grade déterminé', {
      executionId,
      gradeLetter,
    });

    // Validation du score final
    if (weightedScoreFinal < 0 || weightedScoreFinal > 100) {
      logger.error('Score final invalide', {
        executionId,
        weightedScoreFinal,
      });
      throw new Error(`Score final invalide: ${weightedScoreFinal}`);
    }

    const result = {
      scores: {
        regulatory: {
          score: themeScores.regulatory.score,
          breakdown: themeScores.regulatory.breakdown,
        },
        risk: {
          score: themeScores.risk.score,
          breakdown: themeScores.risk.breakdown,
        },
        technical: {
          score: themeScores.technical.score,
          breakdown: themeScores.technical.breakdown,
        },
        transparency: {
          score: themeScores.transparency.score,
          breakdown: themeScores.transparency.breakdown,
        },
        optimization: {
          score: themeScores.optimization.score,
          breakdown: themeScores.optimization.breakdown,
        },
      },
      weightedScoreBrut,
      bonusPoints,
      bonusBreakdown: bonusCalculation.bonusBreakdown,
      weightedScore: weightedScoreFinal,
      gradeLetter,
      weights,
      executionId,
      engineVersion: ENGINE_VERSION,
      timestamp: new Date().toISOString(),
    };

    // Persistence des résultats
    if (options.persistenceAdapter && typeof options.persistenceAdapter === 'function') {
      try {
        await options.persistenceAdapter({
          projectId: input.projectId,
          devisId: input.devisId,
          result,
        });
        logger.info('Résultats persistés avec succès', {
          executionId,
          projectId: input.projectId,
          devisId: input.devisId,
        });
      } catch (persistError) {
        logger.error('Erreur lors de la persistence', {
          executionId,
          error: persistError.message,
        });
        // Ne pas bloquer le résultat si la persistence échoue
      }
    }

    const duration = Date.now() - startTime;
    logger.info('Calcul de scoring complété avec succès', {
      executionId,
      duration: `${duration}ms`,
      weightedScoreBrut,
      bonusPoints,
      weightedScoreFinal,
      gradeLetter,
      engineVersion: ENGINE_VERSION,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Erreur lors du calcul de scoring', {
      executionId,
      error: error.message,
      duration: `${duration}ms`,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Génère un ID d'exécution unique pour le audit trail
 * @returns {string}
 */
function generateExecutionId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Export des fonctions publiques
 */
module.exports = {
  // API principale
  calculateThematicScore,

  // Fonctions utilitaires (pour testing et audit)
  validateInput,
  validateWeights,
  validateAnalysisData,
  calculateThemeScores,
  calculateWeightedScore,
  calculateBonusPoints,
  determineGradeLetter,
  calculateThemeScore,

  // Configuration (pour inspection et audit)
  SCORING_CONFIG,
  GRADE_SCALE,
  BONUS_RULES,
  ENGINE_VERSION,

  // Logger
  createLogger,
};

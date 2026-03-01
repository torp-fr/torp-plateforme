/**
 * Thematic Scoring Engine
 * Moteur de scoring 100% déterministe, audit-proof et reproductible
 *
 * @module thematicScoringEngine
 * @requires logger
 * @requires database
 */

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
 * @param {Object} input - Données d'entrée
 * @param {string} input.projectId - ID du projet
 * @param {string} input.devisId - ID du devis
 * @param {Object} input.complexityWeights - Poids de scoring
 * @param {Object} input.analysisData - Données d'analyse
 * @param {Object} options - Options de configuration
 * @param {Function} options.persistenceAdapter - Fonction pour persister les résultats
 * @returns {Promise<Object>} Résultats du scoring
 */
async function calculateThematicScore(input, options = {}) {
  const logger = createLogger();

  const startTime = Date.now();
  const executionId = generateExecutionId();

  logger.info('Démarrage du calcul de scoring thématique', {
    executionId,
    projectId: input.projectId,
    devisId: input.devisId,
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

    // Calcul des scores thématiques
    const themeScores = calculateThemeScores(input.analysisData);

    logger.debug('Scores thématiques calculés', {
      executionId,
      scores: Object.entries(themeScores).reduce((acc, [key, val]) => {
        acc[key] = val.score;
        return acc;
      }, {}),
    });

    // Calcul du score pondéré
    const weightedScore = calculateWeightedScore(themeScores, weights);

    // Détermination du grade
    const gradeLetter = determineGradeLetter(weightedScore);

    // Validation des résultats
    if (weightedScore < 0 || weightedScore > 100) {
      logger.error('Score invalide', {
        executionId,
        weightedScore,
      });
      throw new Error(`Score pondéré invalide: ${weightedScore}`);
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
      weightedScore,
      gradeLetter,
      weights,
      executionId,
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
      weightedScore,
      gradeLetter,
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
  determineGradeLetter,
  calculateThemeScore,

  // Configuration (pour inspection et audit)
  SCORING_CONFIG,
  GRADE_SCALE,

  // Logger
  createLogger,
};

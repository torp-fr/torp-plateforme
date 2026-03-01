/**
 * Audit Orchestrator
 * Orchestre l'exécution complète : Scoring → Audit Narratif → Persistence
 * Pipeline déterministe et audit-proof end-to-end
 *
 * @module auditOrchestrator
 */

const { calculateThematicScore } = require('../engines/thematicScoringEngine');
const { generateAuditNarrative } = require('../engines/auditNarrativeEngine');

/**
 * Logger utility
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
});

/**
 * Valide les entrées du pipeline
 * @param {Object} input - Données d'entrée
 * @returns {Object} { isValid: boolean, errors: Array }
 */
function validatePipelineInput(input) {
  const errors = [];

  if (!input.projectId || !input.devisId) {
    errors.push('projectId et devisId sont requis');
  }

  if (!input.complexityWeights || typeof input.complexityWeights !== 'object') {
    errors.push('complexityWeights est requis');
  }

  if (!input.analysisData || typeof input.analysisData !== 'object') {
    errors.push('analysisData est requis');
  }

  if (!input.projectContext || typeof input.projectContext !== 'object') {
    errors.push('projectContext est requis');
  }

  if (!input.userProfile || !['B2B', 'B2C'].includes(input.userProfile.type)) {
    errors.push('userProfile avec type B2B ou B2C est requis');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Exécute le pipeline complet de scoring et audit
 * @param {Object} input - Données d'entrée consolidées
 * @param {Object} options - Options de configuration
 * @param {Function} options.scoringPersistenceAdapter - Adapter pour scoring
 * @param {Function} options.auditPersistenceAdapter - Adapter pour audit
 * @param {Function} options.llmProvider - Provider LLM optionnel
 * @returns {Promise<Object>} Résultat complet du pipeline
 */
async function executeScoringAndAuditPipeline(input, options = {}) {
  const logger = createLogger();
  const pipelineId = generatePipelineId();

  const startTime = Date.now();

  logger.info('Démarrage du pipeline audit complet', {
    pipelineId,
    projectId: input.projectId,
    devisId: input.devisId,
    userType: input.userProfile.type,
  });

  try {
    // Validation des entrées
    const validation = validatePipelineInput(input);
    if (!validation.isValid) {
      logger.error('Validation échouée', {
        pipelineId,
        errors: validation.errors,
      });
      throw new Error(`Validation échouée: ${validation.errors.join('; ')}`);
    }

    // ÉTAPE 1: Calcul du scoring thématique
    logger.info('Étape 1: Calcul du scoring en cours...', { pipelineId });

    const scoringStartTime = Date.now();
    const scoringInput = {
      projectId: input.projectId,
      devisId: input.devisId,
      complexityWeights: input.complexityWeights,
      analysisData: input.analysisData,
    };

    const scoringResult = await calculateThematicScore(scoringInput, {
      persistenceAdapter: options.scoringPersistenceAdapter,
    });

    const scoringDuration = Date.now() - scoringStartTime;
    logger.info('Étape 1 complétée: Scoring calculé', {
      pipelineId,
      duration: `${scoringDuration}ms`,
      weightedScore: scoringResult.weightedScore,
      grade: scoringResult.gradeLetter,
    });

    // ÉTAPE 2: Génération du rapport narratif d'audit
    logger.info('Étape 2: Génération du rapport d\'audit en cours...', { pipelineId });

    const auditStartTime = Date.now();
    const auditInput = {
      scoringProfile: {
        scores: scoringResult.scores,
        weightedScore: scoringResult.weightedScore,
        gradeLetter: scoringResult.gradeLetter,
      },
      analysisData: input.analysisData,
      projectContext: input.projectContext,
      userProfile: input.userProfile,
    };

    const auditResult = await generateAuditNarrative(auditInput, {
      persistenceAdapter: options.auditPersistenceAdapter,
      llmProvider: options.llmProvider,
    });

    const auditDuration = Date.now() - auditStartTime;
    logger.info('Étape 2 complétée: Rapport généré', {
      pipelineId,
      duration: `${auditDuration}ms`,
      auditId: auditResult.auditId,
    });

    // Compilation du résultat final
    const finalResult = {
      pipelineId,
      projectId: input.projectId,
      devisId: input.devisId,
      status: 'SUCCESS',
      scoring: scoringResult,
      audit: auditResult,
      executionMetrics: {
        totalDuration: `${Date.now() - startTime}ms`,
        scoringDuration: `${scoringDuration}ms`,
        auditDuration: `${auditDuration}ms`,
      },
      timestamp: new Date().toISOString(),
    };

    logger.info('Pipeline audit complété avec succès', {
      pipelineId,
      totalDuration: finalResult.executionMetrics.totalDuration,
      grade: finalResult.scoring.gradeLetter,
    });

    return finalResult;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Erreur du pipeline', {
      pipelineId,
      error: error.message,
      duration: `${duration}ms`,
      stack: error.stack,
    });

    throw {
      pipelineId,
      status: 'ERROR',
      error: error.message,
      duration: `${duration}ms`,
    };
  }
}

/**
 * Génère un rapport d'exécution structuré
 * @param {Object} pipelineResult - Résultat du pipeline
 * @returns {Object} Rapport formaté
 */
function generateExecutionReport(pipelineResult) {
  if (pipelineResult.status === 'ERROR') {
    return {
      status: 'ERROR',
      message: pipelineResult.error,
      pipelineId: pipelineResult.pipelineId,
      duration: pipelineResult.duration,
    };
  }

  const { scoring, audit, projectId, devisId } = pipelineResult;

  return {
    status: 'SUCCESS',
    pipelineId: pipelineResult.pipelineId,
    projectId,
    devisId,
    summary: {
      grade: scoring.gradeLetter,
      weightedScore: scoring.weightedScore,
      executiveSummary: audit.executiveSummary,
    },
    scoresByTheme: {
      regulatory: scoring.scores.regulatory.score,
      risk: scoring.scores.risk.score,
      technical: scoring.scores.technical.score,
      transparency: scoring.scores.transparency.score,
      optimization: scoring.scores.optimization.score,
    },
    keyInsights: {
      strengths: audit.strengths.slice(0, 3),
      weaknesses: audit.weaknesses.slice(0, 3),
      topRecommendations: audit.recommendations.slice(0, 3),
    },
    auditMetadata: {
      auditId: audit.auditId,
      userType: audit.userType,
      timestamp: audit.timestamp,
    },
    execution: pipelineResult.executionMetrics,
  };
}

/**
 * Batch processing pour plusieurs devis
 * @param {Array} inputs - Tableau d'entrées du pipeline
 * @param {Object} options - Options de configuration
 * @returns {Promise<Object>} Résultats batch avec statistiques
 */
async function executeBatchAuditPipeline(inputs, options = {}) {
  const logger = createLogger();
  const batchId = `BATCH-${Date.now()}`;

  logger.info('Démarrage du traitement batch', {
    batchId,
    count: inputs.length,
  });

  const results = {
    batchId,
    totalCount: inputs.length,
    successCount: 0,
    failureCount: 0,
    results: [],
    statistics: {
      avgScore: 0,
      gradeDistribution: { A: 0, B: 0, C: 0, D: 0, E: 0 },
      byUserType: { B2B: 0, B2C: 0 },
    },
    timestamp: new Date().toISOString(),
  };

  const startTime = Date.now();

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];

    try {
      const pipelineResult = await executeScoringAndAuditPipeline(input, options);
      results.results.push(pipelineResult);
      results.successCount++;

      // Statistiques
      const grade = pipelineResult.scoring.gradeLetter;
      results.statistics.gradeDistribution[grade]++;
      results.statistics.byUserType[input.userProfile.type]++;
    } catch (error) {
      results.results.push({
        projectId: input.projectId,
        devisId: input.devisId,
        status: 'ERROR',
        error: error.message || error,
      });
      results.failureCount++;
    }
  }

  // Calcul des statistiques
  const successfulResults = results.results.filter(r => r.status === 'SUCCESS');
  if (successfulResults.length > 0) {
    const scores = successfulResults.map(r => r.scoring.weightedScore);
    results.statistics.avgScore = (
      scores.reduce((a, b) => a + b, 0) / scores.length
    ).toFixed(2);
  }

  const duration = Date.now() - startTime;
  logger.info('Traitement batch complété', {
    batchId,
    successCount: results.successCount,
    failureCount: results.failureCount,
    duration: `${duration}ms`,
    avgScore: results.statistics.avgScore,
  });

  results.executionTime = `${duration}ms`;
  return results;
}

/**
 * Génère un ID de pipeline unique
 * @returns {string}
 */
function generatePipelineId() {
  return `PIPELINE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Exporte les résultats au format JSON
 * @param {Object} result - Résultat du pipeline
 * @param {Object} options - Options
 * @returns {string} JSON formaté
 */
function exportResultAsJSON(result, options = {}) {
  const output = {
    ...result,
    exportedAt: new Date().toISOString(),
    version: '1.0',
  };

  if (options.pretty) {
    return JSON.stringify(output, null, 2);
  }

  return JSON.stringify(output);
}

module.exports = {
  // API principale
  executeScoringAndAuditPipeline,
  executeBatchAuditPipeline,

  // Utilitaires
  validatePipelineInput,
  generateExecutionReport,
  exportResultAsJSON,

  // Logger
  createLogger,
};

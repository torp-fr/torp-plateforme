/**
 * Scoring Persistence Adapter
 * Abstraction pour la persistence des profils de scoring
 *
 * @module scoringPersistenceAdapter
 */

/**
 * Crée un adaptateur de persistence pour la table scoring_profiles
 * @param {Object} database - Client database (pg, mysql, etc.)
 * @returns {Function} Fonction de persistence
 */
function createScoringPersistenceAdapter(database) {
  return async function persistScoringResult({ projectId, devisId, result }) {
    if (!database) {
      throw new Error('Database client is required for persistence');
    }

    const {
      scores,
      weightedScore,
      gradeLetter,
      weights,
      executionId,
      timestamp,
    } = result;

    // Préparer les données pour l'insertion
    const profileData = {
      project_id: projectId,
      devis_id: devisId,
      execution_id: executionId,
      weighted_score: weightedScore,
      grade_letter: gradeLetter,
      regulatory_score: scores.regulatory.score,
      risk_score: scores.risk.score,
      technical_score: scores.technical.score,
      transparency_score: scores.transparency.score,
      optimization_score: scores.optimization.score,
      weights_json: JSON.stringify(weights),
      scores_breakdown_json: JSON.stringify(scores),
      calculated_at: new Date(timestamp),
      created_at: new Date(),
    };

    // Utiliser UPSERT pour garantir l'idempotence
    const query = `
      INSERT INTO scoring_profiles (
        project_id,
        devis_id,
        execution_id,
        weighted_score,
        grade_letter,
        regulatory_score,
        risk_score,
        technical_score,
        transparency_score,
        optimization_score,
        weights_json,
        scores_breakdown_json,
        calculated_at,
        created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      )
      ON CONFLICT (project_id, devis_id) DO UPDATE SET
        execution_id = EXCLUDED.execution_id,
        weighted_score = EXCLUDED.weighted_score,
        grade_letter = EXCLUDED.grade_letter,
        regulatory_score = EXCLUDED.regulatory_score,
        risk_score = EXCLUDED.risk_score,
        technical_score = EXCLUDED.technical_score,
        transparency_score = EXCLUDED.transparency_score,
        optimization_score = EXCLUDED.optimization_score,
        weights_json = EXCLUDED.weights_json,
        scores_breakdown_json = EXCLUDED.scores_breakdown_json,
        calculated_at = EXCLUDED.calculated_at,
        updated_at = NOW()
      RETURNING id, weighted_score, grade_letter;
    `;

    const values = [
      profileData.project_id,
      profileData.devis_id,
      profileData.execution_id,
      profileData.weighted_score,
      profileData.grade_letter,
      profileData.regulatory_score,
      profileData.risk_score,
      profileData.technical_score,
      profileData.transparency_score,
      profileData.optimization_score,
      profileData.weights_json,
      profileData.scores_breakdown_json,
      profileData.calculated_at,
      profileData.created_at,
    ];

    const result_query = await database.query(query, values);
    return result_query.rows[0];
  };
}

/**
 * Migration SQL pour créer la table scoring_profiles
 * À exécuter une seule fois
 */
const SCORING_PROFILES_MIGRATION = `
  CREATE TABLE IF NOT EXISTS scoring_profiles (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL,
    devis_id VARCHAR(255) NOT NULL,
    execution_id VARCHAR(255) NOT NULL UNIQUE,
    weighted_score DECIMAL(5, 2) NOT NULL,
    grade_letter CHAR(1) NOT NULL,
    regulatory_score DECIMAL(5, 2) NOT NULL,
    risk_score DECIMAL(5, 2) NOT NULL,
    technical_score DECIMAL(5, 2) NOT NULL,
    transparency_score DECIMAL(5, 2) NOT NULL,
    optimization_score DECIMAL(5, 2) NOT NULL,
    weights_json JSONB NOT NULL,
    scores_breakdown_json JSONB NOT NULL,
    calculated_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_project_devis UNIQUE (project_id, devis_id),
    INDEX idx_project_id (project_id),
    INDEX idx_devis_id (devis_id),
    INDEX idx_grade_letter (grade_letter),
    INDEX idx_weighted_score (weighted_score)
  );

  CREATE INDEX IF NOT EXISTS idx_scoring_profiles_created_at
    ON scoring_profiles(created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_scoring_profiles_calculated_at
    ON scoring_profiles(calculated_at DESC);
`;

module.exports = {
  createScoringPersistenceAdapter,
  SCORING_PROFILES_MIGRATION,
};

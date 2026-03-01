/**
 * Scoring Persistence Adapter
 * Abstraction pour la persistence des profils de scoring avec bonus
 * Version: v1.1_stable - Supporte les bonus positifs et le versioning
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
      weightedScoreBrut,
      weightedScore,
      bonusPoints,
      bonusBreakdown,
      gradeLetter,
      weights,
      executionId,
      engineVersion,
      timestamp,
    } = result;

    // Préparer les données pour l'insertion
    const profileData = {
      project_id: projectId,
      devis_id: devisId,
      execution_id: executionId,
      weighted_score_brut: weightedScoreBrut,
      bonus_points: bonusPoints,
      weighted_score: weightedScore,
      grade_letter: gradeLetter,
      regulatory_score: scores.regulatory.score,
      risk_score: scores.risk.score,
      technical_score: scores.technical.score,
      transparency_score: scores.transparency.score,
      optimization_score: scores.optimization.score,
      weights_json: JSON.stringify(weights),
      scores_breakdown_json: JSON.stringify(scores),
      bonus_breakdown_json: JSON.stringify(bonusBreakdown || {}),
      engine_version: engineVersion,
      calculated_at: new Date(timestamp),
      created_at: new Date(),
    };

    // Utiliser UPSERT pour garantir l'idempotence
    const query = `
      INSERT INTO scoring_profiles (
        project_id,
        devis_id,
        execution_id,
        weighted_score_brut,
        bonus_points,
        weighted_score,
        grade_letter,
        regulatory_score,
        risk_score,
        technical_score,
        transparency_score,
        optimization_score,
        weights_json,
        scores_breakdown_json,
        bonus_breakdown_json,
        engine_version,
        calculated_at,
        created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
      )
      ON CONFLICT (project_id, devis_id) DO UPDATE SET
        execution_id = EXCLUDED.execution_id,
        weighted_score_brut = EXCLUDED.weighted_score_brut,
        bonus_points = EXCLUDED.bonus_points,
        weighted_score = EXCLUDED.weighted_score,
        grade_letter = EXCLUDED.grade_letter,
        regulatory_score = EXCLUDED.regulatory_score,
        risk_score = EXCLUDED.risk_score,
        technical_score = EXCLUDED.technical_score,
        transparency_score = EXCLUDED.transparency_score,
        optimization_score = EXCLUDED.optimization_score,
        weights_json = EXCLUDED.weights_json,
        scores_breakdown_json = EXCLUDED.scores_breakdown_json,
        bonus_breakdown_json = EXCLUDED.bonus_breakdown_json,
        engine_version = EXCLUDED.engine_version,
        calculated_at = EXCLUDED.calculated_at,
        updated_at = NOW()
      RETURNING id, weighted_score, bonus_points, grade_letter;
    `;

    const values = [
      profileData.project_id,
      profileData.devis_id,
      profileData.execution_id,
      profileData.weighted_score_brut,
      profileData.bonus_points,
      profileData.weighted_score,
      profileData.grade_letter,
      profileData.regulatory_score,
      profileData.risk_score,
      profileData.technical_score,
      profileData.transparency_score,
      profileData.optimization_score,
      profileData.weights_json,
      profileData.scores_breakdown_json,
      profileData.bonus_breakdown_json,
      profileData.engine_version,
      profileData.calculated_at,
      profileData.created_at,
    ];

    const result_query = await database.query(query, values);
    return result_query.rows[0];
  };
}

/**
 * Migration SQL pour créer la table scoring_profiles
 * Version: v1.1_stable - Inclut support des bonus et versioning
 * À exécuter une seule fois
 */
const SCORING_PROFILES_MIGRATION = `
  CREATE TABLE IF NOT EXISTS scoring_profiles (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL,
    devis_id VARCHAR(255) NOT NULL,
    execution_id VARCHAR(255) NOT NULL UNIQUE,
    weighted_score_brut DECIMAL(5, 2) NOT NULL,
    bonus_points DECIMAL(3, 1) NOT NULL DEFAULT 0,
    weighted_score DECIMAL(5, 2) NOT NULL,
    grade_letter CHAR(1) NOT NULL,
    regulatory_score DECIMAL(5, 2) NOT NULL,
    risk_score DECIMAL(5, 2) NOT NULL,
    technical_score DECIMAL(5, 2) NOT NULL,
    transparency_score DECIMAL(5, 2) NOT NULL,
    optimization_score DECIMAL(5, 2) NOT NULL,
    weights_json JSONB NOT NULL,
    scores_breakdown_json JSONB NOT NULL,
    bonus_breakdown_json JSONB DEFAULT NULL,
    engine_version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    calculated_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_project_devis UNIQUE (project_id, devis_id),
    CONSTRAINT check_final_score CHECK (weighted_score <= 100 AND weighted_score >= 0),
    CONSTRAINT check_bonus CHECK (bonus_points >= 0 AND bonus_points <= 5),
    INDEX idx_project_id (project_id),
    INDEX idx_devis_id (devis_id),
    INDEX idx_grade_letter (grade_letter),
    INDEX idx_weighted_score (weighted_score),
    INDEX idx_bonus_points (bonus_points),
    INDEX idx_engine_version (engine_version)
  );

  CREATE INDEX IF NOT EXISTS idx_scoring_profiles_created_at
    ON scoring_profiles(created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_scoring_profiles_calculated_at
    ON scoring_profiles(calculated_at DESC);

  CREATE INDEX IF NOT EXISTS idx_scoring_profiles_bonus_distribution
    ON scoring_profiles(bonus_points, weighted_score DESC);
`;

/**
 * Migration SQL pour ajouter les colonnes de bonus à une table existante
 * À utiliser si la table existe déjà en v1.0
 */
const SCORING_PROFILES_UPGRADE_MIGRATION = `
  -- Ajouter les colonnes bonus si elles n'existent pas
  ALTER TABLE scoring_profiles
    ADD COLUMN IF NOT EXISTS weighted_score_brut DECIMAL(5, 2),
    ADD COLUMN IF NOT EXISTS bonus_points DECIMAL(3, 1) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS bonus_breakdown_json JSONB,
    ADD COLUMN IF NOT EXISTS engine_version VARCHAR(20) DEFAULT 'v1.0';

  -- Migration des données existantes (si applicable)
  UPDATE scoring_profiles
    SET weighted_score_brut = weighted_score,
        bonus_points = 0,
        engine_version = 'v1.0'
    WHERE weighted_score_brut IS NULL;

  -- Ajouter les contraintes si elles n'existent pas
  ALTER TABLE scoring_profiles
    ADD CONSTRAINT check_final_score CHECK (weighted_score <= 100 AND weighted_score >= 0),
    ADD CONSTRAINT check_bonus CHECK (bonus_points >= 0 AND bonus_points <= 5);

  -- Ajouter les index pour les nouveaux champs
  CREATE INDEX IF NOT EXISTS idx_scoring_profiles_bonus_points
    ON scoring_profiles(bonus_points);

  CREATE INDEX IF NOT EXISTS idx_scoring_profiles_engine_version
    ON scoring_profiles(engine_version);

  CREATE INDEX IF NOT EXISTS idx_scoring_profiles_bonus_distribution
    ON scoring_profiles(bonus_points, weighted_score DESC);
`;

module.exports = {
  createScoringPersistenceAdapter,
  SCORING_PROFILES_MIGRATION,
  SCORING_PROFILES_UPGRADE_MIGRATION,
};

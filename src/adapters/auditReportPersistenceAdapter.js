/**
 * Audit Report Persistence Adapter
 * Abstraction pour la persistence des rapports d'audit dans la table audit_reports
 *
 * @module auditReportPersistenceAdapter
 */

/**
 * Crée un adaptateur de persistence pour la table audit_reports
 * @param {Object} database - Client database (pg, mysql, etc.)
 * @returns {Function} Fonction de persistence
 */
function createAuditReportPersistenceAdapter(database) {
  return async function persistAuditReport(report) {
    if (!database) {
      throw new Error('Database client is required for persistence');
    }

    const {
      auditId,
      projectId,
      devisId,
      userType,
      executiveSummary,
      strengths,
      weaknesses,
      recommendations,
      detailedAnalysis,
      regulatoryReferences,
      scoringProfile,
      timestamp,
    } = report;

    // Préparer les données pour l'insertion
    const reportData = {
      audit_id: auditId,
      project_id: projectId,
      devis_id: devisId,
      user_type: userType,
      executive_summary: executiveSummary,
      strengths_json: JSON.stringify(strengths),
      weaknesses_json: JSON.stringify(weaknesses),
      recommendations_json: JSON.stringify(recommendations),
      detailed_analysis_json: JSON.stringify(detailedAnalysis),
      regulatory_references_json: JSON.stringify(regulatoryReferences),
      scoring_profile_json: JSON.stringify(scoringProfile),
      weighted_score: scoringProfile.weightedScore,
      grade_letter: scoringProfile.gradeLetter,
      audit_timestamp: new Date(timestamp),
      created_at: new Date(),
    };

    // Utiliser UPSERT pour garantir l'idempotence
    const query = `
      INSERT INTO audit_reports (
        audit_id,
        project_id,
        devis_id,
        user_type,
        executive_summary,
        strengths_json,
        weaknesses_json,
        recommendations_json,
        detailed_analysis_json,
        regulatory_references_json,
        scoring_profile_json,
        weighted_score,
        grade_letter,
        audit_timestamp,
        created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      )
      ON CONFLICT (audit_id) DO UPDATE SET
        project_id = EXCLUDED.project_id,
        devis_id = EXCLUDED.devis_id,
        user_type = EXCLUDED.user_type,
        executive_summary = EXCLUDED.executive_summary,
        strengths_json = EXCLUDED.strengths_json,
        weaknesses_json = EXCLUDED.weaknesses_json,
        recommendations_json = EXCLUDED.recommendations_json,
        detailed_analysis_json = EXCLUDED.detailed_analysis_json,
        regulatory_references_json = EXCLUDED.regulatory_references_json,
        scoring_profile_json = EXCLUDED.scoring_profile_json,
        weighted_score = EXCLUDED.weighted_score,
        grade_letter = EXCLUDED.grade_letter,
        audit_timestamp = EXCLUDED.audit_timestamp,
        updated_at = NOW()
      RETURNING audit_id, weighted_score, grade_letter;
    `;

    const values = [
      reportData.audit_id,
      reportData.project_id,
      reportData.devis_id,
      reportData.user_type,
      reportData.executive_summary,
      reportData.strengths_json,
      reportData.weaknesses_json,
      reportData.recommendations_json,
      reportData.detailed_analysis_json,
      reportData.regulatory_references_json,
      reportData.scoring_profile_json,
      reportData.weighted_score,
      reportData.grade_letter,
      reportData.audit_timestamp,
      reportData.created_at,
    ];

    const result_query = await database.query(query, values);
    return result_query.rows[0];
  };
}

/**
 * Migration SQL pour créer la table audit_reports
 * À exécuter une seule fois
 */
const AUDIT_REPORTS_MIGRATION = `
  CREATE TABLE IF NOT EXISTS audit_reports (
    id SERIAL PRIMARY KEY,
    audit_id VARCHAR(255) NOT NULL UNIQUE,
    project_id VARCHAR(255) NOT NULL,
    devis_id VARCHAR(255) NOT NULL,
    user_type VARCHAR(10) NOT NULL CHECK (user_type IN ('B2B', 'B2C')),
    executive_summary TEXT NOT NULL,
    strengths_json JSONB NOT NULL,
    weaknesses_json JSONB NOT NULL,
    recommendations_json JSONB NOT NULL,
    detailed_analysis_json JSONB NOT NULL,
    regulatory_references_json JSONB NOT NULL,
    scoring_profile_json JSONB NOT NULL,
    weighted_score DECIMAL(5, 2) NOT NULL,
    grade_letter CHAR(1) NOT NULL CHECK (grade_letter IN ('A', 'B', 'C', 'D', 'E')),
    audit_timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_project_devis_audit UNIQUE (project_id, devis_id),
    INDEX idx_project_id (project_id),
    INDEX idx_devis_id (devis_id),
    INDEX idx_user_type (user_type),
    INDEX idx_grade_letter (grade_letter),
    INDEX idx_weighted_score (weighted_score)
  );

  CREATE INDEX IF NOT EXISTS idx_audit_reports_created_at
    ON audit_reports(created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_audit_reports_audit_timestamp
    ON audit_reports(audit_timestamp DESC);

  CREATE INDEX IF NOT EXISTS idx_audit_reports_grade_letter_timestamp
    ON audit_reports(grade_letter, audit_timestamp DESC);
`;

/**
 * Crée un adaptateur de lecture pour les rapports d'audit
 * @param {Object} database - Client database
 * @returns {Object} Objet avec fonctions de lecture
 */
function createAuditReportReader(database) {
  return {
    /**
     * Récupère un rapport par audit ID
     */
    getByAuditId: async (auditId) => {
      const query = 'SELECT * FROM audit_reports WHERE audit_id = $1';
      const result = await database.query(query, [auditId]);
      return result.rows[0] || null;
    },

    /**
     * Récupère tous les rapports pour un devis
     */
    getByDevisId: async (devisId) => {
      const query = `
        SELECT * FROM audit_reports
        WHERE devis_id = $1
        ORDER BY audit_timestamp DESC
      `;
      const result = await database.query(query, [devisId]);
      return result.rows;
    },

    /**
     * Récupère tous les rapports pour un projet
     */
    getByProjectId: async (projectId) => {
      const query = `
        SELECT * FROM audit_reports
        WHERE project_id = $1
        ORDER BY audit_timestamp DESC
      `;
      const result = await database.query(query, [projectId]);
      return result.rows;
    },

    /**
     * Récupère les rapports par grade
     */
    getByGrade: async (grade, limit = 100) => {
      const query = `
        SELECT * FROM audit_reports
        WHERE grade_letter = $1
        ORDER BY audit_timestamp DESC
        LIMIT $2
      `;
      const result = await database.query(query, [grade, limit]);
      return result.rows;
    },

    /**
     * Récupère les rapports récents
     */
    getRecent: async (days = 7, limit = 100) => {
      const query = `
        SELECT * FROM audit_reports
        WHERE created_at >= NOW() - INTERVAL '${days} days'
        ORDER BY audit_timestamp DESC
        LIMIT $1
      `;
      const result = await database.query(query, [limit]);
      return result.rows;
    },

    /**
     * Récupère les rapports nécessitant attention
     */
    getAlertsRequired: async (limit = 50) => {
      const query = `
        SELECT * FROM audit_reports
        WHERE grade_letter IN ('C', 'D', 'E')
        ORDER BY weighted_score ASC, audit_timestamp DESC
        LIMIT $1
      `;
      const result = await database.query(query, [limit]);
      return result.rows;
    },

    /**
     * Obtient les statistiques des rapports
     */
    getStatistics: async (projectId = null) => {
      let whereClause = '';
      const params = [];

      if (projectId) {
        whereClause = 'WHERE project_id = $1';
        params.push(projectId);
      }

      const query = `
        SELECT
          COUNT(*) as total_reports,
          AVG(weighted_score) as avg_score,
          COUNT(CASE WHEN grade_letter = 'A' THEN 1 END) as count_a,
          COUNT(CASE WHEN grade_letter = 'B' THEN 1 END) as count_b,
          COUNT(CASE WHEN grade_letter = 'C' THEN 1 END) as count_c,
          COUNT(CASE WHEN grade_letter = 'D' THEN 1 END) as count_d,
          COUNT(CASE WHEN grade_letter = 'E' THEN 1 END) as count_e,
          MIN(weighted_score) as min_score,
          MAX(weighted_score) as max_score
        FROM audit_reports
        ${whereClause}
      `;

      const result = await database.query(query, params);
      return result.rows[0];
    },
  };
}

module.exports = {
  createAuditReportPersistenceAdapter,
  createAuditReportReader,
  AUDIT_REPORTS_MIGRATION,
};

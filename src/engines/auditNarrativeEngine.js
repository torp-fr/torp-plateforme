/**
 * Audit Narrative Engine
 * Générateur de rapports narratifs structurés et audit-proof
 *
 * @module auditNarrativeEngine
 * @requires logger
 * @requires llmProvider (optional)
 */

/**
 * Configuration des règles narratives basées sur les scores
 * @constant {Object}
 */
const NARRATIVE_RULES = {
  regulatory: {
    critical: { threshold: 50, severity: 'CRITICAL', action: 'require_immediate_action' },
    high: { threshold: 70, severity: 'HIGH', action: 'require_attention' },
    medium: { threshold: 85, severity: 'MEDIUM', action: 'monitor' },
  },
  risk: {
    critical: { threshold: 40, severity: 'CRITICAL', action: 'escalate' },
    high: { threshold: 60, severity: 'HIGH', action: 'address_before_signature' },
    medium: { threshold: 75, severity: 'MEDIUM', action: 'plan_mitigation' },
  },
  technical: {
    high: { threshold: 70, severity: 'HIGH', action: 'clarify' },
    medium: { threshold: 85, severity: 'MEDIUM', action: 'improve' },
  },
  transparency: {
    high: { threshold: 85, severity: 'POSITIVE', action: 'celebrate' },
    medium: { threshold: 70, severity: 'MEDIUM', action: 'enhance' },
  },
  optimization: {
    positive: { threshold: 80, severity: 'POSITIVE', action: 'highlight' },
  },
};

/**
 * Configuration des contextes réglementaires par exposition
 * @constant {Object}
 */
const REGULATORY_CONTEXT_LEVELS = {
  LOW: {
    threshold: 25,
    label: 'Low regulatory complexity',
    label_fr: 'Complexité réglementaire faible',
    description_b2b: 'Framework réglementaire simple avec peu de contraintes. Dossier applicable facilement gérable.',
    description_b2c: 'Peu de règles à respecter. C\'est simple.',
    icon: '🟢',
  },
  MODERATE: {
    threshold: 50,
    label: 'Moderate regulatory framework',
    label_fr: 'Cadre réglementaire modéré',
    description_b2b: 'Framework réglementaire équilibré avec obligations modérées. Couverture standard requise.',
    description_b2c: 'Un niveau normal de règles et protections. C\'est l\'équilibre habituel.',
    icon: '🟡',
  },
  HIGH: {
    threshold: 75,
    label: 'High regulatory constraint',
    label_fr: 'Contrainte réglementaire élevée',
    description_b2b: 'Framework réglementaire strict avec obligations substantielles. Couverture exhaustive requise.',
    description_b2c: 'Beaucoup de règles à respecter. Vous devez être prudent.',
    icon: '🟠',
  },
  VERY_HIGH: {
    threshold: 101,
    label: 'Very high regulatory constraint',
    label_fr: 'Contrainte réglementaire très élevée',
    description_b2b: 'Framework réglementaire complexe avec obligations étendues et contraintes multiples. Audit de conformité spécialisé fortement recommandé.',
    description_b2c: 'Beaucoup de règles complexes. Vous devez être très attentif.',
    icon: '🔴',
  },
};

/**
 * Références réglementaires BTP structurées
 * @constant {Object}
 */
const REGULATORY_REFERENCES = {
  RGPD: {
    shortCode: 'RGPD',
    title: 'Règlement Général sur la Protection des Données',
    applicability: 'Traitement de données personnelles dans les contrats',
    confidence: 'high',
  },
  CNIL: {
    shortCode: 'CNIL',
    title: 'Commission Nationale de l\'Informatique et des Libertés',
    applicability: 'Conformité de clauses de protection de données',
    confidence: 'high',
  },
  CCAG: {
    shortCode: 'CCAG',
    title: 'Cahier des Clauses Administratives Générales',
    applicability: 'Marchés publics français et privés BTP',
    confidence: 'medium',
  },
  CCAP: {
    shortCode: 'CCAP',
    title: 'Cahier des Clauses Administratives Particulières',
    applicability: 'Conditions spécifiques aux marchés publics',
    confidence: 'medium',
  },
  RTD: {
    shortCode: 'RTD',
    title: 'Règles de Tenue de Documents',
    applicability: 'Traçabilité et archivage réglementaire',
    confidence: 'medium',
  },
  CODE_COMMERCE: {
    shortCode: 'CC',
    title: 'Code de Commerce - Article L441',
    applicability: 'Délais de paiement et conditions commerciales',
    confidence: 'high',
  },
  SECURITE_TRAVAIL: {
    shortCode: 'CNAM',
    title: 'Code du Travail - Sécurité et santé',
    applicability: 'Conditions de travail et responsabilités',
    confidence: 'medium',
  },
};

/**
 * Templates narratifs par type d'utilisateur
 * @constant {Object}
 */
const NARRATIVE_TEMPLATES = {
  B2B: {
    strengths: {
      high_compliance: 'Conformité réglementaire solide : les clauses essentielles sont présentes et structurées selon les standards BTP.',
      low_risk: 'Profil de risque maîtrisé : les éléments critiques sont couverts avec des mesures d\'atténuation appropriées.',
      excellent_clarity: 'Documentation exceptionnelle : les termes, délais et responsabilités sont explicitement définis.',
      good_technical: 'Architecture technique alignée : infrastructure et responsabilités opérationnelles sont cohérentes.',
    },
    weaknesses: {
      regulatory_gaps: 'Lacunes réglementaires détectées : certaines clauses obligatoires pour la conformité sont absentes.',
      critical_risks: 'Exposition aux risques significative : les mécanismes de protection sont insuffisants.',
      technical_misalignment: 'Incohérences techniques : divergences entre spécifications et conditions contractuelles.',
      poor_transparency: 'Manque de clarté : les obligations et responsabilités ne sont pas explicitement définies.',
    },
    recommendations: {
      immediate: 'Action urgente requise avant signature : correction des éléments critiques.',
      short_term: 'À adresser dans les 2-3 semaines : clarifications et ajustements importants.',
      medium_term: 'Amélioration progressive : optimisation des processus et documentation.',
      monitoring: 'À surveiller : mise en place d\'indicateurs de conformité continue.',
    },
  },
  B2C: {
    strengths: {
      high_compliance: 'Votre devis respecte les règles importantes : vous êtes bien protégé.',
      low_risk: 'Les risques sont bien gérés : vous avez de bonnes garanties.',
      excellent_clarity: 'C\'est clair et transparent : vous comprenez exactement ce qui est facturé.',
      good_technical: 'Les solutions proposées sont appropriées pour votre projet.',
    },
    weaknesses: {
      regulatory_gaps: 'Quelques points à vérifier : certains éléments de protection manquent.',
      critical_risks: 'Attention : certains risques ne sont pas suffisamment couverts.',
      technical_misalignment: 'Certains détails techniques ne sont pas explicitement expliqués.',
      poor_transparency: 'Certains points méritent d\'être clarifiés avec le prestataire.',
    },
    recommendations: {
      immediate: 'À faire avant de signer : poser ces questions au prestataire.',
      short_term: 'À clarifier rapidement : demander des précisions par écrit.',
      medium_term: 'À améliorer : suggérer des ajustements pour votre tranquillité.',
      monitoring: 'À surveiller : vérifier que tout se passe selon le contrat.',
    },
  },
};

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
 * Validation des entrées du moteur d'audit
 * @param {Object} input - Données d'entrée
 * @returns {Object} { isValid: boolean, errors: Array<string> }
 */
function validateAuditInput(input) {
  const errors = [];

  if (!input || typeof input !== 'object') {
    errors.push('Input doit être un objet');
    return { isValid: false, errors };
  }

  // Validation scoringProfile
  if (!input.scoringProfile || typeof input.scoringProfile !== 'object') {
    errors.push('scoringProfile est requis et doit être un objet');
  } else {
    const { scores, weightedScore, gradeLetter } = input.scoringProfile;
    if (!scores || typeof scores !== 'object') {
      errors.push('scoringProfile.scores doit être un objet');
    }
    if (typeof weightedScore !== 'number' || weightedScore < 0 || weightedScore > 100) {
      errors.push('scoringProfile.weightedScore doit être un nombre entre 0 et 100');
    }
    if (!['A', 'B', 'C', 'D', 'E'].includes(gradeLetter)) {
      errors.push('scoringProfile.gradeLetter doit être A, B, C, D ou E');
    }
  }

  // Validation analysisData
  if (!input.analysisData || typeof input.analysisData !== 'object') {
    errors.push('analysisData est requis et doit être un objet');
  }

  // Validation projectContext
  if (!input.projectContext || typeof input.projectContext !== 'object') {
    errors.push('projectContext est requis et doit être un objet');
  } else {
    if (!input.projectContext.projectId || typeof input.projectContext.projectId !== 'string') {
      errors.push('projectContext.projectId est requis');
    }
    if (!input.projectContext.devisId || typeof input.projectContext.devisId !== 'string') {
      errors.push('projectContext.devisId est requis');
    }
  }

  // Validation userProfile
  if (!input.userProfile || typeof input.userProfile !== 'object') {
    errors.push('userProfile est requis et doit être un objet');
  } else {
    if (!['B2B', 'B2C'].includes(input.userProfile.type)) {
      errors.push('userProfile.type doit être B2B ou B2C');
    }
  }

  // Validation optionnelle de regulatoryExposureData
  if (input.regulatoryExposureData) {
    if (typeof input.regulatoryExposureData !== 'object') {
      errors.push('regulatoryExposureData doit être un objet');
    } else {
      if (!Number.isInteger(input.regulatoryExposureData.exposure_index) ||
          input.regulatoryExposureData.exposure_index < 0 ||
          input.regulatoryExposureData.exposure_index > 100) {
        errors.push('regulatoryExposureData.exposure_index doit être un entier entre 0 et 100');
      }
      if (!Number.isInteger(input.regulatoryExposureData.applicable_count) ||
          input.regulatoryExposureData.applicable_count < 0) {
        errors.push('regulatoryExposureData.applicable_count doit être un entier positif');
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Analyse déterministe basée sur les scores
 * Génère les points clés sans intervention LLM
 * @param {Object} scoringProfile - Profil de scoring
 * @param {Object} analysisData - Données d'analyse
 * @returns {Object} Analyse déterministe
 */
function performDeterministicAnalysis(scoringProfile, analysisData) {
  const { scores, weightedScore, gradeLetter } = scoringProfile;
  const analysis = {
    keyInsights: [],
    severityMatrix: {},
    actionItems: [],
    positiveHighlights: [],
  };

  // Analyse réglementaire
  if (scores.regulatory.score < 50) {
    analysis.keyInsights.push({
      theme: 'regulatory',
      severity: 'CRITICAL',
      message: 'Conformité réglementaire critique : intervention immédiate requise',
    });
    analysis.actionItems.push({
      priority: 'P0',
      theme: 'regulatory',
      action: 'Corriger les lacunes réglementaires avant toute signature',
    });
  } else if (scores.regulatory.score < 70) {
    analysis.keyInsights.push({
      theme: 'regulatory',
      severity: 'HIGH',
      message: 'Conformité réglementaire insuffisante : vigilance requise',
    });
    analysis.actionItems.push({
      priority: 'P1',
      theme: 'regulatory',
      action: 'Renforcer la couverture réglementaire dans les clauses essentielles',
    });
  }

  // Analyse risques
  if (scores.risk.score < 40) {
    analysis.keyInsights.push({
      theme: 'risk',
      severity: 'CRITICAL',
      message: 'Exposition aux risques critique : escalade décisionnaire requise',
    });
    analysis.actionItems.push({
      priority: 'P0',
      theme: 'risk',
      action: 'Mettre en place des mécanismes de protection avant engagement',
    });
  } else if (scores.risk.score < 60) {
    analysis.keyInsights.push({
      theme: 'risk',
      severity: 'HIGH',
      message: 'Profil de risque significatif : atténuation requise',
    });
    analysis.actionItems.push({
      priority: 'P1',
      theme: 'risk',
      action: 'Développer un plan de mitigation pour les risques identifiés',
    });
  }

  // Analyse technique
  if (scores.technical.score < 70) {
    analysis.keyInsights.push({
      theme: 'technical',
      severity: 'HIGH',
      message: 'Incohérences techniques détectées : clarification requise',
    });
    analysis.actionItems.push({
      priority: 'P1',
      theme: 'technical',
      action: 'Aligner les spécifications techniques avec les conditions contractuelles',
    });
  }

  // Analyse transparence
  if (scores.transparency.score > 85) {
    analysis.positiveHighlights.push({
      theme: 'transparency',
      message: 'Excellente clarté du devis : termes explicitement définis',
    });
  } else if (scores.transparency.score < 70) {
    analysis.keyInsights.push({
      theme: 'transparency',
      severity: 'MEDIUM',
      message: 'Manque de clarté : certains éléments doivent être explicités',
    });
    analysis.actionItems.push({
      priority: 'P2',
      theme: 'transparency',
      action: 'Demander des clarifications sur les points ambigus',
    });
  }

  // Grade-based insights
  if (gradeLetter === 'A') {
    analysis.positiveHighlights.push({
      theme: 'global',
      message: 'Profil d\'excellence : devis bien structuré et équilibré',
    });
  } else if (gradeLetter === 'B') {
    analysis.positiveHighlights.push({
      theme: 'global',
      message: 'Profil satisfaisant : quelques optimisations possibles',
    });
  } else if (gradeLetter <= 'C') {
    analysis.keyInsights.push({
      theme: 'global',
      severity: 'HIGH',
      message: 'Profil d\'audit : axes prioritaires d\'amélioration identifiés',
    });
  }

  // Comptage des findings
  const findingsSummary = {
    regulatory: {
      total: (analysisData.regulatoryFindings?.missingClauses?.length || 0) +
             (analysisData.regulatoryFindings?.invalidReferences?.length || 0) +
             (analysisData.regulatoryFindings?.nonCompliantItems?.length || 0),
    },
    risk: {
      total: (analysisData.riskFindings?.criticalRisks?.length || 0) +
             (analysisData.riskFindings?.moderateRisks?.length || 0),
    },
    technical: {
      total: (analysisData.technicalFindings?.incoherences?.length || 0) +
             (analysisData.technicalFindings?.omissions?.length || 0),
    },
    transparency: {
      total: (analysisData.transparencyFindings?.unclearLines?.length || 0) +
             (analysisData.transparencyFindings?.missingDetails?.length || 0),
    },
    optimization: {
      total: analysisData.optimizationFindings?.improvementOpportunities?.length || 0,
    },
  };

  return {
    ...analysis,
    findingsSummary,
    scoreThresholdAnalysis: {
      regulatory: {
        score: scores.regulatory.score,
        isCompliant: scores.regulatory.score >= 70,
      },
      risk: {
        score: scores.risk.score,
        isManaged: scores.risk.score >= 60,
      },
      technical: {
        score: scores.technical.score,
        isAligned: scores.technical.score >= 70,
      },
      transparency: {
        score: scores.transparency.score,
        isClear: scores.transparency.score >= 85,
      },
    },
  };
}

/**
 * Génère les sections narratives basées sur l'analyse déterministe
 * @param {string} userType - B2B ou B2C
 * @param {Object} deterministicAnalysis - Analyse déterministe
 * @param {Object} scores - Scores thématiques
 * @returns {Object} Sections narratives
 */
function generateNarrativeSections(userType, deterministicAnalysis, scores) {
  const templates = NARRATIVE_TEMPLATES[userType];
  const sections = {
    strengths: [],
    weaknesses: [],
    recommendations: [],
  };

  // Strengths basées sur l'analyse déterministe
  if (scores.regulatory.score >= 80) {
    sections.strengths.push(templates.strengths.high_compliance);
  }
  if (scores.risk.score >= 70) {
    sections.strengths.push(templates.strengths.low_risk);
  }
  if (scores.transparency.score > 85) {
    sections.strengths.push(templates.strengths.excellent_clarity);
  }
  if (scores.technical.score >= 75) {
    sections.strengths.push(templates.strengths.good_technical);
  }

  // Weaknesses basées sur l'analyse déterministe
  if (scores.regulatory.score < 70) {
    sections.weaknesses.push(templates.weaknesses.regulatory_gaps);
  }
  if (scores.risk.score < 60) {
    sections.weaknesses.push(templates.weaknesses.critical_risks);
  }
  if (scores.technical.score < 70) {
    sections.weaknesses.push(templates.weaknesses.technical_misalignment);
  }
  if (scores.transparency.score < 70) {
    sections.weaknesses.push(templates.weaknesses.poor_transparency);
  }

  // Recommendations basées sur action items
  const actionItems = deterministicAnalysis.actionItems;
  const p0Items = actionItems.filter(item => item.priority === 'P0');
  const p1Items = actionItems.filter(item => item.priority === 'P1');
  const p2Items = actionItems.filter(item => item.priority === 'P2');

  if (p0Items.length > 0) {
    sections.recommendations.push({
      priority: 'IMMEDIATE',
      text: templates.recommendations.immediate,
      count: p0Items.length,
    });
  }
  if (p1Items.length > 0) {
    sections.recommendations.push({
      priority: 'SHORT_TERM',
      text: templates.recommendations.short_term,
      count: p1Items.length,
    });
  }
  if (p2Items.length > 0) {
    sections.recommendations.push({
      priority: 'MEDIUM_TERM',
      text: templates.recommendations.medium_term,
      count: p2Items.length,
    });
  }
  if (scores.transparency.score >= 70 && scores.regulatory.score >= 70) {
    sections.recommendations.push({
      priority: 'MONITORING',
      text: templates.recommendations.monitoring,
      count: 1,
    });
  }

  return sections;
}

/**
 * Génère un résumé exécutif déterministe
 * @param {Object} scoringProfile - Profil de scoring
 * @param {string} userType - B2B ou B2C
 * @param {Object} projectContext - Contexte du projet
 * @param {Object} regulatoryExposureData - Données d'exposition réglementaire (optionnel)
 * @returns {string} Résumé exécutif
 */
function generateExecutiveSummary(scoringProfile, userType, projectContext, regulatoryExposureData) {
  const { weightedScore, gradeLetter } = scoringProfile;
  const isB2B = userType === 'B2B';

  let summary = '';

  if (isB2B) {
    summary = `Audit du devis ${projectContext.devisId} (Projet: ${projectContext.projectId})\n`;
    summary += `Score de conformité global: ${weightedScore}/100 - Grade ${gradeLetter}\n\n`;

    if (gradeLetter === 'A') {
      summary += `Le devis présente un profil d'excellence. Les clauses essentielles sont présentes, les risques sont maîtrisés, et la documentation technique est cohérente et transparente. Ce profil ne nécessite que des optimisations mineures avant engagement.`;
    } else if (gradeLetter === 'B') {
      summary += `Le devis présente un profil satisfaisant. Les éléments critiques sont couverts, mais certaines améliorations sont recommandées pour renforcer la protection contractuelle et la clarté des termes.`;
    } else if (gradeLetter === 'C') {
      summary += `Le devis présente des lacunes significatives. Des corrections importantes sont requises avant signature, notamment en matière de conformité réglementaire et de gestion des risques.`;
    } else if (gradeLetter === 'D') {
      summary += `Le devis présente un profil d'audit critique. Une intervention immédiate est requise pour corriger les écarts réglementaires et les risques non maîtrisés.`;
    } else {
      summary += `Le devis présente des défaillances majeures. Un rejet ou une reformulation complète est recommandée.`;
    }

    // Injection du contexte réglementaire pour B2B
    if (regulatoryExposureData && Number.isInteger(regulatoryExposureData.exposure_index)) {
      const exposureIndex = regulatoryExposureData.exposure_index;
      const applicableCount = regulatoryExposureData.applicable_count || 0;
      const highAuthorityCount = regulatoryExposureData.high_authority_count || 0;
      const amplificationFactor = calculateAmplificationFactor(exposureIndex);

      summary += `\n\nREGULATORY ENVIRONMENT: This audit evaluates the quote within its authentic regulatory context. ${applicableCount} applicable regulation(s) have been identified, including ${highAuthorityCount} high-authority standards. The compliance penalties are amplified by a factor of ${amplificationFactor.toFixed(2)} to reflect the regulatory complexity of this project.`;
    }
  } else {
    // B2C
    summary = `Analyse de votre devis (${projectContext.devisId})\n`;
    summary += `Note de confiance: ${weightedScore}/100 - Avis ${gradeLetter}\n\n`;

    if (gradeLetter === 'A') {
      summary += `Excellent ! Votre devis est clair, transparent et bien protégé. Vous avez une bonne compréhension de ce que vous allez payer et vous êtes bien couvert contractuellement. Vous pouvez signer en confiance.`;
    } else if (gradeLetter === 'B') {
      summary += `Bon devis. Les éléments importants sont présents, mais quelques clarifications seraient utiles pour votre tranquillité. Nous vous recommandons de poser quelques questions avant de signer.`;
    } else if (gradeLetter === 'C') {
      summary += `Devis à améliorer. Certains points manquent de clarté et certaines protections sont insuffisantes. Avant de signer, demandez des précisions et des ajustements.`;
    } else if (gradeLetter === 'D') {
      summary += `Attention requise. Votre devis présente plusieurs zones de risque. Ne signez pas avant d'avoir clarifié les points problématiques avec le prestataire.`;
    } else {
      summary += `À rejeter ou reformuler. Trop de problèmes graves. Relancez le prestataire pour un nouveau devis mieux protecteur.`;
    }

    // Injection du contexte réglementaire pour B2C
    if (regulatoryExposureData && Number.isInteger(regulatoryExposureData.exposure_index)) {
      const exposureIndex = regulatoryExposureData.exposure_index;
      const applicableCount = regulatoryExposureData.applicable_count || 0;

      summary += `\n\nVotre projet s'inscrit dans un cadre réglementaire avec ${applicableCount} règle(s) applicable(s). Cela n'indique pas automatiquement un problème, mais cela signifie que votre projet opère dans un environnement plus réglementé et nécessite donc une attention particulière.`;

      if (exposureIndex > 75) {
        summary += ` Cela ne signifie pas automatiquement qu'il y a un problème, mais cela signifie que plus d'attention est requise avant de signer.`;
      }
    }
  }

  return summary;
}

/**
 * Identifie les références réglementaires pertinentes
 * @param {Object} analysisData - Données d'analyse
 * @param {Object} scores - Scores thématiques
 * @returns {Array} Références réglementaires pertinentes
 */
function identifyRegulatoryReferences(analysisData, scores) {
  const references = [];

  // RGPD si données personnelles menacées
  if (analysisData.regulatoryFindings?.nonCompliantItems?.some(item =>
    item.toLowerCase().includes('donnée') ||
    item.toLowerCase().includes('rgpd') ||
    item.toLowerCase().includes('personnel'))) {
    references.push({
      ...REGULATORY_REFERENCES.RGPD,
      reason: 'Traitement de données personnelles détecté',
    });
  }

  // CCAG pour contrats BTP publics
  if (analysisData.analysisContext?.isPublicMarket) {
    references.push({
      ...REGULATORY_REFERENCES.CCAG,
      reason: 'Marché public identifié',
    });
  }

  // Code de Commerce si délais de paiement
  if (analysisData.regulatoryFindings?.missingClauses?.some(item =>
    item.toLowerCase().includes('paiement') ||
    item.toLowerCase().includes('délai'))) {
    references.push({
      ...REGULATORY_REFERENCES.CODE_COMMERCE,
      reason: 'Conditions de paiement à vérifier',
    });
  }

  // Sécurité du travail si travaux sur site
  if (analysisData.analysisContext?.includesOnSiteWork) {
    references.push({
      ...REGULATORY_REFERENCES.SECURITE_TRAVAIL,
      reason: 'Travaux sur site impliquant responsabilités de sécurité',
    });
  }

  // RTD si archivage important
  if (analysisData.technicalFindings?.omissions?.some(item =>
    item.toLowerCase().includes('archive') ||
    item.toLowerCase().includes('tenue de documents'))) {
    references.push({
      ...REGULATORY_REFERENCES.RTD,
      reason: 'Archivage et traçabilité contractuels',
    });
  }

  // Si pas de références automatiques, ajouter les références générales
  if (references.length === 0) {
    references.push({
      ...REGULATORY_REFERENCES.CCAG,
      reason: 'Référence générale pour contrats BTP',
    });
  }

  return references;
}

/**
 * Détermine le niveau de contexte réglementaire basé sur l'indice d'exposition
 * @param {number} exposureIndex - Indice d'exposition (0-100)
 * @returns {Object} Configuration du niveau de contexte
 */
function determineContextLevel(exposureIndex) {
  if (exposureIndex < 25) {
    return REGULATORY_CONTEXT_LEVELS.LOW;
  } else if (exposureIndex >= 25 && exposureIndex <= 50) {
    return REGULATORY_CONTEXT_LEVELS.MODERATE;
  } else if (exposureIndex > 50 && exposureIndex <= 75) {
    return REGULATORY_CONTEXT_LEVELS.HIGH;
  } else {
    return REGULATORY_CONTEXT_LEVELS.VERY_HIGH;
  }
}

/**
 * Calcule le facteur d'amplification des pénalités réglementaires
 * Formule: 1 + (exposure_index / 100)
 * @param {number} exposureIndex - Indice d'exposition (0-100)
 * @returns {number} Facteur d'amplification arrondi à 2 décimales
 */
function calculateAmplificationFactor(exposureIndex) {
  if (!Number.isInteger(exposureIndex) || exposureIndex < 0 || exposureIndex > 100) {
    return 1.0;
  }
  const factor = 1 + (exposureIndex / 100);
  return Math.min(Math.round(factor * 100) / 100, 2.0);
}

/**
 * Détermine le niveau de sensibilité de conformité basé sur l'indice d'exposition
 * @param {number} exposureIndex - Indice d'exposition (0-100)
 * @returns {string} Niveau de sensibilité: "standard" | "elevated" | "critical"
 */
function determineComplianceSensitivity(exposureIndex) {
  if (exposureIndex < 25) {
    return 'standard';
  } else if (exposureIndex >= 25 && exposureIndex <= 75) {
    return 'elevated';
  } else {
    return 'critical';
  }
}

/**
 * Génère l'indicateur de pression réglementaire
 * @param {number} exposureIndex - Indice d'exposition (0-100)
 * @param {number} amplificationFactor - Facteur d'amplification
 * @returns {Object} Indicateur de pression structuré
 */
function generateRegulatoryPressureIndicator(exposureIndex, amplificationFactor) {
  return {
    pressureScore: exposureIndex,
    riskAmplificationLevel: amplificationFactor,
    complianceSensitivity: determineComplianceSensitivity(exposureIndex),
  };
}

/**
 * Génère une explication narrative de l'amplification des pénalités
 * @param {string} userType - B2B ou B2C
 * @param {number} exposureIndex - Indice d'exposition
 * @param {number} amplificationFactor - Facteur d'amplification
 * @returns {string} Explication narrative
 */
function generateAmplificationExplanation(userType, exposureIndex, amplificationFactor) {
  const isB2B = userType === 'B2B';

  if (amplificationFactor <= 1.0) {
    return isB2B
      ? 'Faible exposition réglementaire : pénalités non amplifiées.'
      : 'Peu de règles s\'appliquent : pas d\'amplification des pénalités.';
  }

  const percentage = Math.round((amplificationFactor - 1) * 100);

  if (isB2B) {
    return `Exposition réglementaire modérée à élevée : les pénalités liées à la conformité sont amplifiées de ${percentage}% pour refléter la complexité du cadre réglementaire applicable. Cela signifie que chaque manquement réglementaire a un impact augmenté sur le score, en fonction du nombre et de la sévérité des obligations réglementaires pertinentes.`;
  } else {
    return `Vous devez respecter plusieurs règles : chaque problème de conformité compte ${percentage}% plus lourd. Plus il y a de règles à respecter, plus chaque problème devient important.`;
  }
}

/**
 * Génère l'impact du score de l'amplification réglementaire
 * @param {string} userType - B2B ou B2C
 * @param {number} amplificationFactor - Facteur d'amplification
 * @returns {string} Explication de l'impact sur le score
 */
function generateScoringImpactExplanation(userType, amplificationFactor) {
  const isB2B = userType === 'B2B';

  if (amplificationFactor <= 1.0) {
    return isB2B
      ? 'Score réglementaire calculé sans amplification.'
      : 'Votre score est calculé normalement.';
  }

  if (isB2B) {
    return `Le score réglementaire intègre un facteur d'amplification de ${amplificationFactor.toFixed(2)}. Cela reflète le fait que dans un environnement hautement réglementé, les écarts de conformité ont des conséquences disproportionnées. Les pénalités pour non-conformité sont multipliées par ce facteur, réduisant potentiellement le score global de manière plus significative que dans un cadre réglementaire simple.`;
  } else {
    return `Votre score tient compte d'un multiplicateur de ${amplificationFactor.toFixed(2)}. Cela signifie que chaque problème compte plus lourd parce que vous devez respecter beaucoup de règles. C'est pourquoi il est important de tout vérifier quand il y a beaucoup de contraintes réglementaires.`;
  }
}

/**
 * Génère le contexte réglementaire complet
 * @param {Object} regulatoryExposureData - Données d'exposition réglementaire
 * @param {string} userType - B2B ou B2C
 * @returns {Object} Contexte réglementaire structuré
 */
function generateRegulatoryContext(regulatoryExposureData, userType) {
  if (!regulatoryExposureData || !Number.isInteger(regulatoryExposureData.exposure_index)) {
    return null;
  }

  const exposureIndex = regulatoryExposureData.exposure_index;
  const contextLevel = determineContextLevel(exposureIndex);
  const amplificationFactor = calculateAmplificationFactor(exposureIndex);

  return {
    exposureIndex,
    applicableRegulations: regulatoryExposureData.applicable_count || 0,
    highAuthorityRegulations: regulatoryExposureData.high_authority_count || 0,
    amplificationFactor,
    contextLevel: contextLevel.label,
    contextLevelFr: contextLevel.label_fr,
    contextIcon: contextLevel.icon,
    narrativeExplanation: userType === 'B2B'
      ? contextLevel.description_b2b
      : contextLevel.description_b2c,
    amplificationExplanation: generateAmplificationExplanation(userType, exposureIndex, amplificationFactor),
    scoringImpactExplanation: generateScoringImpactExplanation(userType, amplificationFactor),
  };
}

/**
 * Moteur d'audit narratif principal
 * @param {Object} input - Données d'entrée
 * @param {Object} options - Options de configuration
 * @param {Function} options.persistenceAdapter - Fonction pour persister les résultats
 * @param {Function} options.llmProvider - Provider LLM optionnel pour enrichissement
 * @returns {Promise<Object>} Rapport d'audit complet
 */
async function generateAuditNarrative(input, options = {}) {
  const logger = createLogger();

  const startTime = Date.now();
  const auditId = generateAuditId();

  logger.info('Démarrage de la génération du rapport d\'audit', {
    auditId,
    projectId: input.projectContext.projectId,
    devisId: input.projectContext.devisId,
    userType: input.userProfile.type,
  });

  try {
    // Validation des entrées
    const inputValidation = validateAuditInput(input);
    if (!inputValidation.isValid) {
      logger.error('Validation des entrées échouée', {
        auditId,
        errors: inputValidation.errors,
      });
      throw new Error(`Validation échouée: ${inputValidation.errors.join('; ')}`);
    }

    // Analyse déterministe
    const deterministicAnalysis = performDeterministicAnalysis(
      input.scoringProfile,
      input.analysisData,
    );

    logger.debug('Analyse déterministe complétée', {
      auditId,
      keyInsightsCount: deterministicAnalysis.keyInsights.length,
      actionItemsCount: deterministicAnalysis.actionItems.length,
    });

    // Génération des sections narratives
    const narrativeSections = generateNarrativeSections(
      input.userProfile.type,
      deterministicAnalysis,
      input.scoringProfile.scores,
    );

    // Génération du résumé exécutif
    const executiveSummary = generateExecutiveSummary(
      input.scoringProfile,
      input.userProfile.type,
      input.projectContext,
      input.regulatoryExposureData,
    );

    // Identification des références réglementaires
    const regulatoryReferences = identifyRegulatoryReferences(
      input.analysisData,
      input.scoringProfile.scores,
    );

    // Génération du contexte réglementaire (si exposition fournie)
    const regulatoryContext = input.regulatoryExposureData
      ? generateRegulatoryContext(input.regulatoryExposureData, input.userProfile.type)
      : null;

    logger.debug('Contexte réglementaire généré', {
      auditId,
      hasRegulatoryContext: !!regulatoryContext,
      contextLevel: regulatoryContext?.contextLevel,
      amplificationFactor: regulatoryContext?.amplificationFactor,
    });

    // Génération de l'analyse détaillée par thème
    const detailedAnalysis = {
      regulatory: generateThemeAnalysis('regulatory', input, deterministicAnalysis),
      risk: generateThemeAnalysis('risk', input, deterministicAnalysis),
      technical: generateThemeAnalysis('technical', input, deterministicAnalysis),
      transparency: generateThemeAnalysis('transparency', input, deterministicAnalysis),
      optimization: generateThemeAnalysis('optimization', input, deterministicAnalysis),
    };

    // Génération de l'indicateur de pression réglementaire (si exposition fournie)
    let regulatoryPressureIndicator = null;
    if (input.regulatoryExposureData && Number.isInteger(input.regulatoryExposureData.exposure_index)) {
      const amplificationFactor = calculateAmplificationFactor(input.regulatoryExposureData.exposure_index);
      regulatoryPressureIndicator = generateRegulatoryPressureIndicator(
        input.regulatoryExposureData.exposure_index,
        amplificationFactor,
      );
    }

    // Compilation du rapport
    const report = {
      auditId,
      projectId: input.projectContext.projectId,
      devisId: input.projectContext.devisId,
      userType: input.userProfile.type,
      executiveSummary,
      strengths: narrativeSections.strengths,
      weaknesses: narrativeSections.weaknesses,
      recommendations: narrativeSections.recommendations,
      detailedAnalysis,
      regulatoryReferences,
      regulatoryContext,
      regulatoryPressureIndicator,
      scoringProfile: input.scoringProfile,
      timestamp: new Date().toISOString(),
      generatedAt: new Date().toISOString(),
    };

    // Enrichissement LLM optionnel
    if (options.llmProvider && typeof options.llmProvider === 'function') {
      try {
        const enrichedReport = await options.llmProvider(report, input);
        Object.assign(report, enrichedReport);
        logger.info('Rapport enrichi par LLM', { auditId });
      } catch (llmError) {
        logger.warn('Enrichissement LLM échoué, rapport sans LLM', {
          auditId,
          error: llmError.message,
        });
        // Continuer sans LLM
      }
    }

    // Persistence des résultats
    if (options.persistenceAdapter && typeof options.persistenceAdapter === 'function') {
      try {
        await options.persistenceAdapter(report);
        logger.info('Rapport persisté avec succès', {
          auditId,
          projectId: input.projectContext.projectId,
        });
      } catch (persistError) {
        logger.error('Erreur lors de la persistence', {
          auditId,
          error: persistError.message,
        });
      }
    }

    const duration = Date.now() - startTime;
    logger.info('Génération du rapport complétée avec succès', {
      auditId,
      duration: `${duration}ms`,
      grade: input.scoringProfile.gradeLetter,
    });

    return report;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Erreur lors de la génération du rapport', {
      auditId,
      error: error.message,
      duration: `${duration}ms`,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Génère l'analyse détaillée pour un thème spécifique
 * @param {string} theme - Nom du thème
 * @param {Object} input - Données d'entrée
 * @param {Object} deterministicAnalysis - Analyse déterministe
 * @returns {Object} Analyse détaillée du thème
 */
function generateThemeAnalysis(theme, input, deterministicAnalysis) {
  const templateBase = NARRATIVE_TEMPLATES[input.userProfile.type];
  const findings = input.analysisData[`${theme}Findings`];
  const score = input.scoringProfile.scores[theme].score;

  const analysis = {
    theme,
    score,
    findingsCount: deterministicAnalysis.findingsSummary[theme].total,
    findings,
    interpretation: '',
  };

  // Génération de l'interprétation basée sur le score
  if (theme === 'regulatory') {
    if (score < 50) {
      analysis.interpretation = 'Conformité critique : intervention immédiate requise';
    } else if (score < 70) {
      analysis.interpretation = 'Conformité insuffisante : correctives importantes nécessaires';
    } else if (score < 85) {
      analysis.interpretation = 'Conformité acceptable avec optimisations recommandées';
    } else {
      analysis.interpretation = 'Conformité satisfaisante : clauses appropriées détectées';
    }
  } else if (theme === 'risk') {
    if (score < 40) {
      analysis.interpretation = 'Risques critiques non maîtrisés : escalade requise';
    } else if (score < 60) {
      analysis.interpretation = 'Risques significatifs : plans d\'atténuation nécessaires';
    } else if (score < 75) {
      analysis.interpretation = 'Risques gérés : quelques améliorations possibles';
    } else {
      analysis.interpretation = 'Profil de risque maîtrisé : protections adéquates';
    }
  } else if (theme === 'technical') {
    if (score < 70) {
      analysis.interpretation = 'Incohérences détectées : clarification requise';
    } else if (score < 85) {
      analysis.interpretation = 'Architecture acceptable : optimisations suggérées';
    } else {
      analysis.interpretation = 'Architecture cohérente et bien documentée';
    }
  } else if (theme === 'transparency') {
    if (score < 60) {
      analysis.interpretation = 'Clarté insuffisante : nombreuses ambiguïtés';
    } else if (score < 75) {
      analysis.interpretation = 'Clarté acceptable : quelques points à clarifier';
    } else if (score < 85) {
      analysis.interpretation = 'Bonne clarté : termes généralement explicites';
    } else {
      analysis.interpretation = 'Excellente transparence : devis très explicite';
    }
  } else if (theme === 'optimization') {
    if (score >= 80) {
      analysis.interpretation = 'Optimisation complète : peu de marges de progression';
    } else if (score >= 60) {
      analysis.interpretation = 'Optimisation partielle : opportunités d\'amélioration';
    } else {
      analysis.interpretation = 'Plusieurs opportunités d\'optimisation détectées';
    }
  }

  return analysis;
}

/**
 * Génère un ID d'audit unique
 * @returns {string}
 */
function generateAuditId() {
  return `AUDIT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Export des fonctions publiques
 */
module.exports = {
  // API principale
  generateAuditNarrative,

  // Fonctions utilitaires (pour testing et audit)
  validateAuditInput,
  performDeterministicAnalysis,
  generateNarrativeSections,
  generateExecutiveSummary,
  identifyRegulatoryReferences,
  generateRegulatoryContext,
  generateThemeAnalysis,

  // Fonctions helper pour contexte réglementaire
  determineContextLevel,
  calculateAmplificationFactor,
  determineComplianceSensitivity,
  generateRegulatoryPressureIndicator,
  generateAmplificationExplanation,
  generateScoringImpactExplanation,

  // Configuration (pour inspection et audit)
  NARRATIVE_RULES,
  REGULATORY_REFERENCES,
  NARRATIVE_TEMPLATES,
  REGULATORY_CONTEXT_LEVELS,

  // Logger
  createLogger,
};

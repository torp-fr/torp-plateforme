/**
 * TORP Phase 0 - Service d'Analyse Contextuelle Client B2B
 * Interprète les données saisies pour générer des insights et recommandations
 * Utilisé pour la génération automatique de documents (DCE, CCTP, devis...)
 */

import type {
  ClientProfile,
  ClientType,
  B2BProjectType,
  RequestNature,
  SiteType,
  ClientAnalysis,
  InferredClientProfile,
  IdentifiedRisk,
  SuggestedDocument,
  ComplexityLevel,
} from '@/types/phase0/client.types';

// =============================================================================
// SERVICE D'ANALYSE CONTEXTUELLE
// =============================================================================

export class ClientAnalysisService {
  /**
   * Analyse complète du profil client et du contexte projet
   */
  static analyzeClient(client: Partial<ClientProfile>): ClientAnalysis {
    const inferredProfile = this.inferClientProfile(client);
    const projectComplexity = this.assessProjectComplexity(client);
    const identifiedRisks = this.identifyRisks(client);
    const suggestedDocuments = this.suggestDocuments(client);
    const attentionPoints = this.generateAttentionPoints(client);
    const recommendations = this.generateRecommendations(client, inferredProfile, projectComplexity);

    return {
      inferredProfile,
      projectComplexity,
      identifiedRisks,
      suggestedDocuments,
      attentionPoints,
      recommendations,
    };
  }

  /**
   * Déduit le profil type du client à partir des informations saisies
   */
  static inferClientProfile(client: Partial<ClientProfile>): InferredClientProfile {
    const clientType = client.identity?.clientType;
    const requestNature = client.context?.requestNature;
    const budget = client.context?.clientBudget;

    // Segment client
    let segment: InferredClientProfile['segment'] = 'standard';
    if (clientType === 'collectivite' || clientType === 'promoteur' || requestNature === 'marche_public') {
      segment = 'premium';
    } else if (budget?.flexibility === 'strict' && budget.max && budget.max < 20000) {
      segment = 'economique';
    }

    // Niveau d'exigence attendu
    let exigenceLevel: InferredClientProfile['exigenceLevel'] = 'moyenne';
    if (clientType === 'collectivite' || requestNature === 'marche_public' || requestNature === 'appel_offres') {
      exigenceLevel = 'haute';
    } else if (clientType === 'particulier' && requestNature === 'devis') {
      exigenceLevel = 'standard';
    }

    // Sensibilité prix
    let priceSensitivity: InferredClientProfile['priceSensitivity'] = 'moyenne';
    if (budget?.flexibility === 'strict') {
      priceSensitivity = 'forte';
    } else if (clientType === 'promoteur' || clientType === 'collectivite') {
      priceSensitivity = 'faible';
    }

    // Expérience travaux
    let experienceLevel: InferredClientProfile['experienceLevel'] = 'averti';
    if (clientType === 'particulier') {
      experienceLevel = 'novice';
    } else if (clientType === 'promoteur' || clientType === 'bailleur') {
      experienceLevel = 'expert';
    }

    // Autonomie décisionnelle
    let decisionAutonomy: InferredClientProfile['decisionAutonomy'] = 'autonome';
    if (clientType === 'copropriete') {
      decisionAutonomy = 'hierarchique'; // Décisions en AG
    } else if (clientType === 'collectivite') {
      decisionAutonomy = 'hierarchique'; // Conseil municipal, etc.
    } else if (clientType === 'entreprise') {
      decisionAutonomy = 'partielle';
    }

    return {
      segment,
      exigenceLevel,
      priceSensitivity,
      experienceLevel,
      decisionAutonomy,
    };
  }

  /**
   * Évalue la complexité globale du projet
   */
  static assessProjectComplexity(client: Partial<ClientProfile>): ComplexityLevel {
    let complexityScore = 0;

    // Type de projet
    const projectType = client.context?.projectType;
    if (projectType === 'renovation_globale' || projectType === 'construction_neuve') {
      complexityScore += 3;
    } else if (projectType === 'extension' || projectType === 'mise_aux_normes') {
      complexityScore += 2;
    } else if (projectType === 'amenagement' || projectType === 'renovation_energetique') {
      complexityScore += 1;
    }

    // Type de site
    const siteType = client.site?.siteType;
    if (siteType === 'erp' || siteType === 'igh' || siteType === 'industriel') {
      complexityScore += 3;
    } else if (siteType === 'immeuble' || siteType === 'bureaux') {
      complexityScore += 2;
    }

    // Nature de la demande
    const requestNature = client.context?.requestNature;
    if (requestNature === 'marche_public') {
      complexityScore += 3;
    } else if (requestNature === 'appel_offres' || requestNature === 'consultation') {
      complexityScore += 2;
    }

    // Occupation pendant travaux
    if (client.site?.occupancy?.occupiedDuringWorks) {
      complexityScore += 1;
    }

    // Urgence
    if (client.context?.timeline?.urgency === 'immediate') {
      complexityScore += 1;
    }

    // Surface importante
    const surface = client.site?.characteristics?.totalArea;
    if (surface && surface > 500) {
      complexityScore += 2;
    } else if (surface && surface > 200) {
      complexityScore += 1;
    }

    // Conversion en niveau
    if (complexityScore >= 8) return 'tres_complexe';
    if (complexityScore >= 5) return 'complexe';
    if (complexityScore >= 3) return 'moderee';
    return 'simple';
  }

  /**
   * Identifie les risques potentiels du projet
   */
  static identifyRisks(client: Partial<ClientProfile>): IdentifiedRisk[] {
    const risks: IdentifiedRisk[] = [];

    // Risques liés au type de client
    if (client.identity?.clientType === 'copropriete') {
      risks.push({
        type: 'relationnel',
        description: 'Décisions soumises à l\'approbation de l\'AG des copropriétaires',
        level: 'moyen',
        mitigation: 'Prévoir des délais pour les validations en AG',
      });
    }

    // Risques liés au site
    if (client.site?.siteType === 'erp') {
      risks.push({
        type: 'technique',
        description: 'Réglementation ERP stricte - Commission de sécurité',
        level: 'eleve',
        mitigation: 'Intégrer les exigences ERP dès la conception',
      });
    }

    if (client.site?.occupancy?.occupiedDuringWorks) {
      risks.push({
        type: 'technique',
        description: 'Site occupé pendant les travaux - nuisances et coordination',
        level: 'moyen',
        mitigation: 'Planning phasé et communication régulière avec les occupants',
      });
    }

    // Risques liés au planning
    if (client.context?.timeline?.urgency === 'immediate') {
      risks.push({
        type: 'planning',
        description: 'Délais très courts - risque de surcoût et qualité',
        level: 'eleve',
        mitigation: 'Valider la faisabilité et prévoir une marge de sécurité',
      });
    }

    // Risques financiers
    if (client.context?.clientBudget?.flexibility === 'strict') {
      risks.push({
        type: 'financier',
        description: 'Budget strict sans marge pour imprévus',
        level: 'moyen',
        mitigation: 'Identifier clairement les risques et prévoir des options',
      });
    }

    // Risques marchés publics
    if (client.context?.requestNature === 'marche_public') {
      risks.push({
        type: 'juridique',
        description: 'Marché public - Respect strict des procédures et délais',
        level: 'eleve',
        mitigation: 'Vérifier les pièces administratives et délais de réponse',
      });
    }

    // DPE très mauvais (rénovation énergétique probable)
    const dpe = client.site?.characteristics?.dpeRating;
    if (dpe && ['F', 'G'].includes(dpe)) {
      risks.push({
        type: 'technique',
        description: 'Passoire énergétique - Travaux importants probables',
        level: 'moyen',
        mitigation: 'Prévoir audit énergétique et scénarios de rénovation',
      });
    }

    // Bâtiment ancien
    const year = client.site?.characteristics?.constructionYear;
    if (year && year < 1950) {
      risks.push({
        type: 'technique',
        description: 'Bâtiment ancien - Risque amiante, plomb, structure',
        level: 'moyen',
        mitigation: 'Demander les diagnostics existants ou prévoir repérage',
      });
    }

    return risks;
  }

  /**
   * Suggère les documents à générer selon le contexte
   */
  static suggestDocuments(client: Partial<ClientProfile>): SuggestedDocument[] {
    const documents: SuggestedDocument[] = [];
    const requestNature = client.context?.requestNature;
    const clientType = client.identity?.clientType;

    // Documents de base
    documents.push({
      type: 'devis',
      priority: 'obligatoire',
      reason: 'Document commercial de base',
    });

    // Marchés publics et AO
    if (requestNature === 'marche_public' || requestNature === 'appel_offres') {
      documents.push({
        type: 'cctp',
        priority: 'obligatoire',
        reason: 'Requis pour la constitution du DCE',
      });
      documents.push({
        type: 'dpgf',
        priority: 'obligatoire',
        reason: 'Décomposition du prix requise',
      });
      documents.push({
        type: 'memoire_technique',
        priority: 'recommande',
        reason: 'Valorisation de l\'offre technique',
      });
      documents.push({
        type: 'planning',
        priority: 'obligatoire',
        reason: 'Planning prévisionnel d\'exécution',
      });
      documents.push({
        type: 'attestations',
        priority: 'obligatoire',
        reason: 'Attestations administratives obligatoires',
      });
    }

    // Consultations multi-entreprises
    if (requestNature === 'consultation') {
      documents.push({
        type: 'cctp',
        priority: 'recommande',
        reason: 'Permet une comparaison objective des offres',
      });
      documents.push({
        type: 'dpgf',
        priority: 'recommande',
        reason: 'Facilite la comparaison des prix',
      });
    }

    // Copropriété
    if (clientType === 'copropriete') {
      documents.push({
        type: 'cctp',
        priority: 'recommande',
        reason: 'Document de référence pour présentation en AG',
      });
      documents.push({
        type: 'planning',
        priority: 'recommande',
        reason: 'Information des copropriétaires sur les délais',
      });
    }

    // Collectivités (même hors marché public)
    if (clientType === 'collectivite' && requestNature !== 'marche_public') {
      documents.push({
        type: 'cctp',
        priority: 'recommande',
        reason: 'Formalisme attendu par les collectivités',
      });
    }

    // Projets complexes
    const projectType = client.context?.projectType;
    if (projectType === 'renovation_globale' || projectType === 'construction_neuve') {
      documents.push({
        type: 'planning',
        priority: 'recommande',
        reason: 'Coordination multi-lots nécessaire',
      });
    }

    return documents;
  }

  /**
   * Génère les points d'attention pour le dossier
   */
  static generateAttentionPoints(client: Partial<ClientProfile>): string[] {
    const points: string[] = [];

    // Type de client
    switch (client.identity?.clientType) {
      case 'collectivite':
        points.push('Respecter les procédures de commande publique');
        points.push('Prévoir les délais de validation par les élus');
        break;
      case 'copropriete':
        points.push('Anticiper les délais de convocation d\'AG');
        points.push('Prévoir la communication aux copropriétaires');
        break;
      case 'bailleur':
        points.push('Coordonner avec les locataires en place');
        points.push('Vérifier les obligations du bailleur');
        break;
    }

    // Type de site
    if (client.site?.siteType === 'erp') {
      points.push('Vérifier la catégorie et le type d\'ERP');
      points.push('Anticiper les exigences de la commission de sécurité');
    }

    // Occupation
    if (client.site?.occupancy?.occupiedDuringWorks) {
      points.push('Planifier les travaux en limitant les nuisances');
      points.push('Prévoir des solutions de repli si nécessaire');
    }

    // Contraintes d'accès
    if (client.site?.accessConstraints?.timeRestrictions) {
      points.push(`Contrainte horaire : ${client.site.accessConstraints.timeRestrictions}`);
    }

    if (!client.site?.accessConstraints?.vehicleAccess) {
      points.push('Accès véhicule limité - prévoir manutention');
    }

    // Urgence
    if (client.context?.timeline?.urgency === 'immediate') {
      points.push('⚠️ URGENT - Prioriser la réactivité');
    }

    return points;
  }

  /**
   * Génère des recommandations personnalisées
   */
  static generateRecommendations(
    client: Partial<ClientProfile>,
    profile: InferredClientProfile,
    complexity: ComplexityLevel
  ): string[] {
    const recommendations: string[] = [];

    // Selon le segment client
    switch (profile.segment) {
      case 'premium':
        recommendations.push('Proposer un accompagnement personnalisé et des options qualitatives');
        recommendations.push('Mettre en avant les certifications et références similaires');
        break;
      case 'economique':
        recommendations.push('Proposer des solutions alternatives pour optimiser le budget');
        recommendations.push('Être transparent sur les postes pouvant être différés');
        break;
    }

    // Selon la complexité
    if (complexity === 'tres_complexe' || complexity === 'complexe') {
      recommendations.push('Prévoir une visite technique approfondie avant chiffrage');
      recommendations.push('Envisager un phasage du projet si le budget est contraint');
    }

    // Selon l'expérience client
    if (profile.experienceLevel === 'novice') {
      recommendations.push('Accompagner le client avec des explications pédagogiques');
      recommendations.push('Proposer un interlocuteur unique pour simplifier les échanges');
    } else if (profile.experienceLevel === 'expert') {
      recommendations.push('Aller à l\'essentiel, client expérimenté');
      recommendations.push('Mettre l\'accent sur les aspects techniques et innovants');
    }

    // Selon le type de projet
    if (client.context?.projectType === 'renovation_energetique') {
      recommendations.push('Mentionner les aides disponibles (MaPrimeRénov\', CEE, éco-PTZ)');
      recommendations.push('Proposer un audit énergétique si non réalisé');
    }

    // Selon la nature de la demande
    if (client.context?.requestNature === 'marche_public') {
      recommendations.push('Vérifier l\'ensemble des pièces administratives requises');
      recommendations.push('Respecter scrupuleusement la date limite de réponse');
    }

    return recommendations;
  }

  /**
   * Génère un résumé exécutif du dossier
   */
  static generateExecutiveSummary(client: Partial<ClientProfile>): string {
    const analysis = this.analyzeClient(client);
    const parts: string[] = [];

    // Intro
    const clientName = client.identity?.name || client.identity?.companyName || 'Client';
    const clientTypeLabel = this.getClientTypeLabel(client.identity?.clientType);
    parts.push(`**${clientName}** (${clientTypeLabel})`);

    // Projet
    const projectTypeLabel = this.getProjectTypeLabel(client.context?.projectType);
    const siteAddress = client.site?.address
      ? `${client.site.address.streetName}, ${client.site.address.postalCode} ${client.site.address.city}`
      : 'Adresse à confirmer';
    parts.push(`**Projet :** ${projectTypeLabel} - ${siteAddress}`);

    // Complexité et segment
    parts.push(`**Complexité :** ${analysis.projectComplexity} | **Segment :** ${analysis.inferredProfile.segment}`);

    // Risques majeurs
    const highRisks = analysis.identifiedRisks.filter(r => r.level === 'eleve');
    if (highRisks.length > 0) {
      parts.push(`**⚠️ Risques élevés :** ${highRisks.map(r => r.description).join(' ; ')}`);
    }

    // Documents à produire
    const requiredDocs = analysis.suggestedDocuments.filter(d => d.priority === 'obligatoire');
    if (requiredDocs.length > 0) {
      parts.push(`**Documents requis :** ${requiredDocs.map(d => d.type.toUpperCase()).join(', ')}`);
    }

    return parts.join('\n\n');
  }

  // Helpers pour les labels
  private static getClientTypeLabel(type?: ClientType): string {
    const labels: Record<ClientType, string> = {
      particulier: 'Particulier',
      entreprise: 'Entreprise',
      copropriete: 'Copropriété',
      collectivite: 'Collectivité',
      bailleur: 'Bailleur',
      marchand_de_biens: 'Marchand de biens',
      promoteur: 'Promoteur',
      autre: 'Autre',
    };
    return type ? labels[type] || type : 'Non défini';
  }

  private static getProjectTypeLabel(type?: B2BProjectType): string {
    const labels: Record<B2BProjectType, string> = {
      renovation_globale: 'Rénovation globale',
      renovation_energetique: 'Rénovation énergétique',
      extension: 'Extension',
      amenagement: 'Aménagement',
      mise_aux_normes: 'Mise aux normes',
      maintenance: 'Maintenance',
      expertise: 'Expertise',
      audit: 'Audit',
      construction_neuve: 'Construction neuve',
      demolition: 'Démolition',
      autre: 'Autre',
    };
    return type ? labels[type] || type : 'Non défini';
  }
}

export const clientAnalysisService = new ClientAnalysisService();

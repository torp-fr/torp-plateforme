/**
 * TORP Tender Response Service
 * Service de gestion des réponses entreprises aux appels d'offres
 *
 * Fonctionnalités :
 * - Création et gestion des réponses
 * - Analyse automatique des DCE reçus
 * - Génération assistée de propositions
 * - Scoring et positionnement
 */

import { supabase } from '@/lib/supabase';
import type {
  Tender,
  TenderResponse,
  ResponseStatus,
  CreateResponsePayload,
  SubmitResponsePayload,
  ResponseLotBreakdown,
  TechnicalMemo,
  ProjectReference,
  DPGFData,
  CompanyQualifications,
  ResponseFilter,
  ResponseListItem,
  AIResponseAnalysis,
  AIRecommendation,
  ScoringDetails,
} from '@/types/tender';
import { HybridAIService } from '@/services/ai/hybrid-ai.service';
import { KnowledgeService } from '@/services/rag/knowledge.service';

// =============================================================================
// RESPONSE SERVICE
// =============================================================================

export class ResponseService {
  /**
   * Crée une nouvelle réponse (brouillon)
   */
  static async create(payload: CreateResponsePayload): Promise<TenderResponse> {
    const { data, error } = await supabase
      .from('tender_responses')
      .insert({
        tender_id: payload.tenderId,
        company_siret: payload.companySiret,
        company_name: payload.companyName,
        status: 'draft',
        vat_rate: 20,
        lots_breakdown: [],
        response_documents: [],
        project_references: [],
        variants: [],
      })
      .select()
      .single();

    if (error) {
      console.error('[ResponseService] Create error:', error);
      throw error;
    }

    return this.mapRowToResponse(data);
  }

  /**
   * Récupère une réponse par ID
   */
  static async getById(responseId: string): Promise<TenderResponse | null> {
    const { data, error } = await supabase
      .from('tender_responses')
      .select('*')
      .eq('id', responseId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapRowToResponse(data);
  }

  /**
   * Liste les réponses d'une entreprise
   */
  static async listByCompany(
    companySiret: string,
    filter?: ResponseFilter
  ): Promise<ResponseListItem[]> {
    let query = supabase
      .from('tender_responses')
      .select(`
        id, reference, tender_id, company_name, status,
        total_amount_ht, torp_score, torp_grade, moa_ranking,
        submitted_at, created_at,
        tenders!inner(title)
      `)
      .eq('company_siret', companySiret)
      .order('created_at', { ascending: false });

    if (filter?.status?.length) {
      query = query.in('status', filter.status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[ResponseService] List error:', error);
      throw error;
    }

    return (data || []).map(row => ({
      id: row.id,
      reference: row.reference,
      tenderId: row.tender_id,
      tenderTitle: (row.tenders as unknown as { title: string })?.title || '',
      companyName: row.company_name,
      status: row.status,
      totalAmountHT: row.total_amount_ht,
      torpScore: row.torp_score,
      torpGrade: row.torp_grade,
      moaRanking: row.moa_ranking,
      submittedAt: row.submitted_at ? new Date(row.submitted_at) : undefined,
    }));
  }

  /**
   * Liste les réponses pour un appel d'offres (MOA)
   */
  static async listByTender(
    tenderId: string,
    filter?: ResponseFilter
  ): Promise<ResponseListItem[]> {
    let query = supabase
      .from('tender_responses')
      .select('id, reference, tender_id, company_name, status, total_amount_ht, torp_score, torp_grade, moa_ranking, submitted_at')
      .eq('tender_id', tenderId)
      .order('torp_score', { ascending: false, nullsFirst: false });

    if (filter?.status?.length) {
      query = query.in('status', filter.status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[ResponseService] List by tender error:', error);
      throw error;
    }

    return (data || []).map(row => ({
      id: row.id,
      reference: row.reference,
      tenderId: row.tender_id,
      tenderTitle: '',
      companyName: row.company_name,
      status: row.status,
      totalAmountHT: row.total_amount_ht,
      torpScore: row.torp_score,
      torpGrade: row.torp_grade,
      moaRanking: row.moa_ranking,
      submittedAt: row.submitted_at ? new Date(row.submitted_at) : undefined,
    }));
  }

  /**
   * Met à jour une réponse
   */
  static async update(
    responseId: string,
    updates: Partial<TenderResponse>
  ): Promise<TenderResponse> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Mapper les champs
    if (updates.totalAmountHT !== undefined) updateData.total_amount_ht = updates.totalAmountHT;
    if (updates.totalAmountTTC !== undefined) updateData.total_amount_ttc = updates.totalAmountTTC;
    if (updates.vatAmount !== undefined) updateData.vat_amount = updates.vatAmount;
    if (updates.vatRate !== undefined) updateData.vat_rate = updates.vatRate;
    if (updates.lotsBreakdown !== undefined) updateData.lots_breakdown = updates.lotsBreakdown;
    if (updates.dpgfData !== undefined) updateData.dpgf_data = updates.dpgfData;
    if (updates.proposedDurationDays !== undefined) updateData.proposed_duration_days = updates.proposedDurationDays;
    if (updates.proposedStartDate !== undefined) updateData.proposed_start_date = updates.proposedStartDate;
    if (updates.proposedEndDate !== undefined) updateData.proposed_end_date = updates.proposedEndDate;
    if (updates.technicalMemo !== undefined) updateData.technical_memo = updates.technicalMemo;
    if (updates.projectReferences !== undefined) updateData.project_references = updates.projectReferences;
    if (updates.qualifications !== undefined) updateData.qualifications = updates.qualifications;
    if (updates.proposedTeam !== undefined) updateData.proposed_team = updates.proposedTeam;
    if (updates.subcontracting !== undefined) updateData.subcontracting = updates.subcontracting;
    if (updates.variants !== undefined) updateData.variants = updates.variants;

    const { data, error } = await supabase
      .from('tender_responses')
      .update(updateData)
      .eq('id', responseId)
      .select()
      .single();

    if (error) {
      console.error('[ResponseService] Update error:', error);
      throw error;
    }

    return this.mapRowToResponse(data);
  }

  /**
   * Soumet une réponse
   */
  static async submit(responseId: string): Promise<TenderResponse> {
    // Récupérer la réponse
    const response = await this.getById(responseId);
    if (!response) {
      throw new Error('Réponse non trouvée');
    }

    // Valider que les champs obligatoires sont remplis
    if (!response.totalAmountHT || response.totalAmountHT <= 0) {
      throw new Error('Le montant total HT est obligatoire');
    }

    if (!response.lotsBreakdown?.length) {
      throw new Error('Le détail par lot est obligatoire');
    }

    // Calculer le score TORP
    const scoring = await this.calculateTORPScore(response);

    // Mettre à jour le statut
    const { data, error } = await supabase
      .from('tender_responses')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        torp_score: scoring.totalScore,
        torp_grade: scoring.grade,
        scoring_details: scoring,
        updated_at: new Date().toISOString(),
      })
      .eq('id', responseId)
      .select()
      .single();

    if (error) {
      console.error('[ResponseService] Submit error:', error);
      throw error;
    }

    // Mettre à jour l'invitation si elle existe
    await supabase
      .from('tender_invitations')
      .update({
        status: 'responded',
        responded_at: new Date().toISOString(),
      })
      .eq('tender_id', response.tenderId)
      .eq('company_siret', response.companySiret);

    return this.mapRowToResponse(data);
  }

  /**
   * Retire une réponse
   */
  static async withdraw(responseId: string, reason?: string): Promise<TenderResponse> {
    const { data, error } = await supabase
      .from('tender_responses')
      .update({
        status: 'withdrawn',
        metadata: { withdrawReason: reason },
        updated_at: new Date().toISOString(),
      })
      .eq('id', responseId)
      .select()
      .single();

    if (error) {
      console.error('[ResponseService] Withdraw error:', error);
      throw error;
    }

    return this.mapRowToResponse(data);
  }

  // ===========================================================================
  // ANALYSE & GÉNÉRATION
  // ===========================================================================

  /**
   * Analyse un DCE reçu et extrait les informations clés
   */
  static async analyzeDCE(tender: Tender): Promise<{
    summary: string;
    lots: Array<{
      lotNumber: string;
      lotName: string;
      description: string;
      estimatedItems: number;
    }>;
    requirements: string[];
    deadlines: {
      questions?: Date;
      response?: Date;
    };
    risks: string[];
    opportunities: string[];
  }> {
    const analysis = {
      summary: '',
      lots: [] as Array<{
        lotNumber: string;
        lotName: string;
        description: string;
        estimatedItems: number;
      }>,
      requirements: [] as string[],
      deadlines: {} as { questions?: Date; response?: Date },
      risks: [] as string[],
      opportunities: [] as string[],
    };

    // Résumé
    analysis.summary = `Appel d'offres "${tender.title}" - ${tender.lotsCount} lot(s)
Localisation : ${tender.workCity} (${tender.workPostalCode})
Budget estimé : ${tender.estimatedBudgetMin?.toLocaleString('fr-FR')} - ${tender.estimatedBudgetMax?.toLocaleString('fr-FR')} €`;

    // Lots
    analysis.lots = (tender.selectedLots || []).map(lot => ({
      lotNumber: lot.lotNumber,
      lotName: lot.lotName,
      description: lot.description || '',
      estimatedItems: lot.prestations?.length || 5,
    }));

    // Exigences
    if (tender.requirements?.rgeRequired) {
      analysis.requirements.push('Certification RGE obligatoire');
    }
    if (tender.requirements?.insuranceDecennaleRequired) {
      analysis.requirements.push('Assurance décennale obligatoire');
    }
    if (tender.requirements?.requiredQualifications?.length) {
      analysis.requirements.push(`Qualifications requises : ${tender.requirements.requiredQualifications.join(', ')}`);
    }

    // Dates
    if (tender.questionsDeadline) {
      analysis.deadlines.questions = new Date(tender.questionsDeadline);
    }
    if (tender.responseDeadline) {
      analysis.deadlines.response = new Date(tender.responseDeadline);
    }

    // Analyse des risques et opportunités (simplifié)
    if (tender.estimatedDurationDays && tender.estimatedDurationDays < 30) {
      analysis.risks.push('Délai d\'exécution court - attention à la planification');
    }

    if (tender.visibility === 'private' || tender.visibility === 'restricted') {
      analysis.opportunities.push('Consultation restreinte - moins de concurrence');
    }

    if (tender.lotsCount > 3) {
      analysis.opportunities.push('Possibilité de répondre à plusieurs lots');
    }

    return analysis;
  }

  /**
   * Génère une proposition de DPGF pré-rempli
   */
  static async generateDPGFProposal(
    tender: Tender,
    companyProfile?: {
      markupPercentage?: number;
      hourlyRate?: number;
    }
  ): Promise<DPGFData> {
    const lots: DPGFData['lots'] = [];
    let totalHT = 0;

    const markup = companyProfile?.markupPercentage || 25;
    const hourlyRate = companyProfile?.hourlyRate || 45;

    for (const lot of (tender.selectedLots || [])) {
      const items: DPGFData['lots'][0]['items'] = [];
      let lotTotal = 0;

      // Générer des items estimés basés sur les données du marché
      const estimatedItems = await this.estimateLotItems(lot, markup, hourlyRate);

      estimatedItems.forEach(item => {
        items.push(item);
        lotTotal += item.totalHT;
      });

      lots.push({
        lotNumber: lot.lotNumber,
        lotName: lot.lotName,
        items,
        totalHT: lotTotal,
      });

      totalHT += lotTotal;
    }

    const vatRate = 10; // TVA rénovation
    const vatAmount = totalHT * (vatRate / 100);

    return {
      lots,
      totalHT,
      totalTTC: totalHT + vatAmount,
      vatBreakdown: [{
        rate: vatRate,
        baseAmount: totalHT,
        vatAmount,
      }],
    };
  }

  /**
   * Génère un mémoire technique assisté
   */
  static async generateTechnicalMemo(
    tender: Tender,
    companyInfo: {
      name: string;
      presentation?: string;
      employees?: number;
      certifications?: string[];
      equipment?: string[];
    },
    projectReferences: ProjectReference[]
  ): Promise<TechnicalMemo> {
    // Rechercher des informations pertinentes dans la base de connaissances
    const relevantDTUs = new Set<string>();
    tender.selectedLots?.forEach(lot => {
      lot.applicableDTUs?.forEach(dtu => relevantDTUs.add(dtu));
    });

    let dtuContext = '';
    if (relevantDTUs.size > 0) {
      const knowledgeResults = await KnowledgeService.search(
        [...relevantDTUs].join(' '),
        { limit: 5 }
      );
      dtuContext = knowledgeResults.map(r => r.content).join('\n');
    }

    const memo: TechnicalMemo = {
      companyPresentation: companyInfo.presentation || `
${companyInfo.name} est une entreprise spécialisée dans les travaux du bâtiment.
${companyInfo.employees ? `Notre équipe compte ${companyInfo.employees} collaborateurs qualifiés.` : ''}
${companyInfo.certifications?.length ? `Nous disposons des certifications suivantes : ${companyInfo.certifications.join(', ')}.` : ''}
      `.trim(),

      humanResources: `
L'équipe affectée au chantier sera composée de :
- 1 conducteur de travaux (supervision)
- 1 chef d'équipe qualifié
- ${Math.ceil((tender.estimatedDurationDays || 30) / 10)} ouvriers selon les phases

Nos équipes sont formées aux dernières techniques et respectent les normes en vigueur.
      `.trim(),

      materialResources: companyInfo.equipment?.length
        ? `Moyens matériels affectés :\n${companyInfo.equipment.map(e => `- ${e}`).join('\n')}`
        : `
Nous disposons du matériel nécessaire à la réalisation des travaux :
- Outillage professionnel complet
- Échafaudages et équipements de sécurité
- Véhicules de chantier
      `.trim(),

      methodology: `
Notre méthodologie d'intervention :

1. PRÉPARATION
   - Visite préalable du site
   - Installation de chantier
   - Protection des ouvrages existants

2. EXÉCUTION
   - Respect du planning établi
   - Points d'arrêt et contrôles qualité
   - Coordination avec les autres corps d'état

3. FINITIONS
   - Auto-contrôle systématique
   - Nettoyage de chantier
   - Levée des réserves éventuelles

${dtuContext ? `\nNormes et DTU applicables identifiés :\n${[...relevantDTUs].map(d => `- ${d}`).join('\n')}` : ''}
      `.trim(),

      qualityApproach: `
Démarche qualité :
- Respect des DTU et normes en vigueur
- Utilisation de matériaux certifiés
- Traçabilité des approvisionnements
- Fiches de contrôle à chaque étape
      `.trim(),

      safetyPlan: `
Plan de sécurité :
- Évaluation des risques avant démarrage
- Port des EPI obligatoire
- Formation sécurité des équipes
- Plan de prévention si co-activité
      `.trim(),

      environmentalApproach: `
Engagement environnemental :
- Tri et valorisation des déchets
- Limitation des nuisances (bruit, poussières)
- Optimisation des déplacements
- Choix de matériaux éco-responsables quand possible
      `.trim(),

      strengths: [
        'Équipe qualifiée et expérimentée',
        'Respect des délais',
        'Qualité d\'exécution',
        'Réactivité et communication',
      ],
    };

    if (projectReferences.length > 0) {
      memo.technicalAnnexes = [
        `Références chantiers similaires : ${projectReferences.length} projets réalisés`,
      ];
    }

    return memo;
  }

  /**
   * Calcule le score de positionnement (chances de remporter)
   */
  static async calculatePositioningScore(
    response: TenderResponse,
    tender: Tender,
    competitorCount?: number
  ): Promise<{
    score: number;
    details: string;
    recommendations: AIRecommendation[];
  }> {
    let score = 50; // Score de base
    const recommendations: AIRecommendation[] = [];

    // 1. Analyse du prix
    if (response.totalAmountHT && tender.estimatedBudgetMax) {
      const ratio = response.totalAmountHT / tender.estimatedBudgetMax;

      if (ratio < 0.8) {
        score += 15;
        recommendations.push({
          type: 'warning',
          priority: 'medium',
          title: 'Prix potentiellement bas',
          description: 'Votre prix est significativement inférieur à l\'estimation. Vérifiez que vous n\'avez rien oublié.',
        });
      } else if (ratio > 1.2) {
        score -= 20;
        recommendations.push({
          type: 'improvement',
          priority: 'high',
          title: 'Prix au-dessus de l\'estimation',
          description: 'Votre prix dépasse l\'estimation du MOA. Envisagez d\'optimiser votre offre.',
        });
      } else if (ratio >= 0.9 && ratio <= 1.1) {
        score += 10;
      }
    }

    // 2. Complétude de la réponse
    let completeness = 0;
    if (response.technicalMemo) completeness += 25;
    if (response.projectReferences?.length >= 3) completeness += 20;
    if (response.qualifications?.rge?.isRGE) completeness += 15;
    if (response.proposedDurationDays) completeness += 10;
    if (response.proposedTeam) completeness += 10;

    if (completeness < 50) {
      recommendations.push({
        type: 'improvement',
        priority: 'high',
        title: 'Offre incomplète',
        description: 'Ajoutez un mémoire technique et des références pour renforcer votre candidature.',
        action: 'Compléter les sections manquantes',
      });
    }

    score += Math.min(20, completeness * 0.4);

    // 3. Adéquation aux exigences
    if (tender.requirements?.rgeRequired && !response.qualifications?.rge?.isRGE) {
      score -= 30;
      recommendations.push({
        type: 'compliance',
        priority: 'high',
        title: 'RGE requis mais non fourni',
        description: 'Cette consultation exige une certification RGE que vous n\'avez pas fournie.',
        action: 'Fournir le certificat RGE ou s\'associer avec une entreprise RGE',
      });
    }

    // 4. Concurrence estimée
    if (competitorCount !== undefined) {
      if (competitorCount > 5) {
        score -= 10;
        recommendations.push({
          type: 'opportunity',
          priority: 'low',
          title: 'Forte concurrence',
          description: `${competitorCount} entreprises ont déjà répondu. Différenciez-vous par la qualité technique.`,
        });
      } else if (competitorCount <= 2) {
        score += 10;
      }
    }

    // Normaliser le score entre 0 et 100
    score = Math.max(0, Math.min(100, score));

    // Générer le détail
    let details = '';
    if (score >= 70) {
      details = 'Votre offre est bien positionnée avec de bonnes chances de succès.';
    } else if (score >= 50) {
      details = 'Votre offre est dans la moyenne. Des améliorations pourraient augmenter vos chances.';
    } else {
      details = 'Votre offre nécessite des améliorations significatives pour être compétitive.';
    }

    return { score, details, recommendations };
  }

  // ===========================================================================
  // SCORING TORP
  // ===========================================================================

  /**
   * Calcule le score TORP d'une réponse
   */
  static async calculateTORPScore(response: TenderResponse): Promise<ScoringDetails> {
    const criteriaScores: ScoringDetails['criteriaScores'] = [];
    let totalScore = 0;
    let maxScore = 0;

    // 1. Complétude administrative (200 pts)
    const adminScore = this.scoreAdministrativeCompleteness(response);
    criteriaScores.push({
      criterion: 'Complétude administrative',
      score: adminScore.score,
      maxScore: 200,
      weight: 20,
      weightedScore: adminScore.score * 0.2,
      details: adminScore.details,
    });
    totalScore += adminScore.score;
    maxScore += 200;

    // 2. Qualité technique (300 pts)
    const techScore = this.scoreTechnicalQuality(response);
    criteriaScores.push({
      criterion: 'Qualité technique',
      score: techScore.score,
      maxScore: 300,
      weight: 30,
      weightedScore: techScore.score * 0.3,
      details: techScore.details,
    });
    totalScore += techScore.score;
    maxScore += 300;

    // 3. Cohérence prix (250 pts)
    const priceScore = this.scorePriceCoherence(response);
    criteriaScores.push({
      criterion: 'Cohérence prix',
      score: priceScore.score,
      maxScore: 250,
      weight: 25,
      weightedScore: priceScore.score * 0.25,
      details: priceScore.details,
    });
    totalScore += priceScore.score;
    maxScore += 250;

    // 4. Références (150 pts)
    const refScore = this.scoreReferences(response);
    criteriaScores.push({
      criterion: 'Références',
      score: refScore.score,
      maxScore: 150,
      weight: 15,
      weightedScore: refScore.score * 0.15,
      details: refScore.details,
    });
    totalScore += refScore.score;
    maxScore += 150;

    // 5. Certifications (100 pts)
    const certScore = this.scoreCertifications(response);
    criteriaScores.push({
      criterion: 'Certifications',
      score: certScore.score,
      maxScore: 100,
      weight: 10,
      weightedScore: certScore.score * 0.1,
      details: certScore.details,
    });
    totalScore += certScore.score;
    maxScore += 100;

    // Calculer la note finale
    const percentage = (totalScore / maxScore) * 100;
    const grade = this.getGradeFromScore(percentage);

    // Identifier forces et faiblesses
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const recommendations: string[] = [];

    criteriaScores.forEach(c => {
      const pct = (c.score / c.maxScore) * 100;
      if (pct >= 80) {
        strengths.push(`${c.criterion} : excellent`);
      } else if (pct < 50) {
        weaknesses.push(`${c.criterion} : à améliorer`);
        recommendations.push(`Renforcer ${c.criterion.toLowerCase()}`);
      }
    });

    return {
      totalScore,
      maxScore,
      grade,
      criteriaScores,
      strengths,
      weaknesses,
      recommendations,
    };
  }

  private static scoreAdministrativeCompleteness(response: TenderResponse): { score: number; details: string } {
    let score = 0;
    const details: string[] = [];

    // DPGF rempli
    if (response.dpgfData || response.lotsBreakdown?.length) {
      score += 80;
      details.push('DPGF fourni');
    }

    // Qualifications
    if (response.qualifications) {
      score += 40;
      details.push('Qualifications fournies');
    }

    // Assurances
    if (response.insuranceDocuments?.length) {
      score += 40;
      details.push('Assurances fournies');
    }

    // Documents complémentaires
    if (response.responseDocuments?.length >= 2) {
      score += 40;
      details.push('Documents complémentaires fournis');
    }

    return {
      score: Math.min(200, score),
      details: details.join(', ') || 'Aucun document administratif',
    };
  }

  private static scoreTechnicalQuality(response: TenderResponse): { score: number; details: string } {
    let score = 0;
    const details: string[] = [];

    // Mémoire technique
    if (response.technicalMemo) {
      score += 100;
      details.push('Mémoire technique fourni');

      // Bonus pour contenu détaillé
      const memo = response.technicalMemo;
      if (memo.methodology) score += 30;
      if (memo.qualityApproach) score += 25;
      if (memo.safetyPlan) score += 25;
      if (memo.humanResources) score += 20;
      if (memo.materialResources) score += 20;
    }

    // Équipe proposée
    if (response.proposedTeam) {
      score += 40;
      details.push('Équipe détaillée');
    }

    // Planning
    if (response.proposedDurationDays) {
      score += 40;
      details.push('Planning proposé');
    }

    return {
      score: Math.min(300, score),
      details: details.join(', ') || 'Contenu technique insuffisant',
    };
  }

  private static scorePriceCoherence(response: TenderResponse): { score: number; details: string } {
    let score = 100; // Score de base

    // Vérifier la cohérence du total
    if (response.lotsBreakdown?.length && response.totalAmountHT) {
      const calculatedTotal = response.lotsBreakdown.reduce((sum, lot) => sum + lot.amountHT, 0);
      const diff = Math.abs(calculatedTotal - response.totalAmountHT) / response.totalAmountHT;

      if (diff < 0.01) {
        score += 75; // Parfaitement cohérent
      } else if (diff < 0.05) {
        score += 50; // Petite différence acceptable
      } else {
        score -= 50; // Incohérence significative
      }
    }

    // Bonus si TVA correctement calculée
    if (response.vatAmount && response.totalAmountHT && response.vatRate) {
      const expectedVAT = response.totalAmountHT * (response.vatRate / 100);
      if (Math.abs(expectedVAT - response.vatAmount) < 1) {
        score += 75;
      }
    }

    return {
      score: Math.max(0, Math.min(250, score)),
      details: score >= 200 ? 'Prix cohérent et bien détaillé' : 'Vérifier la cohérence des prix',
    };
  }

  private static scoreReferences(response: TenderResponse): { score: number; details: string } {
    const refs = response.projectReferences || [];
    let score = 0;

    // Nombre de références
    score += Math.min(60, refs.length * 20);

    // Qualité des références
    refs.forEach(ref => {
      if (ref.amount && ref.amount > 10000) score += 10;
      if (ref.contactPhone || ref.contactEmail) score += 10;
      if (ref.photos?.length) score += 5;
    });

    return {
      score: Math.min(150, score),
      details: refs.length > 0 ? `${refs.length} référence(s) fournie(s)` : 'Aucune référence',
    };
  }

  private static scoreCertifications(response: TenderResponse): { score: number; details: string } {
    let score = 0;
    const details: string[] = [];

    if (response.qualifications?.rge?.isRGE) {
      score += 50;
      details.push('RGE');
    }

    if (response.qualifications?.qualibat?.hasQualibat) {
      score += 30;
      details.push('Qualibat');
    }

    if (response.qualifications?.otherCertifications?.length) {
      score += Math.min(20, response.qualifications.otherCertifications.length * 10);
      details.push('Autres certifications');
    }

    return {
      score: Math.min(100, score),
      details: details.join(', ') || 'Aucune certification',
    };
  }

  private static getGradeFromScore(percentage: number): string {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    return 'E';
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Estime les items d'un lot avec prix
   */
  private static async estimateLotItems(
    lot: {
      lotType: string;
      lotName: string;
      estimatedPriceMin?: number;
      estimatedPriceMax?: number;
      prestations?: string[];
    },
    markupPercentage: number,
    hourlyRate: number
  ): Promise<DPGFData['lots'][0]['items']> {
    // Prix de référence par type de lot (prix moyens du marché)
    const marketPrices: Record<string, { unit: string; priceMin: number; priceMax: number }[]> = {
      demolition: [
        { unit: 'Fft', priceMin: 500, priceMax: 1500 },
        { unit: 'm²', priceMin: 15, priceMax: 40 },
        { unit: 'm³', priceMin: 40, priceMax: 80 },
      ],
      platrerie: [
        { unit: 'm²', priceMin: 25, priceMax: 55 },
      ],
      courants_forts: [
        { unit: 'U', priceMin: 800, priceMax: 2500 },
        { unit: 'U', priceMin: 40, priceMax: 80 },
      ],
      carrelage: [
        { unit: 'm²', priceMin: 35, priceMax: 90 },
        { unit: 'ml', priceMin: 8, priceMax: 20 },
      ],
      peinture: [
        { unit: 'm²', priceMin: 12, priceMax: 35 },
      ],
    };

    const items: DPGFData['lots'][0]['items'] = [];

    if (lot.prestations?.length) {
      lot.prestations.forEach((prestation, i) => {
        const basePrice = (lot.estimatedPriceMin || 1000) / lot.prestations!.length;
        const unitPrice = basePrice * (1 + markupPercentage / 100);

        items.push({
          reference: `${lot.lotType.substring(0, 2).toUpperCase()}.${(i + 1).toString().padStart(2, '0')}`,
          designation: prestation,
          unit: 'Ens',
          quantity: 1,
          unitPriceHT: Math.round(unitPrice),
          totalHT: Math.round(unitPrice),
        });
      });
    } else {
      // Items par défaut
      items.push({
        reference: `${lot.lotType.substring(0, 2).toUpperCase()}.01`,
        designation: `Travaux ${lot.lotName} - ensemble`,
        unit: 'Ens',
        quantity: 1,
        unitPriceHT: 0,
        totalHT: 0,
      });
    }

    return items;
  }

  /**
   * Mappe une row DB vers une TenderResponse
   */
  private static mapRowToResponse(row: Record<string, unknown>): TenderResponse {
    return {
      id: row.id as string,
      tenderId: row.tender_id as string,
      companyId: row.company_id as string | undefined,
      userId: row.user_id as string | undefined,
      companySiret: row.company_siret as string,
      companyName: row.company_name as string,
      reference: row.reference as string,
      status: row.status as ResponseStatus,
      totalAmountHT: row.total_amount_ht as number | undefined,
      totalAmountTTC: row.total_amount_ttc as number | undefined,
      vatAmount: row.vat_amount as number | undefined,
      vatRate: row.vat_rate as number || 20,
      lotsBreakdown: row.lots_breakdown as ResponseLotBreakdown[] || [],
      dpgfData: row.dpgf_data as DPGFData | undefined,
      dpgfFileUrl: row.dpgf_file_url as string | undefined,
      proposedDurationDays: row.proposed_duration_days as number | undefined,
      proposedStartDate: row.proposed_start_date ? new Date(row.proposed_start_date as string) : undefined,
      proposedEndDate: row.proposed_end_date ? new Date(row.proposed_end_date as string) : undefined,
      technicalMemo: row.technical_memo as TechnicalMemo | undefined,
      technicalMemoFileUrl: row.technical_memo_file_url as string | undefined,
      responseDocuments: row.response_documents as TenderResponse['responseDocuments'] || [],
      qualifications: row.qualifications as CompanyQualifications | undefined,
      insuranceDocuments: row.insurance_documents as TenderResponse['insuranceDocuments'] | undefined,
      projectReferences: row.project_references as ProjectReference[] || [],
      proposedTeam: row.proposed_team as TenderResponse['proposedTeam'] | undefined,
      subcontracting: row.subcontracting as TenderResponse['subcontracting'] | undefined,
      variants: row.variants as TenderResponse['variants'] || [],
      torpScore: row.torp_score as number | undefined,
      torpGrade: row.torp_grade as string | undefined,
      scoringDetails: row.scoring_details as ScoringDetails | undefined,
      moaEvaluation: row.moa_evaluation as TenderResponse['moaEvaluation'] | undefined,
      moaComments: row.moa_comments as string | undefined,
      moaRanking: row.moa_ranking as number | undefined,
      aiAnalysis: row.ai_analysis as AIResponseAnalysis | undefined,
      aiPositioningScore: row.ai_positioning_score as number | undefined,
      aiRecommendations: row.ai_recommendations as AIRecommendation[] | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      submittedAt: row.submitted_at ? new Date(row.submitted_at as string) : undefined,
      receivedAt: row.received_at ? new Date(row.received_at as string) : undefined,
      evaluatedAt: row.evaluated_at ? new Date(row.evaluated_at as string) : undefined,
    };
  }
}

export default ResponseService;

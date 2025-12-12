/**
 * TORP Tender Service
 * Service de gestion des appels d'offres (création, publication, diffusion)
 */

import { supabase } from '@/lib/supabase';
import type { Phase0Project } from '@/types/phase0/project.types';
import type {
  Tender,
  TenderStatus,
  TenderVisibility,
  TenderType,
  TenderLot,
  TenderDocument,
  TenderInvitation,
  CreateTenderPayload,
  PublishTenderPayload,
  TenderFilter,
  TenderListItem,
  EvaluationCriterion,
  TenderRequirements,
} from '@/types/tender';

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_EVALUATION_CRITERIA: EvaluationCriterion[] = [
  { name: 'prix', weight: 40, description: 'Prix global de l\'offre' },
  { name: 'technique', weight: 35, description: 'Valeur technique de l\'offre' },
  { name: 'delai', weight: 15, description: 'Délai d\'exécution proposé' },
  { name: 'references', weight: 10, description: 'Références et expérience' },
];

// =============================================================================
// TENDER SERVICE
// =============================================================================

export class TenderService {
  /**
   * Crée un appel d'offres depuis un projet Phase 0
   */
  static async createFromPhase0(
    phase0Project: Phase0Project,
    options?: Partial<CreateTenderPayload>
  ): Promise<Tender> {
    // Vérifier que le projet est prêt
    if (!phase0Project.selectedLots || phase0Project.selectedLots.length === 0) {
      throw new Error('Le projet doit avoir des lots sélectionnés');
    }

    // Convertir les lots Phase 0 en lots Tender
    const tenderLots = this.convertPhase0Lots(phase0Project);

    // Extraire l'adresse
    const workAddress = phase0Project.property?.address ? {
      street: phase0Project.property.address.street,
      complement: phase0Project.property.address.complement,
      city: phase0Project.property.address.city || '',
      postalCode: phase0Project.property.address.postalCode || '',
    } : undefined;

    // Créer les exigences par défaut basées sur les lots
    const requirements = this.buildRequirements(phase0Project);

    // Préparer les données
    const tenderData = {
      phase0_project_id: phase0Project.id,
      user_id: phase0Project.userId,
      title: phase0Project.workProject?.general?.title || `Projet ${phase0Project.reference}`,
      description: phase0Project.workProject?.general?.description,
      tender_type: options?.tenderType || 'simple',
      visibility: options?.visibility || 'private',
      status: 'draft' as TenderStatus,

      // Localisation
      work_address: workAddress,
      work_city: workAddress?.city,
      work_postal_code: workAddress?.postalCode,
      work_department: workAddress?.postalCode?.substring(0, 2),

      // Projet
      project_type: phase0Project.workProject?.scope?.workType,
      work_categories: [...new Set(tenderLots.map(l => l.category))],
      selected_lots: tenderLots,
      lots_count: tenderLots.length,

      // Budget
      estimated_budget_min: phase0Project.estimatedBudgetMin,
      estimated_budget_max: phase0Project.estimatedBudgetMax,
      budget_visibility: 'range',

      // Durée
      estimated_duration_days: phase0Project.estimatedDurationDays,
      desired_start_date: phase0Project.targetStartDate,
      desired_end_date: phase0Project.targetEndDate,

      // Critères et exigences
      evaluation_criteria: options?.evaluationCriteria || DEFAULT_EVALUATION_CRITERIA,
      requirements,

      // Contact
      contact_name: this.getContactName(phase0Project),
      contact_email: phase0Project.owner?.contact?.email,
      contact_phone: phase0Project.owner?.contact?.phone,

      // Dates
      response_deadline: options?.responseDeadline,
    };

    const { data, error } = await supabase
      .from('tenders')
      .insert(tenderData)
      .select()
      .single();

    if (error) {
      console.error('[TenderService] Create error:', error);
      throw error;
    }

    // Mettre à jour le statut du projet Phase 0
    await supabase
      .from('phase0_projects')
      .update({
        status: 'in_consultation',
        updated_at: new Date().toISOString(),
      })
      .eq('id', phase0Project.id);

    return this.mapRowToTender(data);
  }

  /**
   * Crée un appel d'offres manuellement
   */
  static async create(
    userId: string,
    payload: CreateTenderPayload
  ): Promise<Tender> {
    const tenderData = {
      user_id: userId,
      phase0_project_id: payload.phase0ProjectId,
      title: payload.title,
      description: payload.description,
      tender_type: payload.tenderType || 'simple',
      visibility: payload.visibility || 'private',
      status: 'draft' as TenderStatus,
      work_address: payload.workAddress,
      work_city: payload.workAddress?.city,
      work_postal_code: payload.workAddress?.postalCode,
      work_department: payload.workAddress?.postalCode?.substring(0, 2),
      selected_lots: payload.selectedLots || [],
      lots_count: payload.selectedLots?.length || 0,
      evaluation_criteria: payload.evaluationCriteria || DEFAULT_EVALUATION_CRITERIA,
      requirements: payload.requirements || {},
      response_deadline: payload.responseDeadline,
      desired_start_date: payload.desiredStartDate,
    };

    const { data, error } = await supabase
      .from('tenders')
      .insert(tenderData)
      .select()
      .single();

    if (error) {
      console.error('[TenderService] Create error:', error);
      throw error;
    }

    return this.mapRowToTender(data);
  }

  /**
   * Récupère un appel d'offres par ID
   */
  static async getById(tenderId: string): Promise<Tender | null> {
    const { data, error } = await supabase
      .from('tenders')
      .select('*')
      .eq('id', tenderId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapRowToTender(data);
  }

  /**
   * Liste les appels d'offres d'un utilisateur
   */
  static async listByUser(
    userId: string,
    filter?: TenderFilter
  ): Promise<TenderListItem[]> {
    let query = supabase
      .from('tenders')
      .select('id, reference, title, status, visibility, work_city, work_postal_code, lots_count, estimated_budget_min, estimated_budget_max, response_deadline, responses_count, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Appliquer les filtres
    if (filter?.status?.length) {
      query = query.in('status', filter.status);
    }
    if (filter?.visibility?.length) {
      query = query.in('visibility', filter.visibility);
    }
    if (filter?.searchQuery) {
      query = query.ilike('title', `%${filter.searchQuery}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[TenderService] List error:', error);
      throw error;
    }

    return (data || []).map(row => ({
      id: row.id,
      reference: row.reference,
      title: row.title,
      status: row.status,
      visibility: row.visibility,
      workCity: row.work_city,
      workPostalCode: row.work_postal_code,
      lotsCount: row.lots_count,
      estimatedBudgetMin: row.estimated_budget_min,
      estimatedBudgetMax: row.estimated_budget_max,
      responseDeadline: row.response_deadline ? new Date(row.response_deadline) : undefined,
      responsesCount: row.responses_count,
      createdAt: new Date(row.created_at),
    }));
  }

  /**
   * Liste les appels d'offres publics (pour les entreprises)
   */
  static async listPublic(filter?: TenderFilter): Promise<TenderListItem[]> {
    let query = supabase
      .from('tenders')
      .select('id, reference, title, status, visibility, work_city, work_postal_code, work_department, lots_count, estimated_budget_min, estimated_budget_max, response_deadline, responses_count, created_at, work_categories')
      .eq('visibility', 'public')
      .in('status', ['published', 'closed'])
      .order('response_deadline', { ascending: true });

    // Filtres
    if (filter?.department?.length) {
      query = query.in('work_department', filter.department);
    }
    if (filter?.deadlineAfter) {
      query = query.gte('response_deadline', filter.deadlineAfter.toISOString());
    }
    if (filter?.workCategories?.length) {
      query = query.overlaps('work_categories', filter.workCategories);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[TenderService] List public error:', error);
      throw error;
    }

    return (data || []).map(row => ({
      id: row.id,
      reference: row.reference,
      title: row.title,
      status: row.status,
      visibility: row.visibility,
      workCity: row.work_city,
      workPostalCode: row.work_postal_code,
      lotsCount: row.lots_count,
      estimatedBudgetMin: row.estimated_budget_min,
      estimatedBudgetMax: row.estimated_budget_max,
      responseDeadline: row.response_deadline ? new Date(row.response_deadline) : undefined,
      responsesCount: row.responses_count,
      createdAt: new Date(row.created_at),
    }));
  }

  /**
   * Met à jour un appel d'offres
   */
  static async update(
    tenderId: string,
    updates: Partial<Tender>
  ): Promise<Tender> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Mapper les champs
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.tenderType !== undefined) updateData.tender_type = updates.tenderType;
    if (updates.visibility !== undefined) updateData.visibility = updates.visibility;
    if (updates.responseDeadline !== undefined) updateData.response_deadline = updates.responseDeadline;
    if (updates.questionsDeadline !== undefined) updateData.questions_deadline = updates.questionsDeadline;
    if (updates.evaluationCriteria !== undefined) updateData.evaluation_criteria = updates.evaluationCriteria;
    if (updates.requirements !== undefined) updateData.requirements = updates.requirements;
    if (updates.selectedLots !== undefined) {
      updateData.selected_lots = updates.selectedLots;
      updateData.lots_count = updates.selectedLots.length;
    }

    const { data, error } = await supabase
      .from('tenders')
      .update(updateData)
      .eq('id', tenderId)
      .select()
      .single();

    if (error) {
      console.error('[TenderService] Update error:', error);
      throw error;
    }

    return this.mapRowToTender(data);
  }

  /**
   * Publie un appel d'offres
   */
  static async publish(payload: PublishTenderPayload): Promise<Tender> {
    const { tenderId, targetCompanies, responseDeadline, questionsDeadline } = payload;

    // Récupérer l'AO
    const tender = await this.getById(tenderId);
    if (!tender) {
      throw new Error('Appel d\'offres non trouvé');
    }

    if (tender.status !== 'draft' && tender.status !== 'ready') {
      throw new Error('L\'appel d\'offres ne peut pas être publié dans son état actuel');
    }

    // Mettre à jour l'AO
    const updateData: Record<string, unknown> = {
      status: 'published',
      published_at: new Date().toISOString(),
      publication_date: new Date().toISOString(),
      response_deadline: responseDeadline.toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (questionsDeadline) {
      updateData.questions_deadline = questionsDeadline.toISOString();
    }

    if (targetCompanies?.length) {
      updateData.target_companies = targetCompanies;
      updateData.invited_count = targetCompanies.length;
    }

    const { data, error } = await supabase
      .from('tenders')
      .update(updateData)
      .eq('id', tenderId)
      .select()
      .single();

    if (error) {
      console.error('[TenderService] Publish error:', error);
      throw error;
    }

    // Créer les invitations si entreprises ciblées
    if (targetCompanies?.length) {
      await this.createInvitations(tenderId, targetCompanies);
    }

    return this.mapRowToTender(data);
  }

  /**
   * Ferme un appel d'offres aux nouvelles réponses
   */
  static async close(tenderId: string): Promise<Tender> {
    const { data, error } = await supabase
      .from('tenders')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenderId)
      .select()
      .single();

    if (error) {
      console.error('[TenderService] Close error:', error);
      throw error;
    }

    return this.mapRowToTender(data);
  }

  /**
   * Passe en mode évaluation
   */
  static async startEvaluation(tenderId: string): Promise<Tender> {
    const { data, error } = await supabase
      .from('tenders')
      .update({
        status: 'evaluation',
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenderId)
      .select()
      .single();

    if (error) {
      console.error('[TenderService] Start evaluation error:', error);
      throw error;
    }

    return this.mapRowToTender(data);
  }

  /**
   * Attribue l'appel d'offres à une entreprise
   */
  static async attribute(tenderId: string, responseId: string): Promise<Tender> {
    // Marquer la réponse comme sélectionnée
    await supabase
      .from('tender_responses')
      .update({ status: 'selected' })
      .eq('id', responseId);

    // Rejeter les autres réponses
    await supabase
      .from('tender_responses')
      .update({ status: 'rejected' })
      .eq('tender_id', tenderId)
      .neq('id', responseId)
      .in('status', ['submitted', 'received', 'under_review', 'shortlisted']);

    // Mettre à jour l'AO
    const { data, error } = await supabase
      .from('tenders')
      .update({
        status: 'attributed',
        attribution_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenderId)
      .select()
      .single();

    if (error) {
      console.error('[TenderService] Attribute error:', error);
      throw error;
    }

    return this.mapRowToTender(data);
  }

  /**
   * Annule un appel d'offres
   */
  static async cancel(tenderId: string, reason?: string): Promise<Tender> {
    const { data, error } = await supabase
      .from('tenders')
      .update({
        status: 'cancelled',
        metadata: { cancelReason: reason },
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenderId)
      .select()
      .single();

    if (error) {
      console.error('[TenderService] Cancel error:', error);
      throw error;
    }

    return this.mapRowToTender(data);
  }

  /**
   * Incrémente le compteur de vues
   */
  static async incrementViewCount(tenderId: string): Promise<void> {
    await supabase.rpc('increment_tender_views', { tender_id: tenderId });
  }

  /**
   * Enregistre une vue (alias pour incrementViewCount avec fallback)
   */
  static async recordView(tenderId: string): Promise<void> {
    try {
      await this.incrementViewCount(tenderId);
    } catch {
      // Fallback si la fonction RPC n'existe pas - utilise update direct
      const { data } = await supabase
        .from('tenders')
        .select('views_count')
        .eq('id', tenderId)
        .single();

      if (data) {
        await supabase
          .from('tenders')
          .update({ views_count: (data.views_count || 0) + 1 })
          .eq('id', tenderId);
      }
    }
  }

  /**
   * Incrémente le compteur de téléchargements
   */
  static async incrementDownloadCount(tenderId: string): Promise<void> {
    await supabase.rpc('increment_tender_downloads', { tender_id: tenderId });
  }

  // ===========================================================================
  // INVITATIONS
  // ===========================================================================

  /**
   * Crée des invitations pour les entreprises ciblées
   */
  static async createInvitations(
    tenderId: string,
    companyIds: string[]
  ): Promise<TenderInvitation[]> {
    // Récupérer les infos des entreprises
    const { data: companies } = await supabase
      .from('companies')
      .select('id, siret, name, contact_email')
      .in('id', companyIds);

    if (!companies?.length) return [];

    const invitations = companies.map(company => ({
      tender_id: tenderId,
      company_id: company.id,
      company_siret: company.siret,
      company_name: company.name,
      company_email: company.contact_email || '',
      status: 'pending',
      access_token: crypto.randomUUID(),
      token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 jours
    }));

    const { data, error } = await supabase
      .from('tender_invitations')
      .insert(invitations)
      .select();

    if (error) {
      console.error('[TenderService] Create invitations error:', error);
      throw error;
    }

    return (data || []).map(this.mapRowToInvitation);
  }

  /**
   * Liste les invitations pour un appel d'offres
   */
  static async getInvitations(tenderId: string): Promise<TenderInvitation[]> {
    const { data, error } = await supabase
      .from('tender_invitations')
      .select('*')
      .eq('tender_id', tenderId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[TenderService] Get invitations error:', error);
      throw error;
    }

    return (data || []).map(this.mapRowToInvitation);
  }

  /**
   * Met à jour le statut d'une invitation
   */
  static async updateInvitationStatus(
    invitationId: string,
    status: string
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    // Ajouter le timestamp correspondant
    if (status === 'sent') updates.sent_at = new Date().toISOString();
    if (status === 'viewed') updates.viewed_at = new Date().toISOString();
    if (status === 'downloaded') updates.downloaded_at = new Date().toISOString();
    if (status === 'responded') updates.responded_at = new Date().toISOString();

    await supabase
      .from('tender_invitations')
      .update(updates)
      .eq('id', invitationId);
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Convertit les lots Phase 0 en lots Tender
   */
  private static convertPhase0Lots(project: Phase0Project): TenderLot[] {
    if (!project.selectedLots) return [];

    return project.selectedLots.map((lot, index) => ({
      lotType: lot.type,
      lotNumber: lot.number || String(index + 1).padStart(2, '0'),
      lotName: lot.name,
      category: lot.category,
      description: lot.description,
      estimatedPriceMin: lot.estimatedBudget?.min,
      estimatedPriceMax: lot.estimatedBudget?.max,
      estimatedDurationDays: lot.estimatedDurationDays,
      rgeRequired: lot.isRGEEligible,
      requiredQualifications: lot.requiredQualifications,
      applicableDTUs: lot.applicableDTUs,
      prestations: lot.selectedPrestations,
    }));
  }

  /**
   * Construit les exigences basées sur le projet
   */
  private static buildRequirements(project: Phase0Project): TenderRequirements {
    const requirements: TenderRequirements = {
      insuranceDecennaleRequired: true,
      insuranceRcProRequired: true,
    };

    // Vérifier si des lots nécessitent RGE
    const hasRGELots = project.selectedLots?.some(l => l.isRGEEligible);
    if (hasRGELots) {
      requirements.rgeRequired = true;
    }

    // Collecter les qualifications requises
    const qualifications = new Set<string>();
    project.selectedLots?.forEach(lot => {
      lot.requiredQualifications?.forEach(q => qualifications.add(q));
    });
    if (qualifications.size > 0) {
      requirements.requiredQualifications = [...qualifications];
    }

    return requirements;
  }

  /**
   * Extrait le nom du contact depuis le projet
   */
  private static getContactName(project: Phase0Project): string {
    const owner = project.owner;
    if (!owner?.identity) return '';

    if (owner.identity.type === 'b2c') {
      return `${owner.identity.firstName || ''} ${owner.identity.lastName || ''}`.trim();
    }

    return owner.identity.companyName || '';
  }

  /**
   * Mappe une row DB vers un Tender
   */
  private static mapRowToTender(row: Record<string, unknown>): Tender {
    return {
      id: row.id as string,
      phase0ProjectId: row.phase0_project_id as string | undefined,
      userId: row.user_id as string,
      reference: row.reference as string,
      title: row.title as string,
      description: row.description as string | undefined,
      tenderType: row.tender_type as TenderType,
      visibility: row.visibility as TenderVisibility,
      status: row.status as TenderStatus,
      publicationDate: row.publication_date ? new Date(row.publication_date as string) : undefined,
      questionsDeadline: row.questions_deadline ? new Date(row.questions_deadline as string) : undefined,
      responseDeadline: row.response_deadline ? new Date(row.response_deadline as string) : undefined,
      openingDate: row.opening_date ? new Date(row.opening_date as string) : undefined,
      attributionDate: row.attribution_date ? new Date(row.attribution_date as string) : undefined,
      workAddress: row.work_address as Tender['workAddress'],
      workCity: row.work_city as string | undefined,
      workPostalCode: row.work_postal_code as string | undefined,
      workDepartment: row.work_department as string | undefined,
      workRegion: row.work_region as string | undefined,
      projectType: row.project_type as string | undefined,
      workCategories: row.work_categories as string[] | undefined,
      selectedLots: row.selected_lots as TenderLot[] | undefined,
      lotsCount: row.lots_count as number,
      estimatedBudgetMin: row.estimated_budget_min as number | undefined,
      estimatedBudgetMax: row.estimated_budget_max as number | undefined,
      budgetVisibility: (row.budget_visibility as string || 'hidden') as 'hidden' | 'range' | 'exact',
      estimatedDurationDays: row.estimated_duration_days as number | undefined,
      desiredStartDate: row.desired_start_date ? new Date(row.desired_start_date as string) : undefined,
      desiredEndDate: row.desired_end_date ? new Date(row.desired_end_date as string) : undefined,
      dceDocuments: row.dce_documents as TenderDocument[] || [],
      dceGeneratedAt: row.dce_generated_at ? new Date(row.dce_generated_at as string) : undefined,
      dceVersion: row.dce_version as number || 1,
      evaluationCriteria: row.evaluation_criteria as EvaluationCriterion[] || DEFAULT_EVALUATION_CRITERIA,
      requirements: row.requirements as TenderRequirements || {},
      targetCompanies: row.target_companies as string[] | undefined,
      invitedCount: row.invited_count as number || 0,
      viewsCount: row.views_count as number || 0,
      downloadsCount: row.downloads_count as number || 0,
      responsesCount: row.responses_count as number || 0,
      contactName: row.contact_name as string | undefined,
      contactEmail: row.contact_email as string | undefined,
      contactPhone: row.contact_phone as string | undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      tags: row.tags as string[] | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      publishedAt: row.published_at ? new Date(row.published_at as string) : undefined,
      closedAt: row.closed_at ? new Date(row.closed_at as string) : undefined,
    };
  }

  /**
   * Mappe une row DB vers une TenderInvitation
   */
  private static mapRowToInvitation(row: Record<string, unknown>): TenderInvitation {
    return {
      id: row.id as string,
      tenderId: row.tender_id as string,
      companyId: row.company_id as string | undefined,
      companySiret: row.company_siret as string,
      companyName: row.company_name as string,
      companyEmail: row.company_email as string,
      status: row.status as TenderInvitation['status'],
      sentAt: row.sent_at ? new Date(row.sent_at as string) : undefined,
      viewedAt: row.viewed_at ? new Date(row.viewed_at as string) : undefined,
      downloadedAt: row.downloaded_at ? new Date(row.downloaded_at as string) : undefined,
      respondedAt: row.responded_at ? new Date(row.responded_at as string) : undefined,
      declinedAt: row.declined_at ? new Date(row.declined_at as string) : undefined,
      declineReason: row.decline_reason as string | undefined,
      accessToken: row.access_token as string | undefined,
      tokenExpiresAt: row.token_expires_at ? new Date(row.token_expires_at as string) : undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

export default TenderService;

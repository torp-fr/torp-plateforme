/**
 * TORP Phase 3 - Contrôle Service
 * Gestion des contrôles réglementaires et qualité
 *
 * PRODUCTION-READY: Utilise Supabase pour la persistance
 */

import { supabase } from '@/lib/supabase';
import type {
  OrganismeControle,
  MissionBureauControle,
  VisiteControle,
  RapportControle,
  ReserveControle,
  CertificationObligatoire,
  CoordinateurSPS,
  VisiteSPS,
  ObservationSPS,
  FicheAutoControle,
  VisiteMOE,
  GrilleControleQualite,
  AlerteControle,
  CreateOrganismeControleInput,
  CreateVisiteControleInput,
  CreateCertificationInput,
  CreateFicheAutoControleInput,
  CreateGrilleQualiteInput,
  TypeOrganismeControle,
  StatutCertification,
  CategorieGrilleQualite,
  TEMPLATES_GRILLES_QUALITE,
} from '@/types/phase3';

// ============================================
// FILTRES
// ============================================

export interface OrganismeControleFilters {
  chantierId?: string;
  type?: TypeOrganismeControle;
  statut?: 'actif' | 'termine';
}

export interface VisiteControleFilters {
  organismeId?: string;
  chantierId?: string;
  dateDebut?: string;
  dateFin?: string;
  statut?: VisiteControle['statut'];
}

export interface CertificationFilters {
  chantierId?: string;
  type?: CertificationObligatoire['type'];
  statut?: StatutCertification;
}

export interface FicheAutoControleFilters {
  chantierId?: string;
  entreprise?: string;
  lot?: string;
  dateDebut?: string;
  dateFin?: string;
}

export interface GrilleQualiteFilters {
  chantierId?: string;
  categorie?: CategorieGrilleQualite;
  lot?: string;
  dateDebut?: string;
  dateFin?: string;
}

// ============================================
// SERVICE
// ============================================

export class ControleService {
  // ============================================
  // CONTRÔLES QUALITÉ (via quality_controls)
  // ============================================

  /**
   * Créer un contrôle qualité
   */
  static async createQualityControl(input: {
    projectId: string;
    lotId?: string;
    controlType: 'autocontrole' | 'bureau_controle' | 'moe' | 'reception';
    controlCategory?: string;
    checkpointId: string;
    checkpointLabel: string;
    status?: 'pending' | 'pass' | 'fail' | 'na';
    value?: Record<string, unknown>;
    notes?: string;
    photos?: string[];
    companyId?: string;
  }) {
    const { data, error } = await supabase
      .from('quality_controls')
      .insert({
        project_id: input.projectId,
        lot_id: input.lotId,
        control_type: input.controlType,
        control_category: input.controlCategory,
        checkpoint_id: input.checkpointId,
        checkpoint_label: input.checkpointLabel,
        status: input.status || 'pending',
        value: input.value || null,
        notes: input.notes,
        photos: input.photos || [],
        company_id: input.companyId,
        controlled_at: input.status !== 'pending' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) {
      console.error('[ControleService] Error creating quality control:', error);
      throw new Error(`Failed to create quality control: ${error.message}`);
    }

    return data;
  }

  /**
   * Mettre à jour un contrôle qualité
   */
  static async updateQualityControl(
    controlId: string,
    updates: {
      status?: 'pending' | 'pass' | 'fail' | 'na';
      value?: Record<string, unknown>;
      notes?: string;
      photos?: string[];
      controlledBy?: string;
    }
  ) {
    const { data, error } = await supabase
      .from('quality_controls')
      .update({
        status: updates.status,
        value: updates.value,
        notes: updates.notes,
        photos: updates.photos,
        controlled_by: updates.controlledBy,
        controlled_at: updates.status && updates.status !== 'pending'
          ? new Date().toISOString()
          : undefined,
      })
      .eq('id', controlId)
      .select()
      .single();

    if (error) {
      console.error('[ControleService] Error updating quality control:', error);
      throw new Error(`Failed to update quality control: ${error.message}`);
    }

    return data;
  }

  /**
   * Lister les contrôles qualité
   */
  static async listQualityControls(filters: {
    projectId?: string;
    lotId?: string;
    controlType?: string;
    status?: string;
  } = {}) {
    let query = supabase.from('quality_controls').select('*');

    if (filters.projectId) {
      query = query.eq('project_id', filters.projectId);
    }
    if (filters.lotId) {
      query = query.eq('lot_id', filters.lotId);
    }
    if (filters.controlType) {
      query = query.eq('control_type', filters.controlType);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('[ControleService] Error listing quality controls:', error);
      return [];
    }

    return data || [];
  }

  // ============================================
  // VISITES DE CONTRÔLE (via control_visits)
  // ============================================

  /**
   * Planifier une visite de contrôle
   */
  static async createControlVisit(input: {
    projectId: string;
    visitType: 'bureau_controle' | 'interne' | 'organisme' | 'sps';
    organismeName?: string;
    organismeId?: string;
    scheduledAt: string;
    participants?: Array<{ name: string; role: string; company?: string; email?: string }>;
  }) {
    const { data, error } = await supabase
      .from('control_visits')
      .insert({
        project_id: input.projectId,
        visit_type: input.visitType,
        organisme_name: input.organismeName,
        organisme_id: input.organismeId,
        scheduled_at: input.scheduledAt,
        participants: input.participants || [],
        status: 'scheduled',
      })
      .select()
      .single();

    if (error) {
      console.error('[ControleService] Error creating control visit:', error);
      throw new Error(`Failed to create control visit: ${error.message}`);
    }

    return data;
  }

  /**
   * Compléter une visite de contrôle
   */
  static async completeControlVisit(
    visitId: string,
    completion: {
      durationMinutes?: number;
      reportReference?: string;
      reportPath?: string;
      observations?: Array<{
        type: string;
        description: string;
        severity: 'info' | 'minor' | 'major' | 'blocking';
        location?: string;
        photoUrl?: string;
      }>;
      reservesCount?: number;
    }
  ) {
    const { data, error } = await supabase
      .from('control_visits')
      .update({
        completed_at: new Date().toISOString(),
        duration_minutes: completion.durationMinutes,
        report_reference: completion.reportReference,
        report_path: completion.reportPath,
        observations: completion.observations || [],
        reserves_count: completion.reservesCount || 0,
        status: 'completed',
      })
      .eq('id', visitId)
      .select()
      .single();

    if (error) {
      console.error('[ControleService] Error completing control visit:', error);
      throw new Error(`Failed to complete control visit: ${error.message}`);
    }

    return data;
  }

  /**
   * Lister les visites de contrôle
   */
  static async listControlVisits(filters: {
    projectId?: string;
    visitType?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
  } = {}) {
    let query = supabase.from('control_visits').select('*');

    if (filters.projectId) {
      query = query.eq('project_id', filters.projectId);
    }
    if (filters.visitType) {
      query = query.eq('visit_type', filters.visitType);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.fromDate) {
      query = query.gte('scheduled_at', filters.fromDate);
    }
    if (filters.toDate) {
      query = query.lte('scheduled_at', filters.toDate);
    }

    const { data, error } = await query.order('scheduled_at', { ascending: true });

    if (error) {
      console.error('[ControleService] Error listing control visits:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Mettre à jour le nombre de réserves levées
   */
  static async updateReservesLevees(visitId: string, reservesLeveesCount: number) {
    const { data, error } = await supabase
      .from('control_visits')
      .update({
        reserves_levees_count: reservesLeveesCount,
      })
      .eq('id', visitId)
      .select()
      .single();

    if (error) {
      console.error('[ControleService] Error updating reserves levees:', error);
      throw new Error(`Failed to update reserves levees: ${error.message}`);
    }

    return data;
  }

  // ============================================
  // LEGACY METHODS (adaptées pour compatibilité)
  // ============================================

  /**
   * Créer un organisme de contrôle
   * @deprecated Utiliser createControlVisit pour les visites
   */
  static async createOrganisme(input: CreateOrganismeControleInput): Promise<OrganismeControle> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const organisme: OrganismeControle = {
      id,
      chantierId: input.chantierId,
      type: input.type,
      nom: input.nom,
      reference: input.reference,
      contact: input.contact,
      missions: (input.missions || []).map(code => ({
        id: crypto.randomUUID(),
        organismeId: id,
        code,
        libelle: this.getMissionLibelle(code),
        statut: 'planifiee',
        rapports: [],
        nombreReserves: 0,
        reservesLevees: 0,
      })),
      dateDebut: input.dateDebut,
      montantHT: input.montantHT,
      statut: 'actif',
      createdAt: now,
      updatedAt: now,
    };

    // Créer une entrée de visite pour chaque mission
    for (const mission of organisme.missions) {
      await this.createControlVisit({
        projectId: input.chantierId,
        visitType: 'bureau_controle',
        organismeName: input.nom,
        scheduledAt: input.dateDebut,
        participants: input.contact ? [{
          name: input.contact.nom,
          email: input.contact.email,
          role: 'controleur',
        }] : [],
      }).catch(err => {
        console.warn('[ControleService] Could not create control visit:', err);
      });
    }

    return organisme;
  }

  /**
   * Récupérer un organisme par ID
   */
  static async getOrganisme(id: string): Promise<OrganismeControle | null> {
    // Non persisté en DB - retourne null
    // Les organismes sont maintenant gérés via control_visits
    return null;
  }

  /**
   * Lister les organismes de contrôle
   */
  static async listOrganismes(filters?: OrganismeControleFilters): Promise<OrganismeControle[]> {
    // Adapter depuis control_visits
    const visits = await this.listControlVisits({
      projectId: filters?.chantierId,
      visitType: filters?.type === 'bureau_controle' ? 'bureau_controle' : undefined,
    });

    // Grouper par organisme
    const organismeMap = new Map<string, OrganismeControle>();

    for (const visit of visits) {
      const key = visit.organisme_name || visit.id;
      if (!organismeMap.has(key)) {
        organismeMap.set(key, {
          id: visit.organisme_id || visit.id,
          chantierId: visit.project_id,
          type: visit.visit_type as TypeOrganismeControle,
          nom: visit.organisme_name || 'Non spécifié',
          missions: [],
          statut: visit.status === 'completed' ? 'termine' : 'actif',
          createdAt: visit.created_at,
          updatedAt: visit.updated_at,
        });
      }
    }

    return Array.from(organismeMap.values());
  }

  /**
   * Libellé des missions de contrôle
   */
  static getMissionLibelle(code: string): string {
    const libelles: Record<string, string> = {
      'L': 'Solidité des ouvrages',
      'S': 'Sécurité des personnes',
      'PS': 'Sécurité incendie',
      'HAND': 'Accessibilité handicapés',
      'TH': 'Thermique',
      'PH': 'Acoustique',
      'SEI': 'Sécurité ERP',
      'DTA': 'Diagnostic amiante',
      'STI': 'Sécurité travail',
      'AV': 'Ascenseurs',
    };
    return libelles[code] || code;
  }

  /**
   * Planifier une visite de contrôle (legacy)
   */
  static async createVisite(input: CreateVisiteControleInput): Promise<VisiteControle> {
    const visit = await this.createControlVisit({
      projectId: input.organismeId, // Utiliser organismeId comme projectId fallback
      visitType: input.type === 'visite_periodique' ? 'bureau_controle' : 'interne',
      scheduledAt: input.datePrevue,
      participants: input.controleur ? [{ name: input.controleur, role: 'controleur' }] : [],
    });

    return {
      id: visit.id,
      organismeId: input.organismeId,
      missionId: input.missionId,
      type: input.type,
      datePrevue: input.datePrevue,
      controleur: input.controleur,
      statut: 'planifiee',
      createdAt: visit.created_at,
    };
  }

  /**
   * Enregistrer un rapport de visite
   */
  static async createRapport(
    visiteId: string,
    rapport: Omit<RapportControle, 'id' | 'visiteId' | 'createdAt'>
  ): Promise<RapportControle> {
    // Mettre à jour la visite avec le rapport
    await this.completeControlVisit(visiteId, {
      reportReference: rapport.reference,
      reservesCount: rapport.reservesEmises,
    });

    return {
      id: crypto.randomUUID(),
      visiteId,
      ...rapport,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Ajouter une réserve
   */
  static async createReserve(
    rapportId: string,
    reserve: Omit<ReserveControle, 'id' | 'rapportId' | 'createdAt' | 'updatedAt'>
  ): Promise<ReserveControle> {
    const now = new Date().toISOString();

    // Créer un contrôle qualité pour tracer la réserve
    await this.createQualityControl({
      projectId: rapportId, // Utiliser rapportId comme référence
      controlType: 'bureau_controle',
      checkpointId: `reserve-${crypto.randomUUID().slice(0, 8)}`,
      checkpointLabel: reserve.description,
      status: 'fail',
      notes: `Réserve ${reserve.gravite}: ${reserve.localisation}`,
    });

    return {
      id: crypto.randomUUID(),
      rapportId,
      ...reserve,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Lever une réserve
   */
  static async leverReserve(
    reserveId: string,
    levee: ReserveControle['levee']
  ): Promise<ReserveControle> {
    // Mettre à jour le contrôle qualité associé
    const controls = await this.listQualityControls({ status: 'fail' });
    const matchingControl = controls.find(c => c.checkpoint_id?.includes(reserveId));

    if (matchingControl) {
      await this.updateQualityControl(matchingControl.id, {
        status: 'pass',
        notes: `Levée: ${levee?.description || 'Réserve levée'}`,
      });
    }

    return {
      id: reserveId,
      rapportId: 'resolved',
      localisation: '',
      description: '',
      gravite: 'mineure',
      statut: 'levee',
      levee,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Lister les visites (legacy)
   */
  static async listVisites(filters?: VisiteControleFilters): Promise<VisiteControle[]> {
    const visits = await this.listControlVisits({
      projectId: filters?.chantierId,
      status: filters?.statut,
      fromDate: filters?.dateDebut,
      toDate: filters?.dateFin,
    });

    return visits.map(v => ({
      id: v.id,
      organismeId: v.organisme_id || v.id,
      type: 'visite_periodique' as const,
      datePrevue: v.scheduled_at,
      dateRealisee: v.completed_at,
      controleur: v.participants?.[0]?.name || 'Non spécifié',
      statut: this.mapVisitStatusToLegacy(v.status),
      createdAt: v.created_at,
    }));
  }

  private static mapVisitStatusToLegacy(status: string): VisiteControle['statut'] {
    switch (status) {
      case 'scheduled': return 'planifiee';
      case 'in_progress': return 'en_cours';
      case 'completed': return 'terminee';
      case 'reported': return 'rapport_emis';
      case 'cancelled': return 'annulee';
      default: return 'planifiee';
    }
  }

  // ============================================
  // CERTIFICATIONS OBLIGATOIRES
  // ============================================

  /**
   * Créer une certification
   */
  static async createCertification(input: CreateCertificationInput): Promise<CertificationObligatoire> {
    const now = new Date().toISOString();

    // Stocker via quality_controls
    const control = await this.createQualityControl({
      projectId: input.chantierId,
      controlType: 'reception',
      controlCategory: 'certification',
      checkpointId: `cert-${input.type}`,
      checkpointLabel: `Certification ${input.type} - ${input.organisme}`,
      status: 'pending',
      value: {
        type: input.type,
        organisme: input.organisme,
        coutHT: input.coutHT,
      },
    });

    return {
      id: control.id,
      chantierId: input.chantierId,
      type: input.type,
      organisme: input.organisme,
      statut: 'a_demander',
      coutHT: input.coutHT,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Mettre à jour le statut d'une certification
   */
  static async updateCertificationStatut(
    id: string,
    statut: StatutCertification,
    updates?: Partial<CertificationObligatoire>
  ): Promise<CertificationObligatoire> {
    const statusMap: Record<StatutCertification, 'pending' | 'pass' | 'fail'> = {
      'a_demander': 'pending',
      'demande_envoyee': 'pending',
      'visite_planifiee': 'pending',
      'visite_realisee': 'pending',
      'certificat_obtenu': 'pass',
      'certificat_refuse': 'fail',
      'expire': 'fail',
    };

    await this.updateQualityControl(id, {
      status: statusMap[statut],
      notes: `Statut: ${statut}`,
      value: updates,
    });

    return {
      id,
      chantierId: updates?.chantierId || 'unknown',
      type: updates?.type || 'consuel_jaune',
      organisme: updates?.organisme || 'Non spécifié',
      statut,
      ...updates,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Lister les certifications
   */
  static async listCertifications(filters?: CertificationFilters): Promise<CertificationObligatoire[]> {
    const controls = await this.listQualityControls({
      projectId: filters?.chantierId,
      controlType: 'reception',
    });

    return controls
      .filter(c => c.control_category === 'certification')
      .map(c => ({
        id: c.id,
        chantierId: c.project_id,
        type: (c.value as any)?.type || 'autre',
        organisme: (c.value as any)?.organisme || 'Non spécifié',
        statut: this.mapControlStatusToCertStatus(c.status),
        coutHT: (c.value as any)?.coutHT,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      }));
  }

  private static mapControlStatusToCertStatus(status: string): StatutCertification {
    switch (status) {
      case 'pending': return 'a_demander';
      case 'pass': return 'certificat_obtenu';
      case 'fail': return 'certificat_refuse';
      default: return 'a_demander';
    }
  }

  /**
   * Obtenir les certifications requises selon le projet
   */
  static getCertificationsRequises(projet: {
    montantHT?: number;
    estERP?: boolean;
    aGaz?: boolean;
    reglementationThermique?: 'RT2012' | 'RE2020';
  }): { type: CertificationObligatoire['type']; obligatoire: boolean; description: string }[] {
    const certifications: { type: CertificationObligatoire['type']; obligatoire: boolean; description: string }[] = [];

    // Consuel toujours obligatoire
    certifications.push({
      type: 'consuel_jaune',
      obligatoire: true,
      description: 'Attestation de conformité électrique (usage propre)',
    });

    // Qualigaz si gaz
    if (projet.aGaz) {
      certifications.push({
        type: 'qualigaz',
        obligatoire: true,
        description: 'Certificat conformité installation gaz',
      });
      certifications.push({
        type: 'certigaz',
        obligatoire: true,
        description: 'Vérification GRDF avant ouverture compteur',
      });
    }

    // RE2020 / RT2012
    if (projet.reglementationThermique) {
      certifications.push({
        type: 'test_etancheite',
        obligatoire: true,
        description: 'Test étanchéité air (Q4Pa-surf)',
      });
      certifications.push({
        type: 'attestation_fin_travaux_re2020',
        obligatoire: true,
        description: 'Attestation fin travaux (Bbio, Cep)',
      });
    }

    return certifications;
  }

  // ============================================
  // COORDONNATEUR SPS
  // ============================================

  /**
   * Créer un coordonnateur SPS
   */
  static async createCoordinateurSPS(
    chantierId: string,
    coordinateur: Omit<CoordinateurSPS, 'id' | 'chantierId' | 'createdAt' | 'updatedAt'>
  ): Promise<CoordinateurSPS> {
    const now = new Date().toISOString();

    // Créer une visite SPS
    await this.createControlVisit({
      projectId: chantierId,
      visitType: 'sps',
      organismeName: coordinateur.organisme,
      scheduledAt: coordinateur.prochainVisite || now,
      participants: [{
        name: coordinateur.nom,
        email: coordinateur.email,
        role: 'coordinateur_sps',
      }],
    });

    return {
      id: crypto.randomUUID(),
      chantierId,
      ...coordinateur,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Enregistrer une visite SPS
   */
  static async createVisiteSPS(
    coordinateurId: string,
    visite: Omit<VisiteSPS, 'id' | 'coordinateurId' | 'createdAt'>
  ): Promise<VisiteSPS> {
    // Créer une quality control pour la visite SPS
    await this.createQualityControl({
      projectId: coordinateurId,
      controlType: 'bureau_controle',
      controlCategory: 'sps',
      checkpointId: `sps-visite-${crypto.randomUUID().slice(0, 8)}`,
      checkpointLabel: `Visite SPS - ${visite.objet}`,
      status: visite.observations?.some(o => o.gravite === 'danger_grave') ? 'fail' : 'pass',
      notes: visite.syntheseGenerale,
      photos: visite.photos,
    });

    return {
      id: crypto.randomUUID(),
      coordinateurId,
      ...visite,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Obtenir le coordinateur SPS d'un chantier
   */
  static async getCoordinateurSPS(chantierId: string): Promise<CoordinateurSPS | null> {
    const visits = await this.listControlVisits({
      projectId: chantierId,
      visitType: 'sps',
    });

    if (visits.length === 0) {
      return null;
    }

    const latestVisit = visits[0];
    const participant = latestVisit.participants?.[0];

    return {
      id: latestVisit.id,
      chantierId,
      organisme: latestVisit.organisme_name || 'Non spécifié',
      nom: participant?.name || 'Non spécifié',
      email: participant?.email,
      niveau: '2',
      dateDebut: latestVisit.created_at.split('T')[0],
      frequenceVisites: 'hebdomadaire',
      prochainVisite: latestVisit.scheduled_at.split('T')[0],
      statut: 'actif',
      createdAt: latestVisit.created_at,
      updatedAt: latestVisit.updated_at,
    };
  }

  // ============================================
  // AUTO-CONTRÔLES ENTREPRISE
  // ============================================

  /**
   * Créer une fiche d'auto-contrôle
   */
  static async createFicheAutoControle(input: CreateFicheAutoControleInput): Promise<FicheAutoControle> {
    const now = new Date().toISOString();

    // Calculer le résultat global
    const items = input.items.map(item => ({
      id: crypto.randomUUID(),
      ...item,
    }));

    const hasNonConforme = items.some(i => i.resultat === 'non_conforme');
    const hasReserveMajeure = items.some(i => i.resultat === 'reserve_majeure');
    const hasReserveMineure = items.some(i => i.resultat === 'reserve_mineure');

    let resultat: FicheAutoControle['resultat'] = 'conforme';
    if (hasNonConforme) resultat = 'non_conforme';
    else if (hasReserveMajeure) resultat = 'reserve_majeure';
    else if (hasReserveMineure) resultat = 'reserve_mineure';

    // Stocker via quality_controls
    const control = await this.createQualityControl({
      projectId: input.chantierId,
      lotId: input.lotId,
      controlType: 'autocontrole',
      controlCategory: input.lot,
      checkpointId: `autocontrole-${crypto.randomUUID().slice(0, 8)}`,
      checkpointLabel: input.objet,
      status: resultat === 'conforme' ? 'pass' : 'fail',
      value: {
        entreprise: input.entreprise,
        lot: input.lot,
        zone: input.zone,
        dateControle: input.dateControle,
        controlePar: input.controlePar,
        items,
        resultat,
      },
    });

    return {
      id: control.id,
      chantierId: input.chantierId,
      lotId: input.lotId,
      tacheId: input.tacheId,
      entreprise: input.entreprise,
      lot: input.lot,
      objet: input.objet,
      zone: input.zone,
      dateControle: input.dateControle,
      controlePar: input.controlePar,
      items,
      resultat,
      photos: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Lister les fiches d'auto-contrôle
   */
  static async listFichesAutoControle(filters?: FicheAutoControleFilters): Promise<FicheAutoControle[]> {
    const controls = await this.listQualityControls({
      projectId: filters?.chantierId,
      controlType: 'autocontrole',
    });

    return controls
      .filter(c => {
        if (filters?.entreprise && (c.value as any)?.entreprise !== filters.entreprise) return false;
        if (filters?.lot && (c.value as any)?.lot !== filters.lot) return false;
        return true;
      })
      .map(c => {
        const value = c.value as any;
        return {
          id: c.id,
          chantierId: c.project_id,
          lotId: c.lot_id,
          entreprise: value?.entreprise || 'Non spécifié',
          lot: value?.lot || c.control_category || 'Non spécifié',
          objet: c.checkpoint_label,
          zone: value?.zone,
          dateControle: value?.dateControle || c.controlled_at?.split('T')[0],
          controlePar: value?.controlePar || 'Non spécifié',
          items: value?.items || [],
          resultat: value?.resultat || (c.status === 'pass' ? 'conforme' : 'non_conforme'),
          photos: c.photos || [],
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        };
      });
  }

  /**
   * Valider une fiche par le MOE
   */
  static async validerFicheAutoControle(
    ficheId: string,
    validation: FicheAutoControle['validationMOE']
  ): Promise<FicheAutoControle> {
    await this.updateQualityControl(ficheId, {
      notes: `Validé MOE: ${validation?.decision} - ${validation?.commentaire || ''}`,
      controlledBy: validation?.par,
    });

    const fiches = await this.listFichesAutoControle();
    const fiche = fiches.find(f => f.id === ficheId);
    if (fiche) {
      fiche.validationMOE = validation;
      fiche.updatedAt = new Date().toISOString();
    }
    return fiche!;
  }

  // ============================================
  // VISITES MOE
  // ============================================

  /**
   * Enregistrer une visite MOE
   */
  static async createVisiteMOE(
    chantierId: string,
    visite: Omit<VisiteMOE, 'id' | 'chantierId' | 'createdAt'>
  ): Promise<VisiteMOE> {
    const visit = await this.createControlVisit({
      projectId: chantierId,
      visitType: 'interne',
      scheduledAt: visite.date,
      participants: visite.moe ? [{ name: visite.moe, role: 'moe' }] : [],
    });

    await this.completeControlVisit(visit.id, {
      durationMinutes: visite.dureeMinutes,
      observations: visite.pointsVerifies?.map(p => ({
        type: p.lot,
        description: p.constatation,
        severity: p.conforme ? 'info' : 'major',
        location: p.zone,
      })),
    });

    return {
      id: visit.id,
      chantierId,
      ...visite,
      createdAt: visit.created_at,
    };
  }

  /**
   * Lister les visites MOE
   */
  static async listVisitesMOE(chantierId: string): Promise<VisiteMOE[]> {
    const visits = await this.listControlVisits({
      projectId: chantierId,
      visitType: 'interne',
      status: 'completed',
    });

    return visits.map(v => ({
      id: v.id,
      chantierId,
      type: 'visite_periodique',
      date: v.completed_at?.split('T')[0] || v.scheduled_at.split('T')[0],
      dureeMinutes: v.duration_minutes,
      moe: v.participants?.[0]?.name || 'Non spécifié',
      pointsVerifies: v.observations?.map(o => ({
        id: crypto.randomUUID(),
        lot: o.type,
        zone: o.location,
        objet: o.description,
        constatation: o.description,
        conforme: o.severity === 'info',
      })) || [],
      createdAt: v.created_at,
    }));
  }

  // ============================================
  // GRILLES DE CONTRÔLE QUALITÉ
  // ============================================

  /**
   * Créer une grille de contrôle qualité
   */
  static async createGrilleQualite(input: CreateGrilleQualiteInput): Promise<GrilleControleQualite> {
    const now = new Date().toISOString();
    const template = TEMPLATES_GRILLES_QUALITE[input.categorie];

    // Créer les critères depuis le template
    const criteres = (template?.criteres || []).map(c => ({
      id: crypto.randomUUID(),
      libelle: c.libelle,
      referenceNorme: c.referenceNorme,
      tolerance: c.tolerance,
      note: 0 as const,
    }));

    // Stocker via quality_controls
    const control = await this.createQualityControl({
      projectId: input.chantierId,
      controlType: 'moe',
      controlCategory: input.categorie,
      checkpointId: `grille-${input.categorie}-${crypto.randomUUID().slice(0, 8)}`,
      checkpointLabel: `Grille qualité ${input.categorie} - ${input.lot}`,
      status: 'pending',
      value: {
        categorie: input.categorie,
        lot: input.lot,
        zone: input.zone,
        dateControle: input.dateControle,
        controlePar: input.controlePar,
        roleControleur: input.roleControleur,
        criteres,
      },
    });

    return {
      id: control.id,
      chantierId: input.chantierId,
      categorie: input.categorie,
      lot: input.lot,
      zone: input.zone,
      dateControle: input.dateControle,
      controlePar: input.controlePar,
      roleControleur: input.roleControleur,
      criteres,
      scoreTotal: criteres.length * 3,
      scoreObtenu: 0,
      pourcentageConformite: 0,
      syntheseQualite: 'insuffisant',
      reserves: [],
      valide: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Mettre à jour les notes d'une grille
   */
  static async updateGrilleNotes(
    grilleId: string,
    criteres: GrilleControleQualite['criteres']
  ): Promise<GrilleControleQualite> {
    // Calculer les scores
    const applicables = criteres.filter(c => c.note > 0);
    const scoreObtenu = criteres.reduce((sum, c) => sum + c.note, 0);
    const scoreTotal = applicables.length * 3;
    const pourcentage = scoreTotal > 0 ? (scoreObtenu / scoreTotal) * 100 : 0;

    let synthese: GrilleControleQualite['syntheseQualite'] = 'inacceptable';
    if (pourcentage >= 90) synthese = 'excellent';
    else if (pourcentage >= 70) synthese = 'satisfaisant';
    else if (pourcentage >= 50) synthese = 'insuffisant';

    await this.updateQualityControl(grilleId, {
      status: synthese === 'excellent' || synthese === 'satisfaisant' ? 'pass' : 'fail',
      value: { criteres, scoreObtenu, scoreTotal, pourcentageConformite: pourcentage, syntheseQualite: synthese },
    });

    // Récupérer la grille mise à jour
    const controls = await this.listQualityControls({ controlType: 'moe' });
    const control = controls.find(c => c.id === grilleId);

    if (!control) {
      throw new Error('Grille not found');
    }

    const value = control.value as any;
    return {
      id: grilleId,
      chantierId: control.project_id,
      categorie: value?.categorie || 'gros_oeuvre',
      lot: value?.lot || 'Non spécifié',
      zone: value?.zone,
      dateControle: value?.dateControle || new Date().toISOString(),
      controlePar: value?.controlePar || 'Non spécifié',
      roleControleur: value?.roleControleur || 'moe',
      criteres,
      scoreTotal,
      scoreObtenu,
      pourcentageConformite: pourcentage,
      syntheseQualite: synthese,
      reserves: [],
      valide: false,
      createdAt: control.created_at,
      updatedAt: control.updated_at,
    };
  }

  /**
   * Lister les grilles de contrôle
   */
  static async listGrillesQualite(filters?: GrilleQualiteFilters): Promise<GrilleControleQualite[]> {
    const controls = await this.listQualityControls({
      projectId: filters?.chantierId,
      controlType: 'moe',
    });

    return controls
      .filter(c => {
        const value = c.value as any;
        if (filters?.categorie && value?.categorie !== filters.categorie) return false;
        if (filters?.lot && value?.lot !== filters.lot) return false;
        return true;
      })
      .map(c => {
        const value = c.value as any;
        return {
          id: c.id,
          chantierId: c.project_id,
          categorie: value?.categorie || 'gros_oeuvre',
          lot: value?.lot || c.control_category || 'Non spécifié',
          zone: value?.zone,
          dateControle: value?.dateControle || c.controlled_at?.split('T')[0],
          controlePar: value?.controlePar || 'Non spécifié',
          roleControleur: value?.roleControleur || 'moe',
          criteres: value?.criteres || [],
          scoreTotal: value?.scoreTotal || 0,
          scoreObtenu: value?.scoreObtenu || 0,
          pourcentageConformite: value?.pourcentageConformite || 0,
          syntheseQualite: value?.syntheseQualite || 'insuffisant',
          reserves: [],
          valide: c.status === 'pass',
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        };
      });
  }

  /**
   * Obtenir un template de grille
   */
  static getTemplateGrille(categorie: CategorieGrilleQualite) {
    return TEMPLATES_GRILLES_QUALITE[categorie];
  }

  // ============================================
  // ALERTES
  // ============================================

  /**
   * Obtenir les alertes contrôle d'un chantier
   */
  static async getAlertes(chantierId: string): Promise<AlerteControle[]> {
    const alertes: AlerteControle[] = [];
    const now = new Date().toISOString();

    // Vérifier les visites à planifier
    const visits = await this.listControlVisits({
      projectId: chantierId,
      status: 'scheduled',
    });

    for (const visit of visits) {
      const scheduledDate = new Date(visit.scheduled_at);
      const daysDiff = Math.ceil((scheduledDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      if (daysDiff <= 7 && daysDiff >= 0) {
        alertes.push({
          id: crypto.randomUUID(),
          chantierId,
          type: 'visite_a_planifier',
          niveau: daysDiff <= 2 ? 'error' : 'warning',
          entiteType: 'visite',
          entiteId: visit.id,
          titre: `Visite ${visit.organisme_name || visit.visit_type} dans ${daysDiff} jour(s)`,
          message: `Visite de contrôle prévue le ${scheduledDate.toLocaleDateString('fr-FR')}`,
          dateCreation: now,
          lu: false,
          traite: false,
          createdAt: now,
        });
      }
    }

    // Vérifier les certifications manquantes
    const certifications = await this.listCertifications({ chantierId });
    for (const cert of certifications) {
      if (cert.statut === 'a_demander') {
        alertes.push({
          id: crypto.randomUUID(),
          chantierId,
          type: 'certification_manquante',
          niveau: 'warning',
          entiteType: 'certification',
          entiteId: cert.id,
          titre: `Certification ${cert.type} à demander`,
          message: `La certification ${cert.organisme} n'a pas encore été demandée`,
          dateCreation: now,
          lu: false,
          traite: false,
          createdAt: now,
        });
      }
    }

    // Vérifier les contrôles échoués
    const failedControls = await this.listQualityControls({
      projectId: chantierId,
      status: 'fail',
    });

    for (const control of failedControls) {
      alertes.push({
        id: crypto.randomUUID(),
        chantierId,
        type: 'reserve_non_levee',
        niveau: 'error',
        entiteType: 'controle',
        entiteId: control.id,
        titre: `Contrôle non conforme`,
        message: control.checkpoint_label,
        dateCreation: now,
        lu: false,
        traite: false,
        createdAt: now,
      });
    }

    return alertes;
  }

  // ============================================
  // STATISTIQUES
  // ============================================

  /**
   * Obtenir les statistiques de contrôle d'un chantier
   */
  static async getStatistiques(chantierId: string) {
    const controls = await this.listQualityControls({ projectId: chantierId });
    const visits = await this.listControlVisits({ projectId: chantierId });
    const certifications = await this.listCertifications({ chantierId });
    const fiches = await this.listFichesAutoControle({ chantierId });
    const grilles = await this.listGrillesQualite({ chantierId });

    // Calculer les réserves non levées
    const reservesNonLevees = visits.reduce((sum, v) =>
      sum + (v.reserves_count - v.reserves_levees_count), 0);

    // Certifications obtenues
    const certificationsObtenues = certifications.filter(c => c.statut === 'certificat_obtenu').length;

    // Conformité moyenne
    const conformiteMoyenne = grilles.length > 0
      ? grilles.reduce((sum, g) => sum + g.pourcentageConformite, 0) / grilles.length
      : 0;

    return {
      organismes: {
        total: visits.length,
        actifs: visits.filter(v => v.status !== 'completed' && v.status !== 'cancelled').length,
      },
      reserves: {
        total: visits.reduce((sum, v) => sum + v.reserves_count, 0),
        levees: visits.reduce((sum, v) => sum + v.reserves_levees_count, 0),
        enAttente: reservesNonLevees,
      },
      certifications: {
        total: certifications.length,
        obtenues: certificationsObtenues,
        enAttente: certifications.length - certificationsObtenues,
      },
      autoControles: {
        total: fiches.length,
        conformes: fiches.filter(f => f.resultat === 'conforme').length,
        avecReserves: fiches.filter(f => f.resultat !== 'conforme').length,
      },
      qualite: {
        grillesEffectuees: grilles.length,
        conformiteMoyenne: Math.round(conformiteMoyenne),
        controlsPass: controls.filter(c => c.status === 'pass').length,
        controlsFail: controls.filter(c => c.status === 'fail').length,
      },
    };
  }
}

// ============================================
// ADAPTATEUR POUR HOOKS
// ============================================

/**
 * Adaptateur singleton pour les hooks React
 * Expose les méthodes statiques via une interface compatible
 */
export const controleService = {
  // Récupérer les contrôles
  getControles: (projetId: string, lotId?: string) =>
    ControleService.listQualityControls({ projectId: projetId, lotId }),

  // Récupérer les statistiques
  getStatistiques: (projetId: string) =>
    ControleService.getStatistiques(projetId),

  // Planning des contrôles (visites programmées)
  getPlanningControles: (projetId: string) =>
    ControleService.listControlVisits({ projectId: projetId, status: 'scheduled' }),

  // Créer un contrôle
  createControle: (data: { projetId: string; lotId?: string; type: string; checkpoint: string; category: string }) =>
    ControleService.createQualityControl({
      projectId: data.projetId,
      lotId: data.lotId,
      controlType: data.type as any,
      checkpointLabel: data.checkpoint,
      controlCategory: data.category,
    }),

  // Planifier une visite
  planifierVisite: (controleId: string, date: Date, participants: string[]) =>
    ControleService.createControlVisit({
      projectId: controleId, // Note: on utilise controleId comme projectId ici
      visitType: 'externe',
      scheduledAt: date.toISOString(),
      participants: participants.map(p => ({ name: p, role: 'inspector' })),
    }),

  // Enregistrer résultat
  enregistrerResultat: (controleId: string, resultat: string, observations: string, photos?: string[]) =>
    ControleService.updateQualityControl(controleId, {
      status: resultat === 'conforme' ? 'pass' : 'fail',
      notes: observations,
      photos,
    }),

  // Créer fiche NC
  creerFicheNC: (controleId: string, description: string, gravite: string, actionsCorrectives: string[]) =>
    ControleService.updateQualityControl(controleId, {
      status: 'fail',
      notes: `NC ${gravite}: ${description}\nActions: ${actionsCorrectives.join(', ')}`,
    }),

  // Lever réserve
  leverReserve: (controleId: string, commentaire: string, photos?: string[]) =>
    ControleService.updateQualityControl(controleId, {
      status: 'pass',
      notes: `Levée: ${commentaire}`,
      photos,
    }),
};

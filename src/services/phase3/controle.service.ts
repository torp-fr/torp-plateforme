/**
 * TORP Phase 3 - Contrôle Service
 * Gestion des contrôles réglementaires et qualité
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
  // ORGANISMES DE CONTRÔLE
  // ============================================

  /**
   * Créer un organisme de contrôle
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

    // Simulation - à remplacer par Supabase
    console.log('[ControleService] Organisme créé:', organisme);
    return organisme;
  }

  /**
   * Récupérer un organisme par ID
   */
  static async getOrganisme(id: string): Promise<OrganismeControle | null> {
    // Simulation - données mock
    return this.getMockOrganisme(id);
  }

  /**
   * Lister les organismes de contrôle
   */
  static async listOrganismes(filters?: OrganismeControleFilters): Promise<OrganismeControle[]> {
    // Simulation - données mock
    const organismes = this.getMockOrganismes();

    return organismes.filter(org => {
      if (filters?.chantierId && org.chantierId !== filters.chantierId) return false;
      if (filters?.type && org.type !== filters.type) return false;
      if (filters?.statut && org.statut !== filters.statut) return false;
      return true;
    });
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

  // ============================================
  // VISITES DE CONTRÔLE
  // ============================================

  /**
   * Planifier une visite de contrôle
   */
  static async createVisite(input: CreateVisiteControleInput): Promise<VisiteControle> {
    const visite: VisiteControle = {
      id: crypto.randomUUID(),
      organismeId: input.organismeId,
      missionId: input.missionId,
      type: input.type,
      datePrevue: input.datePrevue,
      controleur: input.controleur,
      statut: 'planifiee',
      createdAt: new Date().toISOString(),
    };

    console.log('[ControleService] Visite planifiée:', visite);
    return visite;
  }

  /**
   * Enregistrer un rapport de visite
   */
  static async createRapport(
    visiteId: string,
    rapport: Omit<RapportControle, 'id' | 'visiteId' | 'createdAt'>
  ): Promise<RapportControle> {
    const rapportComplet: RapportControle = {
      id: crypto.randomUUID(),
      visiteId,
      ...rapport,
      createdAt: new Date().toISOString(),
    };

    console.log('[ControleService] Rapport créé:', rapportComplet);
    return rapportComplet;
  }

  /**
   * Ajouter une réserve
   */
  static async createReserve(
    rapportId: string,
    reserve: Omit<ReserveControle, 'id' | 'rapportId' | 'createdAt' | 'updatedAt'>
  ): Promise<ReserveControle> {
    const now = new Date().toISOString();
    const reserveComplete: ReserveControle = {
      id: crypto.randomUUID(),
      rapportId,
      ...reserve,
      createdAt: now,
      updatedAt: now,
    };

    console.log('[ControleService] Réserve ajoutée:', reserveComplete);
    return reserveComplete;
  }

  /**
   * Lever une réserve
   */
  static async leverReserve(
    reserveId: string,
    levee: ReserveControle['levee']
  ): Promise<ReserveControle> {
    // Simulation - mise à jour
    console.log('[ControleService] Réserve levée:', reserveId, levee);

    return {
      id: reserveId,
      rapportId: 'mock',
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
   * Lister les visites
   */
  static async listVisites(filters?: VisiteControleFilters): Promise<VisiteControle[]> {
    return this.getMockVisites().filter(v => {
      if (filters?.organismeId && v.organismeId !== filters.organismeId) return false;
      if (filters?.statut && v.statut !== filters.statut) return false;
      return true;
    });
  }

  // ============================================
  // CERTIFICATIONS OBLIGATOIRES
  // ============================================

  /**
   * Créer une certification
   */
  static async createCertification(input: CreateCertificationInput): Promise<CertificationObligatoire> {
    const now = new Date().toISOString();
    const certification: CertificationObligatoire = {
      id: crypto.randomUUID(),
      chantierId: input.chantierId,
      type: input.type,
      organisme: input.organisme,
      statut: 'a_demander',
      coutHT: input.coutHT,
      createdAt: now,
      updatedAt: now,
    };

    console.log('[ControleService] Certification créée:', certification);
    return certification;
  }

  /**
   * Mettre à jour le statut d'une certification
   */
  static async updateCertificationStatut(
    id: string,
    statut: StatutCertification,
    updates?: Partial<CertificationObligatoire>
  ): Promise<CertificationObligatoire> {
    console.log('[ControleService] Certification mise à jour:', id, statut);

    return {
      id,
      chantierId: 'mock',
      type: 'consuel_jaune',
      organisme: 'Consuel',
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
    return this.getMockCertifications().filter(c => {
      if (filters?.chantierId && c.chantierId !== filters.chantierId) return false;
      if (filters?.type && c.type !== filters.type) return false;
      if (filters?.statut && c.statut !== filters.statut) return false;
      return true;
    });
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
    const sps: CoordinateurSPS = {
      id: crypto.randomUUID(),
      chantierId,
      ...coordinateur,
      createdAt: now,
      updatedAt: now,
    };

    console.log('[ControleService] Coordonnateur SPS créé:', sps);
    return sps;
  }

  /**
   * Enregistrer une visite SPS
   */
  static async createVisiteSPS(
    coordinateurId: string,
    visite: Omit<VisiteSPS, 'id' | 'coordinateurId' | 'createdAt'>
  ): Promise<VisiteSPS> {
    const visiteSPS: VisiteSPS = {
      id: crypto.randomUUID(),
      coordinateurId,
      ...visite,
      createdAt: new Date().toISOString(),
    };

    console.log('[ControleService] Visite SPS enregistrée:', visiteSPS);
    return visiteSPS;
  }

  /**
   * Obtenir le coordinateur SPS d'un chantier
   */
  static async getCoordinateurSPS(chantierId: string): Promise<CoordinateurSPS | null> {
    return this.getMockCoordinateurSPS(chantierId);
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

    const fiche: FicheAutoControle = {
      id: crypto.randomUUID(),
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

    console.log('[ControleService] Fiche auto-contrôle créée:', fiche);
    return fiche;
  }

  /**
   * Lister les fiches d'auto-contrôle
   */
  static async listFichesAutoControle(filters?: FicheAutoControleFilters): Promise<FicheAutoControle[]> {
    return this.getMockFichesAutoControle().filter(f => {
      if (filters?.chantierId && f.chantierId !== filters.chantierId) return false;
      if (filters?.entreprise && f.entreprise !== filters.entreprise) return false;
      if (filters?.lot && f.lot !== filters.lot) return false;
      return true;
    });
  }

  /**
   * Valider une fiche par le MOE
   */
  static async validerFicheAutoControle(
    ficheId: string,
    validation: FicheAutoControle['validationMOE']
  ): Promise<FicheAutoControle> {
    console.log('[ControleService] Fiche validée par MOE:', ficheId, validation);

    // Simulation retour
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
    const visiteMOE: VisiteMOE = {
      id: crypto.randomUUID(),
      chantierId,
      ...visite,
      createdAt: new Date().toISOString(),
    };

    console.log('[ControleService] Visite MOE enregistrée:', visiteMOE);
    return visiteMOE;
  }

  /**
   * Lister les visites MOE
   */
  static async listVisitesMOE(chantierId: string): Promise<VisiteMOE[]> {
    return this.getMockVisitesMOE(chantierId);
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

    const grille: GrilleControleQualite = {
      id: crypto.randomUUID(),
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

    console.log('[ControleService] Grille qualité créée:', grille);
    return grille;
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

    console.log('[ControleService] Grille notes mises à jour:', grilleId, { scoreObtenu, scoreTotal, pourcentage, synthese });

    // Simulation retour
    return {
      id: grilleId,
      chantierId: 'mock',
      categorie: 'gros_oeuvre',
      lot: 'Gros œuvre',
      dateControle: new Date().toISOString(),
      controlePar: 'MOE',
      roleControleur: 'moe',
      criteres,
      scoreTotal,
      scoreObtenu,
      pourcentageConformite: pourcentage,
      syntheseQualite: synthese,
      reserves: [],
      valide: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Lister les grilles de contrôle
   */
  static async listGrillesQualite(filters?: GrilleQualiteFilters): Promise<GrilleControleQualite[]> {
    return this.getMockGrillesQualite().filter(g => {
      if (filters?.chantierId && g.chantierId !== filters.chantierId) return false;
      if (filters?.categorie && g.categorie !== filters.categorie) return false;
      if (filters?.lot && g.lot !== filters.lot) return false;
      return true;
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
    const organismes = await this.listOrganismes({ chantierId, statut: 'actif' });
    for (const org of organismes) {
      // Simuler alerte visite proche
      alertes.push({
        id: crypto.randomUUID(),
        chantierId,
        type: 'visite_a_planifier',
        niveau: 'warning',
        entiteType: 'organisme',
        entiteId: org.id,
        titre: `Visite ${org.nom} à planifier`,
        message: `La prochaine visite de contrôle ${org.type} doit être planifiée`,
        dateCreation: now,
        lu: false,
        traite: false,
        createdAt: now,
      });
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

    return alertes;
  }

  // ============================================
  // STATISTIQUES
  // ============================================

  /**
   * Obtenir les statistiques de contrôle d'un chantier
   */
  static async getStatistiques(chantierId: string) {
    const organismes = await this.listOrganismes({ chantierId });
    const certifications = await this.listCertifications({ chantierId });
    const fiches = await this.listFichesAutoControle({ chantierId });
    const grilles = await this.listGrillesQualite({ chantierId });

    // Calculer les réserves non levées
    let reservesNonLevees = 0;
    organismes.forEach(org => {
      org.missions.forEach(m => {
        reservesNonLevees += m.nombreReserves - m.reservesLevees;
      });
    });

    // Certifications obtenues
    const certificationsObtenues = certifications.filter(c => c.statut === 'certificat_obtenu').length;

    // Conformité moyenne
    const conformiteMoyenne = grilles.length > 0
      ? grilles.reduce((sum, g) => sum + g.pourcentageConformite, 0) / grilles.length
      : 0;

    return {
      organismes: {
        total: organismes.length,
        actifs: organismes.filter(o => o.statut === 'actif').length,
      },
      reserves: {
        total: organismes.reduce((sum, o) => sum + o.missions.reduce((s, m) => s + m.nombreReserves, 0), 0),
        levees: organismes.reduce((sum, o) => sum + o.missions.reduce((s, m) => s + m.reservesLevees, 0), 0),
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
      },
    };
  }

  // ============================================
  // DONNÉES MOCK
  // ============================================

  private static getMockOrganisme(id: string): OrganismeControle | null {
    const organismes = this.getMockOrganismes();
    return organismes.find(o => o.id === id) || null;
  }

  private static getMockOrganismes(): OrganismeControle[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'org-1',
        chantierId: 'chantier-1',
        type: 'bureau_controle',
        nom: 'Socotec',
        reference: 'BC-2024-001',
        contact: {
          nom: 'Jean Dupont',
          email: 'j.dupont@socotec.fr',
          telephone: '01 23 45 67 89',
        },
        missions: [
          {
            id: 'mission-1',
            organismeId: 'org-1',
            code: 'L',
            libelle: 'Solidité des ouvrages',
            statut: 'en_cours',
            rapports: [],
            nombreReserves: 3,
            reservesLevees: 1,
          },
          {
            id: 'mission-2',
            organismeId: 'org-1',
            code: 'S',
            libelle: 'Sécurité des personnes',
            statut: 'en_cours',
            rapports: [],
            nombreReserves: 1,
            reservesLevees: 0,
          },
        ],
        dateDebut: '2024-01-15',
        montantHT: 8500,
        statut: 'actif',
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  private static getMockVisites(): VisiteControle[] {
    return [
      {
        id: 'visite-1',
        organismeId: 'org-1',
        missionId: 'mission-1',
        type: 'visite_periodique',
        datePrevue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        controleur: 'Jean Dupont',
        statut: 'planifiee',
        createdAt: new Date().toISOString(),
      },
    ];
  }

  private static getMockCertifications(): CertificationObligatoire[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'cert-1',
        chantierId: 'chantier-1',
        type: 'consuel_jaune',
        organisme: 'Consuel',
        statut: 'demande_envoyee',
        dateDemande: '2024-03-01',
        coutHT: 140,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'cert-2',
        chantierId: 'chantier-1',
        type: 'test_etancheite',
        organisme: 'Infiltrométrie France',
        statut: 'a_demander',
        coutHT: 750,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  private static getMockCoordinateurSPS(chantierId: string): CoordinateurSPS | null {
    const now = new Date().toISOString();
    return {
      id: 'sps-1',
      chantierId,
      organisme: 'Coordination SPS',
      nom: 'Marie Martin',
      email: 'm.martin@sps.fr',
      telephone: '06 12 34 56 78',
      niveau: '2',
      dateDebut: '2024-01-10',
      frequenceVisites: 'hebdomadaire',
      prochainVisite: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      statut: 'actif',
      createdAt: now,
      updatedAt: now,
    };
  }

  private static getMockFichesAutoControle(): FicheAutoControle[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'fiche-1',
        chantierId: 'chantier-1',
        entreprise: 'Maçonnerie Durand',
        lot: 'Gros œuvre',
        objet: 'Contrôle fondations',
        zone: 'RDC',
        dateControle: '2024-03-10',
        controlePar: 'Chef de chantier',
        items: [
          {
            id: 'item-1',
            libelle: 'Niveau des fondations',
            critere: '±5mm',
            valeurMesuree: '+3mm',
            resultat: 'conforme',
          },
          {
            id: 'item-2',
            libelle: 'Enrobage aciers',
            critere: '≥20mm',
            valeurMesuree: '25mm',
            resultat: 'conforme',
          },
        ],
        resultat: 'conforme',
        photos: [],
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  private static getMockVisitesMOE(chantierId: string): VisiteMOE[] {
    return [
      {
        id: 'visite-moe-1',
        chantierId,
        type: 'visite_periodique',
        date: '2024-03-08',
        dureeMinutes: 120,
        moe: 'Cabinet Architecture',
        pointsVerifies: [
          {
            id: 'pv-1',
            lot: 'Gros œuvre',
            zone: 'RDC',
            objet: 'Murs porteurs',
            constatation: 'Conforme aux plans',
            conforme: true,
          },
        ],
        avancementConstate: 35,
        coherenceAvecPlanning: true,
        syntheseGenerale: 'Chantier conforme, avancement normal',
        createdAt: new Date().toISOString(),
      },
    ];
  }

  private static getMockGrillesQualite(): GrilleControleQualite[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'grille-1',
        chantierId: 'chantier-1',
        categorie: 'gros_oeuvre',
        lot: 'Gros œuvre',
        zone: 'RDC',
        dateControle: '2024-03-10',
        controlePar: 'MOE',
        roleControleur: 'moe',
        criteres: [
          { id: 'c1', libelle: 'Planéité des murs', referenceNorme: 'DTU 20.1', tolerance: 'max 1cm/2m', note: 3 },
          { id: 'c2', libelle: 'Verticalité', referenceNorme: 'DTU 20.1', tolerance: 'max 1cm/étage', note: 3 },
          { id: 'c3', libelle: 'Niveaux dalles', referenceNorme: 'DTU 21', tolerance: '±5mm', note: 2 },
        ],
        scoreTotal: 9,
        scoreObtenu: 8,
        pourcentageConformite: 89,
        syntheseQualite: 'satisfaisant',
        reserves: [],
        valide: true,
        validePar: 'Architecte',
        createdAt: now,
        updatedAt: now,
      },
    ];
  }
}

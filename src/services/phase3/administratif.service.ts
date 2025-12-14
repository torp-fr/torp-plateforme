/**
 * TORP Phase 3 - Administratif Service
 * Gestion administrative : situations, budget, avenants, DOE, litiges
 */

import type {
  SituationTravaux,
  LigneSituation,
  SuiviBudgetaire,
  SuiviBudgetLot,
  Avenant,
  DossierOuvragesExecutes,
  DocumentDOE,
  Litige,
  AlerteAdministrative,
  CreateSituationInput,
  CreateAvenantInput,
  CreateLitigeInput,
  CreateDocumentDOEInput,
  StatutSituation,
  TypeAvenant,
  StatutAvenant,
  NiveauEscalade,
  StatutLitige,
  TEMPLATES_COURRIERS_LITIGE,
} from '@/types/phase3';

// ============================================
// FILTRES
// ============================================

export interface SituationFilters {
  chantierId?: string;
  entrepriseId?: string;
  statut?: StatutSituation;
  periodeDebut?: string;
  periodeFin?: string;
}

export interface AvenantFilters {
  chantierId?: string;
  type?: TypeAvenant;
  statut?: StatutAvenant;
}

export interface LitigeFilters {
  chantierId?: string;
  type?: Litige['type'];
  statut?: StatutLitige;
  gravite?: Litige['gravite'];
}

// ============================================
// SERVICE
// ============================================

export class AdministratifService {
  // ============================================
  // SITUATIONS DE TRAVAUX
  // ============================================

  /**
   * Créer une situation de travaux
   */
  static async createSituation(input: CreateSituationInput): Promise<SituationTravaux> {
    const now = new Date().toISOString();

    // Calculer les montants
    const lignes = input.lignes.map((l, index) => ({
      id: crypto.randomUUID(),
      ...l,
      montantPrecedentHT: l.montantMarcheHT * (l.avancementPrecedent / 100),
      montantActuelHT: l.montantMarcheHT * (l.avancementActuel / 100),
      montantPeriodeHT: l.montantMarcheHT * (l.avancementPeriode / 100),
    }));

    const montantPeriodeHT = lignes.reduce((sum, l) => sum + l.montantPeriodeHT, 0);
    const cumulAnterieurHT = lignes.reduce((sum, l) => sum + l.montantPrecedentHT, 0);
    const cumulSituationHT = lignes.reduce((sum, l) => sum + l.montantActuelHT, 0);

    const retenueGarantiePourcent = input.retenueGarantiePourcent ?? 5;
    const retenueGarantieHT = cumulSituationHT * (retenueGarantiePourcent / 100);

    const acomptesAnterieurs = cumulAnterieurHT - (cumulAnterieurHT * retenueGarantiePourcent / 100);
    const netAPayerHT = cumulSituationHT - retenueGarantieHT - acomptesAnterieurs;

    const tauxTVA = input.tauxTVA ?? 10;
    const montantTVA = netAPayerHT * (tauxTVA / 100);
    const netAPayerTTC = netAPayerHT + montantTVA;

    // Déterminer le numéro de situation
    const situationsExistantes = await this.listSituations({
      chantierId: input.chantierId,
      entrepriseId: input.entrepriseId,
    });
    const numero = situationsExistantes.length + 1;

    const situation: SituationTravaux = {
      id: crypto.randomUUID(),
      chantierId: input.chantierId,
      entrepriseId: input.entrepriseId,
      numero,
      periodeDebut: input.periodeDebut,
      periodeFin: input.periodeFin,
      lignes,
      montantPeriodeHT,
      cumulAnterieurHT,
      cumulSituationHT,
      retenueGarantiePourcent,
      retenueGarantieHT,
      acomptesAnterieurs,
      netAPayerHT,
      tauxTVA,
      montantTVA,
      netAPayerTTC,
      statut: 'brouillon',
      documents: [],
      createdAt: now,
      updatedAt: now,
    };

    console.log('[AdministratifService] Situation créée:', situation);
    return situation;
  }

  /**
   * Soumettre une situation pour validation
   */
  static async soumettreSituation(
    situationId: string,
    etabliePar: string
  ): Promise<SituationTravaux> {
    console.log('[AdministratifService] Situation soumise:', situationId);

    // Simulation
    const situations = await this.listSituations();
    const situation = situations.find(s => s.id === situationId);
    if (situation) {
      situation.statut = 'soumise';
      situation.etabliePar = etabliePar;
      situation.dateEtablissement = new Date().toISOString();
      situation.updatedAt = new Date().toISOString();
    }
    return situation!;
  }

  /**
   * Vérifier une situation (MOE)
   */
  static async verifierSituation(
    situationId: string,
    verification: SituationTravaux['verificationMOE']
  ): Promise<SituationTravaux> {
    console.log('[AdministratifService] Situation vérifiée:', situationId, verification);

    const situations = await this.listSituations();
    const situation = situations.find(s => s.id === situationId);
    if (situation) {
      situation.verificationMOE = verification;
      situation.statut = verification?.decision === 'valide' ? 'validee_moe' : 'contestee';
      situation.updatedAt = new Date().toISOString();
    }
    return situation!;
  }

  /**
   * Valider une situation (MO)
   */
  static async validerSituation(
    situationId: string,
    validation: SituationTravaux['validationMO']
  ): Promise<SituationTravaux> {
    console.log('[AdministratifService] Situation validée MO:', situationId, validation);

    const situations = await this.listSituations();
    const situation = situations.find(s => s.id === situationId);
    if (situation) {
      situation.validationMO = validation;
      situation.statut = validation?.decision === 'valide' ? 'validee_mo' : 'contestee';
      situation.updatedAt = new Date().toISOString();
    }
    return situation!;
  }

  /**
   * Enregistrer un paiement
   */
  static async enregistrerPaiement(
    situationId: string,
    paiement: SituationTravaux['paiement']
  ): Promise<SituationTravaux> {
    console.log('[AdministratifService] Paiement enregistré:', situationId, paiement);

    const situations = await this.listSituations();
    const situation = situations.find(s => s.id === situationId);
    if (situation) {
      situation.paiement = paiement;
      situation.statut = 'payee';
      situation.updatedAt = new Date().toISOString();
    }
    return situation!;
  }

  /**
   * Lister les situations
   */
  static async listSituations(filters?: SituationFilters): Promise<SituationTravaux[]> {
    return this.getMockSituations().filter(s => {
      if (filters?.chantierId && s.chantierId !== filters.chantierId) return false;
      if (filters?.entrepriseId && s.entrepriseId !== filters.entrepriseId) return false;
      if (filters?.statut && s.statut !== filters.statut) return false;
      return true;
    });
  }

  /**
   * Générer le récapitulatif d'une situation (format texte)
   */
  static genererRecapitulatifSituation(situation: SituationTravaux): string {
    let recap = `SITUATION N°${situation.numero}\n`;
    recap += `Période du ${situation.periodeDebut} au ${situation.periodeFin}\n\n`;

    for (const ligne of situation.lignes) {
      recap += `${ligne.lotNom}\n`;
      recap += `  Marché : ${ligne.montantMarcheHT.toLocaleString('fr-FR')}€ HT\n`;
      recap += `  Réalisé période : ${ligne.avancementPeriode}% → ${ligne.montantPeriodeHT.toLocaleString('fr-FR')}€\n`;
      recap += `  Cumul : ${ligne.avancementActuel}% → ${ligne.montantActuelHT.toLocaleString('fr-FR')}€\n\n`;
    }

    recap += `---\n`;
    recap += `TOTAL situation HT : ${situation.cumulSituationHT.toLocaleString('fr-FR')}€\n`;
    recap += `Retenue garantie ${situation.retenueGarantiePourcent}% : -${situation.retenueGarantieHT.toLocaleString('fr-FR')}€\n`;
    recap += `Acomptes antérieurs : -${situation.acomptesAnterieurs.toLocaleString('fr-FR')}€\n`;
    recap += `À PAYER HT : ${situation.netAPayerHT.toLocaleString('fr-FR')}€\n`;
    recap += `TVA ${situation.tauxTVA}% : ${situation.montantTVA.toLocaleString('fr-FR')}€\n`;
    recap += `NET À PAYER TTC : ${situation.netAPayerTTC.toLocaleString('fr-FR')}€\n`;

    return recap;
  }

  // ============================================
  // SUIVI BUDGÉTAIRE
  // ============================================

  /**
   * Calculer le suivi budgétaire
   */
  static async calculerSuiviBudgetaire(chantierId: string): Promise<SuiviBudgetaire> {
    const now = new Date().toISOString();

    // Récupérer les données
    const situations = await this.listSituations({ chantierId });
    const avenants = await this.listAvenants({ chantierId, statut: 'signe' });

    // Simuler les lots du marché
    const lotsMarche = this.getMockLotsMarche();

    // Calculer par lot
    const lots: SuiviBudgetLot[] = lotsMarche.map(lotMarche => {
      const situationsLot = situations.filter(s =>
        s.lignes.some(l => l.lotNom === lotMarche.nom)
      );
      const avenantsLot = avenants.filter(a => a.objet.includes(lotMarche.nom));

      const totalAvenantsHT = avenantsLot.reduce((sum, a) => sum + a.montantAvenantHT, 0);
      const montantActualiseHT = lotMarche.montantHT + totalAvenantsHT;

      const situationsPayeesHT = situationsLot
        .filter(s => s.statut === 'payee')
        .reduce((sum, s) => {
          const ligneLot = s.lignes.find(l => l.lotNom === lotMarche.nom);
          return sum + (ligneLot?.montantActuelHT || 0);
        }, 0);

      const pourcentagePaye = montantActualiseHT > 0
        ? (situationsPayeesHT / montantActualiseHT) * 100
        : 0;

      const depassementHT = montantActualiseHT - lotMarche.montantHT;
      const depassementPourcent = lotMarche.montantHT > 0
        ? (depassementHT / lotMarche.montantHT) * 100
        : 0;

      let statut: SuiviBudgetLot['statut'] = 'normal';
      if (depassementPourcent > 15) statut = 'critique';
      else if (depassementPourcent > 10) statut = 'alerte';
      else if (depassementPourcent > 5) statut = 'attention';

      return {
        lotId: lotMarche.id,
        lotNom: lotMarche.nom,
        entreprise: lotMarche.entreprise,
        montantMarcheHT: lotMarche.montantHT,
        avenants: avenantsLot.map(a => ({
          id: a.id,
          numero: a.numero,
          objet: a.objet,
          montantHT: a.montantAvenantHT,
          dateValidation: a.signature?.dateMO,
          statut: a.statut,
        })),
        totalAvenantsHT,
        montantActualiseHT,
        situationsPayeesHT,
        pourcentagePaye,
        resteAPayerHT: montantActualiseHT - situationsPayeesHT,
        depassementHT,
        depassementPourcent,
        statut,
      };
    });

    // Totaux
    const totalMarcheHT = lots.reduce((sum, l) => sum + l.montantMarcheHT, 0);
    const totalAvenantsHT = lots.reduce((sum, l) => sum + l.totalAvenantsHT, 0);
    const totalActualiseHT = lots.reduce((sum, l) => sum + l.montantActualiseHT, 0);
    const totalSituationsPaveesHT = lots.reduce((sum, l) => sum + l.situationsPayeesHT, 0);
    const totalResteAPayerHT = lots.reduce((sum, l) => sum + l.resteAPayerHT, 0);

    const pourcentageAvancement = totalActualiseHT > 0
      ? (totalSituationsPaveesHT / totalActualiseHT) * 100
      : 0;
    const pourcentageConsomme = totalMarcheHT > 0
      ? (totalSituationsPaveesHT / totalMarcheHT) * 100
      : 0;

    // Alertes
    const alertes = this.genererAlertesBudget(lots, totalAvenantsHT, totalMarcheHT);

    // Cash-flow simplifié
    const cashFlow = this.genererCashFlow(situations);

    return {
      id: crypto.randomUUID(),
      chantierId,
      dateSuivi: now,
      lots,
      totalMarcheHT,
      totalAvenantsHT,
      totalActualiseHT,
      totalSituationsPaveesHT,
      totalResteAPayerHT,
      pourcentageAvancement,
      pourcentageConsomme,
      depassementGlobalHT: totalActualiseHT - totalMarcheHT,
      depassementPourcent: totalMarcheHT > 0 ? ((totalActualiseHT - totalMarcheHT) / totalMarcheHT) * 100 : 0,
      cashFlow,
      alertes,
      createdAt: now,
    };
  }

  /**
   * Générer les alertes budget
   */
  private static genererAlertesBudget(
    lots: SuiviBudgetLot[],
    totalAvenants: number,
    totalMarche: number
  ): SuiviBudgetaire['alertes'] {
    const alertes: SuiviBudgetaire['alertes'] = [];

    // Dépassement par lot
    for (const lot of lots) {
      if (lot.depassementPourcent > 10) {
        alertes.push({
          type: 'depassement_lot',
          niveau: lot.depassementPourcent > 15 ? 'error' : 'warning',
          message: `${lot.lotNom} : dépassement de ${lot.depassementPourcent.toFixed(1)}%`,
          valeur: lot.depassementPourcent,
          seuil: 10,
        });
      }
    }

    // Avenants excessifs
    const pourcentageAvenants = totalMarche > 0 ? (totalAvenants / totalMarche) * 100 : 0;
    if (pourcentageAvenants > 15) {
      alertes.push({
        type: 'avenants_excessifs',
        niveau: 'error',
        message: `Cumul avenants : ${pourcentageAvenants.toFixed(1)}% du marché`,
        valeur: pourcentageAvenants,
        seuil: 15,
      });
    }

    return alertes;
  }

  /**
   * Générer le cash-flow
   */
  private static genererCashFlow(situations: SituationTravaux[]): SuiviBudgetaire['cashFlow'] {
    const cashFlow: SuiviBudgetaire['cashFlow'] = [];
    let cumul = 0;

    const situationsTriees = [...situations]
      .filter(s => s.paiement)
      .sort((a, b) => new Date(a.paiement!.date).getTime() - new Date(b.paiement!.date).getTime());

    for (const situation of situationsTriees) {
      cumul += situation.paiement!.montant;
      cashFlow.push({
        date: situation.paiement!.date,
        type: 'decaissement',
        montant: situation.paiement!.montant,
        description: `Situation n°${situation.numero}`,
        cumul,
      });
    }

    return cashFlow;
  }

  // ============================================
  // AVENANTS
  // ============================================

  /**
   * Créer un avenant
   */
  static async createAvenant(input: CreateAvenantInput): Promise<Avenant> {
    const now = new Date().toISOString();

    // Récupérer le marché initial
    const lotsMarche = this.getMockLotsMarche();
    const montantInitialHT = lotsMarche.reduce((sum, l) => sum + l.montantHT, 0);

    // Numéro d'avenant
    const avenantsExistants = await this.listAvenants({ chantierId: input.chantierId });
    const numero = avenantsExistants.length + 1;

    const avenant: Avenant = {
      id: crypto.randomUUID(),
      chantierId: input.chantierId,
      numero,
      type: input.type,
      objet: input.objet,
      description: input.description,
      montantInitialHT,
      montantAvenantHT: input.montantAvenantHT,
      montantFinalHT: montantInitialHT + input.montantAvenantHT,
      impactPourcent: (input.montantAvenantHT / montantInitialHT) * 100,
      impactDelaiJours: input.impactDelaiJours || 0,
      justification: input.justification,
      origineDemande: input.origineDemande,
      devisEntrepriseHT: input.devisEntrepriseHT,
      statut: 'brouillon',
      createdAt: now,
      updatedAt: now,
    };

    console.log('[AdministratifService] Avenant créé:', avenant);
    return avenant;
  }

  /**
   * Soumettre un avenant
   */
  static async soumettreAvenant(avenantId: string): Promise<Avenant> {
    console.log('[AdministratifService] Avenant soumis:', avenantId);

    const avenants = await this.listAvenants();
    const avenant = avenants.find(a => a.id === avenantId);
    if (avenant) {
      avenant.statut = 'soumis';
      avenant.updatedAt = new Date().toISOString();
    }
    return avenant!;
  }

  /**
   * Valider un avenant (MOE)
   */
  static async validerAvenantMOE(
    avenantId: string,
    validation: Avenant['validationMOE']
  ): Promise<Avenant> {
    console.log('[AdministratifService] Avenant validé MOE:', avenantId, validation);

    const avenants = await this.listAvenants();
    const avenant = avenants.find(a => a.id === avenantId);
    if (avenant) {
      avenant.validationMOE = validation;
      avenant.statut = validation?.avis === 'favorable' ? 'en_negociation' : 'refuse';
      avenant.updatedAt = new Date().toISOString();
    }
    return avenant!;
  }

  /**
   * Valider un avenant (MO)
   */
  static async validerAvenantMO(
    avenantId: string,
    validation: Avenant['validationMO']
  ): Promise<Avenant> {
    console.log('[AdministratifService] Avenant validé MO:', avenantId, validation);

    const avenants = await this.listAvenants();
    const avenant = avenants.find(a => a.id === avenantId);
    if (avenant) {
      avenant.validationMO = validation;
      avenant.statut = validation?.decision === 'accepte' ? 'accepte' : 'refuse';
      avenant.updatedAt = new Date().toISOString();
    }
    return avenant!;
  }

  /**
   * Signer un avenant
   */
  static async signerAvenant(
    avenantId: string,
    signature: Avenant['signature']
  ): Promise<Avenant> {
    console.log('[AdministratifService] Avenant signé:', avenantId, signature);

    const avenants = await this.listAvenants();
    const avenant = avenants.find(a => a.id === avenantId);
    if (avenant) {
      avenant.signature = signature;
      avenant.statut = 'signe';
      avenant.updatedAt = new Date().toISOString();
    }
    return avenant!;
  }

  /**
   * Lister les avenants
   */
  static async listAvenants(filters?: AvenantFilters): Promise<Avenant[]> {
    return this.getMockAvenants().filter(a => {
      if (filters?.chantierId && a.chantierId !== filters.chantierId) return false;
      if (filters?.type && a.type !== filters.type) return false;
      if (filters?.statut && a.statut !== filters.statut) return false;
      return true;
    });
  }

  // ============================================
  // DOE - DOSSIER OUVRAGES EXÉCUTÉS
  // ============================================

  /**
   * Obtenir le DOE d'un chantier
   */
  static async getDOE(chantierId: string): Promise<DossierOuvragesExecutes> {
    return this.getMockDOE(chantierId);
  }

  /**
   * Ajouter un document au DOE
   */
  static async ajouterDocumentDOE(input: CreateDocumentDOEInput): Promise<DocumentDOE> {
    const now = new Date().toISOString();
    const doc: DocumentDOE = {
      id: crypto.randomUUID(),
      type: input.type,
      nom: input.nom,
      description: input.description,
      url: input.url,
      dateFourniture: now,
      dateDocument: input.dateDocument,
      fourniPar: input.fourniPar,
      statut: 'fourni',
      createdAt: now,
    };

    console.log('[AdministratifService] Document DOE ajouté:', doc);
    return doc;
  }

  /**
   * Valider un document DOE
   */
  static async validerDocumentDOE(
    documentId: string,
    validation: { par: string; conforme: boolean; commentaire?: string }
  ): Promise<DocumentDOE> {
    console.log('[AdministratifService] Document DOE validé:', documentId, validation);

    return {
      id: documentId,
      type: 'autre',
      nom: 'Document',
      url: '/mock/doc.pdf',
      dateFourniture: new Date().toISOString(),
      fourniPar: 'Entreprise',
      statut: validation.conforme ? 'conforme' : 'non_conforme',
      verifiePar: validation.par,
      dateVerification: new Date().toISOString(),
      commentaireVerification: validation.commentaire,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Obtenir la liste des documents attendus par lot
   */
  static getDocumentsAttendusDOE(lot: string): { type: DocumentDOE['type']; libelle: string; obligatoire: boolean }[] {
    const documentsCommuns = [
      { type: 'plan_as_built' as const, libelle: 'Plans conformes à exécution', obligatoire: true },
      { type: 'fiche_technique' as const, libelle: 'Fiches techniques matériaux', obligatoire: true },
      { type: 'pv_essai' as const, libelle: 'PV d\'essais et contrôles', obligatoire: true },
      { type: 'garantie' as const, libelle: 'Certificats de garantie', obligatoire: true },
    ];

    const documentsParLot: Record<string, { type: DocumentDOE['type']; libelle: string; obligatoire: boolean }[]> = {
      'Électricité': [
        { type: 'certificat', libelle: 'Attestation Consuel', obligatoire: true },
        { type: 'notice_equipement', libelle: 'Notice tableau électrique', obligatoire: true },
      ],
      'Plomberie': [
        { type: 'pv_essai', libelle: 'PV essai pression', obligatoire: true },
        { type: 'notice_equipement', libelle: 'Notices appareils sanitaires', obligatoire: true },
      ],
      'Chauffage': [
        { type: 'notice_equipement', libelle: 'Notice chaudière/PAC', obligatoire: true },
        { type: 'certificat', libelle: 'Certificat Qualigaz (si gaz)', obligatoire: false },
        { type: 'pv_essai', libelle: 'PV mise en service', obligatoire: true },
      ],
    };

    return [...documentsCommuns, ...(documentsParLot[lot] || [])];
  }

  // ============================================
  // LITIGES
  // ============================================

  /**
   * Créer un litige
   */
  static async createLitige(input: CreateLitigeInput): Promise<Litige> {
    const now = new Date().toISOString();
    const litige: Litige = {
      id: crypto.randomUUID(),
      chantierId: input.chantierId,
      type: input.type,
      objet: input.objet,
      description: input.description,
      parties: input.parties,
      gravite: input.gravite,
      impactFinancierEstime: input.impactFinancierEstime,
      impactDelaiEstime: input.impactDelaiEstime,
      dateSignalement: now,
      signalePar: 'Utilisateur',
      preuves: [],
      niveauActuel: 'niveau1_discussion',
      historiqueEscalade: [{
        niveau: 'niveau1_discussion',
        dateDebut: now,
        actions: [],
      }],
      statut: 'signale',
      documents: [],
      createdAt: now,
      updatedAt: now,
    };

    console.log('[AdministratifService] Litige créé:', litige);
    return litige;
  }

  /**
   * Escalader un litige
   */
  static async escaladerLitige(
    litigeId: string,
    nouveauNiveau: NiveauEscalade,
    action?: { type: string; description: string }
  ): Promise<Litige> {
    console.log('[AdministratifService] Litige escaladé:', litigeId, nouveauNiveau);

    const litiges = await this.listLitiges();
    const litige = litiges.find(l => l.id === litigeId);
    if (litige) {
      // Clôturer l'étape précédente
      const etapePrecedente = litige.historiqueEscalade.find(e => e.niveau === litige.niveauActuel);
      if (etapePrecedente) {
        etapePrecedente.dateFin = new Date().toISOString();
        etapePrecedente.resultat = 'echec';
      }

      // Créer nouvelle étape
      litige.historiqueEscalade.push({
        niveau: nouveauNiveau,
        dateDebut: new Date().toISOString(),
        actions: action ? [{
          id: crypto.randomUUID(),
          type: action.type as any,
          date: new Date().toISOString(),
          description: action.description,
        }] : [],
      });

      litige.niveauActuel = nouveauNiveau;
      litige.statut = 'escalade';
      litige.updatedAt = new Date().toISOString();
    }
    return litige!;
  }

  /**
   * Résoudre un litige
   */
  static async resoudreLitige(
    litigeId: string,
    resolution: Litige['resolution']
  ): Promise<Litige> {
    console.log('[AdministratifService] Litige résolu:', litigeId, resolution);

    const litiges = await this.listLitiges();
    const litige = litiges.find(l => l.id === litigeId);
    if (litige) {
      litige.resolution = resolution;
      litige.statut = 'resolu';
      litige.updatedAt = new Date().toISOString();

      // Clôturer dernière étape
      const dernierEtape = litige.historiqueEscalade[litige.historiqueEscalade.length - 1];
      if (dernierEtape) {
        dernierEtape.dateFin = new Date().toISOString();
        dernierEtape.resultat = 'succes';
      }
    }
    return litige!;
  }

  /**
   * Lister les litiges
   */
  static async listLitiges(filters?: LitigeFilters): Promise<Litige[]> {
    return this.getMockLitiges().filter(l => {
      if (filters?.chantierId && l.chantierId !== filters.chantierId) return false;
      if (filters?.type && l.type !== filters.type) return false;
      if (filters?.statut && l.statut !== filters.statut) return false;
      if (filters?.gravite && l.gravite !== filters.gravite) return false;
      return true;
    });
  }

  /**
   * Obtenir un template de courrier
   */
  static getTemplateCourrier(type: string) {
    return TEMPLATES_COURRIERS_LITIGE.find(t => t.type === type);
  }

  /**
   * Générer un courrier depuis template
   */
  static genererCourrier(
    type: string,
    variables: Record<string, string>
  ): { objet: string; corps: string } | null {
    const template = this.getTemplateCourrier(type);
    if (!template) return null;

    let objet = template.objet;
    let corps = template.corps;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      objet = objet.replace(regex, value);
      corps = corps.replace(regex, value);
    }

    return { objet, corps };
  }

  // ============================================
  // ALERTES
  // ============================================

  /**
   * Obtenir les alertes administratives
   */
  static async getAlertes(chantierId: string): Promise<AlerteAdministrative[]> {
    const alertes: AlerteAdministrative[] = [];
    const now = new Date().toISOString();

    // Situations en attente de validation
    const situations = await this.listSituations({ chantierId });
    for (const situation of situations) {
      if (situation.statut === 'soumise') {
        alertes.push({
          id: crypto.randomUUID(),
          chantierId,
          type: 'situation_en_attente',
          niveau: 'warning',
          entiteType: 'situation',
          entiteId: situation.id,
          titre: `Situation n°${situation.numero} en attente`,
          message: `La situation de ${situation.netAPayerTTC.toLocaleString('fr-FR')}€ TTC attend validation`,
          montant: situation.netAPayerTTC,
          dateCreation: now,
          lu: false,
          traite: false,
          createdAt: now,
        });
      }
    }

    // Avenants en attente
    const avenants = await this.listAvenants({ chantierId });
    for (const avenant of avenants) {
      if (avenant.statut === 'soumis' || avenant.statut === 'en_negociation') {
        alertes.push({
          id: crypto.randomUUID(),
          chantierId,
          type: 'avenant_en_attente',
          niveau: 'warning',
          entiteType: 'avenant',
          entiteId: avenant.id,
          titre: `Avenant n°${avenant.numero} en attente`,
          message: `Avenant "${avenant.objet}" de ${avenant.montantAvenantHT.toLocaleString('fr-FR')}€ HT`,
          montant: avenant.montantAvenantHT,
          dateCreation: now,
          lu: false,
          traite: false,
          createdAt: now,
        });
      }
    }

    // Litiges ouverts
    const litiges = await this.listLitiges({ chantierId });
    for (const litige of litiges) {
      if (litige.statut !== 'resolu' && litige.statut !== 'clos') {
        alertes.push({
          id: crypto.randomUUID(),
          chantierId,
          type: 'litige_escalade',
          niveau: litige.gravite === 'critique' ? 'critical' : 'error',
          entiteType: 'litige',
          entiteId: litige.id,
          titre: `Litige : ${litige.objet}`,
          message: `Niveau actuel : ${litige.niveauActuel}`,
          montant: litige.impactFinancierEstime,
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
  // DONNÉES MOCK
  // ============================================

  private static getMockLotsMarche() {
    return [
      { id: 'lot-1', nom: 'Gros œuvre', entreprise: 'Maçonnerie Durand', montantHT: 85000 },
      { id: 'lot-2', nom: 'Électricité', entreprise: 'Électricité Martin', montantHT: 25000 },
      { id: 'lot-3', nom: 'Plomberie', entreprise: 'Plomberie Dupont', montantHT: 18000 },
      { id: 'lot-4', nom: 'Menuiseries', entreprise: 'Menuiseries Bernard', montantHT: 22000 },
      { id: 'lot-5', nom: 'Carrelage', entreprise: 'Carrelage Pro', montantHT: 12000 },
      { id: 'lot-6', nom: 'Peinture', entreprise: 'Peinture Express', montantHT: 8000 },
    ];
  }

  private static getMockSituations(): SituationTravaux[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'sit-1',
        chantierId: 'chantier-1',
        entrepriseId: 'ent-1',
        numero: 1,
        periodeDebut: '2024-02-01',
        periodeFin: '2024-02-29',
        lignes: [
          {
            id: 'ligne-1',
            lotNom: 'Gros œuvre',
            montantMarcheHT: 85000,
            avancementPrecedent: 0,
            avancementActuel: 30,
            avancementPeriode: 30,
            montantPrecedentHT: 0,
            montantActuelHT: 25500,
            montantPeriodeHT: 25500,
            estTravauxSup: false,
          },
        ],
        montantPeriodeHT: 25500,
        cumulAnterieurHT: 0,
        cumulSituationHT: 25500,
        retenueGarantiePourcent: 5,
        retenueGarantieHT: 1275,
        acomptesAnterieurs: 0,
        netAPayerHT: 24225,
        tauxTVA: 10,
        montantTVA: 2422.5,
        netAPayerTTC: 26647.5,
        statut: 'payee',
        etabliePar: 'Maçonnerie Durand',
        dateEtablissement: '2024-03-01',
        validationMO: { date: '2024-03-05', par: 'MO', decision: 'valide' },
        paiement: { date: '2024-03-15', montant: 26647.5, modeReglement: 'virement' },
        documents: [],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'sit-2',
        chantierId: 'chantier-1',
        entrepriseId: 'ent-1',
        numero: 2,
        periodeDebut: '2024-03-01',
        periodeFin: '2024-03-31',
        lignes: [
          {
            id: 'ligne-2',
            lotNom: 'Gros œuvre',
            montantMarcheHT: 85000,
            avancementPrecedent: 30,
            avancementActuel: 60,
            avancementPeriode: 30,
            montantPrecedentHT: 25500,
            montantActuelHT: 51000,
            montantPeriodeHT: 25500,
            estTravauxSup: false,
          },
        ],
        montantPeriodeHT: 25500,
        cumulAnterieurHT: 25500,
        cumulSituationHT: 51000,
        retenueGarantiePourcent: 5,
        retenueGarantieHT: 2550,
        acomptesAnterieurs: 24225,
        netAPayerHT: 24225,
        tauxTVA: 10,
        montantTVA: 2422.5,
        netAPayerTTC: 26647.5,
        statut: 'soumise',
        etabliePar: 'Maçonnerie Durand',
        dateEtablissement: '2024-04-01',
        documents: [],
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  private static getMockAvenants(): Avenant[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'avenant-1',
        chantierId: 'chantier-1',
        numero: 1,
        type: 'travaux_supplementaires',
        objet: 'Renforcement fondations - Gros œuvre',
        description: 'Suite à découverte de sol argileux, renforcement nécessaire',
        montantInitialHT: 170000,
        montantAvenantHT: 8500,
        montantFinalHT: 178500,
        impactPourcent: 5,
        impactDelaiJours: 5,
        justification: 'Aléa géotechnique non prévisible',
        origineDemande: 'entreprise',
        devisEntrepriseHT: 9200,
        statut: 'signe',
        validationMOE: { date: now, par: 'MOE', avis: 'favorable' },
        validationMO: { date: now, par: 'MO', decision: 'accepte' },
        signature: { dateMO: now, dateEntreprise: now },
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  private static getMockDOE(chantierId: string): DossierOuvragesExecutes {
    const now = new Date().toISOString();
    const lots = this.getMockLotsMarche();

    return {
      id: 'doe-1',
      chantierId,
      lots: lots.map(lot => ({
        lotId: lot.id,
        lotNom: lot.nom,
        entreprise: lot.entreprise,
        documentsAttendus: this.getDocumentsAttendusDOE(lot.nom).map(d => ({
          id: crypto.randomUUID(),
          type: d.type,
          libelle: d.libelle,
          obligatoire: d.obligatoire,
        })),
        documentsFournis: [],
        totalAttendus: this.getDocumentsAttendusDOE(lot.nom).length,
        totalFournis: 0,
        totalValides: 0,
        pourcentageComplet: 0,
      })),
      totalDocuments: lots.reduce((sum, l) => sum + this.getDocumentsAttendusDOE(l.nom).length, 0),
      documentsFournis: 0,
      documentsValides: 0,
      pourcentageComplet: 0,
      complet: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  private static getMockLitiges(): Litige[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'litige-1',
        chantierId: 'chantier-1',
        type: 'retard_execution',
        objet: 'Retard lot Électricité',
        description: 'Retard de 2 semaines sur le lot électricité impactant le planning global',
        parties: [
          { type: 'mo', nom: 'Maître d\'ouvrage', role: 'demandeur' },
          { type: 'entreprise', nom: 'Électricité Martin', role: 'defandeur' },
        ],
        gravite: 'modere',
        impactFinancierEstime: 3500,
        impactDelaiEstime: 14,
        dateSignalement: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        signalePar: 'Conducteur travaux',
        preuves: [
          { id: 'pr-1', type: 'compte_rendu', description: 'CR réunion du 15/03', date: now },
        ],
        niveauActuel: 'niveau2_reunion',
        historiqueEscalade: [
          {
            niveau: 'niveau1_discussion',
            dateDebut: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            dateFin: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            actions: [
              { id: 'a1', type: 'discussion', date: now, description: 'Échange téléphonique avec l\'entreprise' },
            ],
            resultat: 'echec',
          },
          {
            niveau: 'niveau2_reunion',
            dateDebut: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            actions: [
              { id: 'a2', type: 'reunion', date: now, description: 'Réunion tripartite programmée' },
            ],
          },
        ],
        statut: 'en_resolution',
        documents: [],
        createdAt: now,
        updatedAt: now,
      },
    ];
  }
}

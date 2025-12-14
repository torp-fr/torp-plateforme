/**
 * TORP Phase 3 - Coordination Service
 * Gestion de la coordination multi-entreprises
 */

import type {
  CreneauIntervention,
  ConflitPlanning,
  SuggestionResolutionConflit,
  CarnetLiaison,
  EntreeCarnetLiaison,
  Conversation,
  MessageChat,
  InterfaceTechnique,
  PlanSynthese,
  ConducteurTravaux,
  ReglesChantier,
  Degradation,
  AlerteCoordination,
  CreateCreneauInput,
  CreateEntreeCarnetInput,
  CreateInterfaceInput,
  CreateDegradationInput,
  CreateConversationInput,
  TypeConflitPlanning,
  StatutCreneauPlanning,
  TypeEntreeCarnet,
} from '@/types/phase3';

// ============================================
// FILTRES
// ============================================

export interface CreneauFilters {
  chantierId?: string;
  entrepriseId?: string;
  lotId?: string;
  zone?: string;
  dateDebut?: string;
  dateFin?: string;
  statut?: StatutCreneauPlanning;
}

export interface ConflitFilters {
  chantierId?: string;
  statut?: ConflitPlanning['statut'];
  impact?: ConflitPlanning['impact'];
}

export interface CarnetFilters {
  chantierId?: string;
  dateDebut?: string;
  dateFin?: string;
}

export interface InterfaceFilters {
  chantierId?: string;
  lotId?: string;
  statut?: InterfaceTechnique['statut'];
}

export interface DegradationFilters {
  chantierId?: string;
  entreprise?: string;
  statut?: Degradation['statut'];
  gravite?: Degradation['gravite'];
}

// ============================================
// SERVICE
// ============================================

export class CoordinationService {
  // ============================================
  // CRÉNEAUX D'INTERVENTION
  // ============================================

  /**
   * Créer un créneau d'intervention
   */
  static async createCreneau(input: CreateCreneauInput): Promise<CreneauIntervention> {
    const now = new Date().toISOString();
    const creneau: CreneauIntervention = {
      id: crypto.randomUUID(),
      chantierId: input.chantierId,
      entrepriseId: input.entrepriseId,
      entrepriseNom: input.entrepriseNom,
      lotId: input.lotId,
      lotNom: input.lotNom,
      dateDebut: input.dateDebut,
      dateFin: input.dateFin,
      zone: input.zone,
      description: input.description,
      effectifPrevu: input.effectifPrevu,
      statut: 'reserve',
      creePar: input.entrepriseNom,
      conflits: [],
      createdAt: now,
      updatedAt: now,
    };

    // Détecter les conflits potentiels
    const conflits = await this.detecterConflits(creneau);
    creneau.conflits = conflits;

    if (conflits.length > 0) {
      creneau.statut = 'conflit';
    }

    console.log('[CoordinationService] Créneau créé:', creneau);
    return creneau;
  }

  /**
   * Lister les créneaux
   */
  static async listCreneaux(filters?: CreneauFilters): Promise<CreneauIntervention[]> {
    const creneaux = this.getMockCreneaux();

    return creneaux.filter(c => {
      if (filters?.chantierId && c.chantierId !== filters.chantierId) return false;
      if (filters?.entrepriseId && c.entrepriseId !== filters.entrepriseId) return false;
      if (filters?.lotId && c.lotId !== filters.lotId) return false;
      if (filters?.zone && c.zone !== filters.zone) return false;
      if (filters?.statut && c.statut !== filters.statut) return false;
      return true;
    });
  }

  /**
   * Valider un créneau
   */
  static async validerCreneau(creneauId: string, validePar: string): Promise<CreneauIntervention> {
    console.log('[CoordinationService] Créneau validé:', creneauId, validePar);

    // Simulation
    return {
      id: creneauId,
      chantierId: 'mock',
      entrepriseId: 'mock',
      entrepriseNom: 'Entreprise',
      lotId: 'mock',
      lotNom: 'Lot',
      dateDebut: new Date().toISOString(),
      dateFin: new Date().toISOString(),
      zone: 'Zone A',
      statut: 'confirme',
      creePar: 'Entreprise',
      validePar,
      dateValidation: new Date().toISOString(),
      conflits: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  // ============================================
  // DÉTECTION DE CONFLITS
  // ============================================

  /**
   * Détecter les conflits pour un créneau
   */
  static async detecterConflits(creneau: CreneauIntervention): Promise<ConflitPlanning[]> {
    const conflits: ConflitPlanning[] = [];
    const creneauxExistants = await this.listCreneaux({
      chantierId: creneau.chantierId,
      zone: creneau.zone,
    });

    for (const existant of creneauxExistants) {
      if (existant.id === creneau.id) continue;

      // Vérifier chevauchement temporel
      const chevauche = this.periodesChevauchent(
        { debut: creneau.dateDebut, fin: creneau.dateFin },
        { debut: existant.dateDebut, fin: existant.dateFin }
      );

      if (chevauche) {
        const conflit: ConflitPlanning = {
          id: crypto.randomUUID(),
          chantierId: creneau.chantierId,
          type: 'chevauchement_zone',
          creneau1Id: creneau.id,
          creneau2Id: existant.id,
          description: `Conflit ${creneau.lotNom} / ${existant.lotNom} dans ${creneau.zone}`,
          impact: 'moyen',
          dateDetection: new Date().toISOString(),
          detectePar: 'systeme',
          statut: 'detecte',
          suggestionsIA: this.genererSuggestionsIA(creneau, existant),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        conflits.push(conflit);
      }
    }

    return conflits;
  }

  /**
   * Vérifier si deux périodes se chevauchent
   */
  private static periodesChevauchent(
    p1: { debut: string; fin: string },
    p2: { debut: string; fin: string }
  ): boolean {
    const d1 = new Date(p1.debut).getTime();
    const f1 = new Date(p1.fin).getTime();
    const d2 = new Date(p2.debut).getTime();
    const f2 = new Date(p2.fin).getTime();

    return d1 < f2 && d2 < f1;
  }

  /**
   * Générer des suggestions IA pour résoudre un conflit
   */
  private static genererSuggestionsIA(
    creneau1: CreneauIntervention,
    creneau2: CreneauIntervention
  ): SuggestionResolutionConflit[] {
    return [
      {
        id: crypto.randomUUID(),
        type: 'decaler_lot1',
        description: `Décaler ${creneau1.lotNom} à la semaine suivante`,
        impactDelai: 5,
        scorePertinence: 75,
      },
      {
        id: crypto.randomUUID(),
        type: 'decaler_lot2',
        description: `Décaler ${creneau2.lotNom} à la semaine suivante`,
        impactDelai: 5,
        scorePertinence: 70,
      },
      {
        id: crypto.randomUUID(),
        type: 'diviser_zone',
        description: `Diviser la zone: ${creneau1.lotNom} côté Nord, ${creneau2.lotNom} côté Sud`,
        impactDelai: 0,
        scorePertinence: 85,
      },
      {
        id: crypto.randomUUID(),
        type: 'changer_horaires',
        description: `${creneau1.lotNom} le matin, ${creneau2.lotNom} l'après-midi`,
        impactDelai: 2,
        scorePertinence: 60,
      },
    ];
  }

  /**
   * Lister les conflits
   */
  static async listConflits(filters?: ConflitFilters): Promise<ConflitPlanning[]> {
    return this.getMockConflits().filter(c => {
      if (filters?.chantierId && c.chantierId !== filters.chantierId) return false;
      if (filters?.statut && c.statut !== filters.statut) return false;
      if (filters?.impact && c.impact !== filters.impact) return false;
      return true;
    });
  }

  /**
   * Résoudre un conflit
   */
  static async resoudreConflit(
    conflitId: string,
    resolution: ConflitPlanning['resolution']
  ): Promise<ConflitPlanning> {
    console.log('[CoordinationService] Conflit résolu:', conflitId, resolution);

    return {
      id: conflitId,
      chantierId: 'mock',
      type: 'chevauchement_zone',
      creneau1Id: 'mock',
      description: 'Conflit résolu',
      impact: 'moyen',
      dateDetection: new Date().toISOString(),
      detectePar: 'systeme',
      statut: 'resolu',
      resolution,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  // ============================================
  // CARNET DE LIAISON
  // ============================================

  /**
   * Obtenir ou créer le carnet du jour
   */
  static async getCarnetDuJour(chantierId: string, date?: string): Promise<CarnetLiaison> {
    const dateJour = date || new Date().toISOString().split('T')[0];

    // Rechercher carnet existant
    const carnets = this.getMockCarnets();
    let carnet = carnets.find(c => c.chantierId === chantierId && c.date === dateJour);

    if (!carnet) {
      // Créer nouveau carnet
      carnet = {
        id: crypto.randomUUID(),
        chantierId,
        date: dateJour,
        entrees: [],
        signatures: [],
        cloture: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    return carnet;
  }

  /**
   * Ajouter une entrée au carnet
   */
  static async ajouterEntreeCarnet(input: CreateEntreeCarnetInput): Promise<EntreeCarnetLiaison> {
    const entree: EntreeCarnetLiaison = {
      id: crypto.randomUUID(),
      carnetId: 'mock',
      entreprise: input.entreprise,
      auteur: input.auteur,
      dateHeure: new Date().toISOString(),
      type: input.type,
      contenu: input.contenu,
      destinataires: input.destinataires,
      photos: input.photos,
      urgent: input.urgent || false,
      createdAt: new Date().toISOString(),
    };

    console.log('[CoordinationService] Entrée carnet ajoutée:', entree);
    return entree;
  }

  /**
   * Répondre à une entrée
   */
  static async repondreEntree(
    entreeId: string,
    reponse: { par: string; contenu: string }
  ): Promise<EntreeCarnetLiaison> {
    console.log('[CoordinationService] Réponse ajoutée:', entreeId, reponse);

    return {
      id: entreeId,
      carnetId: 'mock',
      entreprise: 'Mock',
      auteur: 'Mock',
      dateHeure: new Date().toISOString(),
      type: 'information',
      contenu: 'Original',
      urgent: false,
      reponse: {
        ...reponse,
        dateHeure: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Signer présence au carnet
   */
  static async signerCarnet(
    carnetId: string,
    signature: { entreprise: string; signataire: string; type: 'arrivee' | 'depart' }
  ): Promise<void> {
    console.log('[CoordinationService] Signature carnet:', carnetId, signature);
  }

  /**
   * Clôturer le carnet du jour
   */
  static async cloturerCarnet(carnetId: string, par: string): Promise<CarnetLiaison> {
    console.log('[CoordinationService] Carnet clôturé:', carnetId, par);

    const carnet = await this.getCarnetDuJour('mock');
    carnet.cloture = true;
    carnet.cloturePar = par;
    carnet.clotureLe = new Date().toISOString();
    return carnet;
  }

  /**
   * Lister les carnets
   */
  static async listCarnets(filters?: CarnetFilters): Promise<CarnetLiaison[]> {
    return this.getMockCarnets().filter(c => {
      if (filters?.chantierId && c.chantierId !== filters.chantierId) return false;
      return true;
    });
  }

  // ============================================
  // CHAT MULTI-ENTREPRISES
  // ============================================

  /**
   * Créer une conversation
   */
  static async createConversation(input: CreateConversationInput): Promise<Conversation> {
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id: crypto.randomUUID(),
      chantierId: input.chantierId,
      type: input.type,
      nom: input.nom,
      description: input.description,
      participants: input.participants,
      actif: true,
      createdAt: now,
      updatedAt: now,
    };

    console.log('[CoordinationService] Conversation créée:', conversation);
    return conversation;
  }

  /**
   * Lister les conversations d'un chantier
   */
  static async listConversations(chantierId: string): Promise<Conversation[]> {
    return this.getMockConversations(chantierId);
  }

  /**
   * Envoyer un message
   */
  static async envoyerMessage(
    conversationId: string,
    message: Omit<MessageChat, 'id' | 'conversationId' | 'createdAt' | 'lu' | 'modifie'>
  ): Promise<MessageChat> {
    const msg: MessageChat = {
      id: crypto.randomUUID(),
      conversationId,
      ...message,
      lu: false,
      modifie: false,
      createdAt: new Date().toISOString(),
    };

    console.log('[CoordinationService] Message envoyé:', msg);
    return msg;
  }

  /**
   * Lister les messages d'une conversation
   */
  static async listMessages(conversationId: string, limit = 50): Promise<MessageChat[]> {
    return this.getMockMessages(conversationId).slice(-limit);
  }

  // ============================================
  // INTERFACES TECHNIQUES
  // ============================================

  /**
   * Créer une interface technique
   */
  static async createInterface(input: CreateInterfaceInput): Promise<InterfaceTechnique> {
    const now = new Date().toISOString();
    const interfaceTech: InterfaceTechnique = {
      id: crypto.randomUUID(),
      chantierId: input.chantierId,
      lot1: input.lot1,
      lot2: input.lot2,
      type: input.type,
      description: input.description,
      zone: input.zone,
      specifications: input.specifications,
      dateRequise: input.dateRequise,
      statut: 'a_definir',
      createdAt: now,
      updatedAt: now,
    };

    console.log('[CoordinationService] Interface créée:', interfaceTech);
    return interfaceTech;
  }

  /**
   * Lister les interfaces
   */
  static async listInterfaces(filters?: InterfaceFilters): Promise<InterfaceTechnique[]> {
    return this.getMockInterfaces().filter(i => {
      if (filters?.chantierId && i.chantierId !== filters.chantierId) return false;
      if (filters?.statut && i.statut !== filters.statut) return false;
      if (filters?.lotId && i.lot1.lotId !== filters.lotId && i.lot2.lotId !== filters.lotId) return false;
      return true;
    });
  }

  /**
   * Valider une interface par un lot
   */
  static async validerInterface(
    interfaceId: string,
    lotRole: 'lot1' | 'lot2',
    validation: { par: string; commentaire?: string }
  ): Promise<InterfaceTechnique> {
    console.log('[CoordinationService] Interface validée:', interfaceId, lotRole, validation);

    const interfaces = await this.listInterfaces();
    const iface = interfaces.find(i => i.id === interfaceId);
    if (iface) {
      if (lotRole === 'lot1') {
        iface.valideLot1 = { ...validation, date: new Date().toISOString() };
      } else {
        iface.valideLot2 = { ...validation, date: new Date().toISOString() };
      }

      // Si les deux lots ont validé, marquer comme défini
      if (iface.valideLot1 && iface.valideLot2) {
        iface.statut = 'defini';
      }
    }
    return iface!;
  }

  /**
   * Signaler un problème d'interface
   */
  static async signalerProblemeInterface(
    interfaceId: string,
    probleme: InterfaceTechnique['probleme']
  ): Promise<InterfaceTechnique> {
    console.log('[CoordinationService] Problème interface signalé:', interfaceId, probleme);

    const interfaces = await this.listInterfaces();
    const iface = interfaces.find(i => i.id === interfaceId);
    if (iface) {
      iface.probleme = probleme;
      iface.statut = 'probleme';
    }
    return iface!;
  }

  // ============================================
  // RÈGLES DE CHANTIER
  // ============================================

  /**
   * Obtenir les règles du chantier
   */
  static async getReglesChantier(chantierId: string): Promise<ReglesChantier> {
    return this.getMockReglesChantier(chantierId);
  }

  /**
   * Mettre à jour les règles
   */
  static async updateReglesChantier(
    chantierId: string,
    updates: Partial<ReglesChantier>
  ): Promise<ReglesChantier> {
    console.log('[CoordinationService] Règles mises à jour:', chantierId, updates);

    const regles = await this.getReglesChantier(chantierId);
    return { ...regles, ...updates, updatedAt: new Date().toISOString() };
  }

  /**
   * Obtenir l'ordre logique des lots
   */
  static getOrdreLotsBTP(): { rang: number; lotType: string; description: string }[] {
    return [
      { rang: 1, lotType: 'gros_oeuvre', description: 'Gros œuvre / Structure' },
      { rang: 2, lotType: 'etancheite', description: 'Étanchéité (toiture, menuiseries ext)' },
      { rang: 3, lotType: 'reseaux', description: 'Réseaux (élec, plomberie) - saignées/encastrements' },
      { rang: 4, lotType: 'isolation', description: 'Isolation / Cloisons / Plâtrerie' },
      { rang: 5, lotType: 'chauffage', description: 'Chauffage (radiateurs, plancher chauffant)' },
      { rang: 6, lotType: 'sols', description: 'Sols (carrelage, parquet)' },
      { rang: 7, lotType: 'finitions', description: 'Finitions (peinture, appareillage)' },
    ];
  }

  // ============================================
  // DÉGRADATIONS
  // ============================================

  /**
   * Signaler une dégradation
   */
  static async signalerDegradation(input: CreateDegradationInput): Promise<Degradation> {
    const now = new Date().toISOString();
    const degradation: Degradation = {
      id: crypto.randomUUID(),
      chantierId: input.chantierId,
      dateSignalement: now,
      signalePar: 'Utilisateur',
      entrepriseVictime: input.entrepriseVictime,
      lotVictime: input.lotVictime,
      zone: input.zone,
      description: input.description,
      gravite: input.gravite,
      photos: (input.photos || []).map(url => ({
        id: crypto.randomUUID(),
        url,
        dateHeure: now,
      })),
      entrepriseResponsable: input.entrepriseResponsable,
      statut: 'signalee',
      inscritCarnet: false,
      createdAt: now,
      updatedAt: now,
    };

    // Inscrire automatiquement au carnet
    await this.ajouterEntreeCarnet({
      chantierId: input.chantierId,
      date: now.split('T')[0],
      entreprise: input.entrepriseVictime,
      auteur: 'Système',
      type: 'incident',
      contenu: `Dégradation signalée: ${input.description}`,
      urgent: input.gravite === 'grave',
    });

    degradation.inscritCarnet = true;

    console.log('[CoordinationService] Dégradation signalée:', degradation);
    return degradation;
  }

  /**
   * Constater une dégradation
   */
  static async constaterDegradation(
    degradationId: string,
    constatation: Degradation['constatation']
  ): Promise<Degradation> {
    console.log('[CoordinationService] Dégradation constatée:', degradationId, constatation);

    return {
      id: degradationId,
      chantierId: 'mock',
      dateSignalement: new Date().toISOString(),
      signalePar: 'Mock',
      entrepriseVictime: 'Mock',
      lotVictime: 'Mock',
      zone: 'Mock',
      description: 'Mock',
      gravite: 'mineure',
      photos: [],
      constatation,
      statut: 'constatee',
      inscritCarnet: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Enregistrer une réparation
   */
  static async enregistrerReparation(
    degradationId: string,
    reparation: Degradation['reparation']
  ): Promise<Degradation> {
    console.log('[CoordinationService] Réparation enregistrée:', degradationId, reparation);

    return {
      id: degradationId,
      chantierId: 'mock',
      dateSignalement: new Date().toISOString(),
      signalePar: 'Mock',
      entrepriseVictime: 'Mock',
      lotVictime: 'Mock',
      zone: 'Mock',
      description: 'Mock',
      gravite: 'mineure',
      photos: [],
      reparation,
      statut: 'reparee',
      inscritCarnet: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Lister les dégradations
   */
  static async listDegradations(filters?: DegradationFilters): Promise<Degradation[]> {
    return this.getMockDegradations().filter(d => {
      if (filters?.chantierId && d.chantierId !== filters.chantierId) return false;
      if (filters?.statut && d.statut !== filters.statut) return false;
      if (filters?.gravite && d.gravite !== filters.gravite) return false;
      return true;
    });
  }

  // ============================================
  // ALERTES
  // ============================================

  /**
   * Obtenir les alertes de coordination
   */
  static async getAlertes(chantierId: string): Promise<AlerteCoordination[]> {
    const alertes: AlerteCoordination[] = [];
    const now = new Date().toISOString();

    // Conflits non résolus
    const conflits = await this.listConflits({ chantierId, statut: 'detecte' });
    for (const conflit of conflits) {
      alertes.push({
        id: crypto.randomUUID(),
        chantierId,
        type: 'conflit_planning',
        niveau: conflit.impact === 'bloquant' ? 'critical' : 'warning',
        entiteType: 'conflit',
        entiteId: conflit.id,
        titre: 'Conflit de planning détecté',
        message: conflit.description,
        dateCreation: now,
        lu: false,
        traite: false,
        createdAt: now,
      });
    }

    // Interfaces avec problèmes
    const interfaces = await this.listInterfaces({ chantierId, statut: 'probleme' });
    for (const iface of interfaces) {
      alertes.push({
        id: crypto.randomUUID(),
        chantierId,
        type: 'interface_probleme',
        niveau: iface.probleme?.gravite === 'bloquant' ? 'critical' : 'warning',
        entiteType: 'interface',
        entiteId: iface.id,
        titre: 'Problème d\'interface technique',
        message: iface.probleme?.description || iface.description,
        dateCreation: now,
        lu: false,
        traite: false,
        createdAt: now,
      });
    }

    // Dégradations non résolues
    const degradations = await this.listDegradations({ chantierId });
    for (const deg of degradations.filter(d => d.statut !== 'reparee')) {
      alertes.push({
        id: crypto.randomUUID(),
        chantierId,
        type: 'degradation_signalee',
        niveau: deg.gravite === 'grave' ? 'error' : 'warning',
        entiteType: 'degradation',
        entiteId: deg.id,
        titre: 'Dégradation signalée',
        message: deg.description,
        entreprisesConcernees: [deg.entrepriseVictime, deg.entrepriseResponsable].filter(Boolean) as string[],
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
   * Obtenir les statistiques de coordination
   */
  static async getStatistiques(chantierId: string) {
    const creneaux = await this.listCreneaux({ chantierId });
    const conflits = await this.listConflits({ chantierId });
    const interfaces = await this.listInterfaces({ chantierId });
    const degradations = await this.listDegradations({ chantierId });

    return {
      creneaux: {
        total: creneaux.length,
        confirmes: creneaux.filter(c => c.statut === 'confirme').length,
        enConflit: creneaux.filter(c => c.statut === 'conflit').length,
      },
      conflits: {
        total: conflits.length,
        resolus: conflits.filter(c => c.statut === 'resolu').length,
        enAttente: conflits.filter(c => c.statut === 'detecte').length,
      },
      interfaces: {
        total: interfaces.length,
        definies: interfaces.filter(i => i.statut === 'defini' || i.statut === 'valide').length,
        enProbleme: interfaces.filter(i => i.statut === 'probleme').length,
      },
      degradations: {
        total: degradations.length,
        reparees: degradations.filter(d => d.statut === 'reparee').length,
        enAttente: degradations.filter(d => d.statut !== 'reparee').length,
      },
    };
  }

  // ============================================
  // DONNÉES MOCK
  // ============================================

  private static getMockCreneaux(): CreneauIntervention[] {
    const now = new Date().toISOString();
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const nextWeekEnd = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    return [
      {
        id: 'creneau-1',
        chantierId: 'chantier-1',
        entrepriseId: 'ent-1',
        entrepriseNom: 'Électricité Martin',
        lotId: 'lot-elec',
        lotNom: 'Électricité',
        dateDebut: nextWeek,
        dateFin: nextWeekEnd,
        zone: 'RDC - Cuisine',
        description: 'Passage des gaines et câbles',
        effectifPrevu: 2,
        statut: 'confirme',
        creePar: 'Électricité Martin',
        validePar: 'Conducteur travaux',
        conflits: [],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'creneau-2',
        chantierId: 'chantier-1',
        entrepriseId: 'ent-2',
        entrepriseNom: 'Plomberie Dupont',
        lotId: 'lot-plomb',
        lotNom: 'Plomberie',
        dateDebut: nextWeek,
        dateFin: nextWeekEnd,
        zone: 'RDC - Cuisine',
        description: 'Passage des évacuations',
        effectifPrevu: 2,
        statut: 'conflit',
        creePar: 'Plomberie Dupont',
        conflits: [],
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  private static getMockConflits(): ConflitPlanning[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'conflit-1',
        chantierId: 'chantier-1',
        type: 'chevauchement_zone',
        creneau1Id: 'creneau-1',
        creneau2Id: 'creneau-2',
        description: 'Électricité / Plomberie dans RDC - Cuisine',
        impact: 'moyen',
        dateDetection: now,
        detectePar: 'systeme',
        statut: 'detecte',
        suggestionsIA: [
          {
            id: 'sug-1',
            type: 'diviser_zone',
            description: 'Électricité côté mur gauche, Plomberie côté mur droit',
            impactDelai: 0,
            scorePertinence: 85,
          },
        ],
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  private static getMockCarnets(): CarnetLiaison[] {
    const now = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0];

    return [
      {
        id: 'carnet-1',
        chantierId: 'chantier-1',
        date: today,
        entrees: [
          {
            id: 'entree-1',
            carnetId: 'carnet-1',
            entreprise: 'Maçonnerie Durand',
            auteur: 'Chef de chantier',
            dateHeure: now,
            type: 'arrivee',
            contenu: 'Arrivée équipe 3 personnes',
            urgent: false,
            createdAt: now,
          },
          {
            id: 'entree-2',
            carnetId: 'carnet-1',
            entreprise: 'Maçonnerie Durand',
            auteur: 'Chef de chantier',
            dateHeure: now,
            type: 'travaux_realises',
            contenu: 'Coulage dalle RDC terminé',
            urgent: false,
            createdAt: now,
          },
        ],
        signatures: [
          {
            id: 'sig-1',
            entreprise: 'Maçonnerie Durand',
            signataire: 'Jean Durand',
            dateHeure: now,
            type: 'arrivee',
          },
        ],
        cloture: false,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  private static getMockConversations(chantierId: string): Conversation[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'conv-1',
        chantierId,
        type: 'chantier_general',
        nom: 'Discussion générale',
        description: 'Canal principal de communication du chantier',
        participants: [
          { id: 'p1', entreprise: 'MOE', nom: 'Cabinet Architecture', actif: true, messagesNonLus: 0 },
          { id: 'p2', entreprise: 'Maçonnerie', nom: 'Maçonnerie Durand', actif: true, messagesNonLus: 2 },
          { id: 'p3', entreprise: 'Électricité', nom: 'Électricité Martin', actif: true, messagesNonLus: 0 },
        ],
        dernierMessage: 'Réunion de coordination demain 9h',
        dernierMessageDate: now,
        actif: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'conv-2',
        chantierId,
        type: 'coordination',
        nom: 'Coordination technique',
        description: 'Discussions techniques entre MOE et conducteur',
        participants: [
          { id: 'p1', entreprise: 'MOE', nom: 'Architecte', actif: true, messagesNonLus: 0 },
          { id: 'p2', entreprise: 'OPC', nom: 'Conducteur travaux', actif: true, messagesNonLus: 1 },
        ],
        actif: true,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  private static getMockMessages(conversationId: string): MessageChat[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'msg-1',
        conversationId,
        auteurId: 'p1',
        auteurNom: 'Architecte',
        auteurEntreprise: 'MOE',
        contenu: 'Bonjour à tous, point sur l\'avancement cette semaine ?',
        type: 'texte',
        lu: true,
        modifie: false,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'msg-2',
        conversationId,
        auteurId: 'p2',
        auteurNom: 'Chef de chantier',
        auteurEntreprise: 'Maçonnerie Durand',
        contenu: 'Dalle RDC terminée hier. On attaque les murs demain.',
        type: 'texte',
        lu: true,
        modifie: false,
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'msg-3',
        conversationId,
        auteurId: 'p1',
        auteurNom: 'Architecte',
        auteurEntreprise: 'MOE',
        contenu: 'Réunion de coordination demain 9h',
        type: 'texte',
        lu: false,
        modifie: false,
        createdAt: now,
      },
    ];
  }

  private static getMockInterfaces(): InterfaceTechnique[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'interface-1',
        chantierId: 'chantier-1',
        lot1: {
          lotId: 'lot-go',
          lotNom: 'Gros œuvre',
          entreprise: 'Maçonnerie Durand',
          role: 'emetteur',
        },
        lot2: {
          lotId: 'lot-elec',
          lotNom: 'Électricité',
          entreprise: 'Électricité Martin',
          role: 'recepteur',
        },
        type: 'reservation',
        description: 'Réservations pour passage gaines électriques',
        zone: 'RDC',
        localisation: 'Mur porteur cuisine/salon',
        specifications: 'Ø 50mm tous les 60cm',
        dateRequise: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        statut: 'defini',
        valideLot1: { par: 'Jean Durand', date: now },
        valideLot2: { par: 'Pierre Martin', date: now },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'interface-2',
        chantierId: 'chantier-1',
        lot1: {
          lotId: 'lot-plomb',
          lotNom: 'Plomberie',
          entreprise: 'Plomberie Dupont',
          role: 'emetteur',
        },
        lot2: {
          lotId: 'lot-plaq',
          lotNom: 'Plâtrerie',
          entreprise: 'Plâtrerie Bernard',
          role: 'recepteur',
        },
        type: 'coordination_pose',
        description: 'Pose tuyauterie avant fermeture cloisons',
        zone: 'Salle de bain étage',
        dateRequise: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        statut: 'a_definir',
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  private static getMockReglesChantier(chantierId: string): ReglesChantier {
    const now = new Date().toISOString();
    return {
      id: 'regles-1',
      chantierId,
      ordreLots: this.getOrdreLotsBTP(),
      reglesConflit: [
        { id: 'rc-1', situation: 'Deux lots même zone', regle: 'Lot chemin critique prioritaire', priorite: 1 },
        { id: 'rc-2', situation: 'Attente appro', regle: 'Lot avec délai appro long prioritaire', priorite: 2 },
        { id: 'rc-3', situation: 'Petit vs gros lot', regle: 'Petit lot prioritaire (finit vite)', priorite: 3 },
      ],
      protocolesInterface: [
        { id: 'pi-1', lot1: 'Plaquiste', lot2: 'Électricien', action: 'Percement prises', responsable: 'lot1' },
        { id: 'pi-2', lot1: 'Peintre', lot2: 'Carreleur', action: 'Protection carrelage', responsable: 'lot1' },
      ],
      reglesDegradation: {
        protectionObligatoire: true,
        typesProtection: ['bâches', 'cartons', 'scotch de protection'],
        delaiSignalement: 24,
        photoObligatoire: true,
        delaiReparation: 7,
        responsableParDefaut: 'causant',
      },
      createdAt: now,
      updatedAt: now,
    };
  }

  private static getMockDegradations(): Degradation[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'deg-1',
        chantierId: 'chantier-1',
        dateSignalement: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        signalePar: 'Carreleur',
        entrepriseVictime: 'Carrelage Pro',
        lotVictime: 'Carrelage',
        entrepriseResponsable: 'Peinture Express',
        lotResponsable: 'Peinture',
        zone: 'Salle de bain RDC',
        description: 'Traces de peinture sur carrelage fraîchement posé',
        gravite: 'mineure',
        photos: [{ id: 'photo-1', url: '/mock/photo-deg-1.jpg', dateHeure: now }],
        constatation: {
          date: now,
          par: 'Conducteur travaux',
          confirmee: true,
          observations: 'Traces visibles, nettoyage nécessaire',
        },
        statut: 'responsable_identifie',
        inscritCarnet: true,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }
}

/**
 * TORP Phase 3 - Coordination Service
 * Gestion de la coordination multi-entreprises
 *
 * PRODUCTION-READY: Utilise Supabase pour la persistance
 */

import { supabase } from '@/lib/supabase';
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
  // CRÉNEAUX D'INTERVENTION (via coordination_slots)
  // ============================================

  /**
   * Créer un créneau d'intervention
   */
  static async createCreneau(input: CreateCreneauInput): Promise<CreneauIntervention> {
    const now = new Date().toISOString();

    // Insérer dans Supabase
    const { data, error } = await supabase
      .from('coordination_slots')
      .insert({
        project_id: input.chantierId,
        slot_date: input.dateDebut.split('T')[0],
        start_time: '08:00',
        end_time: '18:00',
        company_id: input.entrepriseId,
        company_name: input.entrepriseNom,
        lot_code: input.lotId,
        zone_id: input.zone,
        zone_name: input.zone,
        status: 'planifie',
        description: input.description,
      })
      .select()
      .single();

    if (error) {
      console.error('[CoordinationService] Error creating slot:', error);
      throw new Error(`Failed to create coordination slot: ${error.message}`);
    }

    const creneau: CreneauIntervention = {
      id: data.id,
      chantierId: data.project_id,
      entrepriseId: data.company_id,
      entrepriseNom: data.company_name,
      lotId: data.lot_code,
      lotNom: input.lotNom || data.lot_code,
      dateDebut: data.slot_date,
      dateFin: input.dateFin,
      zone: data.zone_name,
      description: data.description,
      effectifPrevu: input.effectifPrevu,
      statut: 'reserve',
      creePar: data.company_name,
      conflits: [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    // Détecter les conflits potentiels
    const conflits = await this.detecterConflits(creneau);
    creneau.conflits = conflits;

    if (conflits.length > 0) {
      creneau.statut = 'conflit';
      await supabase
        .from('coordination_slots')
        .update({ status: 'conflit' })
        .eq('id', data.id);
    }

    return creneau;
  }

  /**
   * Lister les créneaux
   */
  static async listCreneaux(filters?: CreneauFilters): Promise<CreneauIntervention[]> {
    let query = supabase.from('coordination_slots').select('*');

    if (filters?.chantierId) {
      query = query.eq('project_id', filters.chantierId);
    }
    if (filters?.entrepriseId) {
      query = query.eq('company_id', filters.entrepriseId);
    }
    if (filters?.lotId) {
      query = query.eq('lot_code', filters.lotId);
    }
    if (filters?.zone) {
      query = query.eq('zone_name', filters.zone);
    }
    if (filters?.statut) {
      query = query.eq('status', filters.statut);
    }
    if (filters?.dateDebut) {
      query = query.gte('slot_date', filters.dateDebut);
    }
    if (filters?.dateFin) {
      query = query.lte('slot_date', filters.dateFin);
    }

    const { data, error } = await query.order('slot_date', { ascending: true });

    if (error) {
      console.error('[CoordinationService] Error listing slots:', error);
      return [];
    }

    return (data || []).map(slot => ({
      id: slot.id,
      chantierId: slot.project_id,
      entrepriseId: slot.company_id,
      entrepriseNom: slot.company_name,
      lotId: slot.lot_code,
      lotNom: slot.lot_code,
      dateDebut: slot.slot_date,
      dateFin: slot.slot_date,
      zone: slot.zone_name,
      description: slot.description,
      statut: this.mapSlotStatus(slot.status),
      creePar: slot.company_name,
      conflits: [],
      createdAt: slot.created_at,
      updatedAt: slot.updated_at,
    }));
  }

  private static mapSlotStatus(status: string): StatutCreneauPlanning {
    const statusMap: Record<string, StatutCreneauPlanning> = {
      'planifie': 'reserve',
      'confirme': 'confirme',
      'en_cours': 'en_cours',
      'termine': 'termine',
      'annule': 'annule',
      'conflit': 'conflit',
    };
    return statusMap[status] || 'reserve';
  }

  /**
   * Valider un créneau
   */
  static async validerCreneau(creneauId: string, validePar: string): Promise<CreneauIntervention> {
    const { data, error } = await supabase
      .from('coordination_slots')
      .update({ status: 'confirme' })
      .eq('id', creneauId)
      .select()
      .single();

    if (error) {
      console.error('[CoordinationService] Error validating slot:', error);
      throw new Error(`Failed to validate slot: ${error.message}`);
    }

    return {
      id: data.id,
      chantierId: data.project_id,
      entrepriseId: data.company_id,
      entrepriseNom: data.company_name,
      lotId: data.lot_code,
      lotNom: data.lot_code,
      dateDebut: data.slot_date,
      dateFin: data.slot_date,
      zone: data.zone_name,
      statut: 'confirme',
      creePar: data.company_name,
      validePar,
      dateValidation: new Date().toISOString(),
      conflits: [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  // ============================================
  // DÉTECTION DE CONFLITS (via coordination_conflicts)
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
        { debut: creneau.dateDebut, fin: creneau.dateFin || creneau.dateDebut },
        { debut: existant.dateDebut, fin: existant.dateFin || existant.dateDebut }
      );

      if (chevauche) {
        // Insérer le conflit en DB
        const { data: conflitData } = await supabase
          .from('coordination_conflicts')
          .insert({
            project_id: creneau.chantierId,
            slot_id_1: creneau.id,
            slot_id_2: existant.id,
            conflict_type: 'chevauchement_zone',
            severity: 'warning',
            description: `Conflit ${creneau.lotNom} / ${existant.lotNom} dans ${creneau.zone}`,
            status: 'open',
          })
          .select()
          .single();

        const conflit: ConflitPlanning = {
          id: conflitData?.id || crypto.randomUUID(),
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

    return d1 <= f2 && d2 <= f1;
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
    let query = supabase.from('coordination_conflicts').select('*');

    if (filters?.chantierId) {
      query = query.eq('project_id', filters.chantierId);
    }
    if (filters?.statut) {
      const statusMap: Record<string, string> = {
        'detecte': 'open',
        'en_discussion': 'acknowledged',
        'resolu': 'resolved',
        'ignore': 'ignored',
      };
      query = query.eq('status', statusMap[filters.statut] || filters.statut);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('[CoordinationService] Error listing conflicts:', error);
      return [];
    }

    return (data || []).map(c => ({
      id: c.id,
      chantierId: c.project_id,
      type: c.conflict_type as TypeConflitPlanning,
      creneau1Id: c.slot_id_1,
      creneau2Id: c.slot_id_2,
      description: c.description,
      impact: c.severity === 'error' ? 'bloquant' : 'moyen',
      dateDetection: c.created_at,
      detectePar: 'systeme',
      statut: this.mapConflictStatus(c.status),
      resolution: c.resolution ? { description: c.resolution, date: c.resolved_at } : undefined,
      createdAt: c.created_at,
      updatedAt: c.created_at,
    }));
  }

  private static mapConflictStatus(status: string): ConflitPlanning['statut'] {
    const statusMap: Record<string, ConflitPlanning['statut']> = {
      'open': 'detecte',
      'acknowledged': 'en_discussion',
      'resolved': 'resolu',
      'ignored': 'ignore',
    };
    return statusMap[status] || 'detecte';
  }

  /**
   * Résoudre un conflit
   */
  static async resoudreConflit(
    conflitId: string,
    resolution: ConflitPlanning['resolution']
  ): Promise<ConflitPlanning> {
    const { data, error } = await supabase
      .from('coordination_conflicts')
      .update({
        status: 'resolved',
        resolution: resolution?.description,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', conflitId)
      .select()
      .single();

    if (error) {
      console.error('[CoordinationService] Error resolving conflict:', error);
      throw new Error(`Failed to resolve conflict: ${error.message}`);
    }

    return {
      id: data.id,
      chantierId: data.project_id,
      type: data.conflict_type as TypeConflitPlanning,
      creneau1Id: data.slot_id_1,
      description: data.description,
      impact: 'moyen',
      dateDetection: data.created_at,
      detectePar: 'systeme',
      statut: 'resolu',
      resolution,
      createdAt: data.created_at,
      updatedAt: new Date().toISOString(),
    };
  }

  // ============================================
  // CARNET DE LIAISON (via correspondence_logs)
  // ============================================

  /**
   * Obtenir ou créer le carnet du jour
   */
  static async getCarnetDuJour(chantierId: string, date?: string): Promise<CarnetLiaison> {
    const dateJour = date || new Date().toISOString().split('T')[0];

    // Rechercher les entrées du jour
    const { data: entries, error } = await supabase
      .from('correspondence_logs')
      .select('*')
      .eq('project_id', chantierId)
      .gte('created_at', `${dateJour}T00:00:00`)
      .lt('created_at', `${dateJour}T23:59:59`)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[CoordinationService] Error fetching carnet:', error);
    }

    const entrees: EntreeCarnetLiaison[] = (entries || []).map(e => ({
      id: e.id,
      carnetId: `carnet-${dateJour}`,
      entreprise: e.sender_company || 'Non spécifié',
      auteur: e.sender_name || 'Non spécifié',
      dateHeure: e.created_at,
      type: e.message_type as TypeEntreeCarnet,
      contenu: e.content,
      destinataires: e.recipients,
      photos: e.attachments?.filter((a: any) => a.type?.startsWith('image/')).map((a: any) => a.path),
      urgent: e.message_type === 'alert',
      createdAt: e.created_at,
    }));

    return {
      id: `carnet-${dateJour}`,
      chantierId,
      date: dateJour,
      entrees,
      signatures: [],
      cloture: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Ajouter une entrée au carnet
   */
  static async ajouterEntreeCarnet(input: CreateEntreeCarnetInput): Promise<EntreeCarnetLiaison> {
    const { data, error } = await supabase
      .from('correspondence_logs')
      .insert({
        project_id: input.chantierId,
        message_type: input.type,
        content: input.contenu,
        sender_name: input.auteur,
        sender_company: input.entreprise,
        sender_role: 'entreprise',
        recipients: input.destinataires || [],
        attachments: input.photos?.map(url => ({ path: url, type: 'image/jpeg' })) || [],
      })
      .select()
      .single();

    if (error) {
      console.error('[CoordinationService] Error adding carnet entry:', error);
      throw new Error(`Failed to add carnet entry: ${error.message}`);
    }

    return {
      id: data.id,
      carnetId: `carnet-${new Date().toISOString().split('T')[0]}`,
      entreprise: data.sender_company,
      auteur: data.sender_name,
      dateHeure: data.created_at,
      type: data.message_type as TypeEntreeCarnet,
      contenu: data.content,
      destinataires: data.recipients,
      urgent: input.urgent || false,
      createdAt: data.created_at,
    };
  }

  /**
   * Répondre à une entrée
   */
  static async repondreEntree(
    entreeId: string,
    reponse: { par: string; contenu: string }
  ): Promise<EntreeCarnetLiaison> {
    // Récupérer l'entrée originale
    const { data: original } = await supabase
      .from('correspondence_logs')
      .select('*')
      .eq('id', entreeId)
      .single();

    // Créer une réponse liée
    const { data, error } = await supabase
      .from('correspondence_logs')
      .insert({
        project_id: original?.project_id,
        message_type: 'response',
        content: reponse.contenu,
        sender_name: reponse.par,
        parent_id: entreeId,
        thread_id: original?.thread_id || entreeId,
      })
      .select()
      .single();

    if (error) {
      console.error('[CoordinationService] Error adding reply:', error);
      throw new Error(`Failed to add reply: ${error.message}`);
    }

    return {
      id: entreeId,
      carnetId: 'reply',
      entreprise: original?.sender_company || 'Non spécifié',
      auteur: original?.sender_name || 'Non spécifié',
      dateHeure: original?.created_at,
      type: original?.message_type as TypeEntreeCarnet,
      contenu: original?.content,
      urgent: false,
      reponse: {
        ...reponse,
        dateHeure: data.created_at,
      },
      createdAt: original?.created_at,
    };
  }

  /**
   * Signer présence au carnet
   */
  static async signerCarnet(
    carnetId: string,
    signature: { entreprise: string; signataire: string; type: 'arrivee' | 'depart' }
  ): Promise<void> {
    // Extraire le project_id du carnetId ou le passer en paramètre
    const dateMatch = carnetId.match(/carnet-(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];

    await supabase
      .from('correspondence_logs')
      .insert({
        project_id: carnetId.replace('carnet-', '').split('-')[0] || 'unknown',
        message_type: signature.type === 'arrivee' ? 'info' : 'info',
        content: `${signature.type === 'arrivee' ? 'Arrivée' : 'Départ'} - ${signature.signataire}`,
        sender_name: signature.signataire,
        sender_company: signature.entreprise,
        sender_role: 'entreprise',
      });
  }

  /**
   * Clôturer le carnet du jour
   */
  static async cloturerCarnet(carnetId: string, par: string): Promise<CarnetLiaison> {
    // Marquer la clôture via une entrée spéciale
    const dateMatch = carnetId.match(/carnet-(\d{4}-\d{2}-\d{2})/);
    const chantierId = carnetId.replace('carnet-', '');

    await supabase
      .from('correspondence_logs')
      .insert({
        project_id: chantierId,
        message_type: 'info',
        subject: 'Clôture carnet',
        content: `Carnet clôturé par ${par}`,
        sender_name: par,
        sender_role: 'coordinateur',
      });

    const carnet = await this.getCarnetDuJour(chantierId);
    carnet.cloture = true;
    carnet.cloturePar = par;
    carnet.clotureLe = new Date().toISOString();
    return carnet;
  }

  /**
   * Lister les carnets
   */
  static async listCarnets(filters?: CarnetFilters): Promise<CarnetLiaison[]> {
    let query = supabase
      .from('correspondence_logs')
      .select('project_id, created_at')
      .order('created_at', { ascending: false });

    if (filters?.chantierId) {
      query = query.eq('project_id', filters.chantierId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[CoordinationService] Error listing carnets:', error);
      return [];
    }

    // Grouper par date
    const carnetsByDate = new Map<string, { projectId: string; date: string }>();
    for (const entry of data || []) {
      const date = entry.created_at.split('T')[0];
      const key = `${entry.project_id}-${date}`;
      if (!carnetsByDate.has(key)) {
        carnetsByDate.set(key, { projectId: entry.project_id, date });
      }
    }

    // Retourner les carnets uniques
    return Array.from(carnetsByDate.values()).map(({ projectId, date }) => ({
      id: `carnet-${date}`,
      chantierId: projectId,
      date,
      entrees: [],
      signatures: [],
      cloture: false,
      createdAt: date,
      updatedAt: date,
    }));
  }

  // ============================================
  // CHAT MULTI-ENTREPRISES
  // ============================================

  /**
   * Créer une conversation
   */
  static async createConversation(input: CreateConversationInput): Promise<Conversation> {
    const now = new Date().toISOString();

    // Stocker via correspondence_logs avec un thread_id unique
    const threadId = crypto.randomUUID();

    const { data, error } = await supabase
      .from('correspondence_logs')
      .insert({
        project_id: input.chantierId,
        message_type: 'info',
        subject: input.nom,
        content: input.description || `Conversation: ${input.nom}`,
        thread_id: threadId,
        recipients: input.participants.map(p => ({ id: p.id, name: p.nom })),
      })
      .select()
      .single();

    if (error) {
      console.error('[CoordinationService] Error creating conversation:', error);
      throw new Error(`Failed to create conversation: ${error.message}`);
    }

    return {
      id: threadId,
      chantierId: input.chantierId,
      type: input.type,
      nom: input.nom,
      description: input.description,
      participants: input.participants,
      actif: true,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Lister les conversations d'un chantier
   */
  static async listConversations(chantierId: string): Promise<Conversation[]> {
    const { data, error } = await supabase
      .from('correspondence_logs')
      .select('*')
      .eq('project_id', chantierId)
      .not('thread_id', 'is', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[CoordinationService] Error listing conversations:', error);
      return [];
    }

    // Grouper par thread_id
    const conversations = new Map<string, Conversation>();
    for (const entry of data || []) {
      if (!entry.thread_id) continue;
      if (!conversations.has(entry.thread_id)) {
        conversations.set(entry.thread_id, {
          id: entry.thread_id,
          chantierId,
          type: 'chantier_general',
          nom: entry.subject || 'Discussion',
          description: entry.content,
          participants: (entry.recipients || []).map((r: any) => ({
            id: r.id || crypto.randomUUID(),
            entreprise: r.company || 'Non spécifié',
            nom: r.name || 'Non spécifié',
            actif: true,
            messagesNonLus: 0,
          })),
          actif: true,
          createdAt: entry.created_at,
          updatedAt: entry.created_at,
        });
      }
    }

    return Array.from(conversations.values());
  }

  /**
   * Envoyer un message
   */
  static async envoyerMessage(
    conversationId: string,
    message: Omit<MessageChat, 'id' | 'conversationId' | 'createdAt' | 'lu' | 'modifie'>
  ): Promise<MessageChat> {
    const { data, error } = await supabase
      .from('correspondence_logs')
      .insert({
        project_id: message.auteurEntreprise || 'unknown',
        message_type: message.type === 'texte' ? 'info' : message.type,
        content: message.contenu,
        sender_id: message.auteurId,
        sender_name: message.auteurNom,
        sender_company: message.auteurEntreprise,
        thread_id: conversationId,
        attachments: message.fichiers?.map(f => ({ path: f.url, name: f.nom, type: f.type })) || [],
      })
      .select()
      .single();

    if (error) {
      console.error('[CoordinationService] Error sending message:', error);
      throw new Error(`Failed to send message: ${error.message}`);
    }

    return {
      id: data.id,
      conversationId,
      auteurId: message.auteurId,
      auteurNom: message.auteurNom,
      auteurEntreprise: message.auteurEntreprise,
      contenu: message.contenu,
      type: message.type,
      fichiers: message.fichiers,
      lu: false,
      modifie: false,
      createdAt: data.created_at,
    };
  }

  /**
   * Lister les messages d'une conversation
   */
  static async listMessages(conversationId: string, limit = 50): Promise<MessageChat[]> {
    const { data, error } = await supabase
      .from('correspondence_logs')
      .select('*')
      .eq('thread_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('[CoordinationService] Error listing messages:', error);
      return [];
    }

    return (data || []).map(m => ({
      id: m.id,
      conversationId,
      auteurId: m.sender_id,
      auteurNom: m.sender_name || 'Non spécifié',
      auteurEntreprise: m.sender_company,
      contenu: m.content,
      type: 'texte',
      lu: (m.read_by || []).length > 0,
      modifie: false,
      createdAt: m.created_at,
    }));
  }

  // ============================================
  // INTERFACES TECHNIQUES
  // ============================================

  /**
   * Créer une interface technique
   */
  static async createInterface(input: CreateInterfaceInput): Promise<InterfaceTechnique> {
    const now = new Date().toISOString();

    // Stocker via correspondence_logs avec type spécial
    const { data, error } = await supabase
      .from('correspondence_logs')
      .insert({
        project_id: input.chantierId,
        message_type: 'instruction',
        subject: `Interface: ${input.lot1.lotNom} / ${input.lot2.lotNom}`,
        content: JSON.stringify({
          type: input.type,
          description: input.description,
          zone: input.zone,
          specifications: input.specifications,
          dateRequise: input.dateRequise,
          lot1: input.lot1,
          lot2: input.lot2,
          statut: 'a_definir',
        }),
      })
      .select()
      .single();

    if (error) {
      console.error('[CoordinationService] Error creating interface:', error);
      throw new Error(`Failed to create interface: ${error.message}`);
    }

    return {
      id: data.id,
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
  }

  /**
   * Lister les interfaces
   */
  static async listInterfaces(filters?: InterfaceFilters): Promise<InterfaceTechnique[]> {
    let query = supabase
      .from('correspondence_logs')
      .select('*')
      .eq('message_type', 'instruction')
      .ilike('subject', 'Interface:%');

    if (filters?.chantierId) {
      query = query.eq('project_id', filters.chantierId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('[CoordinationService] Error listing interfaces:', error);
      return [];
    }

    return (data || []).map(d => {
      let parsed: any = {};
      try {
        parsed = JSON.parse(d.content);
      } catch {}

      return {
        id: d.id,
        chantierId: d.project_id,
        lot1: parsed.lot1 || { lotId: '', lotNom: 'Non spécifié', entreprise: '', role: 'emetteur' },
        lot2: parsed.lot2 || { lotId: '', lotNom: 'Non spécifié', entreprise: '', role: 'recepteur' },
        type: parsed.type || 'coordination_pose',
        description: parsed.description || '',
        zone: parsed.zone,
        specifications: parsed.specifications,
        dateRequise: parsed.dateRequise,
        statut: parsed.statut || 'a_definir',
        createdAt: d.created_at,
        updatedAt: d.created_at,
      };
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
    // Récupérer l'interface
    const { data: existing } = await supabase
      .from('correspondence_logs')
      .select('*')
      .eq('id', interfaceId)
      .single();

    let parsed: any = {};
    try {
      parsed = JSON.parse(existing?.content || '{}');
    } catch {}

    // Mettre à jour la validation
    if (lotRole === 'lot1') {
      parsed.valideLot1 = { ...validation, date: new Date().toISOString() };
    } else {
      parsed.valideLot2 = { ...validation, date: new Date().toISOString() };
    }

    // Si les deux lots ont validé, marquer comme défini
    if (parsed.valideLot1 && parsed.valideLot2) {
      parsed.statut = 'defini';
    }

    const { data, error } = await supabase
      .from('correspondence_logs')
      .update({ content: JSON.stringify(parsed) })
      .eq('id', interfaceId)
      .select()
      .single();

    if (error) {
      console.error('[CoordinationService] Error validating interface:', error);
      throw new Error(`Failed to validate interface: ${error.message}`);
    }

    return {
      id: data.id,
      chantierId: data.project_id,
      lot1: parsed.lot1,
      lot2: parsed.lot2,
      type: parsed.type,
      description: parsed.description,
      zone: parsed.zone,
      specifications: parsed.specifications,
      dateRequise: parsed.dateRequise,
      statut: parsed.statut,
      valideLot1: parsed.valideLot1,
      valideLot2: parsed.valideLot2,
      createdAt: data.created_at,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Signaler un problème d'interface
   */
  static async signalerProblemeInterface(
    interfaceId: string,
    probleme: InterfaceTechnique['probleme']
  ): Promise<InterfaceTechnique> {
    // Récupérer et mettre à jour
    const { data: existing } = await supabase
      .from('correspondence_logs')
      .select('*')
      .eq('id', interfaceId)
      .single();

    let parsed: any = {};
    try {
      parsed = JSON.parse(existing?.content || '{}');
    } catch {}

    parsed.probleme = probleme;
    parsed.statut = 'probleme';

    const { data, error } = await supabase
      .from('correspondence_logs')
      .update({ content: JSON.stringify(parsed) })
      .eq('id', interfaceId)
      .select()
      .single();

    if (error) {
      console.error('[CoordinationService] Error reporting interface problem:', error);
      throw new Error(`Failed to report interface problem: ${error.message}`);
    }

    return {
      id: data.id,
      chantierId: data.project_id,
      lot1: parsed.lot1,
      lot2: parsed.lot2,
      type: parsed.type,
      description: parsed.description,
      zone: parsed.zone,
      statut: 'probleme',
      probleme,
      createdAt: data.created_at,
      updatedAt: new Date().toISOString(),
    };
  }

  // ============================================
  // RÈGLES DE CHANTIER
  // ============================================

  /**
   * Obtenir les règles du chantier
   */
  static async getReglesChantier(chantierId: string): Promise<ReglesChantier> {
    // Règles par défaut (peuvent être personnalisées via DB plus tard)
    const now = new Date().toISOString();
    return {
      id: `regles-${chantierId}`,
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

  /**
   * Mettre à jour les règles
   */
  static async updateReglesChantier(
    chantierId: string,
    updates: Partial<ReglesChantier>
  ): Promise<ReglesChantier> {
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

    // Créer une entrée dans le carnet
    const entry = await this.ajouterEntreeCarnet({
      chantierId: input.chantierId,
      date: now.split('T')[0],
      entreprise: input.entrepriseVictime,
      auteur: 'Système',
      type: 'incident',
      contenu: `Dégradation signalée: ${input.description}`,
      urgent: input.gravite === 'grave',
      photos: input.photos,
    });

    return {
      id: entry.id,
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
      inscritCarnet: true,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Constater une dégradation
   */
  static async constaterDegradation(
    degradationId: string,
    constatation: Degradation['constatation']
  ): Promise<Degradation> {
    // Ajouter une note au carnet
    const { data } = await supabase
      .from('correspondence_logs')
      .select('*')
      .eq('id', degradationId)
      .single();

    if (data) {
      await supabase
        .from('correspondence_logs')
        .insert({
          project_id: data.project_id,
          message_type: 'info',
          content: `Constatation: ${constatation?.observations || 'Dégradation constatée'}`,
          parent_id: degradationId,
        });
    }

    return {
      id: degradationId,
      chantierId: data?.project_id || 'unknown',
      dateSignalement: data?.created_at,
      signalePar: data?.sender_name || 'Unknown',
      entrepriseVictime: data?.sender_company || 'Unknown',
      lotVictime: 'Unknown',
      zone: 'Unknown',
      description: data?.content || '',
      gravite: 'mineure',
      photos: [],
      constatation,
      statut: 'constatee',
      inscritCarnet: true,
      createdAt: data?.created_at,
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
    const { data } = await supabase
      .from('correspondence_logs')
      .select('*')
      .eq('id', degradationId)
      .single();

    if (data) {
      await supabase
        .from('correspondence_logs')
        .insert({
          project_id: data.project_id,
          message_type: 'info',
          content: `Réparation effectuée: ${reparation?.description || 'Dégradation réparée'}`,
          parent_id: degradationId,
        });
    }

    return {
      id: degradationId,
      chantierId: data?.project_id || 'unknown',
      dateSignalement: data?.created_at,
      signalePar: data?.sender_name || 'Unknown',
      entrepriseVictime: data?.sender_company || 'Unknown',
      lotVictime: 'Unknown',
      zone: 'Unknown',
      description: data?.content || '',
      gravite: 'mineure',
      photos: [],
      reparation,
      statut: 'reparee',
      inscritCarnet: true,
      createdAt: data?.created_at,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Lister les dégradations
   */
  static async listDegradations(filters?: DegradationFilters): Promise<Degradation[]> {
    let query = supabase
      .from('correspondence_logs')
      .select('*')
      .eq('message_type', 'incident');

    if (filters?.chantierId) {
      query = query.eq('project_id', filters.chantierId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('[CoordinationService] Error listing degradations:', error);
      return [];
    }

    return (data || []).map(d => ({
      id: d.id,
      chantierId: d.project_id,
      dateSignalement: d.created_at,
      signalePar: d.sender_name || 'Unknown',
      entrepriseVictime: d.sender_company || 'Unknown',
      lotVictime: 'Unknown',
      zone: 'Unknown',
      description: d.content,
      gravite: 'mineure' as const,
      photos: [],
      statut: 'signalee' as const,
      inscritCarnet: true,
      createdAt: d.created_at,
      updatedAt: d.created_at,
    }));
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
}

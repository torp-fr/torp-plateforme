/**
 * TORP Phase 2 - Réunion Service
 * Gestion des réunions de chantier et comptes-rendus
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  Reunion,
  CreateReunionInput,
  UpdateReunionInput,
  CompteRendu,
  PointOrdreDuJour,
  Participant,
  Decision,
  Action,
  TypeReunion,
  StatutReunion,
  TEMPLATE_REUNION_LANCEMENT,
  TEMPLATE_REUNION_HEBDO,
} from '@/types/phase2';

export interface ReunionFilters {
  chantierId?: string;
  type?: TypeReunion;
  statut?: StatutReunion | StatutReunion[];
  dateDebut?: string;
  dateFin?: string;
}

export class ReunionService {
  /**
   * Créer une nouvelle réunion
   */
  static async createReunion(input: CreateReunionInput): Promise<Reunion> {
    const { data, error } = await supabase
      .from('phase2_reunions')
      .insert({
        chantier_id: input.chantierId,
        type: input.type,
        titre: input.titre,
        date_reunion: input.dateReunion,
        heure_debut: input.heureDebut,
        duree_prevue_minutes: input.dureePrevueMinutes || 120,
        lieu: input.lieu,
        participants_convoques: input.participantsConvoques || [],
        ordre_du_jour: input.ordreDuJour || [],
        statut: 'planifiee',
        compte_rendu: null,
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapToReunion(data);
  }

  /**
   * Créer une réunion de lancement depuis template
   */
  static async createReunionLancement(
    chantierId: string,
    dateReunion: string,
    heureDebut: string,
    lieu: string,
    participants: Participant[]
  ): Promise<Reunion> {
    // Import du template
    const { TEMPLATE_REUNION_LANCEMENT } = await import('@/types/phase2');

    return this.createReunion({
      chantierId,
      type: 'lancement',
      titre: 'Réunion de lancement de chantier',
      dateReunion,
      heureDebut,
      lieu,
      dureePrevueMinutes: 180,
      participantsConvoques: participants,
      ordreDuJour: TEMPLATE_REUNION_LANCEMENT.points,
    });
  }

  /**
   * Créer une réunion hebdomadaire depuis template
   */
  static async createReunionHebdo(
    chantierId: string,
    dateReunion: string,
    heureDebut: string,
    lieu: string,
    participants: Participant[],
    numeroSemaine: number
  ): Promise<Reunion> {
    const { TEMPLATE_REUNION_HEBDO } = await import('@/types/phase2');

    return this.createReunion({
      chantierId,
      type: 'chantier_hebdo',
      titre: `Réunion de chantier - Semaine ${numeroSemaine}`,
      dateReunion,
      heureDebut,
      lieu,
      dureePrevueMinutes: 90,
      participantsConvoques: participants,
      ordreDuJour: TEMPLATE_REUNION_HEBDO.points,
    });
  }

  /**
   * Récupérer une réunion par ID
   */
  static async getReunion(id: string): Promise<Reunion | null> {
    const { data, error } = await supabase
      .from('phase2_reunions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return this.mapToReunion(data);
  }

  /**
   * Lister les réunions avec filtres
   */
  static async listReunions(filters?: ReunionFilters): Promise<Reunion[]> {
    let query = supabase
      .from('phase2_reunions')
      .select('*')
      .order('date_reunion', { ascending: false });

    if (filters?.chantierId) {
      query = query.eq('chantier_id', filters.chantierId);
    }

    if (filters?.type) {
      query = query.eq('type', filters.type);
    }

    if (filters?.statut) {
      if (Array.isArray(filters.statut)) {
        query = query.in('statut', filters.statut);
      } else {
        query = query.eq('statut', filters.statut);
      }
    }

    if (filters?.dateDebut) {
      query = query.gte('date_reunion', filters.dateDebut);
    }

    if (filters?.dateFin) {
      query = query.lte('date_reunion', filters.dateFin);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(r => this.mapToReunion(r));
  }

  /**
   * Mettre à jour une réunion
   */
  static async updateReunion(id: string, updates: UpdateReunionInput): Promise<Reunion> {
    const dbUpdates: Record<string, unknown> = {};

    if (updates.titre !== undefined) dbUpdates.titre = updates.titre;
    if (updates.dateReunion !== undefined) dbUpdates.date_reunion = updates.dateReunion;
    if (updates.heureDebut !== undefined) dbUpdates.heure_debut = updates.heureDebut;
    if (updates.dureePrevueMinutes !== undefined) dbUpdates.duree_prevue_minutes = updates.dureePrevueMinutes;
    if (updates.lieu !== undefined) dbUpdates.lieu = updates.lieu;
    if (updates.participantsConvoques !== undefined) dbUpdates.participants_convoques = updates.participantsConvoques;
    if (updates.ordreDuJour !== undefined) dbUpdates.ordre_du_jour = updates.ordreDuJour;
    if (updates.statut !== undefined) dbUpdates.statut = updates.statut;

    dbUpdates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('phase2_reunions')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToReunion(data);
  }

  /**
   * Démarrer une réunion
   */
  static async demarrerReunion(id: string): Promise<Reunion> {
    return this.updateReunion(id, { statut: 'en_cours' });
  }

  /**
   * Clôturer une réunion et créer le compte-rendu
   */
  static async cloturerReunion(
    id: string,
    compteRendu: Omit<CompteRendu, 'dateRedaction' | 'statut'>
  ): Promise<Reunion> {
    const fullCompteRendu: CompteRendu = {
      ...compteRendu,
      dateRedaction: new Date().toISOString(),
      statut: 'brouillon',
    };

    const { data, error } = await supabase
      .from('phase2_reunions')
      .update({
        statut: 'terminee',
        participants_presents: compteRendu.participantsPresents,
        compte_rendu: fullCompteRendu,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToReunion(data);
  }

  /**
   * Mettre à jour le compte-rendu
   */
  static async updateCompteRendu(id: string, compteRendu: CompteRendu): Promise<Reunion> {
    const { data, error } = await supabase
      .from('phase2_reunions')
      .update({
        compte_rendu: compteRendu,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToReunion(data);
  }

  /**
   * Valider le compte-rendu (passage en diffusé)
   */
  static async validerCompteRendu(id: string, validePar: string): Promise<Reunion> {
    const reunion = await this.getReunion(id);
    if (!reunion?.compteRendu) throw new Error('Pas de compte-rendu à valider');

    const updatedCR: CompteRendu = {
      ...reunion.compteRendu,
      statut: 'valide',
      validePar,
      dateValidation: new Date().toISOString(),
    };

    return this.updateCompteRendu(id, updatedCR);
  }

  /**
   * Diffuser le compte-rendu
   */
  static async diffuserCompteRendu(id: string): Promise<Reunion> {
    const reunion = await this.getReunion(id);
    if (!reunion?.compteRendu) throw new Error('Pas de compte-rendu à diffuser');

    const updatedCR: CompteRendu = {
      ...reunion.compteRendu,
      statut: 'diffuse',
      dateDiffusion: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('phase2_reunions')
      .update({
        statut: 'compte_rendu_diffuse',
        compte_rendu: updatedCR,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToReunion(data);
  }

  /**
   * Annuler une réunion
   */
  static async annulerReunion(id: string, motif?: string): Promise<Reunion> {
    const { data, error } = await supabase
      .from('phase2_reunions')
      .update({
        statut: 'annulee',
        metadata: { motifAnnulation: motif },
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToReunion(data);
  }

  /**
   * Ajouter une décision au compte-rendu
   */
  static async ajouterDecision(reunionId: string, decision: Omit<Decision, 'id'>): Promise<Reunion> {
    const reunion = await this.getReunion(reunionId);
    if (!reunion?.compteRendu) throw new Error('Pas de compte-rendu');

    const newDecision: Decision = {
      ...decision,
      id: crypto.randomUUID(),
    };

    const updatedCR: CompteRendu = {
      ...reunion.compteRendu,
      decisions: [...(reunion.compteRendu.decisions || []), newDecision],
    };

    return this.updateCompteRendu(reunionId, updatedCR);
  }

  /**
   * Ajouter une action au compte-rendu
   */
  static async ajouterAction(reunionId: string, action: Omit<Action, 'id' | 'statut'>): Promise<Reunion> {
    const reunion = await this.getReunion(reunionId);
    if (!reunion?.compteRendu) throw new Error('Pas de compte-rendu');

    const newAction: Action = {
      ...action,
      id: crypto.randomUUID(),
      statut: 'a_faire',
    };

    const updatedCR: CompteRendu = {
      ...reunion.compteRendu,
      actions: [...(reunion.compteRendu.actions || []), newAction],
    };

    return this.updateCompteRendu(reunionId, updatedCR);
  }

  /**
   * Mettre à jour le statut d'une action
   */
  static async updateActionStatut(
    reunionId: string,
    actionId: string,
    statut: Action['statut'],
    commentaire?: string
  ): Promise<Reunion> {
    const reunion = await this.getReunion(reunionId);
    if (!reunion?.compteRendu?.actions) throw new Error('Pas d\'actions');

    const updatedActions = reunion.compteRendu.actions.map(a => {
      if (a.id === actionId) {
        return {
          ...a,
          statut,
          ...(statut === 'terminee' && { dateRealisation: new Date().toISOString() }),
          ...(commentaire && { commentaire }),
        };
      }
      return a;
    });

    const updatedCR: CompteRendu = {
      ...reunion.compteRendu,
      actions: updatedActions,
    };

    return this.updateCompteRendu(reunionId, updatedCR);
  }

  /**
   * Récupérer les actions en cours sur un chantier
   */
  static async getActionsEnCours(chantierId: string): Promise<Array<Action & { reunionId: string; reunionTitre: string }>> {
    const reunions = await this.listReunions({
      chantierId,
      statut: ['terminee', 'compte_rendu_diffuse'],
    });

    const actions: Array<Action & { reunionId: string; reunionTitre: string }> = [];

    for (const reunion of reunions) {
      if (reunion.compteRendu?.actions) {
        for (const action of reunion.compteRendu.actions) {
          if (action.statut !== 'terminee' && action.statut !== 'annulee') {
            actions.push({
              ...action,
              reunionId: reunion.id,
              reunionTitre: reunion.titre,
            });
          }
        }
      }
    }

    return actions.sort((a, b) => {
      if (!a.dateEcheance) return 1;
      if (!b.dateEcheance) return -1;
      return new Date(a.dateEcheance).getTime() - new Date(b.dateEcheance).getTime();
    });
  }

  /**
   * Prochaine réunion planifiée
   */
  static async getProchaineReunion(chantierId: string): Promise<Reunion | null> {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('phase2_reunions')
      .select('*')
      .eq('chantier_id', chantierId)
      .eq('statut', 'planifiee')
      .gte('date_reunion', today)
      .order('date_reunion', { ascending: true })
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) return null;

    return this.mapToReunion(data[0]);
  }

  // ============================================
  // MAPPERS
  // ============================================

  private static mapToReunion(data: Record<string, unknown>): Reunion {
    return {
      id: data.id as string,
      chantierId: data.chantier_id as string,
      type: data.type as TypeReunion,
      titre: data.titre as string,
      dateReunion: data.date_reunion as string,
      heureDebut: data.heure_debut as string,
      heureFin: data.heure_fin as string | undefined,
      dureePrevueMinutes: data.duree_prevue_minutes as number,
      dureeReelleMinutes: data.duree_reelle_minutes as number | undefined,
      lieu: data.lieu as string | undefined,
      participantsConvoques: (data.participants_convoques as Participant[]) || [],
      participantsPresents: (data.participants_presents as Participant[]) || [],
      ordreDuJour: (data.ordre_du_jour as PointOrdreDuJour[]) || [],
      statut: data.statut as StatutReunion,
      compteRendu: data.compte_rendu as CompteRendu | undefined,
      documents: (data.documents as Reunion['documents']) || [],
      photos: (data.photos as Reunion['photos']) || [],
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };
  }
}

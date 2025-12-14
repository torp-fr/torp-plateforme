/**
 * TORP Phase 2 - Chantier Service
 * Gestion des chantiers et ordres de service
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  Chantier,
  ChantierConfig,
  OrdreService,
  CreateChantierInput,
  CreateOSInput,
  ChantierResume,
  ChantierAlerte,
  StatutChantier,
  StatutOrdreService,
} from '@/types/phase2';

export interface ChantierFilters {
  statut?: StatutChantier | StatutChantier[];
  projectId?: string;
  search?: string;
}

export class ChantierService {
  /**
   * Créer un nouveau chantier à partir d'un projet Phase 1
   */
  static async createChantier(input: CreateChantierInput): Promise<Chantier> {
    const { data, error } = await supabase
      .from('phase2_chantiers')
      .insert({
        project_id: input.projectId,
        contrat_id: input.contratId,
        nom: input.nom,
        reference: input.reference,
        date_debut_prevue: input.dateDebutPrevue,
        date_fin_prevue: input.dateFinPrevue,
        montant_marche_ht: input.montantMarcheHT,
        config: input.config || this.getDefaultConfig(),
        statut: 'preparation',
        avancement_global: 0,
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapToChantier(data);
  }

  /**
   * Configuration par défaut d'un chantier
   */
  static getDefaultConfig(): ChantierConfig {
    return {
      frequenceReunionChantier: 'hebdomadaire',
      jourReunionChantier: 'vendredi',
      heureReunionChantier: '09:00',
      frequenceRapportAvancement: 'hebdomadaire',
      alerteRetardJours: 3,
      alerteDepassementBudget: 10,
      participantsDefaut: [],
    };
  }

  /**
   * Récupérer un chantier par ID
   */
  static async getChantier(id: string): Promise<Chantier | null> {
    const { data, error } = await supabase
      .from('phase2_chantiers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return this.mapToChantier(data);
  }

  /**
   * Récupérer un chantier par projet
   */
  static async getChantierByProject(projectId: string): Promise<Chantier | null> {
    const { data, error } = await supabase
      .from('phase2_chantiers')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return this.mapToChantier(data);
  }

  /**
   * Lister les chantiers avec filtres
   */
  static async listChantiers(filters?: ChantierFilters): Promise<ChantierResume[]> {
    let query = supabase
      .from('phase2_chantiers')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.projectId) {
      query = query.eq('project_id', filters.projectId);
    }

    if (filters?.statut) {
      if (Array.isArray(filters.statut)) {
        query = query.in('statut', filters.statut);
      } else {
        query = query.eq('statut', filters.statut);
      }
    }

    if (filters?.search) {
      query = query.or(`nom.ilike.%${filters.search}%,reference.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(ch => this.mapToChantierResume(ch));
  }

  /**
   * Mettre à jour un chantier
   */
  static async updateChantier(id: string, updates: Partial<Chantier>): Promise<Chantier> {
    const dbUpdates: Record<string, unknown> = {};

    if (updates.nom !== undefined) dbUpdates.nom = updates.nom;
    if (updates.reference !== undefined) dbUpdates.reference = updates.reference;
    if (updates.dateDebutPrevue !== undefined) dbUpdates.date_debut_prevue = updates.dateDebutPrevue;
    if (updates.dateFinPrevue !== undefined) dbUpdates.date_fin_prevue = updates.dateFinPrevue;
    if (updates.dateDebutEffective !== undefined) dbUpdates.date_debut_effective = updates.dateDebutEffective;
    if (updates.dateFinEffective !== undefined) dbUpdates.date_fin_effective = updates.dateFinEffective;
    if (updates.statut !== undefined) dbUpdates.statut = updates.statut;
    if (updates.avancementGlobal !== undefined) dbUpdates.avancement_global = updates.avancementGlobal;
    if (updates.config !== undefined) dbUpdates.config = updates.config;
    if (updates.montantMarcheHT !== undefined) dbUpdates.montant_marche_ht = updates.montantMarcheHT;
    if (updates.montantTravauxSupHT !== undefined) dbUpdates.montant_travaux_sup_ht = updates.montantTravauxSupHT;

    dbUpdates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('phase2_chantiers')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToChantier(data);
  }

  /**
   * Changer le statut d'un chantier
   */
  static async changeStatut(id: string, nouveauStatut: StatutChantier): Promise<Chantier> {
    return this.updateChantier(id, { statut: nouveauStatut });
  }

  // ============================================
  // ORDRES DE SERVICE
  // ============================================

  /**
   * Créer un ordre de service
   */
  static async createOrdreService(input: CreateOSInput): Promise<OrdreService> {
    // Récupérer le prochain numéro
    const { data: existing } = await supabase
      .from('phase2_ordres_service')
      .select('numero')
      .eq('chantier_id', input.chantierId)
      .order('numero', { ascending: false })
      .limit(1);

    const nextNumero = existing && existing.length > 0 ? existing[0].numero + 1 : 1;

    const { data, error } = await supabase
      .from('phase2_ordres_service')
      .insert({
        chantier_id: input.chantierId,
        numero: nextNumero,
        type: input.type,
        objet: input.objet,
        description: input.description,
        date_emission: new Date().toISOString(),
        date_effet: input.dateEffet,
        impact_delai_jours: input.impactDelaiJours || 0,
        impact_financier_ht: input.impactFinancierHT || 0,
        emetteur: input.emetteur,
        destinataire: input.destinataire,
        statut: 'brouillon',
        documents: [],
      })
      .select()
      .single();

    if (error) throw error;

    // Si OS de démarrage, mettre à jour le chantier
    if (input.type === 'demarrage') {
      await this.updateChantier(input.chantierId, {
        dateOrdreService: input.dateEffet,
        statut: 'ordre_service',
      });
    }

    return this.mapToOrdreService(data);
  }

  /**
   * Récupérer les ordres de service d'un chantier
   */
  static async getOrdresService(chantierId: string): Promise<OrdreService[]> {
    const { data, error } = await supabase
      .from('phase2_ordres_service')
      .select('*')
      .eq('chantier_id', chantierId)
      .order('numero', { ascending: true });

    if (error) throw error;
    return (data || []).map(os => this.mapToOrdreService(os));
  }

  /**
   * Mettre à jour le statut d'un OS
   */
  static async updateOSStatut(
    osId: string,
    statut: StatutOrdreService,
    accuseReception?: { signataire: string; commentaire?: string }
  ): Promise<OrdreService> {
    const updates: Record<string, unknown> = {
      statut,
      updated_at: new Date().toISOString(),
    };

    if (accuseReception && statut === 'accuse_reception') {
      updates.accuse_reception = {
        date: new Date().toISOString(),
        signataire: accuseReception.signataire,
        commentaire: accuseReception.commentaire,
      };
      updates.date_reception = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('phase2_ordres_service')
      .update(updates)
      .eq('id', osId)
      .select()
      .single();

    if (error) throw error;
    return this.mapToOrdreService(data);
  }

  /**
   * Envoyer un OS (changement de statut + notification)
   */
  static async envoyerOS(osId: string): Promise<OrdreService> {
    return this.updateOSStatut(osId, 'envoye');
  }

  // ============================================
  // ALERTES
  // ============================================

  /**
   * Calculer les alertes d'un chantier
   */
  static async getAlertes(chantierId: string): Promise<ChantierAlerte[]> {
    const chantier = await this.getChantier(chantierId);
    if (!chantier) return [];

    const alertes: ChantierAlerte[] = [];
    const now = new Date();

    // Alerte retard
    if (chantier.dateFinPrevue) {
      const dateFin = new Date(chantier.dateFinPrevue);
      const joursRestants = Math.ceil((dateFin.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (joursRestants < 0) {
        alertes.push({
          type: 'retard',
          niveau: 'error',
          message: `Chantier en retard de ${Math.abs(joursRestants)} jours`,
          date: now.toISOString(),
        });
      } else if (joursRestants < (chantier.config?.alerteRetardJours || 7)) {
        alertes.push({
          type: 'retard',
          niveau: 'warning',
          message: `Date de fin prévue dans ${joursRestants} jours`,
          date: now.toISOString(),
        });
      }
    }

    // Alerte budget (si montant travaux sup dépasse le seuil)
    if (chantier.montantMarcheHT && chantier.montantTravauxSupHT) {
      const pourcentageDepassement = (chantier.montantTravauxSupHT / chantier.montantMarcheHT) * 100;
      const seuil = chantier.config?.alerteDepassementBudget || 10;

      if (pourcentageDepassement > seuil) {
        alertes.push({
          type: 'budget',
          niveau: pourcentageDepassement > seuil * 2 ? 'error' : 'warning',
          message: `Travaux supplémentaires: ${pourcentageDepassement.toFixed(1)}% du marché initial`,
          date: now.toISOString(),
        });
      }
    }

    return alertes;
  }

  // ============================================
  // MAPPERS
  // ============================================

  private static mapToChantier(data: Record<string, unknown>): Chantier {
    return {
      id: data.id as string,
      projectId: data.project_id as string,
      contratId: data.contrat_id as string | undefined,
      reference: data.reference as string | undefined,
      nom: data.nom as string,
      dateNotification: data.date_notification as string | undefined,
      dateOrdreService: data.date_ordre_service as string | undefined,
      dateDebutPrevue: data.date_debut_prevue as string | undefined,
      dateFinPrevue: data.date_fin_prevue as string | undefined,
      dateDebutEffective: data.date_debut_effective as string | undefined,
      dateFinEffective: data.date_fin_effective as string | undefined,
      dureeMarcheJours: data.duree_marche_jours as number | undefined,
      delaiExecutionJours: data.delai_execution_jours as number | undefined,
      montantMarcheHT: data.montant_marche_ht as number | undefined,
      montantTravauxSupHT: data.montant_travaux_sup_ht as number | undefined,
      montantTotalHT: data.montant_total_ht as number | undefined,
      statut: data.statut as StatutChantier,
      avancementGlobal: (data.avancement_global as number) || 0,
      config: data.config as ChantierConfig | undefined,
      metadata: data.metadata as Record<string, unknown> | undefined,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };
  }

  private static mapToChantierResume(data: Record<string, unknown>): ChantierResume {
    return {
      id: data.id as string,
      nom: data.nom as string,
      reference: data.reference as string | undefined,
      statut: data.statut as StatutChantier,
      avancementGlobal: (data.avancement_global as number) || 0,
      dateDebutPrevue: data.date_debut_prevue as string | undefined,
      dateFinPrevue: data.date_fin_prevue as string | undefined,
      montantTotalHT: data.montant_total_ht as number | undefined,
      alertes: [], // Sera calculé séparément si nécessaire
    };
  }

  private static mapToOrdreService(data: Record<string, unknown>): OrdreService {
    return {
      id: data.id as string,
      chantierId: data.chantier_id as string,
      numero: data.numero as number,
      reference: data.reference as string | undefined,
      type: data.type as OrdreService['type'],
      objet: data.objet as string,
      description: data.description as string | undefined,
      dateEmission: data.date_emission as string,
      dateEffet: data.date_effet as string,
      dateReception: data.date_reception as string | undefined,
      impactDelaiJours: (data.impact_delai_jours as number) || 0,
      nouvelleDateFin: data.nouvelle_date_fin as string | undefined,
      impactFinancierHT: (data.impact_financier_ht as number) || 0,
      statut: data.statut as StatutOrdreService,
      emetteur: data.emetteur as OrdreService['emetteur'],
      destinataire: data.destinataire as OrdreService['destinataire'],
      accuseReception: data.accuse_reception as OrdreService['accuseReception'],
      documents: (data.documents as OrdreService['documents']) || [],
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };
  }
}

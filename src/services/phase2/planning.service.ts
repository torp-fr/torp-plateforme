/**
 * TORP Phase 2 - Planning Service
 * Gestion du planning d'exécution (WBS, Gantt, dépendances)
 */

import { supabase } from '@/lib/supabase';
import type {
  PlanningLot,
  PlanningTache,
  TacheDependance,
  GanttTask,
  CheminCritique,
  SimulationRetard,
  CreateLotInput,
  CreateTacheInput,
  CreateDependanceInput,
  UpdateAvancementInput,
  StatutTache,
  TypeDependance,
  PlanningExport,
} from '@/types/phase2';

export interface PlanningStats {
  nombreLots: number;
  nombreTaches: number;
  avancementGlobal: number;
  tachesEnRetard: number;
  tachesAVenir: number;
  tachesEnCours: number;
  tachesTerminees: number;
}

export class PlanningService {
  // ============================================
  // LOTS
  // ============================================

  /**
   * Créer un lot de planning
   */
  static async createLot(input: CreateLotInput): Promise<PlanningLot> {
    // Récupérer le prochain ordre
    const { data: existing } = await supabase
      .from('phase2_planning_lots')
      .select('ordre')
      .eq('chantier_id', input.chantierId)
      .order('ordre', { ascending: false })
      .limit(1);

    const nextOrdre = existing && existing.length > 0 ? existing[0].ordre + 1 : 1;

    const { data, error } = await supabase
      .from('phase2_planning_lots')
      .insert({
        chantier_id: input.chantierId,
        code: input.code,
        nom: input.nom,
        entreprise_id: input.entrepriseId,
        entreprise_nom: input.entrepriseNom,
        ordre: nextOrdre,
        couleur: input.couleur || this.generateColor(nextOrdre),
        montant_ht: input.montantHT,
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapToLot(data);
  }

  /**
   * Récupérer les lots d'un chantier
   */
  static async getLots(chantierId: string): Promise<PlanningLot[]> {
    const { data, error } = await supabase
      .from('phase2_planning_lots')
      .select('*')
      .eq('chantier_id', chantierId)
      .order('ordre', { ascending: true });

    if (error) throw error;
    return (data || []).map(l => this.mapToLot(l));
  }

  /**
   * Mettre à jour un lot
   */
  static async updateLot(id: string, updates: Partial<PlanningLot>): Promise<PlanningLot> {
    const dbUpdates: Record<string, unknown> = {};

    if (updates.code !== undefined) dbUpdates.code = updates.code;
    if (updates.nom !== undefined) dbUpdates.nom = updates.nom;
    if (updates.entrepriseId !== undefined) dbUpdates.entreprise_id = updates.entrepriseId;
    if (updates.entrepriseNom !== undefined) dbUpdates.entreprise_nom = updates.entrepriseNom;
    if (updates.couleur !== undefined) dbUpdates.couleur = updates.couleur;
    if (updates.montantHT !== undefined) dbUpdates.montant_ht = updates.montantHT;

    dbUpdates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('phase2_planning_lots')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToLot(data);
  }

  /**
   * Supprimer un lot (et ses tâches)
   */
  static async deleteLot(id: string): Promise<void> {
    // Les tâches sont supprimées en cascade par la FK
    const { error } = await supabase
      .from('phase2_planning_lots')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // ============================================
  // TÂCHES
  // ============================================

  /**
   * Créer une tâche
   */
  static async createTache(input: CreateTacheInput): Promise<PlanningTache> {
    // Récupérer le prochain ordre dans le lot
    const { data: existing } = await supabase
      .from('phase2_planning_taches')
      .select('ordre')
      .eq('lot_id', input.lotId)
      .order('ordre', { ascending: false })
      .limit(1);

    const nextOrdre = existing && existing.length > 0 ? existing[0].ordre + 1 : 1;

    // Calculer la date de fin
    const dateDebut = new Date(input.dateDebutPrevue);
    const dateFin = new Date(dateDebut);
    dateFin.setDate(dateFin.getDate() + input.dureeJours - 1);

    const { data, error } = await supabase
      .from('phase2_planning_taches')
      .insert({
        lot_id: input.lotId,
        parent_id: input.parentId,
        code: input.code,
        nom: input.nom,
        description: input.description,
        ordre: nextOrdre,
        niveau: input.niveau || 0,
        date_debut_prevue: input.dateDebutPrevue,
        date_fin_prevue: dateFin.toISOString().split('T')[0],
        duree_jours: input.dureeJours,
        ressources: input.ressources || [],
        contrainte_type: input.contrainteType,
        contrainte_date: input.contrainteDate,
        statut: 'non_commence',
        avancement: 0,
        est_jalon: input.estJalon || false,
        est_resumee: input.estResumee || false,
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapToTache(data);
  }

  /**
   * Récupérer les tâches d'un lot
   */
  static async getTachesByLot(lotId: string): Promise<PlanningTache[]> {
    const { data, error } = await supabase
      .from('phase2_planning_taches')
      .select('*')
      .eq('lot_id', lotId)
      .order('ordre', { ascending: true });

    if (error) throw error;
    return (data || []).map(t => this.mapToTache(t));
  }

  /**
   * Récupérer toutes les tâches d'un chantier
   */
  static async getTachesByChantier(chantierId: string): Promise<PlanningTache[]> {
    // Récupérer d'abord les lots
    const lots = await this.getLots(chantierId);
    const lotIds = lots.map(l => l.id);

    if (lotIds.length === 0) return [];

    const { data, error } = await supabase
      .from('phase2_planning_taches')
      .select('*')
      .in('lot_id', lotIds)
      .order('ordre', { ascending: true });

    if (error) throw error;
    return (data || []).map(t => this.mapToTache(t));
  }

  /**
   * Mettre à jour une tâche
   */
  static async updateTache(id: string, updates: Partial<PlanningTache>): Promise<PlanningTache> {
    const dbUpdates: Record<string, unknown> = {};

    if (updates.code !== undefined) dbUpdates.code = updates.code;
    if (updates.nom !== undefined) dbUpdates.nom = updates.nom;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.dateDebutPrevue !== undefined) dbUpdates.date_debut_prevue = updates.dateDebutPrevue;
    if (updates.dateFinPrevue !== undefined) dbUpdates.date_fin_prevue = updates.dateFinPrevue;
    if (updates.dateDebutReelle !== undefined) dbUpdates.date_debut_reelle = updates.dateDebutReelle;
    if (updates.dateFinReelle !== undefined) dbUpdates.date_fin_reelle = updates.dateFinReelle;
    if (updates.dureeJours !== undefined) dbUpdates.duree_jours = updates.dureeJours;
    if (updates.statut !== undefined) dbUpdates.statut = updates.statut;
    if (updates.avancement !== undefined) dbUpdates.avancement = updates.avancement;
    if (updates.ressources !== undefined) dbUpdates.ressources = updates.ressources;

    dbUpdates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('phase2_planning_taches')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToTache(data);
  }

  /**
   * Mettre à jour l'avancement d'une tâche
   */
  static async updateAvancement(input: UpdateAvancementInput): Promise<PlanningTache> {
    const updates: Partial<PlanningTache> = {
      avancement: input.avancement,
    };

    // Déterminer le statut automatiquement
    if (input.avancement === 0) {
      updates.statut = 'non_commence';
    } else if (input.avancement === 100) {
      updates.statut = 'terminee';
      updates.dateFinReelle = new Date().toISOString().split('T')[0];
    } else {
      updates.statut = 'en_cours';
      // Si c'est le premier avancement, marquer la date de début
      const tache = await this.getTache(input.tacheId);
      if (tache && !tache.dateDebutReelle) {
        updates.dateDebutReelle = new Date().toISOString().split('T')[0];
      }
    }

    return this.updateTache(input.tacheId, updates);
  }

  /**
   * Récupérer une tâche par ID
   */
  static async getTache(id: string): Promise<PlanningTache | null> {
    const { data, error } = await supabase
      .from('phase2_planning_taches')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return this.mapToTache(data);
  }

  /**
   * Supprimer une tâche
   */
  static async deleteTache(id: string): Promise<void> {
    const { error } = await supabase
      .from('phase2_planning_taches')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // ============================================
  // DÉPENDANCES
  // ============================================

  /**
   * Créer une dépendance entre tâches
   */
  static async createDependance(input: CreateDependanceInput): Promise<TacheDependance> {
    const { data, error } = await supabase
      .from('phase2_planning_dependances')
      .insert({
        tache_source_id: input.tacheSourceId,
        tache_cible_id: input.tacheCibleId,
        type: input.type,
        decalage_jours: input.decalageJours || 0,
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapToDependance(data);
  }

  /**
   * Récupérer les dépendances d'un chantier
   */
  static async getDependances(chantierId: string): Promise<TacheDependance[]> {
    const taches = await this.getTachesByChantier(chantierId);
    const tacheIds = taches.map(t => t.id);

    if (tacheIds.length === 0) return [];

    const { data, error } = await supabase
      .from('phase2_planning_dependances')
      .select('*')
      .in('tache_source_id', tacheIds);

    if (error) throw error;
    return (data || []).map(d => this.mapToDependance(d));
  }

  /**
   * Supprimer une dépendance
   */
  static async deleteDependance(id: string): Promise<void> {
    const { error } = await supabase
      .from('phase2_planning_dependances')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // ============================================
  // GANTT & ANALYSE
  // ============================================

  /**
   * Générer les données pour le diagramme de Gantt
   */
  static async getGanttData(chantierId: string): Promise<GanttTask[]> {
    const lots = await this.getLots(chantierId);
    const taches = await this.getTachesByChantier(chantierId);
    const dependances = await this.getDependances(chantierId);

    const ganttTasks: GanttTask[] = [];

    // Ajouter les lots comme tâches résumées
    for (const lot of lots) {
      const lotTaches = taches.filter(t => t.lotId === lot.id);
      const startDate = lotTaches.length > 0
        ? lotTaches.reduce((min, t) => t.dateDebutPrevue < min ? t.dateDebutPrevue : min, lotTaches[0].dateDebutPrevue)
        : new Date().toISOString().split('T')[0];
      const endDate = lotTaches.length > 0
        ? lotTaches.reduce((max, t) => t.dateFinPrevue > max ? t.dateFinPrevue : max, lotTaches[0].dateFinPrevue)
        : new Date().toISOString().split('T')[0];
      const avancement = lotTaches.length > 0
        ? lotTaches.reduce((sum, t) => sum + t.avancement, 0) / lotTaches.length
        : 0;

      ganttTasks.push({
        id: lot.id,
        nom: `${lot.code} - ${lot.nom}`,
        dateDebut: startDate,
        dateFin: endDate,
        avancement: Math.round(avancement),
        couleur: lot.couleur,
        estResume: true,
        niveau: 0,
        dependances: [],
      });

      // Ajouter les tâches du lot
      for (const tache of lotTaches) {
        const tacheDeps = dependances
          .filter(d => d.tacheCibleId === tache.id)
          .map(d => d.tacheSourceId);

        ganttTasks.push({
          id: tache.id,
          nom: tache.nom,
          parentId: lot.id,
          dateDebut: tache.dateDebutPrevue,
          dateFin: tache.dateFinPrevue,
          avancement: tache.avancement,
          couleur: lot.couleur,
          estJalon: tache.estJalon,
          estResume: tache.estResumee,
          niveau: tache.niveau + 1,
          dependances: tacheDeps,
          ressources: tache.ressources,
          statut: tache.statut,
        });
      }
    }

    return ganttTasks;
  }

  /**
   * Calculer le chemin critique avec l'algorithme PERT complet
   * Calcule les dates au plus tôt (ES/EF), au plus tard (LS/LF) et les marges
   */
  static async calculerCheminCritique(chantierId: string): Promise<CheminCritique> {
    const taches = await this.getTachesByChantier(chantierId);
    const dependances = await this.getDependances(chantierId);

    if (taches.length === 0) {
      return {
        tacheIds: [],
        dureeTotaleJours: 0,
        dateDebut: new Date().toISOString().split('T')[0],
        dateFin: new Date().toISOString().split('T')[0],
      };
    }

    // Structure PERT pour chaque tâche
    interface PertNode {
      id: string;
      duree: number;
      predecesseurs: string[];
      successeurs: string[];
      ES: number; // Early Start
      EF: number; // Early Finish
      LS: number; // Late Start
      LF: number; // Late Finish
      marge: number; // Total Float
    }

    // Initialiser les nœuds PERT
    const nodes: Map<string, PertNode> = new Map();
    const dateRef = new Date(
      taches.reduce((min, t) => t.dateDebutPrevue < min ? t.dateDebutPrevue : min, taches[0].dateDebutPrevue)
    );

    for (const tache of taches) {
      const startDate = new Date(tache.dateDebutPrevue);
      const esJours = Math.floor((startDate.getTime() - dateRef.getTime()) / (1000 * 60 * 60 * 24));

      nodes.set(tache.id, {
        id: tache.id,
        duree: tache.dureeJours,
        predecesseurs: [],
        successeurs: [],
        ES: esJours,
        EF: esJours + tache.dureeJours,
        LS: 0,
        LF: 0,
        marge: 0,
      });
    }

    // Construire le graphe des dépendances
    for (const dep of dependances) {
      const source = nodes.get(dep.tacheSourceId);
      const cible = nodes.get(dep.tacheCibleId);

      if (source && cible) {
        source.successeurs.push(dep.tacheCibleId);
        cible.predecesseurs.push(dep.tacheSourceId);
      }
    }

    // PASSE AVANT : Calcul des dates au plus tôt (ES/EF)
    // Tri topologique des tâches
    const sortedNodes = this.triTopologique(nodes);

    for (const nodeId of sortedNodes) {
      const node = nodes.get(nodeId)!;

      if (node.predecesseurs.length > 0) {
        // ES = max(EF de tous les prédécesseurs) + décalage
        let maxEF = 0;
        for (const predId of node.predecesseurs) {
          const pred = nodes.get(predId);
          if (pred) {
            // Trouver le décalage pour cette dépendance
            const dep = dependances.find(d => d.tacheSourceId === predId && d.tacheCibleId === nodeId);
            const decalage = dep?.decalageJours || 0;
            maxEF = Math.max(maxEF, pred.EF + decalage);
          }
        }
        node.ES = maxEF;
      }
      node.EF = node.ES + node.duree;
    }

    // Date de fin du projet (EF maximum)
    let projectEF = 0;
    for (const node of nodes.values()) {
      projectEF = Math.max(projectEF, node.EF);
    }

    // PASSE ARRIÈRE : Calcul des dates au plus tard (LS/LF)
    // Initialiser LF pour les tâches sans successeurs
    for (const node of nodes.values()) {
      if (node.successeurs.length === 0) {
        node.LF = projectEF;
        node.LS = node.LF - node.duree;
      }
    }

    // Parcours inverse
    const reverseSorted = [...sortedNodes].reverse();
    for (const nodeId of reverseSorted) {
      const node = nodes.get(nodeId)!;

      if (node.successeurs.length > 0) {
        // LF = min(LS de tous les successeurs) - décalage
        let minLS = Infinity;
        for (const succId of node.successeurs) {
          const succ = nodes.get(succId);
          if (succ) {
            const dep = dependances.find(d => d.tacheSourceId === nodeId && d.tacheCibleId === succId);
            const decalage = dep?.decalageJours || 0;
            minLS = Math.min(minLS, succ.LS - decalage);
          }
        }
        node.LF = minLS;
        node.LS = node.LF - node.duree;
      }

      // Calcul de la marge totale
      node.marge = node.LS - node.ES;
    }

    // Identifier les tâches critiques (marge = 0)
    const tachesCritiques: string[] = [];
    for (const node of nodes.values()) {
      if (node.marge === 0) {
        tachesCritiques.push(node.id);
      }
    }

    // Calculer les dates réelles
    const dateDebut = dateRef.toISOString().split('T')[0];
    const dateFinProjet = new Date(dateRef);
    dateFinProjet.setDate(dateFinProjet.getDate() + projectEF);
    const dateFin = dateFinProjet.toISOString().split('T')[0];

    return {
      tacheIds: tachesCritiques,
      dureeTotaleJours: projectEF,
      dateDebut,
      dateFin,
    };
  }

  /**
   * Tri topologique des tâches (algorithme de Kahn)
   */
  private static triTopologique(nodes: Map<string, { predecesseurs: string[]; successeurs: string[] }>): string[] {
    const inDegree = new Map<string, number>();
    const queue: string[] = [];
    const result: string[] = [];

    // Calculer le degré entrant de chaque nœud
    for (const [id, node] of nodes) {
      inDegree.set(id, node.predecesseurs.length);
      if (node.predecesseurs.length === 0) {
        queue.push(id);
      }
    }

    // Parcourir le graphe
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      result.push(nodeId);

      const node = nodes.get(nodeId);
      if (node) {
        for (const succId of node.successeurs) {
          const degree = (inDegree.get(succId) || 0) - 1;
          inDegree.set(succId, degree);
          if (degree === 0) {
            queue.push(succId);
          }
        }
      }
    }

    // Si toutes les tâches n'ont pas été traitées, il y a un cycle
    if (result.length !== nodes.size) {
      console.warn('[PlanningService] Cycle détecté dans les dépendances');
      // Retourner toutes les tâches dans un ordre quelconque
      return [...nodes.keys()];
    }

    return result;
  }

  /**
   * Calculer les marges de chaque tâche (PERT avancé)
   */
  static async calculerMarges(chantierId: string): Promise<Map<string, { margeTotale: number; margeLibre: number }>> {
    const taches = await this.getTachesByChantier(chantierId);
    const dependances = await this.getDependances(chantierId);
    const marges = new Map<string, { margeTotale: number; margeLibre: number }>();

    // Calculer le chemin critique pour obtenir les dates
    const cheminCritique = await this.calculerCheminCritique(chantierId);

    // Pour chaque tâche, calculer les marges
    const dateRef = new Date(cheminCritique.dateDebut);

    for (const tache of taches) {
      const startDate = new Date(tache.dateDebutPrevue);
      const endDate = new Date(tache.dateFinPrevue);

      // Trouver les successeurs de cette tâche
      const successeursDeps = dependances.filter(d => d.tacheSourceId === tache.id);

      // Marge libre = min(ES successeurs) - EF de la tâche
      let margeLibre = Infinity;
      if (successeursDeps.length === 0) {
        // Pas de successeur : marge libre jusqu'à la fin du projet
        const projectEnd = new Date(cheminCritique.dateFin);
        margeLibre = Math.floor((projectEnd.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
      } else {
        for (const dep of successeursDeps) {
          const successeur = taches.find(t => t.id === dep.tacheCibleId);
          if (successeur) {
            const succStart = new Date(successeur.dateDebutPrevue);
            const ecart = Math.floor((succStart.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24)) - dep.decalageJours;
            margeLibre = Math.min(margeLibre, ecart);
          }
        }
      }

      // Marge totale = date au plus tard - date prévue
      // Pour simplifier, on utilise la marge libre comme approximation
      const margeTotale = cheminCritique.tacheIds.includes(tache.id) ? 0 : margeLibre;

      marges.set(tache.id, {
        margeTotale: Math.max(0, margeTotale),
        margeLibre: Math.max(0, margeLibre === Infinity ? 0 : margeLibre),
      });
    }

    return marges;
  }

  /**
   * Recalculer automatiquement les dates en cascade (propagation PERT)
   */
  static async recalculerDatesEnCascade(chantierId: string, tacheModifieeId: string, nouveauDecalage: number): Promise<void> {
    const taches = await this.getTachesByChantier(chantierId);
    const dependances = await this.getDependances(chantierId);

    // Trouver toutes les tâches impactées (successeurs directs et indirects)
    const tachesAMettreAJour: Set<string> = new Set();
    const queue = [tacheModifieeId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const successeursDeps = dependances.filter(d => d.tacheSourceId === currentId);

      for (const dep of successeursDeps) {
        if (!tachesAMettreAJour.has(dep.tacheCibleId)) {
          tachesAMettreAJour.add(dep.tacheCibleId);
          queue.push(dep.tacheCibleId);
        }
      }
    }

    // Mettre à jour les dates de chaque tâche impactée
    for (const tacheId of tachesAMettreAJour) {
      const tache = taches.find(t => t.id === tacheId);
      if (!tache) continue;

      // Trouver la nouvelle date de début (max des EF des prédécesseurs)
      const predecesseursDeps = dependances.filter(d => d.tacheCibleId === tacheId);
      let nouvelleDateDebut = new Date(tache.dateDebutPrevue);

      for (const dep of predecesseursDeps) {
        const pred = taches.find(t => t.id === dep.tacheSourceId);
        if (pred) {
          const predFin = new Date(pred.dateFinPrevue);
          predFin.setDate(predFin.getDate() + dep.decalageJours + 1);
          if (predFin > nouvelleDateDebut) {
            nouvelleDateDebut = predFin;
          }
        }
      }

      // Calculer la nouvelle date de fin
      const nouvelleDateFin = new Date(nouvelleDateDebut);
      nouvelleDateFin.setDate(nouvelleDateFin.getDate() + tache.dureeJours - 1);

      // Mettre à jour en base
      await supabase
        .from('phase2_planning_taches')
        .update({
          date_debut_prevue: nouvelleDateDebut.toISOString().split('T')[0],
          date_fin_prevue: nouvelleDateFin.toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        })
        .eq('id', tacheId);
    }
  }

  /**
   * Simuler un retard sur une tâche
   */
  static async simulerRetard(tacheId: string, joursRetard: number): Promise<SimulationRetard> {
    const tache = await this.getTache(tacheId);
    if (!tache) throw new Error('Tâche non trouvée');

    // Récupérer le lot pour avoir le chantierId
    const { data: lot } = await supabase
      .from('phase2_planning_lots')
      .select('chantier_id')
      .eq('id', tache.lotId)
      .single();

    if (!lot) throw new Error('Lot non trouvé');

    const dependances = await this.getDependances(lot.chantier_id);
    const taches = await this.getTachesByChantier(lot.chantier_id);

    // Trouver les tâches dépendantes (successeurs)
    const tachesImpactees: string[] = [];
    const queue = [tacheId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const successeurs = dependances
        .filter(d => d.tacheSourceId === currentId)
        .map(d => d.tacheCibleId);

      for (const succ of successeurs) {
        if (!tachesImpactees.includes(succ)) {
          tachesImpactees.push(succ);
          queue.push(succ);
        }
      }
    }

    // Calculer l'impact sur la date de fin
    const nouvelleDateFin = new Date(tache.dateFinPrevue);
    nouvelleDateFin.setDate(nouvelleDateFin.getDate() + joursRetard);

    return {
      tacheId,
      joursRetard,
      nouvelleDateFin: nouvelleDateFin.toISOString().split('T')[0],
      tachesImpactees,
      impactDateFinProjet: joursRetard, // Simplifié
    };
  }

  /**
   * Calculer les statistiques du planning
   */
  static async getStats(chantierId: string): Promise<PlanningStats> {
    const lots = await this.getLots(chantierId);
    const taches = await this.getTachesByChantier(chantierId);

    const today = new Date().toISOString().split('T')[0];

    let tachesEnRetard = 0;
    let tachesAVenir = 0;
    let tachesEnCours = 0;
    let tachesTerminees = 0;
    let totalAvancement = 0;

    for (const tache of taches) {
      totalAvancement += tache.avancement;

      switch (tache.statut) {
        case 'terminee':
          tachesTerminees++;
          break;
        case 'en_cours':
          tachesEnCours++;
          if (tache.dateFinPrevue < today) {
            tachesEnRetard++;
          }
          break;
        case 'non_commence':
          if (tache.dateDebutPrevue < today) {
            tachesEnRetard++;
          } else {
            tachesAVenir++;
          }
          break;
        case 'en_retard':
          tachesEnRetard++;
          break;
        case 'suspendue':
          // Ne pas compter
          break;
      }
    }

    return {
      nombreLots: lots.length,
      nombreTaches: taches.length,
      avancementGlobal: taches.length > 0 ? Math.round(totalAvancement / taches.length) : 0,
      tachesEnRetard,
      tachesAVenir,
      tachesEnCours,
      tachesTerminees,
    };
  }

  /**
   * Exporter le planning
   */
  static async exportPlanning(chantierId: string): Promise<PlanningExport> {
    const lots = await this.getLots(chantierId);
    const taches = await this.getTachesByChantier(chantierId);
    const dependances = await this.getDependances(chantierId);
    const cheminCritique = await this.calculerCheminCritique(chantierId);

    return {
      chantierId,
      dateExport: new Date().toISOString(),
      lots,
      taches,
      dependances,
      cheminCritique,
    };
  }

  // ============================================
  // HELPERS
  // ============================================

  private static generateColor(index: number): string {
    const colors = [
      '#4F46E5', // indigo
      '#10B981', // emerald
      '#F59E0B', // amber
      '#EF4444', // red
      '#8B5CF6', // violet
      '#06B6D4', // cyan
      '#F97316', // orange
      '#EC4899', // pink
      '#84CC16', // lime
      '#6366F1', // indigo
    ];
    return colors[(index - 1) % colors.length];
  }

  // ============================================
  // MAPPERS
  // ============================================

  private static mapToLot(data: Record<string, unknown>): PlanningLot {
    return {
      id: data.id as string,
      chantierId: data.chantier_id as string,
      code: data.code as string,
      nom: data.nom as string,
      entrepriseId: data.entreprise_id as string | undefined,
      entrepriseNom: data.entreprise_nom as string | undefined,
      ordre: data.ordre as number,
      couleur: data.couleur as string,
      montantHT: data.montant_ht as number | undefined,
      avancementGlobal: (data.avancement_global as number) || 0,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };
  }

  private static mapToTache(data: Record<string, unknown>): PlanningTache {
    return {
      id: data.id as string,
      lotId: data.lot_id as string,
      parentId: data.parent_id as string | undefined,
      code: data.code as string | undefined,
      nom: data.nom as string,
      description: data.description as string | undefined,
      ordre: data.ordre as number,
      niveau: data.niveau as number,
      dateDebutPrevue: data.date_debut_prevue as string,
      dateFinPrevue: data.date_fin_prevue as string,
      dateDebutReelle: data.date_debut_reelle as string | undefined,
      dateFinReelle: data.date_fin_reelle as string | undefined,
      dureeJours: data.duree_jours as number,
      statut: data.statut as StatutTache,
      avancement: (data.avancement as number) || 0,
      ressources: (data.ressources as PlanningTache['ressources']) || [],
      contrainteType: data.contrainte_type as PlanningTache['contrainteType'],
      contrainteDate: data.contrainte_date as string | undefined,
      estJalon: data.est_jalon as boolean,
      estResumee: data.est_resumee as boolean,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };
  }

  private static mapToDependance(data: Record<string, unknown>): TacheDependance {
    return {
      id: data.id as string,
      tacheSourceId: data.tache_source_id as string,
      tacheCibleId: data.tache_cible_id as string,
      type: data.type as TypeDependance,
      decalageJours: (data.decalage_jours as number) || 0,
    };
  }
}

/**
 * CarnetService - Service Phase 5
 * Gestion du carnet numérique du logement
 */

import { supabase } from '@/lib/supabase';
import type {
  CarnetNumerique,
  TravauxHistorique,
  DiagnosticCarnet,
  EntretienProgramme,
  GarantieActive,
  Sinistre,
  DocumentCarnet,
  Phase5Stats,
} from '@/types/phase5';

class CarnetNumeriqueTService {
  /**
   * Récupérer le carnet numérique d'un projet/bien
   */
  async getCarnet(projectId: string): Promise<CarnetNumerique | null> {
    const { data, error } = await supabase
      .from('carnets_numeriques')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Erreur récupération carnet:', error);
      throw error;
    }

    return data;
  }

  /**
   * Créer ou mettre à jour le carnet
   */
  async upsertCarnet(projectId: string, carnet: Partial<CarnetNumerique>): Promise<CarnetNumerique> {
    const { data, error } = await supabase
      .from('carnets_numeriques')
      .upsert({
        project_id: projectId,
        ...carnet,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ==========================================================================
  // TRAVAUX HISTORIQUE
  // ==========================================================================

  async getTravauxHistorique(projectId: string): Promise<TravauxHistorique[]> {
    const { data, error } = await supabase
      .from('travaux_historique')
      .select('*')
      .eq('project_id', projectId)
      .order('date_realisation', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async addTravaux(projectId: string, travaux: Omit<TravauxHistorique, 'id'>): Promise<TravauxHistorique> {
    const { data, error } = await supabase
      .from('travaux_historique')
      .insert({ project_id: projectId, ...travaux })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ==========================================================================
  // DIAGNOSTICS
  // ==========================================================================

  async getDiagnostics(projectId: string): Promise<DiagnosticCarnet[]> {
    const { data, error } = await supabase
      .from('diagnostics_carnet')
      .select('*')
      .eq('project_id', projectId)
      .order('date_validite', { ascending: true });

    if (error) throw error;

    // Mettre à jour le statut en fonction des dates
    const now = new Date();
    return (data || []).map(d => ({
      ...d,
      statut: new Date(d.date_validite) < now
        ? 'expire'
        : new Date(d.date_validite) < new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
          ? 'a_renouveler'
          : 'valide',
    }));
  }

  async addDiagnostic(projectId: string, diagnostic: Omit<DiagnosticCarnet, 'id' | 'statut'>): Promise<DiagnosticCarnet> {
    const { data, error } = await supabase
      .from('diagnostics_carnet')
      .insert({ project_id: projectId, ...diagnostic })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ==========================================================================
  // ENTRETIENS
  // ==========================================================================

  async getEntretiens(projectId: string): Promise<EntretienProgramme[]> {
    const { data, error } = await supabase
      .from('entretiens_programmes')
      .select('*')
      .eq('project_id', projectId)
      .order('prochaine_echeance', { ascending: true });

    if (error) throw error;

    // Mettre à jour le statut
    const now = new Date();
    return (data || []).map(e => ({
      ...e,
      statut: e.statut === 'realise'
        ? 'realise'
        : new Date(e.prochaine_echeance) < now
          ? 'en_retard'
          : e.statut,
    }));
  }

  async addEntretien(projectId: string, entretien: Omit<EntretienProgramme, 'id' | 'statut'>): Promise<EntretienProgramme> {
    const { data, error } = await supabase
      .from('entretiens_programmes')
      .insert({
        project_id: projectId,
        ...entretien,
        statut: 'a_faire',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async marquerEntretienRealise(entretienId: string): Promise<EntretienProgramme> {
    const { data, error } = await supabase
      .from('entretiens_programmes')
      .update({
        statut: 'realise',
        derniere_realisation: new Date().toISOString(),
      })
      .eq('id', entretienId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateEntretien(entretienId: string, updates: Partial<EntretienProgramme>): Promise<EntretienProgramme> {
    const { data, error } = await supabase
      .from('entretiens_programmes')
      .update(updates)
      .eq('id', entretienId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ==========================================================================
  // GARANTIES
  // ==========================================================================

  async getGaranties(projectId: string): Promise<GarantieActive[]> {
    const { data, error } = await supabase
      .from('garanties_actives')
      .select('*')
      .eq('project_id', projectId)
      .order('date_fin', { ascending: true });

    if (error) throw error;

    const now = new Date();
    return (data || []).map(g => ({
      ...g,
      statut: new Date(g.date_fin) < now ? 'expiree' : 'active',
    }));
  }

  async addGarantie(projectId: string, garantie: Omit<GarantieActive, 'id' | 'statut'>): Promise<GarantieActive> {
    const { data, error } = await supabase
      .from('garanties_actives')
      .insert({ project_id: projectId, ...garantie })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ==========================================================================
  // SINISTRES
  // ==========================================================================

  async getSinistres(projectId: string): Promise<Sinistre[]> {
    const { data, error } = await supabase
      .from('sinistres')
      .select('*')
      .eq('project_id', projectId)
      .order('date_declaration', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async declarerSinistre(projectId: string, sinistre: Omit<Sinistre, 'id'>): Promise<Sinistre> {
    const { data, error } = await supabase
      .from('sinistres')
      .insert({
        project_id: projectId,
        ...sinistre,
        statut: 'declare',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateSinistreStatut(sinistreId: string, statut: Sinistre['statut']): Promise<Sinistre> {
    const { data, error } = await supabase
      .from('sinistres')
      .update({ statut })
      .eq('id', sinistreId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ==========================================================================
  // DOCUMENTS
  // ==========================================================================

  async getDocuments(projectId: string): Promise<DocumentCarnet[]> {
    const { data, error } = await supabase
      .from('documents_carnet')
      .select('*')
      .eq('project_id', projectId)
      .order('date_ajout', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async addDocument(projectId: string, document: Omit<DocumentCarnet, 'id' | 'date_ajout'>): Promise<DocumentCarnet> {
    const { data, error } = await supabase
      .from('documents_carnet')
      .insert({
        project_id: projectId,
        ...document,
        date_ajout: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ==========================================================================
  // STATS
  // ==========================================================================

  async getStats(projectId: string): Promise<Phase5Stats> {
    const [garanties, diagnostics, entretiens, sinistres] = await Promise.all([
      this.getGaranties(projectId),
      this.getDiagnostics(projectId),
      this.getEntretiens(projectId),
      this.getSinistres(projectId),
    ]);

    const garantiesActives = garanties.filter(g => g.statut === 'active').length;
    const diagnosticsARenouveler = diagnostics.filter(d => d.statut === 'a_renouveler' || d.statut === 'expire').length;
    const entretiensEnRetard = entretiens.filter(e => e.statut === 'en_retard').length;
    const sinistresEnCours = sinistres.filter(s => !['clos', 'refuse'].includes(s.statut)).length;

    const prochainEntretien = entretiens.find(e => e.statut !== 'realise');
    const prochainDiagnostic = diagnostics.find(d => d.statut === 'a_renouveler');

    return {
      garantiesActives,
      diagnosticsARenouveler,
      entretiensEnRetard,
      sinistresEnCours,
      prochainEntretien,
      prochainDiagnostic,
    };
  }
}

export const carnetService = new CarnetNumeriqueTService();
export default carnetService;

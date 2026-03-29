import type { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './BaseRepository.js';

export interface Projet extends Record<string, unknown> {
  id: string;
  client_id: string;
  entreprise_id: string;
  type: string;
  description: string | null;
  tags: string[] | null;
  localisation: unknown;
  contexte_reglementaire: unknown;
  implied_domains: string[] | null;
  context_deduction_confidence: 'high' | 'medium' | 'low' | null;
  budget_estime: number | null;
  delai_prevu: string | null;
  date_debut_prevue: string | null;
  created_at: string;
  updated_at: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  pipeline_status: unknown;
}

export class ProjetRepository extends BaseRepository<Projet> {
  constructor(db: SupabaseClient) {
    super(db, 'projets');
  }

  async findByClientId(clientId: string): Promise<Projet[]> {
    return this.findMany({ client_id: clientId });
  }

  async findActiveByEntrepriseId(entrepriseId: string): Promise<Array<{ id: string; type: string; localisation: unknown }>> {
    const { data, error } = await this.db
      .from('projets')
      .select('id, type, localisation')
      .eq('entreprise_id', entrepriseId)
      .eq('status', 'active');

    if (error) throw error;
    return (data as Array<{ id: string; type: string; localisation: unknown }>) ?? [];
  }

  async updateRegulationContext(projectId: string, contexte: unknown): Promise<Projet> {
    return this.update(projectId, {
      contexte_reglementaire: contexte,
      pipeline_status: { context_fetched: true, last_update: new Date().toISOString() },
    });
  }

  async updateImpliedDomains(projectId: string, domains: string[], confidence: 'high' | 'medium' | 'low'): Promise<Projet> {
    return this.update(projectId, {
      implied_domains: domains,
      context_deduction_confidence: confidence,
    });
  }
}

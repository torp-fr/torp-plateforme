import type { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './BaseRepository.js';

export interface Entreprise extends Record<string, unknown> {
  id: string;
  siret: string;
  raison_sociale: string;
  rcs_data: unknown;
  certifications: unknown;
  reputation: unknown;
  contact_principal: string | null;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  ville: string | null;
  code_postal: string | null;
  website: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
  status: 'active' | 'suspended' | 'archived';
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  pipeline_status: unknown;
}

export class EntrepriseRepository extends BaseRepository<Entreprise> {
  constructor(db: SupabaseClient) {
    super(db, 'entreprises');
  }

  async findBySIRET(siret: string): Promise<Entreprise | null> {
    const { data, error } = await this.db
      .from('entreprises')
      .select('*')
      .eq('siret', siret)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return (data as Entreprise) ?? null;
  }

  async updateEnrichment(
    id: string,
    rcs_data: unknown,
    certifications: unknown,
    reputation: unknown
  ): Promise<Entreprise> {
    return this.update(id, {
      rcs_data,
      certifications,
      reputation,
      pipeline_status: { enrichment_status: 'completed', last_enrichment: new Date().toISOString() },
    });
  }

  async updatePipelineStatus(id: string, status: string, error?: string): Promise<void> {
    await this.update(id, {
      pipeline_status: { enrichment_status: status, ...(error ? { error } : {}), updated_at: new Date().toISOString() },
    });
  }

  async findAllActive(): Promise<Array<{ id: string; siret: string }>> {
    const { data, error } = await this.db
      .from('entreprises')
      .select('id, siret')
      .eq('status', 'active');

    if (error) throw error;
    return (data as Array<{ id: string; siret: string }>) ?? [];
  }
}

import type { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './BaseRepository.js';

export interface Devis extends Record<string, unknown> {
  id: string;
  projet_id: string;
  entreprise_id: string;
  version: number;
  upload_format: string | null;
  upload_file_path: string | null;
  upload_timestamp: string;
  parsing_result: unknown;
  created_at: string;
  is_final: boolean;
  notes: string | null;
  pipeline_status: unknown;
}

export class DevisRepository extends BaseRepository<Devis> {
  constructor(db: SupabaseClient) {
    super(db, 'devis');
  }

  async findByProjetId(projetId: string, limit = 10): Promise<Devis[]> {
    const { data, error } = await this.db
      .from('devis')
      .select('*')
      .eq('projet_id', projetId)
      .order('version', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data as Devis[]) ?? [];
  }

  async getLatestVersion(projetId: string): Promise<Devis | null> {
    const { data, error } = await this.db
      .from('devis')
      .select('*')
      .eq('projet_id', projetId)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return (data as Devis) ?? null;
  }

  async getNextVersion(projetId: string): Promise<number> {
    const latest = await this.getLatestVersion(projetId);
    return (latest?.version ?? 0) + 1;
  }

  async updateParsingResult(devisId: string, parsingResult: unknown): Promise<Devis> {
    return this.update(devisId, {
      parsing_result:  parsingResult,
      pipeline_status: { parsing_status: 'completed' },
    });
  }

  async updatePipelineStatus(devisId: string, status: Partial<{ parsing_status: string; scoring_status: string; qr_generated: boolean; error: string }>): Promise<void> {
    const { data: current } = await this.db
      .from('devis')
      .select('pipeline_status')
      .eq('id', devisId)
      .single();

    const existing = (current?.pipeline_status as Record<string, unknown>) ?? {};
    await this.update(devisId, { pipeline_status: { ...existing, ...status } });
  }
}

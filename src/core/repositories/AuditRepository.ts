import type { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './BaseRepository.js';

export interface Audit extends Record<string, unknown> {
  id: string;
  devis_id: string;
  projet_id: string;
  entreprise_id: string;
  audit_timestamp: string;
  audit_engine_version: string;
  processing_time_ms: number | null;
  coverage_analysis: unknown;
  scoring: unknown;
  recommendations: unknown;
  public_summary: unknown;
  version_delta: unknown;
}

export interface QRCode extends Record<string, unknown> {
  id: string;
  audit_id: string;
  qr_image_url: string | null;
  short_code: string;
  access_url: string;
  created_at: string;
  expires_at: string | null;
  access_stats: unknown;
  is_active: boolean;
  created_by: string | null;
}

export class AuditRepository extends BaseRepository<Audit> {
  constructor(db: SupabaseClient) {
    super(db, 'audits');
  }

  async findByDevisId(devisId: string): Promise<Audit | null> {
    const { data, error } = await this.db
      .from('audits')
      .select('*')
      .eq('devis_id', devisId)
      .order('audit_timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return (data as Audit) ?? null;
  }

  async findByProjetId(projetId: string): Promise<Audit[]> {
    const { data, error } = await this.db
      .from('audits')
      .select('*')
      .eq('projet_id', projetId)
      .order('audit_timestamp', { ascending: false });

    if (error) throw error;
    return (data as Audit[]) ?? [];
  }

  async createQRCode(auditId: string, shortCode: string, baseUrl: string): Promise<QRCode> {
    const { data, error } = await this.db
      .from('qrcodes')
      .insert({
        audit_id:    auditId,
        short_code:  shortCode,
        access_url:  `${baseUrl}/audit/${shortCode}`,
        is_active:   true,
        access_stats: { scans: 0, unique_views: 0 },
      })
      .select()
      .single();

    if (error) throw error;
    return data as QRCode;
  }

  async findAuditByShortCode(shortCode: string): Promise<(Audit & { short_code: string; access_url: string }) | null> {
    const { data, error } = await this.db
      .from('qrcodes')
      .select('short_code, access_url, audit_id, is_active')
      .eq('short_code', shortCode)
      .single();

    if (error || !data || !data.is_active) return null;

    const audit = await this.findById(data.audit_id as string);
    if (!audit) return null;

    return { ...audit, short_code: data.short_code as string, access_url: data.access_url as string };
  }

  async incrementScanCount(shortCode: string): Promise<void> {
    const { data } = await this.db
      .from('qrcodes')
      .select('access_stats')
      .eq('short_code', shortCode)
      .single();

    const stats = (data?.access_stats as Record<string, unknown>) ?? { scans: 0, unique_views: 0 };
    const scans = ((stats['scans'] as number) ?? 0) + 1;

    await this.db
      .from('qrcodes')
      .update({ access_stats: { ...stats, scans, last_accessed_at: new Date().toISOString() } })
      .eq('short_code', shortCode);
  }
}

// ─────────────────────────────────────────────────────────────────────
// PipelineOrchestrator — event-driven pipeline chaining
// Triggers the right pipeline based on domain events.
// All pipelines are independent; this class manages sequencing + logging.
// ─────────────────────────────────────────────────────────────────────

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { PipelineContext, PipelineResult, ProjectType } from '../pipelines/types/index.js';
import { EnrichissementEntreprisePipeline } from '../pipelines/handlers/EnrichissementEntreprisePipeline.js';
import { ClientLocalizationPipeline } from '../pipelines/handlers/ClientLocalizationPipeline.js';
import { ContextRegulationPipeline } from '../pipelines/handlers/ContextRegulationPipeline.js';
import { DevisParsingPipeline } from '../pipelines/handlers/DevisParsingPipeline.js';
import { AuditScoringPipeline } from '../pipelines/handlers/AuditScoringPipeline.js';

type AnyPipeline = {
  execute(params: Record<string, unknown>, context: PipelineContext): Promise<PipelineResult<unknown>>;
};

export class PipelineOrchestrator {
  private supabase: SupabaseClient;
  private pipelines: Map<string, AnyPipeline>;

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase ?? createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Register all pipelines
    this.pipelines = new Map([
      ['EnrichissementEntreprise', new EnrichissementEntreprisePipeline() as AnyPipeline],
      ['ClientLocalization',        new ClientLocalizationPipeline()        as AnyPipeline],
      ['ContextRegulation',         new ContextRegulationPipeline()         as AnyPipeline],
      ['DevisParsing',              new DevisParsingPipeline()              as AnyPipeline],
      ['AuditScoring',              new AuditScoringPipeline()              as AnyPipeline],
    ]);
  }

  // ─────────────────────────────────────────────────────────────────
  // Domain events — called from API routes or cron jobs
  // ─────────────────────────────────────────────────────────────────

  /** Triggered when an entreprise is registered (SIRET entered). */
  async onEntrepriseRegistered(siret: string, entrepriseId: string): Promise<void> {
    const result = await this.run('EnrichissementEntreprise', { siret }, entrepriseId, 'entreprise');

    if (result.status !== 'failed') {
      await this.supabase
        .from('entreprises')
        .update({
          rcs_data:        result.data?.rcs_data,
          certifications:  result.data?.certifications,
          reputation:      result.data?.reputation,
          pipeline_status: { enrichment_status: result.status, last_enrichment: new Date().toISOString() },
        })
        .eq('id', entrepriseId);
    } else {
      await this.supabase
        .from('entreprises')
        .update({ pipeline_status: { enrichment_status: 'failed', error: result.error } })
        .eq('id', entrepriseId);
    }
  }

  /** Triggered when a client is created with an address. */
  async onClientCreated(clientId: string, address: string): Promise<void> {
    const result = await this.run('ClientLocalization', { address }, clientId, 'client');

    await this.supabase
      .from('clients')
      .update({
        localisation:    result.status !== 'failed' ? result.data : null,
        pipeline_status: { localization_status: result.status, last_localization: new Date().toISOString() },
      })
      .eq('id', clientId);
  }

  /** Triggered when a project is created (type + location known). */
  async onProjectCreated(
    projectId: string,
    projectType: ProjectType,
    lat: number,
    lng: number,
    codePostal?: string
  ): Promise<void> {
    const result = await this.run(
      'ContextRegulation',
      { projectType, lat, lng, codePostal },
      projectId,
      'projet'
    );

    await this.supabase
      .from('projets')
      .update({
        contexte_reglementaire: result.status !== 'failed' ? result.data : null,
        pipeline_status: {
          context_fetched: result.status === 'completed',
          last_update:     new Date().toISOString(),
          error:           result.error,
        },
      })
      .eq('id', projectId);
  }

  /** Triggered when a devis file is uploaded. Chains → AuditScoring on success. */
  async onDevisUploaded(devisId: string, filePath: string, format: string): Promise<void> {
    // Step 1: Parse
    const parseResult = await this.run('DevisParsing', { filePath, format }, devisId, 'devis');

    await this.supabase
      .from('devis')
      .update({
        parsing_result:  parseResult.data,
        pipeline_status: {
          parsing_status: parseResult.status,
          error:          parseResult.error,
        },
      })
      .eq('id', devisId);

    if (parseResult.status === 'failed') return;

    // Step 2: Score (chained — only runs if parsing succeeded)
    await this.onDevisParsed(devisId);
  }

  /** Triggered after a devis is successfully parsed. */
  async onDevisParsed(devisId: string): Promise<void> {
    const scoreResult = await this.run('AuditScoring', { devisId }, devisId, 'devis');

    if (scoreResult.status === 'failed') {
      await this.supabase
        .from('devis')
        .update({ pipeline_status: { parsing_status: 'parsed', scoring_status: 'failed', error: scoreResult.error } })
        .eq('id', devisId);
      return;
    }

    // Write audit record
    const { data: devis } = await this.supabase
      .from('devis')
      .select('projet_id, entreprise_id')
      .eq('id', devisId)
      .single();

    if (!devis) return;

    const { data: audit } = await this.supabase
      .from('audits')
      .insert({
        devis_id:          devisId,
        projet_id:         devis.projet_id,
        entreprise_id:     devis.entreprise_id,
        processing_time_ms: scoreResult.executionTimeMs,
        coverage_analysis: scoreResult.data?.coverage_analysis,
        scoring:           scoreResult.data?.scoring,
        recommendations:   scoreResult.data?.recommendations,
        public_summary:    scoreResult.data?.public_summary,
        audit_engine_version: '3.0',
      })
      .select('id')
      .single();

    if (audit) {
      // Generate QR code (short_code + access_url)
      const shortCode = this.generateShortCode();
      const accessUrl = `${process.env.PUBLIC_BASE_URL ?? 'https://torp.fr'}/audit/${shortCode}`;

      await this.supabase.from('qrcodes').insert({
        audit_id:    audit.id,
        short_code:  shortCode,
        access_url:  accessUrl,
        is_active:   true,
      });

      await this.supabase
        .from('devis')
        .update({ pipeline_status: { parsing_status: 'parsed', scoring_status: 'completed', qr_generated: true } })
        .eq('id', devisId);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Cron refresh jobs — called by worker/cron.ts
  // ─────────────────────────────────────────────────────────────────

  /** Weekly: refresh enrichment for all active entreprises. */
  async refreshAllEntreprises(): Promise<void> {
    const { data: entreprises } = await this.supabase
      .from('entreprises')
      .select('id, siret')
      .eq('status', 'active');

    for (const e of entreprises ?? []) {
      await this.onEntrepriseRegistered(e.siret, e.id).catch(err =>
        console.error(`[cron] Enrichment failed for ${e.siret}:`, err)
      );
    }
  }

  /** Fortnightly: refresh regulatory context for all active projects. */
  async refreshAllProjectContexts(): Promise<void> {
    const { data: projets } = await this.supabase
      .from('projets')
      .select('id, type, localisation')
      .eq('status', 'active');

    for (const p of projets ?? []) {
      const loc = p.localisation as { lat?: number; lng?: number; code_postal?: string } | null;
      if (!loc?.lat || !loc?.lng) continue;

      await this.onProjectCreated(p.id, p.type as ProjectType, loc.lat, loc.lng, loc.code_postal).catch(err =>
        console.error(`[cron] Context refresh failed for projet ${p.id}:`, err)
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Core execution + logging
  // ─────────────────────────────────────────────────────────────────

  private async run(
    pipelineName: string,
    params: Record<string, unknown>,
    entityId: string,
    entityType: PipelineContext['entityType']
  ): Promise<PipelineResult<Record<string, unknown>>> {
    const pipeline = this.pipelines.get(pipelineName);
    if (!pipeline) throw new Error(`Unknown pipeline: ${pipelineName}`);

    const context: PipelineContext = {
      pipelineName,
      entityId,
      entityType,
      startedAt: new Date(),
      timeout: parseInt(process.env.PIPELINE_TIMEOUT_MS ?? '30000', 10),
    };

    // Record start in DB
    const { data: execution } = await this.supabase
      .from('pipeline_executions')
      .insert({ pipeline_name: pipelineName, entity_id: entityId, entity_type: entityType, status: 'running', input_data: params })
      .select('id')
      .single();

    let result: PipelineResult<unknown>;
    try {
      result = await pipeline.execute(params, context);
    } catch (err) {
      result = {
        status:          'failed',
        error:           err instanceof Error ? err.message : String(err),
        executionTimeMs: Date.now() - context.startedAt.getTime(),
        retryable:       true,
      };
    }

    // Update execution log
    if (execution) {
      await this.supabase
        .from('pipeline_executions')
        .update({
          status:            result.status,
          completed_at:      new Date().toISOString(),
          output_data:       result.data ?? null,
          error_message:     result.error ?? null,
          execution_time_ms: result.executionTimeMs,
        })
        .eq('id', execution.id);
    }

    return result as PipelineResult<Record<string, unknown>>;
  }

  private generateShortCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }
}

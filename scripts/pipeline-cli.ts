#!/usr/bin/env tsx
/**
 * pipeline-cli.ts — Manual pipeline triggers for dev/ops
 *
 * Usage:
 *   tsx scripts/pipeline-cli.ts enrich <siret>
 *   tsx scripts/pipeline-cli.ts geocode <address>
 *   tsx scripts/pipeline-cli.ts context <projet_id>
 *   tsx scripts/pipeline-cli.ts parse <devis_id>
 *   tsx scripts/pipeline-cli.ts score <devis_id>
 *   tsx scripts/pipeline-cli.ts status [pipeline_name]
 *   tsx scripts/pipeline-cli.ts retry-failed [pipeline_name]
 */

import { createClient } from '@supabase/supabase-js';
import { EnrichissementEntreprisePipeline } from '../src/core/pipelines/handlers/EnrichissementEntreprisePipeline.js';
import { ClientLocalizationPipeline } from '../src/core/pipelines/handlers/ClientLocalizationPipeline.js';
import { ContextRegulationPipeline } from '../src/core/pipelines/handlers/ContextRegulationPipeline.js';
import { DevisParsingPipeline } from '../src/core/pipelines/handlers/DevisParsingPipeline.js';
import { AuditScoringPipeline } from '../src/core/pipelines/handlers/AuditScoringPipeline.js';
import type { PipelineContext, ProjectType } from '../src/core/pipelines/types/index.js';

// ─────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────

if (!process.env['SUPABASE_URL'] || !process.env['SUPABASE_SERVICE_ROLE_KEY']) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(
  process.env['SUPABASE_URL'],
  process.env['SUPABASE_SERVICE_ROLE_KEY']
);

function makeContext(pipelineName: string, entityId: string, entityType: PipelineContext['entityType']): PipelineContext {
  return { pipelineName, entityId, entityType, startedAt: new Date(), timeout: 60000 };
}

function printResult(result: unknown) {
  console.log('\n' + JSON.stringify(result, null, 2));
}

// ─────────────────────────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────────────────────────

async function cmdEnrich(siret: string) {
  console.log(`[enrich] Running EnrichissementEntreprisePipeline for SIRET: ${siret}`);

  const pipeline = new EnrichissementEntreprisePipeline();
  const result = await pipeline.execute(
    { siret },
    makeContext('EnrichissementEntreprise', siret, 'entreprise')
  );

  printResult(result);

  if (result.status === 'completed') {
    // Update entreprise in DB if it exists
    const { data: entreprise } = await supabase
      .from('entreprises')
      .select('id')
      .eq('siret', siret)
      .single();

    if (entreprise) {
      await supabase.from('entreprises').update({
        rcs_data:        result.data?.rcs_data,
        certifications:  result.data?.certifications,
        reputation:      result.data?.reputation,
        pipeline_status: { enrichment_status: 'completed', last_enrichment: new Date().toISOString() },
      }).eq('id', entreprise.id);
      console.log(`\n✓ Updated entreprise ${entreprise.id} in DB`);
    } else {
      console.log('\n⚠ Entreprise not found in DB — run registration first');
    }
  }
}

async function cmdGeocode(address: string) {
  console.log(`[geocode] Running ClientLocalizationPipeline for: "${address}"`);

  const pipeline = new ClientLocalizationPipeline();
  const result = await pipeline.execute(
    { address },
    makeContext('ClientLocalization', 'cli-test', 'client')
  );

  printResult(result);
}

async function cmdContext(projectId: string) {
  console.log(`[context] Running ContextRegulationPipeline for projet: ${projectId}`);

  const { data: projet } = await supabase
    .from('projets')
    .select('id, type, localisation')
    .eq('id', projectId)
    .single();

  if (!projet) {
    console.error('ERROR: Projet not found');
    process.exit(1);
  }

  const loc = projet.localisation as { lat?: number; lng?: number; code_postal?: string } | null;

  if (!loc?.lat || !loc?.lng) {
    console.error('ERROR: Projet has no lat/lng — run geocode first');
    process.exit(1);
  }

  const pipeline = new ContextRegulationPipeline();
  const result = await pipeline.execute(
    { projectType: projet.type as ProjectType, lat: loc.lat, lng: loc.lng, codePostal: loc.code_postal },
    makeContext('ContextRegulation', projectId, 'projet')
  );

  printResult(result);

  if (result.status === 'completed') {
    await supabase.from('projets').update({
      contexte_reglementaire: result.data,
      pipeline_status: { context_fetched: true, last_update: new Date().toISOString() },
    }).eq('id', projectId);
    console.log(`\n✓ Updated projet ${projectId} in DB`);
  }
}

async function cmdParse(devisId: string) {
  console.log(`[parse] Running DevisParsingPipeline for devis: ${devisId}`);

  const { data: devis } = await supabase
    .from('devis')
    .select('id, upload_file_path, upload_format')
    .eq('id', devisId)
    .single();

  if (!devis) {
    console.error('ERROR: Devis not found');
    process.exit(1);
  }

  const pipeline = new DevisParsingPipeline();
  const result = await pipeline.execute(
    { filePath: devis.upload_file_path as string, format: devis.upload_format as string },
    makeContext('DevisParsing', devisId, 'devis')
  );

  printResult(result);
}

async function cmdScore(devisId: string) {
  console.log(`[score] Running AuditScoringPipeline for devis: ${devisId}`);

  const pipeline = new AuditScoringPipeline();
  const result = await pipeline.execute(
    { devisId },
    makeContext('AuditScoring', devisId, 'devis')
  );

  printResult(result);
}

async function cmdStatus(pipelineName?: string) {
  let q = supabase
    .from('pipeline_executions')
    .select('pipeline_name, status, started_at, execution_time_ms, error_message, entity_type, entity_id')
    .order('started_at', { ascending: false })
    .limit(20);

  if (pipelineName) q = q.eq('pipeline_name', pipelineName);

  const { data, error } = await q;
  if (error) { console.error(error); process.exit(1); }

  console.log(`\n=== Pipeline Executions ${pipelineName ? `(${pipelineName})` : ''} ===`);
  console.table(data?.map(e => ({
    pipeline:    e.pipeline_name,
    status:      e.status,
    entity:      `${e.entity_type}:${String(e.entity_id).slice(0, 8)}`,
    started:     new Date(e.started_at as string).toLocaleString('fr-FR'),
    duration_ms: e.execution_time_ms ?? '—',
    error:       e.error_message ? String(e.error_message).slice(0, 50) : '—',
  })) ?? []);
}

async function cmdRetryFailed(pipelineName?: string) {
  let q = supabase
    .from('pipeline_executions')
    .select('id, pipeline_name, entity_id, entity_type, input_data')
    .eq('status', 'failed');

  if (pipelineName) q = q.eq('pipeline_name', pipelineName);

  const { data: failed, error } = await q.limit(10);
  if (error) { console.error(error); process.exit(1); }

  if (!failed?.length) {
    console.log('No failed pipeline executions found.');
    return;
  }

  console.log(`Found ${failed.length} failed execution(s). Retrying...`);

  for (const exec of failed) {
    console.log(`\nRetrying: ${exec.pipeline_name} for ${exec.entity_type}:${exec.entity_id}`);
    // Mark as pending for the orchestrator to pick up
    await supabase.from('pipeline_executions').update({ status: 'pending', retry_count: 1 }).eq('id', exec.id);
  }

  console.log('\n✓ Marked as pending. Run the worker to process them.');
}

// ─────────────────────────────────────────────────────────────────
// CLI dispatch
// ─────────────────────────────────────────────────────────────────

const [, , command, arg1] = process.argv;

if (!command) {
  console.log(`
Usage:
  tsx scripts/pipeline-cli.ts enrich <siret>
  tsx scripts/pipeline-cli.ts geocode "<address>"
  tsx scripts/pipeline-cli.ts context <projet_id>
  tsx scripts/pipeline-cli.ts parse <devis_id>
  tsx scripts/pipeline-cli.ts score <devis_id>
  tsx scripts/pipeline-cli.ts status [pipeline_name]
  tsx scripts/pipeline-cli.ts retry-failed [pipeline_name]
`);
  process.exit(0);
}

switch (command) {
  case 'enrich':       await cmdEnrich(arg1!); break;
  case 'geocode':      await cmdGeocode(arg1!); break;
  case 'context':      await cmdContext(arg1!); break;
  case 'parse':        await cmdParse(arg1!); break;
  case 'score':        await cmdScore(arg1!); break;
  case 'status':       await cmdStatus(arg1); break;
  case 'retry-failed': await cmdRetryFailed(arg1); break;
  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}

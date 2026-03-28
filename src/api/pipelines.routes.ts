// ─────────────────────────────────────────────────────────────────────
// Pipeline API routes — Phase 3A
// Expose the 5 pipeline-driven flows as REST endpoints
// ─────────────────────────────────────────────────────────────────────

import { Router, type Request, type Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { PipelineOrchestrator } from '../core/orchestration/PipelineOrchestrator.js';
import type { ProjectType } from '../core/pipelines/types/index.js';

const router = Router();

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getOrchestrator() {
  return new PipelineOrchestrator(getSupabase());
}

// ─────────────────────────────────────────────────────────────────
// POST /api/v1/entreprises/register
// Create entreprise + trigger EnrichissementEntreprise pipeline
// ─────────────────────────────────────────────────────────────────
router.post('/entreprises/register', async (req: Request, res: Response) => {
  const { siret, raison_sociale, contact_principal, email, telephone } = req.body as Record<string, string>;

  if (!siret || !/^\d{14}$/.test(siret)) {
    return res.status(400).json({ error: 'SIRET invalide (14 chiffres requis)' });
  }

  const supabase = getSupabase();

  const { data: existing } = await supabase
    .from('entreprises')
    .select('id')
    .eq('siret', siret)
    .maybeSingle();

  if (existing) {
    return res.status(409).json({ error: 'SIRET déjà enregistré', entreprise_id: existing.id });
  }

  const { data: entreprise, error } = await supabase
    .from('entreprises')
    .insert({
      siret,
      raison_sociale: raison_sociale ?? `Entreprise ${siret}`,
      contact_principal,
      email,
      telephone,
      pipeline_status: { enrichment_status: 'pending' },
    })
    .select('id, siret, raison_sociale')
    .single();

  if (error) return res.status(400).json({ error: error.message });

  // Fire-and-forget enrichment — user doesn't wait
  getOrchestrator()
    .onEntrepriseRegistered(siret, entreprise.id)
    .catch(err => console.error(`[pipeline] Enrichment error ${siret}:`, err));

  return res.status(201).json({ entreprise, status: 'enrichment_pending' });
});

// ─────────────────────────────────────────────────────────────────
// POST /api/v1/clients
// Create client + trigger ClientLocalization pipeline
// ─────────────────────────────────────────────────────────────────
router.post('/clients', async (req: Request, res: Response) => {
  const { entreprise_id, nom, prenom, email, telephone, adresse } = req.body as Record<string, string>;

  if (!entreprise_id || !nom || !telephone) {
    return res.status(400).json({ error: 'entreprise_id, nom et telephone sont requis' });
  }

  const supabase = getSupabase();

  const { data: client, error } = await supabase
    .from('clients')
    .insert({
      entreprise_id,
      nom,
      prenom,
      email,
      telephone,
      pipeline_status: { localization_status: 'pending' },
    })
    .select('id, nom, prenom, telephone')
    .single();

  if (error) return res.status(400).json({ error: error.message });

  if (adresse) {
    getOrchestrator()
      .onClientCreated(client.id, adresse)
      .catch(err => console.error(`[pipeline] Localization error ${client.id}:`, err));
  }

  return res.status(201).json({ client, status: adresse ? 'localization_pending' : 'no_address' });
});

// ─────────────────────────────────────────────────────────────────
// POST /api/v1/projets
// Create project + trigger ContextRegulation pipeline
// ─────────────────────────────────────────────────────────────────
router.post('/projets', async (req: Request, res: Response) => {
  const {
    client_id, entreprise_id, type, description, adresse,
    lat, lng, code_postal, budget_estime,
  } = req.body as Record<string, unknown>;

  if (!client_id || !entreprise_id || !type) {
    return res.status(400).json({ error: 'client_id, entreprise_id et type sont requis' });
  }

  const supabase = getSupabase();

  const { data: projet, error } = await supabase
    .from('projets')
    .insert({
      client_id,
      entreprise_id,
      type,
      description,
      localisation: adresse ? { adresse, lat, lng, code_postal } : null,
      budget_estime,
      pipeline_status: { context_fetched: false },
    })
    .select('id, type, status')
    .single();

  if (error) return res.status(400).json({ error: error.message });

  if (lat && lng) {
    getOrchestrator()
      .onProjectCreated(
        projet.id,
        type as ProjectType,
        lat as number,
        lng as number,
        code_postal as string | undefined
      )
      .catch(err => console.error(`[pipeline] Context error ${projet.id}:`, err));
  }

  return res.status(201).json({ projet, status: lat ? 'context_analysis_pending' : 'no_location' });
});

// ─────────────────────────────────────────────────────────────────
// POST /api/v1/devis/upload
// Upload devis file + trigger DevisParsing → AuditScoring pipeline chain
// ─────────────────────────────────────────────────────────────────
router.post('/devis/upload', async (req: Request, res: Response) => {
  const { projet_id, format, file_base64, file_name } = req.body as Record<string, string>;

  if (!projet_id || !format || !file_base64) {
    return res.status(400).json({ error: 'projet_id, format et file_base64 sont requis' });
  }

  const supabase = getSupabase();

  // Get entreprise_id from projet
  const { data: projet } = await supabase
    .from('projets')
    .select('entreprise_id')
    .eq('id', projet_id)
    .single();

  if (!projet) return res.status(404).json({ error: 'Projet non trouvé' });

  // Upload to Supabase Storage
  const bucket = process.env.STORAGE_BUCKET_DEVIS ?? 'devis_uploads';
  const filePath = `${projet_id}/${Date.now()}_${file_name ?? `devis.${format}`}`;
  const fileBuffer = Buffer.from(file_base64, 'base64');

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, fileBuffer, { contentType: getMimeType(format), upsert: false });

  if (uploadError) return res.status(500).json({ error: `Storage upload failed: ${uploadError.message}` });

  // Create devis record
  const { data: devis, error: devisError } = await supabase
    .from('devis')
    .insert({
      projet_id,
      entreprise_id:   projet.entreprise_id,
      upload_format:   format,
      upload_file_path: filePath,
      pipeline_status: { parsing_status: 'pending' },
    })
    .select('id, upload_format, upload_timestamp')
    .single();

  if (devisError) return res.status(400).json({ error: devisError.message });

  // Fire-and-forget: parse → score → QR
  getOrchestrator()
    .onDevisUploaded(devis.id, filePath, format)
    .catch(err => console.error(`[pipeline] Parsing error ${devis.id}:`, err));

  return res.status(201).json({ devis, status: 'parsing_pending' });
});

// ─────────────────────────────────────────────────────────────────
// GET /api/v1/devis/:id/status
// Poll parsing + scoring status
// ─────────────────────────────────────────────────────────────────
router.get('/devis/:id/status', async (req: Request, res: Response) => {
  const supabase = getSupabase();

  const { data: devis } = await supabase
    .from('devis')
    .select('id, pipeline_status, parsing_result')
    .eq('id', req.params['id'])
    .single();

  if (!devis) return res.status(404).json({ error: 'Devis non trouvé' });

  const status = (devis.pipeline_status as Record<string, unknown>) ?? {};
  const confidence = (devis.parsing_result as Record<string, unknown> | null)?.['parsing_confidence'];
  const itemCount  = ((devis.parsing_result as Record<string, unknown> | null)?.['items'] as unknown[])?.length ?? 0;

  return res.json({
    devis_id:         devis.id,
    parsing_status:   status['parsing_status'] ?? 'pending',
    scoring_status:   status['scoring_status'] ?? 'pending',
    qr_generated:     status['qr_generated'] ?? false,
    item_count:       itemCount,
    confidence,
  });
});

// ─────────────────────────────────────────────────────────────────
// GET /api/v1/audit/:short_code  (PUBLIC — no auth required)
// Client-facing report via QR code scan
// ─────────────────────────────────────────────────────────────────
router.get('/audit/:short_code', async (req: Request, res: Response) => {
  const supabase = getSupabase();

  const { data: qr } = await supabase
    .from('qrcodes')
    .select('audit_id, access_stats, is_active')
    .eq('short_code', req.params['short_code'])
    .single();

  if (!qr || !qr.is_active) return res.status(404).json({ error: 'Rapport non trouvé ou expiré' });

  const { data: audit } = await supabase
    .from('audits')
    .select('public_summary, scoring, recommendations, audit_timestamp, audit_engine_version')
    .eq('id', qr.audit_id)
    .single();

  if (!audit) return res.status(404).json({ error: 'Audit non trouvé' });

  // Increment scan count
  const stats = (qr.access_stats as Record<string, unknown>) ?? { scans: 0, unique_views: 0 };
  await supabase
    .from('qrcodes')
    .update({ access_stats: { ...stats, scans: ((stats['scans'] as number) ?? 0) + 1, last_accessed_at: new Date().toISOString() } })
    .eq('short_code', req.params['short_code']);

  return res.json({
    short_code:     req.params['short_code'],
    generated_at:   audit.audit_timestamp,
    engine_version: audit.audit_engine_version,
    ...audit.public_summary,
    scoring: {
      final_score: (audit.scoring as Record<string, unknown>)?.['final_score'],
      grade:       (audit.scoring as Record<string, unknown>)?.['grade'],
      dimensions:  (audit.scoring as Record<string, unknown>)?.['dimensions'],
    },
    top_recommendations: (audit.recommendations as unknown[])?.slice(0, 3) ?? [],
  });
});

// ─────────────────────────────────────────────────────────────────
// GET /api/v1/pipelines/status  (admin — monitoring)
// Recent pipeline execution summary
// ─────────────────────────────────────────────────────────────────
router.get('/pipelines/status', async (_req: Request, res: Response) => {
  const supabase = getSupabase();

  const { data: recent } = await supabase
    .from('pipeline_executions')
    .select('pipeline_name, status, started_at, execution_time_ms, error_message')
    .order('started_at', { ascending: false })
    .limit(50);

  const summary: Record<string, { completed: number; failed: number; running: number; avg_ms: number }> = {};
  for (const exec of recent ?? []) {
    const name = exec.pipeline_name as string;
    if (!summary[name]) summary[name] = { completed: 0, failed: 0, running: 0, avg_ms: 0 };
    const s = summary[name];
    if (exec.status === 'completed') s.completed++;
    else if (exec.status === 'failed') s.failed++;
    else if (exec.status === 'running') s.running++;
    if (exec.execution_time_ms) s.avg_ms = Math.round((s.avg_ms + exec.execution_time_ms) / 2);
  }

  return res.json({ summary, recent: recent?.slice(0, 10) });
});

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
function getMimeType(format: string): string {
  const types: Record<string, string> = {
    pdf:   'application/pdf',
    image: 'image/jpeg',
    csv:   'text/csv',
    excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    docx:  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return types[format] ?? 'application/octet-stream';
}

export default router;

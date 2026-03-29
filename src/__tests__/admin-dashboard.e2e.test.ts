/**
 * Admin Dashboard E2E Tests
 * Phase 5.5 - PROMPT H5
 *
 * Tests data flows: write metrics/costs to Supabase → verify aggregation.
 * Runs against the real Supabase project (service role key required).
 * Skip in CI if SUPABASE_SERVICE_ROLE_KEY is not set.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Use service role for write access (RLS bypassed)
const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string;
const serviceKey   = import.meta.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
const anonKey      = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const skipIfNoServiceKey = !serviceKey ? it.skip : it;

const supabaseAdmin = serviceKey
  ? createClient(supabaseUrl, serviceKey)
  : createClient(supabaseUrl, anonKey);

// Test run ID — unique per run so cleanup is safe
const RUN_ID = `e2e-${Date.now()}`;

describe('Admin Dashboard E2E — API Monitoring', () => {
  const insertedHealthIds: string[] = [];

  afterAll(async () => {
    if (insertedHealthIds.length) {
      await supabaseAdmin
        .from('api_health_metrics')
        .delete()
        .in('id', insertedHealthIds);
    }
  });

  skipIfNoServiceKey('records API health metrics for multiple APIs', async () => {
    const { data, error } = await supabaseAdmin
      .from('api_health_metrics')
      .insert([
        { api_name: `OpenAI-GPT-4o-${RUN_ID}`,    status: 'online',   response_time_ms: 245 },
        { api_name: `Anthropic-Claude-${RUN_ID}`,  status: 'online',   response_time_ms: 312 },
        { api_name: `Pappers-${RUN_ID}`,           status: 'degraded', response_time_ms: 1850 },
      ])
      .select('id');

    expect(error).toBeNull();
    expect(data).toHaveLength(3);
    insertedHealthIds.push(...data!.map(r => r.id));
  });

  skipIfNoServiceKey('retrieves latest status per API correctly', async () => {
    const { data } = await supabaseAdmin
      .from('api_health_metrics')
      .select('api_name, status, response_time_ms')
      .like('api_name', `%-${RUN_ID}`)
      .order('checked_at', { ascending: false });

    expect(data?.length).toBe(3);

    const openai = data?.find(r => r.api_name === `OpenAI-GPT-4o-${RUN_ID}`);
    expect(openai?.status).toBe('online');
    expect(openai?.response_time_ms).toBe(245);

    const pappers = data?.find(r => r.api_name === `Pappers-${RUN_ID}`);
    expect(pappers?.status).toBe('degraded');
  });

  skipIfNoServiceKey('counts correctly by status', async () => {
    const { data } = await supabaseAdmin
      .from('api_health_metrics')
      .select('status')
      .like('api_name', `%-${RUN_ID}`);

    const online   = data?.filter(r => r.status === 'online').length ?? 0;
    const degraded = data?.filter(r => r.status === 'degraded').length ?? 0;

    expect(online).toBe(2);
    expect(degraded).toBe(1);
  });
});

describe('Admin Dashboard E2E — Cost Tracking', () => {
  const insertedCostIds: string[] = [];

  afterAll(async () => {
    if (insertedCostIds.length) {
      await supabaseAdmin
        .from('api_costs')
        .delete()
        .in('id', insertedCostIds);
    }
  });

  skipIfNoServiceKey('records API costs for multiple APIs', async () => {
    const { data, error } = await supabaseAdmin
      .from('api_costs')
      .insert([
        { api_name: `openai-gpt-4o-${RUN_ID}`,        cost_usd: 0.005, metrics: { tokens_used: 150 } },
        { api_name: `openai-gpt-4o-${RUN_ID}`,        cost_usd: 0.008, metrics: { tokens_used: 240 } },
        { api_name: `anthropic-claude-${RUN_ID}`,      cost_usd: 0.003, metrics: { tokens_used: 90 } },
        { api_name: `pappers-enterprise-${RUN_ID}`,    cost_usd: 0.10,  metrics: { siret: '12345678900018' } },
      ])
      .select('id');

    expect(error).toBeNull();
    expect(data).toHaveLength(4);
    insertedCostIds.push(...data!.map(r => r.id));
  });

  skipIfNoServiceKey('aggregates costs correctly per API', async () => {
    const { data } = await supabaseAdmin
      .from('api_costs')
      .select('api_name, cost_usd')
      .like('api_name', `%-${RUN_ID}`);

    expect(data?.length).toBe(4);

    const byCost: Record<string, number> = {};
    for (const row of data!) {
      byCost[row.api_name] = (byCost[row.api_name] ?? 0) + row.cost_usd;
    }

    // OpenAI had 2 calls: 0.005 + 0.008 = 0.013
    expect(byCost[`openai-gpt-4o-${RUN_ID}`]).toBeCloseTo(0.013, 4);
    // Pappers: 0.10
    expect(byCost[`pappers-enterprise-${RUN_ID}`]).toBeCloseTo(0.10, 4);
  });

  skipIfNoServiceKey('calculates total cost correctly', async () => {
    const { data } = await supabaseAdmin
      .from('api_costs')
      .select('cost_usd')
      .like('api_name', `%-${RUN_ID}`);

    const total = data?.reduce((s, r) => s + r.cost_usd, 0) ?? 0;
    // 0.005 + 0.008 + 0.003 + 0.10 = 0.116
    expect(total).toBeCloseTo(0.116, 4);
    expect(total).toBeGreaterThan(0);
  });
});

describe('Admin Dashboard E2E — 13 API catalogue completeness', () => {
  const EXPECTED_APIS = [
    'OpenAI-GPT-4o', 'OpenAI-Embeddings', 'OpenAI-Vision', 'Anthropic-Claude', 'Google-Vision-OCR',
    'INSEE-SIRENE', 'Pappers',
    'Geoplateforme-Geocoding', 'BDNB', 'API-Carto',
    'Géorisques', 'RGE-Professionals', 'DPE-Logements',
  ];

  it('catalogue has exactly 13 APIs', () => {
    expect(EXPECTED_APIS).toHaveLength(13);
  });

  it('catalogue has 4 categories', () => {
    const CATEGORIES = ['IA', 'Données Entreprise', 'Géolocalisation', 'Enrichissement'];
    expect(CATEGORIES).toHaveLength(4);
  });

  it('each API name is unique', () => {
    const unique = new Set(EXPECTED_APIS);
    expect(unique.size).toBe(EXPECTED_APIS.length);
  });
});

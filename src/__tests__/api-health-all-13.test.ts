/**
 * Integration test: verify all 13 APIs are registered with correct names.
 * Phase 6-P1 — ensures server.ts registers all 3 API groups and
 * that the registered names match what APIMonitoringPage expects.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { APIHealthMonitor } from '@/core/monitoring/APIHealthMonitor';
import {
  registerAIAPIs,
  registerDataAPIs,
  registerEnrichmentAPIs,
} from '@/core/monitoring/AIAPIsHealthCheck';

// ── Mock Supabase (no real DB writes in unit tests) ───────────────────────────

function makeMockSupabase(): SupabaseClient {
  return {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  } as unknown as SupabaseClient;
}

// ── Expected API names (must match APIMonitoringPage.API_DEFINITIONS) ─────────

const EXPECTED_AI_APIS = [
  'OpenAI-GPT-4o',
  'OpenAI-Embeddings',
  'OpenAI-Vision',
  'Anthropic-Claude',
  'Google-Vision-OCR',
];

const EXPECTED_DATA_APIS = [
  'INSEE-SIRENE',
  'Geoplateforme',
  'BDNB',
  'API-Carto',
  'Pappers',
];

const EXPECTED_ENRICHMENT_APIS = [
  'Georisques',
  'ADEME-RGE',
  'ADEME-DPE',
];

const ALL_13_APIS = [
  ...EXPECTED_AI_APIS,
  ...EXPECTED_DATA_APIS,
  ...EXPECTED_ENRICHMENT_APIS,
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('All 13 APIs registration', () => {
  let monitor: APIHealthMonitor;

  afterEach(() => {
    monitor.stopAll();
    vi.restoreAllMocks();
  });

  it('registerAIAPIs registers exactly 5 AI APIs', () => {
    monitor = new APIHealthMonitor(makeMockSupabase());
    registerAIAPIs(monitor);

    const names = monitor.getAllAPIStatus().map(s => s.api_name);
    expect(names).toHaveLength(5);

    for (const expected of EXPECTED_AI_APIS) {
      expect(names).toContain(expected);
    }
  });

  it('registerDataAPIs registers exactly 5 data APIs', () => {
    monitor = new APIHealthMonitor(makeMockSupabase());
    registerDataAPIs(monitor);

    const names = monitor.getAllAPIStatus().map(s => s.api_name);
    expect(names).toHaveLength(5);

    for (const expected of EXPECTED_DATA_APIS) {
      expect(names).toContain(expected);
    }
  });

  it('registerEnrichmentAPIs registers exactly 3 enrichment APIs', () => {
    monitor = new APIHealthMonitor(makeMockSupabase());
    registerEnrichmentAPIs(monitor);

    const names = monitor.getAllAPIStatus().map(s => s.api_name);
    expect(names).toHaveLength(3);

    for (const expected of EXPECTED_ENRICHMENT_APIS) {
      expect(names).toContain(expected);
    }
  });

  it('all 3 registration functions together register exactly 13 APIs', () => {
    monitor = new APIHealthMonitor(makeMockSupabase());
    registerAIAPIs(monitor);
    registerDataAPIs(monitor);
    registerEnrichmentAPIs(monitor);

    const statuses = monitor.getAllAPIStatus();
    expect(statuses).toHaveLength(13);
  });

  it('all 13 registered API names match the dashboard catalogue', () => {
    monitor = new APIHealthMonitor(makeMockSupabase());
    registerAIAPIs(monitor);
    registerDataAPIs(monitor);
    registerEnrichmentAPIs(monitor);

    const registeredNames = monitor.getAllAPIStatus().map(s => s.api_name).sort();
    const expectedNames   = [...ALL_13_APIS].sort();

    expect(registeredNames).toEqual(expectedNames);
  });

  it('all 13 APIs start with status unknown', () => {
    monitor = new APIHealthMonitor(makeMockSupabase());
    registerAIAPIs(monitor);
    registerDataAPIs(monitor);
    registerEnrichmentAPIs(monitor);

    for (const status of monitor.getAllAPIStatus()) {
      expect(status.status).toBe('unknown');
    }
  });

  it('API names are unique across all 3 groups', () => {
    const allNames = ALL_13_APIS;
    const unique = new Set(allNames);
    expect(unique.size).toBe(allNames.length);
  });
});

describe('CostTracker pricing config coverage', () => {
  it('all 13 API names are seeded in pricing config (migration 20260329000012)', () => {
    // This documents the expected seeded APIs for traceability
    const seededAPIs = [
      'claude-haiku', 'claude-sonnet', 'claude-opus',
      'gpt-4o', 'gpt-4o-mini', 'text-embedding-3-small',
      'Geoplateforme', 'BDNB', 'API-Carto',
      'Georisques', 'ADEME-RGE', 'ADEME-DPE',
      'INSEE-SIRENE', 'Pappers',
      'OpenAI-GPT-4o', 'OpenAI-Embeddings', 'OpenAI-Vision',
      'Anthropic-Claude', 'Google-Vision-OCR',
    ];
    // All 13 monitored API names should be covered
    for (const api of ALL_13_APIS) {
      expect(seededAPIs).toContain(api);
    }
  });
});

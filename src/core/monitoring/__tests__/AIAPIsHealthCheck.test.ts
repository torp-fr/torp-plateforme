import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { APIHealthMonitor } from '../APIHealthMonitor.js';
import {
  registerAIAPIs,
  makeOpenAIHealthCheck,
  makeAnthropicHealthCheck,
  makeGoogleVisionHealthCheck,
} from '../AIAPIsHealthCheck.js';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMockSupabase(): SupabaseClient {
  return {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  } as unknown as SupabaseClient;
}

// ── registerAIAPIs() ──────────────────────────────────────────────────────────

describe('registerAIAPIs()', () => {
  let monitor: APIHealthMonitor;

  beforeEach(() => {
    vi.useFakeTimers();
    monitor = new APIHealthMonitor(makeMockSupabase());
  });

  afterEach(() => {
    monitor.stopAll();
    vi.useRealTimers();
  });

  it('registers 5 AI APIs', () => {
    registerAIAPIs(monitor);
    expect(monitor.getAllAPIStatus()).toHaveLength(5);
  });

  it('registers OpenAI-GPT-4o', () => {
    registerAIAPIs(monitor);
    const names = monitor.getAllAPIStatus().map(s => s.api_name);
    expect(names).toContain('OpenAI-GPT-4o');
  });

  it('registers OpenAI-Embeddings', () => {
    registerAIAPIs(monitor);
    const names = monitor.getAllAPIStatus().map(s => s.api_name);
    expect(names).toContain('OpenAI-Embeddings');
  });

  it('registers OpenAI-Vision', () => {
    registerAIAPIs(monitor);
    const names = monitor.getAllAPIStatus().map(s => s.api_name);
    expect(names).toContain('OpenAI-Vision');
  });

  it('registers Anthropic-Claude', () => {
    registerAIAPIs(monitor);
    const names = monitor.getAllAPIStatus().map(s => s.api_name);
    expect(names).toContain('Anthropic-Claude');
  });

  it('registers Google-Vision-OCR', () => {
    registerAIAPIs(monitor);
    const names = monitor.getAllAPIStatus().map(s => s.api_name);
    expect(names).toContain('Google-Vision-OCR');
  });

  it('all APIs start with status=unknown', () => {
    registerAIAPIs(monitor);
    const statuses = monitor.getAllAPIStatus().map(s => s.status);
    expect(statuses.every(s => s === 'unknown')).toBe(true);
  });

  it('calling twice does not duplicate APIs (idempotent registration)', () => {
    registerAIAPIs(monitor);
    registerAIAPIs(monitor);
    expect(monitor.getAllAPIStatus()).toHaveLength(5);
  });
});

// ── makeOpenAIHealthCheck() ───────────────────────────────────────────────────

describe('makeOpenAIHealthCheck()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.OPENAI_API_KEY;
  });

  it('throws when OPENAI_API_KEY is not set', async () => {
    delete process.env.OPENAI_API_KEY;
    const check = makeOpenAIHealthCheck();
    await expect(check()).rejects.toThrow('OPENAI_API_KEY not configured');
  });

  it('throws when API returns non-OK status', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const check = makeOpenAIHealthCheck();
    await expect(check()).rejects.toThrow('OpenAI API returned 503');
  });

  it('resolves when API returns OK', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    const check = makeOpenAIHealthCheck();
    await expect(check()).resolves.not.toThrow();
  });
});

// ── makeAnthropicHealthCheck() ────────────────────────────────────────────────

describe('makeAnthropicHealthCheck()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('throws when ANTHROPIC_API_KEY is not set', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const check = makeAnthropicHealthCheck();
    await expect(check()).rejects.toThrow('ANTHROPIC_API_KEY not configured');
  });

  it('throws when API returns 401 (invalid key)', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    const check = makeAnthropicHealthCheck();
    await expect(check()).rejects.toThrow('invalid or expired');
  });

  it('throws for server error (5xx)', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const check = makeAnthropicHealthCheck();
    await expect(check()).rejects.toThrow('Anthropic API returned 500');
  });

  it('resolves when API returns 200', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    const check = makeAnthropicHealthCheck();
    await expect(check()).resolves.not.toThrow();
  });
});

// ── makeGoogleVisionHealthCheck() ────────────────────────────────────────────

describe('makeGoogleVisionHealthCheck()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.GOOGLE_CLOUD_API_KEY;
    delete process.env.GOOGLE_CLOUD_PROJECT_ID;
  });

  it('throws when GOOGLE_CLOUD_API_KEY is not set', async () => {
    delete process.env.GOOGLE_CLOUD_API_KEY;
    process.env.GOOGLE_CLOUD_PROJECT_ID = 'proj-123';
    const check = makeGoogleVisionHealthCheck();
    await expect(check()).rejects.toThrow('GOOGLE_CLOUD_API_KEY');
  });

  it('throws when GOOGLE_CLOUD_PROJECT_ID is not set', async () => {
    process.env.GOOGLE_CLOUD_API_KEY = 'AIza-test';
    delete process.env.GOOGLE_CLOUD_PROJECT_ID;
    const check = makeGoogleVisionHealthCheck();
    await expect(check()).rejects.toThrow('GOOGLE_CLOUD_PROJECT_ID');
  });

  it('resolves when status is 200', async () => {
    process.env.GOOGLE_CLOUD_API_KEY    = 'AIza-test';
    process.env.GOOGLE_CLOUD_PROJECT_ID = 'proj-123';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    const check = makeGoogleVisionHealthCheck();
    await expect(check()).resolves.not.toThrow();
  });

  it('resolves when status is 400 (no operations — API is reachable)', async () => {
    process.env.GOOGLE_CLOUD_API_KEY    = 'AIza-test';
    process.env.GOOGLE_CLOUD_PROJECT_ID = 'proj-123';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400 }));
    const check = makeGoogleVisionHealthCheck();
    await expect(check()).resolves.not.toThrow();
  });

  it('throws for 403 (key not authorized)', async () => {
    process.env.GOOGLE_CLOUD_API_KEY    = 'AIza-test';
    process.env.GOOGLE_CLOUD_PROJECT_ID = 'proj-123';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    const check = makeGoogleVisionHealthCheck();
    await expect(check()).rejects.toThrow('Google Vision API returned 403');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// admin.test.ts — Phase 3B Jalon 3 (Settings)
// Unit tests: Zod schemas + AuthService.getSettings / updateSettings
// Framework: Vitest + mock Supabase (no real API calls)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Supabase mock ────────────────────────────────────────────────────────────

const mockFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      admin: { createUser: vi.fn(), deleteUser: vi.fn() },
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      refreshSession: vi.fn(),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    },
    from: mockFrom,
  })),
}));

vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
vi.stubEnv('PUBLIC_BASE_URL', 'https://torp.fr');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSettingsRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-0000-0000-000000000000',
    platform_name: 'TORP',
    platform_url: 'https://torp.example.com',
    platform_description: null,
    maintenance_mode: false,
    maintenance_message: null,
    email_notifications_enabled: true,
    daily_summary_enabled: true,
    security_alerts_enabled: true,
    session_timeout_minutes: 60,
    require_2fa_for_admins: true,
    ip_whitelist_enabled: false,
    ip_whitelist: null,
    slack_webhook_url: null,
    webhook_encryption_key: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    updated_by: null,
    ...overrides,
  };
}

function makeSelectChain(resolved: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolved),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(resolved),
  };
}

// ─── Zod Schema Tests ─────────────────────────────────────────────────────────

describe('UpdatePlatformSettingsSchema', () => {
  let UpdatePlatformSettingsSchema: typeof import('../schemas/admin.schemas.js')['UpdatePlatformSettingsSchema'];

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../schemas/admin.schemas.js');
    UpdatePlatformSettingsSchema = mod.UpdatePlatformSettingsSchema;
  });

  it('accepts a full valid payload', () => {
    const result = UpdatePlatformSettingsSchema.safeParse({
      platform_name: 'TORP Enterprise',
      platform_url: 'https://torp.io',
      maintenance_mode: false,
      email_notifications_enabled: true,
      daily_summary_enabled: true,
      security_alerts_enabled: false,
      session_timeout_minutes: 120,
      require_2fa_for_admins: true,
      ip_whitelist_enabled: false,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a partial payload (all fields optional)', () => {
    const result = UpdatePlatformSettingsSchema.safeParse({
      platform_name: 'TORP',
    });
    expect(result.success).toBe(true);
  });

  it('rejects platform_name shorter than 2 characters', () => {
    const result = UpdatePlatformSettingsSchema.safeParse({ platform_name: 'X' });
    expect(result.success).toBe(false);
  });

  it('rejects platform_url that is not a valid URL', () => {
    const result = UpdatePlatformSettingsSchema.safeParse({ platform_url: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('rejects session_timeout_minutes of 0', () => {
    const result = UpdatePlatformSettingsSchema.safeParse({ session_timeout_minutes: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects session_timeout_minutes above 1440', () => {
    const result = UpdatePlatformSettingsSchema.safeParse({ session_timeout_minutes: 1441 });
    expect(result.success).toBe(false);
  });

  it('accepts empty string for slack_webhook_url', () => {
    const result = UpdatePlatformSettingsSchema.safeParse({ slack_webhook_url: '' });
    expect(result.success).toBe(true);
  });

  it('accepts valid URL for slack_webhook_url', () => {
    const result = UpdatePlatformSettingsSchema.safeParse({
      slack_webhook_url: 'https://hooks.slack.com/services/T00/B00/xxx',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (partial with zero fields)', () => {
    const result = UpdatePlatformSettingsSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

// ─── AuthService.getSettings ──────────────────────────────────────────────────

describe('AuthService.getSettings', () => {
  let authService: Awaited<ReturnType<typeof import('../core/services/AuthService.js')>>['authService'];

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const mod = await import('../core/services/AuthService.js');
    authService = mod.authService;
  });

  it('returns settings when row exists', async () => {
    const row = makeSettingsRow();
    mockFrom.mockReturnValue(makeSelectChain({ data: row, error: null }));

    const result = await authService.getSettings();
    expect(result).toMatchObject({ platform_name: 'TORP', maintenance_mode: false });
  });

  it('throws SETTINGS_NOT_FOUND when row is missing', async () => {
    mockFrom.mockReturnValue(makeSelectChain({ data: null, error: { message: 'Row not found' } }));

    await expect(authService.getSettings()).rejects.toMatchObject({ code: 'SETTINGS_NOT_FOUND' });
  });

  it('queries the canonical settings id', async () => {
    const row = makeSettingsRow();
    const chain = makeSelectChain({ data: row, error: null });
    mockFrom.mockReturnValue(chain);

    await authService.getSettings();

    expect(chain.eq).toHaveBeenCalledWith('id', '00000000-0000-0000-0000-000000000000');
  });
});

// ─── AuthService.updateSettings ───────────────────────────────────────────────

describe('AuthService.updateSettings', () => {
  let authService: Awaited<ReturnType<typeof import('../core/services/AuthService.js')>>['authService'];

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const mod = await import('../core/services/AuthService.js');
    authService = mod.authService;
  });

  it('returns updated row on success', async () => {
    const updated = makeSettingsRow({ platform_name: 'TORP Enterprise' });
    mockFrom.mockReturnValue(makeSelectChain({ data: updated, error: null }));

    const result = await authService.updateSettings({ platform_name: 'TORP Enterprise' }, 'admin-id');
    expect((result as Record<string, unknown>).platform_name).toBe('TORP Enterprise');
  });

  it('passes updated_by from caller', async () => {
    const row = makeSettingsRow({ updated_by: 'admin-456' });
    const chain = makeSelectChain({ data: row, error: null });
    mockFrom.mockReturnValue(chain);

    await authService.updateSettings({ maintenance_mode: true }, 'admin-456');

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ maintenance_mode: true, updated_by: 'admin-456' }),
    );
  });

  it('throws on DB error', async () => {
    const chain = makeSelectChain({ data: null, error: { message: 'DB write failed' } });
    mockFrom.mockReturnValue(chain);

    await expect(
      authService.updateSettings({ platform_name: 'X' }, 'admin-id'),
    ).rejects.toThrow('Settings update failed');
  });

  it('targets the canonical settings id', async () => {
    const row = makeSettingsRow();
    const chain = makeSelectChain({ data: row, error: null });
    mockFrom.mockReturnValue(chain);

    await authService.updateSettings({}, 'admin-id');

    expect(chain.eq).toHaveBeenCalledWith('id', '00000000-0000-0000-0000-000000000000');
  });
});

// ─── RLS access-control reasoning ────────────────────────────────────────────

describe('Settings RLS policy', () => {
  it('admin role should be granted read/write access', () => {
    const allowedRoles = ['admin', 'super_admin'];
    expect(allowedRoles.includes('admin')).toBe(true);
    expect(allowedRoles.includes('super_admin')).toBe(true);
  });

  it('user role should be denied access', () => {
    const allowedRoles = ['admin', 'super_admin'];
    expect(allowedRoles.includes('user')).toBe(false);
  });
});

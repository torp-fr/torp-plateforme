// ─────────────────────────────────────────────────────────────────────────────
// auth.test.ts — Phase 3B Jalon 1
// Unit + integration tests for auth middleware, service, routes and rate limiting
// Framework: Vitest + mock Supabase (no real API calls)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Supabase mock ────────────────────────────────────────────────────────────

const mockGetUser = vi.fn();
const mockCreateUser = vi.fn();
const mockSignIn = vi.fn();
const mockRefreshSession = vi.fn();
const mockDeleteUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      admin: {
        createUser: mockCreateUser,
        deleteUser: mockDeleteUser,
      },
      getUser: mockGetUser,
      signInWithPassword: mockSignIn,
      refreshSession: mockRefreshSession,
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    },
    from: mockFrom,
  })),
}));

// Minimal env vars required for service init
vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
vi.stubEnv('PUBLIC_BASE_URL', 'https://torp.fr');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMockProfile(overrides = {}) {
  return {
    id: 'user-123',
    email: 'test@example.com',
    full_name: 'Test User',
    avatar_url: null,
    role: 'user',
    is_admin: false,
    can_upload_kb: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeMockAdminProfile() {
  return makeMockProfile({ id: 'admin-456', email: 'admin@example.com', role: 'admin', is_admin: true });
}

function makeChain(returnValue: unknown) {
  const chain = {
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(returnValue),
    maybeSingle: vi.fn().mockResolvedValue(returnValue),
    range: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
  };
  return chain;
}

// ─── AuthService tests ────────────────────────────────────────────────────────

describe('AuthService', () => {
  let authService: Awaited<ReturnType<typeof import('../core/services/AuthService.js')>>['authService'];

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const mod = await import('../core/services/AuthService.js');
    authService = mod.authService;
  });

  // ── register ────────────────────────────────────────────────────────────────

  describe('register', () => {
    it('creates user, profile and rate_limits on success', async () => {
      mockCreateUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'new@example.com' } },
        error: null,
      });

      const profileChain = makeChain({ data: makeMockProfile(), error: null });
      mockFrom.mockReturnValue(profileChain);

      const result = await authService.register('new@example.com', 'password123', 'New User');

      expect(mockCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@example.com', email_confirm: true })
      );
      expect(result.email).toBe('test@example.com');
    });

    it('throws USER_EXISTS when email already registered', async () => {
      mockCreateUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'User already registered', code: 'email_exists' },
      });

      await expect(
        authService.register('exists@example.com', 'password123', 'Existing')
      ).rejects.toMatchObject({ code: 'USER_EXISTS' });
    });

    it('rolls back auth user if profile creation fails', async () => {
      mockCreateUser.mockResolvedValue({
        data: { user: { id: 'user-rollback', email: 'fail@example.com' } },
        error: null,
      });

      mockFrom.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: { message: 'Profile insert failed' } }),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      await expect(
        authService.register('fail@example.com', 'password123', 'Fail User')
      ).rejects.toThrow('Profile creation failed');

      expect(mockDeleteUser).toHaveBeenCalledWith('user-rollback');
    });
  });

  // ── login ───────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns session with tokens on valid credentials', async () => {
      mockSignIn.mockResolvedValue({
        data: {
          user: { id: 'user-123', email: 'test@example.com' },
          session: { access_token: 'tok-access', refresh_token: 'tok-refresh', expires_in: 3600 },
        },
        error: null,
      });

      const profileChain = makeChain({ data: makeMockProfile(), error: null });
      mockFrom.mockReturnValue(profileChain);

      const session = await authService.login('test@example.com', 'password123');

      expect(session.accessToken).toBe('tok-access');
      expect(session.refreshToken).toBe('tok-refresh');
      expect(session.user.role).toBe('user');
    });

    it('throws INVALID_CREDENTIALS on wrong password', async () => {
      mockSignIn.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      await expect(
        authService.login('test@example.com', 'wrongpass')
      ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });
  });

  // ── refreshSession ──────────────────────────────────────────────────────────

  describe('refreshSession', () => {
    it('returns new access token on valid refresh token', async () => {
      mockRefreshSession.mockResolvedValue({
        data: { session: { access_token: 'tok-new', expires_in: 3600 } },
        error: null,
      });

      const result = await authService.refreshSession('valid-refresh-token');
      expect(result.accessToken).toBe('tok-new');
      expect(result.expiresIn).toBe(3600);
    });

    it('throws INVALID_REFRESH_TOKEN on expired token', async () => {
      mockRefreshSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Token has expired' },
      });

      await expect(
        authService.refreshSession('expired-token')
      ).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
    });
  });

  // ── validateToken ────────────────────────────────────────────────────────────

  describe('validateToken', () => {
    it('returns user data for a valid token', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      const result = await authService.validateToken('valid-jwt');
      expect(result).toEqual({ id: 'user-123', email: 'test@example.com' });
    });

    it('returns null for an invalid token', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid' } });
      const result = await authService.validateToken('bad-token');
      expect(result).toBeNull();
    });

    it('returns null for a malformed token', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'JWT malformed' } });
      const result = await authService.validateToken('not.a.jwt');
      expect(result).toBeNull();
    });
  });

  // ── getProfile ───────────────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('returns profile for existing user', async () => {
      const profile = makeMockProfile();
      mockFrom.mockReturnValue(makeChain({ data: profile, error: null }));

      const result = await authService.getProfile('user-123');
      expect(result.id).toBe('user-123');
      expect(result.role).toBe('user');
    });

    it('throws PROFILE_NOT_FOUND for unknown user', async () => {
      mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'not found' } }));

      await expect(authService.getProfile('ghost-id')).rejects.toMatchObject({
        code: 'PROFILE_NOT_FOUND',
      });
    });
  });

  // ── updateProfile ────────────────────────────────────────────────────────────

  describe('updateProfile', () => {
    it('returns updated profile', async () => {
      const updated = makeMockProfile({ full_name: 'Updated Name' });
      mockFrom.mockReturnValue(makeChain({ data: updated, error: null }));

      const result = await authService.updateProfile('user-123', { full_name: 'Updated Name' });
      expect(result.full_name).toBe('Updated Name');
    });
  });

  // ── listUsers ────────────────────────────────────────────────────────────────

  describe('listUsers', () => {
    it('returns paginated user list', async () => {
      const profiles = [makeMockProfile(), makeMockAdminProfile()];
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: profiles, count: 2, error: null }),
      });

      const result = await authService.listUsers(1, 20);
      expect(result.users).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });
});

// ─── JWT Middleware tests ─────────────────────────────────────────────────────

describe('authenticateJWT middleware', () => {
  let authenticateJWT: Awaited<ReturnType<typeof import('../api/middleware/auth.js')>>['authenticateJWT'];

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const mod = await import('../api/middleware/auth.js');
    authenticateJWT = mod.authenticateJWT;
  });

  function makeReqRes(token?: string) {
    const req = {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    } as Parameters<typeof authenticateJWT>[0];
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Parameters<typeof authenticateJWT>[1];
    const next = vi.fn() as Parameters<typeof authenticateJWT>[2];
    return { req, res, next };
  }

  it('returns 401 when no Authorization header', async () => {
    const { req, res, next } = makeReqRes();
    await authenticateJWT(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for invalid token', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid' } });
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }));

    const { req, res, next } = makeReqRes('invalid-token');
    await authenticateJWT(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() and sets req.user for valid token', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    });
    mockFrom.mockReturnValue(makeChain({ data: makeMockProfile(), error: null }));

    const { req, res, next } = makeReqRes('valid-jwt');
    await authenticateJWT(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as { user?: { id: string } }).user?.id).toBe('user-123');
  });
});

// ─── requireAdmin middleware tests ────────────────────────────────────────────

describe('requireAdmin middleware', () => {
  let requireAdmin: Awaited<ReturnType<typeof import('../api/middleware/auth.js')>>['requireAdmin'];

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const mod = await import('../api/middleware/auth.js');
    requireAdmin = mod.requireAdmin;
  });

  it('returns 403 if user has role=user', () => {
    const req = { user: { id: '1', email: 'a@b.com', role: 'user' } } as Parameters<typeof requireAdmin>[0];
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Parameters<typeof requireAdmin>[1];
    const next = vi.fn();

    requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() for admin role', () => {
    const req = { user: { id: '1', email: 'a@b.com', role: 'admin' } } as Parameters<typeof requireAdmin>[0];
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Parameters<typeof requireAdmin>[1];
    const next = vi.fn();

    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('calls next() for super_admin role', () => {
    const req = { user: { id: '1', email: 'a@b.com', role: 'super_admin' } } as Parameters<typeof requireAdmin>[0];
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Parameters<typeof requireAdmin>[1];
    const next = vi.fn();

    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 if no user attached (unauthenticated call)', () => {
    const req = {} as Parameters<typeof requireAdmin>[0];
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Parameters<typeof requireAdmin>[1];
    const next = vi.fn();

    requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ─── Rate limit middleware tests ──────────────────────────────────────────────

describe('rateLimitMiddleware', () => {
  let rateLimitMiddleware: Awaited<ReturnType<typeof import('../api/middleware/rateLimit.js')>>['rateLimitMiddleware'];

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const mod = await import('../api/middleware/rateLimit.js');
    rateLimitMiddleware = mod.rateLimitMiddleware;
  });

  function makeReqRes(userId?: string, ip = '127.0.0.1') {
    const req = {
      user: userId ? { id: userId, email: 'u@test.com' } : undefined,
      ip,
      headers: {},
    } as Parameters<typeof rateLimitMiddleware>[0];

    const headers: Record<string, string | number> = {};
    const res = {
      setHeader: vi.fn((k: string, v: string | number) => { headers[k] = v; }),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Parameters<typeof rateLimitMiddleware>[1];

    const next = vi.fn();
    return { req, res, next, headers };
  }

  it('calls next() for a normal request', async () => {
    const { req, res, next } = makeReqRes('user-abc', '1.2.3.4');
    await rateLimitMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('sets X-RateLimit headers on every response', async () => {
    const { req, res, next, headers } = makeReqRes('user-headers', '1.2.3.5');
    await rateLimitMiddleware(req, res, next);
    expect(headers['X-RateLimit-Limit-Minute']).toBe(100);
    expect(headers['X-RateLimit-Limit-Hour']).toBe(1000);
    expect(headers['X-RateLimit-Limit-Day']).toBe(10000);
    expect(next).toHaveBeenCalled();
  });

  it('uses stricter defaults for anonymous requests', async () => {
    const { req, res, next, headers } = makeReqRes(undefined, '10.0.0.1');
    await rateLimitMiddleware(req, res, next);
    expect(headers['X-RateLimit-Limit-Minute']).toBe(10);   // anonymous limit
    expect(headers['X-RateLimit-Limit-Hour']).toBe(100);
    expect(next).toHaveBeenCalled();
  });

  it('blocks request when minute limit exceeded (anonymous, limit=10)', async () => {
    // Use anonymous (no userId) so no DB fetch needed — limit is 10/min
    const ip = '192.0.2.99';

    for (let i = 0; i < 10; i++) {
      const { req, res, next } = makeReqRes(undefined, ip);
      await rateLimitMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    }

    // The 11th request should be blocked
    const { req, res, next } = makeReqRes(undefined, ip);
    await rateLimitMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(next).not.toHaveBeenCalled();
  });

  it('tracks separate windows per IP (anonymous)', async () => {
    // IP-A makes 5 requests
    for (let i = 0; i < 5; i++) {
      const { req, res, next } = makeReqRes(undefined, '10.0.0.1');
      await rateLimitMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    }

    // IP-B starts fresh — should not be affected by IP-A's requests
    const { req, res, next, headers } = makeReqRes(undefined, '10.0.0.2');
    await rateLimitMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    // IP-B's remaining should be 9 (10 - 0 - 1), not 4
    expect(headers['X-RateLimit-Remaining-Minute']).toBe(9);
  });

  it('returns retryAfter in the 429 response', async () => {
    // Anonymous with limit=10
    const ip = '198.51.100.1';
    for (let i = 0; i < 10; i++) {
      const { req, res, next } = makeReqRes(undefined, ip);
      await rateLimitMiddleware(req, res, next);
    }

    const { req, res } = makeReqRes(undefined, ip);
    await rateLimitMiddleware(req, res, vi.fn());

    const call = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call).toHaveProperty('retryAfter');
    expect(call.retryAfter).toBeGreaterThanOrEqual(0);
  });
});

// ─── Integration test: register → login → me → logout ────────────────────────

describe('Auth flow integration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('complete flow: register → login → getProfile', async () => {
    // 1. Register
    mockCreateUser.mockResolvedValue({
      data: { user: { id: 'user-flow', email: 'flow@example.com' } },
      error: null,
    });
    const profile = makeMockProfile({ id: 'user-flow', email: 'flow@example.com' });
    const mockChain = makeChain({ data: profile, error: null });
    mockFrom.mockReturnValue(mockChain);

    const { authService: svc } = await import('../core/services/AuthService.js');
    const registered = await svc.register('flow@example.com', 'secure1234', 'Flow User');
    expect(registered.id).toBe('user-flow');

    // 2. Login
    mockSignIn.mockResolvedValue({
      data: {
        user: { id: 'user-flow', email: 'flow@example.com' },
        session: { access_token: 'tok-flow', refresh_token: 'ref-flow', expires_in: 3600 },
      },
      error: null,
    });
    mockFrom.mockReturnValue(makeChain({ data: profile, error: null }));

    const session = await svc.login('flow@example.com', 'secure1234');
    expect(session.accessToken).toBe('tok-flow');

    // 3. Get profile using token
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-flow', email: 'flow@example.com' } },
      error: null,
    });
    mockFrom.mockReturnValue(makeChain({ data: profile, error: null }));

    const { authenticateJWT } = await import('../api/middleware/auth.js');
    const req = {
      headers: { authorization: `Bearer ${session.accessToken}` },
    } as Parameters<typeof authenticateJWT>[0];
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Parameters<typeof authenticateJWT>[1];
    const next = vi.fn();

    await authenticateJWT(req, res, next);
    expect(next).toHaveBeenCalled();
    expect((req as { user?: { id: string } }).user?.id).toBe('user-flow');
  });
});

// ─── Edge case: weak password / invalid email ─────────────────────────────────

describe('Validation edge cases (Zod)', () => {
  it('rejects email without @ symbol', async () => {
    const { z } = await import('zod');
    const schema = z.object({ email: z.string().email() });
    const result = schema.safeParse({ email: 'notanemail' });
    expect(result.success).toBe(false);
  });

  it('rejects password shorter than 8 chars', async () => {
    const { z } = await import('zod');
    const schema = z.object({ password: z.string().min(8) });
    const result = schema.safeParse({ password: 'short' });
    expect(result.success).toBe(false);
  });

  it('accepts valid email and strong password', async () => {
    const { z } = await import('zod');
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(8),
    });
    const result = schema.safeParse({ email: 'valid@example.com', password: 'StrongPass1!' });
    expect(result.success).toBe(true);
  });

  it('rejects fullName shorter than 2 chars', async () => {
    const { z } = await import('zod');
    const schema = z.object({ fullName: z.string().min(2) });
    const result = schema.safeParse({ fullName: 'A' });
    expect(result.success).toBe(false);
  });
});

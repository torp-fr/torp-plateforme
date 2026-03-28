// ─────────────────────────────────────────────────────────────────────────────
// auth.routes.ts — Authentication endpoints — Phase 3B Jalon 1
//
// POST /auth/register   — Create account
// POST /auth/login      — Sign in, get tokens
// POST /auth/refresh    — Exchange refresh token for new access token
// POST /auth/logout     — Invalidate session (server-side log)
// GET  /auth/me         — Get authenticated user's profile
// ─────────────────────────────────────────────────────────────────────────────

import { Router, type Request, type Response } from 'express';
import { authService } from '../../core/services/AuthService.js';
import { authenticateJWT, type AuthenticatedRequest } from '../middleware/auth.js';
import { validateBody } from '../../utils/validation.utils.js';
import { RegisterSchema, LoginSchema, RefreshSchema } from '../../schemas/auth.schemas.js';

// ─── POST /auth/register ─────────────────────────────────────────────────────

router.post('/register', validateBody(RegisterSchema), async (req: Request, res: Response) => {
  const { email, password, fullName } = req.body as { email: string; password: string; fullName: string };

  try {
    const user = await authService.register(email, password, fullName);
    res.status(201).json({
      message: 'Account created successfully',
      user: {
        id:        user.id,
        email:     user.email,
        full_name: user.full_name,
        role:      user.role,
      },
    });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;

    if (code === 'USER_EXISTS') {
      res.status(409).json({
        error: 'Conflict',
        code: 'USER_EXISTS',
        message: 'An account with this email already exists',
      });
      return;
    }

    console.error('[auth/register]', err);
    res.status(500).json({
      error: 'Internal Server Error',
      code: 'REGISTRATION_FAILED',
      message: 'Could not create account',
    });
  }
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────

router.post('/login', validateBody(LoginSchema), async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };

  try {
    const session = await authService.login(email, password);
    res.status(200).json(session);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;

    if (code === 'INVALID_CREDENTIALS') {
      res.status(401).json({
        error: 'Unauthorized',
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
      return;
    }

    console.error('[auth/login]', err);
    res.status(500).json({
      error: 'Internal Server Error',
      code: 'LOGIN_FAILED',
      message: 'Could not complete login',
    });
  }
});

// ─── POST /auth/refresh ───────────────────────────────────────────────────────

router.post('/refresh', validateBody(RefreshSchema), async (req: Request, res: Response) => {
  try {
    const result = await authService.refreshSession((req.body as { refreshToken: string }).refreshToken);
    res.status(200).json(result);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;

    if (code === 'INVALID_REFRESH_TOKEN') {
      res.status(401).json({
        error: 'Unauthorized',
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid or has expired',
      });
      return;
    }

    console.error('[auth/refresh]', err);
    res.status(500).json({
      error: 'Internal Server Error',
      code: 'REFRESH_FAILED',
      message: 'Could not refresh session',
    });
  }
});

// ─── POST /auth/logout ────────────────────────────────────────────────────────

router.post('/logout', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  // JWT is stateless — the client must delete the token on its side.
  // Here we log the event for audit purposes.
  console.info(`[auth/logout] user=${req.user?.id} email=${req.user?.email}`);
  res.status(200).json({ message: 'Logged out successfully' });
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────

router.get('/me', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    res.status(401).json({ error: 'Unauthorized', code: 'NOT_AUTHENTICATED' });
    return;
  }

  try {
    const profile = await authService.getProfile(req.user.id);
    const rateLimits = await authService.getRateLimits(req.user.id);

    res.status(200).json({
      user: profile,
      rateLimits: rateLimits ?? {
        requests_per_minute: 100,
        requests_per_hour: 1000,
        requests_per_day: 10000,
      },
    });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;

    if (code === 'PROFILE_NOT_FOUND') {
      res.status(404).json({
        error: 'Not Found',
        code: 'PROFILE_NOT_FOUND',
        message: 'User profile not found',
      });
      return;
    }

    console.error('[auth/me]', err);
    res.status(500).json({
      error: 'Internal Server Error',
      code: 'PROFILE_FETCH_FAILED',
    });
  }
});

export default router;

// ─────────────────────────────────────────────────────────────────────────────
// admin.routes.ts — Admin management endpoints — Phase 3B Jalon 1
//
// All routes require: authenticateJWT + requireAdmin
//
// GET    /admin/users                — List users (paginated)
// GET    /admin/rate-limits          — List all rate-limit configs
// GET    /admin/rate-limits/:userId  — Get config + current usage for user
// PUT    /admin/rate-limits/:userId  — Update rate-limit config
// DELETE /admin/users/:userId        — Hard delete user
// GET    /admin/health               — Admin health check
// ─────────────────────────────────────────────────────────────────────────────

import { Router, type Request, type Response } from 'express';
import { authService } from '../../core/services/AuthService.js';
import { authenticateJWT, requireAdmin, type AuthenticatedRequest } from '../middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '../../utils/validation.utils.js';
import {
  ListUsersQuerySchema,
  UserIdParamSchema,
  UpdateRateLimitSchema,
  UpdatePlatformSettingsSchema,
} from '../../schemas/admin.schemas.js';

const router = Router();

// All admin routes require auth + admin role
router.use(authenticateJWT, requireAdmin);

// ─── GET /admin/users ─────────────────────────────────────────────────────────

router.get('/users', validateQuery(ListUsersQuerySchema), async (req: Request, res: Response) => {
  try {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const { users, total } = await authService.listUsers(page, limit);
    res.status(200).json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[admin/users]', err);
    res.status(500).json({ error: 'Internal Server Error', code: 'LIST_USERS_FAILED' });
  }
});

// ─── GET /admin/rate-limits ───────────────────────────────────────────────────

router.get('/rate-limits', async (_req: Request, res: Response) => {
  try {
    const rateLimits = await authService.listRateLimits();
    res.status(200).json({ rateLimits });
  } catch (err) {
    console.error('[admin/rate-limits]', err);
    res.status(500).json({ error: 'Internal Server Error', code: 'LIST_RATE_LIMITS_FAILED' });
  }
});

// ─── GET /admin/rate-limits/:userId ──────────────────────────────────────────

router.get('/rate-limits/:userId', validateParams(UserIdParamSchema), async (req: Request, res: Response) => {
  const { userId } = req.params as { userId: string };

  try {
    const [profile, limits] = await Promise.allSettled([
      authService.getProfile(userId),
      authService.getRateLimits(userId),
    ]);

    if (profile.status === 'rejected') {
      const code = (profile.reason as NodeJS.ErrnoException).code;
      if (code === 'PROFILE_NOT_FOUND') {
        res.status(404).json({ error: 'Not Found', code: 'USER_NOT_FOUND', message: 'User not found' });
        return;
      }
      throw profile.reason;
    }

    res.status(200).json({
      user:       profile.value,
      rateLimits: limits.status === 'fulfilled' ? limits.value : null,
    });
  } catch (err) {
    console.error('[admin/rate-limits/:userId GET]', err);
    res.status(500).json({ error: 'Internal Server Error', code: 'GET_RATE_LIMIT_FAILED' });
  }
});

// ─── PUT /admin/rate-limits/:userId ──────────────────────────────────────────

router.put(
  '/rate-limits/:userId',
  validateParams(UserIdParamSchema),
  validateBody(UpdateRateLimitSchema),
  async (req: Request, res: Response) => {
  const { userId } = req.params as { userId: string };

  try {
    const updated = await authService.updateRateLimits(userId, req.body as Parameters<typeof authService.updateRateLimits>[1]);
    res.status(200).json({ message: 'Rate limits updated', rateLimits: updated });
  } catch (err) {
    console.error('[admin/rate-limits/:userId PUT]', err);
    res.status(500).json({ error: 'Internal Server Error', code: 'UPDATE_RATE_LIMIT_FAILED' });
  }
});

// ─── DELETE /admin/users/:userId ──────────────────────────────────────────────

router.delete('/users/:userId', validateParams(UserIdParamSchema), async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params as { userId: string };

  // Prevent self-deletion
  if (userId === req.user?.id) {
    res.status(400).json({
      error: 'Bad Request',
      code: 'CANNOT_DELETE_SELF',
      message: 'You cannot delete your own account via the admin endpoint',
    });
    return;
  }

  try {
    await authService.deleteUser(userId);
    console.info(`[admin/users] deleted user=${userId} by admin=${req.user?.id}`);
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('[admin/users/:userId DELETE]', err);
    res.status(500).json({ error: 'Internal Server Error', code: 'DELETE_USER_FAILED' });
  }
});

// ─── GET /admin/settings ──────────────────────────────────────────────────────

router.get('/settings', async (_req: Request, res: Response) => {
  try {
    const data = await authService.getSettings();
    res.status(200).json({ success: true, data });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'SETTINGS_NOT_FOUND') {
      res.status(404).json({ error: 'Settings not found', code: 'SETTINGS_NOT_FOUND' });
      return;
    }
    console.error('[admin/settings GET]', err);
    res.status(500).json({ error: 'Internal Server Error', code: 'GET_SETTINGS_ERROR' });
  }
});

// ─── PUT /admin/settings ──────────────────────────────────────────────────────

router.put(
  '/settings',
  validateBody(UpdatePlatformSettingsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = await authService.updateSettings(req.body, req.user!.id);
      res.status(200).json({ success: true, message: 'Settings updated successfully', data });
    } catch (err) {
      console.error('[admin/settings PUT]', err);
      res.status(500).json({ error: 'Internal Server Error', code: 'UPDATE_SETTINGS_ERROR' });
    }
  },
);

// ─── GET /admin/health ────────────────────────────────────────────────────────

router.get('/health', async (_req: Request, res: Response) => {
  try {
    // Lightweight check: count rate_limits rows
    const { rateLimits } = await authService.listRateLimits().then(r => ({ rateLimits: r }));
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      rateLimitCount: rateLimits.length,
    });
  } catch (err) {
    console.error('[admin/health]', err);
    res.status(503).json({ status: 'error', message: 'Admin health check failed' });
  }
});

export default router;

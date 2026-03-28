// ─────────────────────────────────────────────────────────────────────────────
// auth.ts — JWT validation middleware — Phase 3B Jalon 1
//
// Usage:
//   router.get('/protected', authenticateJWT, handler)
//   router.delete('/admin-only', authenticateJWT, requireAdmin, handler)
//   router.get('/optional', optionalAuth, handler)
// ─────────────────────────────────────────────────────────────────────────────

import type { Request, Response, NextFunction } from 'express';
import { authService } from '../../core/services/AuthService.js';

// ─── Extended request type ────────────────────────────────────────────────────

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role?: string;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Validates the JWT token and attaches `req.user`.
 * Returns 401 if the token is missing, malformed, or expired.
 */
export async function authenticateJWT(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractBearerToken(req);

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      code: 'MISSING_TOKEN',
      message: 'Authorization header required: Bearer <token>',
    });
    return;
  }

  try {
    const user = await authService.validateToken(token);

    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        code: 'INVALID_TOKEN',
        message: 'Token is invalid or has expired',
      });
      return;
    }

    // Fetch role from profile (cached hot path in production would use Redis)
    try {
      const profile = await authService.getProfile(user.id);
      req.user = { id: user.id, email: user.email, role: profile.role };
    } catch {
      // Profile might not exist for brand-new users; proceed without role
      req.user = { id: user.id, email: user.email };
    }

    next();
  } catch (err) {
    console.error('[auth] JWT validation error:', err);
    res.status(401).json({
      error: 'Unauthorized',
      code: 'TOKEN_VALIDATION_FAILED',
      message: 'Could not validate credentials',
    });
  }
}

/**
 * Must be used after `authenticateJWT`.
 * Returns 403 if the user does not have admin or super_admin role.
 */
export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const role = req.user?.role;

  if (!role || !['admin', 'super_admin'].includes(role)) {
    res.status(403).json({
      error: 'Forbidden',
      code: 'INSUFFICIENT_PERMISSIONS',
      message: 'Admin role required',
    });
    return;
  }

  next();
}

/**
 * Attaches `req.user` if a valid token is present, otherwise continues silently.
 * Useful for public endpoints that optionally enrich the response for auth users.
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractBearerToken(req);

  if (token) {
    try {
      const user = await authService.validateToken(token);
      if (user) {
        try {
          const profile = await authService.getProfile(user.id);
          req.user = { id: user.id, email: user.email, role: profile.role };
        } catch {
          req.user = { id: user.id, email: user.email };
        }
      }
    } catch {
      // Silent failure — optionalAuth never blocks the request
    }
  }

  next();
}

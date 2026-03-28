// ─────────────────────────────────────────────────────────────────────────────
// admin.schemas.ts — Zod schemas for admin endpoints — Phase 3B Jalon 2
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';
import { uuidSchema, paginationSchema } from './common.schemas.js';

// ─── Query params ─────────────────────────────────────────────────────────────

export const ListUsersQuerySchema = paginationSchema;

export const ListRateLimitsQuerySchema = paginationSchema;

// ─── Path params ──────────────────────────────────────────────────────────────

export const UserIdParamSchema = z.object({
  userId: uuidSchema,
});

// ─── Body schemas ─────────────────────────────────────────────────────────────

export const UpdateRateLimitSchema = z
  .object({
    requests_per_minute: z.number().int().min(1).max(10_000).optional(),
    requests_per_hour:   z.number().int().min(1).max(100_000).optional(),
    requests_per_day:    z.number().int().min(1).max(1_000_000).optional(),
  })
  .strict('Champs supplémentaires non autorisés')
  .refine(
    data => Object.keys(data).length > 0,
    { message: 'Au moins un champ de limite est requis (requests_per_minute, requests_per_hour ou requests_per_day)' }
  );

export type ListUsersQuery       = z.infer<typeof ListUsersQuerySchema>;
export type UserIdParam          = z.infer<typeof UserIdParamSchema>;
export type UpdateRateLimitInput = z.infer<typeof UpdateRateLimitSchema>;

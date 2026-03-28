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

// ─── Platform Settings ────────────────────────────────────────────────────────

export const PlatformSettingsSchema = z.object({
  platform_name:                z.string().min(2).max(255),
  platform_url:                 z.string().url(),
  platform_description:         z.string().max(1000).optional(),
  maintenance_mode:             z.boolean(),
  maintenance_message:          z.string().max(500).optional(),
  email_notifications_enabled:  z.boolean(),
  daily_summary_enabled:        z.boolean(),
  security_alerts_enabled:      z.boolean(),
  session_timeout_minutes:      z.number().int().min(1).max(1440),
  require_2fa_for_admins:       z.boolean(),
  ip_whitelist_enabled:         z.boolean(),
  ip_whitelist:                 z.string().optional(),
  slack_webhook_url:            z.string().url().optional().or(z.literal('')),
});

export const UpdatePlatformSettingsSchema = PlatformSettingsSchema.partial();

export type PlatformSettings       = z.infer<typeof PlatformSettingsSchema>;
export type UpdatePlatformSettings = z.infer<typeof UpdatePlatformSettingsSchema>;

// ─── Type exports (existing) ──────────────────────────────────────────────────

export type ListUsersQuery       = z.infer<typeof ListUsersQuerySchema>;
export type UserIdParam          = z.infer<typeof UserIdParamSchema>;
export type UpdateRateLimitInput = z.infer<typeof UpdateRateLimitSchema>;

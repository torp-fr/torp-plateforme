// ─────────────────────────────────────────────────────────────────────────────
// audit.schemas.ts — Zod schemas for audit endpoints — Phase 3B Jalon 2
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';
import { shortCodeSchema } from './common.schemas.js';

// Path param: /audit/:short_code
export const AuditShortCodeParamSchema = z.object({
  short_code: shortCodeSchema,
});

// Query params
export const AuditQuerySchema = z.object({
  includeDetails: z.coerce.boolean().default(false),
});

export type AuditShortCodeParam = z.infer<typeof AuditShortCodeParamSchema>;
export type AuditQuery          = z.infer<typeof AuditQuerySchema>;

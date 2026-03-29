// ─────────────────────────────────────────────────────────────────────────────
// auth.schemas.ts — Zod schemas for auth endpoints — Phase 3B Jalon 2
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';
import { emailSchema, passwordSchema, fullNameSchema } from './common.schemas.js';

export const RegisterSchema = z.object({
  email:    emailSchema,
  password: passwordSchema,
  fullName: fullNameSchema,
});

export const LoginSchema = z.object({
  email:    emailSchema,
  password: z.string({ required_error: 'Mot de passe requis' }).min(1, 'Mot de passe requis'),
});

export const RefreshSchema = z.object({
  refreshToken: z.string({ required_error: 'Refresh token requis' }).min(1, 'Refresh token requis'),
});

export type RegisterInput  = z.infer<typeof RegisterSchema>;
export type LoginInput     = z.infer<typeof LoginSchema>;
export type RefreshInput   = z.infer<typeof RefreshSchema>;

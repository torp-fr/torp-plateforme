// ─────────────────────────────────────────────────────────────────────────────
// common.schemas.ts — Shared Zod building blocks — Phase 3B Jalon 2
//
// Import these primitives in all domain schemas.
// Never duplicate — extend or compose instead.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';

// ─── Identifiers ─────────────────────────────────────────────────────────────

export const uuidSchema = z
  .string({ required_error: 'UUID requis' })
  .uuid('Format UUID invalide (ex: 550e8400-e29b-41d4-a716-446655440000)');

// SIRET: 14 chiffres exactement
export const siretSchema = z
  .string({ required_error: 'SIRET requis' })
  .regex(/^\d{14}$/, 'SIRET invalide — 14 chiffres requis (ex: 12345678901234)');

// Code postal français: 5 chiffres
export const codePostalSchema = z
  .string()
  .regex(/^\d{5}$/, 'Code postal invalide — 5 chiffres requis (ex: 75001)');

// Short code audit: 6–10 caractères alphanumériques majuscules
export const shortCodeSchema = z
  .string()
  .regex(/^[A-Z0-9]{6,10}$/, 'Short code invalide — 6 à 10 caractères alphanumériques majuscules');

// ─── Contact ──────────────────────────────────────────────────────────────────

export const emailSchema = z
  .string({ required_error: 'Email requis' })
  .email('Format email invalide')
  .toLowerCase();

export const passwordSchema = z
  .string({ required_error: 'Mot de passe requis' })
  .min(8, 'Mot de passe trop court — 8 caractères minimum')
  .max(128, 'Mot de passe trop long — 128 caractères maximum');

export const fullNameSchema = z
  .string({ required_error: 'Nom complet requis' })
  .min(2, 'Nom trop court — 2 caractères minimum')
  .max(100, 'Nom trop long — 100 caractères maximum')
  .trim();

// Téléphone: format international ou français permissif
export const telephoneSchema = z
  .string()
  .regex(/^[+\d\s\-().]{7,20}$/, 'Numéro de téléphone invalide');

export const urlSchema = z
  .string()
  .url('URL invalide');

// ─── Données numériques ────────────────────────────────────────────────────────

export const latitudeSchema = z
  .number()
  .min(-90, 'Latitude invalide (min -90)')
  .max(90, 'Latitude invalide (max 90)');

export const longitudeSchema = z
  .number()
  .min(-180, 'Longitude invalide (min -180)')
  .max(180, 'Longitude invalide (max 180)');

export const budgetSchema = z
  .number()
  .min(0, 'Budget ne peut pas être négatif')
  .max(1_000_000_000, 'Budget hors limites raisonnables');

// ─── Pagination ────────────────────────────────────────────────────────────────

// Query params are always strings — use .coerce for numbers/booleans
export const paginationSchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;

// ─── UUID param helper ────────────────────────────────────────────────────────

export const uuidParamSchema = (paramName: string) =>
  z.object({ [paramName]: uuidSchema });

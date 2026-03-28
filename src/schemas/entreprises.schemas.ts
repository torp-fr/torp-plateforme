// ─────────────────────────────────────────────────────────────────────────────
// entreprises.schemas.ts — Zod schemas for entreprise endpoints — Phase 3B Jalon 2
//
// Field names match the actual DB columns (French identifiers).
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';
import { siretSchema, emailSchema, telephoneSchema, urlSchema } from './common.schemas.js';

export const RegisterEntrepriseSchema = z.object({
  // Required
  siret: siretSchema,

  // Optional enrichment fields — raison_sociale defaults to "Entreprise {siret}" if absent
  raison_sociale:    z.string().min(2, 'Raison sociale trop courte').max(200).trim().optional(),
  contact_principal: z.string().min(2).max(100).trim().optional(),
  email:             emailSchema.optional(),
  telephone:         telephoneSchema.optional(),

  // Address fields
  adresse:           z.string().max(500).trim().optional(),
  ville:             z.string().min(2).max(100).trim().optional(),
  code_postal:       z.string().regex(/^\d{5}$/, 'Code postal invalide — 5 chiffres').optional(),
  website:           urlSchema.optional(),
});

export type RegisterEntrepriseInput = z.infer<typeof RegisterEntrepriseSchema>;

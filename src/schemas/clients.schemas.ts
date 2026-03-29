// ─────────────────────────────────────────────────────────────────────────────
// clients.schemas.ts — Zod schemas for client endpoints — Phase 3B Jalon 2
//
// Field names match actual DB columns (French identifiers).
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';
import { uuidSchema, emailSchema, telephoneSchema } from './common.schemas.js';

export const CreateClientSchema = z.object({
  // Required
  entreprise_id: uuidSchema,
  nom:           z.string({ required_error: 'Nom requis' }).min(1, 'Nom requis').max(100).trim(),
  telephone:     telephoneSchema,

  // Optional
  prenom:        z.string().min(1).max(100).trim().optional(),
  email:         emailSchema.optional(),
  adresse:       z.string().min(5, 'Adresse trop courte').max(500).trim().optional(),
});

export type CreateClientInput = z.infer<typeof CreateClientSchema>;

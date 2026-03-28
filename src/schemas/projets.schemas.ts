// ─────────────────────────────────────────────────────────────────────────────
// projets.schemas.ts — Zod schemas for projet endpoints — Phase 3B Jalon 2
//
// ProjectType enum mirrors src/core/pipelines/types/index.ts::ProjectType
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';
import { uuidSchema, latitudeSchema, longitudeSchema, codePostalSchema, budgetSchema } from './common.schemas.js';

export const PROJECT_TYPES = [
  'piscine',
  'renovation',
  'extension',
  'construction_neuve',
  'maison_neuve',
  'toiture',
  'electricite_seule',
  'plomberie_seule',
  'isolation',
  'chauffage',
  'fenetre',
  'cuisine',
  'salle_de_bain',
  'autre',
] as const;

export const projectTypeSchema = z.enum(PROJECT_TYPES, {
  errorMap: () => ({
    message: `Type de projet invalide. Valeurs acceptées: ${PROJECT_TYPES.join(', ')}`,
  }),
});

export const CreateProjetSchema = z.object({
  // Required
  client_id:     uuidSchema,
  entreprise_id: uuidSchema,
  type:          projectTypeSchema,

  // Optional
  description:    z.string().max(2000).trim().optional(),
  adresse:        z.string().min(5).max(500).trim().optional(),
  lat:            latitudeSchema.optional(),
  lng:            longitudeSchema.optional(),
  code_postal:    codePostalSchema.optional(),
  budget_estime:  budgetSchema.optional(),
}).refine(
  data => {
    // If one coordinate is provided, both must be present
    const hasLat = data.lat !== undefined;
    const hasLng = data.lng !== undefined;
    return hasLat === hasLng;
  },
  { message: 'lat et lng doivent être fournis ensemble', path: ['lat'] }
);

export type CreateProjetInput = z.infer<typeof CreateProjetSchema>;
export type ProjectType = z.infer<typeof projectTypeSchema>;

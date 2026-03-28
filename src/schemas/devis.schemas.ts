// ─────────────────────────────────────────────────────────────────────────────
// devis.schemas.ts — Zod schemas for devis endpoints — Phase 3B Jalon 2
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';
import { uuidSchema } from './common.schemas.js';

// Formats accepted by the upload endpoint (maps to getMimeType helper)
export const DEVIS_FORMATS = ['pdf', 'image', 'csv', 'excel', 'docx'] as const;

export const devisFormatSchema = z.enum(DEVIS_FORMATS, {
  errorMap: () => ({
    message: `Format invalide. Formats acceptés: ${DEVIS_FORMATS.join(', ')}`,
  }),
});

// Max base64 payload: 50 MB file ≈ 67 MB base64 string
const MAX_BASE64_LENGTH = 70_000_000;

export const UploadDevisSchema = z.object({
  // Required
  projet_id:   uuidSchema,
  format:      devisFormatSchema,
  file_base64: z
    .string({ required_error: 'Fichier requis (base64)' })
    .min(100, 'Contenu de fichier trop court')
    .max(MAX_BASE64_LENGTH, 'Fichier trop volumineux — 50 MB maximum')
    .regex(/^[A-Za-z0-9+/]+=*$/, 'Encodage base64 invalide'),

  // Optional
  file_name: z.string().min(1).max(255).trim().optional(),
});

// Path param: devis/:id
export const DevisIdParamSchema = z.object({
  id: uuidSchema,
});

// Query params for GET /devis/:id/status
export const DevisStatusQuerySchema = z.object({
  includeAudit: z.coerce.boolean().default(false),
  includeMeta:  z.coerce.boolean().default(false),
});

export type UploadDevisInput     = z.infer<typeof UploadDevisSchema>;
export type DevisIdParam         = z.infer<typeof DevisIdParamSchema>;
export type DevisStatusQuery     = z.infer<typeof DevisStatusQuerySchema>;

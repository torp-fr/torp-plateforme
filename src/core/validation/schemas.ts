import { z } from 'zod';

// ─────────────────────────────────────────────────────────
// PRIMITIVES
// ─────────────────────────────────────────────────────────

export const SIRETSchema = z
  .string()
  .trim()
  .regex(/^\d{14}$/, 'SIRET doit contenir exactement 14 chiffres');

export const UUIDSchema = z.string().uuid('ID invalide (UUID attendu)');

export const LatLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// ─────────────────────────────────────────────────────────
// ENTREPRISE
// ─────────────────────────────────────────────────────────

export const EntrepriseRegistrationSchema = z.object({
  siret:             SIRETSchema,
  raison_sociale:    z.string().min(1, 'Raison sociale requise').max(200),
  contact_principal: z.string().max(100).optional(),
  email:             z.string().email('Email invalide').optional(),
  telephone:         z.string().regex(/^[0-9+\s()-]{7,20}$/, 'Téléphone invalide').optional(),
  website:           z.string().url('URL invalide').optional(),
});

export type EntrepriseRegistration = z.infer<typeof EntrepriseRegistrationSchema>;

// ─────────────────────────────────────────────────────────
// CLIENT
// ─────────────────────────────────────────────────────────

export const ClientCreationSchema = z.object({
  entreprise_id: UUIDSchema,
  nom:           z.string().min(1, 'Nom requis').max(100),
  prenom:        z.string().max(100).optional(),
  email:         z.string().email('Email invalide').optional(),
  telephone:     z.string().regex(/^[0-9+\s()-]{7,20}$/, 'Téléphone invalide').optional(),
  adresse:       z.string().min(5, 'Adresse trop courte').max(500),
});

export type ClientCreation = z.infer<typeof ClientCreationSchema>;

// ─────────────────────────────────────────────────────────
// PROJET
// ─────────────────────────────────────────────────────────

export const ProjectTypeSchema = z.enum([
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
  'immeuble_erp',
  'local_commercial',
  'autre',
]);

export type ProjectType = z.infer<typeof ProjectTypeSchema>;

export const ProjectCreationSchema = z.object({
  client_id:      UUIDSchema,
  entreprise_id:  UUIDSchema,
  type:           ProjectTypeSchema,
  description:    z.string().max(2000).optional(),
  adresse:        z.string().min(5, 'Adresse trop courte').max(500),
  lat:            z.number().min(-90).max(90).optional(),
  lng:            z.number().min(-180).max(180).optional(),
  budget_estime:  z.number().positive('Budget doit être positif').optional(),
  delai_prevu:    z.string().max(100).optional(),
});

export type ProjectCreation = z.infer<typeof ProjectCreationSchema>;

// ─────────────────────────────────────────────────────────
// DEVIS
// ─────────────────────────────────────────────────────────

export const DevisFormatSchema = z.enum(['pdf', 'image', 'csv', 'excel', 'web_form', 'docx']);
export type DevisFormat = z.infer<typeof DevisFormatSchema>;

export const DevisItemSchema = z.object({
  line_number:  z.number().int().positive(),
  description:  z.string().min(1).max(500),
  quantity:     z.number().positive(),
  unit:         z.string().max(20).default('forfait'),
  unit_price:   z.number().nonnegative(),
  total_ht:     z.number().nonnegative(),
  category:     z.string().max(50).optional(),
  is_taxable:   z.boolean().default(true),
  tva_taux:     z.number().min(0).max(100).default(10),
});

export type DevisItem = z.infer<typeof DevisItemSchema>;

export const DevisUploadSchema = z.object({
  projet_id:   UUIDSchema,
  format:      DevisFormatSchema,
  file_base64: z.string().min(100, 'Fichier vide ou trop court'),
  file_name:   z.string().max(255).optional(),
});

export type DevisUpload = z.infer<typeof DevisUploadSchema>;

// Web form devis (pre-structured, highest confidence)
export const WebFormDevisSchema = z.object({
  projet_id:    UUIDSchema,
  lines:        z.array(DevisItemSchema).min(1, 'Au moins un poste requis'),
  total_ht:     z.number().nonnegative(),
  tva_taux:     z.number().min(0).max(100).default(10),
  notes:        z.string().max(2000).optional(),
});

export type WebFormDevis = z.infer<typeof WebFormDevisSchema>;

// ─────────────────────────────────────────────────────────
// AUDIT
// ─────────────────────────────────────────────────────────

export const ScoringDimensionSchema = z.object({
  key:       z.string(),
  name:      z.string(),
  score:     z.number().min(0).max(100),
  weight:    z.number().min(0).max(1),
  reasoning: z.string(),
  sub_scores: z.record(z.number()).optional(),
});

export const RecommendationSchema = z.object({
  id:          UUIDSchema,
  priority:    z.enum(['critical', 'high', 'medium', 'low']),
  domain:      z.string(),
  action:      z.string(),
  rationale:   z.string(),
  regulatory_reference: z.string().optional(),
  effort:      z.enum(['quick', 'medium', 'complex']),
  gap_count:   z.number().int().nonnegative(),
  estimated_score_gain: z.number().min(0).max(100).optional(),
});

export const AuditResultSchema = z.object({
  devis_id:       UUIDSchema,
  projet_id:      UUIDSchema,
  coverage_pct:   z.number().min(0).max(100),
  dimensions:     z.array(ScoringDimensionSchema),
  final_score:    z.number().min(0).max(100),
  grade:          z.enum(['A', 'B', 'C', 'D', 'E']),
  recommendations: z.array(RecommendationSchema),
  potential_score: z.number().min(0).max(100).optional(),
});

export type AuditResult = z.infer<typeof AuditResultSchema>;

// ─────────────────────────────────────────────────────────
// API RESPONSE WRAPPER
// ─────────────────────────────────────────────────────────

export function successResponse<T>(data: T, meta?: Record<string, unknown>) {
  return { success: true, data, ...(meta ? { meta } : {}) };
}

export function errorResponse(message: string, code?: string, details?: unknown) {
  return { success: false, error: { message, code: code ?? 'ERROR', details } };
}

-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260329000012_enhance_api_costs
-- Phase 6-P1: Add user_id + tokens_used to api_costs for per-user cost tracking
-- ─────────────────────────────────────────────────────────────────────────────

-- Add user tracking columns to api_costs
ALTER TABLE api_costs
  ADD COLUMN IF NOT EXISTS user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tokens_used  INTEGER;

-- Efficient per-user cost queries
CREATE INDEX IF NOT EXISTS idx_api_costs_user_id ON api_costs(user_id);

-- Seed pricing config for all 13 APIs (ON CONFLICT = no-op for existing rows)
INSERT INTO api_pricing_config (api_name, price_per_request_usd, currency) VALUES
  ('Geoplateforme',  0.000, 'USD'),
  ('BDNB',           0.000, 'USD'),
  ('API-Carto',      0.000, 'USD'),
  ('Georisques',     0.000, 'USD'),
  ('ADEME-RGE',      0.000, 'USD'),
  ('ADEME-DPE',      0.000, 'USD'),
  ('INSEE-SIRENE',   0.000, 'USD'),
  ('Pappers',        0.100, 'USD')  -- ~€0.10 per SIRET lookup
ON CONFLICT (api_name) DO NOTHING;

-- Also add token-based pricing for AI APIs (corrected names if missing)
INSERT INTO api_pricing_config (api_name, price_per_1k_tokens_usd, currency) VALUES
  ('OpenAI-GPT-4o',        0.005,   'USD'),
  ('OpenAI-Embeddings',    0.00002, 'USD'),
  ('OpenAI-Vision',        0.005,   'USD'),
  ('Anthropic-Claude',     0.003,   'USD'),
  ('Google-Vision-OCR',    0.0015,  'USD')
ON CONFLICT (api_name) DO NOTHING;

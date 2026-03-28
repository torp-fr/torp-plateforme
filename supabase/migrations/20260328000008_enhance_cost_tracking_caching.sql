-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260328000008_enhance_cost_tracking_caching
-- Phase 4 - PROMPT H2: OCR caching, embedding cache, AI API pricing
-- ─────────────────────────────────────────────────────────────────────────────

-- ── OCR Result Cache ──────────────────────────────────────────────────────────
-- Stores extracted text keyed by SHA-256 hash of the source file.
-- Prevents paying for Google Vision twice on the same PDF.

CREATE TABLE IF NOT EXISTS ocr_cache (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  file_hash        TEXT        UNIQUE NOT NULL,   -- SHA-256 of raw file buffer
  extracted_text   TEXT        NOT NULL,
  confidence       FLOAT       NOT NULL DEFAULT 0.5,
  pages_processed  INT         NOT NULL DEFAULT 1,
  byte_size        INT,                           -- original file size in bytes
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ocr_cache_file_hash      ON ocr_cache(file_hash);
CREATE INDEX idx_ocr_cache_created_at     ON ocr_cache(created_at DESC);
CREATE INDEX idx_ocr_cache_last_accessed  ON ocr_cache(last_accessed_at DESC);

ALTER TABLE ocr_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_ocr_cache"
  ON ocr_cache FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ── Embedding Cache (DB-persisted) ────────────────────────────────────────────
-- Supplements the in-memory LRU cache in embeddingCache.service.ts.
-- Survives server restarts; avoids re-embedding identical text.

CREATE TABLE IF NOT EXISTS embedding_cache (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key        TEXT        UNIQUE NOT NULL,   -- SHA-256 of text+model+dimensions
  text_preview     TEXT,                          -- first 200 chars for debugging
  model            TEXT        NOT NULL DEFAULT 'text-embedding-3-small',
  dimensions       INT         NOT NULL DEFAULT 384,
  embedding_vector vector(384),                   -- null for synthetic embeddings
  is_synthetic     BOOLEAN     NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hit_count        INT         NOT NULL DEFAULT 0
);

CREATE INDEX idx_embedding_cache_key          ON embedding_cache(cache_key);
CREATE INDEX idx_embedding_cache_created_at   ON embedding_cache(created_at DESC);
CREATE INDEX idx_embedding_cache_last_accessed ON embedding_cache(last_accessed_at DESC);

ALTER TABLE embedding_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_embedding_cache"
  ON embedding_cache FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ── Additional AI API pricing ─────────────────────────────────────────────────
-- Extends the seed data from migration 20260328000007 with vision + OCR pricing.

INSERT INTO api_pricing_config (api_name, price_per_1k_tokens_usd, price_per_image_usd, currency) VALUES
  ('openai-gpt-4o',              0.005,   NULL,   'USD'),  -- llm-completion (openai)
  ('openai-gpt-4o-vision',       0.005,   0.005,  'USD'),  -- analyze-photo, analyze-construction-photo
  ('openai-text-embedding-3-small', 0.00002, NULL, 'USD'), -- generate-embedding
  ('google-vision-ocr',          NULL,    0.0015, 'USD'),  -- google-vision-ocr Edge Function
  ('anthropic-claude-sonnet',    0.003,   NULL,   'USD'),  -- llm-completion (anthropic/sonnet)
  ('anthropic-claude-haiku',     0.00025, NULL,   'USD'),  -- llm-completion (anthropic/haiku)
  ('anthropic-claude-opus',      0.015,   NULL,   'USD')   -- llm-completion (anthropic/opus)
ON CONFLICT (api_name) DO NOTHING;

-- ── Comments ──────────────────────────────────────────────────────────────────

COMMENT ON TABLE ocr_cache       IS 'SHA-256 keyed OCR result cache to avoid duplicate Google Vision charges';
COMMENT ON TABLE embedding_cache IS 'DB-persisted embedding cache (supplements in-memory LRU in embeddingCache.service.ts)';

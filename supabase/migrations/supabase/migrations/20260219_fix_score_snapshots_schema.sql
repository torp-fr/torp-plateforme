-- =========================================
-- PHASE 36.x FIX - score_snapshots schema
-- =========================================

-- Ajouter colonne engine_name si absente
alter table public.score_snapshots
add column if not exists engine_name text;

-- Ajouter score si absent
alter table public.score_snapshots
add column if not exists score numeric;

-- Ajouter status si absent
alter table public.score_snapshots
add column if not exists status text;

-- Ajouter duration_ms si absent
alter table public.score_snapshots
add column if not exists duration_ms integer;

-- Ajouter meta si absent
alter table public.score_snapshots
add column if not exists meta jsonb;

-- Ajouter created_at si absent
alter table public.score_snapshots
add column if not exists created_at timestamp with time zone default now();

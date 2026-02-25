-- =========================================
-- PHASE 36.x - RUNTIME OBSERVABILITY LAYER
-- Tables nécessaires pour /analytics cockpit
-- =========================================

-- ============================
-- TABLE: score_snapshots
-- ============================

create table if not exists public.score_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid,
  engine_name text not null,
  score numeric,
  status text,
  duration_ms integer,
  meta jsonb,
  created_at timestamp with time zone default now()
);

create index if not exists idx_score_snapshots_engine
on public.score_snapshots(engine_name);

create index if not exists idx_score_snapshots_created
on public.score_snapshots(created_at desc);


-- ============================
-- TABLE: live_intelligence_snapshots
-- ============================

create table if not exists public.live_intelligence_snapshots (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  status text,
  documents_processed integer,
  embeddings_generated integer,
  pricing_extracted integer,
  errors integer,
  meta jsonb,
  created_at timestamp with time zone default now()
);

create index if not exists idx_live_intelligence_created
on public.live_intelligence_snapshots(created_at desc);


-- =========================================
-- RLS (lecture admin uniquement pour l'instant)
-- =========================================

alter table public.score_snapshots enable row level security;
alter table public.live_intelligence_snapshots enable row level security;

create policy "Allow authenticated read score snapshots"
on public.score_snapshots
for select
to authenticated
using (true);

create policy "Allow authenticated read intelligence snapshots"
on public.live_intelligence_snapshots
for select
to authenticated
using (true);

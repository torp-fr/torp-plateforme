// ─────────────────────────────────────────────────────────────────────
// Pipeline shared types — Phase 3A
// ─────────────────────────────────────────────────────────────────────

export interface PipelineContext {
  pipelineName: string;
  entityId: string;
  entityType: 'entreprise' | 'client' | 'projet' | 'devis';
  startedAt: Date;
  timeout: number; // ms
}

export interface PipelineResult<T> {
  status: 'completed' | 'failed' | 'partial';
  data?: T;
  error?: string;
  warnings?: string[];
  executionTimeMs: number;
  retryable: boolean;
}

export interface APICallConfig {
  method: 'GET' | 'POST' | 'PUT';
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number; // default: API_CALL_TIMEOUT_MS env var
  retries?: number; // default: RETRY_MAX_ATTEMPTS env var
  fallback?: unknown; // returned if all retries fail and this is set
}

export interface LazyLoadedData<T> {
  status: 'pending' | 'loading' | 'loaded' | 'failed' | 'skipped';
  data?: T;
  error?: string;
  fetched_at?: string; // ISO timestamp
  source_api?: string;
  duration_ms?: number;
}

// Devis parsing
export interface DevisItem {
  id: string;
  line_number: number;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_ht: number;
  category: string;
  domain?: string;
  is_taxable: boolean;
  tva_taux: number;
  confidence?: number; // 0–1
}

export type DataNeed = 'PLU' | 'ABF' | 'PERMITS' | 'AIDES' | 'DPE' | 'UTILITY';

export type ProjectType =
  | 'piscine'
  | 'renovation'
  | 'extension'
  | 'construction_neuve'
  | 'maison_neuve'
  | 'toiture'
  | 'electricite_seule'
  | 'plomberie_seule'
  | 'isolation'
  | 'chauffage'
  | 'fenetre'
  | 'cuisine'
  | 'salle_de_bain'
  | 'autre';

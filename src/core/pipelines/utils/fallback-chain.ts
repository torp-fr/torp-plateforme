// ─────────────────────────────────────────────────────────────────────────────
// fallback-chain.ts — Never return null; always escalate to the next source
// Implements the cascade pattern: primary → secondary → tertiary → synthetic
// ─────────────────────────────────────────────────────────────────────────────

export interface FallbackResult<T> {
  data: T;
  /** Which step in the chain produced the result */
  source: string;
  /** Is this synthetic/inferred (not fetched from a real API)? */
  isSynthetic: boolean;
  /** Reliability 0–1 (degrades with each fallback step) */
  reliability: number;
  /** Steps that were attempted before reaching this result */
  attemptedSources: string[];
}

export type FallbackStep<T> = {
  name: string;
  /** Base reliability of this source (0–1) */
  reliability: number;
  fn: () => Promise<T | null | undefined>;
};

/**
 * Run a chain of fallback steps in order.
 * Returns the first non-null result with metadata about which step succeeded.
 * If all steps return null/undefined, falls back to `synthetic` if provided.
 * Throws if all steps fail and no synthetic fallback is available.
 */
export async function runFallbackChain<T>(
  steps: FallbackStep<T>[],
  synthetic?: { name: string; fn: () => T }
): Promise<FallbackResult<T>> {
  const attempted: string[] = [];

  for (const step of steps) {
    attempted.push(step.name);
    try {
      const result = await step.fn();
      if (result !== null && result !== undefined) {
        return {
          data: result,
          source: step.name,
          isSynthetic: false,
          reliability: step.reliability,
          attemptedSources: [...attempted],
        };
      }
    } catch (err) {
      // Log but continue to next step
      console.warn(`[FallbackChain] Step "${step.name}" failed: ${(err as Error).message}`);
    }
  }

  if (synthetic) {
    const data = synthetic.fn();
    return {
      data,
      source: synthetic.name,
      isSynthetic: true,
      reliability: 0.1,
      attemptedSources: attempted,
    };
  }

  throw new Error(
    `All fallback steps exhausted: [${attempted.join(', ')}] — no synthetic fallback provided`
  );
}

// ── Geocoding fallback chain ──────────────────────────────────────────────────

export interface GeoCoords {
  lat: number;
  lon: number;
  label?: string;
  score?: number;
}

/**
 * Build a standard geocoding fallback chain.
 * BANO → Nominatim → postal centroid (synthetic)
 */
export function buildGeocodingChain(
  address: string,
  postalCode?: string,
  options?: {
    fetchBano: (address: string) => Promise<GeoCoords | null>;
    fetchNominatim: (address: string) => Promise<GeoCoords | null>;
    getPostalCentroid: (postalCode: string) => GeoCoords | null;
  }
): FallbackStep<GeoCoords>[] {
  if (!options) return [];

  const steps: FallbackStep<GeoCoords>[] = [
    {
      name: 'BANO',
      reliability: 0.95,
      fn: () => options.fetchBano(address),
    },
    {
      name: 'Nominatim',
      reliability: 0.75,
      fn: () => options.fetchNominatim(address),
    },
  ];

  if (postalCode) {
    steps.push({
      name: 'PostalCentroid',
      reliability: 0.4,
      fn: async () => options.getPostalCentroid(postalCode),
    });
  }

  return steps;
}

// ── Enterprise data fallback chain ───────────────────────────────────────────

export interface EnterpriseData {
  siret?: string;
  siren?: string;
  name?: string;
  raisonSociale?: string;
  naf?: string;
  isActive?: boolean;
  capitalSocial?: number;
  dateCreation?: string;
  adresse?: string;
}

/**
 * Build a standard enterprise data fallback chain.
 * Pappers → INSEE SIRENE → DataGouv RGE
 */
export function buildEnterpriseChain(
  siret: string,
  options?: {
    fetchPappers: (siret: string) => Promise<EnterpriseData | null>;
    fetchINSEE: (siret: string) => Promise<EnterpriseData | null>;
    fetchRGE: (siret: string) => Promise<EnterpriseData | null>;
  }
): FallbackStep<EnterpriseData>[] {
  if (!options) return [];

  return [
    {
      name: 'Pappers',
      reliability: 0.95,
      fn: () => options.fetchPappers(siret),
    },
    {
      name: 'INSEE-SIRENE',
      reliability: 0.85,
      fn: () => options.fetchINSEE(siret),
    },
    {
      name: 'DataGouv-RGE',
      reliability: 0.6,
      fn: () => options.fetchRGE(siret),
    },
  ];
}

// ── Regulatory data fallback chain ───────────────────────────────────────────

export interface RegulatoryData {
  plu?: unknown;
  abf?: boolean;
  permits?: unknown[];
  aides?: unknown[];
}

/**
 * Build a regulatory data fallback chain.
 * GeoPortail → DataGouv PLU → synthetic (empty, permissive defaults)
 */
export function buildRegulatoryChain(
  lat: number,
  lon: number,
  options?: {
    fetchGeoportail: (lat: number, lon: number) => Promise<RegulatoryData | null>;
    fetchDataGouv: (lat: number, lon: number) => Promise<RegulatoryData | null>;
  }
): FallbackStep<RegulatoryData>[] {
  if (!options) return [];

  return [
    {
      name: 'Geoportail-Urbanisme',
      reliability: 0.9,
      fn: () => options.fetchGeoportail(lat, lon),
    },
    {
      name: 'DataGouv-PLU',
      reliability: 0.7,
      fn: () => options.fetchDataGouv(lat, lon),
    },
  ];
}

// ── Utility: merge fallback results preferring higher reliability ──────────────

/**
 * Merge two fallback results, field-by-field, preferring the source with
 * higher reliability. Useful for combining partial results from different APIs.
 */
export function mergeFallbackResults<T extends object>(
  primary: FallbackResult<T>,
  secondary: FallbackResult<T>
): FallbackResult<T> {
  const best = primary.reliability >= secondary.reliability ? primary : secondary;
  const other = best === primary ? secondary : primary;

  const merged = { ...other.data, ...best.data };

  // Fill in missing fields from the lower-reliability source
  for (const key of Object.keys(other.data) as (keyof T)[]) {
    if (merged[key] === undefined || merged[key] === null) {
      (merged as Record<keyof T, unknown>)[key] = other.data[key];
    }
  }

  return {
    data: merged,
    source: `${best.source}+${other.source}`,
    isSynthetic: best.isSynthetic && other.isSynthetic,
    reliability: Math.max(primary.reliability, secondary.reliability),
    attemptedSources: [...new Set([...primary.attemptedSources, ...secondary.attemptedSources])],
  };
}

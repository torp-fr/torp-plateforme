// ─────────────────────────────────────────────────────────────────────────────
// AIAPIsHealthCheck — Register all AI/external APIs with APIHealthMonitor.
//
// Call registerAIAPIs(monitor) once at server startup (server.ts).
// Health checks poll every 5 minutes via setInterval in APIHealthMonitor.
// Results visible in admin dashboard: GET /api/v1/admin/api-health
// ─────────────────────────────────────────────────────────────────────────────

import { APIHealthMonitor, type APIConfig } from './APIHealthMonitor.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const TIMEOUT_MS      = 10_000;    // 10 seconds per health check
const INTERVAL_MS     = 5 * 60_000; // check every 5 minutes

// ── Health check functions ────────────────────────────────────────────────────

/** Validate OpenAI is reachable by listing available models. */
export function makeOpenAIHealthCheck(): () => Promise<void> {
  return async () => {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY not configured');

    const resp = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!resp.ok) throw new Error(`OpenAI API returned ${resp.status}`);
  };
}

/** Validate Anthropic is reachable by listing available models. */
export function makeAnthropicHealthCheck(): () => Promise<void> {
  return async () => {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY not configured');

    const resp = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    // Anthropic returns 200 on success; 401 means invalid key (API is reachable)
    if (!resp.ok && resp.status !== 401) {
      throw new Error(`Anthropic API returned ${resp.status}`);
    }
    if (resp.status === 401) {
      throw new Error('Anthropic API key invalid or expired');
    }
  };
}

/**
 * Validate Google Vision is reachable.
 * Uses the operations list endpoint — 400 is acceptable (no operations, but API is up).
 */
export function makeGoogleVisionHealthCheck(): () => Promise<void> {
  return async () => {
    const apiKey    = process.env.GOOGLE_CLOUD_API_KEY;
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;

    if (!apiKey || !projectId) {
      throw new Error('GOOGLE_CLOUD_API_KEY or GOOGLE_CLOUD_PROJECT_ID not configured');
    }

    const url = `https://vision.googleapis.com/v1/projects/${projectId}/operations?key=${apiKey}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });

    // 400 = API reachable but no operations exist; 200 = healthy; anything else = error
    if (resp.status !== 200 && resp.status !== 400) {
      throw new Error(`Google Vision API returned ${resp.status}`);
    }
  };
}

// ── Data API health check functions ───────────────────────────────────────────

/** Validate INSEE Sirene is reachable (open endpoint, no auth). */
export function makeSireneHealthCheck(): () => Promise<void> {
  return async () => {
    const resp = await fetch(
      'https://recherche-entreprises.api.gouv.fr/search?q=test&per_page=1',
      { signal: AbortSignal.timeout(TIMEOUT_MS) }
    );
    if (!resp.ok) throw new Error(`INSEE Sirene returned ${resp.status}`);
  };
}

/** Validate Geoplateforme geocoding is reachable (open endpoint, no auth). */
export function makeGeoplatformeHealthCheck(): () => Promise<void> {
  return async () => {
    const resp = await fetch(
      'https://data.geopf.fr/geocodage/search?q=Paris&limit=1',
      { signal: AbortSignal.timeout(TIMEOUT_MS) }
    );
    if (!resp.ok) throw new Error(`Geoplateforme returned ${resp.status}`);
  };
}

/** Validate BDNB API is reachable (open endpoint, no auth).
 *  Without geo filter the endpoint returns 404 — that's fine, it means the API
 *  is up and responding. Only 5xx signals a real outage.
 */
export function makeBdnbHealthCheck(): () => Promise<void> {
  return async () => {
    const resp = await fetch(
      'https://api.bdnb.io/v0.2/open/batiment_groupe_complet?limit=1',
      { signal: AbortSignal.timeout(TIMEOUT_MS) }
    );
    // 404 = no records without filter (acceptable — API is up)
    if (!resp.ok && resp.status !== 404) throw new Error(`BDNB returned ${resp.status}`);
  };
}

/** Validate API Carto (IGN) is reachable (open endpoint, no auth). */
export function makeApiCartoHealthCheck(): () => Promise<void> {
  return async () => {
    const resp = await fetch(
      'https://apicarto.ign.fr/api/cadastre/commune?code_insee=75056&_limit=1',
      { signal: AbortSignal.timeout(TIMEOUT_MS) }
    );
    if (!resp.ok) throw new Error(`API Carto returned ${resp.status}`);
  };
}

/** Validate Pappers API is reachable (requires key). */
export function makePappersHealthCheck(): () => Promise<void> {
  return async () => {
    const key = process.env.PAPPERS_API_KEY;
    if (!key) throw new Error('PAPPERS_API_KEY not configured');

    const resp = await fetch(
      `https://api.pappers.fr/v2/entreprise?api_token=${key}&siren=443061841`,
      { signal: AbortSignal.timeout(TIMEOUT_MS) }
    );

    if (resp.status === 401 || resp.status === 403) {
      throw new Error('Pappers API key invalid or unauthorized');
    }
    // 404 = SIREN not found but API is reachable (acceptable)
    if (!resp.ok && resp.status !== 404) {
      throw new Error(`Pappers returned ${resp.status}`);
    }
  };
}

// ── Main exports ──────────────────────────────────────────────────────────────

/**
 * Register all AI/external APIs for continuous health monitoring.
 * Call once at server startup — sets up 5-minute periodic checks.
 */
export function registerAIAPIs(monitor: APIHealthMonitor): void {
  const openAICheck     = makeOpenAIHealthCheck();
  const anthropicCheck  = makeAnthropicHealthCheck();
  const googleCheck     = makeGoogleVisionHealthCheck();

  const apis: APIConfig[] = [
    {
      name: 'OpenAI-GPT-4o',
      healthCheckFn: openAICheck,
      timeout_ms: TIMEOUT_MS,
      health_check_interval_ms: INTERVAL_MS,
    },
    {
      name: 'OpenAI-Embeddings',
      healthCheckFn: openAICheck, // OpenAI is online/offline as a whole
      timeout_ms: TIMEOUT_MS,
      health_check_interval_ms: INTERVAL_MS,
    },
    {
      name: 'OpenAI-Vision',
      healthCheckFn: openAICheck,
      timeout_ms: TIMEOUT_MS,
      health_check_interval_ms: INTERVAL_MS,
    },
    {
      name: 'Anthropic-Claude',
      healthCheckFn: anthropicCheck,
      timeout_ms: TIMEOUT_MS,
      health_check_interval_ms: INTERVAL_MS,
    },
    {
      name: 'Google-Vision-OCR',
      healthCheckFn: googleCheck,
      timeout_ms: TIMEOUT_MS,
      health_check_interval_ms: INTERVAL_MS,
    },
  ];

  for (const api of apis) {
    monitor.registerAPI(api);
  }

  console.info(`[AIAPIsHealthCheck] Registered ${apis.length} AI APIs for health monitoring`);
}

/**
 * Register all data/location/enterprise APIs for health monitoring.
 * Call once at server startup alongside registerAIAPIs().
 */
export function registerDataAPIs(monitor: APIHealthMonitor): void {
  const apis: APIConfig[] = [
    {
      name: 'INSEE-SIRENE',
      healthCheckFn: makeSireneHealthCheck(),
      timeout_ms: TIMEOUT_MS,
      health_check_interval_ms: INTERVAL_MS,
    },
    {
      name: 'Geoplateforme',
      healthCheckFn: makeGeoplatformeHealthCheck(),
      timeout_ms: TIMEOUT_MS,
      health_check_interval_ms: INTERVAL_MS,
    },
    {
      name: 'BDNB',
      healthCheckFn: makeBdnbHealthCheck(),
      timeout_ms: TIMEOUT_MS,
      health_check_interval_ms: INTERVAL_MS,
    },
    {
      name: 'API-Carto',
      healthCheckFn: makeApiCartoHealthCheck(),
      timeout_ms: TIMEOUT_MS,
      health_check_interval_ms: INTERVAL_MS,
    },
    {
      name: 'Pappers',
      healthCheckFn: makePappersHealthCheck(),
      timeout_ms: TIMEOUT_MS,
      health_check_interval_ms: INTERVAL_MS,
    },
  ];

  for (const api of apis) {
    monitor.registerAPI(api);
  }

  console.info(`[AIAPIsHealthCheck] Registered ${apis.length} data APIs for health monitoring`);
}

// ── Enrichment API health check functions ─────────────────────────────────────

/** Validate Géorisques API is reachable (open endpoint, no auth). */
export function makeGeorisquesHealthCheck(): () => Promise<void> {
  return async () => {
    // Use Paris coordinates — seismic zone endpoint is lightweight
    const resp = await fetch(
      'https://www.georisques.gouv.fr/api/v1/zonage_sismique?latlon=2.3522,48.8566',
      { signal: AbortSignal.timeout(TIMEOUT_MS) }
    );
    if (!resp.ok) throw new Error(`Géorisques returned ${resp.status}`);
  };
}

/** Validate ADEME RGE dataset is reachable (open endpoint, no auth). */
export function makeRGEHealthCheck(): () => Promise<void> {
  return async () => {
    const resp = await fetch(
      'https://data.ademe.fr/data-fair/api/v1/datasets/6x4i1u8yqh1sfhis83l1gw6f/lines?size=1',
      { signal: AbortSignal.timeout(TIMEOUT_MS) }
    );
    if (!resp.ok) throw new Error(`ADEME RGE returned ${resp.status}`);
  };
}

/** Validate ADEME DPE dataset is reachable (open endpoint, no auth). */
export function makeDPEHealthCheck(): () => Promise<void> {
  return async () => {
    const resp = await fetch(
      'https://data.ademe.fr/data-fair/api/v1/datasets/meg-83tjwtg8dyz4vv7h1dqe/lines?size=1',
      { signal: AbortSignal.timeout(TIMEOUT_MS) }
    );
    if (!resp.ok) throw new Error(`ADEME DPE returned ${resp.status}`);
  };
}

/**
 * Register all enrichment APIs (Géorisques, RGE, DPE) for health monitoring.
 * Call once at server startup alongside registerAIAPIs() and registerDataAPIs().
 */
export function registerEnrichmentAPIs(monitor: APIHealthMonitor): void {
  const apis: APIConfig[] = [
    {
      name: 'Georisques',
      healthCheckFn: makeGeorisquesHealthCheck(),
      timeout_ms: TIMEOUT_MS,
      health_check_interval_ms: INTERVAL_MS,
    },
    {
      name: 'ADEME-RGE',
      healthCheckFn: makeRGEHealthCheck(),
      timeout_ms: TIMEOUT_MS,
      health_check_interval_ms: INTERVAL_MS,
    },
    {
      name: 'ADEME-DPE',
      healthCheckFn: makeDPEHealthCheck(),
      timeout_ms: TIMEOUT_MS,
      health_check_interval_ms: INTERVAL_MS,
    },
  ];

  for (const api of apis) {
    monitor.registerAPI(api);
  }

  console.info(`[AIAPIsHealthCheck] Registered ${apis.length} enrichment APIs for health monitoring`);
}

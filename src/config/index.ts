/**
 * config/index.ts — Centralized server-side configuration
 *
 * Single source of truth for all env vars used by the pipeline worker.
 * Validates required vars at startup and provides typed accessors.
 *
 * Usage:
 *   import { config, assertConfig } from '../config/index.js';
 *
 *   assertConfig(); // call once at startup — throws if required vars missing
 *   const url = config.supabase.url;
 */

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function env(key: string, fallback?: string): string {
  const val = process.env[key];
  if (val !== undefined && val !== '') return val;
  if (fallback !== undefined) return fallback;
  return '';
}

function envNumber(key: string, fallback: number): number {
  const val = process.env[key];
  const n = val ? Number(val) : NaN;
  return isNaN(n) ? fallback : n;
}

function envBool(key: string, fallback: boolean): boolean {
  const val = process.env[key];
  if (!val) return fallback;
  return val.toLowerCase() === 'true' || val === '1';
}

// ─────────────────────────────────────────────────────────────────────────────
// Config object
// ─────────────────────────────────────────────────────────────────────────────

export const config = {
  env: env('NODE_ENV', 'development') as 'development' | 'staging' | 'production',

  server: {
    port:      envNumber('PORT', 3001),
    clientUrl: env('CLIENT_URL', 'http://localhost:3000'),
  },

  supabase: {
    url:            env('SUPABASE_URL'),
    anonKey:        env('SUPABASE_ANON_KEY'),
    serviceRoleKey: env('SUPABASE_SERVICE_ROLE_KEY'),
  },

  auth: {
    jwtSecret:    env('JWT_SECRET', 'change-me-in-production'),
    tokenExpiry:  envNumber('JWT_TOKEN_EXPIRY_SECONDS', 3600),
  },

  apis: {
    pappers: {
      apiKey:   env('PAPPERS_API_KEY'),
      endpoint: env('PAPPERS_API_ENDPOINT', 'https://api.pappers.fr/v2'),
    },
    ign: {
      apiKey:   env('IGN_API_KEY'),
      endpoint: env('IGN_GEOPORTAIL_ENDPOINT', 'https://wxs.ign.fr'),
    },
    bano: {
      endpoint: env('BANO_API_ENDPOINT', 'https://api-adresse.data.gouv.fr'),
    },
    nominatim: {
      endpoint:  env('NOMINATIM_API_ENDPOINT', 'https://nominatim.openstreetmap.org'),
      userAgent: env('NOMINATIM_USER_AGENT', 'TORP-App/1.0'),
    },
    datagouv: {
      endpoint: env('DATAGOUV_API_ENDPOINT', 'https://www.data.gouv.fr/api/1'),
    },
    legifrance: {
      apiKey:   env('LEGIFRANCE_API_KEY'),
      endpoint: env('LEGIFRANCE_API_ENDPOINT', 'https://sandbox.piste.gouv.fr'),
    },
    trustpilot: {
      apiKey:   env('TRUSTPILOT_API_KEY'),
      endpoint: env('TRUSTPILOT_API_ENDPOINT', 'https://api.trustpilot.com/v1'),
    },
  },

  pipeline: {
    timeoutMs:      envNumber('PIPELINE_TIMEOUT_MS', 30000),
    apiTimeoutMs:   envNumber('API_CALL_TIMEOUT_MS', 5000),
    retryMaxAttempts: envNumber('RETRY_MAX_ATTEMPTS', 3),
    retryBackoffMs: envNumber('RETRY_BACKOFF_MS', 1000),
    jwtSecret:      env('PIPELINE_JWT_SECRET'),
  },

  cache: {
    entrepriseDays:      envNumber('CACHE_TTL_ENTREPRISE_DAYS', 30),
    certificationsDays:  envNumber('CACHE_TTL_CERTIFICATIONS_DAYS', 7),
    reputationHours:     envNumber('CACHE_TTL_REPUTATION_HOURS', 24),
    pluDays:             envNumber('CACHE_TTL_PLU_DAYS', 90),
    abfDays:             envNumber('CACHE_TTL_ABF_DAYS', 365),
    aidesDays:           envNumber('CACHE_TTL_AIDES_DAYS', 7),
  },

  storage: {
    bucketDevis:   env('STORAGE_BUCKET_DEVIS', 'devis_uploads'),
    bucketQrcodes: env('STORAGE_BUCKET_QRCODES', 'qr_codes'),
  },

  ocr: {
    tesseractLang: env('TESSERACT_LANG', 'fra'),
  },

  app: {
    publicBaseUrl: env('PUBLIC_BASE_URL', 'https://torp.fr'),
  },

  features: {
    /** Trustpilot B2B API — disabled if key not set */
    trustpilotEnabled: !!env('TRUSTPILOT_API_KEY'),
    /** IGN cadastre — disabled if key not set */
    ignEnabled: !!env('IGN_API_KEY'),
    /** Légifrance — disabled if key not set */
    legifranceEnabled: !!env('LEGIFRANCE_API_KEY'),
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Startup validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Required env vars for the pipeline worker.
 * Call once at application startup (before first DB or API call).
 */
const REQUIRED: { key: string; description: string }[] = [
  { key: 'SUPABASE_URL',              description: 'Supabase project URL' },
  { key: 'SUPABASE_ANON_KEY',         description: 'Supabase anon key (used for auth token validation)' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', description: 'Supabase service role key (never expose to frontend)' },
  { key: 'PUBLIC_BASE_URL',           description: 'Public base URL for QR code links (e.g. https://torp.fr)' },
];

export function assertConfig(): void {
  const missing: string[] = [];

  for (const { key, description } of REQUIRED) {
    if (!process.env[key]) {
      missing.push(`  ✗ ${key} — ${description}`);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `[config] Missing required environment variables:\n${missing.join('\n')}\n\n` +
      `Copy .env.example to .env and fill in the missing values.`
    );
  }

  // Warn about optional but recommended vars
  const recommended = [
    'PAPPERS_API_KEY',
    'IGN_API_KEY',
    'LEGIFRANCE_API_KEY',
  ];

  for (const key of recommended) {
    if (!process.env[key]) {
      console.warn(`[config] Optional env var not set: ${key} (some pipeline features will be limited)`);
    }
  }
}

/**
 * Returns a summary of the current config for health checks / diagnostics.
 * Redacts sensitive values.
 */
export function configSummary(): Record<string, unknown> {
  return {
    env:         config.env,
    supabase:    { url: config.supabase.url, serviceRoleKey: config.supabase.serviceRoleKey ? '[SET]' : '[MISSING]' },
    features:    config.features,
    pipeline:    config.pipeline,
    apis: {
      pappers:    config.apis.pappers.apiKey     ? '[SET]' : '[NOT SET]',
      ign:        config.apis.ign.apiKey         ? '[SET]' : '[NOT SET]',
      legifrance: config.apis.legifrance.apiKey  ? '[SET]' : '[NOT SET]',
      trustpilot: config.apis.trustpilot.apiKey  ? '[SET]' : '[NOT SET]',
      bano:       '[FREE — no key needed]',
      datagouv:   '[FREE — no key needed]',
      nominatim:  '[FREE — no key needed]',
    },
    storage: config.storage,
    publicBaseUrl: config.app.publicBaseUrl,
  };
}

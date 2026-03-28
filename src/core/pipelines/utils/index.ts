// ─────────────────────────────────────────────────────────────────────
// Pipeline utilities — shared across all pipeline handlers
// ─────────────────────────────────────────────────────────────────────

import type { APICallConfig, DataNeed, ProjectType } from '../types/index.js';

const API_CALL_TIMEOUT_MS = parseInt(process.env.API_CALL_TIMEOUT_MS ?? '5000', 10);
const RETRY_MAX_ATTEMPTS = parseInt(process.env.RETRY_MAX_ATTEMPTS ?? '3', 10);
const RETRY_BACKOFF_MS = parseInt(process.env.RETRY_BACKOFF_MS ?? '1000', 10);

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getAuthHeaders(url: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (url.includes('pappers.fr') && process.env.PAPPERS_API_KEY) {
    headers['Authorization'] = `Bearer ${process.env.PAPPERS_API_KEY}`;
  }
  if (url.includes('piste.gouv.fr') && process.env.LEGIFRANCE_API_KEY) {
    headers['Authorization'] = `Bearer ${process.env.LEGIFRANCE_API_KEY}`;
  }
  if (url.includes('wxs.ign.fr')) {
    // IGN key is typically part of the URL path, no header needed
  }
  if (url.includes('nominatim.openstreetmap.org')) {
    headers['User-Agent'] = process.env.NOMINATIM_USER_AGENT ?? 'TORP-App/1.0';
  }

  return headers;
}

/**
 * Fetch with retry + exponential backoff.
 * Returns fallback value if all retries are exhausted and fallback is defined.
 * Throws if no fallback and all retries fail.
 */
export async function callAPIWithRetry<T>(config: APICallConfig): Promise<T> {
  const maxAttempts = config.retries ?? RETRY_MAX_ATTEMPTS;
  const timeout = config.timeout ?? API_CALL_TIMEOUT_MS;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(config.url, {
        method: config.method,
        signal: controller.signal,
        headers: { ...getAuthHeaders(config.url), ...(config.headers ?? {}) },
        body: config.body ? JSON.stringify(config.body) : undefined,
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return (await response.json()) as T;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < maxAttempts) {
        const backoff = RETRY_BACKOFF_MS * Math.pow(2, attempt);
        await sleep(backoff);
      }
    }
  }

  // All retries exhausted
  if (config.fallback !== undefined) {
    console.warn(`[API] All retries failed for ${config.url} — using fallback`);
    return config.fallback as T;
  }

  throw lastError ?? new Error(`API call failed: ${config.url}`);
}

/**
 * Resolves which data needs to fetch based on project type.
 * Used by ContextRegulationPipeline.
 */
export function resolveDataNeeds(projectType: ProjectType): DataNeed[] {
  const needs: Record<ProjectType, DataNeed[]> = {
    piscine:            ['PLU', 'ABF', 'PERMITS', 'UTILITY'],
    renovation:         ['ABF', 'PERMITS', 'DPE', 'AIDES'],
    extension:          ['PLU', 'ABF', 'PERMITS'],
    construction_neuve: ['PLU', 'ABF', 'PERMITS', 'UTILITY'],
    maison_neuve:       ['PLU', 'ABF', 'PERMITS', 'UTILITY'],
    toiture:            ['ABF', 'PERMITS'],
    electricite_seule:  [],
    plomberie_seule:    [],
    isolation:          ['DPE', 'AIDES'],
    chauffage:          ['DPE', 'AIDES'],
    fenetre:            ['ABF'],
    cuisine:            [],
    salle_de_bain:      [],
    autre:              ['ABF'],
  };

  return needs[projectType] ?? ['ABF'];
}

/**
 * Category → regulatory domain mapping.
 * Used by DevisParsingPipeline to assign domain to each parsed item.
 */
export const CATEGORY_TO_DOMAIN: Record<string, string> = {
  electricite: 'électrique',
  plomberie:   'hydraulique',
  toiture:     'structure',
  structure:   'structure',
  chauffage:   'thermique',
  isolation:   'thermique',
  menuiserie:  'enveloppe',
  carrelage:   'finitions',
  peinture:    'finitions',
};

/**
 * French BTP keyword → category classification.
 * Used by DevisParsingPipeline.classifyItemCategory().
 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  electricite: ['électr', 'câbl', 'tableau', 'prise', 'interrupteur', 'circuit', 'tgbt', 'consuel', 'disjoncteur'],
  plomberie:   ['plomb', 'tuyau', 'eau', 'sanitaire', 'robinet', 'filtr', 'evacuation', 'wc', 'douche', 'baignoire'],
  structure:   ['béton', 'beton', 'fondation', 'terrassement', 'ferraillag', 'dalle', 'maçon', 'gros oeuvre', 'parpaing'],
  chauffage:   ['chauffage', 'chaudière', 'pompe chaleur', 'vmc', 'climatisation', 'thermopompe', 'radiateur'],
  toiture:     ['toiture', 'couverture', 'ardoise', 'tuile', 'zinguerie', 'charpente', 'gouttière'],
  isolation:   ['isolation', 'laine', 'isolant', 'pare-vapeur', 'ite', 'iti', 'ouate', 'polyurethane'],
  menuiserie:  ['menuiserie', 'fenêtre', 'porte', 'velux', 'volet', 'portail', 'parquet'],
  carrelage:   ['carrelage', 'faïence', 'sol', 'revêtement', 'pose carrelage'],
  peinture:    ['peinture', 'enduit', 'ravalement', 'crépi', 'lasure'],
};

export function classifyItemCategory(description: string): string {
  const normalized = description
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => normalized.includes(kw))) {
      return category;
    }
  }
  return 'autre';
}

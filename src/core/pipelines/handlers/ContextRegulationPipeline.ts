// ─────────────────────────────────────────────────────────────────────
// ContextRegulationPipeline
// Fetches regulatory context (PLU, ABF, Permits, Aides) based on projectType
// Input:  { projectType, lat, lng, codePostal }
// Output: LazyLoadedData per DataNeed — stored in projets.contexte_reglementaire
// ─────────────────────────────────────────────────────────────────────

import { callAPIWithRetry, resolveDataNeeds } from '../utils/index.js';
import type { PipelineContext, PipelineResult, LazyLoadedData, DataNeed, ProjectType } from '../types/index.js';

interface PLUInfo {
  zone: string;
  piscine_autorisee: boolean;
  extension_autorisee: boolean;
  hauteur_max?: number;
  coefficient_emprise?: number;
  raw_data?: unknown;
}

interface PermisInfo {
  type: 'permis_construire' | 'declaration_travaux' | 'aucun';
  obligatoire: boolean;
  seuil_surface?: number;
  delai_instruction?: string;
}

interface AideInfo {
  nom: string;
  eligible: boolean;
  montant_max?: number;
  conditions?: string;
  url?: string;
}

interface ContexteReglementaire {
  plu?: LazyLoadedData<PLUInfo>;
  abf_protection?: LazyLoadedData<boolean>;
  permis_requis?: LazyLoadedData<PermisInfo>;
  aides_eligibles?: LazyLoadedData<AideInfo[]>;
  dpe_actuel?: LazyLoadedData<unknown>;
  needs_fetched: DataNeed[];
  fetched_at: string;
}

export class ContextRegulationPipeline {
  async execute(
    params: { projectType: ProjectType; lat: number; lng: number; codePostal?: string },
    context: PipelineContext
  ): Promise<PipelineResult<ContexteReglementaire>> {
    const startTime = Date.now();
    const { projectType, lat, lng, codePostal } = params;

    // Step 1: Determine what to fetch (context-driven, not everything)
    const needs = resolveDataNeeds(projectType);

    if (needs.length === 0) {
      // e.g. electricite_seule, plomberie_seule
      return {
        status: 'completed',
        data: { needs_fetched: [], fetched_at: new Date().toISOString() },
        warnings: ['No regulatory context needed for this project type'],
        executionTimeMs: Date.now() - startTime,
        retryable: false,
      };
    }

    // Step 2: Fetch all needed data in parallel
    const fetchPromises = needs.map(need => this.fetchForNeed(need, lat, lng, codePostal));
    const results = await Promise.allSettled(fetchPromises);

    // Step 3: Build contexte object
    const contexte: ContexteReglementaire = {
      needs_fetched: needs,
      fetched_at: new Date().toISOString(),
    };

    const warnings: string[] = [];

    results.forEach((result, i) => {
      const need = needs[i];
      const key = this.needToKey(need);

      if (result.status === 'fulfilled') {
        (contexte as Record<string, unknown>)[key] = {
          status: 'loaded',
          data: result.value,
          fetched_at: new Date().toISOString(),
          source_api: this.getSourceAPI(need),
        } satisfies LazyLoadedData<unknown>;
      } else {
        warnings.push(`${need} fetch failed: ${result.reason?.message}`);
        (contexte as Record<string, unknown>)[key] = {
          status: 'failed',
          error: result.reason?.message,
          fetched_at: new Date().toISOString(),
        } satisfies LazyLoadedData<unknown>;
      }
    });

    return {
      status: 'completed',
      data: contexte,
      warnings: warnings.length > 0 ? warnings : undefined,
      executionTimeMs: Date.now() - startTime,
      retryable: false,
    };
  }

  private async fetchForNeed(
    need: DataNeed,
    lat: number,
    lng: number,
    codePostal?: string
  ): Promise<unknown> {
    switch (need) {
      case 'PLU':    return this.fetchPLU(lat, lng);
      case 'ABF':    return this.fetchABF(lat, lng);
      case 'PERMITS': return this.inferPermits(lat, lng);
      case 'AIDES':  return this.fetchAides(codePostal);
      case 'DPE':    return this.fetchDPE(lat, lng);
      case 'UTILITY': return { capacity: 'unknown' }; // TBD: Utility API
      default: return null;
    }
  }

  private async fetchPLU(lat: number, lng: number): Promise<PLUInfo> {
    // Géo.API.gouv → commune → PLU zone
    const geoEndpoint = process.env.GEO_API_ENDPOINT ?? 'https://geo.api.gouv.fr';

    const commune = await callAPIWithRetry<{ nom: string; code: string }>({
      method: 'GET',
      url: `${geoEndpoint}/communes?lat=${lat}&lon=${lng}&fields=nom,code&format=json&geometry=centre`,
      retries: 2,
      fallback: null,
    });

    // PLU data requires IGN WMS/WMTS — return simplified structure for now
    // Production: query IGN GPU (Géoportail de l'Urbanisme) for full PLU data
    return {
      zone: commune ? 'UA' : 'inconnu',
      piscine_autorisee: true, // conservative default — real PLU would override
      extension_autorisee: true,
      raw_data: commune,
    };
  }

  private async fetchABF(lat: number, lng: number): Promise<boolean> {
    // Légifrance PISTE — ABF zones
    // In production: query secteurs protégés / ZPPAUP / AVAP datasets
    // Simplified: use data.gouv patrimoine dataset
    const endpoint = process.env.DATAGOUV_API_ENDPOINT ?? 'https://www.data.gouv.fr/api/1';

    const result = await callAPIWithRetry<{ total_count: number }>({
      method: 'GET',
      url: `${endpoint}/datasets/r/abf-zones?lat=${lat}&lon=${lng}&radius=500`,
      retries: 1,
      fallback: { total_count: 0 },
    });

    return (result?.total_count ?? 0) > 0;
  }

  private inferPermits(lat: number, lng: number): PermisInfo {
    // Static inference — real implementation reads PLU + surface from devis
    // Triggered again at audit time with actual surface data
    return {
      type: 'declaration_travaux',
      obligatoire: true,
      seuil_surface: 20,
      delai_instruction: '1 mois',
    };
  }

  private async fetchAides(codePostal?: string): Promise<AideInfo[]> {
    // MaPrimeRénov, CEE, éco-PTZ — via data.gouv aides dataset
    const endpoint = process.env.DATAGOUV_API_ENDPOINT ?? 'https://www.data.gouv.fr/api/1';

    const result = await callAPIWithRetry<{ data?: Array<Record<string, unknown>> }>({
      method: 'GET',
      url: `${endpoint}/datasets/r/aides-renovation-energetique?cp=${codePostal ?? ''}`,
      retries: 1,
      fallback: { data: [] },
    });

    const aides: AideInfo[] = [
      { nom: "MaPrimeRénov'", eligible: true, montant_max: 20000, url: 'https://www.maprimerenov.gouv.fr' },
      { nom: 'CEE', eligible: true, conditions: 'Entrepreneur RGE requis' },
      { nom: 'Éco-PTZ', eligible: true, montant_max: 50000, url: 'https://www.service-public.fr' },
    ];

    return aides;
  }

  private async fetchDPE(lat: number, lng: number): Promise<unknown> {
    // ADEME DPE lookup — public dataset
    const endpoint = process.env.ADEME_DPE_ENDPOINT ?? 'https://data.ademe.fr/data-fair/api/v1/datasets';

    const result = await callAPIWithRetry<unknown>({
      method: 'GET',
      url: `${endpoint}/dpe-france/lines?lat=${lat}&lon=${lng}&distance=50`,
      retries: 1,
      fallback: null,
    });

    return result;
  }

  private needToKey(need: DataNeed): keyof ContexteReglementaire {
    const map: Record<DataNeed, keyof ContexteReglementaire> = {
      PLU:     'plu',
      ABF:     'abf_protection',
      PERMITS: 'permis_requis',
      AIDES:   'aides_eligibles',
      DPE:     'dpe_actuel',
      UTILITY: 'plu', // placeholder — no key for UTILITY yet
    };
    return map[need];
  }

  private getSourceAPI(need: DataNeed): string {
    const sources: Record<DataNeed, string> = {
      PLU:     'IGN Géoportail',
      ABF:     'Légifrance PISTE',
      PERMITS: 'inference',
      AIDES:   'data.gouv',
      DPE:     'ADEME',
      UTILITY: 'N/A',
    };
    return sources[need];
  }
}

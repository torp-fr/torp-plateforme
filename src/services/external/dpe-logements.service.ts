// ─────────────────────────────────────────────────────────────────────────────
// dpe-logements.service.ts — DPE (Diagnostic de Performance Énergétique) data
//
// Free public API — no auth required.
// Dataset: DPE Logements existants depuis juillet 2021 (14M+ records)
// Base:    https://data.ademe.fr/data-fair/api/v1/datasets/meg-83tjwtg8dyz4vv7h1dqe/lines
// ─────────────────────────────────────────────────────────────────────────────

import { structuredLogger } from '@/services/observability/structured-logger.js';

const TIMEOUT_MS = 12_000;
const DATASET_ID = 'meg-83tjwtg8dyz4vv7h1dqe';
const BASE_URL   = `https://data.ademe.fr/data-fair/api/v1/datasets/${DATASET_ID}/lines`;

// ── Types ─────────────────────────────────────────────────────────────────────

/** DPE energy rating: A (best) to G (worst) */
export type EnergyLabel = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | null;

export interface DPELogement {
  numero_dpe:         string | null;
  date_etablissement: string | null;   // ISO date
  type_batiment:      string | null;   // e.g. "maison", "appartement"
  adresse:            string | null;
  code_postal:        string | null;
  commune:            string | null;

  // Energy performance
  etiquette_energie:  EnergyLabel;
  etiquette_ges:      EnergyLabel;
  conso_energie_ep:   number | null;   // kWh/m²/an (énergie primaire)
  emission_ges:       number | null;   // kgCO2eq/m²/an
  surface_habitable:  number | null;   // m²

  // Heating/energy type
  type_energie_chauffage: string | null;
  type_energie_ecs:       string | null;   // Eau Chaude Sanitaire

  source: 'ademe-dpe';
}

export interface DPESearchResult {
  dpe_records: DPELogement[];
  total:       number;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class DPELogementsService {

  /**
   * Search DPE records by postal code (code postal).
   * Returns the most recent DPE records for the area.
   */
  async searchByPostalCode(
    codePostal: string,
    limit = 20
  ): Promise<DPESearchResult> {
    try {
      const params = new URLSearchParams({
        qs:   `code_postal_ban:"${codePostal}"`,
        size: String(limit),
        sort: 'date_etablissement_dpe:desc',
      });

      const url  = `${BASE_URL}?${params}`;
      const resp = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!resp.ok) throw new Error(`ADEME DPE API returned ${resp.status}`);

      const data = await resp.json() as { results?: any[]; total?: number };
      const results = data.results ?? [];

      return {
        dpe_records: results.map(r => this.mapDPE(r)),
        total:       data.total ?? results.length,
      };
    } catch (err) {
      structuredLogger.warn({ message: 'ADEME DPE postal code search failed', codePostal, error: String(err) });
      throw err;
    }
  }

  /**
   * Search DPE records near a location (geographic radius search).
   */
  async searchNearLocation(
    lat: number,
    lng: number,
    radiusKm = 1,
    limit    = 20
  ): Promise<DPESearchResult> {
    try {
      const params = new URLSearchParams({
        geo_distance: `${radiusKm * 1000},${lat},${lng}`,
        size:         String(limit),
        sort:         'date_etablissement_dpe:desc',
      });

      const url  = `${BASE_URL}?${params}`;
      const resp = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!resp.ok) throw new Error(`ADEME DPE API returned ${resp.status}`);

      const data = await resp.json() as { results?: any[]; total?: number };
      const results = data.results ?? [];

      return {
        dpe_records: results.map(r => this.mapDPE(r)),
        total:       data.total ?? results.length,
      };
    } catch (err) {
      structuredLogger.warn({ message: 'ADEME DPE location search failed', lat, lng, error: String(err) });
      throw err;
    }
  }

  /**
   * Get a specific DPE record by its number.
   */
  async getDPEByNumber(numeroDpe: string): Promise<DPELogement | null> {
    try {
      const params = new URLSearchParams({
        qs:   `numero_dpe:"${numeroDpe}"`,
        size: '1',
      });

      const url  = `${BASE_URL}?${params}`;
      const resp = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!resp.ok) throw new Error(`ADEME DPE API returned ${resp.status}`);

      const data = await resp.json() as { results?: any[] };
      if (!data.results?.length) return null;
      return this.mapDPE(data.results[0]);
    } catch (err) {
      structuredLogger.warn({ message: 'ADEME DPE lookup by number failed', numeroDpe, error: String(err) });
      throw err;
    }
  }

  /**
   * Compute the average energy performance for a postal code.
   * Useful for benchmarking renovation potential.
   */
  async getAreaEnergyStats(codePostal: string): Promise<{
    average_conso_ep: number | null;
    label_distribution: Record<string, number>;
    total_records: number;
  }> {
    const { dpe_records, total } = await this.searchByPostalCode(codePostal, 100);

    if (!dpe_records.length) {
      return { average_conso_ep: null, label_distribution: {}, total_records: 0 };
    }

    const labelDist: Record<string, number> = {};
    let sumConso = 0;
    let countConso = 0;

    for (const dpe of dpe_records) {
      if (dpe.etiquette_energie) {
        labelDist[dpe.etiquette_energie] = (labelDist[dpe.etiquette_energie] ?? 0) + 1;
      }
      if (dpe.conso_energie_ep != null) {
        sumConso += dpe.conso_energie_ep;
        countConso++;
      }
    }

    return {
      average_conso_ep:   countConso > 0 ? Math.round(sumConso / countConso) : null,
      label_distribution: labelDist,
      total_records:      total,
    };
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private mapDPE(r: any): DPELogement {
    return {
      numero_dpe:             r.numero_dpe             ?? null,
      date_etablissement:     r.date_etablissement_dpe ?? null,
      type_batiment:          r.type_batiment          ?? null,
      adresse:                r.adresse_ban            ?? null,
      code_postal:            r.code_postal_ban        ?? null,
      commune:                r.nom_commune_ban        ?? null,
      etiquette_energie:      this.toLabel(r.etiquette_dpe),
      etiquette_ges:          this.toLabel(r.etiquette_ges),
      conso_energie_ep:       r.conso_5_usages_par_m2_ep != null
                                ? Number(r.conso_5_usages_par_m2_ep) : null,
      emission_ges:           r.emission_ges_5_usages != null
                                ? Number(r.emission_ges_5_usages) : null,
      surface_habitable:      r.surface_habitable_logement != null
                                ? Number(r.surface_habitable_logement) : null,
      type_energie_chauffage: r.type_energie_n1 ?? null,
      type_energie_ecs:       r.type_energie_n2 ?? null,
      source:                 'ademe-dpe',
    };
  }

  private toLabel(v: unknown): EnergyLabel {
    if (typeof v !== 'string') return null;
    const upper = v.trim().toUpperCase() as EnergyLabel;
    return ['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(upper as string)
      ? upper
      : null;
  }
}

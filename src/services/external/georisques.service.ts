// ─────────────────────────────────────────────────────────────────────────────
// georisques.service.ts — Natural hazards data via Géorisques (BRGM/MTES)
//
// Free public API — no auth required.
// Unified risk report: https://www.georisques.gouv.fr/api/v1/resultats_rapport_risque
// Seismic zones:       https://www.georisques.gouv.fr/api/v1/zonage_sismique
// ─────────────────────────────────────────────────────────────────────────────

import { structuredLogger } from '@/services/observability/structured-logger.js';

const TIMEOUT_MS = 10_000;
const BASE_URL   = 'https://www.georisques.gouv.fr/api/v1';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NaturalHazard {
  type:        string;   // e.g. "Inondation", "Mouvement de terrain"
  present:     boolean;
  description: string | null;
}

export interface TechnologicalHazard {
  type:        string;   // e.g. "ICPE", "Canalisations"
  present:     boolean;
  description: string | null;
}

export interface SeismicZone {
  code_zone:      string;  // "1" to "5"
  zone_sismicite: string;  // e.g. "1 - TRES FAIBLE", "3 - MODERE"
}

export interface GeorisquesRiskReport {
  lat:                    number;
  lng:                    number;
  commune:                string | null;
  url_rapport:            string | null;
  risques_naturels:       NaturalHazard[];
  risques_technologiques: TechnologicalHazard[];
  seismic_zone:           SeismicZone | null;
  source:                 'georisques';
}

// ── Service ───────────────────────────────────────────────────────────────────

export class GeorisquesService {

  /**
   * Get the full natural + technological risk report for a location.
   * The unified endpoint returns risk presence flags for the commune.
   */
  async getRiskReport(lat: number, lng: number): Promise<GeorisquesRiskReport> {
    const [report, seismic] = await Promise.allSettled([
      this.fetchRiskReport(lat, lng),
      this.fetchSeismicZone(lat, lng),
    ]);

    const reportData  = report.status  === 'fulfilled' ? report.value  : null;
    const seismicData = seismic.status === 'fulfilled' ? seismic.value : null;

    return {
      lat,
      lng,
      commune:                reportData?.commune          ?? null,
      url_rapport:            reportData?.url              ?? null,
      risques_naturels:       reportData?.risquesNaturels  ?? [],
      risques_technologiques: reportData?.risquesTechnologiques ?? [],
      seismic_zone:           seismicData,
      source:                 'georisques',
    };
  }

  /**
   * Get seismic zone classification for coordinates.
   */
  async getSeismicZone(lat: number, lng: number): Promise<SeismicZone | null> {
    return this.fetchSeismicZone(lat, lng);
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private async fetchRiskReport(lat: number, lng: number): Promise<{
    commune: string | null;
    url: string | null;
    risquesNaturels: NaturalHazard[];
    risquesTechnologiques: TechnologicalHazard[];
  }> {
    const url = `${BASE_URL}/resultats_rapport_risque?latlon=${lng},${lat}&rayon=100`;
    const resp = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!resp.ok) {
      throw new Error(`Géorisques risk report returned ${resp.status}`);
    }

    const data = await resp.json() as {
      commune?:                  string;
      url?:                      string;
      risquesNaturels?:          Array<{ type?: string; present?: boolean; lib_risque_jo?: string }>;
      risquesTechnologiques?:    Array<{ type?: string; present?: boolean; lib_risque_jo?: string }>;
    };

    return {
      commune: data.commune ?? null,
      url:     data.url     ?? null,
      risquesNaturels: (data.risquesNaturels ?? []).map(r => ({
        type:        r.type ?? r.lib_risque_jo ?? 'Inconnu',
        present:     r.present ?? false,
        description: r.lib_risque_jo ?? null,
      })),
      risquesTechnologiques: (data.risquesTechnologiques ?? []).map(r => ({
        type:        r.type ?? r.lib_risque_jo ?? 'Inconnu',
        present:     r.present ?? false,
        description: r.lib_risque_jo ?? null,
      })),
    };
  }

  private async fetchSeismicZone(lat: number, lng: number): Promise<SeismicZone | null> {
    try {
      const url  = `${BASE_URL}/zonage_sismique?latlon=${lng},${lat}`;
      const resp = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!resp.ok) {
        structuredLogger.warn({ message: 'Géorisques seismic zone failed', lat, lng, status: resp.status });
        return null;
      }

      const data = await resp.json() as { data?: Array<{ code_zone?: string; zone_sismicite?: string }> };
      const zone = data.data?.[0];
      if (!zone) return null;

      return {
        code_zone:      zone.code_zone      ?? '0',
        zone_sismicite: zone.zone_sismicite ?? 'Inconnu',
      };
    } catch (err) {
      structuredLogger.warn({ message: 'Géorisques seismic zone error', lat, lng, error: String(err) });
      return null;
    }
  }
}

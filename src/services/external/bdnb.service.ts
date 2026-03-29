// ─────────────────────────────────────────────────────────────────────────────
// bdnb.service.ts — Base de Données Nationale des Bâtiments (BDNB)
//
// 32M+ buildings in France with construction characteristics, energy class,
// DPE data, surface estimates, etc.
//
// API: https://api.bdnb.io  (open access, no auth for basic queries)
// Docs: https://api.bdnb.io/docs
// ─────────────────────────────────────────────────────────────────────────────

import { structuredLogger } from '@/services/observability/structured-logger.js';

const TIMEOUT_MS = 10_000;
const BDNB_BASE  = 'https://api.bdnb.io/v0.2/open';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BdnbBuilding {
  building_id:       string;   // RNB identifiant national du bâtiment
  year_construction: number | null;
  surface_m2:        number | null;
  energy_class:      string | null;  // A–G or null
  ges_class:         string | null;  // GES label A–G
  heating_type:      string | null;
  nb_logements:      number | null;
  type_batiment:     string | null;
  adresse:           string | null;
  code_postal:       string | null;
  commune:           string | null;
  source:            'bdnb';
}

// ── Service ───────────────────────────────────────────────────────────────────

export class BdnbService {

  /**
   * Find buildings within radius_m metres of the given coordinates.
   * Returns up to 10 buildings sorted by distance.
   */
  async getBuildingsByLocation(
    lat: number,
    lng: number,
    radius_m = 100
  ): Promise<BdnbBuilding[]> {
    try {
      // BDNB uses PostGIS POINT syntax for geo filtering
      const lonlat   = encodeURIComponent(`srid=4326;POINT(${lng} ${lat})`);
      const fields   = 'rnb_id,annee_construction,surface_m2_bat,dpe_conso_energie,dpe_emission_ges,type_energie_principale_chauffage,nb_log,type_batiment,adresse_principale,code_postal_battant,lib_commune_battant';
      const params   = `lonlat=${lonlat}&distance_batiment_groupe=${radius_m}&select=${fields}&limit=10`;
      const url      = `${BDNB_BASE}/batiment_groupe_complet?${params}`;

      const resp = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!resp.ok) throw new Error(`BDNB returned ${resp.status}`);

      const data = await resp.json() as any[];
      return (Array.isArray(data) ? data : []).map(b => this.mapBuilding(b));
    } catch (err) {
      structuredLogger.warn({ message: 'BDNB API failed', lat, lng, error: String(err) });
      throw err;
    }
  }

  /**
   * Lookup a single building by its national RNB identifier.
   */
  async getBuildingById(rnbId: string): Promise<BdnbBuilding | null> {
    try {
      const url  = `${BDNB_BASE}/batiment_groupe_complet?rnb_id=eq.${encodeURIComponent(rnbId)}&limit=1`;
      const resp = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!resp.ok) throw new Error(`BDNB returned ${resp.status}`);

      const data = await resp.json() as any[];
      if (!Array.isArray(data) || data.length === 0) return null;
      return this.mapBuilding(data[0]);
    } catch (err) {
      structuredLogger.warn({ message: 'BDNB building lookup failed', rnbId, error: String(err) });
      throw err;
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private mapBuilding(b: any): BdnbBuilding {
    return {
      building_id:       b.rnb_id ?? b.id ?? '',
      year_construction: this.toInt(b.annee_construction),
      surface_m2:        this.toFloat(b.surface_m2_bat),
      energy_class:      b.dpe_conso_energie ?? null,
      ges_class:         b.dpe_emission_ges ?? null,
      heating_type:      b.type_energie_principale_chauffage ?? null,
      nb_logements:      this.toInt(b.nb_log),
      type_batiment:     b.type_batiment ?? null,
      adresse:           b.adresse_principale ?? null,
      code_postal:       b.code_postal_battant ?? null,
      commune:           b.lib_commune_battant ?? null,
      source:            'bdnb',
    };
  }

  private toInt(val: any): number | null {
    const n = parseInt(String(val), 10);
    return isNaN(n) ? null : n;
  }

  private toFloat(val: any): number | null {
    const n = parseFloat(String(val));
    return isNaN(n) ? null : n;
  }
}

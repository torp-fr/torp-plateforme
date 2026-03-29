// ─────────────────────────────────────────────────────────────────────────────
// api-carto.service.ts — IGN API Carto (cadastre, PLU, géoportail urbanisme)
//
// Free public API — no auth required.
// Cadastre: https://apicarto.ign.fr/api/cadastre/
// Géoportail Urbanisme (PLU): https://apicarto.ign.fr/api/gpu/
// ─────────────────────────────────────────────────────────────────────────────

import { structuredLogger } from '@/services/observability/structured-logger.js';

const TIMEOUT_MS  = 10_000;
const BASE_URL    = 'https://apicarto.ign.fr/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CadastreParcel {
  id:             string;   // Section + numéro
  numero:         string;
  section:        string;
  code_commune:   string;
  nom_commune:    string | null;
  code_postal:    string | null;
  contenance:     number | null;   // Surface cadastrale m²
  nature_culture: string | null;
  source:         'api-carto-cadastre';
}

export interface PLUZone {
  partition:    string;   // Identifiant partition GPU
  libelle:      string;   // Libellé zone (e.g. "UA", "UB", "N", "A")
  libelong:     string | null;   // Libellé complet
  typezone:     string | null;   // U, AU, N, A
  urlfiche:     string | null;   // URL fiche GPU
  datappro:     string | null;   // Date approbation
  source:       'api-carto-gpu';
}

export interface CadastreResult {
  parcels: CadastreParcel[];
  total:   number;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class ApiCartoService {

  /**
   * Find cadastre parcels by lat/lng coordinates.
   * Returns all parcels whose geometry contains the point.
   */
  async getParcelsByLocation(lat: number, lng: number): Promise<CadastreResult> {
    try {
      const params = new URLSearchParams({
        lon:   String(lng),
        lat:   String(lat),
        _limit: '5',
      });

      const url  = `${BASE_URL}/cadastre/parcelle?${params}`;
      const resp = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!resp.ok) throw new Error(`API Carto cadastre returned ${resp.status}`);

      const data = await resp.json() as { features?: any[]; numberMatched?: number };
      const features = data.features ?? [];

      return {
        parcels: features.map(f => this.mapParcel(f)),
        total:   data.numberMatched ?? features.length,
      };
    } catch (err) {
      structuredLogger.warn({ message: 'API Carto cadastre failed', lat, lng, error: String(err) });
      throw err;
    }
  }

  /**
   * Find cadastre parcel by commune INSEE code + section + number.
   */
  async getParcelByReference(
    codeCommune: string,
    section: string,
    numero: string
  ): Promise<CadastreParcel | null> {
    try {
      const params = new URLSearchParams({
        code_insee:     codeCommune,
        section,
        numero,
        _limit: '1',
      });

      const url  = `${BASE_URL}/cadastre/parcelle?${params}`;
      const resp = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!resp.ok) throw new Error(`API Carto cadastre returned ${resp.status}`);

      const data = await resp.json() as { features?: any[] };
      if (!data.features?.length) return null;
      return this.mapParcel(data.features[0]);
    } catch (err) {
      structuredLogger.warn({ message: 'API Carto parcel lookup failed', codeCommune, section, numero, error: String(err) });
      throw err;
    }
  }

  /**
   * Find PLU (Plan Local d'Urbanisme) zones at given coordinates.
   * Returns the zoning applicable at that location.
   */
  async getPLUZonesByLocation(lat: number, lng: number): Promise<PLUZone[]> {
    try {
      const params = new URLSearchParams({
        lon: String(lng),
        lat: String(lat),
      });

      // zone-urba is the main PLU zoning layer
      const url  = `${BASE_URL}/gpu/zone-urba?${params}`;
      const resp = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!resp.ok) throw new Error(`API Carto GPU returned ${resp.status}`);

      const data = await resp.json() as { features?: any[] };
      return (data.features ?? []).map(f => this.mapPLUZone(f));
    } catch (err) {
      structuredLogger.warn({ message: 'API Carto PLU failed', lat, lng, error: String(err) });
      throw err;
    }
  }

  /**
   * Get commune boundaries by INSEE code.
   * Returns GeoJSON polygon of the commune.
   */
  async getCommuneByInsee(codeInsee: string): Promise<Record<string, unknown> | null> {
    try {
      const url  = `${BASE_URL}/cadastre/commune?code_insee=${encodeURIComponent(codeInsee)}&_limit=1`;
      const resp = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!resp.ok) throw new Error(`API Carto commune returned ${resp.status}`);

      const data = await resp.json() as { features?: any[] };
      return data.features?.[0] ?? null;
    } catch (err) {
      structuredLogger.warn({ message: 'API Carto commune lookup failed', codeInsee, error: String(err) });
      throw err;
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private mapParcel(feature: any): CadastreParcel {
    const p = feature.properties ?? {};
    return {
      id:             `${p.section ?? ''}${p.numero ?? ''}`.trim() || (feature.id ?? ''),
      numero:         p.numero ?? '',
      section:        p.section ?? '',
      code_commune:   p.code_insee ?? p.commune ?? '',
      nom_commune:    p.nom_commune ?? null,
      code_postal:    p.code_postal ?? null,
      contenance:     p.contenance != null ? Number(p.contenance) : null,
      nature_culture: p.nature_culture ?? null,
      source:         'api-carto-cadastre',
    };
  }

  private mapPLUZone(feature: any): PLUZone {
    const p = feature.properties ?? {};
    return {
      partition: p.partition ?? '',
      libelle:   p.libelle ?? '',
      libelong:  p.libelong ?? null,
      typezone:  p.typezone ?? null,
      urlfiche:  p.urlfiche ?? null,
      datappro:  p.datappro ?? null,
      source:    'api-carto-gpu',
    };
  }
}

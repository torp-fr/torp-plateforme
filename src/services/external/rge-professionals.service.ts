// ─────────────────────────────────────────────────────────────────────────────
// rge-professionals.service.ts — RGE certified professionals (ADEME)
//
// Free public API — no auth required.
// Dataset: Travaux de rénovation — entreprises RGE
// Base:    https://data.ademe.fr/data-fair/api/v1/datasets/6x4i1u8yqh1sfhis83l1gw6f/lines
// ─────────────────────────────────────────────────────────────────────────────

import { structuredLogger } from '@/services/observability/structured-logger.js';

const TIMEOUT_MS  = 10_000;
const DATASET_ID  = '6x4i1u8yqh1sfhis83l1gw6f';
const BASE_URL    = `https://data.ademe.fr/data-fair/api/v1/datasets/${DATASET_ID}/lines`;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RGEProfessional {
  nom_entreprise:    string;
  siret:             string | null;
  domaine:           string | null;   // e.g. "Travaux de rénovation énergétique"
  nom_qualification: string | null;   // e.g. "RGE Qualibat Rénovation Énergétique"
  organisme:         string | null;   // e.g. "Qualibat", "Qualifelec"
  date_fin_validite: string | null;   // ISO date — expiry of certification
  adresse:           string | null;
  code_postal:       string | null;
  commune:           string | null;
  lat:               number | null;
  lng:               number | null;
  source:            'ademe-rge';
}

export interface RGESearchResult {
  professionals: RGEProfessional[];
  total:         number;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class RGEProfessionalsService {

  /**
   * Search RGE-certified professionals near a location.
   * Uses bounding-box approximation (~30km radius for initial results).
   */
  async searchNearLocation(
    lat: number,
    lng: number,
    radiusKm = 20,
    limit    = 20
  ): Promise<RGESearchResult> {
    try {
      // Approximate bounding box (1 degree lat ≈ 111 km)
      const delta = radiusKm / 111;
      const bbox  = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;

      const params = new URLSearchParams({
        geo_distance: `${radiusKm * 1000},${lat},${lng}`, // metres,lat,lng
        size:         String(limit),
      });

      const url  = `${BASE_URL}?${params}`;
      const resp = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!resp.ok) throw new Error(`ADEME RGE API returned ${resp.status}`);

      const data = await resp.json() as { results?: any[]; total?: number };
      const results = data.results ?? [];

      return {
        professionals: results.map(r => this.mapProfessional(r)),
        total:         data.total ?? results.length,
      };
    } catch (err) {
      structuredLogger.warn({ message: 'ADEME RGE search failed', lat, lng, error: String(err) });
      throw err;
    }
  }

  /**
   * Search RGE professionals by postal code / commune.
   */
  async searchByPostalCode(
    codePostal: string,
    limit = 20
  ): Promise<RGESearchResult> {
    try {
      const params = new URLSearchParams({
        qs:   `code_postal:"${codePostal}"`,
        size: String(limit),
      });

      const url  = `${BASE_URL}?${params}`;
      const resp = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!resp.ok) throw new Error(`ADEME RGE API returned ${resp.status}`);

      const data = await resp.json() as { results?: any[]; total?: number };
      const results = data.results ?? [];

      return {
        professionals: results.map(r => this.mapProfessional(r)),
        total:         data.total ?? results.length,
      };
    } catch (err) {
      structuredLogger.warn({ message: 'ADEME RGE postal code search failed', codePostal, error: String(err) });
      throw err;
    }
  }

  /**
   * Look up RGE certifications for a specific enterprise by SIRET.
   */
  async getCertificationsBySiret(siret: string): Promise<RGEProfessional[]> {
    try {
      const params = new URLSearchParams({
        qs:   `siret:"${siret}"`,
        size: '50',
      });

      const url  = `${BASE_URL}?${params}`;
      const resp = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!resp.ok) throw new Error(`ADEME RGE API returned ${resp.status}`);

      const data = await resp.json() as { results?: any[] };
      return (data.results ?? []).map(r => this.mapProfessional(r));
    } catch (err) {
      structuredLogger.warn({ message: 'ADEME RGE SIRET lookup failed', siret, error: String(err) });
      throw err;
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private mapProfessional(r: any): RGEProfessional {
    return {
      nom_entreprise:    r.nom_entreprise    ?? r.raison_sociale   ?? '',
      siret:             r.siret             ?? null,
      domaine:           r.domaine           ?? null,
      nom_qualification: r.nom_qualification ?? r.qualification    ?? null,
      organisme:         r.organisme         ?? r.organisme_certificateur ?? null,
      date_fin_validite: r.lien_date_fin     ?? r.date_fin_validite ?? null,
      adresse:           r.adresse           ?? null,
      code_postal:       r.code_postal       ?? null,
      commune:           r.commune           ?? null,
      lat:               r.latitude   != null ? Number(r.latitude)  : null,
      lng:               r.longitude  != null ? Number(r.longitude) : null,
      source:            'ademe-rge',
    };
  }
}

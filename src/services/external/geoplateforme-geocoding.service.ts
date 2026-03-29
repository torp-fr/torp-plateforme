// ─────────────────────────────────────────────────────────────────────────────
// geoplateforme-geocoding.service.ts — Server-side Geoplateforme geocoding
//
// Uses the IGN Geoplateforme geocoding API (free, no auth required).
// Endpoint: https://data.geopf.fr/geocodage/search
// ─────────────────────────────────────────────────────────────────────────────

import { structuredLogger } from '@/services/observability/structured-logger.js';

const TIMEOUT_MS    = 5_000;
const GEOCODING_URL = 'https://data.geopf.fr/geocodage/search';
const REVERSE_URL   = 'https://data.geopf.fr/geocodage/reverse';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GeocodingResult {
  lat:           number;
  lng:           number;
  score:         number;       // 0–1, confidence
  label:         string;       // Full address label
  house_number:  string | null;
  street:        string | null;
  postcode:      string | null;
  city:          string | null;
  city_code:     string | null; // INSEE code
  type:          string;        // 'housenumber' | 'street' | 'locality' | 'municipality'
  source:        'geoplateforme';
}

export interface ReverseGeocodingResult extends GeocodingResult {
  distance_m: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class GeoplatformeGeocodingService {

  /** Geocode a French address to coordinates. */
  async geocodeAddress(address: string, postcode?: string): Promise<GeocodingResult> {
    try {
      const params = new URLSearchParams({ q: address, limit: '1' });
      if (postcode) params.set('postcode', postcode);

      const resp = await fetch(`${GEOCODING_URL}?${params}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!resp.ok) throw new Error(`Geoplateforme returned ${resp.status}`);

      const data = await resp.json() as { features?: any[] };

      if (!data.features?.length) {
        throw new Error(`No geocoding result for: ${address}`);
      }

      return this.mapFeature(data.features[0]);
    } catch (err) {
      structuredLogger.warn({ message: 'Geoplateforme geocoding failed', address, error: String(err) });
      throw err;
    }
  }

  /** Batch geocode multiple addresses. Silently skips failures. */
  async geocodeBatch(addresses: string[]): Promise<Array<GeocodingResult | null>> {
    return Promise.all(
      addresses.map(a => this.geocodeAddress(a).catch(() => null))
    );
  }

  /** Reverse geocode: coordinates → address. */
  async reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodingResult> {
    try {
      const params = new URLSearchParams({
        lon: String(lng),
        lat: String(lat),
        limit: '1',
      });

      const resp = await fetch(`${REVERSE_URL}?${params}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!resp.ok) throw new Error(`Geoplateforme reverse returned ${resp.status}`);

      const data = await resp.json() as { features?: any[] };

      if (!data.features?.length) {
        throw new Error(`No reverse geocoding result for ${lat},${lng}`);
      }

      const feature = data.features[0];
      const base    = this.mapFeature(feature);

      return {
        ...base,
        distance_m: feature.properties?.distance ?? 0,
      };
    } catch (err) {
      structuredLogger.warn({ message: 'Geoplateforme reverse geocoding failed', lat, lng, error: String(err) });
      throw err;
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private mapFeature(feature: any): GeocodingResult {
    const p = feature.properties ?? {};
    const [lng, lat] = feature.geometry?.coordinates ?? [0, 0];

    return {
      lat,
      lng,
      score:        p.score ?? 0,
      label:        p.label ?? '',
      house_number: p.housenumber ?? null,
      street:       p.street ?? null,
      postcode:     p.postcode ?? null,
      city:         p.city ?? null,
      city_code:    p.citycode ?? null,
      type:         p.type ?? 'unknown',
      source:       'geoplateforme',
    };
  }
}

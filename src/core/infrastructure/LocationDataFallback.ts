// ─────────────────────────────────────────────────────────────────────────────
// LocationDataFallback — Geoplateforme → BAN → postal centroid cascade.
//
// Layer 0 (primary):   IGN Geoplateforme (best French geocoding)
// Layer 1 (fallback):  Base Adresse Nationale (data.gouv.fr, free)
// Layer 2 (emergency): Postal centroid lookup (always succeeds for valid codes)
//
// Usage:
//   const cascade = new LocationDataFallback();
//   const result  = await cascade.geocodeAddress('12 rue de la Paix, 75001 Paris');
// ─────────────────────────────────────────────────────────────────────────────

import { FallbackCascade, type CascadeResult } from './FallbackCascade.js';
import {
  GeoplatformeGeocodingService,
  type GeocodingResult,
} from '@/services/external/geoplateforme-geocoding.service.js';

const BAN_BASE = 'https://api-adresse.data.gouv.fr';

// ── Unified location type ─────────────────────────────────────────────────────

export interface LocationData {
  lat:          number;
  lng:          number;
  score:        number;       // 0–1 confidence
  label:        string;
  house_number: string | null;
  street:       string | null;
  postcode:     string | null;
  city:         string | null;
  city_code:    string | null;   // INSEE code
  type:         string;          // 'housenumber' | 'street' | 'locality' | 'municipality'
  source:       'geoplateforme' | 'ban' | 'postal-centroid';
}

// Approximate centroids for French departments (last resort)
const DEPT_CENTROIDS: Record<string, { lat: number; lng: number; name: string }> = {
  '75': { lat: 48.8566, lng: 2.3522,  name: 'Paris' },
  '69': { lat: 45.7640, lng: 4.8357,  name: 'Lyon' },
  '13': { lat: 43.2965, lng: 5.3698,  name: 'Marseille' },
  '31': { lat: 43.6047, lng: 1.4442,  name: 'Toulouse' },
  '06': { lat: 43.7102, lng: 7.2620,  name: 'Nice' },
  '44': { lat: 47.2184, lng: -1.5536, name: 'Nantes' },
  '67': { lat: 48.5734, lng: 7.7521,  name: 'Strasbourg' },
  '34': { lat: 43.6119, lng: 3.8772,  name: 'Montpellier' },
  '33': { lat: 44.8378, lng: -0.5792, name: 'Bordeaux' },
  '59': { lat: 50.6292, lng: 3.0573,  name: 'Lille' },
};

// ── LocationDataFallback ──────────────────────────────────────────────────────

export class LocationDataFallback {
  private readonly cascade      = new FallbackCascade();
  private readonly geoplateforme = new GeoplatformeGeocodingService();
  private readonly cache        = new Map<string, LocationData>();

  /**
   * Geocode a French address with automatic fallback.
   * Geoplateforme is tried first, then BAN, then postal centroid.
   */
  async geocodeAddress(address: string, postcode?: string): Promise<CascadeResult<LocationData>> {
    const cacheKey = `${address}|${postcode ?? ''}`;
    const cached   = this.cache.get(cacheKey);

    if (cached) {
      return {
        status:      'success',
        data:        cached,
        layer_used:  'Cache',
        health_status: 'online',
        timeline:    [],
        duration_ms: 0,
      };
    }

    const result = await this.cascade.executeWithFallback<LocationData>(
      `geocode:${cacheKey}`,
      [
        {
          name:        'Geoplateforme',
          priority:    0,
          timeout_ms:  8_000,
          isRetryable: (err) => !err.message.includes('No geocoding result'),
          execute: async () => {
            const r = await this.geoplateforme.geocodeAddress(address, postcode);
            return this.fromGeoplateforme(r);
          },
        },
        {
          name:        'BAN',
          priority:    1,
          timeout_ms:  8_000,
          isRetryable: (err) => !err.message.includes('No result'),
          execute: async () => this.geocodeViaBAN(address, postcode),
        },
        {
          name:        'PostalCentroid',
          priority:    2,
          timeout_ms:  500,
          isRetryable: () => false,
          execute: async () => this.lookupPostalCentroid(address, postcode),
        },
      ],
      { entityType: 'address' }
    );

    if (result.status === 'success' && result.data) {
      this.cache.set(cacheKey, result.data);
    }

    return result;
  }

  /**
   * Reverse geocode coordinates to address with fallback.
   */
  async reverseGeocode(lat: number, lng: number): Promise<CascadeResult<LocationData>> {
    const result = await this.cascade.executeWithFallback<LocationData>(
      `reverse:${lat},${lng}`,
      [
        {
          name:        'Geoplateforme',
          priority:    0,
          timeout_ms:  8_000,
          isRetryable: () => true,
          execute: async () => {
            const r = await this.geoplateforme.reverseGeocode(lat, lng);
            return { ...this.fromGeoplateforme(r), source: 'geoplateforme' as const };
          },
        },
        {
          name:        'BAN',
          priority:    1,
          timeout_ms:  8_000,
          isRetryable: () => true,
          execute: async () => this.reverseViaBAN(lat, lng),
        },
      ],
      { entityType: 'coordinates' }
    );

    return result;
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private fromGeoplateforme(r: GeocodingResult): LocationData {
    return {
      lat:          r.lat,
      lng:          r.lng,
      score:        r.score,
      label:        r.label,
      house_number: r.house_number,
      street:       r.street,
      postcode:     r.postcode,
      city:         r.city,
      city_code:    r.city_code,
      type:         r.type,
      source:       'geoplateforme',
    };
  }

  private async geocodeViaBAN(address: string, postcode?: string): Promise<LocationData> {
    const params = new URLSearchParams({ q: address, limit: '1' });
    if (postcode) params.set('postcode', postcode);

    const resp = await fetch(`${BAN_BASE}/search/?${params}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    });

    if (!resp.ok) throw new Error(`BAN returned ${resp.status}`);

    const data = await resp.json() as { features?: any[] };
    if (!data.features?.length) throw new Error('No result from BAN');

    return this.mapBANFeature(data.features[0]);
  }

  private async reverseViaBAN(lat: number, lng: number): Promise<LocationData> {
    const params = new URLSearchParams({ lon: String(lng), lat: String(lat) });
    const resp   = await fetch(`${BAN_BASE}/reverse/?${params}`, {
      signal: AbortSignal.timeout(8_000),
    });

    if (!resp.ok) throw new Error(`BAN reverse returned ${resp.status}`);

    const data = await resp.json() as { features?: any[] };
    if (!data.features?.length) throw new Error('No result from BAN reverse');

    return this.mapBANFeature(data.features[0]);
  }

  private mapBANFeature(feature: any): LocationData {
    const p   = feature.properties ?? {};
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
      source:       'ban',
    };
  }

  private lookupPostalCentroid(address: string, postcode?: string): LocationData {
    // Extract postcode from address if not provided
    const code = postcode ?? address.match(/\b(\d{5})\b/)?.[1] ?? '';
    const dept  = code.slice(0, 2);
    const centroid = DEPT_CENTROIDS[dept];

    if (!centroid) {
      throw new Error(`No postal centroid for department ${dept}`);
    }

    return {
      lat:          centroid.lat,
      lng:          centroid.lng,
      score:        0.1,   // low confidence
      label:        centroid.name,
      house_number: null,
      street:       null,
      postcode:     code || null,
      city:         centroid.name,
      city_code:    null,
      type:         'municipality',
      source:       'postal-centroid',
    };
  }
}

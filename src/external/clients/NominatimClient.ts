import { BaseAPIClient } from './BaseAPIClient.js';
import type { APICallResult, NominatimResult, BANOAddressResult, BANOResponse } from '../types/index.js';

export class NominatimClient extends BaseAPIClient {
  private banoBaseUrl: string;

  constructor() {
    super({
      apiKey: '',
      baseUrl: process.env['NOMINATIM_API_ENDPOINT'] ?? 'https://nominatim.openstreetmap.org',
      timeout: 10000,
      retries: 2,
      backoffMs: 1200, // Nominatim: respect 1 req/sec
    });
    this.banoBaseUrl = process.env['BANO_API_ENDPOINT'] ?? 'https://api-adresse.data.gouv.fr';
  }

  /**
   * Geocode a French address.
   * Tries BANO first (higher accuracy for French addresses), falls back to Nominatim.
   */
  async geocodeAddress(address: string): Promise<APICallResult<BANOAddressResult & { lat: number; lng: number }>> {
    // Primary: BANO (La Base d'Adresses Nationale Ouverte)
    const banoResult = await this.callAPI<BANOResponse>('GET', `${this.banoBaseUrl}/search/`, {
      query: { q: address, limit: 1, autocomplete: 0 },
      cacheKey: `bano:geocode:${address.toLowerCase().replace(/\s+/g, '_')}`,
      cacheTTLSeconds: 86400 * 90,
    });

    if (banoResult.success && banoResult.data?.features?.length) {
      const feat = banoResult.data.features[0];
      const props = feat.properties;
      const [lng, lat] = feat.geometry.coordinates;

      if (props.score >= 0.4) {
        return {
          success: true,
          executionTimeMs: banoResult.executionTimeMs,
          data: { ...props, lat, lng },
        };
      }
    }

    // Fallback: Nominatim
    const nomResult = await this.callAPI<NominatimResult[]>('GET', '/search', {
      query: { q: address, format: 'json', limit: 1, countrycodes: 'fr' },
      headers: { 'User-Agent': process.env['NOMINATIM_USER_AGENT'] ?? 'TORP-App/1.0' },
      cacheKey: `nominatim:geocode:${address.toLowerCase().replace(/\s+/g, '_')}`,
      cacheTTLSeconds: 86400 * 90,
    });

    if (!nomResult.success || !nomResult.data?.length) {
      return { success: false, error: 'Address not found via BANO or Nominatim' };
    }

    const hit = nomResult.data[0];
    return {
      success: true,
      executionTimeMs: nomResult.executionTimeMs,
      data: {
        id:          `nominatim:${hit.osm_id}`,
        label:       hit.display_name,
        score:       0.7,
        housenumber: hit.address.house_number ?? '',
        street:      hit.address.road ?? '',
        postcode:    hit.address.postcode ?? '',
        city:        hit.address.city ?? hit.address.town ?? hit.address.village ?? '',
        context:     hit.address.country ?? 'France',
        x:           parseFloat(hit.lon),
        y:           parseFloat(hit.lat),
        lat:         parseFloat(hit.lat),
        lng:         parseFloat(hit.lon),
      },
    };
  }

  async reverseGeocode(lat: number, lng: number): Promise<APICallResult<NominatimResult>> {
    const result = await this.callAPI<NominatimResult>('GET', '/reverse', {
      query: { lat, lon: lng, format: 'json' },
      headers: { 'User-Agent': process.env['NOMINATIM_USER_AGENT'] ?? 'TORP-App/1.0' },
      cacheKey: `nominatim:reverse:${lat.toFixed(4)},${lng.toFixed(4)}`,
      cacheTTLSeconds: 86400 * 90,
    });

    if (!result.success) return { success: false, error: result.error };
    return { success: true, data: result.data, executionTimeMs: result.executionTimeMs };
  }
}

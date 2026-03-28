// ─────────────────────────────────────────────────────────────────────
// ClientLocalizationPipeline — REAL implementation
// Uses NominatimClient (BANO primary / Nominatim fallback) + IGNClient
// ─────────────────────────────────────────────────────────────────────

import { apiClients } from '../../external/clients/index.js';
import type { PipelineContext, PipelineResult } from '../types/index.js';

interface LocalisationData {
  adresse_saisie: string;
  adresse_normalisee: string;
  code_postal: string;
  ville: string;
  lat: number;
  lng: number;
  parcelle_cadastrale: string | null;
  fetched_at: string;
}

export class ClientLocalizationPipeline {
  async execute(
    params: { address: string },
    _context: PipelineContext
  ): Promise<PipelineResult<LocalisationData>> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // Step 1: Geocode (BANO → Nominatim fallback)
      const geoResult = await apiClients.nominatim.geocodeAddress(params.address);

      if (!geoResult.success || !geoResult.data) {
        return {
          status:          'failed',
          error:           `Geocoding failed: ${geoResult.error}`,
          executionTimeMs: Date.now() - startTime,
          retryable:       true,
        };
      }

      const { lat, lng, postcode, city, label, housenumber, street } = geoResult.data;
      const adresse_normalisee = label || [housenumber, street, postcode, city].filter(Boolean).join(' ');

      // Step 2: IGN cadastre lookup (non-blocking)
      let parcelle: string | null = null;
      if (apiClients.ign && process.env['IGN_API_KEY']) {
        const cadastreResult = await apiClients.ign.getParcelByCoordinates(lat, lng);
        if (cadastreResult.success && cadastreResult.data) {
          parcelle = cadastreResult.data.id;
        } else {
          warnings.push(`IGN cadastre: ${cadastreResult.error ?? 'not found'} (non-blocking)`);
        }
      }

      return {
        status: 'completed',
        data: {
          adresse_saisie:     params.address,
          adresse_normalisee,
          code_postal:        postcode ?? '',
          ville:              city ?? '',
          lat,
          lng,
          parcelle_cadastrale: parcelle,
          fetched_at:          new Date().toISOString(),
        },
        warnings:        warnings.length > 0 ? warnings : undefined,
        executionTimeMs: Date.now() - startTime,
        retryable:       false,
      };
    } catch (err) {
      return {
        status:          'failed',
        error:           err instanceof Error ? err.message : String(err),
        executionTimeMs: Date.now() - startTime,
        retryable:       true,
      };
    }
  }
}

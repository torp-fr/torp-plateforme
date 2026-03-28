// ─────────────────────────────────────────────────────────────────────
// ClientLocalizationPipeline
// Geocodes client address and fetches cadastral parcel data
// Input:  { clientId, address }
// Output: { adresse_normalisee, code_postal, ville, lat, lng, parcelle_cadastrale }
// ─────────────────────────────────────────────────────────────────────

import { callAPIWithRetry } from '../utils/index.js';
import type { PipelineContext, PipelineResult } from '../types/index.js';

interface LocalisationResult {
  adresse_saisie: string;
  adresse_normalisee: string;
  code_postal: string;
  ville: string;
  lat: number;
  lng: number;
  parcelle_cadastrale: string | null;
  fetched_at: string;
}

interface BANOFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    label: string;
    postcode: string;
    city: string;
    score: number;
  };
}

export class ClientLocalizationPipeline {
  async execute(
    params: { address: string },
    context: PipelineContext
  ): Promise<PipelineResult<LocalisationResult>> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // Step 1: Geocode via BANO (primary) → Nominatim (fallback)
      const geo = await this.geocode(params.address, warnings);

      if (!geo) {
        return {
          status: 'failed',
          error: 'Could not geocode address via BANO or Nominatim',
          executionTimeMs: Date.now() - startTime,
          retryable: true,
        };
      }

      // Step 2: Fetch cadastral parcel (IGN) — non-blocking
      let parcelle: string | null = null;
      try {
        parcelle = await this.fetchCadastre(geo.lat, geo.lng);
      } catch (err) {
        warnings.push(`Cadastre fetch failed (non-blocking): ${err}`);
      }

      const data: LocalisationResult = {
        adresse_saisie:     params.address,
        adresse_normalisee: geo.label,
        code_postal:        geo.postcode,
        ville:              geo.city,
        lat:                geo.lat,
        lng:                geo.lng,
        parcelle_cadastrale: parcelle,
        fetched_at:         new Date().toISOString(),
      };

      return {
        status: 'completed',
        data,
        warnings: warnings.length > 0 ? warnings : undefined,
        executionTimeMs: Date.now() - startTime,
        retryable: false,
      };
    } catch (err) {
      return {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        executionTimeMs: Date.now() - startTime,
        retryable: true,
      };
    }
  }

  private async geocode(
    address: string,
    warnings: string[]
  ): Promise<{ label: string; postcode: string; city: string; lat: number; lng: number } | null> {
    const banoEndpoint = process.env.BANO_API_ENDPOINT ?? 'https://api-adresse.data.gouv.fr';

    // Try BANO first
    try {
      const result = await callAPIWithRetry<{ features: BANOFeature[] }>({
        method: 'GET',
        url: `${banoEndpoint}/search/?q=${encodeURIComponent(address)}&limit=1`,
        retries: 2,
      });

      const feature = result?.features?.[0];
      if (feature && feature.properties.score >= 0.5) {
        const [lng, lat] = feature.geometry.coordinates;
        return {
          label:    feature.properties.label,
          postcode: feature.properties.postcode,
          city:     feature.properties.city,
          lat,
          lng,
        };
      }
    } catch (err) {
      warnings.push(`BANO geocoding failed: ${err} — trying Nominatim`);
    }

    // Fallback: Nominatim (rate-limited: 1 req/sec)
    const nominatimEndpoint = process.env.NOMINATIM_API_ENDPOINT ?? 'https://nominatim.openstreetmap.org';

    const nominatimResult = await callAPIWithRetry<Array<{ display_name: string; lat: string; lon: string; address: Record<string, string> }>>({
      method: 'GET',
      url: `${nominatimEndpoint}/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=fr`,
      retries: 1,
      fallback: [],
    });

    const hit = nominatimResult?.[0];
    if (!hit) return null;

    return {
      label:    hit.display_name,
      postcode: hit.address['postcode'] ?? '',
      city:     hit.address['city'] ?? hit.address['town'] ?? hit.address['village'] ?? '',
      lat:      parseFloat(hit.lat),
      lng:      parseFloat(hit.lon),
    };
  }

  private async fetchCadastre(lat: number, lng: number): Promise<string | null> {
    // IGN Géoportail — cadastre WFS endpoint
    const ignEndpoint = process.env.IGN_GEOPORTAIL_ENDPOINT ?? 'https://wxs.ign.fr';
    const ignKey = process.env.IGN_API_KEY;

    if (!ignKey) {
      console.warn('[ClientLocalization] IGN_API_KEY not set — skipping cadastre fetch');
      return null;
    }

    const buffer = 0.0001; // ~10m bounding box
    const bbox = `${lng - buffer},${lat - buffer},${lng + buffer},${lat + buffer}`;

    const result = await callAPIWithRetry<{ features?: Array<{ properties: { numero: string; feuille: string; section: string; code_dep: string; code_com: string } }> }>({
      method: 'GET',
      url: `${ignEndpoint}/${ignKey}/geoportail/wfs?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature` +
           `&TYPENAMES=CADASTRALPARCELS.PARCELLAIRE_EXPRESS:parcelle&BBOX=${bbox}&OUTPUTFORMAT=application/json`,
      retries: 1,
      fallback: null,
    });

    const parcel = result?.features?.[0]?.properties;
    if (!parcel) return null;

    return `${parcel.code_dep}${parcel.code_com}${parcel.section}${parcel.feuille}${parcel.numero}`;
  }
}

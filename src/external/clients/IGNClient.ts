import { BaseAPIClient } from './BaseAPIClient.js';
import type { APICallResult, IGNParcel, IGNPLUInfo } from '../types/index.js';

export class IGNClient extends BaseAPIClient {
  constructor(ignKey: string) {
    super({
      apiKey: ignKey,
      baseUrl: `https://wxs.ign.fr/${ignKey}/geoportail/wfs`,
      timeout: 15000,
      retries: 2,
      backoffMs: 1500,
    });
  }

  /**
   * Fetch cadastral parcel by lat/lng bounding box (IGN WFS).
   */
  async getParcelByCoordinates(lat: number, lng: number): Promise<APICallResult<IGNParcel>> {
    if (!this.config.apiKey) {
      return { success: false, error: 'IGN_API_KEY not configured' };
    }

    const delta = 0.0001; // ~10m buffer
    const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;

    interface WFSResponse {
      features?: Array<{
        properties: {
          numero?: string;
          feuille?: string;
          section?: string;
          code_dep?: string;
          code_com?: string;
          contenance?: number;
        };
        geometry?: { coordinates: number[][] };
      }>;
    }

    const result = await this.callAPI<WFSResponse>('GET', '', {
      query: {
        SERVICE:     'WFS',
        VERSION:     '2.0.0',
        REQUEST:     'GetFeature',
        TYPENAMES:   'CADASTRALPARCELS.PARCELLAIRE_EXPRESS:parcelle',
        BBOX:        bbox,
        OUTPUTFORMAT: 'application/json',
      },
      cacheKey: `ign:parcel:${lat.toFixed(5)},${lng.toFixed(5)}`,
      cacheTTLSeconds: 86400 * 90,
    });

    if (!result.success || !result.data?.features?.length) {
      return { success: false, error: result.error ?? 'No parcel found' };
    }

    const p = result.data.features[0].properties;
    return {
      success: true,
      executionTimeMs: result.executionTimeMs,
      data: {
        id:       `${p.code_dep}${p.code_com}${p.section}${p.feuille}${p.numero}`,
        commune:  p.code_com ?? '',
        section:  p.section ?? '',
        numero:   p.numero ?? '',
        surface:  p.contenance ?? 0,
        location: { lat, lng },
      },
    };
  }

  /**
   * Fetch PLU zone info via Géoportail de l'Urbanisme WMS.
   */
  async getPLUByCoordinates(lat: number, lng: number): Promise<APICallResult<IGNPLUInfo>> {
    // GPU endpoint (public, no key required for WMS GetFeatureInfo)
    const gpuUrl = 'https://www.geoportail-urbanisme.gouv.fr/api/feature-info';

    interface GPUResponse {
      zone_type?: string;
      libelle?: string;
      typezone?: string;
      protected?: boolean;
    }

    const result = await this.callAPI<GPUResponse>('GET', gpuUrl, {
      query: { lat, lng, layers: 'zone_urba' },
      cacheKey: `ign:plu:${lat.toFixed(4)},${lng.toFixed(4)}`,
      cacheTTLSeconds: 86400 * 30,
    });

    if (!result.success) {
      // Return conservative defaults (assume urban, no protection)
      return {
        success: true,
        data: {
          zone_type: 'inconnu',
          allowed_uses: ['habitation'],
          protected: false,
          monuments_historiques: false,
          paysages_proteges: false,
        },
      };
    }

    const raw = result.data ?? {};
    const zoneCode = raw.typezone ?? raw.zone_type ?? 'U';

    return {
      success: true,
      executionTimeMs: result.executionTimeMs,
      data: {
        zone_type:            zoneCode.startsWith('U') ? 'urbain' : zoneCode.startsWith('A') ? 'peri-urbain' : 'rural',
        allowed_uses:         ['habitation', 'commerce'],
        protected:            raw.protected ?? false,
        monuments_historiques: false, // TBD: ABF API
        paysages_proteges:    false,
        raw,
      },
    };
  }
}

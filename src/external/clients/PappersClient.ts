import { BaseAPIClient } from './BaseAPIClient.js';
import type { APICallResult, PappersCompanyData } from '../types/index.js';

interface PappersRaw {
  nom_entreprise?: string;
  siren?: string;
  code_naf?: string;
  libelle_code_naf?: string;
  tranche_effectif?: number;
  chiffre_affaires?: number;
  capital?: number;
  forme_juridique?: string;
  date_creation?: string;
  date_mise_a_jour?: string;
  siege?: {
    adresse_ligne_1?: string;
    code_postal?: string;
    ville?: string;
    latitude?: number;
    longitude?: number;
  };
  representants?: Array<{ nom_complet?: string }>;
  status?: string;
}

export class PappersClient extends BaseAPIClient {
  constructor(apiKey: string) {
    super({
      apiKey,
      baseUrl: process.env['PAPPERS_API_ENDPOINT'] ?? 'https://api.pappers.fr/v2',
      timeout: 10000,
      retries: 2,
      backoffMs: 1000,
    });
  }

  async getCompanyBySIRET(siret: string): Promise<APICallResult<PappersCompanyData>> {
    if (!this.config.apiKey) {
      return { success: false, error: 'PAPPERS_API_KEY not configured' };
    }

    const siren = siret.substring(0, 9);

    const result = await this.callAPI<PappersRaw>('GET', '/entreprise', {
      query: { api_token: this.config.apiKey, siren },
      cacheKey: `pappers:company:${siren}`,
      cacheTTLSeconds: 86400 * 7,
    });

    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }

    const raw = result.data;
    return {
      success: true,
      executionTimeMs: result.executionTimeMs,
      data: {
        siret,
        siren,
        raison_sociale:    raw.nom_entreprise ?? '',
        code_naf:          raw.code_naf ?? '',
        libelle_naf:       raw.libelle_code_naf ?? '',
        effectifs:         raw.tranche_effectif ?? 0,
        effectifs_etab:    raw.tranche_effectif ?? 0,
        chiffre_affaires:  raw.chiffre_affaires ?? 0,
        date_creation:     raw.date_creation ?? '',
        date_modification: raw.date_mise_a_jour ?? '',
        statut_juridique:  raw.forme_juridique ?? '',
        adresse:           raw.siege?.adresse_ligne_1 ?? '',
        code_postal:       raw.siege?.code_postal ?? '',
        ville:             raw.siege?.ville ?? '',
        latitude:          raw.siege?.latitude ?? 0,
        longitude:         raw.siege?.longitude ?? 0,
      },
    };
  }
}

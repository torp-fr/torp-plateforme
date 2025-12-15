/**
 * Service d'intégration des APIs externes Phase 0
 * Géocodage (BAN), Risques naturels (Géorisques), DPE (ADEME), Patrimoine
 */

import { supabase } from '@/lib/supabase';
import { Coordinates, Address } from '@/types/phase0/common.types';

// Types de cache
interface CachedApiResponse {
  id: string;
  api_name: string;
  request_key: string;
  response_data: unknown;
  expires_at: string;
  created_at: string;
}

// Durée de cache par API (en heures)
const CACHE_DURATION: Record<string, number> = {
  ban: 24 * 30, // 30 jours pour les adresses
  georisques: 24 * 7, // 7 jours pour les risques
  ademe_dpe: 24 * 30, // 30 jours pour le DPE
  atlas_patrimoine: 24 * 30, // 30 jours pour le patrimoine
  cadastre: 24 * 365, // 1 an pour le cadastre
};

// ============================================================================
// API BAN (Base Adresse Nationale)
// Documentation: https://adresse.data.gouv.fr/api-doc/adresse
// ============================================================================

export interface BANSearchResult {
  type: 'housenumber' | 'street' | 'municipality';
  label: string;
  street?: string;
  housenumber?: string;
  postcode: string;
  city: string;
  citycode: string;
  context: string;
  coordinates: Coordinates;
  score: number;
}

export interface BANReverseResult {
  address: string;
  postcode: string;
  city: string;
  citycode: string;
  coordinates: Coordinates;
}

export class BANApiService {
  private static BASE_URL = 'https://api-adresse.data.gouv.fr';

  /**
   * Recherche une adresse par texte
   */
  static async search(query: string, options?: {
    limit?: number;
    postcode?: string;
    citycode?: string;
    type?: 'housenumber' | 'street' | 'municipality';
  }): Promise<BANSearchResult[]> {
    const cacheKey = `search:${query}:${JSON.stringify(options || {})}`;
    const cached = await this.getCached('ban', cacheKey);
    if (cached) return cached as BANSearchResult[];

    const params = new URLSearchParams({
      q: query,
      limit: (options?.limit || 5).toString(),
    });

    if (options?.postcode) params.append('postcode', options.postcode);
    if (options?.citycode) params.append('citycode', options.citycode);
    if (options?.type) params.append('type', options.type);

    try {
      const response = await fetch(`${this.BASE_URL}/search/?${params}`);
      const data = await response.json();

      const results: BANSearchResult[] = data.features?.map((feature: Record<string, unknown>) => {
        const props = feature.properties as Record<string, unknown>;
        const geometry = feature.geometry as { coordinates: number[] };

        return {
          type: props.type as 'housenumber' | 'street' | 'municipality',
          label: props.label as string,
          street: props.street as string,
          housenumber: props.housenumber as string,
          postcode: props.postcode as string,
          city: props.city as string,
          citycode: props.citycode as string,
          context: props.context as string,
          coordinates: {
            lng: geometry.coordinates[0],
            lat: geometry.coordinates[1],
          },
          score: props.score as number,
        };
      }) || [];

      await this.setCache('ban', cacheKey, results);
      return results;
    } catch (error) {
      console.error('Erreur API BAN search:', error);
      return [];
    }
  }

  /**
   * Géocodage inverse (coordonnées vers adresse)
   */
  static async reverse(coordinates: Coordinates): Promise<BANReverseResult | null> {
    const cacheKey = `reverse:${coordinates.lat}:${coordinates.lng}`;
    const cached = await this.getCached('ban', cacheKey);
    if (cached) return cached as BANReverseResult;

    try {
      const response = await fetch(
        `${this.BASE_URL}/reverse/?lon=${coordinates.lng}&lat=${coordinates.lat}`
      );
      const data = await response.json();

      if (!data.features?.length) return null;

      const feature = data.features[0];
      const props = feature.properties as Record<string, unknown>;
      const geometry = feature.geometry as { coordinates: number[] };

      const result: BANReverseResult = {
        address: props.label as string,
        postcode: props.postcode as string,
        city: props.city as string,
        citycode: props.citycode as string,
        coordinates: {
          lng: geometry.coordinates[0],
          lat: geometry.coordinates[1],
        },
      };

      await this.setCache('ban', cacheKey, result);
      return result;
    } catch (error) {
      console.error('Erreur API BAN reverse:', error);
      return null;
    }
  }

  /**
   * Autocomplete pour la saisie d'adresse
   */
  static async autocomplete(text: string): Promise<BANSearchResult[]> {
    if (text.length < 3) return [];
    return this.search(text, { limit: 5, type: 'housenumber' });
  }

  private static async getCached(api: string, key: string): Promise<unknown | null> {
    try {
      const { data } = await supabase
        .from('phase0_api_cache')
        .select('response_data, expires_at')
        .eq('api_name', api)
        .eq('request_key', key)
        .single();

      if (data && new Date(data.expires_at) > new Date()) {
        return data.response_data;
      }
      return null;
    } catch {
      return null;
    }
  }

  private static async setCache(api: string, key: string, data: unknown): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (CACHE_DURATION[api] || 24));

    try {
      await supabase
        .from('phase0_api_cache')
        .upsert({
          api_name: api,
          request_key: key,
          response_data: data,
          expires_at: expiresAt.toISOString(),
        }, {
          onConflict: 'api_name,request_key',
        });
    } catch (error) {
      console.error('Erreur cache API:', error);
    }
  }
}

// ============================================================================
// API Géorisques
// Documentation: https://www.georisques.gouv.fr/doc-api
// ============================================================================

export interface GeorisquesResult {
  hasRisks: boolean;
  risks: GeorisqueRisk[];
  pprn: GeorisquePPRN[];
  icpe: GeorisqueICPE[];
  sis: GeorisqueSIS[];
  radon: GeorisqueRadon | null;
}

export interface GeorisqueRisk {
  code: string;
  name: string;
  level: 'low' | 'medium' | 'high';
  description: string;
}

export interface GeorisquePPRN {
  code: string;
  name: string;
  dateApprobation?: string;
  url?: string;
}

export interface GeorisqueICPE {
  name: string;
  regime: string;
  distance: number;
}

export interface GeorisqueSIS {
  name: string;
  type: string;
  distance: number;
}

export interface GeorisqueRadon {
  classePotentiel: 1 | 2 | 3;
  libelle: string;
}

export class GeorisquesApiService {
  private static BASE_URL = 'https://georisques.gouv.fr/api/v1';

  /**
   * Récupère tous les risques pour une localisation
   */
  static async getRisks(coordinates: Coordinates): Promise<GeorisquesResult> {
    const cacheKey = `risks:${coordinates.lat}:${coordinates.lng}`;
    const cached = await this.getCached(cacheKey);
    if (cached) return cached as GeorisquesResult;

    const result: GeorisquesResult = {
      hasRisks: false,
      risks: [],
      pprn: [],
      icpe: [],
      sis: [],
      radon: null,
    };

    try {
      // Requêtes en parallèle pour optimiser
      const [gaspar, radon, icpe, sis] = await Promise.all([
        this.fetchGASPAR(coordinates),
        this.fetchRadon(coordinates),
        this.fetchICPE(coordinates),
        this.fetchSIS(coordinates),
      ]);

      result.risks = gaspar.risks;
      result.pprn = gaspar.pprn;
      result.radon = radon;
      result.icpe = icpe;
      result.sis = sis;
      result.hasRisks = result.risks.length > 0 || result.pprn.length > 0;

      await this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Erreur API Géorisques:', error);
      return result;
    }
  }

  /**
   * Récupère les risques GASPAR (inondations, mouvements de terrain, etc.)
   */
  private static async fetchGASPAR(coordinates: Coordinates): Promise<{
    risks: GeorisqueRisk[];
    pprn: GeorisquePPRN[];
  }> {
    try {
      const response = await fetch(
        `${this.BASE_URL}/gaspar/risques?latlon=${coordinates.lat},${coordinates.lng}&rayon=1000`
      );
      const data = await response.json();

      const risks: GeorisqueRisk[] = [];
      const pprn: GeorisquePPRN[] = [];

      if (data.data) {
        data.data.forEach((item: Record<string, unknown>) => {
          if (item.risque_jo) {
            const risqueJo = item.risque_jo as Record<string, unknown>[];
            risqueJo.forEach((r) => {
              risks.push({
                code: r.cod_risque_jo as string,
                name: r.lib_risque_jo as string,
                level: 'medium',
                description: '',
              });
            });
          }
        });
      }

      return { risks, pprn };
    } catch (error) {
      console.error('Erreur GASPAR:', error);
      return { risks: [], pprn: [] };
    }
  }

  /**
   * Récupère le potentiel radon
   */
  private static async fetchRadon(coordinates: Coordinates): Promise<GeorisqueRadon | null> {
    try {
      const response = await fetch(
        `${this.BASE_URL}/radon?latlon=${coordinates.lat},${coordinates.lng}`
      );
      const data = await response.json();

      if (data.data?.[0]) {
        const radon = data.data[0];
        return {
          classePotentiel: radon.classe_potentiel,
          libelle: radon.libelle_classe_potentiel,
        };
      }
      return null;
    } catch (error) {
      console.error('Erreur Radon:', error);
      return null;
    }
  }

  /**
   * Récupère les installations classées (ICPE) à proximité
   */
  private static async fetchICPE(coordinates: Coordinates): Promise<GeorisqueICPE[]> {
    try {
      const response = await fetch(
        `${this.BASE_URL}/installations_classees?latlon=${coordinates.lat},${coordinates.lng}&rayon=500`
      );
      const data = await response.json();

      return (data.data || []).map((item: Record<string, unknown>) => ({
        name: item.nom_ets as string,
        regime: item.regime as string,
        distance: item.distance as number,
      }));
    } catch (error) {
      console.error('Erreur ICPE:', error);
      return [];
    }
  }

  /**
   * Récupère les sites et sols pollués (SIS) à proximité
   */
  private static async fetchSIS(coordinates: Coordinates): Promise<GeorisqueSIS[]> {
    try {
      const response = await fetch(
        `${this.BASE_URL}/ssp/sis?latlon=${coordinates.lat},${coordinates.lng}&rayon=500`
      );
      const data = await response.json();

      return (data.data || []).map((item: Record<string, unknown>) => ({
        name: item.nom as string,
        type: item.type as string,
        distance: item.distance as number,
      }));
    } catch (error) {
      console.error('Erreur SIS:', error);
      return [];
    }
  }

  private static async getCached(key: string): Promise<unknown | null> {
    try {
      const { data } = await supabase
        .from('phase0_api_cache')
        .select('response_data, expires_at')
        .eq('api_name', 'georisques')
        .eq('request_key', key)
        .single();

      if (data && new Date(data.expires_at) > new Date()) {
        return data.response_data;
      }
      return null;
    } catch {
      return null;
    }
  }

  private static async setCache(key: string, data: unknown): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + CACHE_DURATION['georisques']);

    try {
      await supabase
        .from('phase0_api_cache')
        .upsert({
          api_name: 'georisques',
          request_key: key,
          response_data: data,
          expires_at: expiresAt.toISOString(),
        }, {
          onConflict: 'api_name,request_key',
        });
    } catch (error) {
      console.error('Erreur cache:', error);
    }
  }
}

// ============================================================================
// API DPE ADEME
// Documentation: https://data.ademe.fr/datasets/dpe-logements
// ============================================================================

export interface DPEResult {
  found: boolean;
  dpe?: {
    numeroAdeme: string;
    classeConsommationEnergie: string;
    classeEmissionGes: string;
    consommationEnergie: number;
    emissionGes: number;
    dateEtablissement: string;
    typeLogement: string;
    anneeConstruction: number;
    surfaceHabitable: number;
    methodeDpe: string;
  };
}

export class ADEMEApiService {
  private static BASE_URL = 'https://data.ademe.fr/data-fair/api/v1/datasets/dpe-logements/lines';

  /**
   * Recherche un DPE par adresse
   */
  static async searchByAddress(address: Address): Promise<DPEResult> {
    const query = `${address.street}, ${address.postalCode} ${address.city}`;
    const cacheKey = `dpe:${query}`;
    const cached = await this.getCached(cacheKey);
    if (cached) return cached as DPEResult;

    try {
      // Recherche par code postal et nom de rue
      const params = new URLSearchParams({
        q: address.street || '',
        q_fields: 'Adresse_(BAN)',
        'Etiquette_DPE_exists': 'true',
        size: '1',
      });

      if (address.postalCode) {
        params.append('Code_postal_(BAN)', address.postalCode);
      }

      const response = await fetch(`${this.BASE_URL}?${params}`);
      const data = await response.json();

      if (!data.results?.length) {
        return { found: false };
      }

      const dpe = data.results[0];
      const result: DPEResult = {
        found: true,
        dpe: {
          numeroAdeme: dpe['N°_DPE'] || dpe['N°DPE'],
          classeConsommationEnergie: dpe['Etiquette_DPE'],
          classeEmissionGes: dpe['Etiquette_GES'],
          consommationEnergie: parseFloat(dpe['Conso_5_usages_é_finale']),
          emissionGes: parseFloat(dpe['Emission_GES_5_usages']),
          dateEtablissement: dpe['Date_établissement_DPE'],
          typeLogement: dpe['Type_bâtiment'],
          anneeConstruction: parseInt(dpe['Année_construction']),
          surfaceHabitable: parseFloat(dpe['Surface_habitable_logement']),
          methodeDpe: dpe['Méthode_du_DPE'],
        },
      };

      await this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Erreur API ADEME DPE:', error);
      return { found: false };
    }
  }

  /**
   * Recherche les DPE pour un code postal
   */
  static async searchByPostalCode(postalCode: string): Promise<DPEResult[]> {
    try {
      const params = new URLSearchParams({
        'Code_postal_(BAN)': postalCode,
        'Etiquette_DPE_exists': 'true',
        size: '20',
        sort: 'Date_établissement_DPE:-1',
      });

      const response = await fetch(`${this.BASE_URL}?${params}`);
      const data = await response.json();

      return (data.results || []).map((dpe: Record<string, unknown>) => ({
        found: true,
        dpe: {
          numeroAdeme: dpe['N°_DPE'] || dpe['N°DPE'],
          classeConsommationEnergie: dpe['Etiquette_DPE'],
          classeEmissionGes: dpe['Etiquette_GES'],
          consommationEnergie: parseFloat(dpe['Conso_5_usages_é_finale'] as string),
          emissionGes: parseFloat(dpe['Emission_GES_5_usages'] as string),
          dateEtablissement: dpe['Date_établissement_DPE'],
          typeLogement: dpe['Type_bâtiment'],
          anneeConstruction: parseInt(dpe['Année_construction'] as string),
          surfaceHabitable: parseFloat(dpe['Surface_habitable_logement'] as string),
          methodeDpe: dpe['Méthode_du_DPE'],
        },
      }));
    } catch (error) {
      console.error('Erreur API ADEME DPE:', error);
      return [];
    }
  }

  private static async getCached(key: string): Promise<unknown | null> {
    try {
      const { data } = await supabase
        .from('phase0_api_cache')
        .select('response_data, expires_at')
        .eq('api_name', 'ademe_dpe')
        .eq('request_key', key)
        .single();

      if (data && new Date(data.expires_at) > new Date()) {
        return data.response_data;
      }
      return null;
    } catch {
      return null;
    }
  }

  private static async setCache(key: string, data: unknown): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + CACHE_DURATION['ademe_dpe']);

    try {
      await supabase
        .from('phase0_api_cache')
        .upsert({
          api_name: 'ademe_dpe',
          request_key: key,
          response_data: data,
          expires_at: expiresAt.toISOString(),
        }, {
          onConflict: 'api_name,request_key',
        });
    } catch (error) {
      console.error('Erreur cache:', error);
    }
  }
}

// ============================================================================
// API Cadastre
// Documentation: https://cadastre.data.gouv.fr/
// ============================================================================

export interface CadastreParcel {
  id: string;
  commune: string;
  prefixe: string;
  section: string;
  numero: string;
  contenance: number;
  coordinates: Coordinates;
}

export class CadastreApiService {
  private static BASE_URL = 'https://cadastre.data.gouv.fr/bundler/cadastre-etalab';
  private static GEO_URL = 'https://apicarto.ign.fr/api/cadastre';

  /**
   * Recherche une parcelle par coordonnées
   */
  static async getParcelByCoordinates(coordinates: Coordinates): Promise<CadastreParcel | null> {
    const cacheKey = `parcel:${coordinates.lat}:${coordinates.lng}`;
    const cached = await this.getCached(cacheKey);
    if (cached) return cached as CadastreParcel;

    try {
      const response = await fetch(
        `${this.GEO_URL}/parcelle?geom={"type":"Point","coordinates":[${coordinates.lng},${coordinates.lat}]}`
      );
      const data = await response.json();

      if (!data.features?.length) return null;

      const feature = data.features[0];
      const props = feature.properties as Record<string, unknown>;
      const geometry = feature.geometry as { coordinates: number[][][] };

      // Calculer le centroïde approximatif
      const centroid = this.calculateCentroid(geometry.coordinates[0]);

      const result: CadastreParcel = {
        id: props.id as string,
        commune: props.commune as string,
        prefixe: props.prefixe as string,
        section: props.section as string,
        numero: props.numero as string,
        contenance: props.contenance as number,
        coordinates: centroid,
      };

      await this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Erreur API Cadastre:', error);
      return null;
    }
  }

  /**
   * Recherche des parcelles par commune et section
   */
  static async searchParcels(
    codeInsee: string,
    section?: string,
    numero?: string
  ): Promise<CadastreParcel[]> {
    try {
      let url = `${this.GEO_URL}/parcelle?code_insee=${codeInsee}`;
      if (section) url += `&section=${section}`;
      if (numero) url += `&numero=${numero}`;

      const response = await fetch(url);
      const data = await response.json();

      return (data.features || []).map((feature: Record<string, unknown>) => {
        const props = feature.properties as Record<string, unknown>;
        const geometry = feature.geometry as { coordinates: number[][][] };

        return {
          id: props.id as string,
          commune: props.commune as string,
          prefixe: props.prefixe as string,
          section: props.section as string,
          numero: props.numero as string,
          contenance: props.contenance as number,
          coordinates: this.calculateCentroid(geometry.coordinates[0]),
        };
      });
    } catch (error) {
      console.error('Erreur API Cadastre:', error);
      return [];
    }
  }

  private static calculateCentroid(coordinates: number[][]): Coordinates {
    let lat = 0;
    let lng = 0;
    const n = coordinates.length;

    coordinates.forEach(([x, y]) => {
      lng += x;
      lat += y;
    });

    return { lat: lat / n, lng: lng / n };
  }

  private static async getCached(key: string): Promise<unknown | null> {
    try {
      const { data } = await supabase
        .from('phase0_api_cache')
        .select('response_data, expires_at')
        .eq('api_name', 'cadastre')
        .eq('request_key', key)
        .single();

      if (data && new Date(data.expires_at) > new Date()) {
        return data.response_data;
      }
      return null;
    } catch {
      return null;
    }
  }

  private static async setCache(key: string, data: unknown): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + CACHE_DURATION['cadastre']);

    try {
      await supabase
        .from('phase0_api_cache')
        .upsert({
          api_name: 'cadastre',
          request_key: key,
          response_data: data,
          expires_at: expiresAt.toISOString(),
        }, {
          onConflict: 'api_name,request_key',
        });
    } catch (error) {
      console.error('Erreur cache:', error);
    }
  }
}

// ============================================================================
// API Atlas du Patrimoine
// Vérifie si un bien est en zone patrimoniale
// ============================================================================

export interface PatrimoineResult {
  isInProtectedZone: boolean;
  protections: PatrimoineProtection[];
  nearbyMonuments: PatrimoineMonument[];
}

export interface PatrimoineProtection {
  type: 'abf' | 'monument_historique' | 'zppaup' | 'avap' | 'site_classe' | 'site_inscrit';
  name: string;
  distance?: number;
}

export interface PatrimoineMonument {
  name: string;
  type: string;
  protection: string;
  distance: number;
}

export class PatrimoineApiService {
  private static ATLAS_URL = 'https://atlas.patrimoines.culture.fr/atlas/rest/services';

  /**
   * Vérifie la présence en zone patrimoniale
   */
  static async checkPatrimoine(coordinates: Coordinates): Promise<PatrimoineResult> {
    const cacheKey = `patrimoine:${coordinates.lat}:${coordinates.lng}`;
    const cached = await this.getCached(cacheKey);
    if (cached) return cached as PatrimoineResult;

    const result: PatrimoineResult = {
      isInProtectedZone: false,
      protections: [],
      nearbyMonuments: [],
    };

    try {
      // Note: L'API Atlas du Patrimoine nécessite généralement une authentification
      // Ici on simule avec une logique basique basée sur la localisation
      // En production, on utiliserait l'API officielle

      // Pour l'instant, on retourne un résultat vide
      // L'intégration réelle nécessiterait les credentials de l'API

      await this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Erreur API Patrimoine:', error);
      return result;
    }
  }

  private static async getCached(key: string): Promise<unknown | null> {
    try {
      const { data } = await supabase
        .from('phase0_api_cache')
        .select('response_data, expires_at')
        .eq('api_name', 'atlas_patrimoine')
        .eq('request_key', key)
        .single();

      if (data && new Date(data.expires_at) > new Date()) {
        return data.response_data;
      }
      return null;
    } catch {
      return null;
    }
  }

  private static async setCache(key: string, data: unknown): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + CACHE_DURATION['atlas_patrimoine']);

    try {
      await supabase
        .from('phase0_api_cache')
        .upsert({
          api_name: 'atlas_patrimoine',
          request_key: key,
          response_data: data,
          expires_at: expiresAt.toISOString(),
        }, {
          onConflict: 'api_name,request_key',
        });
    } catch (error) {
      console.error('Erreur cache:', error);
    }
  }
}

// ============================================================================
// Service agrégateur pour enrichir un projet
// ============================================================================

export interface EnrichmentResult {
  address?: BANSearchResult;
  risks?: GeorisquesResult;
  dpe?: DPEResult;
  cadastre?: CadastreParcel;
  patrimoine?: PatrimoineResult;
}

export class ProjectEnrichmentService {
  /**
   * Enrichit un projet avec toutes les données externes disponibles
   */
  static async enrichProject(
    address: Address,
    coordinates?: Coordinates
  ): Promise<EnrichmentResult> {
    const result: EnrichmentResult = {};

    // Si pas de coordonnées, les obtenir via BAN
    let coords = coordinates;
    if (!coords && address.street && address.postalCode) {
      const banResults = await BANApiService.search(
        `${address.street}, ${address.postalCode} ${address.city}`
      );
      if (banResults.length > 0) {
        result.address = banResults[0];
        coords = banResults[0].coordinates;
      }
    }

    // Si on a des coordonnées, enrichir avec les autres APIs
    if (coords) {
      const [risks, cadastre, patrimoine] = await Promise.all([
        GeorisquesApiService.getRisks(coords),
        CadastreApiService.getParcelByCoordinates(coords),
        PatrimoineApiService.checkPatrimoine(coords),
      ]);

      result.risks = risks;
      result.cadastre = cadastre || undefined;
      result.patrimoine = patrimoine;
    }

    // Rechercher le DPE par adresse
    result.dpe = await ADEMEApiService.searchByAddress(address);

    return result;
  }
}

export default {
  BANApiService,
  GeorisquesApiService,
  ADEMEApiService,
  CadastreApiService,
  PatrimoineApiService,
  ProjectEnrichmentService,
};

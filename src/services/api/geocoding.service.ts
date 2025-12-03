/**
 * Service de géocodage - API Géoplateforme IGN
 *
 * API gratuite et sans authentification
 * Base URL : https://data.geopf.fr/geocodage
 *
 * Fonctionnalités :
 * - Géocodage direct : adresse → coordonnées GPS
 * - Géocodage inverse : GPS → adresse
 * - Recherche parcelles cadastrales
 * - Calcul de distances
 */

const GEOCODING_API_URL = 'https://data.geopf.fr/geocodage';

// ============================================
// TYPES
// ============================================

export interface GeocodingResult {
  // Coordonnées
  latitude: number;
  longitude: number;
  coordinates: { lat: number; lng: number } | null;

  // Adresse normalisée
  label: string;
  housenumber: string | null;
  street: string | null;
  postcode: string;
  city: string;
  citycode: string; // Code INSEE
  context: string; // "Département, Région"

  // Données géographiques extraites
  departement?: string;
  departementCode?: string;
  region?: string;

  // Qualité
  score: number; // 0-1, confiance du résultat
  type: 'housenumber' | 'street' | 'locality' | 'municipality';

  // Données brutes
  raw: any;
}

export interface ReverseGeocodingResult extends GeocodingResult {
  distance: number; // Distance en mètres du point recherché
}

export interface ParcelResult {
  id: string; // Identifiant parcelle (ex: 75056104AV0133)
  departmentcode: string;
  municipalitycode: string;
  city: string;
  section: string;
  number: string;
  sheet: string;

  // Coordonnées centroïde
  latitude: number;
  longitude: number;

  // Géométrie (si demandée)
  geometry?: {
    type: 'Polygon';
    coordinates: number[][][];
  };

  score: number;
}

export interface DistanceResult {
  // Points
  origin: {
    address: string;
    latitude: number;
    longitude: number;
  };
  destination: {
    address: string;
    latitude: number;
    longitude: number;
  };

  // Distance à vol d'oiseau
  distanceKm: number;
  distanceM: number;

  // Formaté pour affichage
  distanceFormatee: string;

  // Estimation route (approximation x1.3)
  estimatedRoadDistanceKm: number;

  // Estimation temps trajet (50 km/h moyenne)
  estimatedDurationMinutes: number;
  dureeEstimee: string; // Format "Xh Ymin" ou "Y min"

  // Zone de proximité
  proximityZone: 'local' | 'regional' | 'national';
  zone: {
    type: 'proximite' | 'locale' | 'regionale' | 'nationale';
    label: string;
  };
}

export interface GeoZone {
  department: string;
  departmentCode: string;
  region: string;
  regionCode: string;
  isUrban: boolean;
  priceCoefficient: number; // Coefficient prix régional
}

// ============================================
// SERVICE GÉOCODAGE
// ============================================

class GeocodingService {

  /**
   * Géocodage direct : convertit une adresse en coordonnées GPS
   *
   * @param address Adresse à géocoder
   * @param options Options de recherche
   */
  async geocode(address: string, options: {
    limit?: number;
    postcode?: string;
    citycode?: string;
    type?: 'housenumber' | 'street' | 'locality' | 'municipality';
    autocomplete?: boolean;
  } = {}): Promise<{
    success: boolean;
    data?: GeocodingResult[];
    bestMatch?: GeocodingResult;
    error?: string;
  }> {
    if (!address || address.trim().length < 3) {
      return { success: false, error: 'Adresse trop courte' };
    }

    try {
      const params = new URLSearchParams({
        q: address.trim(),
        limit: String(options.limit || 5),
        autocomplete: options.autocomplete !== false ? '1' : '0',
        index: 'address',
      });

      if (options.postcode) params.append('postcode', options.postcode);
      if (options.citycode) params.append('citycode', options.citycode);
      if (options.type) params.append('type', options.type);

      console.log('[Geocoding] Recherche:', address);
      const response = await fetch(`${GEOCODING_API_URL}/search?${params}`);

      if (!response.ok) {
        console.error('[Geocoding] Erreur API:', response.status);
        return { success: false, error: `Erreur API: ${response.status}` };
      }

      const data = await response.json();

      if (!data.features || data.features.length === 0) {
        console.log('[Geocoding] Aucun résultat pour:', address);
        return { success: true, data: [], bestMatch: undefined };
      }

      const results: GeocodingResult[] = data.features.map((f: any) => {
        const lat = f.geometry.coordinates[1];
        const lng = f.geometry.coordinates[0];
        const context = f.properties.context || '';
        const contextParts = context.split(',').map((s: string) => s.trim());

        return {
          latitude: lat,
          longitude: lng,
          coordinates: { lat, lng },
          label: f.properties.label,
          housenumber: f.properties.housenumber || null,
          street: f.properties.street || null,
          postcode: f.properties.postcode,
          city: f.properties.city,
          citycode: f.properties.citycode,
          context,
          departementCode: contextParts[0] || undefined,
          departement: contextParts[1] || undefined,
          region: contextParts[2] || undefined,
          score: f.properties.score || f.properties._score,
          type: f.properties.type,
          raw: f,
        };
      });

      console.log('[Geocoding] Trouvé:', results.length, 'résultats');
      return {
        success: true,
        data: results,
        bestMatch: results[0],
      };

    } catch (error) {
      console.error('[Geocoding] Erreur:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur de connexion'
      };
    }
  }

  /**
   * Géocodage inverse : convertit des coordonnées GPS en adresse
   *
   * @param lat Latitude
   * @param lon Longitude
   */
  async reverseGeocode(lat: number, lon: number, options: {
    limit?: number;
    type?: 'housenumber' | 'street' | 'locality' | 'municipality';
  } = {}): Promise<{
    success: boolean;
    data?: ReverseGeocodingResult[];
    bestMatch?: ReverseGeocodingResult;
    error?: string;
  }> {
    try {
      const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lon),
        limit: String(options.limit || 5),
        index: 'address',
      });

      if (options.type) params.append('type', options.type);

      console.log('[Geocoding] Reverse:', lat, lon);
      const response = await fetch(`${GEOCODING_API_URL}/reverse?${params}`);

      if (!response.ok) {
        return { success: false, error: `Erreur API: ${response.status}` };
      }

      const data = await response.json();

      if (!data.features || data.features.length === 0) {
        return { success: true, data: [], bestMatch: undefined };
      }

      const results: ReverseGeocodingResult[] = data.features.map((f: any) => {
        const lat = f.geometry.coordinates[1];
        const lng = f.geometry.coordinates[0];
        const context = f.properties.context || '';
        const contextParts = context.split(',').map((s: string) => s.trim());

        return {
          latitude: lat,
          longitude: lng,
          coordinates: { lat, lng },
          label: f.properties.label,
          housenumber: f.properties.housenumber || null,
          street: f.properties.street || null,
          postcode: f.properties.postcode,
          city: f.properties.city,
          citycode: f.properties.citycode,
          context,
          departementCode: contextParts[0] || undefined,
          departement: contextParts[1] || undefined,
          region: contextParts[2] || undefined,
          score: f.properties.score || f.properties._score,
          type: f.properties.type,
          distance: f.properties.distance || 0,
          raw: f,
        };
      });

      return {
        success: true,
        data: results,
        bestMatch: results[0],
      };

    } catch (error) {
      console.error('[Geocoding] Erreur reverse:', error);
      return { success: false, error: 'Erreur de connexion' };
    }
  }

  /**
   * Recherche de parcelle cadastrale
   *
   * @param query Identifiant parcelle ou recherche
   */
  async searchParcel(query: string, options: {
    departmentcode?: string;
    municipalitycode?: string;
    section?: string;
    number?: string;
    limit?: number;
    returnGeometry?: boolean;
  } = {}): Promise<{
    success: boolean;
    data?: ParcelResult[];
    error?: string;
  }> {
    try {
      const params = new URLSearchParams({
        q: query || '',
        index: 'parcel',
        limit: String(options.limit || 5),
        returntruegeometry: options.returnGeometry ? 'true' : 'false',
      });

      if (options.departmentcode) params.append('departmentcode', options.departmentcode);
      if (options.municipalitycode) params.append('municipalitycode', options.municipalitycode);
      if (options.section) params.append('section', options.section);
      if (options.number) params.append('number', options.number);

      const response = await fetch(`${GEOCODING_API_URL}/search?${params}`);

      if (!response.ok) {
        return { success: false, error: `Erreur API: ${response.status}` };
      }

      const data = await response.json();

      if (!data.features || data.features.length === 0) {
        return { success: true, data: [] };
      }

      const results: ParcelResult[] = data.features.map((f: any) => ({
        id: f.properties.id,
        departmentcode: f.properties.departmentcode,
        municipalitycode: f.properties.municipalitycode,
        city: f.properties.city,
        section: f.properties.section,
        number: f.properties.number,
        sheet: f.properties.sheet,
        latitude: f.geometry.coordinates[1],
        longitude: f.geometry.coordinates[0],
        geometry: f.properties.truegeometry || undefined,
        score: f.properties._score,
      }));

      return { success: true, data: results };

    } catch (error) {
      console.error('[Geocoding] Erreur parcelle:', error);
      return { success: false, error: 'Erreur de connexion' };
    }
  }

  /**
   * Calcule la distance entre deux adresses
   *
   * @param originAddress Adresse de départ
   * @param destinationAddress Adresse d'arrivée
   */
  async calculateDistance(
    originAddress: string,
    destinationAddress: string
  ): Promise<{
    success: boolean;
    data?: DistanceResult;
    error?: string;
  }> {
    // Géocoder les deux adresses
    const [originResult, destResult] = await Promise.all([
      this.geocode(originAddress, { limit: 1 }),
      this.geocode(destinationAddress, { limit: 1 }),
    ]);

    if (!originResult.success || !originResult.bestMatch) {
      return { success: false, error: `Adresse origine non trouvée: ${originAddress}` };
    }

    if (!destResult.success || !destResult.bestMatch) {
      return { success: false, error: `Adresse destination non trouvée: ${destinationAddress}` };
    }

    const origin = originResult.bestMatch;
    const dest = destResult.bestMatch;

    // Calcul distance à vol d'oiseau (formule Haversine)
    const distanceM = this.haversineDistance(
      origin.latitude, origin.longitude,
      dest.latitude, dest.longitude
    );

    const distanceKm = distanceM / 1000;

    // Estimation distance route (coefficient 1.3 en moyenne)
    const estimatedRoadDistanceKm = distanceKm * 1.3;

    // Estimation durée (50 km/h en moyenne urbain/périurbain)
    const estimatedDurationMinutes = Math.round(estimatedRoadDistanceKm / 50 * 60);

    // Zone de proximité
    let proximityZone: 'local' | 'regional' | 'national';
    let zoneType: 'proximite' | 'locale' | 'regionale' | 'nationale';
    let zoneLabel: string;

    if (distanceKm <= 15) {
      proximityZone = 'local';
      zoneType = 'proximite';
      zoneLabel = 'Proximité immédiate';
    } else if (distanceKm <= 30) {
      proximityZone = 'local';
      zoneType = 'locale';
      zoneLabel = 'Zone locale';
    } else if (distanceKm <= 100) {
      proximityZone = 'regional';
      zoneType = 'regionale';
      zoneLabel = 'Zone régionale';
    } else {
      proximityZone = 'national';
      zoneType = 'nationale';
      zoneLabel = 'Zone nationale';
    }

    // Formatage distance
    const distanceFormatee = distanceKm < 1
      ? `${Math.round(distanceM)} m`
      : distanceKm < 10
        ? `${distanceKm.toFixed(1)} km`
        : `${Math.round(distanceKm)} km`;

    // Formatage durée
    const hours = Math.floor(estimatedDurationMinutes / 60);
    const mins = estimatedDurationMinutes % 60;
    const dureeEstimee = hours > 0
      ? `${hours}h ${mins > 0 ? `${mins} min` : ''}`
      : `${mins} min`;

    console.log('[Geocoding] Distance calculée:', {
      origin: origin.label,
      destination: dest.label,
      distanceKm: Math.round(distanceKm * 10) / 10,
      proximityZone,
    });

    return {
      success: true,
      data: {
        origin: {
          address: origin.label,
          latitude: origin.latitude,
          longitude: origin.longitude,
        },
        destination: {
          address: dest.label,
          latitude: dest.latitude,
          longitude: dest.longitude,
        },
        distanceKm: Math.round(distanceKm * 10) / 10,
        distanceM: Math.round(distanceM),
        distanceFormatee,
        estimatedRoadDistanceKm: Math.round(estimatedRoadDistanceKm * 10) / 10,
        estimatedDurationMinutes,
        dureeEstimee,
        proximityZone,
        zone: {
          type: zoneType,
          label: zoneLabel,
        },
      },
    };
  }

  /**
   * Calcule la distance entre deux points GPS
   *
   * @param origin Coordonnées origine { lat, lng } ou (lat, lon)
   * @param destination Coordonnées destination { lat, lng } ou (lat, lon)
   */
  calculateDistanceFromCoords(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ): {
    success: boolean;
    data?: DistanceResult;
    error?: string;
  } {
    const distanceM = this.haversineDistance(
      origin.lat, origin.lng,
      destination.lat, destination.lng
    );

    const distanceKm = distanceM / 1000;
    const estimatedRoadDistanceKm = distanceKm * 1.3;
    const estimatedDurationMinutes = Math.round(estimatedRoadDistanceKm / 50 * 60);

    // Zone de proximité
    let proximityZone: 'local' | 'regional' | 'national';
    let zoneType: 'proximite' | 'locale' | 'regionale' | 'nationale';
    let zoneLabel: string;

    if (distanceKm <= 15) {
      proximityZone = 'local';
      zoneType = 'proximite';
      zoneLabel = 'Proximité immédiate';
    } else if (distanceKm <= 30) {
      proximityZone = 'local';
      zoneType = 'locale';
      zoneLabel = 'Zone locale';
    } else if (distanceKm <= 100) {
      proximityZone = 'regional';
      zoneType = 'regionale';
      zoneLabel = 'Zone régionale';
    } else {
      proximityZone = 'national';
      zoneType = 'nationale';
      zoneLabel = 'Zone nationale';
    }

    // Formatage distance
    const distanceFormatee = distanceKm < 1
      ? `${Math.round(distanceM)} m`
      : distanceKm < 10
        ? `${distanceKm.toFixed(1)} km`
        : `${Math.round(distanceKm)} km`;

    // Formatage durée
    const hours = Math.floor(estimatedDurationMinutes / 60);
    const mins = estimatedDurationMinutes % 60;
    const dureeEstimee = hours > 0
      ? `${hours}h ${mins > 0 ? `${mins} min` : ''}`
      : `${mins} min`;

    return {
      success: true,
      data: {
        origin: {
          address: '',
          latitude: origin.lat,
          longitude: origin.lng,
        },
        destination: {
          address: '',
          latitude: destination.lat,
          longitude: destination.lng,
        },
        distanceKm: Math.round(distanceKm * 10) / 10,
        distanceM: Math.round(distanceM),
        distanceFormatee,
        estimatedRoadDistanceKm: Math.round(estimatedRoadDistanceKm * 10) / 10,
        estimatedDurationMinutes,
        dureeEstimee,
        proximityZone,
        zone: {
          type: zoneType,
          label: zoneLabel,
        },
      },
    };
  }

  /**
   * Détermine la zone géographique depuis un code postal (synchrone)
   *
   * @param postcode Code postal
   */
  getGeoZone(postcode: string): {
    success: boolean;
    data?: GeoZone;
    error?: string;
  } {
    if (!postcode || postcode.length < 2) {
      return { success: false, error: 'Code postal invalide' };
    }

    const departmentCode = postcode.substring(0, 2);
    const isUrban = ['75', '13', '69', '31', '33', '59', '06', '44', '34', '67'].includes(departmentCode);
    const priceCoefficient = this.getPriceCoefficient(departmentCode, isUrban);

    return {
      success: true,
      data: {
        department: '',
        departmentCode,
        region: '',
        regionCode: this.getRegionCode(departmentCode),
        isUrban,
        priceCoefficient,
      },
    };
  }

  /**
   * Détermine la zone géographique et les coefficients associés (async)
   *
   * @param address Adresse ou résultat de géocodage
   */
  async getGeoZoneAsync(address: string | GeocodingResult): Promise<{
    success: boolean;
    data?: GeoZone;
    error?: string;
  }> {
    let geocoded: GeocodingResult;

    if (typeof address === 'string') {
      const result = await this.geocode(address, { limit: 1 });
      if (!result.success || !result.bestMatch) {
        return { success: false, error: 'Adresse non trouvée' };
      }
      geocoded = result.bestMatch;
    } else {
      geocoded = address;
    }

    // Parser le contexte (format: "XX, Département, Région")
    const contextParts = geocoded.context?.split(',').map(s => s.trim()) || [];
    const departmentCode = contextParts[0] || geocoded.citycode?.substring(0, 2) || '';
    const department = contextParts[1] || '';
    const region = contextParts[2] || '';

    // Déterminer si zone urbaine (approximation basée sur densité)
    // Les grandes villes ont des codes INSEE spécifiques
    const urbanCityCodes = [
      '75', '13', '69', '31', '33', '59', '06', '44', '34', '67', // Grandes métropoles
    ];
    const isUrban = urbanCityCodes.some(code => departmentCode.startsWith(code)) ||
      geocoded.city?.toLowerCase().includes('paris') ||
      geocoded.city?.toLowerCase().includes('lyon') ||
      geocoded.city?.toLowerCase().includes('marseille');

    // Coefficient de prix régional (basé sur statistiques BTP)
    const priceCoefficient = this.getPriceCoefficient(departmentCode, isUrban);

    return {
      success: true,
      data: {
        department,
        departmentCode,
        region,
        regionCode: this.getRegionCode(departmentCode),
        isUrban,
        priceCoefficient,
      },
    };
  }

  /**
   * Suggère des adresses (autocomplete)
   */
  async suggest(query: string, limit: number = 5): Promise<{
    success: boolean;
    suggestions: string[];
  }> {
    if (!query || query.length < 3) {
      return { success: true, suggestions: [] };
    }

    const result = await this.geocode(query, {
      limit,
      autocomplete: true
    });

    if (!result.success || !result.data) {
      return { success: true, suggestions: [] };
    }

    return {
      success: true,
      suggestions: result.data.map(r => r.label),
    };
  }

  // ============================================
  // MÉTHODES UTILITAIRES PRIVÉES
  // ============================================

  /**
   * Formule de Haversine pour calculer la distance entre deux points GPS
   */
  private haversineDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number
  ): number {
    const R = 6371000; // Rayon Terre en mètres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  /**
   * Coefficient de prix régional BTP
   * Source : Indices CERC / données marché
   */
  private getPriceCoefficient(departmentCode: string, isUrban: boolean): number {
    // Coefficients approximatifs basés sur données marché BTP
    const coefficients: Record<string, number> = {
      // Île-de-France (plus cher)
      '75': 1.35, '92': 1.30, '93': 1.20, '94': 1.20,
      '77': 1.10, '78': 1.15, '91': 1.10, '95': 1.15,

      // Grandes métropoles
      '69': 1.15, // Lyon
      '13': 1.10, // Marseille
      '31': 1.10, // Toulouse
      '33': 1.10, // Bordeaux
      '59': 1.05, // Lille
      '06': 1.20, // Nice/Côte d'Azur
      '67': 1.10, // Strasbourg
      '44': 1.10, // Nantes

      // Zones standard
      'default': 1.00,
    };

    let coefficient = coefficients[departmentCode] || coefficients['default'];

    // Ajustement urbain/rural
    if (!isUrban && coefficient > 1.0) {
      coefficient = coefficient * 0.95; // -5% en zone rurale
    }

    return Math.round(coefficient * 100) / 100;
  }

  /**
   * Code région depuis département
   */
  private getRegionCode(departmentCode: string): string {
    const mapping: Record<string, string> = {
      // Île-de-France
      '75': '11', '77': '11', '78': '11', '91': '11', '92': '11', '93': '11', '94': '11', '95': '11',
      // Auvergne-Rhône-Alpes
      '01': '84', '03': '84', '07': '84', '15': '84', '26': '84', '38': '84', '42': '84', '43': '84', '63': '84', '69': '84', '73': '84', '74': '84',
      // Bourgogne-Franche-Comté
      '21': '27', '25': '27', '39': '27', '58': '27', '70': '27', '71': '27', '89': '27', '90': '27',
      // Bretagne
      '22': '53', '29': '53', '35': '53', '56': '53',
      // Centre-Val de Loire
      '18': '24', '28': '24', '36': '24', '37': '24', '41': '24', '45': '24',
      // Corse
      '2A': '94', '2B': '94',
      // Grand Est
      '08': '44', '10': '44', '51': '44', '52': '44', '54': '44', '55': '44', '57': '44', '67': '44', '68': '44', '88': '44',
      // Hauts-de-France
      '02': '32', '59': '32', '60': '32', '62': '32', '80': '32',
      // Normandie
      '14': '28', '27': '28', '50': '28', '61': '28', '76': '28',
      // Nouvelle-Aquitaine
      '16': '75', '17': '75', '19': '75', '23': '75', '24': '75', '33': '75', '40': '75', '47': '75', '64': '75', '79': '75', '86': '75', '87': '75',
      // Occitanie
      '09': '76', '11': '76', '12': '76', '30': '76', '31': '76', '32': '76', '34': '76', '46': '76', '48': '76', '65': '76', '66': '76', '81': '76', '82': '76',
      // Pays de la Loire
      '44': '52', '49': '52', '53': '52', '72': '52', '85': '52',
      // Provence-Alpes-Côte d'Azur
      '04': '93', '05': '93', '06': '93', '13': '93', '83': '93', '84': '93',
    };
    return mapping[departmentCode] || '';
  }
}

export const geocodingService = new GeocodingService();

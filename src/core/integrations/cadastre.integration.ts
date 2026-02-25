/**
 * Cadastre Integration (Phase 30)
 * French Land Registry - Parcel information
 * API: geo.api.gouv.fr/cadastre
 */

export type ParcelClassification =
  | 'residential'
  | 'commercial'
  | 'industrial'
  | 'agricultural'
  | 'forest'
  | 'water'
  | 'other';

export interface ParcelInfo {
  parcelId: string;
  municipality: string;
  section: string;
  parcelNumber: string;
  area: number; // in m²
  classification: ParcelClassification;
  ownership: 'private' | 'public' | 'unknown';
  latitude: number;
  longitude: number;
  confidenceScore: number;
}

export interface CadastreResult {
  valid: boolean;
  parcel?: ParcelInfo;
  errors?: string[];
  cached: boolean;
}

/**
 * Query Cadastre API for parcel information
 */
async function queryCadastreAPI(latitude: number, longitude: number): Promise<ParcelInfo | null> {
  try {
    // Geo API with cadastre endpoint
    const endpoint = 'https://geo.api.gouv.fr/parcelles';

    const params = new URLSearchParams({
      lon: longitude.toString(),
      lat: latitude.toString(),
      limit: '1',
    });

    const response = await fetch(`${endpoint}?${params}`, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[Cadastre] API error: ${response.statusText}`);
      return null;
    }

    const data: any = await response.json();

    if (!data.features || data.features.length === 0) {
      return null;
    }

    const feature = data.features[0];
    const properties = feature.properties;
    const geometry = feature.geometry.coordinates[0][0]; // First ring, first point

    const parcel: ParcelInfo = {
      parcelId: properties.id || '',
      municipality: properties.commune || '',
      section: properties.section || '',
      parcelNumber: properties.numero || '',
      area: calculateAreaFromGeometry(feature.geometry),
      classification: classifyParcel(properties),
      ownership: determineOwnership(properties),
      latitude: geometry[1],
      longitude: geometry[0],
      confidenceScore: 0.95,
    };

    return parcel;
  } catch (error) {
    console.error('[Cadastre] API query failed:', error);
    return null;
  }
}

/**
 * Calculate area from polygon geometry
 */
function calculateAreaFromGeometry(geometry: any): number {
  // Simplified: use approximate area in m² from API or geometry
  // In production, would use proper polygon area calculation
  if (geometry.properties?.area) {
    return geometry.properties.area;
  }

  // Return placeholder if not available
  return 0;
}

/**
 * Classify parcel based on designation
 */
function classifyParcel(properties: any): ParcelClassification {
  const designation = (properties.designation || '').toLowerCase();

  if (/residential|habitation|logement/.test(designation)) {
    return 'residential';
  }

  if (/commercial|commerce|magasin|boutique/.test(designation)) {
    return 'commercial';
  }

  if (/industrial|industrie|usine|manufacture/.test(designation)) {
    return 'industrial';
  }

  if (/agricultural|agricole|ferme|culture/.test(designation)) {
    return 'agricultural';
  }

  if (/forest|forêt|bois/.test(designation)) {
    return 'forest';
  }

  if (/water|eau|lac|étang|rivière/.test(designation)) {
    return 'water';
  }

  return 'other';
}

/**
 * Determine ownership type
 */
function determineOwnership(properties: any): 'private' | 'public' | 'unknown' {
  const designation = (properties.designation || '').toLowerCase();

  if (/domain public|état|commune|public/.test(designation)) {
    return 'public';
  }

  if (/private|privé/.test(designation)) {
    return 'private';
  }

  return 'unknown';
}

/**
 * Get parcel information by coordinates
 */
export async function getParcelInfo(
  latitude: number,
  longitude: number
): Promise<CadastreResult> {
  try {
    console.log(`[Cadastre] Looking up parcel at ${latitude}, ${longitude}`);

    // Validate coordinates
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return {
        valid: false,
        errors: ['Invalid coordinates'],
        cached: false,
      };
    }

    const parcel = await queryCadastreAPI(latitude, longitude);

    if (!parcel) {
      return {
        valid: false,
        errors: ['Parcel not found'],
        cached: false,
      };
    }

    return {
      valid: true,
      parcel,
      cached: false,
    };
  } catch (error) {
    console.error('[Cadastre] Lookup failed:', error);
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      cached: false,
    };
  }
}

/**
 * Get parcel by municipality and parcel number
 */
export async function getParcelByNumber(
  municipality: string,
  section: string,
  parcelNumber: string
): Promise<CadastreResult> {
  try {
    console.log(`[Cadastre] Looking up ${municipality}/${section}/${parcelNumber}`);

    // In production, would query Cadastre API directly
    // For now, placeholder
    return {
      valid: false,
      errors: ['API endpoint not configured'],
      cached: false,
    };
  } catch (error) {
    console.error('[Cadastre] Number lookup failed:', error);
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      cached: false,
    };
  }
}

/**
 * Batch get parcels for multiple coordinates
 */
export async function batchGetParcels(
  coordinates: Array<{ latitude: number; longitude: number }>
): Promise<Map<string, CadastreResult>> {
  const results = new Map<string, CadastreResult>();

  for (const coord of coordinates) {
    const key = `${coord.latitude},${coord.longitude}`;
    const result = await getParcelInfo(coord.latitude, coord.longitude);
    results.set(key, result);
  }

  return results;
}

/**
 * Check if parcel is suitable for construction
 */
export function isParcelBuildable(parcel: ParcelInfo): boolean {
  // Check classification
  if (parcel.classification === 'water' || parcel.classification === 'forest') {
    return false;
  }

  // Check minimum area (e.g., for residential)
  if (parcel.classification === 'residential' && parcel.area < 100) {
    return false;
  }

  return true;
}

/**
 * Get parcel classification label
 */
export function getClassificationLabel(classification: ParcelClassification): string {
  const labels: { [key in ParcelClassification]: string } = {
    residential: 'Résidentiel',
    commercial: 'Commercial',
    industrial: 'Industriel',
    agricultural: 'Agricole',
    forest: 'Forestier',
    water: 'Eau',
    other: 'Autre',
  };

  return labels[classification];
}

/**
 * Format area for display
 */
export function formatArea(areaM2: number): string {
  if (areaM2 < 1000) {
    return `${areaM2.toFixed(0)} m²`;
  }

  const areaHa = areaM2 / 10000;
  if (areaHa < 100) {
    return `${areaHa.toFixed(2)} ha`;
  }

  return `${(areaHa / 100).toFixed(2)} km²`;
}

/**
 * Get cadastre badge for UI
 */
export function getCadastreBadge(result: CadastreResult): {
  color: 'green' | 'yellow' | 'red';
  text: string;
} {
  if (!result.valid || !result.parcel) {
    return { color: 'red', text: '🔴 Parcel Not Found' };
  }

  if (!isParcelBuildable(result.parcel)) {
    return { color: 'red', text: '🔴 Not Buildable' };
  }

  return { color: 'green', text: '🟢 Buildable Parcel' };
}

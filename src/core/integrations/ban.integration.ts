import { log, warn, error, time, timeEnd } from '@/lib/logger';

/**
 * BAN Integration (Phase 30)
 * French National Address Database - Address validation and normalization
 * API: api-adresse.data.gouv.fr
 */

export interface ValidatedAddress {
  original: string;
  street: string;
  municipality: string;
  zipCode: string;
  city: string;
  latitude: number;
  longitude: number;
  banId: string;
  accuracy: 'rooftop' | 'street' | 'municipality' | 'unknown';
  confidenceScore: number; // 0-1
}

export interface BanValidationResult {
  valid: boolean;
  address?: ValidatedAddress;
  alternatives?: ValidatedAddress[];
  errors?: string[];
  cached: boolean;
}

/**
 * Query BAN API for address validation
 */
async function queryBANAPI(addressStr: string): Promise<ValidatedAddress | null> {
  try {
    // BAN API is public and doesn't require authentication
    const endpoint = 'https://api-adresse.data.gouv.fr/search';

    const params = new URLSearchParams({
      q: addressStr,
      limit: '1',
    });

    const response = await fetch(`${endpoint}?${params}`, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[BAN] API error: ${response.statusText}`);
      return null;
    }

    const data: any = await response.json();

    if (!data.features || data.features.length === 0) {
      return null;
    }

    const feature = data.features[0];
    const properties = feature.properties;
    const geometry = feature.geometry.coordinates;

    const validated: ValidatedAddress = {
      original: addressStr,
      street: properties.name || '',
      municipality: properties.municipality || '',
      zipCode: properties.postcode || '',
      city: properties.city || '',
      latitude: geometry[1],
      longitude: geometry[0],
      banId: properties.id || '',
      accuracy: determineAccuracy(properties.type),
      confidenceScore: Math.min((properties.score || 0) / 100, 1),
    };

    return validated;
  } catch (error) {
    console.error('[BAN] API query failed:', error);
    return null;
  }
}

/**
 * Determine accuracy level from BAN response type
 */
function determineAccuracy(type: string): 'rooftop' | 'street' | 'municipality' | 'unknown' {
  switch (type) {
    case 'housenumber':
      return 'rooftop';
    case 'street':
      return 'street';
    case 'municipality':
      return 'municipality';
    default:
      return 'unknown';
  }
}

/**
 * Normalize address string
 */
function normalizeAddressString(address: string): string {
  return address
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s-]/g, '');
}

/**
 * Validate address with BAN
 */
export async function validateAddress(addressStr: string): Promise<BanValidationResult> {
  try {
    log(`[BAN] Validating address: ${addressStr}`);

    // Check format
    if (!addressStr || addressStr.trim().length < 10) {
      return {
        valid: false,
        errors: ['Address too short (minimum 10 characters)'],
        cached: false,
      };
    }

    // Query BAN API
    const validated = await queryBANAPI(addressStr);

    if (!validated) {
      return {
        valid: false,
        errors: ['Address not found in BAN database'],
        cached: false,
      };
    }

    // Check confidence
    if (validated.confidenceScore < 0.6) {
      return {
        valid: false,
        address: validated,
        errors: ['Low confidence score'],
        cached: false,
      };
    }

    return {
      valid: true,
      address: validated,
      cached: false,
    };
  } catch (error) {
    console.error('[BAN] Validation failed:', error);
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      cached: false,
    };
  }
}

/**
 * Search for addresses by partial string
 */
export async function searchAddresses(
  query: string,
  limit: number = 5
): Promise<ValidatedAddress[]> {
  try {
    const endpoint = 'https://api-adresse.data.gouv.fr/search';

    const params = new URLSearchParams({
      q: query,
      limit: limit.toString(),
    });

    const response = await fetch(`${endpoint}?${params}`);

    if (!response.ok) {
      return [];
    }

    const data: any = await response.json();

    if (!data.features) {
      return [];
    }

    return data.features.map((feature: any) => {
      const properties = feature.properties;
      const geometry = feature.geometry.coordinates;

      return {
        original: query,
        street: properties.name || '',
        municipality: properties.municipality || '',
        zipCode: properties.postcode || '',
        city: properties.city || '',
        latitude: geometry[1],
        longitude: geometry[0],
        banId: properties.id || '',
        accuracy: determineAccuracy(properties.type),
        confidenceScore: Math.min((properties.score || 0) / 100, 1),
      };
    });
  } catch (error) {
    console.error('[BAN] Search failed:', error);
    return [];
  }
}

/**
 * Get reverse geocoding (coordinates to address)
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<ValidatedAddress | null> {
  try {
    const endpoint = 'https://api-adresse.data.gouv.fr/reverse';

    const params = new URLSearchParams({
      lon: longitude.toString(),
      lat: latitude.toString(),
      limit: '1',
    });

    const response = await fetch(`${endpoint}?${params}`);

    if (!response.ok) {
      return null;
    }

    const data: any = await response.json();

    if (!data.features || data.features.length === 0) {
      return null;
    }

    const feature = data.features[0];
    const properties = feature.properties;

    return {
      original: `${latitude}, ${longitude}`,
      street: properties.name || '',
      municipality: properties.municipality || '',
      zipCode: properties.postcode || '',
      city: properties.city || '',
      latitude,
      longitude,
      banId: properties.id || '',
      accuracy: determineAccuracy(properties.type),
      confidenceScore: 0.95,
    };
  } catch (error) {
    console.error('[BAN] Reverse geocoding failed:', error);
    return null;
  }
}

/**
 * Batch validate multiple addresses
 */
export async function batchValidateAddresses(
  addresses: string[]
): Promise<Map<string, BanValidationResult>> {
  const results = new Map<string, BanValidationResult>();

  for (const address of addresses) {
    const result = await validateAddress(address);
    results.set(address, result);
  }

  return results;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get address badge for display
 */
export function getAddressBadge(result: BanValidationResult): {
  color: 'green' | 'yellow' | 'red';
  text: string;
} {
  if (!result.valid) {
    return { color: 'red', text: '🔴 Address Invalid' };
  }

  if (!result.address) {
    return { color: 'yellow', text: '🟡 Address Not Validated' };
  }

  if (result.address.accuracy === 'rooftop' || result.address.accuracy === 'street') {
    return { color: 'green', text: '🟢 Address Validated' };
  }

  return { color: 'yellow', text: '🟡 Partial Address' };
}

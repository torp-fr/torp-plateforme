import { log, warn, error, time, timeEnd } from '@/lib/logger';

/**
 * GeoRisk Integration (Phase 30)
 * Geographic risk assessment - Flood zones, protected areas, etc.
 * API: Georisques.gouv.fr
 */

export interface GeoRiskAssessment {
  location: {
    latitude: number;
    longitude: number;
  };
  floodRisk: 'none' | 'low' | 'moderate' | 'high';
  floodZone?: string;
  historicalFloods: number; // Number of historical flood events
  heritageProtected: boolean;
  heritageType?: string; // 'monument', 'site', 'district', etc
  seismicZone: 0 | 1 | 2 | 3 | 4 | 5; // 0 = no risk, 5 = highest
  slopeRisk: 'none' | 'low' | 'moderate' | 'high';
  subsidenceRisk: 'none' | 'low' | 'moderate' | 'high';
  radonRisk: 'low' | 'moderate' | 'high';
  confidenceScore: number;
}

export interface GeoRiskResult {
  valid: boolean;
  assessment?: GeoRiskAssessment;
  errors?: string[];
  cached: boolean;
}

/**
 * Query Georisques API
 */
async function queryGeoriquesAPI(latitude: number, longitude: number): Promise<GeoRiskAssessment | null> {
  try {
    // French Georisques API (example - actual API may vary)
    const endpoint = 'https://ws.georisques.gouv.fr/api/v1/etudesupprimantes';

    const params = new URLSearchParams({
      lon: longitude.toString(),
      lat: latitude.toString(),
    });

    const response = await fetch(`${endpoint}?${params}`, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      warn(`[GeoRisk] API error: ${response.statusText}`);
      return null;
    }

    const data: any = await response.json();

    // Parse flood risk
    const floodRisk = parseFloodRisk(data.alea_ruissellement_crue, data.alea_submersion_marine);

    // Parse seismic zone
    const seismicZone = parseSeismicZone(data.zonage_seismes);

    // Parse slope risk
    const slopeRisk = parseSlopeRisk(data.alea_mouvement_terrain);

    const assessment: GeoRiskAssessment = {
      location: { latitude, longitude },
      floodRisk,
      floodZone: data.zone_inondation,
      historicalFloods: parseHistoricalFloods(data),
      heritageProtected: data.protected_areas?.includes('heritage') || false,
      heritageType: data.heritage_type,
      seismicZone,
      slopeRisk,
      subsidenceRisk: parseSubsidenceRisk(data),
      radonRisk: parseRadonRisk(data),
      confidenceScore: 0.85,
    };

    return assessment;
  } catch (error) {
    console.error('[GeoRisk] API query failed:', error);
    return null;
  }
}

/**
 * Parse flood risk level
 */
function parseFloodRisk(
  ruissellementCrue: any,
  submersionMarine: any
): 'none' | 'low' | 'moderate' | 'high' {
  // Simplified parsing - in production would check specific risk levels
  if (ruissellementCrue?.level === 'fort' || submersionMarine?.level === 'fort') {
    return 'high';
  }

  if (ruissellementCrue?.level === 'moyen' || submersionMarine?.level === 'moyen') {
    return 'moderate';
  }

  if (ruissellementCrue?.level === 'faible' || submersionMarine?.level === 'faible') {
    return 'low';
  }

  return 'none';
}

/**
 * Parse seismic zone (0-5)
 */
function parseSeismicZone(data: any): 0 | 1 | 2 | 3 | 4 | 5 {
  if (!data) return 0;

  const zoneNumber = parseInt(data.zone || '0', 10);
  return Math.min(zoneNumber, 5) as 0 | 1 | 2 | 3 | 4 | 5;
}

/**
 * Parse slope/landslide risk
 */
function parseSlopeRisk(data: any): 'none' | 'low' | 'moderate' | 'high' {
  if (!data) return 'none';

  if (data.alea_fort) return 'high';
  if (data.alea_moyen) return 'moderate';
  if (data.alea_faible) return 'low';

  return 'none';
}

/**
 * Parse subsidence/ground collapse risk
 */
function parseSubsidenceRisk(data: any): 'none' | 'low' | 'moderate' | 'high' {
  if (!data?.cavites) return 'none';

  if (data.cavites.length > 5) return 'high';
  if (data.cavites.length > 2) return 'moderate';
  if (data.cavites.length > 0) return 'low';

  return 'none';
}

/**
 * Parse radon risk
 */
function parseRadonRisk(data: any): 'low' | 'moderate' | 'high' {
  if (!data?.radon) return 'low';

  if (data.radon.level === 'élevé') return 'high';
  if (data.radon.level === 'moyen') return 'moderate';

  return 'low';
}

/**
 * Parse historical flood events
 */
function parseHistoricalFloods(data: any): number {
  if (!data?.historical_events) return 0;

  return (data.historical_events as any[]).filter((e) => e.type === 'flood').length;
}

/**
 * Assess geographic risk at location
 */
export async function assessGeoRisk(
  latitude: number,
  longitude: number
): Promise<GeoRiskResult> {
  try {
    log(`[GeoRisk] Assessing risk at ${latitude}, ${longitude}`);

    // Validate coordinates
    if (latitude < 41 || latitude > 51 || longitude < -6 || longitude > 8) {
      return {
        valid: false,
        errors: ['Location outside France'],
        cached: false,
      };
    }

    const assessment = await queryGeoriquesAPI(latitude, longitude);

    if (!assessment) {
      warn('[GeoRisk] No assessment available');
      return {
        valid: false,
        errors: ['GeoRisk assessment not available'],
        cached: false,
      };
    }

    return {
      valid: true,
      assessment,
      cached: false,
    };
  } catch (error) {
    console.error('[GeoRisk] Assessment failed:', error);
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      cached: false,
    };
  }
}

/**
 * Batch assess multiple locations
 */
export async function batchAssessGeoRisk(
  locations: Array<{ latitude: number; longitude: number }>
): Promise<Map<string, GeoRiskResult>> {
  const results = new Map<string, GeoRiskResult>();

  for (const location of locations) {
    const key = `${location.latitude},${location.longitude}`;
    const result = await assessGeoRisk(location.latitude, location.longitude);
    results.set(key, result);
  }

  return results;
}

/**
 * Calculate overall risk score (0-100)
 */
export function calculateOverallRiskScore(assessment: GeoRiskAssessment): number {
  let score = 0;

  // Flood risk (30 points)
  const floodScores = { none: 0, low: 10, moderate: 20, high: 30 };
  score += floodScores[assessment.floodRisk];

  // Seismic risk (25 points)
  score += (assessment.seismicZone / 5) * 25;

  // Slope risk (20 points)
  const slopeScores = { none: 0, low: 7, moderate: 14, high: 20 };
  score += slopeScores[assessment.slopeRisk];

  // Subsidence risk (15 points)
  const subsidenceScores = { none: 0, low: 5, moderate: 10, high: 15 };
  score += subsidenceScores[assessment.subsidenceRisk];

  // Radon risk (10 points)
  const radonScores = { low: 0, moderate: 5, high: 10 };
  score += radonScores[assessment.radonRisk];

  // Heritage protection (5 points penalty)
  if (assessment.heritageProtected) {
    score += 5;
  }

  return Math.min(score, 100);
}

/**
 * Get risk level badge
 */
export function getRiskLevelBadge(score: number): {
  color: 'green' | 'yellow' | 'red';
  text: string;
} {
  if (score < 20) {
    return { color: 'green', text: '🟢 Low Risk' };
  }

  if (score < 50) {
    return { color: 'yellow', text: '🟡 Moderate Risk' };
  }

  return { color: 'red', text: '🔴 High Risk' };
}

/**
 * Get individual risk badges
 */
export function getRiskBadges(assessment: GeoRiskAssessment): Record<string, string> {
  return {
    flood: `🌊 Flood: ${assessment.floodRisk}`,
    seismic: `📍 Seismic Zone: ${assessment.seismicZone}`,
    slope: `⛰️ Slope: ${assessment.slopeRisk}`,
    subsidence: `🕳️ Subsidence: ${assessment.subsidenceRisk}`,
    radon: `☢️ Radon: ${assessment.radonRisk}`,
    heritage: assessment.heritageProtected ? `🏛️ Heritage Site` : '',
  };
}

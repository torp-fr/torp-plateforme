/**
 * Live Doctrine Activation Engine (Phase 30)
 * Orchestrates knowledge, real data, and APIs to enrich ExecutionContext
 * Creates liveIntelligence with enterprise verification, RGE status, geo context
 */

import type { EngineExecutionContext } from '@/core/platform/engineOrchestrator';
import { verifySIRET, type INSEEEnterprise } from '@/core/integrations/insee.integration';
import { verifyRGE, type RGECertification } from '@/core/integrations/rge.integration';
import { validateAddress, type ValidatedAddress } from '@/core/integrations/ban.integration';
import { getParcelInfo, type ParcelInfo } from '@/core/integrations/cadastre.integration';
import { assessGeoRisk, type GeoRiskAssessment } from '@/core/integrations/geoRisk.integration';

export interface EnterpriseVerification {
  siret: string;
  verified: boolean;
  enterprise?: INSEEEnterprise;
  status: 'valid' | 'invalid' | 'unknown' | 'error';
  riskFlags: string[];
}

export interface RGEStatus {
  certified: boolean;
  certification?: RGECertification;
  domains: string[];
  expiresIn?: number; // days
}

export interface GeoContext {
  addressValidated: boolean;
  address?: ValidatedAddress;
  parcelInfo?: ParcelInfo;
  geoRisk?: GeoRiskAssessment;
  coordinates?: { latitude: number; longitude: number };
}

export interface LiveIntelligence {
  enterpriseVerification: EnterpriseVerification;
  rgeStatus: RGEStatus;
  geoContext: GeoContext;
  doctrineMatches: string[];
  legalRiskScore: number; // 0-100
  doctrineConfidenceScore: number; // 0-100
  intelligenceTimestamp: string;
  enrichmentStatus: 'complete' | 'partial' | 'degraded';
}

/**
 * Verify enterprise information
 */
async function verifyEnterprise(siret: string): Promise<EnterpriseVerification> {
  try {
    console.log(`[LiveDoctrineActivation] Verifying enterprise: ${siret}`);

    const result = await verifySIRET(siret);

    if (!result.valid) {
      return {
        siret,
        verified: false,
        status: 'invalid',
        riskFlags: result.errors || ['Invalid SIRET'],
      };
    }

    const enterprise = result.enterprise;
    const riskFlags: string[] = [];

    // Check for risk indicators
    if (enterprise?.status !== 'active') {
      riskFlags.push(`Enterprise is ${enterprise?.status || 'unknown'}`);
    }

    if (enterprise?.verificationScore && enterprise.verificationScore < 60) {
      riskFlags.push('Low verification score');
    }

    // Check sector (construction-related)
    if (enterprise?.sectorLabel) {
      if (!/construction|batiment|travaux|renovation/i.test(enterprise.sectorLabel)) {
        riskFlags.push('Not classified as construction company');
      }
    }

    return {
      siret,
      verified: result.valid,
      enterprise,
      status: result.valid ? 'valid' : 'invalid',
      riskFlags,
    };
  } catch (error) {
    console.error('[LiveDoctrineActivation] Enterprise verification failed:', error);
    return {
      siret,
      verified: false,
      status: 'error',
      riskFlags: ['Verification service error'],
    };
  }
}

/**
 * Check RGE certification
 */
async function checkRGECertification(siret: string): Promise<RGEStatus> {
  try {
    console.log(`[LiveDoctrineActivation] Checking RGE: ${siret}`);

    const result = await verifyRGE(siret);

    if (!result.valid || !result.certification) {
      return {
        certified: false,
        domains: [],
      };
    }

    // Calculate days until expiration
    const expiresAt = new Date(result.certification.validUntil);
    const today = new Date();
    const expiresIn = Math.floor((expiresAt.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    return {
      certified: result.certification.isActive,
      certification: result.certification,
      domains: result.certification.domains,
      expiresIn: expiresIn > 0 ? expiresIn : undefined,
    };
  } catch (error) {
    console.error('[LiveDoctrineActivation] RGE check failed:', error);
    return {
      certified: false,
      domains: [],
    };
  }
}

/**
 * Validate and enrich location
 */
async function enrichGeoContext(
  addressStr?: string,
  latitude?: number,
  longitude?: number
): Promise<GeoContext> {
  const context: GeoContext = {
    addressValidated: false,
  };

  try {
    // Validate address if provided
    if (addressStr) {
      console.log(`[LiveDoctrineActivation] Validating address: ${addressStr}`);
      const addressResult = await validateAddress(addressStr);

      if (addressResult.valid && addressResult.address) {
        context.addressValidated = true;
        context.address = addressResult.address;
        latitude = addressResult.address.latitude;
        longitude = addressResult.address.longitude;
      }
    }

    // Get parcel and geo risk if coordinates available
    if (latitude !== undefined && longitude !== undefined) {
      console.log(`[LiveDoctrineActivation] Getting parcel info: ${latitude}, ${longitude}`);

      const parcelResult = await getParcelInfo(latitude, longitude);
      if (parcelResult.valid && parcelResult.parcel) {
        context.parcelInfo = parcelResult.parcel;
      }

      // Assess geo risks
      const riskResult = await assessGeoRisk(latitude, longitude);
      if (riskResult.valid && riskResult.assessment) {
        context.geoContext = riskResult.assessment;
      }

      context.coordinates = { latitude, longitude };
    }

    return context;
  } catch (error) {
    console.error('[LiveDoctrineActivation] Geo context enrichment failed:', error);
    return context;
  }
}

/**
 * Main Live Doctrine Activation Engine
 * Enriches ExecutionContext with live intelligence (non-destructive)
 */
export async function runLiveDoctrineActivationEngine(
  executionContext: EngineExecutionContext
): Promise<LiveIntelligence> {
  try {
    console.log('[LiveDoctrineActivation] Starting engine');

    const startTime = performance.now();

    // Extract data from context
    const enterpriseSIRET = (executionContext as any).enterprise?.siret;
    const projectAddress = (executionContext as any).project?.address;
    const projectCoordinates = (executionContext as any).project?.coordinates;

    const intelligence: LiveIntelligence = {
      enterpriseVerification: { siret: enterpriseSIRET || '', verified: false, status: 'unknown', riskFlags: [] },
      rgeStatus: { certified: false, domains: [] },
      geoContext: { addressValidated: false },
      doctrineMatches: [],
      legalRiskScore: 0,
      doctrineConfidenceScore: 0,
      intelligenceTimestamp: new Date().toISOString(),
      enrichmentStatus: 'degraded',
    };

    // Step 1: Enterprise verification (required)
    if (enterpriseSIRET) {
      intelligence.enterpriseVerification = await verifyEnterprise(enterpriseSIRET);
    }

    // Step 2: RGE certification check (if enterprise verified)
    if (intelligence.enterpriseVerification.verified && enterpriseSIRET) {
      intelligence.rgeStatus = await checkRGECertification(enterpriseSIRET);
    }

    // Step 3: Geo context enrichment
    if (projectAddress || projectCoordinates) {
      intelligence.geoContext = await enrichGeoContext(
        projectAddress,
        projectCoordinates?.latitude,
        projectCoordinates?.longitude
      );
    }

    // Step 4: Calculate legal risk score
    intelligence.legalRiskScore = calculateLegalRiskScore(intelligence);

    // Step 5: Match doctrine (simplified)
    intelligence.doctrineMatches = matchDoctrineInsights(intelligence);

    // Step 6: Calculate doctrine confidence
    intelligence.doctrineConfidenceScore = calculateDoctrineConfidence(intelligence);

    // Step 7: Determine enrichment status
    const hasAll = intelligence.enterpriseVerification.verified &&
      intelligence.rgeStatus.certified &&
      intelligence.geoContext.addressValidated;
    const hasPartial = intelligence.enterpriseVerification.verified ||
      intelligence.geoContext.addressValidated;

    intelligence.enrichmentStatus = hasAll ? 'complete' : hasPartial ? 'partial' : 'degraded';

    const duration = performance.now() - startTime;
    console.log(
      `[LiveDoctrineActivation] Engine complete (${duration.toFixed(0)}ms): ${intelligence.enrichmentStatus}`
    );

    // Attach to context (non-destructive)
    (executionContext as any).liveIntelligence = intelligence;

    return intelligence;
  } catch (error) {
    console.error('[LiveDoctrineActivation] Engine failed:', error);

    return {
      enterpriseVerification: { siret: '', verified: false, status: 'error', riskFlags: ['Engine error'] },
      rgeStatus: { certified: false, domains: [] },
      geoContext: { addressValidated: false },
      doctrineMatches: [],
      legalRiskScore: 0,
      doctrineConfidenceScore: 0,
      intelligenceTimestamp: new Date().toISOString(),
      enrichmentStatus: 'degraded',
    };
  }
}

/**
 * Calculate legal risk score based on verification
 */
function calculateLegalRiskScore(intelligence: LiveIntelligence): number {
  let score = 100; // Start high, reduce with verification

  // Enterprise verification (40 points)
  if (intelligence.enterpriseVerification.verified) {
    score -= 40;
  } else if (intelligence.enterpriseVerification.status !== 'error') {
    score -= 20;
  }

  // RGE certification (30 points)
  if (intelligence.rgeStatus.certified) {
    score -= 30;
  }

  // Address validation (20 points)
  if (intelligence.geoContext.addressValidated) {
    score -= 20;
  }

  // Geo risk assessment (10 points reduction if low risk)
  if (intelligence.geoContext.geoContext) {
    const riskScore = calculateGeoRiskScore(intelligence.geoContext.geoContext);
    if (riskScore < 30) {
      score -= 10;
    }
  }

  // Risk flags penalty
  const flagCount = intelligence.enterpriseVerification.riskFlags.length;
  score += flagCount * 5;

  return Math.max(0, Math.min(score, 100));
}

/**
 * Calculate geo risk score (helper)
 */
function calculateGeoRiskScore(assessment: GeoRiskAssessment): number {
  let score = 0;

  const floodScores = { none: 0, low: 10, moderate: 20, high: 30 };
  score += floodScores[assessment.floodRisk];

  score += (assessment.seismicZone / 5) * 25;

  const slopeScores = { none: 0, low: 7, moderate: 14, high: 20 };
  score += slopeScores[assessment.slopeRisk];

  const subsidenceScores = { none: 0, low: 5, moderate: 10, high: 15 };
  score += subsidenceScores[assessment.subsidenceRisk];

  const radonScores = { low: 0, moderate: 5, high: 10 };
  score += radonScores[assessment.radonRisk];

  if (assessment.heritageProtected) {
    score += 5;
  }

  return Math.min(score, 100);
}

/**
 * Match relevant doctrine insights
 */
function matchDoctrineInsights(intelligence: LiveIntelligence): string[] {
  const matches: string[] = [];

  if (!intelligence.enterpriseVerification.verified) {
    matches.push('DTU-Enterprise: Unverified contractor');
  }

  if (!intelligence.rgeStatus.certified) {
    matches.push('ADEME: RGE certification recommended');
  }

  if (intelligence.geoContext.geoContext) {
    const risk = intelligence.geoContext.geoContext;

    if (risk.floodRisk === 'high') {
      matches.push('NF-Flood: High flood risk - special precautions required');
    }

    if (risk.seismicZone >= 3) {
      matches.push('NF-Seismic: Seismic zone - structural compliance required');
    }

    if (risk.heritageProtected) {
      matches.push('Jurisprudence: Heritage protected site - restricted modifications');
    }
  }

  return matches;
}

/**
 * Calculate doctrine confidence score
 */
function calculateDoctrineConfidence(intelligence: LiveIntelligence): number {
  let confidence = 0;

  // Enterprise verification (40 points)
  if (intelligence.enterpriseVerification.verified) confidence += 40;
  else if (intelligence.enterpriseVerification.status !== 'error') confidence += 20;

  // RGE certification (30 points)
  if (intelligence.rgeStatus.certified) confidence += 30;

  // Address validation (20 points)
  if (intelligence.geoContext.addressValidated) confidence += 20;

  // Geo risk data (10 points)
  if (intelligence.geoContext.geoContext) confidence += 10;

  return Math.min(confidence, 100);
}

/**
 * Get engine metadata
 */
export function getLiveDoctrineActivationMetadata() {
  return {
    id: 'live-doctrine-activation',
    name: 'Live Doctrine Activation Engine',
    version: '1.0',
    phase: 30,
    status: 'active',
    category: 'enrichment',
    readOnly: true,
    noModification: true,
    knowledgeEnrichment: true,
    liveDataIntegration: true,
    dependencies: ['insee', 'rge', 'ban', 'cadastre', 'georisques'],
    executionOrder: 'optional-after-fraud-detection',
    description: 'Enriches ExecutionContext with live enterprise verification, RGE status, and geographic intelligence',
  };
}

export default {
  runLiveDoctrineActivationEngine,
  getLiveDoctrineActivationMetadata,
};

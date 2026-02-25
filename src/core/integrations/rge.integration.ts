/**
 * RGE Integration (Phase 30)
 * Verifies RGE (Reconnu Garant de l'Environnement) certification
 * API: rge.ademe.gouv.fr
 */

export type RGEDomain =
  | 'isolation'
  | 'chauffage'
  | 'eau-chaude-sanitaire'
  | 'enr'
  | 'renovation-globale'
  | 'ventilation'
  | 'audit-energetique';

export interface RGECertification {
  siret: string;
  name: string;
  domains: RGEDomain[];
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  certificationNumber: string;
  verificationScore: number; // 0-100
}

export interface RGEVerificationResult {
  valid: boolean;
  certification?: RGECertification;
  errors?: string[];
  cached: boolean;
  cachedAt?: string;
}

/**
 * Query ADEME RGE database
 * Note: Requires ADEME API credentials
 */
async function queryRGEDatabase(siret: string): Promise<RGECertification | null> {
  try {
    const apiKey = process.env.ADEME_RGE_API_KEY;

    if (!apiKey) {
      console.warn('[RGE] API key not configured');
      return null;
    }

    // ADEME RGE API endpoint (example)
    const endpoint = 'https://data.ademe.gouv.fr/rge/search';

    const response = await fetch(`${endpoint}?siret=${siret}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[RGE] API error: ${response.statusText}`);
      return null;
    }

    const data: any = await response.json();

    if (!data || !data.establishments || data.establishments.length === 0) {
      return null;
    }

    const establishment = data.establishments[0];

    const domains = parseDomains(establishment);
    const isActive = checkCertificationActive(establishment);

    const certification: RGECertification = {
      siret: establishment.siret,
      name: establishment.denomination || 'Unknown',
      domains,
      validFrom: establishment.dateValidation || '',
      validUntil: establishment.dateExpiration || '',
      isActive,
      certificationNumber: establishment.numeroLicence || '',
      verificationScore: 98, // High score for API-verified RGE
    };

    return certification;
  } catch (error) {
    console.error('[RGE] Database query failed:', error);
    return null;
  }
}

/**
 * Parse RGE domains from API response
 */
function parseDomains(establishment: any): RGEDomain[] {
  const domains: RGEDomain[] = [];

  const domainMap: { [key: string]: RGEDomain } = {
    'ISO': 'isolation',
    'CHA': 'chauffage',
    'ECS': 'eau-chaude-sanitaire',
    'ENR': 'enr',
    'RG': 'renovation-globale',
    'VEN': 'ventilation',
    'AUD': 'audit-energetique',
  };

  const qualifications = establishment.qualifications || [];

  qualifications.forEach((q: string) => {
    const domain = domainMap[q];
    if (domain && !domains.includes(domain)) {
      domains.push(domain);
    }
  });

  return domains;
}

/**
 * Check if RGE certification is currently active
 */
function checkCertificationActive(establishment: any): boolean {
  const now = new Date();
  const dateExp = new Date(establishment.dateExpiration || '1970-01-01');

  return dateExp > now;
}

/**
 * Verify RGE certification
 */
export async function verifyRGE(siret: string): Promise<RGEVerificationResult> {
  try {
    console.log(`[RGE] Verifying certification for: ${siret}`);

    // Validate SIRET format
    if (!/^\d{14}$/.test(siret.replace(/\s+/g, ''))) {
      return {
        valid: false,
        errors: ['Invalid SIRET format'],
        cached: false,
      };
    }

    // Query RGE database
    const certification = await queryRGEDatabase(siret);

    if (!certification) {
      console.log(`[RGE] No certification found for SIRET: ${siret}`);
      return {
        valid: false,
        errors: ['No RGE certification found'],
        cached: false,
      };
    }

    if (!certification.isActive) {
      return {
        valid: false,
        certification,
        errors: ['RGE certification has expired'],
        cached: false,
      };
    }

    return {
      valid: true,
      certification,
      cached: false,
    };
  } catch (error) {
    console.error('[RGE] Verification failed:', error);
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      cached: false,
    };
  }
}

/**
 * Get RGE certification status
 */
export async function getRGEStatus(siret: string): Promise<{
  certified: boolean;
  domains: RGEDomain[];
  validUntil?: string;
}> {
  try {
    const result = await verifyRGE(siret);

    if (!result.valid || !result.certification) {
      return {
        certified: false,
        domains: [],
      };
    }

    return {
      certified: result.certification.isActive,
      domains: result.certification.domains,
      validUntil: result.certification.validUntil,
    };
  } catch (error) {
    console.error('[RGE] Status check failed:', error);
    return {
      certified: false,
      domains: [],
    };
  }
}

/**
 * Check if RGE certified for specific domain
 */
export async function isRGECertifiedFor(
  siret: string,
  domain: RGEDomain
): Promise<boolean> {
  const status = await getRGEStatus(siret);
  return status.certified && status.domains.includes(domain);
}

/**
 * Get multiple domain certifications
 */
export async function getRGECertifications(
  sirets: string[]
): Promise<Map<string, RGEVerificationResult>> {
  const results = new Map<string, RGEVerificationResult>();

  for (const siret of sirets) {
    const result = await verifyRGE(siret);
    results.set(siret, result);
  }

  return results;
}

/**
 * Get RGE certification badge
 */
export function getRGEBadge(result: RGEVerificationResult): {
  color: 'green' | 'yellow' | 'red';
  text: string;
} {
  if (!result.valid || !result.certification) {
    return { color: 'red', text: '🔴 Not RGE Certified' };
  }

  if (!result.certification.isActive) {
    return { color: 'yellow', text: '🟡 RGE Expired' };
  }

  return {
    color: 'green',
    text: `🟢 RGE Certified (${result.certification.domains.length} domains)`,
  };
}

/**
 * Domain label for UI
 */
export function getDomainLabel(domain: RGEDomain): string {
  const labels: { [key in RGEDomain]: string } = {
    isolation: 'Isolation thermique',
    chauffage: 'Chauffage',
    'eau-chaude-sanitaire': 'Eau chaude sanitaire',
    enr: 'Énergies renouvelables',
    'renovation-globale': 'Rénovation globale',
    ventilation: 'Ventilation',
    'audit-energetique': 'Audit énergétique',
  };

  return labels[domain];
}

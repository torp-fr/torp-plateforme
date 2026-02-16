/**
 * INSEE Integration (Phase 30)
 * Verifies SIRET validity and retrieves enterprise information
 * API: sirene.insee.fr
 */

export interface INSEEEnterprise {
  siret: string;
  siren: string;
  name: string;
  status: 'active' | 'inactive' | 'closed' | 'unknown';
  creationDate: string;
  sector: string; // NAF code
  sectorLabel: string;
  address: string;
  city: string;
  zipCode: string;
  verificationScore: number; // 0-100
}

export interface INSEEVerificationResult {
  valid: boolean;
  enterprise?: INSEEEnterprise;
  errors?: string[];
  cached: boolean;
  cachedAt?: string;
}

/**
 * Validate SIRET format
 * SIRET = 14 digits: SIREN (9) + establishment number (5)
 */
function validateSIRETFormat(siret: string): boolean {
  const cleaned = siret.replace(/\s+/g, '');
  return /^\d{14}$/.test(cleaned);
}

/**
 * Calculate Luhn checksum for SIRET validation
 */
function validateSIRETChecksum(siret: string): boolean {
  const cleaned = siret.replace(/\s+/g, '');
  if (cleaned.length !== 14) return false;

  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let digit = parseInt(cleaned[i], 10);

    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
  }

  return sum % 10 === 0;
}

/**
 * Query INSEE SIRENE API
 * Note: Requires INSEE API key in environment variables
 */
async function querySIRENEAPI(siret: string): Promise<INSEEEnterprise | null> {
  try {
    const apiKey = process.env.INSEE_API_KEY;

    if (!apiKey) {
      console.warn('[INSEE] API key not configured - using offline validation only');
      return null;
    }

    const endpoint = 'https://api.insee.fr/api/sirene/V3/etablissements';
    const response = await fetch(`${endpoint}/${siret}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`[INSEE] SIRET not found: ${siret}`);
        return null;
      }
      console.error(`[INSEE] API error: ${response.statusText}`);
      return null;
    }

    const data: any = await response.json();
    const etablissement = data.etablissement;

    if (!etablissement) {
      return null;
    }

    const enterprise: INSEEEnterprise = {
      siret: etablissement.siret,
      siren: etablissement.siren,
      name: etablissement.uniteLegaleVenueNumber?.unitePurgeeDate
        ? '[INACTIVE]'
        : etablissement.denominations?.[0] || 'Unknown',
      status: determineStatus(etablissement),
      creationDate: etablissement.dateCreation,
      sector: etablissement.codeNaf || '',
      sectorLabel: getNAFLabel(etablissement.codeNaf),
      address: formatAddress(etablissement),
      city: etablissement.commune || '',
      zipCode: etablissement.codePostal || '',
      verificationScore: 95, // High score for API-verified data
    };

    return enterprise;
  } catch (error) {
    console.error('[INSEE] API query failed:', error);
    return null;
  }
}

/**
 * Determine enterprise status from INSEE data
 */
function determineStatus(
  etablissement: any
): 'active' | 'inactive' | 'closed' | 'unknown' {
  if (etablissement.unitePurgeeDate) {
    return 'closed';
  }

  if (etablissement.etatAdministratifEtablissement === 'A') {
    return 'active';
  }

  if (etablissement.etatAdministratifEtablissement === 'F') {
    return 'inactive';
  }

  return 'unknown';
}

/**
 * Get NAF sector label from code
 * NAF = Nomenclature d'Activités Française
 */
function getNAFLabel(nafCode: string): string {
  const nafLabels: { [key: string]: string } = {
    '4120Z': 'Construction de maisons individuelles',
    '4120A': 'Construction de bâtiments résidentiels',
    '4120B': 'Construction d\'autres bâtiments',
    '4211Z': 'Construction de routes et autoroutes',
    '4212Z': 'Construction de voies ferrées',
    '4213A': 'Construction de tunnels',
    '4213B': 'Construction de ponts et passages souterrains',
    '4220Z': 'Construction de réseaux pour fluides',
    '4290Z': 'Autres travaux spécialisés de construction',
    '4311Z': 'Démolition',
    '4312Z': 'Préparation de sites',
    '4313Z': 'Travaux de dépollution et autres services',
    '4321A': 'Travaux d\'installation électrique',
    '4321B': 'Travaux d\'installation de gaz',
    '4322Z': 'Travaux d\'installation de chauffage et sanitaire',
    '4323Z': 'Travaux d\'installation d\'autres équipements',
    '4329Z': 'Travaux d\'installation spécialisés',
    '4330Z': 'Travaux de finition',
    '4399Z': 'Autres travaux spécialisés',
  };

  return nafLabels[nafCode] || `Construction (${nafCode})`;
}

/**
 * Format address from INSEE data
 */
function formatAddress(etablissement: any): string {
  const parts = [
    etablissement.numeroVoieEtablissement,
    etablissement.typeVoieEtablissement,
    etablissement.libelleVoieEtablissement,
  ].filter((p) => p);

  return parts.join(' ');
}

/**
 * Verify SIRET with fallback to offline validation
 */
export async function verifySIRET(siret: string): Promise<INSEEVerificationResult> {
  try {
    console.log(`[INSEE] Verifying SIRET: ${siret}`);

    // Step 1: Format validation
    if (!validateSIRETFormat(siret)) {
      return {
        valid: false,
        errors: ['Invalid SIRET format (must be 14 digits)'],
        cached: false,
      };
    }

    // Step 2: Checksum validation
    if (!validateSIRETChecksum(siret)) {
      return {
        valid: false,
        errors: ['Invalid SIRET checksum'],
        cached: false,
      };
    }

    // Step 3: Try API query
    const enterprise = await querySIRENEAPI(siret);

    if (enterprise) {
      return {
        valid: true,
        enterprise,
        cached: false,
      };
    }

    // Step 4: If API fails, accept based on format/checksum
    console.warn(`[INSEE] API unavailable, accepting ${siret} based on format validation`);

    return {
      valid: true,
      enterprise: {
        siret: siret.replace(/\s+/g, ''),
        siren: siret.substring(0, 9),
        name: 'Enterprise (offline verification)',
        status: 'unknown',
        creationDate: '',
        sector: '',
        sectorLabel: 'Unknown sector',
        address: '',
        city: '',
        zipCode: '',
        verificationScore: 50, // Lower score for offline-only verification
      },
      cached: false,
    };
  } catch (error) {
    console.error('[INSEE] Verification failed:', error);
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      cached: false,
    };
  }
}

/**
 * Get enterprise info by SIREN (simpler, without establishment)
 */
export async function getEnterpriseBySIREN(siren: string): Promise<INSEEEnterprise | null> {
  try {
    if (!/^\d{9}$/.test(siren.replace(/\s+/g, ''))) {
      return null;
    }

    // In production, would query INSEE SIRENE API for SIREN
    // For now, return placeholder
    console.log(`[INSEE] Looking up SIREN: ${siren}`);

    return null;
  } catch (error) {
    console.error('[INSEE] SIREN lookup failed:', error);
    return null;
  }
}

/**
 * Batch verify multiple SIRETs
 */
export async function batchVerifySIRET(
  sirets: string[]
): Promise<Map<string, INSEEVerificationResult>> {
  const results = new Map<string, INSEEVerificationResult>();

  for (const siret of sirets) {
    const result = await verifySIRET(siret);
    results.set(siret, result);
  }

  return results;
}

/**
 * Get verification badge for UI display
 */
export function getVerificationBadge(result: INSEEVerificationResult): {
  color: 'green' | 'yellow' | 'red';
  text: string;
} {
  if (!result.valid) {
    return { color: 'red', text: '🔴 Invalid SIRET' };
  }

  if ((result.enterprise?.verificationScore || 0) >= 90) {
    return { color: 'green', text: '🟢 Verified Enterprise' };
  }

  if ((result.enterprise?.verificationScore || 0) >= 50) {
    return { color: 'yellow', text: '🟡 Partial Verification' };
  }

  return { color: 'red', text: '🔴 High Risk Enterprise' };
}

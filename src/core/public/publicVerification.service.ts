/**
 * Public Verification Service v1.0
 * B2C-ready certification verification layer
 * Public token-based access to certification data
 * Pure additive implementation - no modifications to existing engines
 */

import { EngineExecutionContext } from '@/core/platform/engineExecutionContext';
import { CertificationRecord, verifyCertification } from '@/core/platform/certification.manager';
import { runNarrativeEngine } from '@/core/platform/narrative.engine';

/**
 * Public badge for UI display
 */
export interface PublicBadge {
  label: string;
  level: 'excellent' | 'good' | 'adequate' | 'warning' | 'critical';
  color: string;
  description: string;
}

/**
 * Public certification view model for B2C display
 */
export interface PublicCertificationViewModel {
  grade: 'A' | 'B' | 'C' | 'D' | 'E';
  score: number;
  badge: PublicBadge;
  enterprise: {
    name: string;
    siret: string;
    address?: string;
  };
  strengths: string[];
  vigilancePoints: string[];
  summaryText: string;
  issuedAt: string;
  expiresAt: string;
  validityStatus: 'active' | 'expired';
}

/**
 * Public verification result
 */
export interface PublicVerificationResult {
  valid: boolean;
  viewModel?: PublicCertificationViewModel;
  message?: string;
  verifiedAt?: string;
}

/**
 * Grade to badge mapping
 */
const gradeBadgeMap: Record<'A' | 'B' | 'C' | 'D' | 'E', PublicBadge> = {
  A: {
    label: 'Excellent',
    level: 'excellent',
    color: '#10b981',
    description: 'Exceptional compliance standard with minimal identified risks',
  },
  B: {
    label: 'Good',
    level: 'good',
    color: '#3b82f6',
    description: 'Strong compliance foundation with effective risk controls',
  },
  C: {
    label: 'Adequate',
    level: 'adequate',
    color: '#f59e0b',
    description: 'Foundational compliance framework in place',
  },
  D: {
    label: 'Warning',
    level: 'warning',
    color: '#ef4444',
    description: 'Concerning compliance level requiring remediation',
  },
  E: {
    label: 'Critical',
    level: 'critical',
    color: '#991b1b',
    description: 'Critical non-compliance requiring immediate intervention',
  },
};

/**
 * Get badge for grade
 */
function getBadgeForGrade(grade: 'A' | 'B' | 'C' | 'D' | 'E'): PublicBadge {
  return gradeBadgeMap[grade] || gradeBadgeMap['E'];
}

/**
 * Check if certification is expired
 */
function isCertificationExpired(expiresAt: string): boolean {
  const expirationDate = new Date(expiresAt);
  const now = new Date();
  return now > expirationDate;
}

/**
 * Verify and build public view model
 * Main entry point for public certification verification
 */
export function verifyAndBuildPublicView(
  publicToken: string,
  enterpriseProfile: {
    name: string;
    siret: string;
    address?: string;
  },
  executionContext: EngineExecutionContext
): PublicVerificationResult {
  const verifiedAt = new Date().toISOString();

  try {
    // Validate inputs
    if (!publicToken) {
      console.warn('[PublicVerificationService] Missing public token');
      return {
        valid: false,
        message: 'Invalid or missing verification token',
        verifiedAt,
      };
    }

    if (!enterpriseProfile || !enterpriseProfile.name || !enterpriseProfile.siret) {
      console.warn('[PublicVerificationService] Invalid enterprise profile');
      return {
        valid: false,
        message: 'Invalid enterprise profile provided',
        verifiedAt,
      };
    }

    // Step 1: Verify certification by token
    console.log('[PublicVerificationService] Verifying certification token', {
      token: publicToken.substring(0, 20) + '...',
      enterprise: enterpriseProfile.name,
    });

    const verificationResult = verifyCertification(publicToken);

    // Step 2: Check verification result
    if (!verificationResult.valid) {
      console.warn('[PublicVerificationService] Verification failed', {
        reason: verificationResult.message,
        enterprise: enterpriseProfile.name,
      });

      return {
        valid: false,
        message: verificationResult.message || 'Certification verification failed',
        verifiedAt,
      };
    }

    const certification = verificationResult.certification;

    if (!certification) {
      console.warn('[PublicVerificationService] Certification not found after verification');
      return {
        valid: false,
        message: 'Certification data could not be retrieved',
        verifiedAt,
      };
    }

    // Step 3: Check expiration
    const isExpired = isCertificationExpired(certification.expiresAt);
    const validityStatus = isExpired ? 'expired' : 'active';

    if (isExpired) {
      console.log('[PublicVerificationService] Certification expired', {
        certificationId: certification.id,
        expiresAt: certification.expiresAt,
      });

      return {
        valid: false,
        message: 'This certification has expired',
        verifiedAt,
      };
    }

    // Step 4: Generate narrative for the certification
    console.log('[PublicVerificationService] Generating narrative');

    let narrative = null;

    try {
      const narrativeResult = runNarrativeEngine(executionContext, certification);
      narrative = narrativeResult.narrative;
    } catch (narrativeError) {
      console.warn('[PublicVerificationService] Narrative generation failed', narrativeError);

      // Fallback narrative
      narrative = {
        strengths: ['Certification issued and verified'],
        vigilancePoints: ['Professional assessment recommended for details'],
        summaryText: `This project holds a valid ${certification.grade}-grade certification as of ${new Date(certification.issuedAt).toLocaleDateString()}.`,
        transparencyLevel: 'moderate' as const,
      };
    }

    // Step 5: Build badge from grade
    const badge = getBadgeForGrade(certification.grade);

    // Step 6: Build public view model
    const viewModel: PublicCertificationViewModel = {
      grade: certification.grade,
      score: certification.finalScore,
      badge,
      enterprise: {
        name: enterpriseProfile.name,
        siret: enterpriseProfile.siret,
        address: enterpriseProfile.address,
      },
      strengths: narrative.strengths,
      vigilancePoints: narrative.vigilancePoints,
      summaryText: narrative.summaryText,
      issuedAt: certification.issuedAt,
      expiresAt: certification.expiresAt,
      validityStatus,
    };

    console.log('[PublicVerificationService] Public view model built successfully', {
      certificationId: certification.id,
      grade: certification.grade,
      enterprise: enterpriseProfile.name,
    });

    return {
      valid: true,
      viewModel,
      verifiedAt,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PublicVerificationService] Unexpected error during verification', error);

    return {
      valid: false,
      message: `Verification service error: ${errorMessage}`,
      verifiedAt,
    };
  }
}

/**
 * Simple token verification without view model
 * Lightweight check for token validity
 */
export function verifyTokenOnly(publicToken: string): {
  valid: boolean;
  grade?: 'A' | 'B' | 'C' | 'D' | 'E';
  score?: number;
  expiresAt?: string;
  message?: string;
} {
  try {
    if (!publicToken) {
      return {
        valid: false,
        message: 'Token is required',
      };
    }

    const result = verifyCertification(publicToken);

    if (!result.valid) {
      return {
        valid: false,
        message: result.message || 'Token verification failed',
      };
    }

    const certification = result.certification;

    if (!certification) {
      return {
        valid: false,
        message: 'Certification not found',
      };
    }

    const isExpired = isCertificationExpired(certification.expiresAt);

    return {
      valid: !isExpired,
      grade: certification.grade,
      score: certification.finalScore,
      expiresAt: certification.expiresAt,
      message: isExpired ? 'Certification has expired' : 'Certification is valid',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      valid: false,
      message: `Error during token verification: ${errorMessage}`,
    };
  }
}

/**
 * Format public view model as readable HTML/text
 * For display purposes
 */
export function formatPublicViewModel(viewModel: PublicCertificationViewModel): {
  htmlSummary: string;
  textSummary: string;
  badgeHtml: string;
} {
  // HTML Summary
  const htmlSummary = `
<div class="certification-view">
  <header class="certification-header">
    <h1>${viewModel.enterprise.name}</h1>
    <p class="siret">SIRET: ${viewModel.siret}</p>
  </header>

  <section class="badge-section">
    <div class="badge badge-${viewModel.badge.level}" style="background-color: ${viewModel.badge.color}">
      <span class="badge-label">${viewModel.badge.label}</span>
      <span class="badge-score">${viewModel.score.toFixed(1)}/100</span>
    </div>
  </section>

  <section class="summary-section">
    <p>${viewModel.summaryText}</p>
  </section>

  <section class="strengths-section">
    <h2>Strengths</h2>
    <ul>
      ${viewModel.strengths.map((s) => `<li>${s}</li>`).join('\n      ')}
    </ul>
  </section>

  <section class="vigilance-section">
    <h2>Areas Requiring Attention</h2>
    <ul>
      ${viewModel.vigilancePoints.map((v) => `<li>${v}</li>`).join('\n      ')}
    </ul>
  </section>

  <footer class="certification-footer">
    <p>Issued: ${new Date(viewModel.issuedAt).toLocaleDateString()}</p>
    <p>Expires: ${new Date(viewModel.expiresAt).toLocaleDateString()}</p>
    <p>Status: <strong>${viewModel.validityStatus.toUpperCase()}</strong></p>
  </footer>
</div>
  `.trim();

  // Text Summary
  const textSummary = `
CERTIFICATION REPORT
====================

Enterprise: ${viewModel.enterprise.name}
SIRET: ${viewModel.siret}
Address: ${viewModel.enterprise.address || 'N/A'}

Grade: ${viewModel.badge.label} (${viewModel.grade})
Score: ${viewModel.score.toFixed(1)}/100
Status: ${viewModel.validityStatus.toUpperCase()}

Summary:
${viewModel.summaryText}

Strengths:
${viewModel.strengths.map((s) => `- ${s}`).join('\n')}

Areas Requiring Attention:
${viewModel.vigilancePoints.map((v) => `- ${v}`).join('\n')}

Issued: ${new Date(viewModel.issuedAt).toLocaleDateString()}
Expires: ${new Date(viewModel.expiresAt).toLocaleDateString()}
  `.trim();

  // Badge HTML
  const badgeHtml = `
<div class="public-badge badge-${viewModel.badge.level}" style="border-left: 4px solid ${viewModel.badge.color}">
  <strong>${viewModel.badge.label}</strong>
  <span>${viewModel.score.toFixed(1)}/100</span>
  <small>${viewModel.badge.description}</small>
</div>
  `.trim();

  return {
    htmlSummary,
    textSummary,
    badgeHtml,
  };
}

/**
 * Get public verification metadata
 */
export function getPublicVerificationMetadata() {
  return {
    id: 'publicVerificationService',
    name: 'Public Verification Service',
    version: '1.0',
    description: 'B2C-ready certification verification layer with public token access',
    type: 'verification-service',
    audience: 'public',
    capabilities: [
      'Token-based certification verification',
      'Public view model generation',
      'Enterprise profile mapping',
      'Badge generation from grades',
      'Narrative integration',
      'HTML/text formatting',
      'Validity status checking',
    ],
    supportedGrades: ['A', 'B', 'C', 'D', 'E'],
    supportedLevels: ['excellent', 'good', 'adequate', 'warning', 'critical'],
    gradeLevelMapping: {
      A: 'excellent',
      B: 'good',
      C: 'adequate',
      D: 'warning',
      E: 'critical',
    },
    features: {
      verification: {
        publicTokenBased: true,
        expirationCheck: true,
        enterpriseProfileIncluded: true,
      },
      narrative: {
        strengthsIncluded: true,
        vigilancePointsIncluded: true,
        summaryTextIncluded: true,
      },
      display: {
        badgeSupport: true,
        htmlFormatting: true,
        textFormatting: true,
      },
    },
    security: {
      noInternalDataExposed: true,
      publicTokenOnly: true,
      expirationEnforced: true,
      noDatabaseAccess: true,
    },
  };
}

/**
 * Validate public view model
 */
export function validatePublicViewModel(
  viewModel: PublicCertificationViewModel
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate grade
  if (!['A', 'B', 'C', 'D', 'E'].includes(viewModel.grade)) {
    errors.push('Invalid grade');
  }

  // Validate score
  if (typeof viewModel.score !== 'number' || viewModel.score < 0 || viewModel.score > 100) {
    errors.push('Invalid score (must be 0-100)');
  }

  // Validate badge
  if (!viewModel.badge || !viewModel.badge.label || !viewModel.badge.level) {
    errors.push('Invalid badge');
  }

  // Validate enterprise
  if (!viewModel.enterprise || !viewModel.enterprise.name || !viewModel.enterprise.siret) {
    errors.push('Invalid enterprise profile');
  }

  // Validate arrays
  if (!Array.isArray(viewModel.strengths) || viewModel.strengths.length === 0) {
    errors.push('Strengths array is empty or invalid');
  }

  if (!Array.isArray(viewModel.vigilancePoints) || viewModel.vigilancePoints.length === 0) {
    errors.push('Vigilance points array is empty or invalid');
  }

  // Validate dates
  if (!viewModel.issuedAt || isNaN(new Date(viewModel.issuedAt).getTime())) {
    errors.push('Invalid issued date');
  }

  if (!viewModel.expiresAt || isNaN(new Date(viewModel.expiresAt).getTime())) {
    errors.push('Invalid expiration date');
  }

  // Validate validity status
  if (!['active', 'expired'].includes(viewModel.validityStatus)) {
    errors.push('Invalid validity status');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get badge by level for styling
 */
export function getBadgeStyles(
  level: 'excellent' | 'good' | 'adequate' | 'warning' | 'critical'
): {
  color: string;
  backgroundColor: string;
  borderColor: string;
} {
  const styles = {
    excellent: {
      color: '#065f46',
      backgroundColor: '#d1fae5',
      borderColor: '#10b981',
    },
    good: {
      color: '#1e40af',
      backgroundColor: '#dbeafe',
      borderColor: '#3b82f6',
    },
    adequate: {
      color: '#92400e',
      backgroundColor: '#fef3c7',
      borderColor: '#f59e0b',
    },
    warning: {
      color: '#991b1b',
      backgroundColor: '#fee2e2',
      borderColor: '#ef4444',
    },
    critical: {
      color: '#7f1d1d',
      backgroundColor: '#fecaca',
      borderColor: '#991b1b',
    },
  };

  return styles[level] || styles.critical;
}

/**
 * Create a shareable public URL fragment
 * (for reference only - actual URL construction is client-side)
 */
export function buildPublicVerificationReference(publicToken: string, siret: string): {
  token: string;
  siret: string;
  verificationPath: string;
} {
  return {
    token: publicToken,
    siret: siret,
    verificationPath: `/verify/${siret}?token=${publicToken}`,
  };
}

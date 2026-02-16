/**
 * Certification Manager v1.0
 * Generate immutable official certifications attached to audit snapshots
 * In-memory management with no database persistence
 */

import { AuditSnapshot } from '@/core/platform/auditSnapshot.manager';

/**
 * Certification Record - Immutable official certification
 */
export interface CertificationRecord {
  id: string;                    // CERT-{timestamp}
  projectId: string;             // Associated project
  snapshotId: string;            // Certified snapshot ID
  snapshotVersion: number;       // Snapshot version number
  finalScore: number;            // Audit score at certification
  grade: 'A' | 'B' | 'C' | 'D' | 'E';  // Grade letter
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  devisHash: string;             // Devis/quote hash for integrity
  issuedAt: string;              // ISO 8601 issue timestamp
  expiresAt: string;             // ISO 8601 expiration timestamp
  status: 'active' | 'expired';  // Current status
  publicToken: string;           // Public verification token
  gradesMetadata?: {
    scoreThresholds: Record<string, number>;
    percentageScore?: number;
    weightedFactors?: Record<string, number>;
  };
  issuerSignature?: string;      // Immutable issuer identifier
}

/**
 * Certification History - Complete certification records for project
 */
export interface CertificationHistory {
  projectId: string;
  certifications: CertificationRecord[];
  totalCertifications: number;
  activeCertifications: number;
  expiredCertifications: number;
  averageGrade?: string;
  lastIssuedAt?: string;
}

/**
 * Certification Verification Result
 */
export interface CertificationVerificationResult {
  valid: boolean;
  certification?: CertificationRecord;
  reason?: string;
  verifiedAt: string;
  remainingDays?: number;
}

/**
 * Grade Statistics
 */
export interface GradeStatistics {
  projectId: string;
  totalCertifications: number;
  activeCertifications: number;
  gradeDistribution: Record<string, number>;
  averageScore: number;
  averageGrade: string;
  scoreRange: {
    min: number;
    max: number;
  };
}

/**
 * In-memory certification store
 * Structure: projectId -> CertificationRecord[]
 */
const certificationStore: Record<string, CertificationRecord[]> = {};

/**
 * Public token index for quick verification
 * Structure: publicToken -> {projectId, certId}
 */
const tokenIndex: Record<string, { projectId: string; certId: string }> = {};

/**
 * Map numeric score to letter grade
 * Score ranges:
 * - 90-100: A (Excellent)
 * - 75-89: B (Good)
 * - 60-74: C (Satisfactory)
 * - 40-59: D (Poor)
 * - 0-39: E (Critical)
 */
export function mapScoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'E' {
  if (typeof score !== 'number' || isNaN(score)) {
    console.warn('[CertificationManager] Invalid score for grading', score);
    return 'E';
  }

  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'E';
}

/**
 * Get grade description
 */
export function getGradeDescription(grade: string): string {
  const descriptions: Record<string, string> = {
    A: 'Excellent - Full compliance, minimal risk',
    B: 'Good - Strong compliance, manageable risk',
    C: 'Satisfactory - Adequate compliance, moderate risk',
    D: 'Poor - Concerning compliance, elevated risk',
    E: 'Critical - Serious non-compliance, critical risk',
  };
  return descriptions[grade] || 'Unknown grade';
}

/**
 * Generate public verification token
 */
function generatePublicToken(): string {
  return `PUB-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Generate issuer signature (immutable identifier)
 */
function generateIssuerSignature(): string {
  return `SIG-${Math.random().toString(36).substring(2, 12)}-${Math.random().toString(36).substring(2, 12)}`;
}

/**
 * Create new certification from audit snapshot
 * Immutable once created
 */
export function createCertification(
  projectId: string,
  snapshot: AuditSnapshot,
  devisHash: string
): CertificationRecord {
  if (!projectId) {
    throw new Error('projectId is required for certification');
  }

  if (!snapshot) {
    throw new Error('snapshot is required to create certification');
  }

  if (!devisHash) {
    throw new Error('devisHash is required for certification integrity');
  }

  try {
    // Calculate grade from score
    const grade = mapScoreToGrade(snapshot.globalScore);

    // Calculate expiration (30 days from now)
    const now = new Date();
    const expireDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Generate public token for verification
    const publicToken = generatePublicToken();

    // Create immutable certification record
    const certification: CertificationRecord = {
      id: `CERT-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      projectId,
      snapshotId: snapshot.id,
      snapshotVersion: snapshot.version,
      finalScore: snapshot.globalScore,
      grade,
      riskLevel: snapshot.riskLevel,
      devisHash,
      issuedAt: now.toISOString(),
      expiresAt: expireDate.toISOString(),
      status: 'active',
      publicToken,
      issuerSignature: generateIssuerSignature(),
      gradesMetadata: {
        scoreThresholds: {
          A: 90,
          B: 75,
          C: 60,
          D: 40,
          E: 0,
        },
        percentageScore: snapshot.globalScore,
        weightedFactors: snapshot.typeBreakdown,
      },
    };

    // Store certification in memory
    certificationStore[projectId] = [...(certificationStore[projectId] || []), certification];

    // Index public token for quick verification
    tokenIndex[publicToken] = {
      projectId,
      certId: certification.id,
    };

    console.log('[CertificationManager] Certification created', {
      projectId,
      certificationId: certification.id,
      grade,
      score: snapshot.globalScore,
      snapshotVersion: snapshot.version,
      expiresAt: expireDate.toISOString(),
    });

    return certification;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CertificationManager] Error creating certification', error);
    throw new Error(`Failed to create certification: ${errorMessage}`);
  }
}

/**
 * Verify certification by public token
 */
export function verifyCertification(token: string): CertificationVerificationResult {
  const verifiedAt = new Date().toISOString();

  if (!token) {
    return {
      valid: false,
      reason: 'Token is required',
      verifiedAt,
    };
  }

  try {
    // Look up token in index
    const tokenInfo = tokenIndex[token];

    if (!tokenInfo) {
      return {
        valid: false,
        reason: 'Token not found in registry',
        verifiedAt,
      };
    }

    // Retrieve certification from store
    const certifications = certificationStore[tokenInfo.projectId] || [];
    const certification = certifications.find((c) => c.id === tokenInfo.certId);

    if (!certification) {
      return {
        valid: false,
        reason: 'Certification not found',
        verifiedAt,
      };
    }

    // Check expiration
    const expiresAt = new Date(certification.expiresAt);
    const now = new Date();
    const isExpired = now > expiresAt;

    if (isExpired) {
      return {
        valid: false,
        reason: 'Certification has expired',
        certification,
        verifiedAt,
      };
    }

    // Calculate remaining days
    const remainingMs = expiresAt.getTime() - now.getTime();
    const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

    console.log('[CertificationManager] Certification verified', {
      certificationId: certification.id,
      projectId: tokenInfo.projectId,
      grade: certification.grade,
      remainingDays,
    });

    return {
      valid: true,
      certification,
      verifiedAt,
      remainingDays,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CertificationManager] Error verifying certification', error);

    return {
      valid: false,
      reason: `Verification error: ${errorMessage}`,
      verifiedAt,
    };
  }
}

/**
 * Get certification by ID
 */
export function getCertificationById(
  projectId: string,
  certificationId: string
): CertificationRecord | null {
  if (!projectId || !certificationId) {
    return null;
  }

  const certifications = certificationStore[projectId] || [];
  return certifications.find((c) => c.id === certificationId) || null;
}

/**
 * Get certification history for project
 */
export function getCertificationHistory(projectId: string): CertificationHistory {
  if (!projectId) {
    return {
      projectId: '',
      certifications: [],
      totalCertifications: 0,
      activeCertifications: 0,
      expiredCertifications: 0,
    };
  }

  const certifications = certificationStore[projectId] || [];
  const now = new Date();

  // Separate active and expired
  let activeCertifications = 0;
  let expiredCertifications = 0;

  certifications.forEach((cert) => {
    const expiresAt = new Date(cert.expiresAt);
    if (now <= expiresAt) {
      activeCertifications++;
    } else {
      expiredCertifications++;
    }
  });

  // Calculate average grade
  const grades = certifications.map((c) => c.grade);
  const gradeValues: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, E: 1 };
  const avgGradeValue = grades.reduce((sum, g) => sum + (gradeValues[g] || 0), 0) / (grades.length || 1);
  const gradeLetters = ['E', 'D', 'C', 'B', 'A'];
  const averageGrade = gradeLetters[Math.round(avgGradeValue - 1)] || 'N/A';

  return {
    projectId,
    certifications,
    totalCertifications: certifications.length,
    activeCertifications,
    expiredCertifications,
    averageGrade,
    lastIssuedAt: certifications.length > 0 ? certifications[certifications.length - 1].issuedAt : undefined,
  };
}

/**
 * Get latest active certification
 */
export function getLatestActiveCertification(projectId: string): CertificationRecord | null {
  if (!projectId) {
    return null;
  }

  const certifications = certificationStore[projectId] || [];
  const now = new Date();

  // Find latest active certification
  for (let i = certifications.length - 1; i >= 0; i--) {
    const cert = certifications[i];
    const expiresAt = new Date(cert.expiresAt);
    if (now <= expiresAt) {
      return cert;
    }
  }

  return null;
}

/**
 * Get grade statistics for project
 */
export function getGradeStatistics(projectId: string): GradeStatistics | null {
  if (!projectId) {
    return null;
  }

  const certifications = certificationStore[projectId] || [];

  if (certifications.length === 0) {
    return null;
  }

  const now = new Date();
  let activeCertifications = 0;
  const gradeDistribution: Record<string, number> = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    E: 0,
  };

  const scores: number[] = [];

  certifications.forEach((cert) => {
    scores.push(cert.finalScore);
    gradeDistribution[cert.grade]++;

    const expiresAt = new Date(cert.expiresAt);
    if (now <= expiresAt) {
      activeCertifications++;
    }
  });

  const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);

  const averageGrade = mapScoreToGrade(averageScore);

  return {
    projectId,
    totalCertifications: certifications.length,
    activeCertifications,
    gradeDistribution,
    averageScore,
    averageGrade,
    scoreRange: {
      min: minScore,
      max: maxScore,
    },
  };
}

/**
 * Revoke certification (marks as expired)
 * Note: Record is immutable, status is updated
 */
export function revokeCertification(projectId: string, certificationId: string): boolean {
  if (!projectId || !certificationId) {
    return false;
  }

  const certifications = certificationStore[projectId] || [];
  const certification = certifications.find((c) => c.id === certificationId);

  if (!certification) {
    console.warn('[CertificationManager] Certification not found for revocation', {
      projectId,
      certificationId,
    });
    return false;
  }

  // Mark as expired (immutable core data preserved)
  certification.status = 'expired';
  certification.expiresAt = new Date().toISOString(); // Immediate expiration

  console.log('[CertificationManager] Certification revoked', {
    projectId,
    certificationId,
    revokedAt: new Date().toISOString(),
  });

  return true;
}

/**
 * Export certification as JSON
 */
export function exportCertificationAsJSON(
  projectId: string,
  certificationId?: string
): string {
  if (!projectId) {
    return JSON.stringify({ error: 'projectId required' });
  }

  if (certificationId) {
    const cert = getCertificationById(projectId, certificationId);
    return JSON.stringify(
      {
        certification: cert,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
  }

  const history = getCertificationHistory(projectId);
  return JSON.stringify(
    {
      project: projectId,
      certifications: history.certifications,
      summary: {
        total: history.totalCertifications,
        active: history.activeCertifications,
        expired: history.expiredCertifications,
      },
      exportedAt: new Date().toISOString(),
    },
    null,
    2
  );
}

/**
 * Verify certification integrity using devis hash
 */
export function verifyCertificationIntegrity(
  projectId: string,
  certificationId: string,
  devisHash: string
): boolean {
  const certification = getCertificationById(projectId, certificationId);

  if (!certification) {
    console.warn('[CertificationManager] Certification not found for integrity check', {
      projectId,
      certificationId,
    });
    return false;
  }

  const isValid = certification.devisHash === devisHash;

  console.log('[CertificationManager] Integrity check', {
    projectId,
    certificationId,
    isValid,
  });

  return isValid;
}

/**
 * Get all certifications for verification report
 */
export function getCertificationVerificationReport(projectId: string): {
  projectId: string;
  totalCertifications: number;
  activeCertifications: number;
  expiredCertifications: number;
  verificationStatus: Array<{
    certificationId: string;
    grade: string;
    status: string;
    issuedAt: string;
    expiresAt: string;
    remainingDays?: number;
  }>;
} {
  const history = getCertificationHistory(projectId);
  const now = new Date();

  const verificationStatus = history.certifications.map((cert) => {
    const expiresAt = new Date(cert.expiresAt);
    const remainingMs = expiresAt.getTime() - now.getTime();
    const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
    const isExpired = remainingDays < 0;

    return {
      certificationId: cert.id,
      grade: cert.grade,
      status: isExpired ? 'expired' : 'active',
      issuedAt: cert.issuedAt,
      expiresAt: cert.expiresAt,
      remainingDays: isExpired ? undefined : remainingDays,
    };
  });

  return {
    projectId,
    totalCertifications: history.totalCertifications,
    activeCertifications: history.activeCertifications,
    expiredCertifications: history.expiredCertifications,
    verificationStatus,
  };
}

/**
 * Clear all certifications (dev/testing only)
 */
export function clearAllCertifications(): void {
  Object.keys(certificationStore).forEach((key) => delete certificationStore[key]);
  Object.keys(tokenIndex).forEach((key) => delete tokenIndex[key]);
  console.log('[CertificationManager] All certifications cleared');
}

/**
 * Clear project certifications (dev/testing only)
 */
export function clearProjectCertifications(projectId: string): void {
  if (certificationStore[projectId]) {
    const certs = certificationStore[projectId];
    certs.forEach((cert) => {
      delete tokenIndex[cert.publicToken];
    });
    delete certificationStore[projectId];
    console.log('[CertificationManager] Project certifications cleared', { projectId });
  }
}

/**
 * Get certification manager status
 */
export function getCertificationManagerStatus(): {
  totalProjects: number;
  totalCertifications: number;
  activeCertifications: number;
  projects: Array<{
    projectId: string;
    certificationCount: number;
    activeCertifications: number;
    latestGrade: string;
    latestScore: number;
  }>;
} {
  let totalCertifications = 0;
  let activeCertifications = 0;
  const now = new Date();

  const projects = Object.entries(certificationStore)
    .map(([projectId, certs]) => {
      let projectActive = 0;
      const projectTotal = certs.length;
      totalCertifications += projectTotal;

      const latestCert = certs[certs.length - 1];

      certs.forEach((cert) => {
        const expiresAt = new Date(cert.expiresAt);
        if (now <= expiresAt) {
          projectActive++;
          activeCertifications++;
        }
      });

      return {
        projectId,
        certificationCount: projectTotal,
        activeCertifications: projectActive,
        latestGrade: latestCert?.grade || 'N/A',
        latestScore: latestCert?.finalScore || 0,
      };
    });

  return {
    totalProjects: projects.length,
    totalCertifications,
    activeCertifications,
    projects,
  };
}

/**
 * Get Certification Manager metadata
 */
export function getCertificationManagerMetadata() {
  return {
    id: 'certificationManager',
    name: 'Certification Manager',
    version: '1.0',
    description: 'Generate immutable official certifications attached to audit snapshots',
    type: 'certification-generator',
    capabilities: [
      'Create immutable certifications',
      'Map scores to letter grades',
      'Verify certification validity',
      'Track certification expiration',
      'Generate public verification tokens',
      'Maintain certification history',
      'Calculate grade statistics',
      'Export certifications as JSON',
      'Revoke certifications on demand',
      'Verify certification integrity',
    ],
    gradeMapping: {
      A: { range: '90-100', description: 'Excellent - Full compliance, minimal risk' },
      B: { range: '75-89', description: 'Good - Strong compliance, manageable risk' },
      C: { range: '60-74', description: 'Satisfactory - Adequate compliance, moderate risk' },
      D: { range: '40-59', description: 'Poor - Concerning compliance, elevated risk' },
      E: { range: '0-39', description: 'Critical - Serious non-compliance, critical risk' },
    },
    certificationValidity: '30 days from issue',
    immutability: 'Core data immutable after creation (except expiration)',
    persistence: 'In-memory only',
    tokenBased: 'Public tokens for verification',
    integrityCheck: 'Devis hash verification available',
  };
}

/**
 * Audit Snapshot Manager v1.0
 * Versioning system for audit reports - In-memory lifecycle management
 * No database persistence - pure snapshot tracking
 */

/**
 * Audit Snapshot - Immutable point-in-time audit record
 */
export interface AuditSnapshot {
  id: string;
  projectId: string;
  version: number;
  globalScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  totalWeight: number;
  typeBreakdown: Record<string, number>;
  severityBreakdown?: Record<string, number>;
  obligationCount: number;
  recommendationCount: number;
  processingStrategy: string;
  createdAt: string;
}

/**
 * Audit History - Complete version history for a project
 */
export interface AuditHistory {
  projectId: string;
  snapshots: AuditSnapshot[];
  totalSnapshots: number;
  latestVersion: number;
  latestSnapshot?: AuditSnapshot;
  createdAt: string;
  updatedAt: string;
}

/**
 * Snapshot Statistics - Trend analysis data
 */
export interface SnapshotStatistics {
  projectId: string;
  totalVersions: number;
  averageScore: number;
  scoreRange: {
    min: number;
    max: number;
    trend: 'improving' | 'degrading' | 'stable';
  };
  riskLevelDistribution: Record<string, number>;
  latestRiskLevel: string;
  latestScore: number;
  scoreHistory: Array<{
    version: number;
    score: number;
    riskLevel: string;
    createdAt: string;
  }>;
}

/**
 * In-memory snapshot store
 * Structure: projectId -> AuditSnapshot[]
 */
const snapshotStore: Record<string, AuditSnapshot[]> = {};

/**
 * Create new audit snapshot from current audit report
 * Captures immutable point-in-time state
 */
export function createAuditSnapshot(
  projectId: string,
  auditReport: any
): AuditSnapshot {
  if (!projectId) {
    throw new Error('projectId is required for audit snapshot');
  }

  if (!auditReport) {
    throw new Error('auditReport is required to create snapshot');
  }

  try {
    // Initialize project history if not exists
    const history = snapshotStore[projectId] || [];
    const version = history.length + 1;

    // Extract required data from audit report
    const riskAssessment = auditReport.riskAssessment || {};
    const scoreBreakdown = riskAssessment.scoreBreakdown || {};

    // Validate required fields
    if (typeof riskAssessment.globalScore === 'undefined') {
      throw new Error('auditReport.riskAssessment.globalScore is required');
    }

    if (!riskAssessment.riskLevel) {
      throw new Error('auditReport.riskAssessment.riskLevel is required');
    }

    // Create snapshot with unique ID
    const snapshot: AuditSnapshot = {
      id: `SNAP-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      projectId,
      version,
      globalScore: riskAssessment.globalScore,
      riskLevel: riskAssessment.riskLevel,
      totalWeight: scoreBreakdown.totalWeight || 0,
      typeBreakdown: scoreBreakdown.typeBreakdown || {},
      severityBreakdown: scoreBreakdown.severityBreakdown,
      obligationCount: auditReport.complianceFindings?.obligations?.length || 0,
      recommendationCount: auditReport.recommendedActions?.length || 0,
      processingStrategy: auditReport.processingStrategy || 'standard',
      createdAt: new Date().toISOString(),
    };

    // Store snapshot
    snapshotStore[projectId] = [...history, snapshot];

    console.log('[AuditSnapshotManager] Snapshot created', {
      projectId,
      snapshotId: snapshot.id,
      version,
      globalScore: snapshot.globalScore,
      riskLevel: snapshot.riskLevel,
    });

    return snapshot;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AuditSnapshotManager] Error creating snapshot', error);
    throw new Error(`Failed to create audit snapshot: ${errorMessage}`);
  }
}

/**
 * Get complete audit history for a project
 */
export function getAuditHistory(projectId: string): AuditSnapshot[] {
  if (!projectId) {
    console.warn('[AuditSnapshotManager] projectId is required to get history');
    return [];
  }

  const snapshots = snapshotStore[projectId] || [];

  console.log('[AuditSnapshotManager] Retrieved audit history', {
    projectId,
    snapshotCount: snapshots.length,
  });

  return snapshots;
}

/**
 * Get audit history with metadata
 */
export function getAuditHistoryWithMetadata(projectId: string): AuditHistory {
  const snapshots = getAuditHistory(projectId);

  return {
    projectId,
    snapshots,
    totalSnapshots: snapshots.length,
    latestVersion: snapshots.length > 0 ? snapshots[snapshots.length - 1].version : 0,
    latestSnapshot: snapshots.length > 0 ? snapshots[snapshots.length - 1] : undefined,
    createdAt: snapshots.length > 0 ? snapshots[0].createdAt : new Date().toISOString(),
    updatedAt: snapshots.length > 0 ? snapshots[snapshots.length - 1].createdAt : new Date().toISOString(),
  };
}

/**
 * Get specific snapshot by version
 */
export function getSnapshotByVersion(projectId: string, version: number): AuditSnapshot | null {
  if (!projectId || typeof version !== 'number' || version < 1) {
    console.warn('[AuditSnapshotManager] Invalid projectId or version');
    return null;
  }

  const snapshots = snapshotStore[projectId] || [];
  const snapshot = snapshots.find((s) => s.version === version);

  if (!snapshot) {
    console.warn('[AuditSnapshotManager] Snapshot not found', { projectId, version });
    return null;
  }

  return snapshot;
}

/**
 * Get latest snapshot for a project
 */
export function getLatestSnapshot(projectId: string): AuditSnapshot | null {
  if (!projectId) {
    console.warn('[AuditSnapshotManager] projectId is required');
    return null;
  }

  const snapshots = snapshotStore[projectId] || [];

  if (snapshots.length === 0) {
    console.warn('[AuditSnapshotManager] No snapshots found', { projectId });
    return null;
  }

  return snapshots[snapshots.length - 1];
}

/**
 * Compare two snapshots to detect changes
 */
export function compareSnapshots(
  projectId: string,
  version1: number,
  version2: number
): {
  hasDifferences: boolean;
  scoreChange: number;
  riskLevelChanged: boolean;
  weightChange: number;
  changes: string[];
} | null {
  const snapshot1 = getSnapshotByVersion(projectId, version1);
  const snapshot2 = getSnapshotByVersion(projectId, version2);

  if (!snapshot1 || !snapshot2) {
    console.warn('[AuditSnapshotManager] One or both snapshots not found', {
      projectId,
      version1,
      version2,
    });
    return null;
  }

  const scoreChange = snapshot2.globalScore - snapshot1.globalScore;
  const weightChange = snapshot2.totalWeight - snapshot1.totalWeight;
  const riskLevelChanged = snapshot1.riskLevel !== snapshot2.riskLevel;

  const changes: string[] = [];

  if (scoreChange !== 0) {
    changes.push(
      `Global score changed from ${snapshot1.globalScore} to ${snapshot2.globalScore} (${scoreChange > 0 ? '+' : ''}${scoreChange})`
    );
  }

  if (riskLevelChanged) {
    changes.push(`Risk level changed from ${snapshot1.riskLevel} to ${snapshot2.riskLevel}`);
  }

  if (weightChange !== 0) {
    changes.push(
      `Total weight changed from ${snapshot1.totalWeight} to ${snapshot2.totalWeight} (${weightChange > 0 ? '+' : ''}${weightChange})`
    );
  }

  if (
    snapshot1.obligationCount !== snapshot2.obligationCount
  ) {
    changes.push(
      `Obligations changed from ${snapshot1.obligationCount} to ${snapshot2.obligationCount}`
    );
  }

  if (snapshot1.recommendationCount !== snapshot2.recommendationCount) {
    changes.push(
      `Recommendations changed from ${snapshot1.recommendationCount} to ${snapshot2.recommendationCount}`
    );
  }

  return {
    hasDifferences: changes.length > 0,
    scoreChange,
    riskLevelChanged,
    weightChange,
    changes,
  };
}

/**
 * Get trend between latest and previous snapshots
 */
export function getTrendAnalysis(projectId: string): {
  trend: 'improving' | 'degrading' | 'stable' | 'no_history';
  scoreChange: number;
  riskTrend: string;
  recentChanges: string[];
} | null {
  const snapshots = getAuditHistory(projectId);

  if (snapshots.length === 0) {
    return {
      trend: 'no_history',
      scoreChange: 0,
      riskTrend: 'No audit history',
      recentChanges: [],
    };
  }

  if (snapshots.length === 1) {
    return {
      trend: 'stable',
      scoreChange: 0,
      riskTrend: `Current: ${snapshots[0].riskLevel}`,
      recentChanges: ['First audit version'],
    };
  }

  // Compare latest with previous
  const latest = snapshots[snapshots.length - 1];
  const previous = snapshots[snapshots.length - 2];

  const scoreChange = latest.globalScore - previous.globalScore;
  const trend: 'improving' | 'degrading' | 'stable' =
    scoreChange > 5 ? 'improving' : scoreChange < -5 ? 'degrading' : 'stable';

  const riskTrend = `${previous.riskLevel} → ${latest.riskLevel}`;

  const recentChanges: string[] = [];
  if (scoreChange !== 0) {
    recentChanges.push(
      `Score: ${previous.globalScore} → ${latest.globalScore} (${scoreChange > 0 ? '+' : ''}${scoreChange})`
    );
  }
  if (previous.riskLevel !== latest.riskLevel) {
    recentChanges.push(`Risk: ${previous.riskLevel} → ${latest.riskLevel}`);
  }
  if (previous.obligationCount !== latest.obligationCount) {
    recentChanges.push(
      `Obligations: ${previous.obligationCount} → ${latest.obligationCount}`
    );
  }

  return {
    trend,
    scoreChange,
    riskTrend,
    recentChanges,
  };
}

/**
 * Calculate statistics across all snapshots
 */
export function getSnapshotStatistics(projectId: string): SnapshotStatistics | null {
  const snapshots = getAuditHistory(projectId);

  if (snapshots.length === 0) {
    console.warn('[AuditSnapshotManager] No snapshots found for statistics', { projectId });
    return null;
  }

  // Calculate score statistics
  const scores = snapshots.map((s) => s.globalScore);
  const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);

  // Determine trend
  const scoreTrend =
    snapshots.length < 2
      ? 'stable'
      : snapshots[snapshots.length - 1].globalScore > snapshots[0].globalScore
        ? 'improving'
        : snapshots[snapshots.length - 1].globalScore < snapshots[0].globalScore
          ? 'degrading'
          : 'stable';

  // Calculate risk level distribution
  const riskLevelDistribution: Record<string, number> = {};
  snapshots.forEach((s) => {
    riskLevelDistribution[s.riskLevel] = (riskLevelDistribution[s.riskLevel] || 0) + 1;
  });

  // Build score history
  const scoreHistory = snapshots.map((s) => ({
    version: s.version,
    score: s.globalScore,
    riskLevel: s.riskLevel,
    createdAt: s.createdAt,
  }));

  return {
    projectId,
    totalVersions: snapshots.length,
    averageScore,
    scoreRange: {
      min: minScore,
      max: maxScore,
      trend: scoreTrend as 'improving' | 'degrading' | 'stable',
    },
    riskLevelDistribution,
    latestRiskLevel: snapshots[snapshots.length - 1].riskLevel,
    latestScore: snapshots[snapshots.length - 1].globalScore,
    scoreHistory,
  };
}

/**
 * Clear all snapshots for a project (dev/testing only)
 */
export function clearProjectSnapshots(projectId: string): void {
  if (snapshotStore[projectId]) {
    const count = snapshotStore[projectId].length;
    delete snapshotStore[projectId];
    console.log('[AuditSnapshotManager] Cleared snapshots for project', { projectId, count });
  }
}

/**
 * Clear entire snapshot store (dev/testing only)
 */
export function clearAllSnapshots(): void {
  const projectCount = Object.keys(snapshotStore).length;
  const totalSnapshots = Object.values(snapshotStore).reduce((sum, arr) => sum + arr.length, 0);
  Object.keys(snapshotStore).forEach((key) => delete snapshotStore[key]);
  console.log('[AuditSnapshotManager] Cleared all snapshots', { projectCount, totalSnapshots });
}

/**
 * Get all stored snapshots (dev/testing only)
 */
export function getAllSnapshots(): Record<string, AuditSnapshot[]> {
  return JSON.parse(JSON.stringify(snapshotStore));
}

/**
 * Get snapshot manager status
 */
export function getSnapshotManagerStatus(): {
  totalProjects: number;
  totalSnapshots: number;
  projects: Array<{
    projectId: string;
    snapshotCount: number;
    latestVersion: number;
    latestScore: number;
    latestRiskLevel: string;
  }>;
} {
  const projects = Object.entries(snapshotStore).map(([projectId, snapshots]) => ({
    projectId,
    snapshotCount: snapshots.length,
    latestVersion: snapshots.length > 0 ? snapshots[snapshots.length - 1].version : 0,
    latestScore: snapshots.length > 0 ? snapshots[snapshots.length - 1].globalScore : 0,
    latestRiskLevel: snapshots.length > 0 ? snapshots[snapshots.length - 1].riskLevel : 'unknown',
  }));

  const totalSnapshots = Object.values(snapshotStore).reduce((sum, arr) => sum + arr.length, 0);

  return {
    totalProjects: projects.length,
    totalSnapshots,
    projects,
  };
}

/**
 * Export snapshots in JSON format
 */
export function exportSnapshotsAsJSON(projectId?: string): string {
  if (projectId) {
    const snapshots = getAuditHistory(projectId);
    return JSON.stringify(
      {
        projectId,
        snapshotCount: snapshots.length,
        snapshots,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
  }

  return JSON.stringify(
    {
      totalProjects: Object.keys(snapshotStore).length,
      totalSnapshots: Object.values(snapshotStore).reduce((sum, arr) => sum + arr.length, 0),
      store: snapshotStore,
      exportedAt: new Date().toISOString(),
    },
    null,
    2
  );
}

/**
 * Get Audit Snapshot Manager metadata
 */
export function getAuditSnapshotManagerMetadata() {
  return {
    id: 'auditSnapshotManager',
    name: 'Audit Snapshot Manager',
    version: '1.0',
    description: 'Versioning system for audit reports - In-memory lifecycle management',
    type: 'lifecycle-manager',
    capabilities: [
      'Create point-in-time audit snapshots',
      'Retrieve complete audit history',
      'Compare snapshot versions',
      'Trend analysis across versions',
      'Statistical analysis of audit history',
      'Score and risk level tracking',
      'Export snapshots as JSON',
    ],
    persistence: 'in-memory',
    dataModel: {
      AuditSnapshot: [
        'id: unique identifier',
        'projectId: associated project',
        'version: sequential version number',
        'globalScore: audit score at snapshot time',
        'riskLevel: assessed risk level',
        'totalWeight: obligation weight sum',
        'typeBreakdown: obligations by type',
        'obligationCount: total obligations',
        'recommendationCount: recommended actions',
        'processingStrategy: applied strategy',
        'createdAt: snapshot timestamp',
      ],
    },
    operations: {
      create: 'createAuditSnapshot(projectId, auditReport)',
      retrieve: {
        history: 'getAuditHistory(projectId)',
        specific: 'getSnapshotByVersion(projectId, version)',
        latest: 'getLatestSnapshot(projectId)',
      },
      analysis: {
        compare: 'compareSnapshots(projectId, version1, version2)',
        trend: 'getTrendAnalysis(projectId)',
        statistics: 'getSnapshotStatistics(projectId)',
      },
      utilities: {
        status: 'getSnapshotManagerStatus()',
        export: 'exportSnapshotsAsJSON(projectId?)',
      },
    },
    storage: 'No database - in-memory only',
    lifecycle: 'Session-based - cleared on restart',
  };
}

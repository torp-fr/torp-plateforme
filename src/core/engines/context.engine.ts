/**
 * Context Engine v1.0
 * Extracts and structures project context
 * Pure context structuring - NO business logic, NO AI, NO external calls
 */

/**
 * Context data structure for engine processing
 */
export interface ContextEngineInput {
  projectId: string;
  data?: Record<string, any>;
  options?: Record<string, any>;
}

/**
 * Detected lot information
 */
export interface DetectedLot {
  id?: string;
  type?: string;
  description?: string;
  confidence?: number;
}

/**
 * Space information extracted from context
 */
export interface SpaceInfo {
  id?: string;
  type?: string;
  surface?: number;
  description?: string;
}

/**
 * Flag raised during context analysis
 */
export interface ContextFlag {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

/**
 * Context Engine result
 */
export interface ContextEngineResult {
  projectId: string;
  meta: {
    createdAt: string;
    engineVersion: string;
    processingTime?: number;
  };
  detectedLots: DetectedLot[];
  spaces: SpaceInfo[];
  flags: ContextFlag[];
  summary?: {
    totalLots: number;
    totalSpaces: number;
    flagCount: number;
  };
}

/**
 * Run Context Engine
 * Structures and extracts project context
 * Version 1.0: Pure structuring - NO logic, NO external calls
 */
export async function runContextEngine(
  input: ContextEngineInput
): Promise<ContextEngineResult> {
  const startTime = Date.now();

  console.log('[ContextEngine] Starting context extraction', { projectId: input.projectId });

  try {
    // Extract basic structure from input
    const projectData = input.data || {};

    // Initialize result structure
    const result: ContextEngineResult = {
      projectId: input.projectId,
      meta: {
        createdAt: new Date().toISOString(),
        engineVersion: '1.0',
        processingTime: 0,
      },
      detectedLots: [],
      spaces: [],
      flags: [],
      summary: {
        totalLots: 0,
        totalSpaces: 0,
        flagCount: 0,
      },
    };

    // Extract lots from project data if available
    if (projectData.lots && Array.isArray(projectData.lots)) {
      result.detectedLots = projectData.lots.map((lot: any, index: number) => ({
        id: `lot_${index + 1}`,
        type: typeof lot === 'string' ? lot : lot.type || 'unknown',
        description: typeof lot === 'string' ? lot : lot.description,
        confidence: 0.8, // Placeholder confidence
      }));
    }

    // Extract spaces from project data if available
    if (projectData.spaces && Array.isArray(projectData.spaces)) {
      result.spaces = projectData.spaces.map((space: any, index: number) => ({
        id: `space_${index + 1}`,
        type: space.type || 'unknown',
        surface: space.surface || 0,
        description: space.description,
      }));
    }

    // Add validation flags
    if (!input.projectId) {
      result.flags.push({
        code: 'NO_PROJECT_ID',
        message: 'Project ID is missing',
        severity: 'error',
      });
    }

    if (!projectData || Object.keys(projectData).length === 0) {
      result.flags.push({
        code: 'EMPTY_PROJECT_DATA',
        message: 'Project data is empty or missing',
        severity: 'warning',
      });
    }

    // Update summary
    result.summary = {
      totalLots: result.detectedLots.length,
      totalSpaces: result.spaces.length,
      flagCount: result.flags.length,
    };

    // Calculate processing time
    result.meta.processingTime = Date.now() - startTime;

    console.log('[ContextEngine] Context extraction completed', {
      projectId: input.projectId,
      lots: result.detectedLots.length,
      spaces: result.spaces.length,
      flags: result.flags.length,
      duration: result.meta.processingTime,
    });

    return result;
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('[ContextEngine] Context extraction failed', {
      projectId: input.projectId,
      error: errorMessage,
      duration: processingTime,
    });

    // Return error result
    return {
      projectId: input.projectId,
      meta: {
        createdAt: new Date().toISOString(),
        engineVersion: '1.0',
        processingTime,
      },
      detectedLots: [],
      spaces: [],
      flags: [
        {
          code: 'EXECUTION_ERROR',
          message: errorMessage,
          severity: 'error',
        },
      ],
      summary: {
        totalLots: 0,
        totalSpaces: 0,
        flagCount: 1,
      },
    };
  }
}

/**
 * Get engine metadata
 */
export function getContextEngineMetadata() {
  return {
    id: 'contextEngine',
    name: 'Context Engine',
    version: '1.0',
    description: 'Extracts and structures project context',
    capabilities: [
      'Context structuring',
      'Lot detection',
      'Space extraction',
      'Validation flags',
    ],
    inputRequired: ['projectId'],
    outputFormat: 'ContextEngineResult',
  };
}

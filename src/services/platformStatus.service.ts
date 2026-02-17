/**
 * Platform Status Service
 * Service centralisé pour obtenir l'état de la plateforme
 * Agrège les états des engines, APIs et Knowledge Base
 */

import { ENGINE_REGISTRY, getEngineStats } from '@/core/platform/engineRegistry';
import { API_REGISTRY, getAPIStats } from '@/core/platform/apiRegistry';

export interface PlatformStatus {
  engines: typeof ENGINE_REGISTRY;
  apis: typeof API_REGISTRY;
  engineStats: ReturnType<typeof getEngineStats>;
  apiStats: ReturnType<typeof getAPIStats>;
  knowledgeBase: {
    documents: number;
    lastUpdated?: string;
  };
  timestamp: string;
}

/**
 * Récupère l'état complet de la plateforme
 * Retourne un objet statique sans appels externes
 */
export async function getPlatformStatus(): Promise<PlatformStatus> {
  return {
    engines: ENGINE_REGISTRY,
    apis: API_REGISTRY,
    engineStats: getEngineStats(),
    apiStats: getAPIStats(),
    knowledgeBase: {
      documents: 0,
      lastUpdated: undefined,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Récupère l'état des engines
 */
export function getPlatformEngines() {
  return {
    registry: ENGINE_REGISTRY,
    stats: getEngineStats(),
  };
}

/**
 * Récupère l'état des APIs
 */
export function getPlatformAPIs() {
  return {
    registry: API_REGISTRY,
    stats: getAPIStats(),
  };
}

/**
 * Récupère l'état de la Knowledge Base
 */
export function getKnowledgeBaseStatus() {
  return {
    documents: 0,
    ingested: 0,
    status: 'idle' as const,
  };
}

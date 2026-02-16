/**
 * Engine Registry
 * Registre centralisé des engines disponibles dans la plateforme
 * Chaque engine est un service d'orchestration spécialisé
 */

export type EngineStatus = 'inactive' | 'initializing' | 'active' | 'error' | 'maintenance';

export interface EngineRegistryEntry {
  id: string;
  name: string;
  description: string;
  status: EngineStatus;
  version?: string;
  lastUpdated?: string;
}

export const ENGINE_REGISTRY: EngineRegistryEntry[] = [
  {
    id: 'contextEngine',
    name: 'Context Engine',
    description: 'Extraction et gestion du contexte projet',
    status: 'inactive',
  },
  {
    id: 'lotEngine',
    name: 'Lot Engine',
    description: 'Analyse et décomposition des lots',
    status: 'inactive',
  },
  {
    id: 'ruleEngine',
    name: 'Rule Engine',
    description: 'Évaluation des règles métier',
    status: 'inactive',
  },
  {
    id: 'enrichmentEngine',
    name: 'Enrichment Engine',
    description: 'Orchestration d\'enrichissement de données',
    status: 'inactive',
  },
  {
    id: 'ragEngine',
    name: 'RAG Engine',
    description: 'Retrieval Augmented Generation',
    status: 'inactive',
  },
  {
    id: 'auditEngine',
    name: 'Audit Engine',
    description: 'Audit et conformité des données',
    status: 'inactive',
  },
  {
    id: 'visionEngine',
    name: 'Vision Engine',
    description: 'Analyse visuelle (OCR, photos)',
    status: 'inactive',
  },
];

/**
 * Récupère un engine par son ID
 */
export function getEngine(id: string): EngineRegistryEntry | undefined {
  return ENGINE_REGISTRY.find((e) => e.id === id);
}

/**
 * Récupère tous les engines avec un statut spécifique
 */
export function getEnginesByStatus(status: EngineStatus): EngineRegistryEntry[] {
  return ENGINE_REGISTRY.filter((e) => e.status === status);
}

/**
 * Compte les engines par statut
 */
export function getEngineStats() {
  return {
    total: ENGINE_REGISTRY.length,
    active: ENGINE_REGISTRY.filter((e) => e.status === 'active').length,
    inactive: ENGINE_REGISTRY.filter((e) => e.status === 'inactive').length,
    error: ENGINE_REGISTRY.filter((e) => e.status === 'error').length,
  };
}

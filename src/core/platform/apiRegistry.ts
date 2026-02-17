/**
 * API Registry
 * Registre des APIs externes intégrées dans la plateforme
 */

export type APIStatus = 'unconfigured' | 'configured' | 'active' | 'error' | 'rate_limited';

export interface APIRegistryEntry {
  id: string;
  name: string;
  provider: string;
  status: APIStatus;
  description: string;
  endpoint?: string;
  lastChecked?: string;
}

export const API_REGISTRY: APIRegistryEntry[] = [
  {
    id: 'pappers',
    name: 'Pappers',
    provider: 'Pappers SAS',
    status: 'unconfigured',
    description: 'Données entreprises et SIRET',
  },
  {
    id: 'insee',
    name: 'INSEE',
    provider: 'Institut National de Statistiques',
    status: 'unconfigured',
    description: 'Données cadastrales et démographiques',
  },
  {
    id: 'ban',
    name: 'BAN',
    provider: 'Base Adresse Nationale',
    status: 'unconfigured',
    description: 'Normalisation et géocodage d\'adresses',
  },
  {
    id: 'cadastre',
    name: 'Cadastre',
    provider: 'DGFiP',
    status: 'unconfigured',
    description: 'Données cadastrales et parcellaires',
  },
  {
    id: 'gpu_ign',
    name: 'GPU IGN',
    provider: 'Institut Géographique National',
    status: 'unconfigured',
    description: 'Données géographiques et cartographie',
  },
  {
    id: 'rge_ademe',
    name: 'RGE ADEME',
    provider: 'ADEME',
    status: 'unconfigured',
    description: 'Registre entreprises RGE',
  },
];

/**
 * Récupère une API par son ID
 */
export function getAPI(id: string): APIRegistryEntry | undefined {
  return API_REGISTRY.find((a) => a.id === id);
}

/**
 * Récupère toutes les APIs avec un statut spécifique
 */
export function getAPIsByStatus(status: APIStatus): APIRegistryEntry[] {
  return API_REGISTRY.filter((a) => a.status === status);
}

/**
 * Compte les APIs par statut
 */
export function getAPIStats() {
  return {
    total: API_REGISTRY.length,
    configured: API_REGISTRY.filter((a) => a.status !== 'unconfigured').length,
    unconfigured: API_REGISTRY.filter((a) => a.status === 'unconfigured').length,
    active: API_REGISTRY.filter((a) => a.status === 'active').length,
    error: API_REGISTRY.filter((a) => a.status === 'error').length,
  };
}

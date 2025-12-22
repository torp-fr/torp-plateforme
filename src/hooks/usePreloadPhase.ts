/**
 * usePreloadPhase - Précharge les phases adjacentes
 * Améliore la navigation en préchargeant les pages voisines
 */

import { useEffect } from 'react';

// Modules de pages par phase
const phaseModules = {
  0: () => import('@/pages/phase0/Phase0Dashboard'),
  1: () => import('@/pages/phase1/Phase1Consultation'),
  2: () => import('@/pages/phase2/Phase2Dashboard'),
  3: () => import('@/pages/phase3/Phase3Dashboard'),
  4: () => import('@/pages/phase4/Phase4Dashboard'),
  5: () => import('@/pages/phase5/Phase5Dashboard'),
};

// Services par phase (pour le préchargement complet)
const serviceModules = {
  0: () => import('@/services/phase0'),
  1: () => import('@/services/phase1'),
  2: () => import('@/services/phase2'),
  3: () => import('@/services/phase3'),
  4: () => import('@/services/phase4'),
  5: () => import('@/services/phase5'),
};

export type PhaseNumber = 0 | 1 | 2 | 3 | 4 | 5;

interface UsePreloadPhaseOptions {
  /**
   * Précharger aussi les services de la phase
   */
  includeServices?: boolean;
  /**
   * Délai avant le préchargement (ms)
   */
  delay?: number;
}

/**
 * Hook pour précharger les phases adjacentes
 *
 * @param currentPhase - La phase actuellement affichée
 * @param options - Options de préchargement
 *
 * @example
 * ```tsx
 * function Phase2Dashboard() {
 *   usePreloadPhase(2); // Précharge Phase 1 et Phase 3
 *   // ...
 * }
 * ```
 */
export function usePreloadPhase(
  currentPhase: PhaseNumber,
  options: UsePreloadPhaseOptions = {}
) {
  const { includeServices = false, delay = 1000 } = options;

  useEffect(() => {
    const timer = setTimeout(() => {
      // Précharge la phase suivante
      const nextPhase = (currentPhase + 1) as PhaseNumber;
      if (nextPhase <= 5) {
        phaseModules[nextPhase]?.();
        if (includeServices) {
          serviceModules[nextPhase]?.();
        }
      }

      // Précharge la phase précédente
      const prevPhase = (currentPhase - 1) as PhaseNumber;
      if (prevPhase >= 0) {
        phaseModules[prevPhase]?.();
        if (includeServices) {
          serviceModules[prevPhase]?.();
        }
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [currentPhase, includeServices, delay]);
}

/**
 * Précharge une phase spécifique manuellement
 * Utile pour précharger à partir d'événements utilisateur (hover, etc.)
 */
export function preloadPhase(phase: PhaseNumber, includeServices = false) {
  phaseModules[phase]?.();
  if (includeServices) {
    serviceModules[phase]?.();
  }
}

/**
 * Précharge toutes les phases (à utiliser avec prudence)
 * Utile après la connexion utilisateur par exemple
 */
export function preloadAllPhases() {
  Object.values(phaseModules).forEach(loadModule => loadModule());
}

export default usePreloadPhase;

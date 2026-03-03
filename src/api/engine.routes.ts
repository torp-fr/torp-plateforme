/**
 * Engine Facade Routes
 * Découplage du frontend des core engines
 * Expose les endpoints pour stats, status et orchestration
 */

import type { Express } from 'express';
import { ENGINE_REGISTRY, getEngineStats } from '@/core/platform/engineRegistry';
import { getOrchestrationStatus, getOrchestrationStats, getLastOrchestration } from '@/core/platform/engineOrchestrator';

/**
 * GET /api/engine/stats
 * Retourne les statistiques des engines (total, actifs, inactifs, erreurs)
 */
function handleEngineStats(req: any, res: any) {
  try {
    const stats = getEngineStats();
    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Engine Stats] Error:', message);
    res.status(500).json({
      success: false,
      error: message,
    });
  }
}

/**
 * GET /api/engine/status
 * Retourne le statut actuel de l'orchestrateur
 */
function handleEngineStatus(req: any, res: any) {
  try {
    const status = getOrchestrationStatus();
    res.status(200).json({
      success: true,
      data: {
        status,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Engine Status] Error:', message);
    res.status(500).json({
      success: false,
      error: message,
    });
  }
}

/**
 * GET /api/engine/orchestration
 * Retourne les statistiques et le dernier résultat d'orchestration
 */
function handleEngineOrchestration(req: any, res: any) {
  try {
    const stats = getOrchestrationStats();
    const lastOrchestration = getLastOrchestration();

    res.status(200).json({
      success: true,
      data: {
        stats,
        lastOrchestration,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Engine Orchestration] Error:', message);
    res.status(500).json({
      success: false,
      error: message,
    });
  }
}

/**
 * Enregistre les routes engine sur l'app Express
 */
export function registerEngineRoutes(app: Express) {
  app.get('/api/engine/stats', handleEngineStats);
  app.get('/api/engine/status', handleEngineStatus);
  app.get('/api/engine/orchestration', handleEngineOrchestration);
}

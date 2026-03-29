// ─────────────────────────────────────────────────────────────────────────────
// server.ts — TORP Express API Server — Phase 3B Jalon 1
//
// Start: pnpm start  (tsx --env-file=.env.local src/api/server.ts)
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { assertConfig, config } from '../config/index.js';
import { rateLimitMiddleware } from './middleware/rateLimit.js';
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import engineRoutes from './routes/engine.routes.js';
import pipelineRoutes from './pipelines.routes.js';
import healthRoutes from './pipeline-health.routes.js';
import { APIHealthMonitor } from '../core/monitoring/APIHealthMonitor.js';
import {
  registerAIAPIs,
  registerDataAPIs,
  registerEnrichmentAPIs,
} from '../core/monitoring/AIAPIsHealthCheck.js';

// ─── Startup validation ───────────────────────────────────────────────────────

assertConfig();

// ─── App setup ────────────────────────────────────────────────────────────────

const app = express();

// ─── Global middleware ────────────────────────────────────────────────────────

app.use(cors({
  origin: config.server.clientUrl,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// Rate limiting applied globally (runs before routes so all endpoints are covered)
app.use(rateLimitMiddleware);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/v1/auth',   authRoutes);    // Public + protected auth endpoints
app.use('/api/v1/admin',  adminRoutes);   // Admin-only endpoints
app.use('/api/v1/engine', engineRoutes);  // Engine metrics (JWT required)

app.use('/api/v1', pipelineRoutes);      // Phase 3A pipeline routes
app.use('/api/v1', healthRoutes);        // Pipeline health checks

// Simple liveness check (no auth, no rate-limit impact on infra monitoring)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '3B.1' });
});

// ─── Global error handler ─────────────────────────────────────────────────────

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server] Unhandled error:', err);
  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(500).json({ error: 'Internal Server Error', message });
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = config.server.port;

app.listen(PORT, () => {
  console.log(`[server] TORP API running on port ${PORT} (${config.env})`);
  console.log(`[server] Client origin: ${config.server.clientUrl}`);

  // ── AI API health monitoring ────────────────────────────────────────────
  if (config.supabase.url && config.supabase.serviceRoleKey) {
    const supabaseAdmin = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey
    );
    const aiMonitor = new APIHealthMonitor(supabaseAdmin);
    registerAIAPIs(aiMonitor);
    registerDataAPIs(aiMonitor);
    registerEnrichmentAPIs(aiMonitor);
  } else {
    console.warn('[server] AI health monitoring disabled — Supabase credentials not set');
  }
});

export default app;

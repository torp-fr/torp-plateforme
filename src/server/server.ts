/**
 * RAG Backend API Server
 *
 * Lightweight Express server exposing the RAG pipeline via HTTP.
 * Runs alongside the Vite dev server; Vite proxies /api and /debug to this process.
 *
 * Start:  npm run dev:api
 * Full:   npm run dev:full  (Vite + this server concurrently)
 */

import express from 'express';
import cors from 'cors';
import engineRoutes from './api/engine.routes.js';
import debugRoutes from './api/debug.routes.js';

const app = express();
const PORT = process.env.API_PORT ? parseInt(process.env.API_PORT, 10) : 3001;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(cors());
app.use(express.json());

// Request logger (dev only)
app.use((req, _res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[API] ${req.method} ${req.path}`);
  }
  next();
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/v1/engine', engineRoutes);
app.use('/debug', debugRoutes);

// ---------------------------------------------------------------------------
// 404 catch-all
// ---------------------------------------------------------------------------

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`\n🚀 RAG API running on http://localhost:${PORT}`);
  console.log(`   GET /health`);
  console.log(`   GET /api/v1/engine/status`);
  console.log(`   GET /api/v1/engine/stats`);
  console.log(`   GET /api/v1/engine/orchestration`);
  console.log(`   GET /debug/ingestion`);
  console.log(`   GET /debug/retrieval?q=<query>`);
  console.log(`   GET /debug/chunks?documentId=<id>`);
  console.log(`   GET /debug/rag-trace?q=<query>\n`);
});

export default app;

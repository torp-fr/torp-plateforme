/**
 * Mock API Server for Development
 * Provides lightweight API responses for frontend integration testing
 *
 * Endpoints:
 * - GET /api/v1/engine/status
 * - GET /api/v1/engine/stats
 * - GET /api/v1/engine/orchestration
 * - GET /debug/ingestion
 */

import type { ViteDevServer } from 'vite';

// Mock data store (persists during dev session)
const mockData = {
  engine: {
    status: 'running' as const,
    workers: 1,
    uptime: Math.floor(Date.now() / 1000),
  },
  stats: {
    documents: 0,
    chunks: 0,
    embeddings: 0,
  },
  orchestration: {
    last_run: null as string | null,
    status: 'idle' as const,
  },
  ingestion: {
    documents: 0,
    chunks: 0,
    embeddings: 0,
    avgQuality: 0,
    publishableDocuments: 0,
  },
};

/**
 * Register mock API routes with Vite dev server
 */
export function registerMockApi(server: ViteDevServer): void {
  // GET /api/v1/engine/status
  server.middlewares.use('/api/v1/engine/status', (req, res) => {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: mockData.engine.status,
          workers: mockData.engine.workers,
          uptime: Math.floor(Date.now() / 1000) - Math.floor(Date.now() / 1000 - mockData.engine.uptime),
        })
      );
    } else {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
    }
  });

  // GET /api/v1/engine/stats
  server.middlewares.use('/api/v1/engine/stats', (req, res) => {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          documents: mockData.stats.documents,
          chunks: mockData.stats.chunks,
          embeddings: mockData.stats.embeddings,
        })
      );
    } else {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
    }
  });

  // GET /api/v1/engine/orchestration
  server.middlewares.use('/api/v1/engine/orchestration', (req, res) => {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          last_run: mockData.orchestration.last_run,
          status: mockData.orchestration.status,
        })
      );
    } else {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
    }
  });

  // GET /debug/ingestion
  server.middlewares.use('/debug/ingestion', (req, res) => {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          documents: mockData.ingestion.documents,
          chunks: mockData.ingestion.chunks,
          embeddings: mockData.ingestion.embeddings,
          avgQuality: mockData.ingestion.avgQuality,
          publishableDocuments: mockData.ingestion.publishableDocuments,
        })
      );
    } else {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
    }
  });

  console.log('✅ Mock API server initialized');
  console.log('   - GET /api/v1/engine/status');
  console.log('   - GET /api/v1/engine/stats');
  console.log('   - GET /api/v1/engine/orchestration');
  console.log('   - GET /debug/ingestion');
}

export default registerMockApi;

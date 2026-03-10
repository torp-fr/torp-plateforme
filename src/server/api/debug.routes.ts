/**
 * Debug API Routes
 * Developer-only endpoints for inspecting the RAG pipeline
 *
 * GET /debug/ingestion
 * GET /debug/retrieval?q=<query>
 * GET /debug/chunks?documentId=<id>
 * GET /debug/rag-trace?q=<query>
 */

import { Router, Request, Response } from 'express';
import type {
  IngestionDebugData,
  RetrievalDebugResult,
  ChunkVisualization,
} from '../types/api.types';

// Safe fallbacks
const FALLBACK_INGESTION: IngestionDebugData = {
  documents: 0,
  chunks: 0,
  embeddings: 0,
  avgQuality: 0,
  publishableDocuments: 0,
};

const router = Router();

// ---------------------------------------------------------------------------
// GET /debug/ingestion
// ---------------------------------------------------------------------------
router.get('/ingestion', async (_req: Request, res: Response) => {
  try {
    const { getIngestionDashboard } = await import(
      '../../core/knowledge/debug/ingestionDashboard.service.js'
    );
    const dashboard = await getIngestionDashboard();
    res.json(dashboard);
  } catch (err) {
    console.error('[Debug API] /ingestion error:', err);
    res.json(FALLBACK_INGESTION);
  }
});

// ---------------------------------------------------------------------------
// GET /debug/retrieval?q=<query>
// ---------------------------------------------------------------------------
router.get('/retrieval', async (req: Request, res: Response) => {
  const query = String(req.query.q ?? '');

  if (!query.trim()) {
    res.json({ error: 'Missing query parameter ?q=', results: [] });
    return;
  }

  try {
    const { debugRetrieval } = await import(
      '../../core/knowledge/debug/retrievalDebugger.service.js'
    );
    const results: RetrievalDebugResult[] = await debugRetrieval(query);
    res.json({ query, results });
  } catch (err) {
    console.error('[Debug API] /retrieval error:', err);
    res.json({ query, results: [] });
  }
});

// ---------------------------------------------------------------------------
// GET /debug/chunks?documentId=<id>
// ---------------------------------------------------------------------------
router.get('/chunks', async (req: Request, res: Response) => {
  const documentId = String(req.query.documentId ?? '');

  if (!documentId.trim()) {
    res.json({ error: 'Missing query parameter ?documentId=', chunks: [] });
    return;
  }

  try {
    const { visualizeChunks } = await import(
      '../../core/knowledge/debug/chunkVisualizer.service.js'
    );
    const chunks: ChunkVisualization[] = await visualizeChunks(documentId);
    res.json({ documentId, chunks });
  } catch (err) {
    console.error('[Debug API] /chunks error:', err);
    res.json({ documentId, chunks: [] });
  }
});

// ---------------------------------------------------------------------------
// GET /debug/rag-trace?q=<query>
// ---------------------------------------------------------------------------
router.get('/rag-trace', async (req: Request, res: Response) => {
  const query = String(req.query.q ?? '');

  if (!query.trim()) {
    res.json({ error: 'Missing query parameter ?q=', trace: null });
    return;
  }

  try {
    const { traceRAG } = await import(
      '../../core/knowledge/debug/ragTrace.service.js'
    );
    const trace = await traceRAG(query);
    res.json({ query, trace });
  } catch (err) {
    console.error('[Debug API] /rag-trace error:', err);
    res.json({ query, trace: null });
  }
});

export default router;

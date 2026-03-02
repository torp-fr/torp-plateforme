/**
 * Express HTTP Server for TORP RAG Worker
 * Runs in parallel with the RAG worker process
 * Provides health check and API endpoints for manual obligation extraction
 */

import express from 'express';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { extractObligationsFromChunk } from './engines/obligationExtractionEngine.js';

// ============================================================================
// CONSTANTS & SETUP
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 8080;

// ============================================================================
// INITIALIZE EXPRESS APP
// ============================================================================

const app = express();

// Middleware
app.use(express.json());

// ============================================================================
// INITIALIZE SUPABASE & OPENAI CLIENTS
// ============================================================================

let supabaseClient = null;
let openaiClient = null;

function initializeClients() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️  Supabase credentials not configured - API routes will fail');
    return false;
  }

  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️  OpenAI API key not configured - API routes will fail');
    return false;
  }

  supabaseClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  return true;
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * Health check endpoint
 * GET /
 */
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'TORP RAG Server',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Test obligation extraction endpoint
 * POST /api/test-obligation
 *
 * Request body:
 * {
 *   "chunk_id": "string",
 *   "document_id": "string" (optional, defaults to predefined value)
 * }
 */
app.post('/api/test-obligation', async (req, res) => {
  try {
    const { chunk_id, document_id } = req.body;

    // Validate input
    if (!chunk_id || typeof chunk_id !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'chunk_id is required (string)',
      });
    }

    // Check clients initialized
    if (!supabaseClient || !openaiClient) {
      return res.status(503).json({
        success: false,
        error: 'Server dependencies not initialized. Check environment variables.',
      });
    }

    console.log(`🔍 Processing obligation extraction for chunk: ${chunk_id}`);

    // Load chunk from Supabase
    const { data: chunk, error: loadError } = await supabaseClient
      .from('knowledge_chunks')
      .select('*')
      .eq('id', chunk_id)
      .single();

    if (loadError || !chunk) {
      return res.status(404).json({
        success: false,
        error: `Chunk not found: ${loadError?.message || 'Unknown error'}`,
      });
    }

    console.log(`✅ Chunk loaded (${chunk.content?.length || 0} characters)`);

    // Use provided document_id or fallback to chunk's document_id
    const finalDocumentId = document_id || chunk.document_id;

    if (!finalDocumentId) {
      return res.status(400).json({
        success: false,
        error: 'document_id not provided and chunk has no associated document_id',
      });
    }

    // Extract obligations
    console.log('🧠 Extracting obligations...');

    const result = await extractObligationsFromChunk(
      chunk,
      finalDocumentId,
      supabaseClient,
      openaiClient,
      {
        logger: null, // Use default logger
      }
    );

    console.log(`✅ Extraction completed: ${result.inserted_count} obligations inserted`);

    // Return result
    return res.status(200).json({
      success: true,
      chunk_id,
      document_id: finalDocumentId,
      inserted_count: result.inserted_count,
      obligations: result.obligations || [],
      statistics: result.statistics || null,
      timestamp: result.timestamp,
      duration: result.duration,
    });
  } catch (error) {
    console.error('❌ Obligation extraction failed:', error.message);

    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

// ============================================================================
// START WORKER PROCESS
// ============================================================================

/**
 * Start the RAG worker as a background process
 * The worker will run continuously and poll for pending documents
 */
function startWorkerProcess() {
  try {
    const workerPath = path.join(__dirname, '..', 'rag-worker', 'worker.js');

    console.log(`🚀 Starting RAG worker: ${workerPath}`);

    const workerProcess = spawn('node', [workerPath], {
      cwd: path.dirname(workerPath),
      stdio: ['inherit', 'inherit', 'inherit'],
      detached: false,
    });

    // Handle worker process events
    workerProcess.on('error', (error) => {
      console.error('❌ Worker process error:', error.message);
    });

    workerProcess.on('exit', (code, signal) => {
      console.warn(`⚠️  Worker process exited with code ${code} (signal: ${signal})`);
    });

    console.log(`✅ Worker process started (PID: ${workerProcess.pid})`);

    return workerProcess;
  } catch (error) {
    console.error('❌ Failed to start worker process:', error.message);
    return null;
  }
}

// ============================================================================
// ASYNC INITIALIZATION & SERVER START
// ============================================================================

async function initialize() {
  try {
    console.log('\n🔧 Initializing server...\n');

    // Initialize clients
    const clientsReady = initializeClients();
    if (clientsReady) {
      console.log('✅ Supabase and OpenAI clients initialized');
    }

    // Start worker in background (async, non-blocking)
    const workerProcess = startWorkerProcess();

    // Start Express server
    app.listen(PORT, () => {
      console.log(`\n✅ Express server running on http://localhost:${PORT}`);
      console.log(`📝 Routes:`);
      console.log(`   GET  / - Health check`);
      console.log(`   POST /api/test-obligation - Extract obligations from chunk`);
      console.log(`\n🎯 Server ready!\n`);
    });

    return { app, workerProcess };
  } catch (error) {
    console.error('❌ Initialization failed:', error.message);
    process.exit(1);
  }
}

// Start the server
initialize();

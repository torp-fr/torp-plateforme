/**
 * Temporary Test Server
 *
 * Simple HTTP server for testing obligation extraction endpoint
 * No external dependencies - uses native Node.js HTTP module
 *
 * Usage: node server.js
 *
 * Endpoint: POST /api/test-obligation
 *
 * Required environment variables:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - OPENAI_API_KEY
 */

import http from 'http';
import { testObligationRoute } from './src/routes/testObligationRoute.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const PORT = process.env.PORT || 3000;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Parse JSON body from request
 */
async function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Send JSON response
 */
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * Create Express-like request/response adapter
 */
function createAdapter(req, res) {
  // Mock Express-like request object
  const mockReq = {
    method: req.method,
    url: req.url,
    headers: req.headers,
    json: async () => parseRequestBody(req),
  };

  // Mock Express-like response object
  const mockRes = {
    status: (code) => {
      mockRes.statusCode = code;
      return mockRes;
    },
    json: (data) => {
      res.writeHead(mockRes.statusCode || 200, {
        'Content-Type': 'application/json',
      });
      res.end(JSON.stringify(data));
    },
    statusCode: 200,
  };

  return { mockReq, mockRes };
}

// ============================================================================
// REQUEST ROUTING
// ============================================================================

async function handleRequest(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;

  try {
    // Health check endpoint
    if (method === 'GET' && pathname === '/health') {
      sendJSON(res, 200, {
        status: 'ok',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Test obligation extraction endpoint
    if (method === 'POST' && pathname === '/api/test-obligation') {
      const { mockReq, mockRes } = createAdapter(req, res);
      await testObligationRoute(mockReq, mockRes);
      return;
    }

    // 404 Not Found
    sendJSON(res, 404, {
      success: false,
      error: 'Endpoint not found',
      availableEndpoints: [
        'GET /health',
        'POST /api/test-obligation',
      ],
    });
  } catch (error) {
    console.error('💥 Request error:', error);
    sendJSON(res, 500, {
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}

// ============================================================================
// START SERVER
// ============================================================================

const server = http.createServer(handleRequest);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
🚀 Test Server Started
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Port: ${PORT}
Health Check: http://localhost:${PORT}/health
Test Endpoint: POST http://localhost:${PORT}/api/test-obligation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Environment Variables Required:
✓ SUPABASE_URL
✓ SUPABASE_SERVICE_ROLE_KEY
✓ OPENAI_API_KEY

Example:
  export SUPABASE_URL="..."
  export SUPABASE_SERVICE_ROLE_KEY="..."
  export OPENAI_API_KEY="..."
  node server.js

  curl -X POST http://localhost:${PORT}/api/test-obligation
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📍 SIGTERM received, shutting down gracefully');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('📍 SIGINT received, shutting down gracefully');
  server.close(() => process.exit(0));
});

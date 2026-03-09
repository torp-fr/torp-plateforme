/**
 * End-to-End Ingestion Pipeline Test
 *
 * ARCHITECTURE:
 *   1. Load test documents from disk
 *   2. Upload files to Supabase Storage
 *   3. Create document records in knowledge_documents (caller owns this step)
 *   4. Call ingestKnowledgeDocument({ documentId, filename, buffer })
 *      — the ingestion service NEVER creates documents; it only inserts chunks
 *   5. Verify chunks were created
 *   6. Perform RAG semantic search
 *
 * REPORTING:
 *   Success = chunks were created, regardless of non-blocking failures (indexing, dedup)
 *
 * Usage:
 *   npx tsx scripts/testFullIngestion.ts
 *
 * Requirements:
 *   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

// Service-role client — bypasses RLS but FK constraints still apply
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ============================================================================
// Test Configuration
// ============================================================================

interface TestDocument {
  name: string;
  path: string;
  category: string;
  title: string;
}

const TEST_DOCUMENTS: TestDocument[] = [
  {
    name: 'sample.txt',
    path: 'test/data/sample.txt',
    category: 'manuel',
    title: 'Guide de Construction - Ouvrages en Béton Armé',
  },
  {
    name: 'sample.md',
    path: 'test/data/sample.md',
    category: 'norme',
    title: 'DTU 21 - Charpentes en Acier',
  },
  {
    name: 'pricing.csv',
    path: 'test/data/pricing.csv',
    category: 'fiche_technique',
    title: 'Prix Unitaires - Éléments de Construction',
  },
];

// ============================================================================
// Logging Utilities
// ============================================================================

function log(stage: string, message: string, data?: any) {
  const prefix = `[${new Date().toISOString()}] [${stage}]`;
  console.log(`${prefix} ${message}`);
  if (data !== undefined) console.log(`  → ${JSON.stringify(data, null, 2)}`);
}

function success(message: string, data?: any) {
  console.log(`✅ ${message}`);
  if (data !== undefined) console.log(`   ${JSON.stringify(data, null, 2)}`);
}

function fail(message: string, err?: any) {
  console.error(`❌ ${message}`);
  if (err) console.error(`   Error: ${err?.message ?? err}`);
}

function divider(title?: string) {
  console.log('\n' + '='.repeat(80));
  if (title) { console.log(`  ${title}`); console.log('='.repeat(80)); }
}

// ============================================================================
// Stage 0: Resolve a valid user ID for created_by
// ============================================================================

/**
 * Fetch the first user from auth.users so we can satisfy the fk_created_by
 * foreign key constraint.  Returns null if no users exist (the FK column is
 * nullable so null is a valid value and will NOT trigger the constraint).
 */
async function getSystemUserId(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1, page: 1 });
    if (error || !data?.users?.length) {
      console.warn('[SYSTEM_USER] No users found in auth.users — using null for created_by');
      return null;
    }
    const userId = data.users[0].id;
    log('SYSTEM_USER', `Using user ID for created_by: ${userId}`);
    return userId;
  } catch (err) {
    console.warn('[SYSTEM_USER] Could not query auth.users:', err);
    return null;
  }
}

// ============================================================================
// Stage 1: Load Documents from disk
// ============================================================================

async function loadTestDocuments(): Promise<Map<string, Buffer>> {
  divider('STAGE 1 — LOAD TEST DOCUMENTS');

  const documents = new Map<string, Buffer>();

  for (const doc of TEST_DOCUMENTS) {
    try {
      const fullPath = path.join(process.cwd(), doc.path);

      if (!fs.existsSync(fullPath)) {
        fail(`File not found: ${fullPath}`);
        continue;
      }

      const buffer = fs.readFileSync(fullPath);
      documents.set(doc.name, buffer);

      log('LOAD', `Loaded: ${doc.name}`, {
        size: `${(buffer.length / 1024).toFixed(2)} KB`,
        path: fullPath,
      });
    } catch (err) {
      fail(`Failed to load ${doc.name}`, err);
    }
  }

  success(`Loaded ${documents.size}/${TEST_DOCUMENTS.length} documents`);
  return documents;
}

// ============================================================================
// Stage 2: Upload files to Storage
// ============================================================================

async function uploadToStorage(
  documents: Map<string, Buffer>
): Promise<Map<string, string>> {
  divider('STAGE 2 — UPLOAD TO STORAGE');

  const uploads = new Map<string, string>();

  for (const [name, buffer] of documents.entries()) {
    try {
      const fileName = `test/${Date.now()}-${name}`;

      const { error: uploadError } = await supabase.storage
        .from('knowledge-files')
        .upload(fileName, buffer);

      if (uploadError) {
        fail(`Upload failed: ${name}`, uploadError);
        continue;
      }

      uploads.set(name, fileName);
      log('UPLOAD', `Stored at: ${fileName}`, { size: `${(buffer.length / 1024).toFixed(2)} KB` });
    } catch (err) {
      fail(`Failed to upload ${name}`, err);
    }
  }

  success(`Uploaded ${uploads.size}/${documents.size} documents`);
  return uploads;
}

// ============================================================================
// Stage 3: Create document records in knowledge_documents
//
// ARCHITECTURE RULE: ONLY the caller (this script or the API) may INSERT into
// knowledge_documents.  The ingestion service is strictly READ-ONLY for this
// table.
// ============================================================================

async function insertDocumentMetadata(
  uploads: Map<string, string>,
  documents: Map<string, Buffer>,
  systemUserId: string | null
): Promise<Map<string, string>> {
  divider('STAGE 3 — CREATE DOCUMENT RECORDS');

  const documentIds = new Map<string, string>();

  for (const testDoc of TEST_DOCUMENTS) {
    if (!uploads.has(testDoc.name)) continue;

    const buffer = documents.get(testDoc.name);
    const storagePath = uploads.get(testDoc.name)!;

    try {
      const insertPayload: Record<string, any> = {
        title: testDoc.title,
        category: testDoc.category,
        source: 'internal',          // valid value per schema constraints
        version: '1.0',
        file_path: storagePath,
        file_size: buffer?.length ?? 0,
        // created_by: use a real auth.users UUID to satisfy fk_created_by.
        // NULL is also valid (nullable FK column, null bypasses FK check).
        created_by: systemUserId,
        ingestion_status: 'pending', // starts the step-runner state machine
      };

      const { data, error: insertError } = await supabase
        .from('knowledge_documents')
        .insert([insertPayload])
        .select('id')
        .single();

      if (insertError || !data) {
        fail(`Insert failed for ${testDoc.name}`, insertError);
        continue;
      }

      documentIds.set(testDoc.name, data.id);
      log('METADATA', `Created document record: ${data.id}`, {
        title: testDoc.title,
        category: testDoc.category,
        created_by: systemUserId ?? 'null (no FK violation for nullable column)',
      });
    } catch (err) {
      fail(`Failed to insert metadata for ${testDoc.name}`, err);
    }
  }

  success(`Created ${documentIds.size}/${TEST_DOCUMENTS.length} document records`);
  return documentIds;
}

// ============================================================================
// Stage 4: Run ingestion pipeline
//
// ARCHITECTURE RULE: The ingestion service accepts { documentId, filename, buffer }.
// It NEVER creates documents.  It only extracts, chunks, and inserts knowledge_chunks.
//
// SUCCESS DEFINITION:
// Success = chunks were created, regardless of non-blocking failures (indexing, dedup)
// Example: If 30 chunks inserted successfully but indexing failed, that's STILL SUCCESS.
// ============================================================================

async function runIngestionPipeline(
  documents: Map<string, Buffer>,
  documentIds: Map<string, string>
): Promise<Map<string, { chunkCount: number; tokens: number; errors?: string[] }>> {
  divider('STAGE 4 — RUN INGESTION PIPELINE');

  const { ingestKnowledgeDocument } = await import(
    '@/core/knowledge/ingestion/knowledgeIngestion.service'
  );

  const results = new Map<string, { chunkCount: number; tokens: number; errors?: string[] }>();

  for (const testDoc of TEST_DOCUMENTS) {
    if (!documents.has(testDoc.name) || !documentIds.has(testDoc.name)) {
      fail(`Skipping ${testDoc.name} — missing buffer or document ID`);
      continue;
    }

    const buffer = documents.get(testDoc.name)!;
    const documentId = documentIds.get(testDoc.name)!;

    try {
      log('INGESTION', `Processing: ${testDoc.name}`, { documentId });

      const startTime = Date.now();

      // ── CORRECT API: pass { documentId, filename, buffer } ──────────────────
      // The service NEVER creates a document record.  It reads the pre-existing
      // document row (identified by documentId) and inserts chunks only.
      const result = await ingestKnowledgeDocument({
        documentId,
        filename: testDoc.name,
        buffer,
      });

      const duration = Date.now() - startTime;

      // ── SUCCESS LOGIC: based on chunks created, not on result.success ────────
      // Non-blocking operations (indexing, dedup) might fail, but if chunks
      // were inserted successfully, the ingestion succeeded.
      const chunksCreated = result?.chunksCreated ?? 0;
      const tokensGenerated = result?.totalTokens ?? 0;

      if (chunksCreated > 0) {
        // SUCCESS: chunks were created
        log('INGESTION', `✅ Success: ${testDoc.name}`, {
          documentId: result?.documentId,
          chunks: chunksCreated,
          tokens: tokensGenerated,
          duration: `${duration}ms`,
        });

        results.set(testDoc.name, {
          chunkCount: chunksCreated,
          tokens: tokensGenerated,
        });
      } else {
        // FAILURE: no chunks created
        const errorMsg = result?.errors?.[0] || 'No chunks created';
        fail(`Ingestion failed: ${testDoc.name}`, { error: errorMsg });

        results.set(testDoc.name, {
          chunkCount: 0,
          tokens: 0,
          errors: result?.errors || [errorMsg],
        });
      }
    } catch (err) {
      fail(`Ingestion pipeline error: ${testDoc.name}`, err);
      results.set(testDoc.name, {
        chunkCount: 0,
        tokens: 0,
        errors: [err instanceof Error ? err.message : String(err)],
      });
    }
  }

  // Count successes (documents with chunks created)
  const successCount = Array.from(results.values()).filter(r => r.chunkCount > 0).length;
  success(`Ingestion complete: ${successCount}/${TEST_DOCUMENTS.length} documents processed`);
  return results;
}

// ============================================================================
// Stage 5: Query chunks
// ============================================================================

async function queryChunks(): Promise<{ total: number; avgTokens: number; samples: any[] }> {
  divider('STAGE 5 — QUERY CHUNKS');

  try {
    const { data: chunks, error: queryError } = await supabase
      .from('knowledge_chunks')
      .select('id, document_id, content, token_count, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (queryError) {
      fail('Failed to query chunks', queryError);
      return { total: 0, avgTokens: 0, samples: [] };
    }

    const totalTokens = chunks?.reduce((sum, c) => sum + (c.token_count || 0), 0) ?? 0;
    const avgTokens = chunks?.length ? totalTokens / chunks.length : 0;

    log('CHUNKS', 'Query results', { total: chunks?.length ?? 0, avgTokens: avgTokens.toFixed(1) });

    const samples = (chunks ?? []).slice(0, 3).map((c) => ({
      id: c.id,
      tokens: c.token_count,
      preview: c.content.substring(0, 80).replace(/\n/g, ' ') + '...',
    }));

    samples.forEach((s, i) => log('SAMPLE', `[${i + 1}] ${s.preview}`, { tokens: s.tokens }));

    return { total: chunks?.length ?? 0, avgTokens: Number(avgTokens.toFixed(1)), samples };
  } catch (err) {
    fail('Query failed', err);
    return { total: 0, avgTokens: 0, samples: [] };
  }
}

// ============================================================================
// Stage 6: Semantic Search (RAG Test)
// ============================================================================

async function performSemanticSearch(): Promise<any[]> {
  divider('STAGE 6 — SEMANTIC SEARCH TEST');

  try {
    const { semanticSearch } = await import('@/core/knowledge/ingestion/knowledgeIndex.service');

    const testQueries = [
      'béton armé fondations',
      'acier structure',
      'prix unitaires construction',
    ];

    const allResults: any[] = [];

    for (const query of testQueries) {
      try {
        log('SEARCH', `Query: "${query}"`);
        const results = await semanticSearch(query, 5);
        log('SEARCH', `Found ${results.length} results`, { query });

        results.forEach((r, i) => {
          const preview = r.content.substring(0, 60).replace(/\n/g, ' ');
          log('RESULT', `[${i + 1}] ${preview}...`, { similarity: r.similarity.toFixed(3) });
          allResults.push({ query, rank: i + 1, similarity: r.similarity, preview });
        });
      } catch (searchErr) {
        fail(`Search failed for query: "${query}"`, searchErr);
      }
    }

    success(`Semantic search complete with ${allResults.length} results`);
    return allResults;
  } catch (err) {
    fail('Semantic search failed', err);
    return [];
  }
}

// ============================================================================
// Summary Report
// ============================================================================

function generateSummaryReport(
  ingestionResults: Map<string, any>,
  chunkStats: any,
  searchResults: any[]
) {
  divider('SUMMARY REPORT');

  console.log('\n📊 INGESTION PIPELINE METRICS\n');

  let totalChunks = 0;
  let totalTokens = 0;
  let successCount = 0;
  let failureCount = 0;

  ingestionResults.forEach((result, docName) => {
    // Success = chunks were created
    const isSuccess = result.chunkCount > 0;
    const status = isSuccess ? '✅' : '❌';

    console.log(`${status} ${docName}`);
    console.log(`   Chunks: ${result.chunkCount} | Tokens: ${result.tokens}`);

    if (isSuccess) {
      successCount++;
      totalChunks += result.chunkCount;
      totalTokens += result.tokens;
    } else {
      failureCount++;
      if (result.errors) {
        console.log(`   Errors: ${result.errors.join(', ')}`);
      }
    }
  });

  console.log('\n📈 OVERALL STATISTICS\n');
  console.log(`Documents processed: ${successCount}/${TEST_DOCUMENTS.length}`);
  console.log(`Documents failed: ${failureCount}/${TEST_DOCUMENTS.length}`);
  console.log(`Total chunks created: ${chunkStats.total}`);
  console.log(`Average tokens per chunk: ${chunkStats.avgTokens}`);

  console.log('\n🔍 SEMANTIC SEARCH RESULTS\n');

  if (searchResults.length === 0) {
    console.log('⚠️  No semantic search results (embeddings may still be pending)');
  } else {
    const byQuery = new Map<string, any[]>();
    searchResults.forEach((r) => {
      if (!byQuery.has(r.query)) byQuery.set(r.query, []);
      byQuery.get(r.query)!.push(r);
    });
    byQuery.forEach((results, query) => {
      console.log(`Query: "${query}"`);
      results.forEach((r) => console.log(`  [${r.rank}] similarity: ${(r.similarity * 100).toFixed(1)}%`));
    });
  }

  console.log('\n✨ TEST COMPLETE\n');
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════════════════╗');
  console.log('║          END-TO-END RAG INGESTION PIPELINE TEST                      ║');
  console.log('║                                                                       ║');
  console.log('║  Architecture: Caller creates documents → Ingestion inserts chunks   ║');
  console.log('║  Success: Based on chunks created, not on non-blocking operations    ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');

  try {
    // Stage 0: Resolve system user for created_by
    const systemUserId = await getSystemUserId();

    // Stage 1: Load documents
    const documents = await loadTestDocuments();
    if (documents.size === 0) { fail('No documents loaded. Aborting.'); process.exit(1); }

    // Stage 2: Upload to storage
    const uploads = await uploadToStorage(documents);
    if (uploads.size === 0) { fail('No documents uploaded. Aborting.'); process.exit(1); }

    // Stage 3: Create document records (caller's responsibility — NOT the ingestion service)
    const documentIds = await insertDocumentMetadata(uploads, documents, systemUserId);
    if (documentIds.size === 0) { fail('No document records created. Aborting.'); process.exit(1); }

    // Stage 4: Run ingestion (chunks only — no document creation inside service)
    const ingestionResults = await runIngestionPipeline(documents, documentIds);

    // Stage 5: Verify chunks
    const chunkStats = await queryChunks();

    // Stage 6: Semantic search
    const searchResults = await performSemanticSearch();

    // Summary
    generateSummaryReport(ingestionResults, chunkStats, searchResults);
  } catch (err) {
    fail('Test execution failed', err);
    process.exit(1);
  }
}

main().catch((err) => { fail('Uncaught error', err); process.exit(1); });

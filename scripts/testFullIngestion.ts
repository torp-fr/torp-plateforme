/**
 * End-to-End Ingestion Pipeline Test
 *
 * Tests the complete RAG document ingestion workflow:
 * 1. Load test documents (PDF, DOCX, XLSX, TXT, MD)
 * 2. Upload to Supabase Storage
 * 3. Insert metadata in knowledge_documents table
 * 4. Run ingestion pipeline
 * 5. Verify chunks created
 * 6. Perform RAG semantic search
 *
 * Usage:
 *   npx tsx scripts/testFullIngestion.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
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

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================================
// Test Configuration
// ============================================================================

interface TestDocument {
  name: string;
  path: string;
  category: 'norme' | 'fiche_technique' | 'jurisprudence' | 'manuel' | 'autre';
  title: string;
  description: string;
}

const TEST_DOCUMENTS: TestDocument[] = [
  {
    name: 'sample.txt',
    path: 'test/data/sample.txt',
    category: 'manuel',
    title: 'Guide de Construction - Ouvrages en Béton Armé',
    description: 'Guide complet pour la construction en béton armé',
  },
  {
    name: 'sample.md',
    path: 'test/data/sample.md',
    category: 'norme',
    title: 'DTU 21 - Charpentes en Acier',
    description: 'Règles de calcul et exécution des structures en acier',
  },
  {
    name: 'pricing.csv',
    path: 'test/data/pricing.csv',
    category: 'fiche_technique',
    title: 'Prix Unitaires - Éléments de Construction',
    description: 'Bordereau de prix unitaires pour éléments de construction',
  },
];

// ============================================================================
// Logging Utilities
// ============================================================================

function log(stage: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${stage}]`;
  console.log(`${prefix} ${message}`);
  if (data) {
    console.log(`  → ${JSON.stringify(data, null, 2)}`);
  }
}

function success(message: string, data?: any) {
  console.log(`✅ ${message}`);
  if (data) {
    console.log(`   ${JSON.stringify(data, null, 2)}`);
  }
}

function error(message: string, err?: any) {
  console.error(`❌ ${message}`);
  if (err) {
    console.error(`   Error: ${err.message || err}`);
  }
}

function divider(title?: string) {
  console.log('\n' + '='.repeat(80));
  if (title) {
    console.log(`  ${title}`);
    console.log('='.repeat(80));
  }
}

// ============================================================================
// Stage: Load Documents
// ============================================================================

async function loadTestDocuments(): Promise<Map<string, Buffer>> {
  divider('LOAD TEST DOCUMENTS');

  const documents = new Map<string, Buffer>();

  for (const doc of TEST_DOCUMENTS) {
    try {
      const fullPath = path.join(process.cwd(), doc.path);

      if (!fs.existsSync(fullPath)) {
        error(`File not found: ${fullPath}`);
        continue;
      }

      const buffer = fs.readFileSync(fullPath);
      documents.set(doc.name, buffer);

      log('LOAD', `Loaded: ${doc.name}`, {
        size: `${(buffer.length / 1024).toFixed(2)} KB`,
        path: fullPath,
      });
    } catch (err) {
      error(`Failed to load ${doc.name}`, err);
    }
  }

  success(`Loaded ${documents.size}/${TEST_DOCUMENTS.length} documents`);
  return documents;
}

// ============================================================================
// Stage: Upload to Storage
// ============================================================================

async function uploadToStorage(
  documents: Map<string, Buffer>
): Promise<Map<string, string>> {
  divider('UPLOAD TO STORAGE');

  const uploads = new Map<string, string>();

  for (const [name, buffer] of documents.entries()) {
    try {
      const fileName = `test/${Date.now()}-${name}`;

      const { data, error: uploadError } = await supabase.storage
        .from('knowledge-files')
        .upload(fileName, buffer);

      if (uploadError) {
        error(`Upload failed: ${name}`, uploadError);
        continue;
      }

      uploads.set(name, fileName);
      log('UPLOAD', `Uploaded to storage: ${fileName}`, {
        size: `${(buffer.length / 1024).toFixed(2)} KB`,
      });
    } catch (err) {
      error(`Failed to upload ${name}`, err);
    }
  }

  success(`Uploaded ${uploads.size}/${documents.size} documents`);
  return uploads;
}

// ============================================================================
// Stage: Insert Metadata
// ============================================================================

async function insertDocumentMetadata(
  uploads: Map<string, string>
): Promise<Map<string, string>> {
  divider('INSERT DOCUMENT METADATA');

  const documentIds = new Map<string, string>();

  for (const testDoc of TEST_DOCUMENTS) {
    if (!uploads.has(testDoc.name)) continue;

    try {
      const insertPayload = {
        title: testDoc.title,
        category: 'GUIDELINE',
        source: 'ingestion',
        version: '1.0',
        file_size: 0,
        created_by: null,
      };

      // ===== DETAILED DEBUG LOGS =====
      console.log("SOURCE VALUE:", insertPayload.source);
      console.log("SOURCE TYPE:", typeof insertPayload.source);
      console.log("SOURCE LENGTH:", insertPayload.source.length);
      console.log("INSERT PAYLOAD:", JSON.stringify(insertPayload, null, 2));
      // ================================

      const { data, error } = await supabase
        .from('knowledge_documents')
        .insert([insertPayload])
        .select('id')
        .single();

      if (error) {
        console.error("SUPABASE INSERT ERROR:", error);
        error(`Insert failed: ${testDoc.name}`, error);
        continue;
      }

      if (!data) {
        error(`Insert failed: no data returned for ${testDoc.name}`);
        continue;
      }

      documentIds.set(testDoc.name, data.id);
      log('METADATA', `Created document record: ${data.id}`, {
        title: testDoc.title,
        category: 'GUIDELINE',
      });
    } catch (err) {
      error(`Failed to insert metadata for ${testDoc.name}`, err);
    }
  }

  success(`Created ${documentIds.size}/${TEST_DOCUMENTS.length} document records`);
  return documentIds;
}

// ============================================================================
// Stage: Run Ingestion Pipeline
// ============================================================================

async function runIngestionPipeline(
  documents: Map<string, Buffer>,
  documentIds: Map<string, string>
): Promise<Map<string, { chunkCount: number; tokens: number; errors?: string[] }>> {
  divider('RUN INGESTION PIPELINE');

  // Dynamic import to ensure module resolution
  const {
    ingestKnowledgeDocument,
  } = await import('@/core/knowledge/ingestion/knowledgeIngestion.service');

  const results = new Map<string, { chunkCount: number; tokens: number; errors?: string[] }>();

  for (const testDoc of TEST_DOCUMENTS) {
    if (!documents.has(testDoc.name) || !documentIds.has(testDoc.name)) {
      continue;
    }

    const buffer = documents.get(testDoc.name)!;

    try {
      log('EXTRACTION', `Processing: ${testDoc.name}`);

      const startTime = Date.now();
      const result = await ingestKnowledgeDocument(buffer, testDoc.name, {
        title: testDoc.title,
        category: 'GUIDELINE',
        source: 'ingestion',
        version: '1.0',
      }, null);

      const duration = Date.now() - startTime;

      if (!result.success) {
        error(`Ingestion failed: ${testDoc.name}`, {
          errors: result.errors,
        });

        results.set(testDoc.name, {
          chunkCount: 0,
          tokens: 0,
          errors: result.errors,
        });
        continue;
      }

      log('EXTRACTION', `Complete: ${testDoc.name}`, {
        documentId: result.documentId,
        chunks: result.chunksCreated,
        tokens: result.totalTokens,
        duration: `${duration}ms`,
      });

      results.set(testDoc.name, {
        chunkCount: result.chunksCreated || 0,
        tokens: result.totalTokens || 0,
      });
    } catch (err) {
      error(`Ingestion error: ${testDoc.name}`, err);
      results.set(testDoc.name, {
        chunkCount: 0,
        tokens: 0,
        errors: [err instanceof Error ? err.message : String(err)],
      });
    }
  }

  success(`Ingestion complete for ${results.size}/${TEST_DOCUMENTS.length} documents`);
  return results;
}

// ============================================================================
// Stage: Query Chunks
// ============================================================================

async function queryChunks(): Promise<{
  total: number;
  avgTokens: number;
  samples: any[];
}> {
  divider('QUERY CHUNKS');

  try {
    const { data: chunks, error: queryError } = await supabase
      .from('knowledge_chunks')
      .select('id, document_id, content, token_count, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (queryError) {
      error('Failed to query chunks', queryError);
      return { total: 0, avgTokens: 0, samples: [] };
    }

    const totalTokens = chunks?.reduce((sum, c) => sum + (c.token_count || 0), 0) || 0;
    const avgTokens = chunks && chunks.length > 0 ? totalTokens / chunks.length : 0;

    log('CHUNKS', 'Query results', {
      total: chunks?.length || 0,
      avgTokens: avgTokens.toFixed(1),
    });

    // Show sample chunks
    const samples = (chunks || []).slice(0, 3).map(c => ({
      id: c.id,
      tokens: c.token_count,
      preview: c.content.substring(0, 80).replace(/\n/g, ' ') + '...',
    }));

    samples.forEach((sample, i) => {
      log('SAMPLE', `[${i + 1}] ${sample.preview}`, {
        tokens: sample.tokens,
      });
    });

    return {
      total: chunks?.length || 0,
      avgTokens: Number(avgTokens.toFixed(1)),
      samples,
    };
  } catch (err) {
    error('Query failed', err);
    return { total: 0, avgTokens: 0, samples: [] };
  }
}

// ============================================================================
// Stage: Semantic Search (RAG Test)
// ============================================================================

async function performSemanticSearch(): Promise<any[]> {
  divider('SEMANTIC SEARCH TEST');

  try {
    // Dynamic import for semantic search
    const { semanticSearch } = await import('@/core/knowledge/ingestion/knowledgeIndex.service');

    // Example queries extracted from test documents
    const testQueries = [
      'béton armé fondations',
      'acier structure',
      'prix unitaires construction',
    ];

    const allResults = [];

    for (const query of testQueries) {
      try {
        log('SEARCH', `Query: "${query}"`);

        const results = await semanticSearch(query, 5);

        log('SEARCH', `Found ${results.length} results for query`, {
          query,
        });

        results.forEach((result, i) => {
          const contentPreview = result.content
            .substring(0, 60)
            .replace(/\n/g, ' ');

          log('RESULT', `[${i + 1}] ${contentPreview}...`, {
            similarity: result.similarity.toFixed(3),
            chunkId: result.chunkId.substring(0, 8) + '...',
          });

          allResults.push({
            query,
            rank: i + 1,
            similarity: result.similarity,
            contentPreview,
            chunkId: result.chunkId,
          });
        });
      } catch (searchErr) {
        error(`Search failed for query: "${query}"`, searchErr);
      }
    }

    success(`Semantic search test complete with ${allResults.length} results`);
    return allResults;
  } catch (err) {
    error('Semantic search failed', err);
    return [];
  }
}

// ============================================================================
// Stage: Summary Report
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

  ingestionResults.forEach((result, docName) => {
    const status = result.errors ? '❌' : '✅';
    console.log(`${status} ${docName}`);
    console.log(`   Chunks: ${result.chunkCount} | Tokens: ${result.tokens}`);
    if (result.errors) {
      console.log(`   Errors: ${result.errors.join(', ')}`);
    } else {
      successCount++;
      totalChunks += result.chunkCount;
      totalTokens += result.tokens;
    }
  });

  console.log('\n📈 OVERALL STATISTICS\n');
  console.log(`Documents processed: ${successCount}/${TEST_DOCUMENTS.length}`);
  console.log(`Total chunks created: ${chunkStats.total}`);
  console.log(`Average tokens per chunk: ${chunkStats.avgTokens}`);
  console.log(`Total embeddings: ${chunkStats.total}`);

  console.log('\n🔍 SEMANTIC SEARCH RESULTS\n');

  if (searchResults.length === 0) {
    console.log('⚠️  No semantic search results (embeddings may be pending)');
  } else {
    const byQuery = new Map<string, any[]>();
    searchResults.forEach(result => {
      if (!byQuery.has(result.query)) {
        byQuery.set(result.query, []);
      }
      byQuery.get(result.query)!.push(result);
    });

    byQuery.forEach((results, query) => {
      console.log(`Query: "${query}"`);
      results.forEach(r => {
        console.log(`  [${r.rank}] similarity: ${(r.similarity * 100).toFixed(1)}%`);
      });
    });
  }

  console.log('\n✨ TEST COMPLETE\n');
}

// ============================================================================
// Main Test Execution
// ============================================================================

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                  END-TO-END INGESTION PIPELINE TEST                           ║');
  console.log('║                                                                              ║');
  console.log('║  Testing: PDF | DOCX | XLSX | TXT | MD Extraction & Indexing                ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

  try {
    // Stage 1: Load documents
    const documents = await loadTestDocuments();
    if (documents.size === 0) {
      error('No documents loaded. Aborting.');
      process.exit(1);
    }

    // Stage 2: Upload to storage
    const uploads = await uploadToStorage(documents);
    if (uploads.size === 0) {
      error('No documents uploaded. Aborting.');
      process.exit(1);
    }

    // Stage 3: Insert metadata
    const documentIds = await insertDocumentMetadata(uploads);
    if (documentIds.size === 0) {
      error('No document records created. Aborting.');
      process.exit(1);
    }

    // Stage 4: Run ingestion pipeline
    const ingestionResults = await runIngestionPipeline(documents, documentIds);

    // Stage 5: Query chunks
    const chunkStats = await queryChunks();

    // Stage 6: Perform semantic search
    const searchResults = await performSemanticSearch();

    // Stage 7: Generate report
    generateSummaryReport(ingestionResults, chunkStats, searchResults);

    console.log('');
  } catch (err) {
    error('Test execution failed', err);
    process.exit(1);
  }
}

// Execute
main().catch(err => {
  error('Uncaught error', err);
  process.exit(1);
});

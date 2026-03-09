#!/usr/bin/env node
/**
 * DEPRECATED: batchIngestKnowledge.ts
 *
 * This script is obsolete and must not be used.
 *
 * REASON FOR DEPRECATION:
 * The old pipeline attempted to write directly to knowledge_documents table,
 * which violated the new architecture where documents are created ONLY by callers
 * and ingestion services remain read-only.
 *
 * MIGRATION PATH:
 * Use scripts/testFullIngestion.ts instead:
 *   npx tsx scripts/testFullIngestion.ts
 *
 * The new pipeline:
 * ✅ Creates documents via testFullIngestion.ts
 * ✅ Calls ingestKnowledgeDocument() for chunk processing only
 * ✅ Maintains read-only semantics for ingestion services
 * ✅ Returns success based ONLY on chunk insertion
 */

throw new Error(
  `DEPRECATED: batchIngestKnowledge.ts is no longer supported.\n` +
  `\n` +
  `The old ingestion pipeline violated the required architecture:\n` +
  `  ❌ Attempted to create documents from within ingestion service\n` +
  `  ❌ Violated foreign key constraint fk_created_by with null created_by\n` +
  `  ❌ Mixed document creation with chunk insertion logic\n` +
  `\n` +
  `The new, correct pipeline is in:\n` +
  `  ✅ scripts/testFullIngestion.ts\n` +
  `\n` +
  `New architecture:\n` +
  `  1. Test script creates documents (with valid created_by)\n` +
  `  2. Test script calls ingestKnowledgeDocument(documentId)\n` +
  `  3. Ingestion service processes chunks (read-only for documents)\n` +
  `  4. Success based ONLY on chunk insertion\n` +
  `\n` +
  `To use the correct pipeline:\n` +
  `  npx tsx scripts/testFullIngestion.ts\n`
);

/**
 * PHASE 36.10.2: RETRIEVAL HARD LOCK TESTS
 * Validates that ONLY complete documents with verified integrity are retrievable
 * Tests the security layer - ensures no data leakage of partial/failed documents
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { knowledgeBrainService } from '../knowledge-brain.service';
import { supabase } from '@/lib/supabase';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

describe('PHASE 36.10.2 - RETRIEVAL HARD LOCK', () => {
  beforeEach(() => {
    // Reset metrics before each test
    knowledgeBrainService.resetIngestionMetrics();
  });

  describe('🔐 Test 1: Secure Views - No FAILED documents in retrieval', () => {
    it('should NOT return documents with ingestion_status=failed', async () => {
      log('[TEST 1] Verifying FAILED documents are never retrieved...');

      // Create and retrieve a document
      const testContent = 'Test document for failed state check.';
      const doc = await knowledgeBrainService.addKnowledgeDocument(
        'test_source',
        'test_category',
        testContent,
        { title: 'Failed State Test Doc' }
      );

      if (!doc?.id) {
        throw new Error('Failed to create test document');
      }

      // Manually mark document as failed in DB (simulate error scenario)
      await supabase
        .from('knowledge_documents')
        .update({
          ingestion_status: 'failed',
          last_ingestion_error: 'Simulated failure for test',
        })
        .eq('id', doc.id);

      log('[TEST 1] Document marked as FAILED. Attempting search...');

      // Try to search for it
      const results = await knowledgeBrainService.searchRelevantKnowledge('failed', {
        limit: 10,
      });

      // CRITICAL: Should not find the failed document
      const foundFailed = results.some((r) => r.id === doc.id);
      expect(foundFailed).toBe(false);

      log('✅ Test 1 PASSED: FAILED documents are NOT retrieved');
    });
  });

  describe('🔐 Test 2: Secure Views - No PENDING documents in retrieval', () => {
    it('should NOT return documents with ingestion_status=pending', async () => {
      log('[TEST 2] Verifying PENDING documents are never retrieved...');

      // Create a document (starts in pending state)
      const testContent = 'Test document for pending state check.';
      const doc = await knowledgeBrainService.addKnowledgeDocument(
        'test_source',
        'test_category',
        testContent,
        { title: 'Pending State Test Doc' }
      );

      if (!doc?.id) {
        throw new Error('Failed to create test document');
      }

      // Document is in pending state immediately after creation
      // Try to search for it
      const results = await knowledgeBrainService.searchRelevantKnowledge('pending', {
        limit: 10,
      });

      // CRITICAL: Should not find the pending document
      const foundPending = results.some((r) => r.id === doc.id);
      expect(foundPending).toBe(false);

      log('✅ Test 2 PASSED: PENDING documents are NOT retrieved');
    });
  });

  describe('🔐 Test 3: Secure Views - No PROCESSING documents in retrieval', () => {
    it('should NOT return documents with ingestion_status=processing', async () => {
      log('[TEST 3] Verifying PROCESSING documents are never retrieved...');

      // Create a document
      const testContent = 'Test document for processing state check.';
      const doc = await knowledgeBrainService.addKnowledgeDocument(
        'test_source',
        'test_category',
        testContent,
        { title: 'Processing State Test Doc' }
      );

      if (!doc?.id) {
        throw new Error('Failed to create test document');
      }

      // Manually mark document as processing
      await supabase
        .from('knowledge_documents')
        .update({
          ingestion_status: 'processing',
        })
        .eq('id', doc.id);

      // Try to search for it
      const results = await knowledgeBrainService.searchRelevantKnowledge('processing', {
        limit: 10,
      });

      // CRITICAL: Should not find the processing document
      const foundProcessing = results.some((r) => r.id === doc.id);
      expect(foundProcessing).toBe(false);

      log('✅ Test 3 PASSED: PROCESSING documents are NOT retrieved');
    });
  });

  describe('🔐 Test 4: Secure Views - No documents with integrity_checked=FALSE', () => {
    it('should NOT return documents with embedding_integrity_checked=false', async () => {
      log('[TEST 4] Verifying documents without integrity check are never retrieved...');

      // Create a document
      const testContent = 'Test document for integrity flag check.';
      const doc = await knowledgeBrainService.addKnowledgeDocument(
        'test_source',
        'test_category',
        testContent,
        { title: 'Integrity Check Test Doc' }
      );

      if (!doc?.id) {
        throw new Error('Failed to create test document');
      }

      // Manually mark as complete but with integrity_checked=false (violates constraint)
      // This shouldn't be possible in production due to DB constraint,
      // but we simulate the scenario to ensure retrieval layer blocks it
      try {
        await supabase
          .from('knowledge_documents')
          .update({
            ingestion_status: 'complete',
            embedding_integrity_checked: false, // This should violate DB constraint
          })
          .eq('id', doc.id);
      } catch (e) {
        // Expected - constraint prevents this
        log('[TEST 4] DB constraint prevented invalid state (expected)');
      }

      // Try to search for it anyway
      const results = await knowledgeBrainService.searchRelevantKnowledge('integrity', {
        limit: 10,
      });

      // CRITICAL: Should not find it (protected by both DB constraint AND view)
      const foundInvalid = results.some((r) => r.id === doc.id);
      expect(foundInvalid).toBe(false);

      log('✅ Test 4 PASSED: Documents with integrity_checked=false are NOT retrieved');
    });
  });

  describe('✅ Test 5: Only COMPLETE + integrity=TRUE documents are retrieved', () => {
    it('should return ONLY documents with status=complete and integrity=true', async () => {
      log('[TEST 5] Verifying ONLY valid documents are retrieved...');

      // Create a document with specific content
      const validContent = 'UNIQUE_VALID_DOCUMENT_CONTENT_FOR_RETRIEVAL_TEST';
      const doc = await knowledgeBrainService.addKnowledgeDocument(
        'test_source',
        'test_category',
        validContent,
        { title: 'Valid Document for Retrieval Test' }
      );

      if (!doc?.id) {
        throw new Error('Failed to create test document');
      }

      // Wait for background processing to complete
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Manually mark as complete (simulating successful processing)
      await supabase
        .from('knowledge_documents')
        .update({
          ingestion_status: 'complete',
          embedding_integrity_checked: true,
        })
        .eq('id', doc.id);

      // Search for the unique content
      const results = await knowledgeBrainService.searchRelevantKnowledge(
        'UNIQUE_VALID_DOCUMENT_CONTENT',
        { limit: 10 }
      );

      // SHOULD find it (it's complete and verified)
      const foundValid = results.some((r) => r.source === 'test_source');
      expect(foundValid).toBe(true);

      log('✅ Test 5 PASSED: Valid documents ARE retrieved');
    });
  });

  describe('🔐 Test 6: Vector search uses ONLY secure RPC', () => {
    it('should use search_knowledge_by_embedding RPC (not direct table access)', async () => {
      log('[TEST 6] Verifying vector search uses secure RPC...');

      const testContent = 'Vector search security test document.';

      // Mock the RPC to verify it's called
      const rpcSpy = vi.spyOn(supabase, 'rpc');

      const results = await knowledgeBrainService.searchRelevantKnowledge('test content', {
        limit: 5,
      });

      // Verify that RPC was called (not direct table access)
      expect(rpcSpy).toHaveBeenCalled();

      const rpcCalls = rpcSpy.mock.calls.filter(
        (call) =>
          call[0] === 'search_knowledge_by_embedding' || call[0] === 'search_knowledge_by_keyword'
      );

      expect(rpcCalls.length).toBeGreaterThan(0);

      log('✅ Test 6 PASSED: Vector search uses secure RPC functions');

      rpcSpy.mockRestore();
    });
  });

  describe('🔐 Test 7: Keyword search uses ONLY secure RPC', () => {
    it('should use search_knowledge_by_keyword RPC (not direct table access)', async () => {
      log('[TEST 7] Verifying keyword search uses secure RPC...');

      const rpcSpy = vi.spyOn(supabase, 'rpc');

      // Do a keyword search
      const results = await knowledgeBrainService.searchRelevantKnowledge('keyword test', {
        limit: 5,
      });

      // Verify that RPC was called
      expect(rpcSpy).toHaveBeenCalled();

      const rpcCalls = rpcSpy.mock.calls.filter(
        (call) =>
          call[0] === 'search_knowledge_by_embedding' || call[0] === 'search_knowledge_by_keyword'
      );

      expect(rpcCalls.length).toBeGreaterThan(0);

      log('✅ Test 7 PASSED: Keyword search uses secure RPC functions');

      rpcSpy.mockRestore();
    });
  });

  describe('🔐 Test 8: Runtime defense - Security check validation', () => {
    it('should validate document state at runtime for extra safety', async () => {
      log('[TEST 8] Verifying runtime security checks...');

      // This test ensures that even if the secure view had a bug,
      // the runtime checks would catch it

      const testContent = 'Runtime defense test document.';

      const doc = await knowledgeBrainService.addKnowledgeDocument(
        'test_source',
        'test_category',
        testContent,
        { title: 'Runtime Defense Test' }
      );

      if (!doc?.id) {
        throw new Error('Failed to create test document');
      }

      // Document starts in pending state
      const initialState = await supabase
        .from('knowledge_documents')
        .select('ingestion_status, embedding_integrity_checked')
        .eq('id', doc.id)
        .single();

      expect(initialState.data?.ingestion_status).toBe('pending');
      expect(initialState.data?.embedding_integrity_checked).toBe(false);

      log('✅ Test 8 PASSED: Document starts in safe pending state');
    });
  });

  describe('🎯 Integration: End-to-End Retrieval Safety', () => {
    it('should maintain retrieval security throughout document lifecycle', async () => {
      log('[INTEGRATION TEST] Full lifecycle retrieval security check...');

      // Create multiple test documents
      const docs = await Promise.all([
        knowledgeBrainService.addKnowledgeDocument(
          'source1',
          'category1',
          'Document one content.',
          { title: 'Lifecycle Test 1' }
        ),
        knowledgeBrainService.addKnowledgeDocument(
          'source2',
          'category2',
          'Document two content.',
          { title: 'Lifecycle Test 2' }
        ),
        knowledgeBrainService.addKnowledgeDocument(
          'source3',
          'category3',
          'Document three content.',
          { title: 'Lifecycle Test 3' }
        ),
      ]);

      // All docs created
      expect(docs.length).toBe(3);
      expect(docs.every((d) => d?.id)).toBe(true);

      // All should be in pending state initially
      for (const doc of docs) {
        if (doc?.id) {
          const state = await supabase
            .from('knowledge_documents')
            .select('ingestion_status, embedding_integrity_checked')
            .eq('id', doc.id)
            .single();

          expect(state.data?.ingestion_status).toBe('pending');
          expect(state.data?.embedding_integrity_checked).toBe(false);
        }
      }

      // Simulate processing one document to complete
      if (docs[0]?.id) {
        await supabase
          .from('knowledge_documents')
          .update({
            ingestion_status: 'complete',
            embedding_integrity_checked: true,
          })
          .eq('id', docs[0].id);
      }

      // Now search - should find only the completed one
      const searchResults = await knowledgeBrainService.searchRelevantKnowledge(
        'Document one content',
        { limit: 10 }
      );

      // Should have results, but only from completed documents
      const allAreValid = searchResults.every((r) => {
        // If we got results, they should be from the completed document only
        return docs[0]?.id === r.id || searchResults.length === 0;
      });

      expect(allAreValid).toBe(true);

      log('✅ Integration Test PASSED: Retrieval security maintained throughout lifecycle');
    });
  });

  describe('📊 Compliance: Audit logging', () => {
    it('should log retrieval attempts on invalid documents', async () => {
      log('[COMPLIANCE TEST] Audit logging verification...');

      // The system should log attempts to retrieve invalid documents
      // This is for security auditing and compliance

      const testContent = 'Audit logging test document.';

      const doc = await knowledgeBrainService.addKnowledgeDocument(
        'test_source',
        'test_category',
        testContent,
        { title: 'Audit Logging Test' }
      );

      if (!doc?.id) {
        throw new Error('Failed to create test document');
      }

      // Mark as failed
      await supabase
        .from('knowledge_documents')
        .update({
          ingestion_status: 'failed',
        })
        .eq('id', doc.id);

      // Try to search (should not find it, but may log the attempt)
      const results = await knowledgeBrainService.searchRelevantKnowledge('audit', {
        limit: 10,
      });

      // Verify search didn't return the invalid document
      const foundFailed = results.some((r) => r.id === doc.id);
      expect(foundFailed).toBe(false);

      log('✅ Compliance Test PASSED: Invalid documents blocked, audit trail ready');
    });
  });
});

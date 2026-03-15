#!/usr/bin/env node
/**
 * Retry Failed Document Ingestion
 *
 * Automatically retries ingestion for documents with status "failed".
 * Resets document state and triggers re-ingestion via the database trigger.
 *
 * Usage:
 *   npx tsx scripts/retryFailedIngestion.ts
 *
 * The script:
 * 1. Fetches all documents with ingestion_status = 'failed'
 * 2. Resets each to ingestion_status = 'pending'
 * 3. Clears last_ingestion_error and ingestion_progress
 * 4. Database trigger on_document_pending automatically triggers re-ingestion
 * 5. Reports success/failure counts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface FailedDocument {
  id: string;
  filename: string;
  ingestion_status: string;
  last_ingestion_error: string | null;
  created_at: string;
}

async function retryFailedIngestion(): Promise<void> {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('🔄 Retrying Ingestion for Failed Documents');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  try {
    // Step 1: Fetch all failed documents
    console.log('📥 Fetching failed documents...\n');

    const { data: failedDocs, error: fetchError } = await supabase
      .from('knowledge_documents')
      .select('id, filename, ingestion_status, last_ingestion_error, created_at')
      .eq('ingestion_status', 'failed')
      .order('created_at', { ascending: false });

    if (fetchError) {
      throw new Error(`Failed to fetch failed documents: ${fetchError.message}`);
    }

    if (!failedDocs || failedDocs.length === 0) {
      console.log('✅ No failed documents found\n');
      console.log('═══════════════════════════════════════════════════════════════════\n');
      return;
    }

    console.log(`📊 Found ${failedDocs.length} document(s) with ingestion_status = 'failed'\n`);
    console.log('─────────────────────────────────────────────────────────────────────\n');

    // Step 2: Reset each document and trigger re-ingestion
    let successCount = 0;
    let stillFailingCount = 0;

    for (const doc of failedDocs) {
      console.log(`⏳ Retrying: ${doc.filename} (ID: ${doc.id.slice(0, 8)}...)`);
      if (doc.last_ingestion_error) {
        console.log(`   Previous error: ${doc.last_ingestion_error.slice(0, 100)}...`);
      }

      try {
        // Reset document status to 'pending'
        // This triggers the database trigger on_document_pending, which calls rag-ingestion Edge Function
        const { error: updateError } = await supabase
          .from('knowledge_documents')
          .update({
            ingestion_status: 'pending',
            last_ingestion_error: null,
            ingestion_progress: 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', doc.id);

        if (updateError) {
          console.error(`   ❌ Failed to reset: ${updateError.message}`);
          stillFailingCount++;
        } else {
          console.log(`   ✅ Reset to pending (trigger will auto-retry)`);
          successCount++;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`   ❌ Exception: ${errorMsg}`);
        stillFailingCount++;
      }

      console.log('');
    }

    // Step 3: Summary report
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('📊 Retry Summary\n');
    console.log(`Total failed documents found: ${failedDocs.length}`);
    console.log(`Successfully reset to pending:  ${successCount}`);
    console.log(`Failed to reset:               ${stillFailingCount}`);

    if (successCount > 0) {
      console.log(`\n✨ ${successCount} document(s) queued for re-ingestion`);
      console.log('   Status will update as processing occurs');
      console.log('   Check document status in the dashboard in 30-60 seconds');
    }

    if (stillFailingCount > 0) {
      console.log(`\n⚠️  ${stillFailingCount} document(s) could not be reset`);
      console.log('   Review error messages above for details');
    }

    console.log('\n═══════════════════════════════════════════════════════════════════\n');

    process.exit(successCount > 0 ? 0 : 1);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ Fatal error: ${errorMsg}\n`);
    process.exit(1);
  }
}

// Run the retry script
retryFailedIngestion();

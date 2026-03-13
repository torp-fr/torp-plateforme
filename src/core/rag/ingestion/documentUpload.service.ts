/**
 * RAG — Document Upload Service
 * Handles Supabase Storage uploads and database record creation.
 * Triggers the ingestion pipeline by inserting with ingestion_status = 'pending'.
 */

import { supabase } from '@/lib/supabase';
import { log } from '@/lib/logger';

export interface UploadResult {
  id: string;
  file_path: string;
  title: string;
  category: string;
  source: string;
  file_size: number;
  mime_type: string;
}

export async function uploadDocumentToStorage(
  file: File,
  options: {
    title?: string;
    category: string;
    source: 'internal' | 'external' | 'official';
  }
): Promise<UploadResult> {
  log('[RAG:Upload] 📤 Uploading file to Storage');

  const timestamp = Date.now();
  const storagePath = `knowledge-documents/${timestamp}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from('knowledge-files')
    .upload(storagePath, file, { upsert: false });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  log('[RAG:Upload] ✅ File uploaded to Storage:', storagePath);

  // Create knowledge_documents record to trigger ingestion pipeline
  const documentId = crypto.randomUUID();
  const safeTitle = options.title?.trim() || file.name.replace(/\.[^/.]+$/, '');

  log('[RAG:Upload] 📝 Creating knowledge_documents record:', documentId);

  const { error: insertError } = await supabase
    .from('knowledge_documents')
    .insert({
      id: documentId,
      file_path: storagePath,
      title: safeTitle,
      category: options.category,
      source: options.source,
      file_size: file.size,
      mime_type: file.type,
      ingestion_status: 'pending',
      ingestion_progress: 0,
    });

  if (insertError) {
    log('[RAG:Upload] ⚠️ Document record creation failed:', insertError.message);
    throw new Error(`Document record creation failed: ${insertError.message}`);
  }

  log('[RAG:Upload] ✅ Document record created with status=pending (trigger will fire)');

  return {
    id: documentId,
    file_path: storagePath,
    title: safeTitle,
    category: options.category,
    source: options.source,
    file_size: file.size,
    mime_type: file.type,
  };
}

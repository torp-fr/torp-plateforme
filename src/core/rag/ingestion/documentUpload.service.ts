/**
 * RAG — Document Upload Service
 * Handles Supabase Storage uploads and database record creation.
 * Triggers the ingestion pipeline by inserting with ingestion_status = 'pending'.
 */

import { supabase } from '@/lib/supabase';
import { log } from '@/lib/logger';
import { STORAGE_BUCKETS } from '@/constants/storage';

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')                   // decompose accented characters
    .replace(/[\u0300-\u036f]/g, '')    // strip combining diacritics (é → e)
    .replace(/\s+/g, '_')              // spaces → underscores
    .replace(/[^a-zA-Z0-9._-]/g, '')   // remove all remaining unsafe chars
    .toLowerCase();
}

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
  log('[RAG:Upload] File name:', file.name);
  log('[RAG:Upload] File size:', file.size, 'bytes');
  log('[RAG:Upload] File type:', file.type);

  const timestamp = Date.now();
  const safeName = sanitizeFileName(file.name);
  const storagePath = `knowledge-documents/${timestamp}-${safeName}`;

  const storageBucket = STORAGE_BUCKETS.KNOWLEDGE;
  log('[RAG:Upload] Uploading to bucket:', storageBucket);
  log('[RAG:Upload] Storage path:', storagePath);

  const { error: uploadError } = await supabase.storage
    .from(storageBucket)
    .upload(storagePath, file, { upsert: false });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  log('[RAG:Upload] ✅ File uploaded to Storage:', storagePath);

  // Validate and normalize category before touching the DB
  const ALLOWED_CATEGORIES = [
    'DTU',
    'EUROCODE',
    'NORMES',
    'GUIDE_TECHNIQUE',
    'CODE_CONSTRUCTION',
  ] as const;

  const normalizedCategory = options.category.toUpperCase();

  if (!(ALLOWED_CATEGORIES as readonly string[]).includes(normalizedCategory)) {
    throw new Error(
      `Invalid category: "${options.category}". ` +
      `Allowed values: ${ALLOWED_CATEGORIES.join(', ')}`,
    );
  }

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
      category: normalizedCategory,
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
    category: normalizedCategory,
    source: options.source,
    file_size: file.size,
    mime_type: file.type,
  };
}

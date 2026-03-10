/**
 * RAG — Document Upload Service
 * Handles Supabase Storage uploads and file validation.
 */

import { supabase } from '@/lib/supabase';
import { log } from '@/lib/logger';

export interface UploadResult {
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

  const safeTitle = options.title?.trim() || file.name.replace(/\.[^/.]+$/, '');
  return {
    file_path: storagePath,
    title: safeTitle,
    category: options.category,
    source: options.source,
    file_size: file.size,
    mime_type: file.type,
  };
}

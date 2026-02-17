/**
 * Storage Configuration Constants
 * Centralized bucket and path definitions for Supabase Storage
 */

export const STORAGE_BUCKETS = {
  DEVIS: 'devis_uploads',
} as const;

export const STORAGE_PATHS = {
  DEVIS_FILE: (userId: string, timestamp: number, fileName: string) =>
    `${userId}/${timestamp}_${fileName}`,
} as const;

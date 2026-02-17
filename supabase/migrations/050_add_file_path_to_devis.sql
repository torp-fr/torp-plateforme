-- PHASE 34.5: Add file_path column to devis table
-- This column stores the actual file path in Supabase Storage
-- Format: {user_id}/{timestamp}_{sanitized_filename}
-- This fixes the brittle path reconstruction logic

-- Add file_path column if it doesn't already exist
ALTER TABLE public.devis
ADD COLUMN IF NOT EXISTS file_path TEXT;

-- Create comment explaining the column
COMMENT ON COLUMN public.devis.file_path IS 'Storage path for the devis file (e.g., user_id/timestamp_filename.pdf)';

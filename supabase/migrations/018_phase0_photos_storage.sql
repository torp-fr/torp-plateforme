-- TORP Phase 0 - Storage bucket for room photos
-- Migration for photo upload functionality in work definition wizard

-- =====================================================
-- STORAGE BUCKET: phase0-photos
-- =====================================================

-- NOTE: Buckets must be created via Supabase Dashboard or API
-- This SQL creates the policies once the bucket exists

-- Instructions to create bucket in Supabase Dashboard:
-- 1. Go to Storage > Buckets
-- 2. Click "New bucket"
-- 3. Name: phase0-photos
-- 4. Public: NO (private)
-- 5. File size limit: 10 MB
-- 6. Allowed MIME types: image/jpeg, image/png, image/webp, image/heic

-- =====================================================
-- STORAGE POLICIES
-- =====================================================

-- Policy: Users can upload photos to their own project folders
-- Path format: {user_id}/{project_id}/{room_id}/{filename}
CREATE POLICY "Users can upload phase0 photos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'phase0-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can read their own photos
CREATE POLICY "Users can read own phase0 photos" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'phase0-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can update their own photos
CREATE POLICY "Users can update own phase0 photos" ON storage.objects
FOR UPDATE TO authenticated
USING (
    bucket_id = 'phase0-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own photos
CREATE POLICY "Users can delete own phase0 photos" ON storage.objects
FOR DELETE TO authenticated
USING (
    bucket_id = 'phase0-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- =====================================================
-- ADD PHOTOS COLUMN TO phase0_projects (if not exists)
-- =====================================================

-- Room photos stored as JSONB array
-- Structure: [{ roomId, roomName, photos: [{ id, url, category, description, uploadedAt }] }]
ALTER TABLE public.phase0_projects
ADD COLUMN IF NOT EXISTS room_photos JSONB DEFAULT '[]'::jsonb;

-- Index for room photos queries
CREATE INDEX IF NOT EXISTS idx_phase0_projects_room_photos
    ON public.phase0_projects USING GIN (room_photos);

COMMENT ON COLUMN public.phase0_projects.room_photos IS 'Photos organized by room for work definition';

-- =====================================================
-- MANUAL SETUP INSTRUCTIONS
-- =====================================================

/*
IMPORTANT: After running this migration, create the bucket manually:

1. Go to Supabase Dashboard > Storage > Buckets
2. Click "New bucket"
3. Configure:
   - Name: phase0-photos
   - Public: OFF (unchecked)
   - File size limit: 10485760 (10 MB)
   - Allowed MIME types: image/jpeg, image/png, image/webp, image/heic
4. Click "Create bucket"

The storage policies above will automatically apply once the bucket exists.
*/

-- ============================================================
-- Migration: Storage bucket policies for quote uploads
-- ============================================================
--
-- ⚠️ IMPORTANT: Storage policies CANNOT be created via SQL!
-- They must be configured manually in the Supabase Dashboard.
--
-- This file serves as documentation. The bucket quote-uploads
-- must already exist and be public.
--
-- See SUPABASE_SETUP.md for manual instructions on adding policies.
--

-- ============================================================
-- Bucket verification query (run this to check bucket exists)
-- ============================================================

SELECT name, owner, public
FROM storage.buckets
WHERE name = 'quote-uploads';

-- Expected result:
-- name          | owner | public
-- ============================================================
-- quote-uploads | null  | true
-- ============================================================

-- If bucket doesn't exist, create it manually via Dashboard:
-- 1. Supabase Dashboard → Storage → Create bucket
-- 2. Name: quote-uploads
-- 3. Public: YES (checked)
-- 4. Create bucket

-- ============================================================
-- POLICIES MUST BE ADDED VIA DASHBOARD (NOT SQL)
-- ============================================================
--
-- Go to: Supabase Dashboard → Storage → quote-uploads → Policies
--
-- Add these 4 policies:
--
-- 1. SELECT (Read)
--    Name: quote_uploads_allow_read_dev
--    Allowed operation: SELECT
--    Policy: (bucket_id = 'quote-uploads')
--
-- 2. INSERT (Upload)
--    Name: quote_uploads_allow_insert_dev
--    Allowed operation: INSERT
--    Policy: (bucket_id = 'quote-uploads')
--
-- 3. UPDATE (Update)
--    Name: quote_uploads_allow_update_dev
--    Allowed operation: UPDATE
--    Policy: (bucket_id = 'quote-uploads')
--
-- 4. DELETE (Delete)
--    Name: quote_uploads_allow_delete_dev
--    Allowed operation: DELETE
--    Policy: (bucket_id = 'quote-uploads')
--

-- ============================================================
-- Verification (after adding policies via Dashboard)
-- ============================================================
--
-- Check via Dashboard:
-- 1. Supabase Dashboard → Storage → quote-uploads → Policies tab
-- 2. Should see 4 policies:
--    - quote_uploads_allow_read_dev (SELECT)
--    - quote_uploads_allow_insert_dev (INSERT)
--    - quote_uploads_allow_update_dev (UPDATE)
--    - quote_uploads_allow_delete_dev (DELETE)
--
-- Then test the upload functionality via the app:
-- 1. npm run dev
-- 2. Create a CCF at /quote
-- 3. Upload a PDF at /quote-upload
-- 4. Check Storage → Objects to see the uploaded file
--


-- Storage Policies for devis-uploads bucket
-- Run this in Supabase SQL Editor AFTER creating the bucket

-- IMPORTANT: Create the bucket first via the Supabase Dashboard:
-- Storage → Create bucket → Name: "devis-uploads", Public: NO

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload devis to their folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own devis files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own devis files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own devis files" ON storage.objects;

-- Policy 1: Allow authenticated users to upload files to their own folder
CREATE POLICY "Users can upload devis to their folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'devis-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: Allow authenticated users to view their own files
CREATE POLICY "Users can view their own devis files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'devis-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3: Allow authenticated users to delete their own files
CREATE POLICY "Users can delete their own devis files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'devis-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 4: Allow users to update their own files
CREATE POLICY "Users can update their own devis files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'devis-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Success message
SELECT 'Storage policies created successfully for devis-uploads bucket.' as status;

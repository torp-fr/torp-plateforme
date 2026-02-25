-- ============================================================================
-- MIGRATION 057: Fix Admin User Type
-- Purpose: Update admin user types from 'B2C' to 'admin'
-- ============================================================================

-- ============================================================================
-- 1. Identify users with admin role
-- ============================================================================

-- Update users table to set user_type = 'admin' where is_admin = TRUE
UPDATE public.users
SET user_type = 'admin'::public.user_type
WHERE is_admin = TRUE AND user_type != 'admin';

-- Also update users with role = 'admin' or 'super_admin' but user_type = 'B2C'
UPDATE public.users
SET user_type = 'admin'::public.user_type
WHERE role IN ('admin', 'super_admin') AND user_type != 'admin';

-- ============================================================================
-- 2. Update super_admin user type
-- ============================================================================

UPDATE public.users
SET user_type = 'super_admin'::public.user_type
WHERE role = 'super_admin' AND user_type != 'super_admin';

-- ============================================================================
-- 3. Verification: Show updated results
-- ============================================================================

-- View: Check the sync results
-- SELECT
--   email,
--   user_type,
--   role,
--   is_admin
-- FROM public.users
-- WHERE role IN ('admin', 'super_admin') OR is_admin = TRUE
-- ORDER BY email;

-- ============================================================================
-- END MIGRATION
-- ============================================================================

-- TORP Database Reset Script
-- This script drops all existing tables and resets the database
-- WARNING: This will DELETE ALL DATA in your Supabase project!
-- Only run this if you want to start fresh with the TORP schema

-- Drop existing tables (in reverse dependency order)
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.tenants CASCADE;
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.market_data CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.devis CASCADE;
DROP TABLE IF EXISTS public.companies CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Drop existing functions
DROP FUNCTION IF EXISTS public.get_user_tenant() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.calculate_torp_score(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.assign_grade(INTEGER) CASCADE;

-- Drop existing types
DROP TYPE IF EXISTS user_type CASCADE;
DROP TYPE IF EXISTS project_status CASCADE;
DROP TYPE IF EXISTS devis_status CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;
DROP TYPE IF EXISTS notification_type CASCADE;

-- Revoke grants
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

-- Success message
SELECT 'Database reset complete. Ready for TORP schema.' as status;

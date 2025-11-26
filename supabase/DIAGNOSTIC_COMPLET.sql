-- ============================================
-- DIAGNOSTIC COMPLET SUPABASE TORP
-- ============================================
-- Ce script vérifie l'état complet de votre base de données
-- Exécutez-le dans le SQL Editor de Supabase

-- 1. VÉRIFIER LES TABLES EXISTANTES
SELECT '=== TABLES EXISTANTES ===' AS diagnostic;
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('users', 'user_feedback', 'analytics_events', 'devis_analysis_metrics')
ORDER BY table_name;

-- 2. VÉRIFIER LES FONCTIONS RPC
SELECT '=== FONCTIONS RPC ===' AS diagnostic;
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('is_admin', 'get_all_feedbacks', 'get_all_users', 'get_all_analyses')
ORDER BY routine_name;

-- 3. VÉRIFIER LES RLS POLICIES
SELECT '=== RLS POLICIES ===' AS diagnostic;
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('users', 'user_feedback', 'analytics_events', 'devis_analysis_metrics')
ORDER BY tablename, policyname;

-- 4. COMPTER LES DONNÉES
SELECT '=== NOMBRE D''ENREGISTREMENTS ===' AS diagnostic;
SELECT
  (SELECT COUNT(*) FROM public.users) AS total_users,
  (SELECT COUNT(*) FROM public.users WHERE user_type = 'admin') AS total_admins,
  (SELECT COUNT(*) FROM public.user_feedback) AS total_feedbacks,
  (SELECT COUNT(*) FROM public.analytics_events) AS total_analytics_events,
  (SELECT COUNT(*) FROM public.devis_analysis_metrics) AS total_analyses;

-- 5. VÉRIFIER L'UTILISATEUR ADMIN
SELECT '=== UTILISATEURS ADMIN ===' AS diagnostic;
SELECT id, email, user_type, created_at
FROM public.users
WHERE user_type = 'admin'
ORDER BY created_at DESC;

-- 6. TESTER LA FONCTION is_admin()
SELECT '=== TEST FONCTION is_admin() ===' AS diagnostic;
SELECT is_admin() AS "Je suis admin ?";

-- 7. VÉRIFIER LES FEEDBACKS (via RPC)
SELECT '=== TEST RPC get_all_feedbacks ===' AS diagnostic;
SELECT
  COUNT(*) AS total_feedbacks_via_rpc,
  COUNT(CASE WHEN feedback_type = 'bug' THEN 1 END) AS bugs,
  COUNT(CASE WHEN feedback_type = 'feature_request' THEN 1 END) AS features,
  COUNT(CASE WHEN feedback_type = 'improvement' THEN 1 END) AS improvements
FROM get_all_feedbacks();

-- 8. VÉRIFIER LES DERNIERS FEEDBACKS
SELECT '=== DERNIERS FEEDBACKS ===' AS diagnostic;
SELECT id, feedback_type, user_type, message, satisfaction_score, status, created_at
FROM get_all_feedbacks()
ORDER BY created_at DESC
LIMIT 5;

-- 9. VÉRIFIER LES UTILISATEURS INSCRITS
SELECT '=== DERNIERS UTILISATEURS ===' AS diagnostic;
SELECT id, email, name, user_type, created_at
FROM get_all_users()
ORDER BY created_at DESC
LIMIT 5;

-- 10. VÉRIFIER LES ANALYSES RÉCENTES
SELECT '=== DERNIÈRES ANALYSES ===' AS diagnostic;
SELECT id, user_email, user_type, torp_score_overall, torp_score_transparency, torp_score_offer, torp_score_robustness, torp_score_price, grade, created_at
FROM get_all_analyses()
ORDER BY created_at DESC
LIMIT 5;

-- 11. VÉRIFIER LES ÉVÉNEMENTS ANALYTICS (accès direct)
SELECT '=== ÉVÉNEMENTS ANALYTICS ===' AS diagnostic;
SELECT event_type, user_type, COUNT(*) as count, MAX(created_at) as dernier_evenement
FROM public.analytics_events
WHERE event_type IN ('signup', 'login')
GROUP BY event_type, user_type
ORDER BY dernier_evenement DESC;

-- 12. TEST ACCÈS DIRECT AUX TABLES (vérifie que RLS fonctionne)
SELECT '=== TEST ACCÈS DIRECT user_feedback ===' AS diagnostic;
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'new' THEN 1 END) as nouveaux,
  COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolus
FROM public.user_feedback;

-- ============================================
-- FIN DU DIAGNOSTIC
-- ============================================
-- Si des erreurs apparaissent ci-dessus :
-- 1. Table manquante -> Appliquez les migrations dans supabase/migrations/
-- 2. Fonction manquante -> Appliquez la migration 004_admin_access_policies.sql
-- 3. RLS Policy manquante -> Appliquez la migration 004_admin_access_policies.sql
-- 4. is_admin() retourne false -> Changez user_type en 'admin' pour votre compte
-- 5. RPC échoue -> Vérifiez que vous êtes bien authentifié
-- ============================================

-- =====================================================
-- DIAGNOSTIC: Vérifier l'état réel de l'enum user_type
-- =====================================================

SELECT 
  'Valeurs enum user_type actuelles:' as info,
  enumlabel,
  enumsortorder
FROM pg_enum
WHERE enumtypid = 'user_type'::regtype
ORDER BY enumsortorder;

-- Vérifier s'il y a des utilisateurs avec des types inexistants
SELECT 
  COUNT(*) as total_users,
  user_type,
  COUNT(CASE WHEN user_type IS NULL THEN 1 END) as null_count
FROM public.users
GROUP BY user_type
ORDER BY user_type;

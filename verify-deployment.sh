#!/bin/bash

# 🔍 Script de Vérification du Déploiement
# Vérifie que le système de recherche d'entreprise est correctement déployé

echo "========================================="
echo "🔍 VÉRIFICATION DU DÉPLOIEMENT"
echo "========================================="
echo ""

# Configuration
PROJECT_ID="${SUPABASE_PROJECT_ID:-}"
if [ -z "$PROJECT_ID" ]; then
  echo "⚠️  SUPABASE_PROJECT_ID non défini"
  echo "   Export le avec: export SUPABASE_PROJECT_ID=votre_project_id"
  echo ""
fi

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

success_count=0
total_checks=0

check() {
  total_checks=$((total_checks + 1))
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✅${NC} $2"
    success_count=$((success_count + 1))
  else
    echo -e "${RED}❌${NC} $2"
  fi
}

echo "📦 1. Vérification des fichiers locaux"
echo "----------------------------------------"

# Vérifier migration
if [ -f "supabase/migrations/003_company_data_cache.sql" ]; then
  check 0 "Migration 003_company_data_cache.sql présente"
else
  check 1 "Migration 003_company_data_cache.sql MANQUANTE"
fi

# Vérifier services partagés
for file in company-search.service.ts pappers-client.ts siret-extractor.ts; do
  if [ -f "supabase/functions/_shared/$file" ]; then
    check 0 "Service _shared/$file présent"
  else
    check 1 "Service _shared/$file MANQUANT"
  fi
done

# Vérifier Edge Functions
for func in refresh-company-cache cleanup-company-cache test-company-search; do
  if [ -d "supabase/functions/$func" ] && [ -f "supabase/functions/$func/index.ts" ]; then
    check 0 "Edge Function $func présente"
  else
    check 1 "Edge Function $func MANQUANTE"
  fi
done

# Vérifier workflows
for workflow in deploy-company-search.yml test-company-search.yml; do
  if [ -f ".github/workflows/$workflow" ]; then
    check 0 "Workflow $workflow présent"
  else
    check 1 "Workflow $workflow MANQUANT"
  fi
done

echo ""
echo "🔗 2. Vérification Supabase (si CLI configuré)"
echo "----------------------------------------"

# Vérifier si Supabase CLI est disponible
if command -v supabase &> /dev/null; then
  echo "✅ Supabase CLI installé"

  # Vérifier les tables
  echo ""
  echo "🗄️  Vérification des tables..."
  tables_result=$(supabase db remote query "
    SELECT table_name
    FROM information_schema.tables
    WHERE table_name IN ('company_data_cache', 'company_search_history')
    ORDER BY table_name;
  " 2>&1)

  if echo "$tables_result" | grep -q "company_data_cache"; then
    check 0 "Table company_data_cache créée"
  else
    check 1 "Table company_data_cache NON CRÉÉE"
  fi

  if echo "$tables_result" | grep -q "company_search_history"; then
    check 0 "Table company_search_history créée"
  else
    check 1 "Table company_search_history NON CRÉÉE"
  fi

  # Vérifier les fonctions PostgreSQL
  echo ""
  echo "🔧 Vérification des fonctions PostgreSQL..."
  functions_result=$(supabase db remote query "
    SELECT proname
    FROM pg_proc
    WHERE proname LIKE '%company%cache%'
    ORDER BY proname;
  " 2>&1)

  expected_functions=(
    "should_refresh_company_cache"
    "increment_company_cache_fetch_count"
    "upsert_company_cache"
    "get_cached_company_data"
    "clean_expired_company_cache"
  )

  for func in "${expected_functions[@]}"; do
    if echo "$functions_result" | grep -q "$func"; then
      check 0 "Fonction PostgreSQL $func créée"
    else
      check 1 "Fonction PostgreSQL $func NON CRÉÉE"
    fi
  done

  # Vérifier les Edge Functions déployées
  echo ""
  echo "🚀 Vérification des Edge Functions déployées..."
  edge_functions=$(supabase functions list 2>&1)

  for func in refresh-company-cache cleanup-company-cache test-company-search; do
    if echo "$edge_functions" | grep -q "$func"; then
      check 0 "Edge Function $func déployée"
    else
      check 1 "Edge Function $func NON DÉPLOYÉE"
    fi
  done

  # Vérifier les secrets
  echo ""
  echo "🔐 Vérification des secrets..."
  echo "⚠️  Les secrets ne peuvent être listés pour des raisons de sécurité"
  echo "   Vérifiez manuellement dans Supabase Dashboard → Settings → Edge Functions → Secrets"
  echo "   Secrets requis: CLAUDE_API_KEY, PAPPERS_API_KEY"

else
  echo "⚠️  Supabase CLI non installé - vérifications distantes ignorées"
  echo "   Installez avec: npm install -g supabase"
fi

echo ""
echo "========================================="
echo "📊 RÉSUMÉ DE LA VÉRIFICATION"
echo "========================================="
echo ""
echo "Tests réussis: $success_count / $total_checks"
echo ""

if [ $success_count -eq $total_checks ]; then
  echo -e "${GREEN}🎉 DÉPLOIEMENT COMPLET !${NC}"
  echo ""
  echo "✅ Tous les composants sont en place"
  echo ""
  echo "📝 Prochaines étapes :"
  echo "   1. Vérifiez les secrets dans Supabase Dashboard"
  echo "   2. Testez avec: supabase functions invoke test-company-search"
  echo "   3. Uploadez un devis test dans votre app"
  echo ""
elif [ $success_count -gt $((total_checks / 2)) ]; then
  echo -e "${YELLOW}⚠️  DÉPLOIEMENT PARTIEL${NC}"
  echo ""
  echo "Certains composants sont manquants. Vérifiez les erreurs ci-dessus."
  echo ""
  echo "📝 Actions suggérées :"
  echo "   1. Vérifiez les logs GitHub Actions"
  echo "   2. Relancez le déploiement manuel si nécessaire"
  echo "   3. Vérifiez que les secrets sont configurés"
  echo ""
else
  echo -e "${RED}❌ DÉPLOIEMENT INCOMPLET${NC}"
  echo ""
  echo "La majorité des composants sont manquants."
  echo ""
  echo "📝 Actions requises :"
  echo "   1. Vérifiez que le workflow GitHub Actions s'est exécuté"
  echo "   2. Consultez les logs : https://github.com/torp-fr/quote-insight-tally/actions"
  echo "   3. Vérifiez les secrets GitHub et Supabase"
  echo "   4. Relancez le workflow manuellement si nécessaire"
  echo ""
fi

echo "🔗 Liens utiles :"
if [ -n "$PROJECT_ID" ]; then
  echo "   • Supabase Dashboard: https://supabase.com/dashboard/project/$PROJECT_ID"
fi
echo "   • GitHub Actions: https://github.com/torp-fr/quote-insight-tally/actions"
echo "   • Guide secrets: .github/SETUP_GITHUB_SECRETS.md"
echo ""

exit 0

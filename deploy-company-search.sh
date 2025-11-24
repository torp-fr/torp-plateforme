#!/bin/bash
# Script de déploiement du système de recherche d'entreprise
# Exécuter depuis la racine du projet : ./deploy-company-search.sh

set -e  # Exit on error

echo "🚀 Déploiement du Système de Recherche d'Entreprise"
echo "=================================================="
echo ""

# Couleurs pour le terminal
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Vérifier que Supabase CLI est installé
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI n'est pas installé${NC}"
    echo ""
    echo "Installation (choisir selon votre OS) :"
    echo "  macOS:   brew install supabase/tap/supabase"
    echo "  npm:     npm install -g supabase"
    echo "  Linux:   voir https://supabase.com/docs/guides/cli"
    exit 1
fi

echo -e "${GREEN}✅ Supabase CLI détecté${NC}"
echo ""

# Vérifier qu'on est dans le bon répertoire
if [ ! -f "supabase/migrations/003_company_data_cache.sql" ]; then
    echo -e "${RED}❌ Migration introuvable. Êtes-vous dans le bon répertoire ?${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Fichiers de migration détectés${NC}"
echo ""

# Étape 1 : Lister les migrations
echo "📋 Étape 1/5 : Vérification des migrations..."
echo "--------------------------------------------"
supabase migration list
echo ""

# Étape 2 : Appliquer les migrations
echo "🗄️  Étape 2/5 : Application de la migration database..."
echo "----------------------------------------------------"
read -p "Appliquer la migration 003_company_data_cache ? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    supabase db push
    echo -e "${GREEN}✅ Migration appliquée avec succès${NC}"
else
    echo -e "${YELLOW}⚠️  Migration ignorée${NC}"
fi
echo ""

# Étape 3 : Vérifier la migration
echo "🔍 Étape 3/5 : Vérification de la migration..."
echo "--------------------------------------------"
echo "Tables créées :"
supabase db remote query "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'company%';" || true
echo ""
echo "Fonctions créées :"
supabase db remote query "SELECT proname FROM pg_proc WHERE proname LIKE '%company%' ORDER BY proname;" || true
echo ""

# Étape 4 : Configurer les secrets
echo "🔐 Étape 4/5 : Configuration des secrets..."
echo "----------------------------------------"
echo -e "${YELLOW}⚠️  IMPORTANT : Vous devez configurer les secrets suivants :${NC}"
echo ""
echo "Secrets OBLIGATOIRES :"
echo "  SUPABASE_URL              (déjà configuré automatiquement)"
echo "  SUPABASE_SERVICE_ROLE_KEY (déjà configuré automatiquement)"
echo "  CLAUDE_API_KEY            sk-ant-..."
echo ""
echo "Secrets OPTIONNELS (mais recommandés) :"
echo "  PAPPERS_API_KEY           b02fe90a049bef5a160c7f4abc5d67f0c7ffcd71f4d11bbe"
echo ""
read -p "Configurer PAPPERS_API_KEY maintenant ? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    supabase secrets set PAPPERS_API_KEY=b02fe90a049bef5a160c7f4abc5d67f0c7ffcd71f4d11bbe
    echo -e "${GREEN}✅ PAPPERS_API_KEY configuré${NC}"
else
    echo -e "${YELLOW}⚠️  Vous devrez le configurer manuellement plus tard${NC}"
fi
echo ""

read -p "Avez-vous configuré CLAUDE_API_KEY ? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⚠️  N'oubliez pas de configurer CLAUDE_API_KEY :${NC}"
    echo "   supabase secrets set CLAUDE_API_KEY=sk-ant-..."
    echo ""
fi

# Étape 5 : Déployer les fonctions
echo "🚀 Étape 5/5 : Déploiement des Edge Functions..."
echo "----------------------------------------------"

functions=("refresh-company-cache" "cleanup-company-cache" "test-company-search")

for func in "${functions[@]}"; do
    echo ""
    echo "Déploiement de $func..."
    if supabase functions deploy "$func" --no-verify-jwt; then
        echo -e "${GREEN}✅ $func déployée avec succès${NC}"
    else
        echo -e "${RED}❌ Échec du déploiement de $func${NC}"
    fi
done

echo ""
echo "=================================================="
echo -e "${GREEN}🎉 Déploiement terminé !${NC}"
echo "=================================================="
echo ""

# Étape 6 : Tests
echo "🧪 Test du système..."
echo "-------------------"
echo ""
echo "Pour tester, exécutez :"
echo "  supabase functions invoke test-company-search"
echo ""
echo "Ou via curl :"
echo "  curl https://YOUR_PROJECT_ID.supabase.co/functions/v1/test-company-search \\"
echo "    -H \"Authorization: Bearer YOUR_ANON_KEY\""
echo ""

read -p "Lancer le test maintenant ? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Lancement du test..."
    supabase functions invoke test-company-search --no-verify-jwt
    echo ""
fi

echo ""
echo "📚 Prochaines étapes :"
echo "--------------------"
echo "1. ✅ Vérifier les logs : supabase functions logs"
echo "2. ✅ Configurer le cron job (voir docs/QUICKSTART_COMPANY_SEARCH.md)"
echo "3. ✅ Consulter la documentation complète (docs/COMPANY_SEARCH_README.md)"
echo ""
echo "Bon développement ! 🚀"

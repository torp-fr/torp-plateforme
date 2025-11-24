#!/bin/bash

# 🔍 Diagnostic GitHub Actions - Pourquoi le workflow ne fonctionne pas ?

echo "================================================"
echo "🔍 DIAGNOSTIC GITHUB ACTIONS"
echo "================================================"
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
NC='\033[0m'

echo "📋 Étape 1 : Vérification des fichiers workflows locaux"
echo "--------------------------------------------------------"

if [ -f ".github/workflows/deploy-company-search.yml" ]; then
  echo -e "${GREEN}✅${NC} Workflow deploy-company-search.yml existe localement"
  echo "   Nom du workflow : $(grep "^name:" .github/workflows/deploy-company-search.yml | cut -d: -f2 | xargs)"
else
  echo -e "${RED}❌${NC} Workflow deploy-company-search.yml MANQUANT"
fi

if [ -f ".github/workflows/test-company-search.yml" ]; then
  echo -e "${GREEN}✅${NC} Workflow test-company-search.yml existe localement"
  echo "   Nom du workflow : $(grep "^name:" .github/workflows/test-company-search.yml | cut -d: -f2 | xargs)"
else
  echo -e "${RED}❌${NC} Workflow test-company-search.yml MANQUANT"
fi

echo ""
echo "📋 Étape 2 : Vérification que les workflows sont pushés sur GitHub"
echo "-------------------------------------------------------------------"

current_branch=$(git branch --show-current)
echo "Branche actuelle : $current_branch"
echo ""

# Vérifier si les workflows sont dans le dernier commit
if git ls-tree -r HEAD --name-only | grep -q ".github/workflows/deploy-company-search.yml"; then
  echo -e "${GREEN}✅${NC} deploy-company-search.yml est dans HEAD"
else
  echo -e "${RED}❌${NC} deploy-company-search.yml N'EST PAS dans HEAD"
fi

if git ls-tree -r HEAD --name-only | grep -q ".github/workflows/test-company-search.yml"; then
  echo -e "${GREEN}✅${NC} test-company-search.yml est dans HEAD"
else
  echo -e "${RED}❌${NC} test-company-search.yml N'EST PAS dans HEAD"
fi

echo ""
echo "Commit qui a ajouté les workflows :"
git log --oneline --all | grep -i "workflow\|github" | head -3

echo ""
echo "📋 Étape 3 : Conditions de déclenchement du workflow"
echo "-----------------------------------------------------"

echo "Le workflow 'Deploy Company Search System' se déclenche quand :"
echo "  1. Push sur la branche : claude/configure-company-search-01Be9mHyZZNNd2KUWVjowoFs"
echo "  2. Modification d'un de ces fichiers :"
echo "     - supabase/migrations/003_company_data_cache.sql"
echo "     - supabase/functions/** (n'importe quel fichier)"
echo "     - .github/workflows/deploy-company-search.yml"
echo ""

echo "Derniers commits sur cette branche :"
git log --oneline -10 | head -10
echo ""

echo "Commits qui ont modifié les fichiers surveillés :"
git log --oneline --all -- "supabase/migrations/003_company_data_cache.sql" "supabase/functions/*" ".github/workflows/deploy-company-search.yml" | head -5

echo ""
echo "📋 Étape 4 : Causes possibles de l'échec"
echo "-----------------------------------------"

echo ""
echo -e "${YELLOW}🔍 Diagnostic des problèmes possibles :${NC}"
echo ""

echo "❓ Problème A : Secrets GitHub manquants ou incorrects"
echo "   Solution : Vérifiez dans GitHub → Settings → Secrets → Actions"
echo "   Requis : SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_ID, SUPABASE_DB_PASSWORD"
echo ""

echo "❓ Problème B : GitHub Actions désactivé sur le repository"
echo "   Solution : GitHub → Settings → Actions → General"
echo "   Vérifiez que 'Allow all actions' est sélectionné"
echo ""

echo "❓ Problème C : Permissions insuffisantes pour GitHub Actions"
echo "   Solution : GitHub → Settings → Actions → General → Workflow permissions"
echo "   Sélectionnez 'Read and write permissions'"
echo ""

echo "❓ Problème D : Le workflow n'a jamais été déclenché"
echo "   Raison : Aucun commit n'a modifié les fichiers surveillés après le push du workflow"
echo "   Solution : Modifier un fichier dans supabase/functions/ pour forcer le trigger"
echo ""

echo "❓ Problème E : Erreur de syntaxe YAML"
echo "   Solution : Validez le YAML avec yamllint ou GitHub's action validator"
echo ""

echo ""
echo "📋 Étape 5 : Actions recommandées"
echo "----------------------------------"
echo ""

echo "🔧 Action 1 : Vérifier les secrets GitHub"
echo "   1. Allez sur : https://github.com/torp-fr/quote-insight-tally/settings/secrets/actions"
echo "   2. Vérifiez que ces 3 secrets existent :"
echo "      - SUPABASE_ACCESS_TOKEN"
echo "      - SUPABASE_PROJECT_ID"
echo "      - SUPABASE_DB_PASSWORD"
echo "   3. Si manquants, consultez : .github/SETUP_GITHUB_SECRETS.md"
echo ""

echo "🔧 Action 2 : Vérifier GitHub Actions est activé"
echo "   1. Allez sur : https://github.com/torp-fr/quote-insight-tally/settings/actions"
echo "   2. Vérifiez que 'Actions permissions' est activé"
echo "   3. Vérifiez que 'Workflow permissions' = 'Read and write permissions'"
echo ""

echo "🔧 Action 3 : Déclencher manuellement le workflow"
echo "   1. Allez sur : https://github.com/torp-fr/quote-insight-tally/actions"
echo "   2. Cliquez sur 'Deploy Company Search System' (si visible)"
echo "   3. Cliquez sur 'Run workflow'"
echo "   4. Sélectionnez la branche et lancez"
echo ""

echo "🔧 Action 4 : Forcer un déclenchement automatique"
echo "   Je vais créer un commit qui modifie un fichier surveillé"
echo "   Cela forcera le workflow à se déclencher automatiquement"
echo ""

echo ""
echo "📋 Étape 6 : Où voir les erreurs détaillées ?"
echo "----------------------------------------------"
echo ""

echo "1. Allez sur : https://github.com/torp-fr/quote-insight-tally/actions"
echo "2. Vous devriez voir une liste de workflows exécutés"
echo "3. Cliquez sur un workflow en échec (icône rouge ❌)"
echo "4. Cliquez sur le job 'deploy'"
echo "5. Développez chaque étape pour voir les logs détaillés"
echo ""

echo "Les erreurs courantes :"
echo "  • 'Error: Unable to locate executable file: supabase'"
echo "    → L'installation de Supabase CLI a échoué"
echo ""
echo "  • 'Error: Invalid access token'"
echo "    → SUPABASE_ACCESS_TOKEN incorrect ou expiré"
echo ""
echo "  • 'Error: Project not found'"
echo "    → SUPABASE_PROJECT_ID incorrect"
echo ""
echo "  • 'Error: Invalid credentials'"
echo "    → SUPABASE_DB_PASSWORD incorrect"
echo ""
echo "  • 'Error: Failed to deploy function'"
echo "    → Problème avec le code de la fonction (syntaxe, imports, etc.)"
echo ""

echo ""
echo "================================================"
echo "🎯 PROCHAINE ÉTAPE"
echo "================================================"
echo ""

echo "Je vais maintenant créer un commit qui force le déclenchement du workflow."
echo "Cela modifiera un fichier dans supabase/functions/ pour activer le trigger automatique."
echo ""

echo "Après le push :"
echo "1. Attendez 30 secondes"
echo "2. Allez sur : https://github.com/torp-fr/quote-insight-tally/actions"
echo "3. Vous devriez voir le workflow 'Deploy Company Search System' apparaître"
echo "4. Si en échec, cliquez dessus pour voir les logs d'erreur"
echo "5. Partagez-moi les logs d'erreur pour que je puisse corriger"
echo ""

echo "================================================"
echo "📞 BESOIN D'AIDE ?"
echo "================================================"
echo ""
echo "Si vous voyez des erreurs dans GitHub Actions :"
echo "1. Copiez le message d'erreur complet"
echo "2. Partagez-le moi"
echo "3. Je vous donnerai la solution exacte"
echo ""

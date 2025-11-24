#!/bin/bash
# GUIDE D'EXÉCUTION COMPLET - À suivre sur votre machine locale
# ============================================================

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  GUIDE DE DÉPLOIEMENT - Système de Recherche d'Entreprise     ║"
echo "║  À exécuter sur VOTRE MACHINE LOCALE                          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# ============================================================
# ÉTAPE 0 : PRÉREQUIS
# ============================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 ÉTAPE 0 : Vérification des prérequis"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cat << 'EOF'
1️⃣  Supabase CLI installé ?

   Vérifier : supabase --version

   Si non installé :
   • macOS:  brew install supabase/tap/supabase
   • npm:    npm install -g supabase
   • Linux:  voir https://supabase.com/docs/guides/cli

2️⃣  Connecté à Supabase ?

   Se connecter : supabase login

3️⃣  Projet lié ?

   Lier le projet : supabase link --project-ref VOTRE_PROJECT_ID

   Trouver PROJECT_ID :
   • Dashboard Supabase → Settings → General → Reference ID

4️⃣  Git à jour ?

   git pull origin claude/configure-company-search-01Be9mHyZZNNd2KUWVjowoFs

EOF

read -p "✅ Prérequis vérifiés ? Appuyez sur ENTER pour continuer..."

# ============================================================
# ÉTAPE 1 : MIGRATION DATABASE
# ============================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🗄️  ÉTAPE 1 : Application de la migration database"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cat << 'EOF'
Commande à exécuter :

  supabase db push

Cette commande va :
• Créer la table company_data_cache
• Créer la table company_search_history
• Créer 5 fonctions PostgreSQL
• Créer les indexes optimisés
• Configurer les RLS policies

EOF

echo "⚙️  Exécutez maintenant : supabase db push"
echo ""
read -p "✅ Migration appliquée ? Appuyez sur ENTER pour continuer..."

# Vérification
echo ""
echo "🔍 Vérification de la migration..."
echo ""
echo "Exécutez pour vérifier :"
echo ""
cat << 'EOF'
  supabase db remote query "
    SELECT table_name
    FROM information_schema.tables
    WHERE table_name LIKE 'company%';
  "

  Attendu : 2 lignes
  • company_data_cache
  • company_search_history

EOF
read -p "✅ Tables créées ? Appuyez sur ENTER pour continuer..."

# ============================================================
# ÉTAPE 2 : CONFIGURATION DES SECRETS
# ============================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔐 ÉTAPE 2 : Configuration des secrets"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cat << 'EOF'
Secrets OBLIGATOIRES :

1. CLAUDE_API_KEY (pour extraction SIRET intelligente)

   Obtenez votre clé : https://console.anthropic.com/settings/keys

   Commande :
   supabase secrets set CLAUDE_API_KEY=sk-ant-VOTRE_CLÉ_ICI

2. PAPPERS_API_KEY (pour données entreprises premium)

   VOTRE CLÉ : b02fe90a049bef5a160c7f4abc5d67f0c7ffcd71f4d11bbe

   Commande :
   supabase secrets set PAPPERS_API_KEY=b02fe90a049bef5a160c7f4abc5d67f0c7ffcd71f4d11bbe

EOF

echo "⚙️  Exécutez ces 2 commandes maintenant :"
echo ""
echo "1. supabase secrets set CLAUDE_API_KEY=sk-ant-VOTRE_CLÉ"
echo "2. supabase secrets set PAPPERS_API_KEY=b02fe90a049bef5a160c7f4abc5d67f0c7ffcd71f4d11bbe"
echo ""
read -p "✅ Secrets configurés ? Appuyez sur ENTER pour continuer..."

# Vérification
echo ""
echo "🔍 Vérification des secrets..."
echo ""
echo "Exécutez : supabase secrets list"
echo ""
echo "Attendu :"
echo "  • CLAUDE_API_KEY"
echo "  • PAPPERS_API_KEY"
echo "  • SUPABASE_URL (auto)"
echo "  • SUPABASE_SERVICE_ROLE_KEY (auto)"
echo ""
read -p "✅ Secrets visibles ? Appuyez sur ENTER pour continuer..."

# ============================================================
# ÉTAPE 3 : DÉPLOIEMENT DES EDGE FUNCTIONS
# ============================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 ÉTAPE 3 : Déploiement des Edge Functions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cat << 'EOF'
3 fonctions à déployer :

1️⃣  refresh-company-cache
   Rafraîchit automatiquement les données en cache

   Commande :
   supabase functions deploy refresh-company-cache --no-verify-jwt

2️⃣  cleanup-company-cache
   Nettoie les données obsolètes

   Commande :
   supabase functions deploy cleanup-company-cache --no-verify-jwt

3️⃣  test-company-search
   Suite de tests complète

   Commande :
   supabase functions deploy test-company-search --no-verify-jwt

EOF

echo "⚙️  Exécutez ces 3 commandes maintenant :"
echo ""
echo "1. supabase functions deploy refresh-company-cache --no-verify-jwt"
echo "2. supabase functions deploy cleanup-company-cache --no-verify-jwt"
echo "3. supabase functions deploy test-company-search --no-verify-jwt"
echo ""
read -p "✅ Fonctions déployées ? Appuyez sur ENTER pour continuer..."

# Vérification
echo ""
echo "🔍 Vérification du déploiement..."
echo ""
echo "Exécutez : supabase functions list"
echo ""
echo "Attendu :"
echo "  • refresh-company-cache"
echo "  • cleanup-company-cache"
echo "  • test-company-search"
echo ""
read -p "✅ Fonctions listées ? Appuyez sur ENTER pour continuer..."

# ============================================================
# ÉTAPE 4 : TESTS
# ============================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 ÉTAPE 4 : Tests du système"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cat << 'EOF'
Test complet du système :

  supabase functions invoke test-company-search --no-verify-jwt

Résultat attendu :
  {
    "totalTests": 12,
    "totalPassed": 12,
    "totalFailed": 0,
    "passRate": "100.00%",
    ...
  }

Si des tests échouent :
• Vérifier que CLAUDE_API_KEY et PAPPERS_API_KEY sont configurés
• Vérifier que la migration est appliquée
• Consulter les logs : supabase functions logs test-company-search

EOF

echo "⚙️  Exécutez maintenant : supabase functions invoke test-company-search --no-verify-jwt"
echo ""
read -p "✅ Tests passent (12/12) ? Appuyez sur ENTER pour continuer..."

# ============================================================
# ÉTAPE 5 : VÉRIFICATIONS FINALES
# ============================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ÉTAPE 5 : Vérifications finales"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cat << 'EOF'
Vérifications à effectuer :

1. Logs des fonctions (aucune erreur) :
   supabase functions logs --follow

2. Statistiques du cache (devrait être vide au début) :
   supabase db remote query "SELECT COUNT(*) FROM company_data_cache;"

3. Historique des recherches :
   supabase db remote query "SELECT COUNT(*) FROM company_search_history;"

4. Dashboard Supabase :
   https://supabase.com/dashboard/project/VOTRE_PROJECT_ID

   Vérifier :
   • Table Editor : Tables créées
   • Edge Functions : 3 fonctions déployées
   • Logs : Pas d'erreurs

EOF

echo "🔍 Effectuez ces vérifications maintenant"
echo ""
read -p "✅ Tout fonctionne ? Appuyez sur ENTER pour continuer..."

# ============================================================
# ÉTAPE 6 : CONFIGURATION CRON (OPTIONNEL)
# ============================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⏰ ÉTAPE 6 (Optionnel) : Configuration du Cron Job"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cat << 'EOF'
Pour automatiser la maintenance du cache, créez :

  .github/workflows/company-cache-maintenance.yml

Contenu :

---
name: Company Cache Maintenance

on:
  schedule:
    - cron: '0 2 * * *'   # Refresh daily at 2 AM
    - cron: '0 3 * * 0'   # Cleanup weekly on Sunday

jobs:
  refresh:
    if: github.event.schedule == '0 2 * * *'
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -X POST ${{ secrets.SUPABASE_URL }}/functions/v1/refresh-company-cache \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_KEY }}" \
            -d '{"maxCompanies": 100}'

  cleanup:
    if: github.event.schedule == '0 3 * * 0'
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -X POST ${{ secrets.SUPABASE_URL }}/functions/v1/cleanup-company-cache \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_KEY }}" \
            -d '{"dryRun": false}'
---

Ensuite, configurez les secrets GitHub :
• SUPABASE_URL
• SUPABASE_SERVICE_KEY

EOF

read -p "⏭️  Configurer le cron plus tard ? Appuyez sur ENTER pour continuer..."

# ============================================================
# RÉCAPITULATIF FINAL
# ============================================================

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    🎉 DÉPLOIEMENT TERMINÉ !                   ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

cat << 'EOF'
✅ CHECKLIST FINALE :

  [✓] Migration database appliquée
  [✓] Tables company_data_cache et company_search_history créées
  [✓] 5 fonctions PostgreSQL créées
  [✓] Secrets CLAUDE_API_KEY et PAPPERS_API_KEY configurés
  [✓] 3 Edge Functions déployées
  [✓] Tests passent (12/12)
  [✓] Logs sans erreurs

📊 MÉTRIQUES À SURVEILLER (dans 1 semaine) :

  • Cache Hit Rate : > 80%
  • Quality Score moyen : > 80
  • Response Time : < 100ms (cache hit)
  • Error Rate : < 5%

📚 DOCUMENTATION DISPONIBLE :

  • Architecture : docs/ARCHITECTURE_COMPANY_SEARCH.md
  • Quick Start : docs/QUICKSTART_COMPANY_SEARCH.md
  • README : docs/COMPANY_SEARCH_README.md
  • Commandes : QUICK_COMMANDS.md

🚀 PROCHAINES ÉTAPES :

  1. Uploader un devis test
  2. Vérifier l'extraction SIRET
  3. Vérifier la recherche entreprise
  4. Consulter le scoring TORP enrichi
  5. Configurer le cron job (optionnel)

📞 SUPPORT :

  • Logs : supabase functions logs --follow
  • Stats : QUICK_COMMANDS.md
  • Debug : DEPLOYMENT_GUIDE.md (section Troubleshooting)

EOF

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "         Le système est opérationnel ! Bon développement ! 🎊"
echo "════════════════════════════════════════════════════════════════"
echo ""

#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# TORP - NETTOYAGE PRAGMATIQUE (B2G + B2B2C uniquement)
# ═══════════════════════════════════════════════════════════════════
#
# Ce script supprime UNIQUEMENT les modules B2G et B2B2C
# CONSERVE : B2C + B2B + toutes les features déjà implémentées
#
# ⚠️  ATTENTION : Ce script supprime définitivement des fichiers
# ⚠️  Assurez-vous d'avoir créé une branche backup avant d'exécuter
#
# Usage:
#   chmod +x PRAGMATIC_CLEANUP.sh
#   ./PRAGMATIC_CLEANUP.sh
#
# ═══════════════════════════════════════════════════════════════════

set -e  # Stop on error

# Couleurs pour output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Compteurs
DELETED_FILES=0
DELETED_DIRS=0

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   TORP - Nettoyage Pragmatique (B2G + B2B2C)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════
# VÉRIFICATIONS PRÉLIMINAIRES
# ═══════════════════════════════════════════════════════════════════

echo -e "${YELLOW}📋 Vérifications préliminaires...${NC}"

# Vérifier qu'on est à la racine du projet
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Erreur: Ce script doit être exécuté à la racine du projet${NC}"
    exit 1
fi

# Vérifier qu'on est sur une branche de travail
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" == "main" ] || [ "$CURRENT_BRANCH" == "master" ]; then
    echo -e "${RED}❌ Erreur: Ne pas exécuter sur main/master !${NC}"
    echo -e "${YELLOW}   Créez d'abord une branche de travail:${NC}"
    echo -e "   git checkout -b feature/cleanup-b2g-b2b2c"
    exit 1
fi

echo -e "${GREEN}✅ Branche actuelle: $CURRENT_BRANCH${NC}"

# Demander confirmation
echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  NETTOYAGE CIBLÉ - Ce qui sera supprimé :             ║${NC}"
echo -e "${CYAN}╠════════════════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}║  ❌ Modules B2G (Collectivités)                        ║${NC}"
echo -e "${CYAN}║  ❌ Modules B2B2C (Prescripteurs)                      ║${NC}"
echo -e "${CYAN}║  ❌ Fichiers obsolètes (*.old.tsx)                     ║${NC}"
echo -e "${CYAN}║                                                        ║${NC}"
echo -e "${CYAN}║  ✅ CONSERVÉ : B2C + B2B + Features implémentées       ║${NC}"
echo -e "${CYAN}║  ✅ CONSERVÉ : Marketplace, CCTP, DOE, Analytics       ║${NC}"
echo -e "${CYAN}║  ✅ CONSERVÉ : Scoring enrichi actuel                  ║${NC}"
echo -e "${CYAN}║  ✅ CONSERVÉ : Architecture Vite + React               ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}⚠️  Assurez-vous d'avoir créé une branche backup !${NC}"
echo ""
read -p "Continuer ? (tapez 'OUI' en majuscules): " CONFIRM

if [ "$CONFIRM" != "OUI" ]; then
    echo -e "${RED}❌ Annulé par l'utilisateur${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Démarrage du nettoyage ciblé...${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════
# FONCTION DE SUPPRESSION
# ═══════════════════════════════════════════════════════════════════

delete_file() {
    local file=$1
    if [ -f "$file" ]; then
        rm "$file"
        echo -e "${GREEN}  ✓${NC} Supprimé: $file"
        ((DELETED_FILES++))
    else
        echo -e "${YELLOW}  ⊘${NC} N'existe pas: $file"
    fi
}

delete_dir() {
    local dir=$1
    if [ -d "$dir" ]; then
        rm -rf "$dir"
        echo -e "${GREEN}  ✓${NC} Supprimé: $dir/"
        ((DELETED_DIRS++))
    else
        echo -e "${YELLOW}  ⊘${NC} N'existe pas: $dir/"
    fi
}

# ═══════════════════════════════════════════════════════════════════
# SUPPRESSION MODULES B2G (COLLECTIVITÉS)
# ═══════════════════════════════════════════════════════════════════

echo -e "${BLUE}1. Suppression des modules B2G (Collectivités)...${NC}"

delete_file "src/pages/CollectivitesDashboard.tsx"
delete_file "src/components/pricing/B2GPricing.tsx"
delete_file "src/components/ParticipationManager.tsx"
delete_file "src/components/CitizenDashboard.tsx"

echo ""

# ═══════════════════════════════════════════════════════════════════
# SUPPRESSION MODULES B2B2C (PRESCRIPTEURS)
# ═══════════════════════════════════════════════════════════════════

echo -e "${BLUE}2. Suppression des modules B2B2C (Prescripteurs)...${NC}"

delete_file "src/pages/B2B2CDashboard.tsx"
delete_file "src/components/pricing/B2B2CPricing.tsx"

echo ""

# ═══════════════════════════════════════════════════════════════════
# SUPPRESSION FICHIERS OBSOLÈTES
# ═══════════════════════════════════════════════════════════════════

echo -e "${BLUE}3. Suppression des fichiers obsolètes...${NC}"

delete_file "src/pages/Index.old.tsx"
delete_file "src/components/Header.old.tsx"
delete_file "src/components/Hero.old.tsx"

echo ""

# ═══════════════════════════════════════════════════════════════════
# NETTOYAGE BUILD
# ═══════════════════════════════════════════════════════════════════

echo -e "${BLUE}4. Nettoyage des fichiers de build...${NC}"

if [ -d "dist" ]; then
    rm -rf dist
    echo -e "${GREEN}  ✓${NC} Supprimé: dist/"
fi

if [ -d "node_modules/.vite" ]; then
    rm -rf node_modules/.vite
    echo -e "${GREEN}  ✓${NC} Supprimé: node_modules/.vite/"
fi

echo ""

# ═══════════════════════════════════════════════════════════════════
# RÉSUMÉ ET PROCHAINES ÉTAPES
# ═══════════════════════════════════════════════════════════════════

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Nettoyage ciblé terminé !${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}📊 Résumé:${NC}"
echo -e "   • Fichiers supprimés: $DELETED_FILES"
echo -e "   • Dossiers supprimés: $DELETED_DIRS"
echo ""
echo -e "${CYAN}✅ CONSERVÉ (rien n'a été touché):${NC}"
echo -e "   • ✅ Modules B2C et B2B"
echo -e "   • ✅ Marketplace"
echo -e "   • ✅ CCTP Generator et DOE Generator"
echo -e "   • ✅ Chat IA et Analytics"
echo -e "   • ✅ Toutes les features déjà implémentées"
echo -e "   • ✅ Scoring enrichi actuel"
echo -e "   • ✅ Architecture Vite + React"
echo ""
echo -e "${YELLOW}⚠️  Prochaines étapes manuelles:${NC}"
echo ""
echo -e "${BLUE}1. Vérifier la compilation:${NC}"
echo -e "   npm run build"
echo ""
echo -e "${BLUE}2. Corriger les imports cassés (s'il y en a):${NC}"
echo -e "   # Chercher les imports de B2G/B2B2C dans:"
echo -e "   grep -r \"CollectivitesDashboard\" src/"
echo -e "   grep -r \"B2B2CDashboard\" src/"
echo -e "   grep -r \"B2GPricing\" src/"
echo -e "   grep -r \"B2B2CPricing\" src/"
echo ""
echo -e "${BLUE}3. Simplifier la navigation (optionnel):${NC}"
echo -e "   • Retirer les liens vers B2G/B2B2C dans Header"
echo -e "   • Simplifier le Hero (garder B2C + B2B)"
echo ""
echo -e "${BLUE}4. Tester l'application:${NC}"
echo -e "   npm run dev"
echo -e "   # Vérifier que B2C et B2B fonctionnent"
echo ""
echo -e "${BLUE}5. Lancer les tests:${NC}"
echo -e "   npm test"
echo ""
echo -e "${BLUE}6. Commiter les changements:${NC}"
echo -e "   git add ."
echo -e "   git commit -m \"chore: Remove B2G and B2B2C modules"
echo -e ""
echo -e "   - Remove B2G (Collectivités) pages and components"
echo -e "   - Remove B2B2C (Prescripteurs) pages and components"
echo -e "   - Clean obsolete files"
echo -e "   - Keep B2C + B2B + all implemented features"
echo -e "   - Keep Vite + React architecture"
echo -e "   \""
echo -e "   git push -u origin $CURRENT_BRANCH"
echo ""
echo -e "${GREEN}📚 Documentation:${NC}"
echo -e "   • PRAGMATIC_APPROACH.md - Stratégie pragmatique"
echo -e "   • FREE_MODE_CONFIG.md - Configuration mode gratuit"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Nettoyage minimal effectué avec succès !${NC}"
echo -e "${CYAN}💡 Votre app conserve toutes ses features utiles.${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

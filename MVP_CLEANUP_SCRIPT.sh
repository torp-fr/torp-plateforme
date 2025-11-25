#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# TORP MVP B2C - SCRIPT DE NETTOYAGE AUTOMATISÉ
# ═══════════════════════════════════════════════════════════════════
#
# Ce script supprime tous les modules hors scope MVP B2C
#
# ⚠️  ATTENTION : Ce script supprime définitivement des fichiers
# ⚠️  Assurez-vous d'avoir créé une branche backup avant d'exécuter
#
# Usage:
#   chmod +x MVP_CLEANUP_SCRIPT.sh
#   ./MVP_CLEANUP_SCRIPT.sh
#
# ═══════════════════════════════════════════════════════════════════

set -e  # Stop on error

# Couleurs pour output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Compteurs
DELETED_FILES=0
DELETED_DIRS=0

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   TORP MVP B2C - Nettoyage Automatique${NC}"
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
    echo -e "   git checkout -b feature/mvp-b2c-cleanup"
    exit 1
fi

echo -e "${GREEN}✅ Branche actuelle: $CURRENT_BRANCH${NC}"

# Demander confirmation
echo ""
echo -e "${YELLOW}⚠️  Ce script va supprimer ~70 fichiers hors scope MVP B2C${NC}"
echo -e "${YELLOW}⚠️  Assurez-vous d'avoir créé une branche backup !${NC}"
echo ""
read -p "Continuer ? (tapez 'OUI' en majuscules): " CONFIRM

if [ "$CONFIRM" != "OUI" ]; then
    echo -e "${RED}❌ Annulé par l'utilisateur${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Démarrage du nettoyage...${NC}"
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
# SUPPRESSION PAGES B2B/B2G/B2B2C
# ═══════════════════════════════════════════════════════════════════

echo -e "${BLUE}1. Suppression des pages B2B/B2G/B2B2C...${NC}"

delete_file "src/pages/ImprovedB2BDashboard.tsx"
delete_file "src/pages/B2B2CDashboard.tsx"
delete_file "src/pages/CollectivitesDashboard.tsx"
delete_file "src/pages/AdminDashboard.tsx"

echo ""

# ═══════════════════════════════════════════════════════════════════
# SUPPRESSION PAGES FEATURES AVANCÉES
# ═══════════════════════════════════════════════════════════════════

echo -e "${BLUE}2. Suppression des features avancées (Phase 2+)...${NC}"

delete_file "src/pages/Marketplace.tsx"
delete_file "src/pages/FinancingPlatform.tsx"
delete_file "src/pages/KnowledgeBase.tsx"
delete_file "src/pages/ProjectTracking.tsx"
delete_file "src/pages/FormulaPicker.tsx"
delete_file "src/pages/TorpCompleteFlow.tsx"
delete_file "src/pages/DiscoveryFlow.tsx"

echo ""

# ═══════════════════════════════════════════════════════════════════
# SUPPRESSION PAGES OBSOLÈTES
# ═══════════════════════════════════════════════════════════════════

echo -e "${BLUE}3. Suppression des pages obsolètes/dupliquées...${NC}"

delete_file "src/pages/Index.old.tsx"
delete_file "src/pages/Index.optimized.tsx"
delete_file "src/App.improved.tsx"

echo ""

# ═══════════════════════════════════════════════════════════════════
# SUPPRESSION COMPOSANTS PRICING B2B/B2G
# ═══════════════════════════════════════════════════════════════════

echo -e "${BLUE}4. Suppression des composants pricing B2B/B2G/B2B2C...${NC}"

delete_file "src/components/pricing/B2BPricing.tsx"
delete_file "src/components/pricing/B2GPricing.tsx"
delete_file "src/components/pricing/B2B2CPricing.tsx"

echo ""

# ═══════════════════════════════════════════════════════════════════
# SUPPRESSION MARKETPLACE
# ═══════════════════════════════════════════════════════════════════

echo -e "${BLUE}5. Suppression du module Marketplace...${NC}"

delete_dir "src/components/marketplace"

echo ""

# ═══════════════════════════════════════════════════════════════════
# SUPPRESSION GÉNÉRATEURS DOCUMENTS
# ═══════════════════════════════════════════════════════════════════

echo -e "${BLUE}6. Suppression des générateurs de documents (CCTP, DOE)...${NC}"

delete_file "src/components/CCTPGenerator.tsx"
delete_file "src/components/DOEGenerator.tsx"
delete_file "src/components/DigitalHomeBook.tsx"

echo ""

# ═══════════════════════════════════════════════════════════════════
# SUPPRESSION COMPOSANTS MÉTIER B2B/B2G
# ═══════════════════════════════════════════════════════════════════

echo -e "${BLUE}7. Suppression des composants métier B2B/B2G...${NC}"

delete_file "src/components/TerritorialMap.tsx"
delete_file "src/components/ClientPortfolio.tsx"
delete_file "src/components/TeamScheduler.tsx"
delete_file "src/components/ParticipationManager.tsx"
delete_file "src/components/CitizenDashboard.tsx"
delete_file "src/components/ProjectComparison.tsx"
delete_file "src/components/MultiProjectManagement.tsx"
delete_file "src/components/ParcelAnalysis.tsx"

echo ""

# ═══════════════════════════════════════════════════════════════════
# SUPPRESSION FEATURES AVANCÉES
# ═══════════════════════════════════════════════════════════════════

echo -e "${BLUE}8. Suppression des features avancées (Phase 2)...${NC}"

delete_file "src/components/ConstructionTracking.tsx"
delete_file "src/components/AdvancedAnalytics.tsx"
delete_file "src/components/ChatAI.tsx"
delete_file "src/components/ActiveAssistant.tsx"
delete_file "src/components/AutoRecommendations.tsx"
delete_file "src/components/AutoAlerts.tsx"

echo ""

# ═══════════════════════════════════════════════════════════════════
# SUPPRESSION PAIEMENTS AVANCÉS
# ═══════════════════════════════════════════════════════════════════

echo -e "${BLUE}9. Suppression des systèmes de paiement avancés...${NC}"

delete_file "src/components/PaymentSystem.tsx"
delete_file "src/components/PaymentTrackingComponent.tsx"

echo ""

# ═══════════════════════════════════════════════════════════════════
# SUPPRESSION COMPOSANTS OBSOLÈTES
# ═══════════════════════════════════════════════════════════════════

echo -e "${BLUE}10. Suppression des composants obsolètes...${NC}"

delete_file "src/components/Header.old.tsx"
delete_file "src/components/Header.optimized.tsx"
delete_file "src/components/Hero.old.tsx"
delete_file "src/components/Hero.optimized.tsx"

echo ""

# ═══════════════════════════════════════════════════════════════════
# NETTOYAGE BUILD
# ═══════════════════════════════════════════════════════════════════

echo -e "${BLUE}11. Nettoyage des fichiers de build...${NC}"

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
echo -e "${GREEN}✅ Nettoyage terminé !${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}📊 Résumé:${NC}"
echo -e "   • Fichiers supprimés: $DELETED_FILES"
echo -e "   • Dossiers supprimés: $DELETED_DIRS"
echo ""
echo -e "${YELLOW}⚠️  Prochaines étapes manuelles:${NC}"
echo ""
echo -e "${BLUE}1. Vérifier la compilation:${NC}"
echo -e "   npm run build"
echo ""
echo -e "${BLUE}2. Corriger les imports cassés:${NC}"
echo -e "   • Ouvrir les fichiers avec erreurs de compilation"
echo -e "   • Supprimer les imports des fichiers supprimés"
echo -e "   • Simplifier les composants (retirer références B2B/B2G)"
echo ""
echo -e "${BLUE}3. Simplifier les composants conservés:${NC}"
echo -e "   • src/pages/Index.tsx - Retirer sections B2B/B2G"
echo -e "   • src/components/Header.tsx - Simplifier navigation"
echo -e "   • src/components/Features.tsx - Garder uniquement B2C"
echo ""
echo -e "${BLUE}4. Tester l'application:${NC}"
echo -e "   npm run dev"
echo -e "   # Vérifier que l'app démarre et fonctionne"
echo ""
echo -e "${BLUE}5. Lancer les tests:${NC}"
echo -e "   npm test"
echo ""
echo -e "${BLUE}6. Commiter les changements:${NC}"
echo -e "   git add ."
echo -e "   git commit -m \"chore: Remove B2B/B2G/B2B2C modules - Focus MVP B2C\""
echo -e "   git push -u origin $CURRENT_BRANCH"
echo ""
echo -e "${GREEN}📚 Documentation:${NC}"
echo -e "   • MVP_GAP_ANALYSIS.md - Analyse complète"
echo -e "   • MVP_RESTRUCTURATION_PLAN.md - Plan détaillé"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Bon courage pour la suite du nettoyage MVP !${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

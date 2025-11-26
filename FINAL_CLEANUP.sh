#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# TORP - NETTOYAGE PRAGMATIQUE FINAL (B2G + B2B2C + Features B2B complexes)
# ═══════════════════════════════════════════════════════════════════
#
# Ce script supprime :
# - Modules B2G (Collectivités)
# - Modules B2B2C (Prescripteurs)
# - Features B2B complexes (Marketplace, Gestion équipe, Multi-projets)
#
# CONSERVE :
# - B2C : Analyse de devis reçus (aide décision particuliers)
# - B2B Simplifié : Assistant optimisation devis (aide pros BTP)
# - Features core : CCTP, DOE, Analytics (si utiles)
#
# ═══════════════════════════════════════════════════════════════════

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

DELETED_FILES=0
DELETED_DIRS=0

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   TORP - Nettoyage Pragmatique Final${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════
# VÉRIFICATIONS
# ═══════════════════════════════════════════════════════════════════

echo -e "${YELLOW}📋 Vérifications préliminaires...${NC}"

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Erreur: Ce script doit être exécuté à la racine du projet${NC}"
    exit 1
fi

CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" == "main" ] || [ "$CURRENT_BRANCH" == "master" ]; then
    echo -e "${RED}❌ Erreur: Ne pas exécuter sur main/master !${NC}"
    echo -e "${YELLOW}   Créez d'abord une branche de travail:${NC}"
    echo -e "   git checkout -b feature/pragmatic-cleanup"
    exit 1
fi

echo -e "${GREEN}✅ Branche actuelle: $CURRENT_BRANCH${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════
# AFFICHAGE SCOPE
# ═══════════════════════════════════════════════════════════════════

echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  SCOPE FINAL - Ce qui sera CONSERVÉ :                         ║${NC}"
echo -e "${CYAN}╠════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}║                                                                ║${NC}"
echo -e "${CYAN}║  ✅ B2C (Particuliers) - Analyse de devis REÇUS               ║${NC}"
echo -e "${CYAN}║     → Aide à la décision                                      ║${NC}"
echo -e "${CYAN}║     → Scoring confiance A-E                                   ║${NC}"
echo -e "${CYAN}║     → Vérification entreprise                                 ║${NC}"
echo -e "${CYAN}║     → Alertes et recommandations                              ║${NC}"
echo -e "${CYAN}║                                                                ║${NC}"
echo -e "${CYAN}║  ✅ B2B Simplifié (Pros BTP) - Assistant optimisation         ║${NC}"
echo -e "${CYAN}║     → Analyse de LEUR devis avant envoi                       ║${NC}"
echo -e "${CYAN}║     → Recommandations professionnelles                        ║${NC}"
echo -e "${CYAN}║     → Conseils amélioration taux signature                    ║${NC}"
echo -e "${CYAN}║     → Note transparence/confiance                             ║${NC}"
echo -e "${CYAN}║     → Lien tracking pour client final                         ║${NC}"
echo -e "${CYAN}║                                                                ║${NC}"
echo -e "${CYAN}║  ✅ Features Core (si implémentées)                           ║${NC}"
echo -e "${CYAN}║     → CCTP Generator, DOE Generator                           ║${NC}"
echo -e "${CYAN}║     → Analytics, Chat IA                                      ║${NC}"
echo -e "${CYAN}║     → Scoring enrichi actuel                                  ║${NC}"
echo -e "${CYAN}╠════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}║  ❌ Ce qui sera SUPPRIMÉ :                                    ║${NC}"
echo -e "${CYAN}╠════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}║  ❌ Modules B2G (Collectivités, Marchés publics)             ║${NC}"
echo -e "${CYAN}║  ❌ Modules B2B2C (Prescripteurs)                             ║${NC}"
echo -e "${CYAN}║  ❌ Marketplace (fournisseurs, artisans)                      ║${NC}"
echo -e "${CYAN}║  ❌ Gestion d'équipe B2B                                      ║${NC}"
echo -e "${CYAN}║  ❌ Multi-projets complexe                                    ║${NC}"
echo -e "${CYAN}║  ❌ Portfolio clients B2B                                     ║${NC}"
echo -e "${CYAN}║  ❌ Fichiers obsolètes (*.old.tsx)                            ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
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
# FONCTIONS
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
# 1. SUPPRESSION MODULES B2G
# ═══════════════════════════════════════════════════════════════════

echo -e "${BLUE}1. Suppression des modules B2G (Collectivités)...${NC}"

delete_file "src/pages/CollectivitesDashboard.tsx"
delete_file "src/components/pricing/B2GPricing.tsx"
delete_file "src/components/ParticipationManager.tsx"
delete_file "src/components/CitizenDashboard.tsx"
delete_file "src/components/TerritorialMap.tsx"

echo ""

# ═══════════════════════════════════════════════════════════════════
# 2. SUPPRESSION MODULES B2B2C
# ═══════════════════════════════════════════════════════════════════

echo -e "${BLUE}2. Suppression des modules B2B2C (Prescripteurs)...${NC}"

delete_file "src/pages/B2B2CDashboard.tsx"
delete_file "src/components/pricing/B2B2CPricing.tsx"

echo ""

# ═══════════════════════════════════════════════════════════════════
# 3. SUPPRESSION MARKETPLACE
# ═══════════════════════════════════════════════════════════════════

echo -e "${BLUE}3. Suppression du Marketplace...${NC}"

delete_file "src/pages/Marketplace.tsx"
delete_dir "src/components/marketplace"

echo ""

# ═══════════════════════════════════════════════════════════════════
# 4. SUPPRESSION FEATURES B2B COMPLEXES
# ═══════════════════════════════════════════════════════════════════

echo -e "${BLUE}4. Suppression features B2B complexes...${NC}"

delete_file "src/components/TeamScheduler.tsx"
delete_file "src/components/ClientPortfolio.tsx"
delete_file "src/components/MultiProjectManagement.tsx"
delete_file "src/pages/FinancingPlatform.tsx"

echo ""

# ═══════════════════════════════════════════════════════════════════
# 5. SUPPRESSION FICHIERS OBSOLÈTES
# ═══════════════════════════════════════════════════════════════════

echo -e "${BLUE}5. Suppression des fichiers obsolètes...${NC}"

delete_file "src/pages/Index.old.tsx"
delete_file "src/pages/Index.optimized.tsx"
delete_file "src/components/Header.old.tsx"
delete_file "src/components/Header.optimized.tsx"
delete_file "src/components/Hero.old.tsx"
delete_file "src/components/Hero.optimized.tsx"
delete_file "src/App.improved.tsx"

echo ""

# ═══════════════════════════════════════════════════════════════════
# 6. NETTOYAGE BUILD
# ═══════════════════════════════════════════════════════════════════

echo -e "${BLUE}6. Nettoyage des fichiers de build...${NC}"

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
# RÉSUMÉ
# ═══════════════════════════════════════════════════════════════════

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Nettoyage terminé !${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}📊 Résumé:${NC}"
echo -e "   • Fichiers supprimés: $DELETED_FILES"
echo -e "   • Dossiers supprimés: $DELETED_DIRS"
echo ""
echo -e "${CYAN}✅ CONSERVÉ:${NC}"
echo -e "   • ✅ B2C : Analyse de devis pour particuliers"
echo -e "   • ✅ B2B : Assistant optimisation devis pour pros BTP"
echo -e "   • ✅ Features core : CCTP, DOE, Analytics, Scoring enrichi"
echo -e "   • ✅ Architecture Vite + React"
echo ""
echo -e "${MAGENTA}⚠️  IMPORTANT - Prochaines étapes:${NC}"
echo ""
echo -e "${BLUE}1. Vérifier la compilation:${NC}"
echo -e "   ${YELLOW}npm run build${NC}"
echo ""
echo -e "${BLUE}2. Chercher les imports cassés:${NC}"
echo -e "   ${YELLOW}grep -r \"CollectivitesDashboard\\|B2B2CDashboard\\|Marketplace\\|TeamScheduler\\|ClientPortfolio\" src/${NC}"
echo ""
echo -e "${BLUE}3. Corriger les imports dans:${NC}"
echo -e "   • ${YELLOW}src/components/Header.tsx${NC} - Navigation"
echo -e "   • ${YELLOW}src/pages/Index.tsx${NC} - Landing page"
echo -e "   • ${YELLOW}src/App.tsx${NC} - Routes"
echo ""
echo -e "${BLUE}4. Simplifier la navigation:${NC}"
echo -e "   • Garder: \"Particuliers\" et \"Professionnels\""
echo -e "   • Retirer: \"Collectivités\" et \"Prescripteurs\""
echo ""
echo -e "${BLUE}5. Tester l'application:${NC}"
echo -e "   ${YELLOW}npm run dev${NC}"
echo ""
echo -e "${BLUE}6. Commit:${NC}"
echo -e "   ${YELLOW}git add .${NC}"
echo -e "   ${YELLOW}git commit -m \"chore: Pragmatic cleanup - Remove B2G, B2B2C, Marketplace\"${NC}"
echo -e "   ${YELLOW}git push${NC}"
echo ""
echo -e "${GREEN}📚 Documentation:${NC}"
echo -e "   • ${CYAN}PRAGMATIC_APPROACH.md${NC} - Stratégie complète"
echo -e "   • ${CYAN}FREE_MODE_CONFIG.md${NC} - Configuration mode gratuit"
echo -e "   • ${CYAN}AUTOMATED_TASKS.md${NC} - Plan d'exécution automatisé"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Prêt pour la Phase 2 : Configuration Mode Gratuit !${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# CLASSIFICATION NETTOYAGE REPOSITORY TORP

**Date**: 2026-03-03
**Scope**: Tous dossiers + fichiers racine
**Format**: Tableau A/B/C/D

---

## RÉPERTOIRES (14)

| Dossier | Taille | Rôle | Production | Railway | Classification | Action |
|---------|--------|------|------------|---------|-----------------|--------|
| **.github** | - | GitHub workflows, CI/CD, configs | ✅ Oui | ✅ Oui | **A - CORE** | Garder |
| **.claude** | - | Claude Code configuration | ✅ Oui | ❌ Non | **A - CORE** | Garder |
| **.git** | - | Repository Git | ✅ Oui | ❌ Non | **A - CORE** | Garder |
| **src** | 3.9M | Application Node.js principale | ❌ Non (Python) | ❌ Non | **A - CORE** | Déployer ou Refactor |
| **supabase** | 787K | Migrations Supabase, schema DB | ✅ Oui | ✅ Via migrations | **A - CORE** | Garder |
| **public** | 11M | Assets statiques (CSS, images, fonts) | ✅ Oui | ❌ Non | **A - CORE** | Garder |
| **ocr-service** | 17K | Service Python OCR externe | ✅ Oui (optionnel) | ✅ Oui (config séparé) | **D - EXTERNAL SERVICE** | Isoler dans repo distinct |
| **rag-worker** | 52K | Node.js worker ingestion document | ❌ Non déployé | ❌ Non | **B - REFACTOR** | Déployer comme service séparé |
| **tests** | 84K | Tests vitest, jest, playwright | ⚠️ Partiellement | ❌ Non | **B - REFACTOR** | Nettoyer, garder essentiels |
| **scripts** | 97K | Scripts utilitaires & tests | ❌ Non (orphanés) | ❌ Non | **C - LEGACY** | Supprimer ou relocate |
| **architecture** | 123K | Documentation architecture | ⚠️ Référence seulement | ❌ Non | **B - REFACTOR** | Consolider en /docs |
| **docs** | 259K | Documentation générale | ⚠️ Référence seulement | ❌ Non | **B - REFACTOR** | Nettoyer, archiver ancien |
| **e2e** | 29K | Tests E2E | ⚠️ Partiellement | ❌ Non | **B - REFACTOR** | Actifs ou supprimer |
| **n8n** | 10K | n8n workflows/automatisations | ⚠️ Référence | ❌ Non | **D - EXTERNAL SERVICE** | Isoler ou supprimer |

---

## FICHIERS CRITIQUES (A - À CONSERVER)

| Fichier | Taille | Rôle | Production | Railway | Action |
|---------|--------|------|------------|---------|--------|
| **main.py** | 8K | Entrée Python Railway | ✅ Oui | ✅ Exécuté | Garder |
| **requirements.txt** | 512B | Dépendances Python | ✅ Oui | ✅ Utilisé | Garder |
| **Dockerfile** (root) | 1K | Build container Railway | ✅ Oui | ✅ Utilisé | Garder |
| **railway.toml** | 512B | Config Railway (root service) | ✅ Oui | ✅ Parsé | Garder |
| **package.json** | 4.5K | Dépendances npm (COMPROMIS) | ❌ Non exécuté | ❌ Non | Refactor |
| **package-lock.json** | 340K | Lock npm | ❌ Non utile | ❌ Non | Supprimer |
| **bun.lockb** | 193K | Lock bun | ❌ Non utile | ❌ Non | Supprimer |
| **.env.example** | - | Template variables env | ✅ Oui | ✅ Documentation | Garder |
| **.env.production.example** | - | Template production | ✅ Oui | ✅ Documentation | Garder |
| **.env.development.example** | - | Template développement | ✅ Oui | ✅ Documentation | Garder |
| **.gitignore** | - | Configuration git | ✅ Oui | ✅ Utilisé | Garder |
| **tsconfig.json** | 1K | Configuration TypeScript | ✅ Oui | ❌ Non | Garder |
| **vite.config.ts** | 1K | Config Vite build | ✅ Oui | ❌ Non | Garder |
| **tailwind.config.ts** | 4K | Config Tailwind CSS | ✅ Oui | ❌ Non | Garder |
| **jest.config.js** | 2K | Config Jest tests | ✅ Oui | ❌ Non | Garder |
| **vitest.config.ts** | 1K | Config Vitest tests | ✅ Oui | ❌ Non | Garder |
| **playwright.config.ts** | 2.5K | Config E2E tests | ✅ Oui | ❌ Non | Garder |
| **eslint.config.js** | 1K | Config linter | ✅ Oui | ❌ Non | Garder |
| **postcss.config.js** | 512B | Config PostCSS | ✅ Oui | ❌ Non | Garder |
| **components.json** | 512B | Shadcn components | ✅ Oui | ❌ Non | Garder |
| **vercel.json** | 1K | Config Vercel (DEAD) | ❌ Non utilisé | ❌ Non | Supprimer |
| **index.html** | 1.5K | HTML entry point | ✅ Oui | ❌ Non | Garder |

---

## FICHIERS TEMPORAIRES/DEBUG (C - À SUPPRIMER)

| Fichier | Taille | Raison | Marqueurs | Action |
|---------|--------|--------|-----------|--------|
| **manualObligationTest.js** | 6K | Test manuel obligation extraction | TEMPORARY | ❌ Supprimer |
| **server.js** (root) | 5K | Backup Express server | _start_original | ❌ Supprimer |
| **scripts/testObligationExtraction.js** | - | Test obligation engine | "TEMPORARY: obligation extraction test" | ❌ Supprimer |
| **scripts/runTestOnce.js** | - | Wrapper test Railway | Debug import | ❌ Supprimer |
| **scripts/migrate-logger.js** | - | Debug logger | Orphan script | ❌ Supprimer |
| **test_railway_ocr.sh** | 1.5K | Test script OCR Railway | Shell script debug | ❌ Supprimer |
| **.vercel-cache-bust** | 105B | Vercel cache config | DEAD | ❌ Supprimer |
| **.vercelignore** | 208B | Vercel ignore (unused) | DEAD | ❌ Supprimer |
| **vercel.json** | 1K | Vercel deployment config | DEAD | ❌ Supprimer |

---

## DOCUMENTATION (MIXED - B/C)

### À CONSOLIDER (B - REFACTOR)
- **README.md** - Garder (principal)
- **START_HERE.md** - Garder
- **SETUP_GUIDE.md** - Garder
- **DEPLOYMENT_GUIDE.md** - Garder
- **ROADMAP.md** - Garder
- **CHANGELOG.md** - Garder

### À ARCHIVER (C - LEGACY)
Tous les fichiers audit/rapport datés (210+ fichiers .md):
- AUDIT_*.md (15 fichiers)
- PHASE_*.md (18 fichiers)
- *_REPORT.md (30+ fichiers)
- ARCHITECTURAL_*.md, ARCHITECTURE_*.md (5+ fichiers)
- MVP_*.md (10+ fichiers)
- FREE_MODE_CONFIG.md
- ACTIVATION_*.md
- CORRECTIONS_*.md
- DIAGNOSTIC_*.md
- FIX_*.md
- SOLUTION_*.md
- TROUBLESHOOT_*.md
- CLEANUP_*.md
- etc.

**Action**: Créer /archive/DEPRECATED_DOCS/ et y déplacer tous les fichiers .md root sauf 5 mentionnés

---

## SCRIPTS SHELL (C - LEGACY)

| Script | Taille | Rôle | Utilisé | Action |
|--------|--------|------|---------|--------|
| **EXECUTE_DEPLOYMENT.sh** | 14K | Deploy helper | ❌ Non | ❌ Supprimer |
| **FINAL_CLEANUP.sh** | 16K | Cleanup script | ❌ Non | ❌ Supprimer |
| **MVP_CLEANUP_SCRIPT.sh** | 15K | MVP cleanup | ❌ Non | ❌ Supprimer |
| **PRAGMATIC_CLEANUP.sh** | 12K | Pragmatic cleanup | ❌ Non | ❌ Supprimer |
| **deploy-company-search.sh** | 5K | Search deploy | ❌ Non | ❌ Supprimer |
| **test_railway_ocr.sh** | 1.5K | OCR test | ❌ Non | ❌ Supprimer |

---

## FICHIERS SQL (B/C - MIXED)

### À GARDER (B - REFACTOR vers /supabase/migrations)
- Bien documentés et utilisés dans supabase/migrations/

### À ARCHIVER (C - À SUPPRIMER du root)
- **ADD_PROFILE_COLUMNS.sql**
- **FIX_DOCUMENTS_TABLE.sql**
- **FIX_DOCUMENT_STATUS_ENUM.sql**
- **FIX_INSCRIPTION_B2C.md**
- **FIX_ORPHAN_USERS.sql**
- **FIX_TRIGGER_DEFINITIVE.sql**
- **FIX_WIZARD_MODE_ENUM.sql**
- **DIAGNOSTIC_INSCRIPTION.sql**
- **QUICK_FIX_ALL_IN_ONE.sql**
- **cleanup-unreadable-content.sql**

**Raison**: Doublons avec /supabase/migrations/ (bien documentés là-bas)

---

## BRANCHES GIT

| Branche | Status | Raison | Action |
|---------|--------|--------|--------|
| **master** | ✅ Actif | Branche principale | Garder |
| **claude/add-express-server-p3y4b** | 🚀 Actif (current) | Session Claude en cours | Conserver |
| **claude/increase-chunk-size-3Poga** | ⏹️ Ancien | Feature branch archived | Garder (archive) |
| **claude/refactor-rag-ocr-w8qNi** | ⏹️ Ancien | Feature branch archived | Garder (archive) |

---

## RÉSUMÉ NETTOYAGE

### À CONSERVER ABSOLUMENT (A - CORE)
- /.github, /.claude, /.git
- /src (même si non déployé, c'est la base)
- /supabase
- /public
- Configuration Python (main.py, requirements.txt, Dockerfile, railway.toml)
- Config build & test (tsconfig, vite, tailwind, jest, vitest, playwright, eslint, postcss)
- Fichiers .env templates
- README principal, START_HERE, SETUP_GUIDE, DEPLOYMENT_GUIDE, ROADMAP, CHANGELOG

### À REFACTOR (B)
- /rag-worker → Déployer comme service séparé ou intégrer à /src
- /tests → Nettoyer, garder essentiels seulement
- /architecture → Consolider avec /docs
- /docs → Nettoyer, archiver documentation obsolète
- /e2e → Déterminer si actif, sinon supprimer
- package.json → Vérifier scripts (référencés mais non exécutés)

### À SUPPRIMER (C)
- /scripts/** (tous les test scripts debug)
- /n8n/ (isoler ou supprimer)
- Tous les fichiers audit/rapport/phase root (210+ .md)
- Tous les scripts shell de deployment (EXECUTE_DEPLOYMENT.sh, etc.)
- Fichiers SQL root (doublons avec /supabase/migrations)
- manualObligationTest.js, server.js (root)
- Vercel configs (vercel.json, .vercel-cache-bust, .vercelignore)
- package-lock.json, bun.lockb (inutiles si non utilisés)
- test_railway_ocr.sh

### À ISOLER (D)
- /ocr-service → Repo distinct ou sous-module
- /n8n → Repo distinct ou complètement supprimer

---

## DÉCOUVERTES CLÉS

### 1. Package.json Compromis
```json
"start": "node scripts/runTestOnce.js",
"_start_original": "node src/server.js",
"_note": "TEMPORARY: start script redirected to obligation extraction test"
```
- ❌ Pas exécuté en production (Python)
- ❌ Scripts temporaires pour test obligation
- ✅ Autres scripts valides (dev, build, lint, test)

### 2. 210+ Fichiers Audit/Rapport Root
Tous au format `PHASE_XX_REPORT.md`, `AUDIT_XX.md`, `*_COMPLETION.md`
- Tous datés et obsolètes
- Accumulation historique de documentation
- Aucun en production
- Bloat excessif

### 3. Duplication SQL
Fichiers SQL root = doublons de /supabase/migrations
- Propreté: consolider dans /supabase seulement

### 4. Tests Obligation Extraction
- testObligationExtraction.js → TEMPORARY, jamais exécuté
- manualObligationTest.js → TEMPORARY, debug
- runTestOnce.js → TEMPORARY, wrapper
- Tous injectés pour tester refactoring engine
- À nettoyer après validation

### 5. Fichiers Vercel Orphans
- vercel.json (DEAD)
- .vercelignore (DEAD)
- .vercel-cache-bust (DEAD)
- Railway est utilisé, pas Vercel

---

## TABLEAU SYNTHÉTIQUE FINAL

| Catégorie | Dossiers | Fichiers | Action | Impact |
|-----------|----------|----------|--------|--------|
| **A - CORE** | 7 | 20 | Garder | Production dépend |
| **B - REFACTOR** | 5 | ~50 | Restructurer | Technique mais non-critique |
| **C - LEGACY** | 1 | 220+ | Supprimer | Archive vielle docs |
| **D - EXTERNAL** | 2 | - | Isoler | Services externes |

**Total reduction**: 60-70% de fichiers inutiles possible
**Gain**: ~1MB+ déblocké (archive compression)
**Risque**: Minimal si sauvegarde d'abord

---

**Fin classification**
**Statut**: FINAL

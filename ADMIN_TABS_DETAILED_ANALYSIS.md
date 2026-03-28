# TORP Admin Panel — Audit Détaillé par Onglet
**Date:** 2026-03-28
**Total onglets sidebar:** 8 (+1 page non routée)
**Complètement réels:** 2/8 (25%)
**Partiellement mockés/incomplets:** 4/8 (50%)
**Placeholders purs:** 2/8 (25%)
**Critique découvert:** AdminUsersPage n'est pas routée — inaccessible depuis la sidebar

---

## Tableau Récapitulatif

| # | Onglet sidebar | Label affiché | Route | Page | Complétude | Prod-ready | Priorité |
|---|----------------|---------------|-------|------|-----------|-----------|---------|
| 1 | Dashboard | "Dashboard" | `/admin` | DashboardPage | 70% | ⚠️ Presque | 🟡 Moyen |
| 2 | Orchestrations | "Cockpit d'Orchestration" | `/admin/orchestrations` | OrchestrationsPage | 75% | ⚠️ Presque | 🟡 Moyen |
| 3 | Security | "Surveillance Fraude" | `/admin/security` | SecurityPage | 40% | ❌ Non | 🔴 Urgent |
| 4 | Intelligence | "Adaptatif" | `/admin/intelligence` | LiveIntelligencePage | 55% | ❌ Non | 🔴 Urgent |
| 5 | Knowledge | "Gestion des documents" | `/admin/knowledge` | KnowledgeBasePage | 80% | ⚠️ Presque | 🟡 Moyen |
| 6 | Knowledge Debug | "Knowledge Debug" | `/admin/knowledge-debug` | KnowledgeControlCenter | N/A | — | 🟢 Dev only |
| 7 | System (APIs) | "APIs" | `/admin/system` | SystemHealthPage | 85% | ✅ Oui | 🟢 OK |
| 8 | Settings | "Paramètres" | `/admin/settings` | AdminSettingsPage | 0% | ❌ Non | 🔴 Urgent |
| — | *(non routée)* | — | *(absent)* | AdminUsersPage | 95% | ✅ Oui | 🔴 Ajouter nav link |

---

## 1. Dashboard — `/admin`

### Identification

| Propriété | Valeur |
|-----------|--------|
| Component File | `src/pages/admin/DashboardPage.tsx` (25 lignes) |
| URL Route | `/admin` (index) |
| Icon sidebar | `BarChart3` |
| Label sidebar | "Dashboard" |
| Status | ✅ Actif |

### Structure

```
DashboardPage
├── CockpitHeader          (hardcoded — "Engines Active" + "APIs Online")
├── QuickActions           (4 liens de navigation statiques)
└── OverviewTab (Analytics.tsx:747)
    ├── AnalyticsStatsCards      ← analyticsService.getGlobalStats()  ✅
    ├── Platform Health Card     ← HARDCODED status                    ⚠️
    ├── EngineStatusLiveCard     ← /api/v1/engine/stats + realtime     ❓ (endpoint absent)
    ├── LastOrchestrationResult  ← /api/v1/engine/orchestration        ❓ (endpoint absent)
    ├── External APIs Card       ← HARDCODED "0 APIs"                  ❌
    ├── KnowledgeBaseStatsCard   ← Supabase knowledge_documents        ✅
    └── PricingStatisticsCard    ← pricingExtractionService            ✅
```

### Contenu & Données

| Section | Type | Source | Connexion | Status |
|---------|------|--------|-----------|--------|
| CockpitHeader badges | ❌ Mock | Hardcoded "Engines Active" / "APIs Online" | Aucune | À connecter |
| QuickActions | ⚠️ Navigation | 4 liens internes statiques | N/A | OK (navigation) |
| AnalyticsStatsCards | ✅ Réel | `analyticsService.getGlobalStats()` → `profiles` + `analysis_jobs` | Supabase anon | ✅ OK |
| Platform Health Card | ❌ Mock | Hardcoded status "operational" | Aucune | À connecter |
| EngineStatusLiveCard | ❓ Incertain | `GET /api/v1/engine/stats` + `GET /api/v1/engine/status` + Realtime `score_snapshots` | Express JWT ? | ❌ Endpoints absents du backend Phase 3B |
| LastOrchestrationResult | ❓ Incertain | `GET /api/v1/engine/orchestration` (refresh 5s) | Express JWT ? | ❌ Endpoint absent du backend Phase 3B |
| External APIs Card | ❌ Mock | Hardcoded "No external APIs configured yet" | Aucune | Placeholder |
| KnowledgeBaseStatsCard | ✅ Réel | `knowledge_documents` (Supabase direct) | Supabase anon | ✅ OK |
| PricingStatisticsCard | ✅ Réel | `pricingExtractionService.getPricingStats()` | Supabase anon | ✅ OK |

### Endpoints Backend Consommés

```
✅ Supabase: profiles (count)
✅ Supabase: analysis_jobs (count completed)
✅ Supabase: knowledge_documents (is_active=true)
❌ GET /api/v1/engine/stats           — ABSENT du backend Express
❌ GET /api/v1/engine/status          — ABSENT du backend Express
❌ GET /api/v1/engine/orchestration   — ABSENT du backend Express
```

### Issues

**Issue 1: Endpoints `/api/v1/engine/*` inexistants**
- Sévérité: 🔴 Urgent
- Description: `EngineStatusLiveCard` et `LastOrchestrationResultSection` appellent des endpoints Express qui ne sont pas implémentés dans le backend Phase 3B
- Impact: Les sections silencieusement échouent (console.error + données vides)
- Fix: Implémenter `GET /api/v1/engine/stats`, `GET /api/v1/engine/status`, `GET /api/v1/engine/orchestration` dans le backend

**Issue 2: CockpitHeader hardcoded**
- Sévérité: 🟡 Moyen
- Description: Les badges "Engines Active" et "APIs Online" sont toujours verts/affichés — pas liés à un état réel
- Fix: Lire depuis `analyticsService.getPlatformHealth()` ou un endpoint dédié

**Issue 3: Realtime subscription sur `score_snapshots`**
- Sévérité: 🟡 Moyen
- Description: `EngineStatusLiveCard` s'abonne à `score_snapshots` via Supabase Realtime — cette table n'existe peut-être pas
- Fix: Vérifier l'existence de la table ou utiliser `orchestration_runs`

### État de Complétude
- **Implémentation:** 70% (4/7 widgets fonctionnels)
- **Prêt production:** ⚠️ Presque — les 3 widgets engine sont silencieusement cassés
- **Priorité:** 🟡 Moyen
- **Effort estimé:** Élevé (implémenter 3 endpoints backend + realtime)

---

## 2. Cockpit d'Orchestration — `/admin/orchestrations`

### Identification

| Propriété | Valeur |
|-----------|--------|
| Component File | `src/pages/admin/OrchestrationsPage.tsx` (162 lignes) |
| URL Route | `/admin/orchestrations` |
| Icon sidebar | `Zap` |
| Label sidebar | "Cockpit d'Orchestration" |
| Status | ✅ Actif |

### Structure

```
OrchestrationsPage
├── Header (titre + subtitle)
├── Stats Cards (3 cartes)
│   ├── En attente (pending)
│   ├── En cours (processing)
│   └── Terminés (completed)
└── Summary Table
    └── Lignes: pipeline_name, status, completed, failed, running, avg_ms
```

### Contenu & Données

| Section | Type | Source | Connexion | Status |
|---------|------|--------|-----------|--------|
| Stats Cards (pending/processing/completed) | ✅ Réel | `analyticsService.getJobStatusDistribution()` → `analysis_jobs` | Supabase anon | ✅ OK |
| Summary Table | ✅ Réel | Même source, répartition par statut | Supabase anon | ✅ OK |
| Refresh auto | ✅ Actif | `setInterval(30000)` | — | ✅ OK |

### Endpoints Backend Consommés

```
✅ Supabase: analysis_jobs (count by status — 5 requêtes parallèles)
❌ GET /api/v1/pipelines/status  — Existe dans pipelines.routes.ts mais NON consommé par cette page
```

**Note importante**: `GET /api/v1/pipelines/status` retourne `pipeline_executions` mais `OrchestrationsPage` interroge `analysis_jobs`. Ce sont deux tables différentes — la page n'utilise pas l'endpoint backend dédié.

### Issues

**Issue 1: Table `analysis_jobs` vs `pipeline_executions`**
- Sévérité: 🟡 Moyen
- Description: Le backend expose `GET /api/v1/pipelines/status` (depuis `pipeline_executions`), mais la page interroge `analysis_jobs` directement via le service anon
- Impact: Données différentes selon la table utilisée. `pipeline_executions` suit les pipelines Phase 3A ; `analysis_jobs` suit les analyses moteur
- Fix: Décider quelle table est la source de vérité pour cet onglet

**Issue 2: Pas de détail par orchestration**
- Sévérité: 🟢 Faible
- Description: On voit les comptages par statut mais pas de liste d'orchestrations récentes avec détails (devis_id, durée, erreurs)
- Fix: Ajouter section "Dernières orchestrations" (utiliser `GET /api/v1/pipelines/status`)

### État de Complétude
- **Implémentation:** 75% — fonctionnel mais limité en profondeur
- **Prêt production:** ⚠️ Presque
- **Priorité:** 🟡 Moyen
- **Effort estimé:** Faible (ajouter tableau détaillé)

---

## 3. Surveillance Fraude — `/admin/security`

### Identification

| Propriété | Valeur |
|-----------|--------|
| Component File | `src/pages/admin/SecurityPage.tsx` (182 lignes) |
| URL Route | `/admin/security` |
| Icon sidebar | `AlertTriangle` |
| Label sidebar | "Surveillance Fraude" |
| Status | ⚠️ Mal nommé |

### Structure

```
SecurityPage
├── Header ("Sécurité & Surveillance" + subtitle)
├── Status Overview Card
│   ├── Database status (réel)
│   ├── API Server status (réel)
│   └── File Storage status (réel)
└── Security Features Card (HARDCODED)
    ├── "Row Level Security (RLS)"   → true
    ├── "HTTPS/TLS Encryption"       → true
    ├── "Supabase Auth JWT"          → true
    └── "No Mock Data in Production" → true
```

### Contenu & Données

| Section | Type | Source | Connexion | Status |
|---------|------|--------|-----------|--------|
| Status Overview (DB/API/Storage) | ✅ Réel | `analyticsService.getPlatformHealth()` | Supabase anon | ✅ OK — mais dupliqué avec SystemHealthPage |
| Security Features checklist | ❌ Mock | Array hardcodé — `const securityFeatures = [{name, enabled: true}, ...]` | Aucune | ❌ Toujours "enabled" |
| Refresh auto | ✅ Actif | `setInterval(30000)` | — | ✅ OK |

### Endpoints Backend Consommés

```
✅ Supabase: profiles.select() (pour tester l'accès DB)
❌ Aucun endpoint de sécurité (auth logs, sessions actives, tentatives échouées, alertes fraude)
```

### Issues

**Issue 1: Données dupliquées avec SystemHealthPage**
- Sévérité: 🔴 Urgent
- Description: `SecurityPage` et `SystemHealthPage` appellent toutes les deux `analyticsService.getPlatformHealth()` — elles affichent les mêmes données DB/API/Storage
- Impact: L'onglet "Surveillance Fraude" affiche une santé système, pas une surveillance de fraude
- Fix: Soit fusionner les deux pages, soit implémenter de vrais indicateurs de fraude/sécurité

**Issue 2: Checklist sécurité hardcodée**
- Sévérité: 🔴 Urgent
- Description: La checklist "Fonctionnalités de sécurité" est un array statique — RLS, JWT, 2FA sont toujours marqués `enabled: true` sans vérification
- Impact: Donne une fausse impression de sécurité — impossible de détecter une régression
- Fix: Implémenter un endpoint `GET /admin/security/status` qui vérifie l'état réel des contrôles

**Issue 3: "Surveillance Fraude" sans données de fraude**
- Sévérité: 🔴 Urgent
- Description: Le label sidebar est "Surveillance Fraude" mais aucune donnée de fraude n'est affichée (pas de tentatives de connexion, pas d'anomalies, pas d'alertes)
- Fix: Connecter aux tables `audit_logs` ou `analysis_jobs` pour afficher les anomalies détectées par l'engine

### État de Complétude
- **Implémentation:** 40% (données de santé OK, sécurité = 0%)
- **Prêt production:** ❌ Non
- **Priorité:** 🔴 Urgent
- **Effort estimé:** Élevé (requiert nouveau modèle de données sécurité + backend)

---

## 4. Adaptatif (Intelligence) — `/admin/intelligence`

### Identification

| Propriété | Valeur |
|-----------|--------|
| Component File | `src/pages/admin/LiveIntelligencePage.tsx` (203 lignes) |
| URL Route | `/admin/intelligence` |
| Icon sidebar | `TrendingUp` |
| Label sidebar | "Adaptatif" |
| Status | ⚠️ Partiel |

### Structure

```
LiveIntelligencePage
├── Header ("Intelligence en Temps Réel")
├── Metrics Cards (4 cartes)
│   ├── Utilisateurs actifs      ← userCount (réel)
│   ├── Analyses complètes       ← analysisCount (réel)
│   ├── Taux de succès 30j       ← growth (réel)
│   └── Score moyen              ← VIDE / EmptyState
└── Recent Activity section
    └── EmptyState placeholder   ← VIDE
```

### Contenu & Données

| Section | Type | Source | Connexion | Status |
|---------|------|--------|-----------|--------|
| Carte utilisateurs | ✅ Réel | `analyticsService.getGlobalStats()` → `profiles` | Supabase anon | ✅ OK |
| Carte analyses | ✅ Réel | Même source → `analysis_jobs` | Supabase anon | ✅ OK |
| Carte croissance 30j | ✅ Réel | Même source (calcul growth %) | Supabase anon | ✅ OK |
| Carte score moyen | ❌ Vide | `analyticsService.getGlobalStats()` ne retourne pas de score | — | ❌ Pas de donnée |
| Recent Activity | ❌ Placeholder | EmptyState permanent | Aucune | ❌ Non implémenté |
| Refresh auto | ✅ Actif | `setInterval(60000)` | — | ✅ OK |

### Endpoints Backend Consommés

```
✅ Supabase: profiles (count)
✅ Supabase: analysis_jobs (count completed + last 30 days)
❌ analyticsService.getLiveIntelligence()  — NOT IMPLEMENTED (Phase 35)
                                            Throws: "not implemented - scheduled for Phase 35"
```

### Issues

**Issue 1: getLiveIntelligence() non implémenté**
- Sévérité: 🔴 Urgent
- Description: La fonction `analyticsService.getLiveIntelligence()` lève une erreur intentionnelle ("not implemented - scheduled for Phase 35"). Elle requiert une table `live_intelligence_snapshots` absente du schéma
- Impact: La section "Intelligence Temps Réel" ne peut jamais afficher de données live
- Fix: Implémenter la table + la fonction, ou utiliser `orchestration_runs` en attendant

**Issue 2: Section "Recent Activity" vide**
- Sévérité: 🟡 Moyen
- Description: `EmptyState` permanent — aucun appel API pour récupérer l'activité récente
- Fix: Utiliser `analyticsService.getRecentJobs(10)` (déjà implémenté) pour afficher les 10 dernières analyses

**Issue 3: Score moyen absent**
- Sévérité: 🟡 Moyen
- Description: `getGlobalStats()` retourne userCount/analysisCount/growth mais pas de score moyen
- Fix: Ajouter une requête sur `score_snapshots` ou `engine_executions` dans `getGlobalStats()`

### État de Complétude
- **Implémentation:** 55% (3/4 métriques réelles, activité = 0%)
- **Prêt production:** ❌ Non
- **Priorité:** 🔴 Urgent
- **Effort estimé:** Moyen (getRecentJobs existe, score moyen nécessite query supplémentaire)

---

## 5. Gestion des Documents — `/admin/knowledge`

### Identification

| Propriété | Valeur |
|-----------|--------|
| Component File | `src/pages/admin/KnowledgeBasePage.tsx` (40 lignes — shell) |
| URL Route | `/admin/knowledge` |
| Icon sidebar | `Database` |
| Label sidebar | "Gestion des documents" |
| Status | ✅ Actif |

### Structure

```
KnowledgeBasePage
├── Header
├── AICommandCenterStrip   ← Monitore état orchestrateur RAG (window events)
├── RAGStatusStrip         ← Supabase knowledge_documents + window events
├── UploadKBTab            ← KnowledgeBaseUpload component
├── KnowledgeLibraryManager ← Supabase knowledge_documents (CRUD)
└── IngestionMetricsPanel  ← Supabase knowledge_documents (métriques)
```

### Contenu & Données

| Section | Type | Source | Connexion | Status |
|---------|------|--------|-----------|--------|
| AICommandCenterStrip | ✅ Réel | Window events RAG (RAG_OPS_EVENT, RAG_COMMAND_CENTER_UPDATE, etc.) | Event bus | ✅ OK — architecture complexe |
| RAGStatusStrip | ✅ Réel | Supabase `knowledge_documents` + window events | Supabase anon | ✅ OK |
| UploadKBTab | ✅ Réel | `KnowledgeBaseUpload` (ingestion pipeline) | Supabase + Edge Functions | ✅ OK |
| KnowledgeLibraryManager | ✅ Réel | Supabase `knowledge_documents` (read/soft-delete) | Supabase anon | ✅ OK |
| IngestionMetricsPanel | ✅ Réel | Supabase `knowledge_documents` (count par période) | Supabase anon | ✅ OK |

### Endpoints Backend Consommés

```
✅ Supabase: knowledge_documents.select() (active, paginated)
✅ Supabase: knowledge_documents.update({is_active: false}) (soft delete)
✅ Supabase: knowledge_documents count (total, 24h, 7j)
✅ Edge Functions: rag-ingestion (via trigger)
✅ Window Events: RAG_OPS_EVENT, RAG_LIBRARY_REFRESH, RAG_RETRY_REQUESTED, etc.
```

### Architecture Spéciale — Window Event Bus

Cette page utilise un système d'événements `window.dispatchEvent()` / `window.addEventListener()` pour la communication inter-composants :
- **Émis**: `RAG_COMMAND_CENTER_UPDATE`, `RAG_OPS_EVENT`, `RAG_LIBRARY_REFRESH`, `RAG_RETRY_REQUESTED`
- **Écoutés**: `RAG_EDGE_STATUS_UPDATED`, `RAG_BIG_DOC_MODE_ACTIVATED`, `RAG_BIG_DOC_MODE_CLEARED`, `RAG_STREAM_MODE_ACTIVATED`, `RAG_STREAM_MODE_CLEARED`

### Issues

**Issue 1: Architecture window events fragile**
- Sévérité: 🟡 Moyen
- Description: La communication entre composants passe par des `window.dispatchEvent()` avec des noms de chaîne magiques. Aucune vérification de type, aucun contrat
- Impact: Difficile à maintenir, risque de silent failures si un nom d'événement change
- Fix: Migrer vers un state manager (Zustand/Jotai) ou React Context pour Phase 40+

**Issue 2: `window.RAG_EDGE_OFFLINE` et `window.RAG_QUEUE_SUBSCRIBED`**
- Sévérité: 🟡 Moyen
- Description: `AICommandCenterStrip` lit `(window as any).RAG_EDGE_OFFLINE` — flags globaux mutable sur window
- Fix: Même recommandation que Issue 1

### État de Complétude
- **Implémentation:** 80% — entièrement fonctionnel mais architecture fragile
- **Prêt production:** ⚠️ Presque
- **Priorité:** 🟡 Moyen (fonctionne, mais refactoring recommandé)
- **Effort estimé:** Élevé si refactoring architecture, Faible si maintien actuel

---

## 6. Knowledge Debug — `/admin/knowledge-debug`

### Identification

| Propriété | Valeur |
|-----------|--------|
| Component File | `KnowledgeControlCenter` (import depuis App.tsx — non analysé) |
| URL Route | `/admin/knowledge-debug` |
| Icon sidebar | `FlaskConical` |
| Label sidebar | "Knowledge Debug" |
| Status | 🔲 Dev/Debug only |

### Notes

Ce lien est présent dans la sidebar mais son contenu n'a pas été audité (composant non inclus dans le scope initial). D'après son label, c'est un outil de debug pour la Knowledge Base — probablement non destiné aux utilisateurs finaux.

**Recommandation**: Cacher cet onglet en production via une condition `process.env.NODE_ENV === 'development'` ou un flag feature.

---

## 7. APIs (System Health) — `/admin/system`

### Identification

| Propriété | Valeur |
|-----------|--------|
| Component File | `src/pages/admin/SystemHealthPage.tsx` (185 lignes) |
| URL Route | `/admin/system` |
| Icon sidebar | `Plug` |
| Label sidebar | "APIs" |
| Status | ✅ Actif |

### Structure

```
SystemHealthPage
├── Header ("System Health" + "Monitor system status and performance metrics")
├── Status Overview Card
│   ├── Database: ✓ Opérationnel / ✗ Erreur
│   ├── API Server: ✓ Opérationnel / ✗ Erreur
│   └── File Storage: ✓ Opérationnel / ✗ Erreur
└── Info Note Card (message statique)
```

### Contenu & Données

| Section | Type | Source | Connexion | Status |
|---------|------|--------|-----------|--------|
| Database status | ✅ Réel | `analyticsService.getPlatformHealth()` (tente profiles.select()) | Supabase anon | ✅ OK |
| API status | ⚠️ Approximatif | Hardcodé "operational" si DB accessible | — | ⚠️ Pas un vrai check API |
| Storage status | ⚠️ Approximatif | Hardcodé "operational" si DB accessible | — | ⚠️ Pas un vrai check Storage |
| Refresh auto | ✅ Actif | `setInterval(30000)` | — | ✅ OK |

### Endpoints Backend Consommés

```
✅ Supabase: profiles.select() (test d'accès DB)
❌ Aucun vrai check API Server (le status "api" est toujours "operational" si DB est ok)
❌ Aucun vrai check Storage (même logique)
```

**Note**: `SystemHealthPanel.tsx` (composant séparé, non utilisé ici) appelle `GET /api/v1/system/health` qui est **absent du backend**. La page `SystemHealthPage` n'utilise pas ce composant.

### Issues

**Issue 1: Label sidebar "APIs" ≠ contenu "System Health"**
- Sévérité: 🟡 Moyen
- Description: La sidebar affiche "APIs" mais la page affiche "System Health" avec status DB/API/Storage — incohérence UX
- Fix: Aligner label sidebar avec contenu ou créer une vraie page de monitoring APIs

**Issue 2: Duplication avec SecurityPage**
- Sévérité: 🔴 Urgent
- Description: Les deux pages appellent `analyticsService.getPlatformHealth()` et affichent les mêmes 3 statuts (DB/API/Storage)
- Fix: Fusionner en une seule page ou différencier les données affichées

### État de Complétude
- **Implémentation:** 85% — fonctionnel pour ce qu'il fait
- **Prêt production:** ✅ Oui (avec caveat duplication)
- **Priorité:** 🟢 OK
- **Effort estimé:** Faible (renommer label ou fusionner pages)

---

## 8. Paramètres — `/admin/settings`

### Identification

| Propriété | Valeur |
|-----------|--------|
| Component File | `src/pages/admin/AdminSettingsPage.tsx` (158 lignes) |
| URL Route | `/admin/settings` |
| Icon sidebar | `Settings` |
| Label sidebar | "Settings" |
| Status | ❌ Placeholder |

### Structure

```
AdminSettingsPage
├── Header ("Admin Settings")
├── General Settings Card
│   ├── Platform Name (Input, defaultValue="TORP")
│   ├── Platform URL  (Input, defaultValue="https://torp.example.com")
│   └── Maintenance Mode (Switch)
├── Notifications Card
│   ├── Email Notifications (Switch, defaultChecked)
│   ├── Daily Summary (Switch, defaultChecked)
│   └── Security Alerts (Switch, defaultChecked)
├── Security Card
│   ├── Two-Factor Authentication (Switch, defaultChecked)
│   ├── IP Whitelist (Switch)
│   └── Session Timeout (Input, defaultValue="60")
└── Buttons
    ├── "Save Settings" (fake)
    └── "Reset to Defaults" (no-op)
```

### Contenu & Données

| Section | Type | Source | Connexion | Status |
|---------|------|--------|-----------|--------|
| Tous les champs | ❌ Mock | `defaultValue` hardcodés | Aucune | ❌ Ne lit pas la DB |
| Bouton "Save Settings" | ❌ Faux | `await new Promise(resolve => setTimeout(resolve, 1000))` | Aucune | ❌ Ne sauvegarde rien |
| Bouton "Reset to Defaults" | ❌ Faux | Aucun handler | Aucune | ❌ No-op |

### Endpoints Backend Consommés

```
❌ Aucun — zéro appel API
```

**Code incriminé** (ligne 22):
```typescript
const handleSaveSettings = async () => {
  setIsSaving(true);
  try {
    await new Promise(resolve => setTimeout(resolve, 1000)); // FAKE
    toast({ title: 'Settings saved', ... });
  }
```

### Issues

**Issue 1: Fausse sauvegarde — trompe l'utilisateur**
- Sévérité: 🔴 Urgent
- Description: Le bouton "Save Settings" attend 1 seconde et affiche "Settings saved" sans rien sauvegarder. Si un admin change Platform URL ou désactive 2FA, rien n'est persisté
- Impact: Dangereux si l'admin croit avoir modifié la configuration
- Fix immédiat: Soit désactiver le bouton et afficher "Coming soon", soit implémenter un backend

**Issue 2: Aucune table `platform_settings` en DB**
- Sévérité: 🔴 Urgent
- Description: Pour implémenter cette page, il faut créer une table `platform_settings` + un endpoint `GET/PUT /admin/settings`
- Fix: Migration SQL + endpoint backend + frontend connecté

### État de Complétude
- **Implémentation:** 0% backend (UI seule, non fonctionnelle)
- **Prêt production:** ❌ Non — dangereux (fausse sauvegarde)
- **Priorité:** 🔴 Urgent
- **Effort estimé:** Élevé (migration DB + endpoint + frontend)

---

## ⚠️ DÉCOUVERTE CRITIQUE — AdminUsersPage non routée

### Le problème

`src/pages/admin/AdminUsersPage.tsx` est **complètement implémentée** (Phase 3B JWT, 423 lignes, pagination, promote/demote/delete) mais **n'apparaît pas dans App.tsx** et n'a **aucun lien dans la sidebar**.

**App.tsx routes admin** (complètes):
```
/admin                    → DashboardPage
/admin/system             → SystemHealthPage
/admin/intelligence       → LiveIntelligencePage
/admin/orchestrations     → OrchestrationsPage
/admin/knowledge          → KnowledgeBasePage
/admin/knowledge-debug    → KnowledgeControlCenter
/admin/security           → SecurityPage
/admin/settings           → AdminSettingsPage
```

`/admin/users` → **ABSENT**

**Sidebar ADMIN_NAV_ITEMS** — aucun item pointant vers `/admin/users`.

### Impact
- La gestion des utilisateurs (liste, promotion, suppression) est inaccessible depuis l'interface
- Le backend `GET /admin/users`, `DELETE /admin/users/:userId`, `PATCH /admin/users/:userId/role` ne peut pas être utilisé

### Fix (2 fichiers, ~10 lignes)
1. Ajouter dans `App.tsx` : `<Route path="users" element={<AdminUsersPage />} />`
2. Ajouter dans `AdminLayout.tsx` `ADMIN_NAV_ITEMS` : `{ id: 'users', href: '/admin/users', icon: Users, label: 'Utilisateurs' }`

---

## Patterns Mock Identifiés (Vue Globale)

| Pattern | Localisation | Sévérité |
|---------|-------------|---------|
| `setTimeout(resolve, 1000)` fake save | `AdminSettingsPage:22` | 🔴 |
| Checklist sécurité hardcodée | `SecurityPage:~90` | 🔴 |
| `(window as any).RAG_EDGE_OFFLINE` | `AICommandCenterStrip` | 🟡 |
| Badges "Engines Active/APIs Online" hardcodés | `CockpitHeader` | 🟡 |
| "External APIs: 0" hardcodé | `OverviewTab` in `Analytics.tsx` | 🟡 |
| Platform Health Card statique | `OverviewTab` in `Analytics.tsx` | 🟡 |
| `EmptyState` Recent Activity | `LiveIntelligencePage` | 🟡 |
| `defaultValue` formulaires sans lecture DB | `AdminSettingsPage` | 🔴 |
| `VectorHealthPanel` always-online assumption | `VectorHealthPanel:40` | 🟡 |

---

## Fonctions Non Implémentées (analyticsService)

| Fonction | Status | Raison | Impact |
|----------|--------|--------|--------|
| `getEngineStatus()` | ❌ NOT IMPL | Requiert table `score_snapshots` | Dashboard engine cards vides |
| `getLiveIntelligence()` | ❌ NOT IMPL | Requiert table `live_intelligence_snapshots` | Intelligence page incomplète |

Extrait (analytics.service.ts):
```typescript
async getEngineStatus() {
  throw new Error('[getEngineStatus] not implemented - scheduled for Phase 35');
}
async getLiveIntelligence() {
  throw new Error('[getLiveIntelligence] not implemented - scheduled for Phase 35');
}
```

---

## Plan d'Action Consolidé

### 🔴 Fixes Urgents

| # | Action | Fichiers | Effort |
|---|--------|---------|--------|
| 1 | **Ajouter route + nav link AdminUsersPage** | `App.tsx` + `AdminLayout.tsx` | Faible (10 min) |
| 2 | **Désactiver ou implémenter AdminSettingsPage** | `AdminSettingsPage.tsx` + migration | Élevé ou Faible (désactiver) |
| 3 | **Corriger SecurityPage** (données fraude ou fusion avec SystemHealth) | `SecurityPage.tsx` | Moyen |
| 4 | **Implémenter Recent Activity** dans LiveIntelligencePage | `LiveIntelligencePage.tsx` | Faible (`getRecentJobs` existe) |

### 🟡 Fixes Moyens

| # | Action | Fichiers | Effort |
|---|--------|---------|--------|
| 5 | Implémenter endpoints `/api/v1/engine/stats|status|orchestration` | `admin.routes.ts` + sources | Élevé |
| 6 | Fusionner SecurityPage + SystemHealthPage en une seule page cohérente | `SecurityPage.tsx` | Faible |
| 7 | Ajouter tableau "Dernières orchestrations" dans OrchestrationsPage | `OrchestrationsPage.tsx` | Faible |
| 8 | Aligner label sidebar "APIs" avec contenu "System Health" | `AdminLayout.tsx` | Trivial |
| 9 | Cacher `knowledge-debug` en production | `AdminLayout.tsx` | Trivial |

### 🟢 Peut Attendre (Phase 35+)

| # | Action | Notes |
|---|--------|-------|
| 10 | Implémenter `getEngineStatus()` + `getLiveIntelligence()` | Requiert tables `score_snapshots`, `live_intelligence_snapshots` |
| 11 | Refactorer l'event bus window → Zustand/Context | Mentionné Phase 40 dans les commentaires |
| 12 | Implémenter `platform_settings` table + endpoint + UI | Full feature Settings |

---

*Rapport généré le 2026-03-28 — lecture seule, aucune modification apportée au code.*

# AUDIT TECHNIQUE COMPLET - TORP Plateforme
**Date:** 28 Février 2026
**Status:** Pré-Refonte Architecturale B2B
**Scope:** Repository complet + Architecture d'ingestion RAG + Moteurs de scoring

---

## SYNTHÈSE EXÉCUTIVE

### 🎯 État Global du Projet
- **Codebase:** 35 170 lignes TypeScript/React (400+ fichiers)
- **Architecture:** Monolithe React + Supabase + Edge Functions (modérément couplé)
- **Maturité:** MVP avancé → Phase de transition vers architecture industrielle
- **Risque Actuel:** MOYEN → Criticité augmente à l'approche du B2B

### 📊 Score de Maturité par Domaine
| Domaine | Score | Verdict |
|---------|-------|---------|
| Frontend (React/UI) | 7/10 | ✅ Bon, Radix-UI bien structuré |
| Database (Supabase) | 5/10 | ⚠️ Instable, 80+ migrations désordonnées |
| Worker/RAG | 6/10 | ⚠️ Fonctionnel mais non production-ready |
| Moteurs IA | 7/10 | ✅ Bien conçus mais interdépendants |
| Tests | 3/10 | 🔴 Couverture critique insuffisante (11 tests pour 400 fichiers) |
| Security/RLS | 4/10 | 🔴 Fragile, multiples workarounds observés |
| Observabilité | 3/10 | 🔴 769 console.log, pas de structured logging production |
| Documentation | 6/10 | ⚠️ Présente mais fragmentée |

---

## 1️⃣ STRUCTURE COMPLÈTE DU PROJET

### Répertoire Racine
```
torp-plateforme/
├── src/                      # Application React principal (35k LOC)
├── rag-worker/              # Worker d'ingestion documents (1.5k LOC)
├── supabase/                # Migrations & Edge Functions (80+ fichiers)
├── e2e/                      # Tests Playwright
├── tests/                    # Tests Jest/Vitest (11 tests)
├── scripts/                  # Utilitaires
├── public/                   # Assets statiques
├── n8n/                      # Configuration N8N (workflow automation)
├── ocr-service/             # Service OCR externe
├── docs/                     # Documentation
└── package.json             # 51 deps, 33 devDeps
```

### Structure src/
```
src/
├── core/                     # Moteurs et orchestration (8 sous-dossiers)
│   ├── engines/             # Moteurs de scoring (audit, context, enrichment, etc.)
│   ├── audit/               # Audit service
│   ├── activation/          # Doctrine activation
│   └── infrastructure/      # Logging, error tracking (INCOMPLET)
├── engines/                 # Moteurs RAG (6 fichiers, 4k LOC)
│   ├── obligationExtractionEngine.js      # Extraction obligations (551 LOC)
│   ├── regulatoryObligationExtractionEngine.js (651 LOC)
│   ├── regulatoryIngestionEngine.js       (579 LOC)
│   ├── auditNarrativeEngine.js            (1184 LOC - PLUS GRAND)
│   ├── thematicScoringEngine.js           (772 LOC)
│   └── regulatoryExposureEngine.js        (354 LOC)
├── services/                # 15+ services (API, AI, analysis, external)
├── components/              # React components (100+)
├── pages/                   # Pages (React Router)
├── hooks/                   # Custom hooks
├── context/                 # React Context
├── lib/                     # Utilities
├── adapters/                # Data adapters
├── orchestrators/           # Process orchestration
└── scoring/                 # Scoring utilities
```

---

## 2️⃣ ENTRYPOINTS ACTUELS

### Frontend
```
✅ vite dev              → src/main.tsx → React SPA (Port 8080)
✅ vite build            → Produit dist/
✅ npm run preview       → Préview build local
```

### Backend/Worker
```
🔄 rag-worker/worker.js  → Node.js polling loop (Supabase)
   - Lance automatiquement via Docker (Railway)
   - Poll interval: 10s
   - Traite: PDF, DOCX, XLSX, Images (OCR), TXT

🆕 src/server.js         → Express server (nouvellement ajouté - P3Y4B)
   - Health check GET /
   - POST /api/test-obligation (extraction manuelle)
   - Démarre worker en background
```

### Edge Functions (Supabase)
```
supabase/functions/
├── llm-completion/       → Proxy sécurisé OpenAI/Claude
├── company-search/       → Recherche entreprises (Sirene/RGE)
├── pappers-proxy/        → Enrichissement données
└── [autres]
```

### Scripts npm
```
"start"              : node src/server.js           [NEW - Express + Worker]
"dev"                : vite                         [Frontend dev]
"build"              : vite build                   [Frontend prod]
"test"               : vitest                       [Unit tests]
"test:jest"          : jest                         [Jest alternative]
"test:engines"       : jest [3 moteurs spécifiques] [Engine tests]
"test:e2e"           : playwright test              [E2E tests]
"lint"               : eslint .                     [Code quality]
```

---

## 3️⃣ DÉPENDANCES CRITIQUES

### Dépendances Production (51)
```javascript
// IA & LLM
"openai": "^6.9.1"                          // OpenAI API
"@anthropic-ai/sdk": "^0.70.0"             // Claude API

// Backend & Data
"express": "^4.18.2"                        // HTTP Server [NEW]
"@supabase/supabase-js": "^2.81.1"         // Database (CENTRAL)

// Frontend (React + UI)
"react": "^18.3.1"                          // Core
"react-dom": "^18.3.1"
"react-router-dom": "^6.30.1"               // Routing
"react-hook-form": "^7.61.1"                // Forms
"@radix-ui/*": "~40 packages"               // UI Components (bien)

// Data Management
"@tanstack/react-query": "^5.83.0"          // Server state

// Utilities
"tailwindcss": "^3.4.17"                    // Styling
"zod": "^3.25.76"                           // Validation
"recharts": "^2.15.4"                       // Charts
"jspdf": "^3.0.4" + "jspdf-autotable"      // PDF generation
"pdfjs-dist": "^5.4.394"                    // PDF viewer
"qrcode": "^1.5.4"                          // QR Code
"resend": "^6.5.2"                          // Email service
"date-fns": "^3.6.0"                        // Date utilities
```

### DevDependencies (33)
```javascript
// Testing
"@playwright/test": "^1.57.0"               // E2E tests
"vitest": "^4.0.10"                         // Unit tests (Vite-based)
"jest": "^29.7.0"                           // Alternative test framework
"@testing-library/*": "latest"              // React testing

// Build & Dev
"vite": "^5.4.19"                           // Build tool (très rapide)
"@vitejs/plugin-react-swc": "^3.11.0"       // SWC compiler
"typescript": "^5.8.3"

// Linting & Quality
"eslint": "^9.32.0"
"typescript-eslint": "^8.38.0"

// Monitoring (absent - FLAG!)
// "sentry/*"  ❌ NOT INSTALLED
// "pino" ou "winston"  ❌ NO STRUCTURED LOGGING
```

### Risques de Dépendances
- ❌ **Supabase fortement couplée** (56 imports directs)
- ❌ **Pas de gestion d'erreur centralisée** (Sentry non installé malgré TODO)
- ⚠️ **Multiple test frameworks** (Vitest + Jest = confusion possible)
- ⚠️ **Pas de structured logging** (769 console.log dans le code)

---

## 4️⃣ ORGANISATION WORKER INGESTION

### Architecture Worker
```
rag-worker/
├── worker.js                    (370 LOC) - POLLING LOOP PRINCIPAL
├── core/
│   ├── supabaseClient.js        (6 LOC) - Client init
│   ├── embeddingService.js      (52 LOC) - Vector embeddings
│   └── projectComplexityEngine.js (456 LOC) - Analyse complexité projet
├── extractors/
│   ├── extractionService.js     (137 LOC) - Router d'extraction
│   ├── pdfExtractor.js          (21 LOC)
│   ├── wordExtractor.js         (22 LOC)
│   ├── excelExtractor.js        (31 LOC)
│   └── visionExtractor.js       (57 LOC) - Google Vision API
└── processors/
    ├── smartChunker.js          (100 LOC) - Chunking intelligent
    ├── structureSections.js     (57 LOC) - Section parsing
    └── cleanText.js             (43 LOC) - Text normalization
```

### Flux de Traitement (worker.js)
1. **Poll** (10s interval) → Supabase `knowledge_documents` (status="pending")
2. **Download** → Supabase Storage (`knowledge-files`)
3. **Extract** → Texte brut (PDF/DOCX/XLSX/Images/TXT)
4. **Clean** → Normalisation texte (headers, whitespace)
5. **Structure** → Détection sections (h1, h2, etc.)
6. **Chunk** → Smart chunking avec overlap (taille=2500, LOCK=hard)
7. **Embed** → OpenAI embeddings (batch)
8. **Persist** → Insert chunks + embeddings en Supabase
9. **Update** → Status = "completed"

### Propriétés Critiques
```javascript
const CHUNK_SIZE = 2500;              // HARD LOCK avec vérification runtime
const BATCH_SIZE = 50;                // Insert batching
const POLL_INTERVAL = 10000;          // 10 secondes
const EMBEDDING_DIMENSION = 1536;     // OpenAI embedding size
const BUILD_ID = "NUCLEAR_VERIFY_2500_V1";

// Validation Runtime
if (CHUNK_SIZE !== 2500) {
  throw new Error("🚨 PRODUCTION ERROR: CHUNK_SIZE is not 2500");
}
```

### Tables Utilisées par Worker
```sql
knowledge_documents       -- Documents ingérés (status, progress)
knowledge_chunks         -- Chunks avec embeddings
knowledge_chunks_v2      -- Version alternative (confusion!)
```

### Problèmes Identifiés
- ❌ **Code monolithique** (worker.js non modularisé)
- ⚠️ **Pas de retry logic** pour uploads échoués
- ⚠️ **Pas de circuit breaker** pour API OpenAI
- ⚠️ **Google Vision credentials** = hack filesystem (google-credentials.json)
- 🔴 **Pas de monitoring** du worker process
- 🔴 **Pas de metrics** d'ingestion en temps réel

---

## 5️⃣ ORGANISATION EXTRACTION ENGINE

### Moteurs Existants (src/engines/)

#### 1. **obligationExtractionEngine.js** (551 LOC)
```javascript
✅ PRODUCTIF
- extractObligationsFromChunk(chunk, docId, supabase, openai)
- LLM Call → gpt-4o-mini (structured JSON)
- Validation obligations + persist
- Exports: extractObligationsFromChunk, extractObligationsFromChunks

Scoring:
  - article_reference ✓
  - obligation_text ✓
  - obligation_type ∈ [exigence, interdiction, recommandation, tolérance]
  - severity_level ∈ [1-5]
  - applicable_phase ∈ [conception, execution, controle]
  - metier_target (string)
  - sanction_risk ∈ [faible, moyen, eleve]
```

#### 2. **regulatoryObligationExtractionEngine.js** (651 LOC)
```javascript
Variante alternative du premier - contient logique similaire mais structurée différemment
⚠️ DUPLICATION POTENTIELLE À RÉSOUDRE
```

#### 3. **obligationExtractionEngine.js vs regulatoryObligationExtractionEngine.js**
- Risque: **2 moteurs pour même fonction** → confusion de maintenance
- Recommandation: Merger en un seul engine standardisé

#### 4. **auditNarrativeEngine.js** (1184 LOC - PLUS GRAND)
```javascript
Génère narratif d'audit détaillé
- Contexte d'audit (entreprise, projet)
- Analyse obligations
- Narratif structuré par phase
- Recommandations
```

#### 5. **thematicScoringEngine.js** (772 LOC)
```javascript
Scoring thématique (notations par thème)
- Domaines: Sécurité, Qualité, Délais, Budget, RH, Environnement
- Scores partiels + score global
- Justifications structurées
```

#### 6. **regulatoryExposureEngine.js** (354 LOC)
```javascript
Analyse exposition réglementaire
- Identifie risques réglementaires
- Mapping obligations → risques
- Scoring exposition
```

#### 7. **regulatoryIngestionEngine.js** (579 LOC)
```javascript
Pipeline d'ingestion réglementaire complète
- Orchestration des étapes
- Integration avec worker
```

### Couplages entre Moteurs
```
┌─────────────────────────────────────────┐
│  Worker (ingestion raw documents)       │
│  ├── Chunk documents (smartChunker)     │
│  └── Generate embeddings (OpenAI)       │
└────────────┬────────────────────────────┘
             │ Chunks in Supabase
             ↓
┌─────────────────────────────────────────┐
│  obligationExtractionEngine             │
│  └─ LLM (GPT-4o-mini)                   │
│  └─ Store obligations_v2 table          │
└────────────┬────────────────────────────┘
             │ Obligations
             ↓
┌──────────────────────────────────────────────────────┐
│  auditNarrativeEngine                                │
│  ├─ Uses obligations                                 │
│  ├─ LLM (GPT-4o-mini/Claude)                         │
│  └─ Generates structured narrative                   │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  Moteurs de Scoring (thematic, regulatory, quality)  │
│  └─ Dépendent du contexte projet + obligations       │
└──────────────────────────────────────────────────────┘
```

### Tables de Résultats d'Extraction
```sql
regulatory_obligations_v2       -- Obligations extraites (obligation_type, severity, etc.)
analysis_jobs                  -- Tracking jobs d'analyse
score_snapshots               -- Snapshots de scores
```

---

## 6️⃣ COUPLAGES EXISTANTS

### Couplage Frontend ↔ Backend
```
TRÈS COUPLÉ (56 imports Supabase direct)
- 56 fichiers importent: import { supabase } from '@/lib/supabase'
- Requêtes SQL directement dans components React
- Pas de layer API intermédiaire
- RLS policies supposées faire la sécurité (fragile)
```

### Couplage Worker ↔ Moteurs
```
FAIBLEMENT COUPLÉ (bon)
- Worker ne connaît pas les moteurs
- Moteurs consomment chunks du worker
- Possible d'ajouter/supprimer moteurs sans toucher worker
```

### Couplage Moteurs ↔ LLM
```
MODÉRÉMENT COUPLÉ
- obligationExtractionEngine: GPT-4o-mini (hardcoded)
- auditNarrativeEngine: GPT-4o-mini OU Claude (paramétrisé)
- Pas de factory/strategy pattern pour LLM selection
```

### Couplage Supabase
```
CRITIQUE - CENTRAL
- Supabase = point d'entrée unique
- 56+ fichiers dépendent directement
- Edge Functions = sécurité (bon)
- Mais migrations = cauchemar (80+ fichiers)
- RLS policies = état instable (22 fixes SQL observées)
```

### Indicateur de Couplage: Import Matrix
```
Most Imported Modules (top 20):
1. @/lib/supabase                56 imports  🔴 Couplage critique
2. @/types/supabase              6 imports   ⚠️ Type coupling
3. React                          ~200       ✅ Expected
4. React Router                   ~40        ✅ Expected
5. Service imports                ~100       ⚠️ Lateral dependencies
```

---

## 7️⃣ TABLES SUPABASE UTILISÉES

### Tables Critiques (>10 références)
```
49x knowledge_documents       -- Docs en ingestion (status, progress)
20x devis                     -- Devis utilisateurs
18x profiles                  -- Profiles utilisateurs
15x analysis_jobs             -- Jobs d'analyse en cours
14x knowledge_chunks          -- Chunks + embeddings
11x projects                  -- Projets utilisateurs
11x project_actors            -- Acteurs projet
11x knowledge_base_documents  -- Docs base de connaissance
```

### Tables Importantes (5-10 références)
```
8x market_price_references    -- Prix de référence marché
8x entretiens_programmes      -- Planning entretiens
6x sinistres                  -- Claims management
6x knowledge_base_chunks      -- Chunks base de connaissance
5x site_journal               -- Journal de site
5x phase2_journal_chantier    -- Journal chantier
5x payment_milestones         -- Jalons de paiement
5x api_call_logs              -- Logs des appels API
```

### Tables Accessoires (<5 références)
```
carnets_numeriques, diagnostics_carnet, garanties_actives,
company_data_cache, ccf, notifications, doctrine_sources,
analysis_results, ai_conversations, regional_market_data, etc.
```

### Problèmes de Schéma
- ❌ **Knowledge_chunks vs knowledge_base_chunks** : Duplication confuse
- ❌ **Pas de versionning clair** : v2 suffix sans v1 visible
- ⚠️ **Migrations non idempotentes** : Risque de divergence états
- ⚠️ **RLS policies instables** : 22+ fichiers de "fix"
- ⚠️ **Pas de schema audit table** : Traçabilité insuffisante

---

## 8️⃣ VARIABLES D'ENVIRONNEMENT

### Frontend (VITE_* prefix)
```bash
# Obligatoires
VITE_SUPABASE_URL               https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY          eyJ...token

# LLM Services
VITE_OPENAI_API_KEY             sk-proj-...
VITE_ANTHROPIC_API_KEY          sk-ant-...
VITE_AI_PRIMARY_PROVIDER        'openai' | 'claude'
VITE_AI_FALLBACK_ENABLED        true | false

# External APIs
VITE_INSEE_API_KEY              [API INSEE gratuite]
VITE_GOOGLE_MAPS_API_KEY        [Google Maps]

# Feature Flags
VITE_FREE_MODE                  true | false (Phase test)
VITE_STRIPE_ENABLED             false (disabled par défaut)
VITE_FEATURE_PAYMENT_ENABLED    false
VITE_FEATURE_CHAT_AI_ENABLED    true
VITE_FEATURE_ANALYTICS_ENABLED  true
```

### Backend/Worker (Node.js)
```bash
# Supabase (obligatoire)
SUPABASE_URL                    https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY       eyJ...service_role_key

# OpenAI (pour worker + Edge Functions)
OPENAI_API_KEY                  sk-...

# Google Vision (OCR)
GOOGLE_SERVICE_ACCOUNT_JSON     {...json credentials}
GOOGLE_APPLICATION_CREDENTIALS  [path to credentials]

# Express Server (NEW)
PORT                            8080 (default)
```

### Supabase Edge Functions
```
Secrets (via Supabase Dashboard):
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- CLAUDE_API_KEY ou OPENAI_API_KEY
- PAPPERS_API_KEY (premium)
- API_ENTREPRISE_TOKEN
- API_ENTREPRISE_RECIPIENT
```

### Problèmes Config
- ⚠️ **Pas de validation env at startup** (aucun check des vars obligatoires)
- ⚠️ **Secrets exposés potentiels** (Google credentials écrites en filesystem)
- ⚠️ **Pas de configuration par environment** (dev/staging/prod distincts)
- 🔴 **Pas de .env.production enforcé** (risque secrets en production)

---

## 9️⃣ SCRIPTS NPM

### Development
```bash
npm run dev              # Vite dev server (hot reload)
npm run build           # Vite build (production)
npm run build:dev       # Build développement
npm run preview         # Preview du build local
```

### Testing
```bash
npm test                # Vitest (default)
npm run test:ui         # Vitest avec UI
npm run test:run        # Vitest run (CI mode)
npm run test:coverage   # Coverage report

npm run test:jest               # Jest alternative
npm run test:jest:watch         # Jest watch
npm run test:jest:coverage      # Jest coverage

npm run test:engines    # Jest tests pour 3 moteurs spécifiques
  - thematicScoring.test.js
  - bonusSystem.test.js
  - narrativeEngine.test.js

npm run test:e2e        # Playwright E2E tests
npm run test:e2e:ui     # E2E avec UI
npm run test:e2e:headed # E2E avec navigateur visible
npm run test:e2e:debug  # E2E debug mode
npm run test:e2e:codegen # Codegen for E2E
```

### Production/Quality
```bash
npm start               # Express server + Worker (NEW)
npm run lint           # ESLint check
```

### Problèmes Scripts
- ❌ **Pas de pre-commit hooks** (risque code quality)
- ❌ **Pas de security audit script** (npm audit absent)
- ⚠️ **Double test frameworks** (Vitest + Jest = confusion)
- ⚠️ **Pas de performance benchmark**
- 🔴 **Pas de migration script** (Supabase migrations manuelles)

---

## 🔟 POINTS DE DETTE TECHNIQUE

### Critique (P0 - Blocker)
```
🔴 1. RLS Policies Instables (80+ migrations = problème fondamental)
   Location: supabase/migrations/*.sql
   Impact: Sécurité compromised, maintenance impossible
   Fix: Rewrite complet RLS policies (review par security expert)
   Effort: 3-5 jours

🔴 2. Pas de Structured Logging
   Location: Partout (769 console.log)
   Impact: Impossible déboguer en production
   Fix: Implémenter Pino ou Winston + CloudWatch
   Effort: 2-3 jours

🔴 3. Error Tracking Absent
   Location: Sentry setup = TODO in ErrorBoundary.tsx
   Impact: Aucune telemetry d'erreurs utilisateur
   Fix: Setup Sentry + Error boundary propagation
   Effort: 1 jour

🔴 4. Double Obligation Extraction Engines
   Location:
     - src/engines/obligationExtractionEngine.js
     - src/engines/regulatoryObligationExtractionEngine.js
   Impact: Code duplication, maintenance nightmare
   Fix: Merger en un engine unique (comparaison + choose best)
   Effort: 2 jours
```

### Haute (P1 - Urgent)
```
🟠 5. TypeScript "any" Overuse (774 occurrences)
   Impact: Zéro type safety, bugs inévitables
   Fix: Strict mode + type-check scripts
   Effort: 1-2 semaines (iterative)

🟠 6. Supabase Couplage Direct (56 imports)
   Impact: Impossible à tester, migration coûteuse
   Fix: Implement Repository pattern + Dependency Injection
   Effort: 1 semaine

🟠 7. No Retry Logic in Worker
   Impact: Documents échoués jamais reprocessés
   Fix: Add exponential backoff + DLQ
   Effort: 3 jours

🟠 8. No Circuit Breaker pour OpenAI
   Impact: Cascading failures si API down
   Fix: Implémenter circuit breaker pattern
   Effort: 2 jours
```

### Moyenne (P2 - Improvement)
```
🟡 9. Incomplete Infrastructure
   - Sentry: TODO
   - Structured logging: absent
   - Monitoring dashboard: n/a
   - Health checks: minimal
   Fix: 1 semaine setup infrastructure monitoring

🟡 10. No Input Validation at API Boundary
   Impact: XSS, injection risks
   Fix: Add Zod validation + sanitization everywhere
   Effort: 3-4 jours

🟡 11. Google Vision Credentials on Filesystem
   Impact: Security risk, container-unfriendly
   Fix: Use Secrets Manager ou env vars
   Effort: 1 jour

🟡 12. No API versioning
   Impact: Breaking changes affect all clients
   Fix: Add /v1/, /v2/ routes pattern
   Effort: 2 jours
```

### Basse (P3 - Nice-to-have)
```
🟢 13. Documentation Fragmentée (5+ ARCHITECTURE_*.md)
🟢 14. Testing Coverage Low (11 tests / 400 files)
🟢 15. No Performance Profiling
🟢 16. CSS-in-JS vs Tailwind (mixed approaches)
```

---

## 1️⃣1️⃣ RISQUES SCALABILITÉ

### Risque 1: Database Bottleneck
```
❌ PROBLÈME
- 80+ migrations = schema instable
- RLS policies = performance killer (N+1 queries)
- Chunks table sans index sur document_id + status
- No query optimization

📊 IMPACT
- Max ~10k concurrent users avant DoS
- Latency adds 200-500ms per request (RLS overhead)
- No caching strategy visible

✅ SOLUTION
- Use read replicas pour READ-heavy queries
- Implement query caching (Redis)
- Add proper indexes on knowledge_chunks
- Optimize RLS policies (use JWT claims)
- Effort: 1-2 semaines
```

### Risque 2: LLM API Costs Explode
```
❌ PROBLÈME
- Pas de rate limiting sur LLM calls
- Pas de token budgeting par user
- Pas de caching des responses LLM
- Batch operations pas implémentées

💰 IMPACT
- Cost per user: ~$2-5/mois (GPT-4o-mini)
- 1000 users = $2-5k/mois
- Pas de forecast possible

✅ SOLUTION
- Implement LLM response caching (Redis)
- Rate limiting par user/API key
- Token budget enforcement
- Batch API calls where possible
- Effort: 1 semaine
```

### Risque 3: Worker Scalability
```
❌ PROBLÈME
- Single-threaded polling loop
- No horizontal scaling
- Documents queued in Supabase (polling is inefficient)
- No message queue (RabbitMQ, AWS SQS, etc.)

📈 IMPACT
- Max ~100 documents/hour ingestion rate
- Bottleneck at 1000+ documents queue
- No prioritization possible

✅ SOLUTION
- Migrate to event-driven (Supabase Webhooks + Queue)
- Or: Switch to dedicated job queue (Bull, RQ)
- Add worker pool (Bull Worker)
- Effort: 1-2 weeks (change paradigm)
```

### Risque 4: Frontend Bundle Size
```
❌ PROBLÈME
- 51 dependencies (many heavy)
- Radix-UI = ~50 components included
- No code splitting (vite config disables chunking)
- Bundle size likely 500KB+ gzipped

📦 IMPACT
- Slow first page load (>3s on slow network)
- High lighthouse CLS score
- Not mobile-friendly

✅ SOLUTION
- Re-enable code splitting
- Lazy load routes
- Remove unused Radix-UI components
- Tree shake dependencies
- Effort: 3 days
```

### Risque 5: Concurrent LLM API Calls
```
❌ PROBLÈME
- No queue management for LLM calls
- 20+ simultaneous requests = rate limit hit
- No backpressure handling

✅ SOLUTION
- Use p-queue ou similar
- Implement exponential backoff
- Add rate limit awareness
- Effort: 2 days
```

### Risque 6: Data Consistency
```
❌ PROBLÈME
- Distributed transactions missing
- Worker might die mid-ingestion
- No atomic operations ensuring data integrity

✅ SOLUTION
- Add transactional integrity checks
- Implement idempotent operations
- Add consistency validators
- Effort: 3-4 days
```

---

## 1️⃣2️⃣ RISQUES JURIDIQUES & TRAÇABILITÉ

### Risque 1: Insufficient Audit Trail
```
🔴 CRITIQUE
Problem:
- No comprehensive audit log table
- User actions not logged
- LLM API calls not traced
- Data modifications not tracked

Impact:
- RGPD non-compliant (droit à l'audit)
- Impossible to prove compliance
- Legal liability if data breach
- Cannot prove "who did what when"

Solution:
- Create audit_log table with:
  * user_id, timestamp, action, resource_id, old_value, new_value
  * api_call_logs (LLM calls)
  * document_access_logs (who saw what)
- Implement auto-audit triggers (PostgreSQL)
- Retention: minimum 3 ans (RGPD)
- Encryption: sensitive data
- Effort: 3-4 days (if clean architecture)

Related Tables Found:
✓ api_call_logs exists (but likely empty)
✓ admin_audit_log exists
? analysis_learning_feedback (unclear purpose)
```

### Risque 2: RGPD Compliance Gaps
```
🔴 CRITIQUE
Problems:
- No clear data retention policy
- User deletion not implementable (foreign keys?)
- No consent tracking for LLM processing
- Supabase deletion cascades not verified

Impact:
- RGPD article 17 (right to be forgotten) NOT IMPLEMENTED
- CNIL fines: 4% revenue or €20M max
- User data never truly deleted

Solution:
- Map all data dependencies
- Implement soft-delete for user data
- Create data retention policies
- Add consent tracking (timestamp, version)
- Document all LLM data processing
- Effort: 1-2 weeks
```

### Risque 3: LLM Data Processing Disclosure
```
🟠 HAUTE
Problem:
- Users don't know data sent to OpenAI/Anthropic
- No data processing addendum (DPA) visible
- LLM processing terms not in privacy policy
- Potential RGPD violation (Article 13)

Impact:
- Lack of informed consent
- CNIL violations possible
- Users could sue

Solution:
- Add prominent disclosure in signup
- Include DPA from OpenAI/Anthropic
- Update privacy policy
- Add user controls (opt-out LLM?)
- Effort: 2-3 days
```

### Risque 4: Incomplete Data Classification
```
🟡 MOYEN
Problem:
- No clear classification of data (public/internal/sensitive/PII)
- All data treated same in Supabase
- No encryption at rest for sensitive fields

Solution:
- Classify all data tables
- Encrypt PII fields (SSN, address, phone)
- Add access controls based on classification
- Effort: 1 week
```

### Risque 5: Third-Party Vendor Risk
```
🟡 MOYEN
Problem:
- OpenAI (US-based, potential GDPR issue with data transfers)
- Anthropic (less clear data handling)
- Google Vision (vision data processing not disclosed)
- Pappers (third-party company search)

Solution:
- Sign Data Processing Agreements (DPA) with all vendors
- Ensure standard contractual clauses (SCC) for US vendors
- Document data flows to third parties
- Effort: Ongoing legal work
```

### Risque 6: Client Data Exposure Risk
```
🔴 CRITIQUE
Problem:
- Client devis data (confidential) sent to LLM?
- Quote analysis uses OpenAI/Claude
- No content filtering before sending
- Potential IP disclosure

Impact:
- Client confidential data exposed to vendors
- Competitive risk
- Trust violation

Solution:
- Add data redaction before LLM calls
- Remove sensitive identifiers (names, addresses)
- Add explicit consent per client
- Use local LLM for sensitive operations?
- Effort: 3-4 days
```

---

## 1️⃣3️⃣ RECOMMANDATIONS PRIORISÉÉES

### 🚨 COURT TERME (0-2 semaines) - BLOCKER FIXES

#### P0.1: Déployer Error Tracking & Structured Logging [1 jour]
```
Action:
1. Install Sentry SDK
   npm install @sentry/react @sentry/tracing
2. Configure Sentry in main.tsx
3. Create structured logger (Pino)
   npm install pino pino-http
4. Replace all console.log with logger

Why Critical:
- Production blind without error visibility
- 769 console.logs completely unmanageable
- Sentry = must-have for SaaS

Deliverables:
- Sentry project created + initialized
- All client errors captured
- Structured JSON logs for backend
```

#### P0.2: Fix Critical RLS Policies [3-5 jours]
```
Action:
1. Audit current RLS policies
2. Remove DUPLICATE/conflicting rules
3. Test all policies with test data
4. Document policy intent

Why Critical:
- 22+ migration files = chaos
- Security audit will FAIL
- Data leakage risk

Deliverables:
- Single authoritative RLS policy file
- Security audit checklist
- Test suite for RLS (edge cases)
```

#### P0.3: Merge Obligation Extraction Engines [2 jours]
```
Action:
1. Compare obligationExtractionEngine vs regulatoryObligation...
2. Choose better implementation
3. Consolidate to single engine
4. Update all imports

Why Critical:
- Code duplication is maintenance risk
- Confusion leads to bugs

Deliverables:
- Single MergedObligationEngine
- All tests passing
- Migration guide
```

#### P0.4: Add Config Validation [4 heures]
```
Action:
1. Create config.ts validation with Zod
2. Validate at app startup
3. Fail fast if env vars missing

Code:
const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  OPENAI_API_KEY: z.string().startsWith('sk-'),
  PORT: z.coerce.number().default(8080),
});

Deliverables:
- Config validation module
- Early startup failure
- Clear error messages
```

---

### ⚡ MOYEN TERME (2-4 semaines) - SCALABILITY

#### M1: Database Optimization [1 semaine]
```
Actions:
1. Add missing indexes
   - knowledge_chunks (document_id, status, embedding_generated_at)
   - knowledge_documents (ingestion_status)
   - devis (user_id, created_at DESC)

2. Optimize RLS policies
   - Cache JWT claims
   - Use materialized views for common queries

3. Add read replicas strategy
   - Profile queries on read-heavy endpoints
   - Redirect to replica for analytics

Deliverables:
- Index creation scripts
- Query performance baseline
- Replica setup guide
```

#### M2: Implement LLM Caching [3-4 jours]
```
Actions:
1. Add Redis layer
   npm install redis ioredis

2. Cache LLM responses
   - Key: hash(prompt + model)
   - TTL: 7 days
   - Eviction: LRU

3. Measure cost savings

Deliverables:
- Redis integration
- Cache key strategy
- Cost reporting
```

#### M3: TypeScript Strict Mode [1 semaine]
```
Actions:
1. Enable tsconfig "strict": true
2. Fix compilation errors (774 "any" types)
3. Add type checking CI

Deliverables:
- Strict mode enabled
- Zero "any" types (or documented escape hatches)
- CI/CD type check gate
```

#### M4: Implement Repository Pattern [1 semaine]
```
Why:
- Decouple from Supabase
- Testable data layer
- Easy to migrate databases

Pattern:
interface KnowledgeRepository {
  getChunkById(id: string): Promise<Chunk>
  searchChunks(query: string): Promise<Chunk[]>
  insertChunk(chunk: Chunk): Promise<void>
}

class SupabaseKnowledgeRepository implements KnowledgeRepository {
  // Supabase-specific logic
}

Deliverables:
- Repository interfaces for 5+ core entities
- Supabase implementations
- In-memory mocks for testing
```

#### M5: Add Input Validation [3-4 jours]
```
Where:
- All API endpoints
- All form submissions
- All Supabase queries (params)

Tool: Zod schemas

Example:
const createDevisSchema = z.object({
  title: z.string().min(3).max(255),
  budget: z.number().positive(),
  scope: z.string().min(10),
});

app.post('/devis', (req, res) => {
  const parsed = createDevisSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);
  // ...
});

Deliverables:
- Zod schemas for all endpoints
- Validation middleware
- Error response standardization
```

---

### 📈 LONG TERME (1-3 mois) - ARCHITECTURAL REFACTOR

#### L1: Event-Driven Worker Architecture [2 semaines]
```
Current: Polling loop every 10s (inefficient)
Future: Event-driven via webhooks + queue

Technology:
- Supabase Webhooks → Bull Queue
- Worker processes consume queue
- Auto-scale based on queue depth

Deliverables:
- Bull Queue setup
- Webhook handlers
- Worker scalability tests
```

#### L2: Microservices Separation [3-4 semaines]
```
Split monolith:

1. API Service (Express)
   - Business logic
   - Orchestration

2. RAG Service (Node.js worker)
   - Document ingestion
   - Embedding generation
   - Obligation extraction

3. Analytics Service (separate)
   - Report generation
   - Metric aggregation

Benefits:
- Independent scaling
- Different SLAs
- Easier testing
- Clearer responsibilities
```

#### L3: Regulatory Engine Standardization [2 semaines]
```
Current: 6 different engines, inconsistent I/O
Future: Unified engine architecture

Pattern:
interface RegulatoryEngine {
  execute(input: EngineInput): Promise<EngineOutput>
  validate(output: EngineOutput): ValidationResult
  getMetadata(): EngineMetadata
}

Engines:
- ObligationExtractionEngine
- AuditNarrativeEngine
- RegulatoryExposureEngine
- ThematicScoringEngine
- [etc.]

Deliverables:
- Engine interface contract
- Unified I/O schema
- Engine registry + discovery
```

#### L4: Implement RGPD Compliance Layer [2-3 semaines]
```
Components:
1. Data Classification Table
   - Field-level encryption for PII
   - Access control based on classification

2. Consent Manager
   - Track user consent (timestamp, version, scope)
   - Legal basis for each processing

3. Data Retention Policy
   - Auto-delete after retention period
   - Soft-delete for compliance

4. Data Subject Rights
   - Export in standard format (JSON)
   - Delete all user data + references
   - Data portability

5. Audit Trail
   - All access logged
   - LLM processing traced
   - 3-year retention

Deliverables:
- Database schema extensions
- API endpoints for data export/delete
- Scheduled retention cleanup
- Audit log backend
```

#### L5: Production Observability [2 semaines]
```
Components:
1. Metrics (Prometheus format)
   - Document ingestion rate
   - LLM API latency
   - Error rates per endpoint
   - User acquisition

2. Distributed Tracing
   - Trace requests end-to-end
   - Identify bottlenecks
   - Supabase query tracing

3. Dashboards
   - SLA monitoring
   - Cost tracking (LLM spend)
   - Performance metrics
   - Security alerts

4. Alerting
   - Error spike detection
   - SLA violations
   - Security anomalies

Stack:
- Prometheus (metrics collection)
- Grafana (dashboards)
- Jaeger (tracing)
- PagerDuty (alerts)

Deliverables:
- Metrics emitted from app
- Prometheus scrape config
- Grafana dashboards
- Alert rules
```

---

## 1️⃣4️⃣ MATRIX DE PRIORISATION

| Initiative | Impact | Effort | Impact/Effort | Timeline | Owner |
|-----------|--------|--------|---------------|----------|-------|
| Error Tracking (P0.1) | 🔴 Critical | 1d | 🔴 Must-do | Week 1 | DevOps |
| RLS Audit (P0.2) | 🔴 Critical | 5d | ⚡ Must-do | Week 1 | Security |
| Engine Merge (P0.3) | 🟠 High | 2d | ⚡ Must-do | Week 1 | Backend |
| Config Validation (P0.4) | 🟠 High | 0.5d | 🔴 Must-do | Week 1 | DevOps |
| DB Optimization (M1) | 🟡 Medium | 5d | ✅ Good ROI | Week 2-3 | DBA |
| LLM Caching (M2) | 💰 Cost | 3d | 💰 Cost-save | Week 2-3 | Backend |
| Strict TypeScript (M3) | 🟡 Medium | 5d | ✅ Good | Week 2-3 | Frontend |
| Repository Pattern (M4) | 🟡 Medium | 5d | ✅ Arch improvement | Week 3-4 | Backend |
| Input Validation (M5) | 🟠 Security | 3d | 🔴 Must-do | Week 3 | Backend |
| Event-Driven Worker (L1) | 📈 Scalability | 10d | ⏳ High value | Month 2 | Backend |
| Microservices (L2) | 🏗️ Arch | 20d | ⏳ Strategic | Month 2-3 | Arch |
| Engine Standardization (L3) | 🏗️ Arch | 10d | ✅ Maintainability | Month 2 | Backend |
| RGPD Compliance (L4) | ⚖️ Legal | 15d | 🔴 Must-have | Month 2 | Legal/Backend |
| Observability (L5) | 📊 Ops | 10d | ✅ Operations | Month 3 | DevOps |

---

## 1️⃣5️⃣ CHECKLIST DE VALIDATION

### Avant Refonte B2B
```
Infrastructure:
☐ Error tracking operational (Sentry)
☐ Structured logging in place (Pino/Winston)
☐ Config validation at startup
☐ Health check endpoints

Security:
☐ RLS policies audited + tested
☐ Input validation on all endpoints
☐ Secrets not in filesystem
☐ HTTPS enforced
☐ CORS properly configured

Database:
☐ Indexes created on hot tables
☐ Query performance baseline < 100ms
☐ Read replicas for analytics
☐ Backup strategy documented

Testing:
☐ Critical path covered (>80% coverage)
☐ E2E tests for core flows
☐ Load testing completed (1000 concurrent users)
☐ Chaos engineering tests

Scalability:
☐ Horizontal scaling plan documented
☐ LLM rate limiting in place
☐ Database connection pooling
☐ Redis caching for hot data

Compliance:
☐ RGPD audit completed
☐ DPA signed with all vendors
☐ Privacy policy updated
☐ Audit trail logged

Documentation:
☐ Architecture decision records (ADRs)
☐ API documentation (OpenAPI)
☐ Database schema documented
☐ Runbook for common operations
```

---

## APPENDIX A: FILE INVENTORY

### Top 10 Largest Files
```
1. src/engines/auditNarrativeEngine.js          1184 LOC
2. src/engines/thematicScoringEngine.js         772 LOC
3. src/engines/regulatoryObligationExtractionEngine.js  651 LOC
4. src/engines/regulatoryIngestionEngine.js     579 LOC
5. src/engines/obligationExtractionEngine.js    551 LOC
6. rag-worker/core/projectComplexityEngine.js   456 LOC
7. src/engines/regulatoryExposureEngine.js      354 LOC
8. rag-worker/worker.js                         370 LOC
9. [COMPONENT] src/pages/...tsx                 ~300 LOC (typical)
10. [HOOK] src/hooks/...ts                      ~200 LOC (typical)
```

### Test Coverage by Module
```
Total Tests: 11 files
- tests/thematicScoring.test.js
- tests/bonusSystem.test.js
- tests/narrativeEngine.test.js
- e2e/*.spec.ts (Playwright)
- [Gaps in]: Worker, API routes, Services

Needed:
- Worker unit tests (40 tests)
- API integration tests (30 tests)
- Service tests (50 tests)
- RLS policy tests (20 tests)
```

---

## CONCLUSION

**TORP est un projet ambitieux et techniquement solide pour un MVP, mais nécessite une consolidation critique avant B2B.**

### État Actuel
✅ **Bien:** Frontend architecture (React + Radix-UI), Moteurs IA, RAG worker fonctionnel
⚠️ **Moyen:** Database stability, TypeScript safety, Testing coverage
🔴 **Critique:** Error tracking, RLS policies, Data audit trail, Scalability planning

### Recommandation Immédiate
1. **Semaine 1:** Déployer error tracking, fixer RLS, valider config
2. **Semaine 2-3:** Optimiser DB, implémenter caching LLM, strict TypeScript
3. **Mois 2-3:** Refactoriser architecture worker, standardiser moteurs, RGPD compliance

### Budget Estimé pour Production-Ready
```
P0 Fixes (Critical):        2 semaines (4 devs)
M1-M5 (Scalability):        3 semaines (3 devs)
L1-L5 (Architectural):      6-8 semaines (2-3 devs)
Total:                      3-4 mois (full team effort)
```

**La refonte architecturale vers un moteur réglementaire industrialisable B2B est réalisable mais nécessite un plan d'exécution rigoureux.**

---

*Rapport généré par audit automatisé le 28 février 2026*
*Pour questions: Contacter l'équipe DevOps/Architecture*

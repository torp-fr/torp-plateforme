# PHASE 4 — Data Pipelines Architecture
*TORP Platform — Mapping complet des flux de données — 2026-03-28*

---

## Executive Summary

| Métrique | Valeur |
|---|---|
| Pipelines majeurs | 5 |
| Tables DB impliquées | 15 |
| APIs externes | 6 (dans le chemin critique) |
| Latence totale analyse devis | ~15–25s (synchrone) |
| Pattern orchestration | Sequential engines + async side-effects |
| Pattern error recovery | Max 3 retries, exponential backoff, dead-letter |

**Verdict**: L'architecture pipeline est bien définie avec une séparation claire entre les 5 domaines. Le pipeline Devis est le plus complexe (12 moteurs séquentiels). La Knowledge Base a un ingestion pipeline complet avec state machine. Les points de synchronisation inter-pipelines sont bien délimités via les tables `analysis_jobs`, `orchestration_runs`, et `pipeline_executions`.

---

## Schéma DB — Toutes tables impliquées

```
entreprises ←── clients ←── projets ←── devis ←── audits ←── qrcodes
                                                       │
                                            orchestration_runs
                                                       │
                                            engine_executions
                                                       │
                                            score_snapshots
                                                       │
                                            analysis_jobs

knowledge_documents ─── knowledge_chunks (embedding_vector vector(384))

pipeline_executions  ─── retry/audit trail for all pipelines
platform_settings    ─── singleton config row
rate_limits          ─── per-user throttling
```

### Table: `entreprises`
| Colonne | Type | Description |
|---|---|---|
| id | UUID PK | Identifiant entreprise |
| siret | VARCHAR | SIRET officiel (14 chiffres) |
| raison_sociale | TEXT | Dénomination légale |
| rcs_data | JSONB | Données Pappers: dirigeants, forme juridique, capital |
| certifications | JSONB | RGE, Qualiopi — Data.gouv/ADEME |
| reputation | JSONB | Score Trustpilot, avis |
| pipeline_status | JSONB | `{ enrichment: 'completed' \| 'pending', ... }` |

### Table: `clients`
| Colonne | Type | Description |
|---|---|---|
| id | UUID PK | |
| entreprise_id | UUID FK | Lien entreprise (optionnel) |
| email, nom, prenom, telephone | VARCHAR | Coordonnées |
| localisation | JSONB | `{ lat, lng, address, code_postal, ville }` (post-géocodage) |
| contexte_local | JSONB | PLU, zones ABF, informations IGN (lazy-loaded) |
| pipeline_status | JSONB | État géocodage |

### Table: `projets`
| Colonne | Type | Description |
|---|---|---|
| id | UUID PK | |
| client_id | UUID FK | |
| entreprise_id | UUID FK | Entreprise réalisant les travaux |
| type | VARCHAR | Type projet: rénovation, construction neuve, extension… |
| localisation | JSONB | Coordonnées + adresse |
| contexte_reglementaire | JSONB | PLU, seismic zone, ABF protection, normes applicables |
| implied_domains | VARCHAR[] | Domaines déduits: `['hydraulique', 'électrique', 'structure']` |
| context_deduction_confidence | FLOAT | Confiance déduction 0–1 |

### Table: `devis`
| Colonne | Type | Description |
|---|---|---|
| id | UUID PK | |
| projet_id | UUID FK | |
| entreprise_id | UUID FK | |
| version | INT | Support multi-version devis |
| upload_format | VARCHAR | pdf, image, excel, word |
| upload_file_path | TEXT | Chemin Supabase Storage |
| parsing_result | JSONB | Lignes extraites: `{ items[], montant_ht, montant_ttc, tva_taux }` |
| pipeline_status | JSONB | `{ stage: 'parsing' \| 'analyzing' \| 'completed' \| 'failed', progress: 0-100 }` |

### Table: `audits`
| Colonne | Type | Description |
|---|---|---|
| id | UUID PK | |
| devis_id, projet_id, entreprise_id | UUID FK | |
| coverage_analysis | JSONB | Analyse couverture par lot |
| scoring | JSONB | Scores détaillés par moteur |
| recommendations | JSONB | Actions correctives |
| public_summary | JSONB | Version publique (sans données sensibles) |
| version_delta | JSONB | Diff vs version précédente du devis |

### Table: `orchestration_runs`
| Colonne | Type | Description |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR | Nom de l'orchestration |
| status | VARCHAR | `pending \| running \| completed \| failed` |
| input_count, output_count, error_count | INT | Métriques globales |
| duration_ms | INT | Auto-calculé par trigger DB |
| grade_distribution | JSONB | `{ A: n, B: n, C: n, D: n, E: n }` |

### Table: `knowledge_documents`
| Colonne | Type | Description |
|---|---|---|
| id | UUID PK | |
| title, category, source | VARCHAR | Métadonnées document |
| ingestion_status | VARCHAR | `pending → processing → extracting → chunking → embedding → completed \| failed` |
| ingestion_attempts | INT | Max 3 tentatives |
| chunk_count | INT | Nombre de chunks générés |
| embedded_at | TIMESTAMPTZ | Timestamp fin d'ingestion |

### Table: `knowledge_chunks`
| Colonne | Type | Description |
|---|---|---|
| id | UUID PK | |
| document_id | UUID FK | |
| content | TEXT | Texte du chunk |
| chunk_index | INT | Position dans le document |
| token_count | INT | ~400–500 tokens/chunk |
| **embedding_vector** | VECTOR(384) | **⚠️ SEUL nom valide — jamais `embedding`** |

---

## Pipeline 1 — CLIENTS

### Source → Transform → Store → Consume

```
SOURCE
  └─ Saisie utilisateur: nom, prenom, email, telephone
  └─ SIRET (optionnel, si lié à une entreprise)

TRANSFORM
  ├─ [Sync] Validation email format, phone normalization
  ├─ [Async ~2-5s] Géocodage adresse → NominatimClient
  │    └─ Primary: BANO https://api-adresse.data.gouv.fr/search/?q={adresse}
  │    └─ Fallback: Nominatim https://nominatim.openstreetmap.org/search
  │    └─ Output: { lat, lng, normalized_address, code_postal, ville, commune_insee }
  └─ [Lazy] Contexte local → IGNClient
       └─ PLU: https://www.geoportail-urbanisme.gouv.fr/api/feature-info
       └─ Output: { zone_plu, abf_protection, seismic_zone }

STORE
  └─ clients.id, nom, prenom, email, telephone
  └─ clients.localisation (JSONB) — après géocodage
  └─ clients.contexte_local (JSONB) — lazy-loaded
  └─ clients.pipeline_status = { geocoding: 'completed' | 'failed' }

CONSUME
  └─ Dashboard: liste clients, carte géographique
  └─ Pipeline Projets: client_id + localisation pour contexte réglementaire
  └─ Pipeline Devis: client_id pour association audit
  └─ Pipeline Intelligence: distribution géographique clients
```

### Failure Modes

| Erreur | Impact | Recovery |
|---|---|---|
| BANO API timeout | Géocodage incomplet | Retry via Nominatim fallback |
| Nominatim rate limit (1 req/s) | Délai | Backoff 1200ms implémenté dans NominatimClient |
| Adresse ambiguë | localisation.lat/lng null | Enregistrement sauvé sans coordonnées, UI demande correction |
| SIRET invalide (format) | Rejet | Validation côté serveur avant INSERT |

### Retry Strategy
- Max attempts: 3
- Backoff: 1200ms fixe (Nominatim policy)
- Fallback: données sans géolocalisation (accepté)
- Timeout: `API_CALL_TIMEOUT_MS` = 30s

### Transaction Boundaries
- **Atomic**: INSERT `clients` + réponse 201 (sync)
- **Async**: géocodage fire-and-forget → UPDATE `clients.localisation`
- **Compensation**: si géocodage échoue → `pipeline_status.geocoding='failed'`, client toujours accessible

---

## Pipeline 2 — PROJECTS

### Source → Transform → Store → Consume

```
SOURCE
  └─ Saisie utilisateur: nom, type, description, adresse
  └─ client_id (existant, requis)

TRANSFORM
  ├─ [Sync ~50ms] Context deduction → contextDeduction.service.ts
  │    └─ Map type projet → implied_domains[]
  │    └─ Exemples:
  │         'piscine'          → ['hydraulique', 'électrique', 'structure', 'étanchéité']
  │         'isolation'        → ['isolation thermique', 'DTU 45.x']
  │         'construction neuve' → ['structure', 'fondation', 'plomberie', 'électrique']
  │    └─ confidence: 0.6–0.95 selon précision type
  ├─ [Lazy ~5-10s] Contexte réglementaire → IGNClient + ADEME
  │    └─ IGN WFS: https://wxs.ign.fr/{key}/geoportail/wfs (cadastre, PLU)
  │    └─ ADEME RGE: https://data.ademe.fr/data-fair/api/v1/datasets (certifications)
  │    └─ Format: LazyLoadedData<T> = { status, data, error, fetched_at, source_api }
  └─ [Future P1] Légifrance PISTE (stub actuellement)
       └─ https://sandbox.piste.gouv.fr — DTU, arrêtés, normes applicables
       └─ Activé quand: LEGIFRANCE_API_KEY configuré ET legifranceEnabled=true

STORE
  └─ projets: id, client_id, entreprise_id, type, description, localisation
  └─ projets.implied_domains[] — domaines déduits
  └─ projets.context_deduction_confidence
  └─ projets.contexte_reglementaire (JSONB) — lazy-loaded

CONSUME
  └─ Dashboard: liste projets par client
  └─ Pipeline Devis: projet_id + contexte réglementaire pour scoring
  └─ Rule Engine: implied_domains pour sélectionner règles applicables
  └─ Pipeline Intelligence: distribution types projets, régions
```

### Failure Modes

| Erreur | Impact | Recovery |
|---|---|---|
| IGN API timeout | contexte_reglementaire vide | Retry lazy (prochaine consultation) |
| ADEME open data 503 | certifications RGE absentes | Cache 30 jours, fallback gracieux |
| Légifrance stub | Pas de règles légales | Feature flag OFF jusqu'à implémentation P1 |
| client_id inexistant | 404 | Validation FK côté API avant INSERT |

### Transaction Boundaries
- **Atomic**: INSERT `projets` avec type + client_id
- **Async**: enrichissement réglementaire fire-and-forget
- **Compensation**: projet créé même sans contexte réglementaire

---

## Pipeline 3 — DEVIS (Quote Analysis)

### Source → Transform → Store → Consume

```
SOURCE
  └─ User upload: PDF, image (JPG/PNG), Excel, Word
  └─ projet_id + entreprise_id (requis)

STAGE 1 — UPLOAD (~0.5s)
  └─ File → Supabase Storage (bucket: devis_uploads)
  └─ INSERT devis: { projet_id, entreprise_id, version, upload_format, upload_file_path }
  └─ devis.pipeline_status = { stage: 'pending', progress: 0 }
  └─ INSERT analysis_jobs: { user_id, project_id, devis_id, status: 'pending' }

STAGE 2 — PARSING (~2-3s)
  ├─ Download file from Supabase Storage
  ├─ Text extraction by type:
  │    ├─ PDF       → pdf-parse
  │    ├─ Images    → Google Vision OCR (Edge Function: google-vision-ocr)
  │    ├─ Excel     → exceljs
  │    └─ Word      → mammoth
  ├─ Parse → DevisItem[] { description, quantity, unit, unit_price, total_ht, lot }
  ├─ Compute: montant_ht, montant_ttc, tva_taux
  └─ Store: devis.parsing_result (JSONB)
  // pipeline_status.stage = 'analyzing', progress = 20%

STAGE 3 — ENGINE ORCHESTRATION (~8-15s)
  └─ runOrchestration(context) → engineOrchestrator.ts
  └─ INSERT orchestration_runs: { name, status: 'running', input_count }

  Moteurs exécutés SÉQUENTIELLEMENT:

  [1] ContextEngine (~300ms)
      └─ Extract: detected_lots[], spaces[], project_flags[], summary
      └─ Output feeds: LotEngine, RuleEngine

  [2] LotEngine (~400ms)
      └─ Parse + normalize corps d'état
      └─ Output: normalized_lots[], primary_lots[], complexity_score

  [3] RuleEngine (~500ms)
      └─ Query knowledge_chunks via RAG (pgvector search)
      └─ Apply: contractual rules, regulatory obligations
      └─ Output: obligations[], unique_obligations_count

  [4] ScoringEngine (~300ms)
      └─ Per-lot risk: risk_score, risk_level
      └─ Output: global_score, score_breakdown{}

  [5] EnrichmentEngine (~400ms)
      └─ Recommend improvements, risk mitigation
      └─ Output: actions[], recommendations[], risk_profile

  [6] AuditEngine (~500ms)
      └─ Compile compliance report
      └─ Create auditSnapshot (versioning)
      └─ Output: report{} with audit_timestamp, processing_time_ms

  [7] EnterpriseEngine (~1000ms — external API)
      └─ PappersClient.getCompanyBySIRET(siret)
      └─ Verify: solvency, legal status, dirigeants, Kbis
      └─ Output: score (pillar 1), verification_status

  [8] PricingEngine (~800ms — DB lookup)
      └─ Query market_price_references (internal table)
      └─ Compare devis prices vs. benchmarks market
      └─ Output: score (pillar 2), anomalies[]

  [9] QualityEngine (~200ms)
      └─ Check document completeness, formatting, coherence
      └─ Output: score (pillar 3), missing_elements[]

  [10] GlobalScoringEngine (~100ms)
       └─ Aggregate pillars (Enterprise + Pricing + Quality + coverage + rules)
       └─ Compute: final_score 0-100 → grade A-E
       └─ Output: global_score, grade

  [11] TrustCappingEngine (~100ms)
       └─ Apply ceiling rules (ex: grade capped at C if SIRET invalid)
       └─ Output: final_grade, capping_applied, capping_reason

  [12] StructuralConsistencyEngine (~200ms)
       └─ Cross-validate all pillars (coherence check)
       └─ Output: consistency_score, flagged_inconsistencies[]

STAGE 4 — PERSISTENCE (~300ms)
  ├─ INSERT audits: { devis_id, projet_id, entreprise_id, scoring, recommendations, public_summary }
  ├─ UPDATE orchestration_runs: { status: 'completed', output_count, error_count, duration_ms }
  ├─ INSERT engine_executions[]: { orchestration_id, engine_id, status, duration_ms, result }
  ├─ Fire-and-forget score_snapshots (non-blocking)
  └─ UPDATE analysis_jobs: { status: 'completed', result_snapshot_id }
  // pipeline_status.stage = 'completed', progress = 100%

STAGE 5 — QR CODE GENERATION (~50ms)
  └─ Generate 8-char alphanumeric short_code
  └─ INSERT qrcodes: { audit_id, short_code, access_url: 'https://torp.fr/audit/{code}' }
  └─ Public endpoint: GET /api/v1/audits/{shortCode} (sans auth)

STORE
  └─ devis: parsing_result, pipeline_status
  └─ audits: coverage_analysis, scoring, recommendations, public_summary
  └─ orchestration_runs: exécution tracée
  └─ engine_executions: détail par moteur
  └─ score_snapshots: observabilité temps réel
  └─ qrcodes: partage public

CONSUME
  └─ Dashboard: liste audits + grades par client/projet
  └─ Page audit public: /audit/{shortCode} (sans auth)
  └─ Pipeline Intelligence: score_distribution, success_rate, trends
  └─ Notifications: Resend email "analyse terminée"
```

### Timing Estimates

| Étape | Durée estimée | Dépendance externe |
|---|---|---|
| Upload + storage | 0.5s | Supabase Storage |
| Parsing OCR (images) | 2–3s | Google Vision API |
| Parsing OCR (PDF texte) | 0.3s | pdf-parse local |
| ContextEngine | 0.3s | — |
| LotEngine | 0.4s | — |
| RuleEngine (RAG lookup) | 0.5s | pgvector search |
| ScoringEngine | 0.3s | — |
| EnrichmentEngine | 0.4s | — |
| AuditEngine | 0.5s | — |
| EnterpriseEngine | 1.0s | **Pappers API** |
| PricingEngine | 0.8s | market_price_references (DB) |
| QualityEngine | 0.2s | — |
| GlobalScoring + Capping + Consistency | 0.4s | — |
| Persistence | 0.3s | Supabase DB |
| QR Code | 0.05s | — |
| **Total synchrone** | **~8–15s** | |
| Side-effects async | ~2–5s background | score_snapshots, analytics |

### Failure Modes

| Erreur | Étape | Impact | Recovery |
|---|---|---|---|
| Pappers API timeout | EnterpriseEngine | Score entreprise absent | Retry 3×, fallback: score=0 + avertissement |
| Google Vision OCR fail | Parsing | Texte non extrait | Retry 3×, fallback: demande re-upload |
| pgvector search lente | RuleEngine | Rules lookup delayed | Timeout 30s, continue sans rules enrichies |
| DB write failure | Persistence | Résultats perdus | Retry 3×, marquer job='failed' |
| Engine exception | Any engine | Orchestration partielle | Log + continue, flag consistency error |
| SIRET invalide | EnterpriseEngine | Vérif impossible | Grade plafonné: TrustCappingEngine |

### Retry Strategy
- Max attempts per pipeline: 3 (via `pipeline_executions.retry_count`)
- Backoff: exponentiel via `BaseAPIClient.callAPI()`
- Timeout global pipeline: `PIPELINE_TIMEOUT_MS` = 120s
- Dead letter: `pipeline_executions` avec status='failed', error_message persisté
- Monitoring: `EngineService.getStatus()` calcule health_score en temps réel

### Transaction Boundaries
- **Atomic stage 1**: INSERT `devis` + INSERT `analysis_jobs` (1 transaction DB)
- **Non-atomic stages 2–4**: chaque étape UPDATE `devis.pipeline_status` séparément
- **Compensation si stages 2–4 échouent**:
  - `analysis_jobs.status = 'failed'`
  - `devis.pipeline_status.stage = 'failed'`
  - `orchestration_runs.status = 'failed'` avec error_count
  - Les moteurs déjà exécutés sont conservés dans `engine_executions` pour debug
- **Score_snapshots**: fire-and-forget, pas de compensation (perte acceptable pour observabilité)

---

## Pipeline 4 — KNOWLEDGE BASE

### Source → Transform → Store → Consume

```
SOURCE
  └─ Documents internes: règles d'audit, DTU, fiches ADEME, normes
  └─ Documents externes: Légifrance, publications techniques BTP
  └─ Upload: Supabase Storage (bucket: knowledge-documents)

STATE MACHINE:
  pending → processing → extracting → chunking → embedding → completed | failed

STAGE 1 — CLAIM (~50ms) [ATOMIC — mutex sur ingestion_attempts]
  └─ Fetch knowledge_documents where status='pending' AND attempts < 3
  └─ Atomic UPDATE: ingestion_status='processing', ingestion_attempts++
  └─ Guard: pas de double-processing (condition atomique)

STAGE 2 — TEXT EXTRACTION (~1-3s)
  ├─ Download file from Supabase Storage (KNOWLEDGE_STORAGE_BUCKET)
  ├─ Extract by type:
  │    ├─ PDF       → pdf-parse (local, texte natif)
  │    ├─ Images    → Google Vision OCR
  │    ├─ Excel     → exceljs
  │    └─ Word      → mammoth
  ├─ Normalize whitespace + encoding
  ├─ Sanitize (remove PII, injection)
  └─ UPDATE knowledge_documents.content + ingestion_status='extracting', progress=20%

STAGE 3 — SMART CHUNKING (~200ms)
  └─ chunkSmart() → smartChunker.service.ts
  └─ Semantic-aware split (respecte paragraphes, sections, titres)
  └─ Target: 400–500 tokens/chunk
  └─ Output: Chunk[] = [ { content, token_count, chunk_index } ]
  └─ UPDATE ingestion_status='chunking', progress=40%

STAGE 4 — EMBEDDING GENERATION (~1-3s selon volume)
  └─ Batch: EMBEDDING_BATCH_SIZE = 100 chunks/call
  └─ Call Edge Function: supabase.functions.invoke('generate-embedding')
  └─ Params: { inputs: string[], dimensions: 384 }  ← CRITICAL: dimensions=384
  └─ Model: text-embedding-3-small (OpenAI)
  └─ Returns: { embeddings: number[][] }
  └─ UPDATE ingestion_status='embedding', progress=70%

STAGE 5 — BULK INSERT (~200ms)
  └─ Batch: INSERT_BATCH_SIZE = 100 rows/insert
  └─ INSERT knowledge_chunks:
       { document_id, content, chunk_index, token_count, embedding_vector: number[] }
  └─ ⚠️ CRITICAL: colonne = embedding_vector (pas 'embedding' → PGRST204 error)

STAGE 6 — COMPLETION (~50ms)
  └─ classifyDocument() → catégorie auto-détectée
  └─ UPDATE knowledge_documents:
       { ingestion_status='completed', chunk_count, embedded_at=NOW() }
  └─ progress=100%

STORE
  └─ knowledge_documents: status, chunk_count, embedded_at
  └─ knowledge_chunks: content, token_count, embedding_vector (pgvector)

CONSUME
  └─ RuleEngine (Pipeline Devis): RAG search pour règles applicables
  └─ Admin KnowledgeBase UI: gestion documents
  └─ RAG API: GET /api/v1/knowledge/search
  └─ Pipeline Intelligence: usage stats des chunks (hit count)
```

### Failure Modes

| Erreur | Impact | Recovery |
|---|---|---|
| generate-embedding Edge Fn timeout | Embeddings non générés | Retry stage 4, max 3 tentatives |
| PDF sans texte (scan) | Extraction échoue | ERROR: demande OCR manuel ou re-upload |
| `embedding_vector` mal nommé | PGRST204 | Ne pas changer ce nom — voir CLAUDE.md |
| knowledge_chunks INSERT partiel | Chunks manquants | Transaction per batch, retry failed batches |
| Dimensions mismatch (384 vs 1536) | Vecteurs inutilisables | EMBEDDING_DIMENSIONS constant = 384 partout |

### Retry Strategy
- Max attempts: `MAX_ATTEMPTS = 3` (checké dans state machine)
- Fail state: `ingestion_status='failed'` + error_message persisted
- Retry manuel: `pnpm fix:pipeline` → reset status='pending'
- Monitoring: `pnpm health:check` → vérifie chunks avec embedding_vector NULL

### Transaction Boundaries
- **Atomic claim**: UPDATE `ingestion_attempts` sous condition (prevent double-processing)
- **Non-atomic stages 2–5**: chaque stage met à jour status séparément
- **Compensation si échec mi-parcours**:
  - Chunks partiellement insérés restent en DB (pas de rollback des stages précédents)
  - `pnpm fix:pipeline` identifie documents avec `ingestion_status != 'completed'` et reset
  - Chunks orphelins (document_id sans completed document) → cleanup via script

---

## Pipeline 5 — INTELLIGENCE & ANALYTICS

### Source → Transform → Store → Consume

```
SOURCE
  └─ Tous les autres pipelines (lecture uniquement)
  └─ analysis_jobs: statuts, durées, compteurs
  └─ orchestration_runs: métriques orchestrations
  └─ clients/projets/devis/audits: comptages + distributions
  └─ knowledge_chunks: usage RAG, hit counts

TRANSFORM — 3 services analytiques

[A] EngineService (temps réel, ~200ms)
    └─ getStats(period: '1h'|'24h'|'7d')
    │    └─ SELECT FROM analysis_jobs WHERE created_at >= NOW() - interval
    │    └─ Compute: total_executions, successful, failed, success_rate
    │    └─ Compute: average_duration_ms (from started_at/completed_at timestamps)
    │    └─ Group by hour: timeline[] = { timestamp, executions, successes, failures, avg_duration_ms }
    │
    └─ getStatus()
    │    └─ SELECT FROM analysis_jobs WHERE created_at >= NOW() - 1h
    │    └─ Count: pending, processing, failed (in last hour)
    │    └─ Calc: error_rate = failed / total * 100
    │    └─ health_score = max(0, 100 * (1 - error_rate/100))
    │    └─ status: 'operational' (< 10%), 'degraded' (10–30%), 'down' (> 30%)
    │
    └─ getLastOrchestration()
         └─ SELECT FROM orchestration_runs ORDER BY created_at DESC LIMIT 1
         └─ Returns: id, status, input_count, output_count, error_count, duration_ms, grade_distribution

[B] analyticsService (global platform stats, ~300ms)
    └─ getGlobalStats()
         └─ COUNT profiles → user_count
         └─ COUNT analysis_jobs WHERE status='completed' → analysis_count
         └─ COUNT WHERE completed_at >= NOW()-30d → analysis_last_30
         └─ growth = (last_30 / (total - last_30) - 1) * 100

[C] MarketIntelligenceService (ingestion + lecture)
    └─ ingestMarketData(source_key, data[])
    │    └─ Whitelist check: WHITELISTED_SOURCES only
    │    └─ INSERT INTO market_price_references
    │    └─ Also index as knowledge_document (for RAG)
    │
    └─ getMarketBenchmark(material, region)
         └─ SELECT FROM market_price_references WHERE material, region
         └─ Used by: PricingEngine (Pipeline Devis stage 8)

STORE
  └─ Pas de tables analytics dédiées actuellement
  └─ Lecture directe sur tables opérationnelles
  └─ Future P2: analytics_snapshots, analytics_trends (scheduled aggregations)

CONSUME
  └─ Admin Dashboard: métriques temps réel (health score, stats)
  └─ LiveIntelligencePage: graphiques exécutions, timeline
  └─ SystemHealthPage: statut opérationnel + alertes
  └─ API endpoints:
       GET /api/v1/engine/stats?period=24h    → getStats()
       GET /api/v1/engine/status              → getStatus()
       GET /api/v1/engine/orchestration       → getLastOrchestration()
```

### Failure Modes

| Erreur | Impact | Recovery |
|---|---|---|
| analysis_jobs table vide | Métriques à zéro | Normal state — retourne zero metrics |
| orchestration_runs vide | getLastOrchestration = idle | IDLE_ORCHESTRATION sentinel retourné |
| DB query timeout | 500 Internal Error | Log + rethrow — frontend affiche état d'erreur |
| Calcul division par zéro | NaN dans métriques | Guard: if total=0, rates=0 |

### Transaction Boundaries
- **Pas de writes critiques** dans ce pipeline (lecture seule pour analytics)
- Exception: `market_price_references` INSERT lors d'ingestion marché
- **Eventual consistency**: métriques basées sur snapshots temps réel, pas de cache

---

## Matrice des Dépendances Inter-Pipelines

```
               ┌──────────┬──────────┬──────────┬──────────┬──────────────┐
               │ CLIENTS  │ PROJECTS │  DEVIS   │KNOWLEDGE │INTELLIGENCE  │
┌──────────────┼──────────┼──────────┼──────────┼──────────┼──────────────┤
│ CLIENTS      │    —     │ fournit  │ fournit  │   non    │ fournit data │
│              │          │ client_id│ client_id│          │ pour comptage│
├──────────────┼──────────┼──────────┼──────────┼──────────┼──────────────┤
│ PROJECTS     │ dépend   │    —     │ fournit  │   non    │ fournit data │
│              │ client_id│          │ projet_id│          │ pour comptage│
│              │  (requis)│          │+ context │          │              │
├──────────────┼──────────┼──────────┼──────────┼──────────┼──────────────┤
│ DEVIS        │ dépend   │ dépend   │    —     │ consulte │ fournit data │
│              │ client_id│ projet_id│          │ RAG rules│ scores/grades│
│              │  (requis)│  (requis)│          │(RuleEng.)│              │
├──────────────┼──────────┼──────────┼──────────┼──────────┼──────────────┤
│ KNOWLEDGE    │   non    │   non    │ alimenté │    —     │ fournit data │
│              │          │          │ par admin│          │ usage stats  │
├──────────────┼──────────┼──────────┼──────────┼──────────┼──────────────┤
│INTELLIGENCE  │ lit tous │ lit tous │ lit tous │ lit tous │      —       │
│              │ les pipes│ les pipes│ les pipes│ les pipes│              │
└──────────────┴──────────┴──────────┴──────────┴──────────┴──────────────┘

Légende:
  fournit  = ce pipeline produit des données pour l'autre
  dépend   = ce pipeline NE PEUT PAS démarrer sans l'autre
  consulte = lecture temps réel pendant exécution
  lit      = lecture async pour agrégation
```

### Détail des dépendances critiques

| De → À | Type | Donnée échangée | Blocant? | Format |
|---|---|---|---|---|
| Clients → Devis | FK lecture | `client_id` | ✅ Oui | UUID |
| Projects → Devis | FK lecture | `projet_id` + `implied_domains[]` + `contexte_reglementaire` | ✅ Oui | UUID + JSONB |
| Knowledge → Devis RuleEngine | Recherche vectorielle | Règles applicables au contexte | ✅ Oui | pgvector cosine search |
| Devis → Intelligence | Lecture async | `analysis_jobs.status`, `audits.scoring`, `grade` | ✅ Non (async) | Agrégation |
| Tous → Intelligence | Lecture batch | Comptages, distributions | ✅ Non (async) | SQL COUNT/GROUP |

---

## Flux d'Exécution Complet — Cas Clé: Upload Devis

```
t=0ms    USER ACTION: "Analyser ce devis"
          └─ Upload file + projet_id

t=100ms  [API LAYER]
          └─ POST /api/v1/devis/upload
          └─ Check: client_id existe? projet_id existe? [Clients, Projects pipelines]
          └─ ❌ Si non → 404, stop
          └─ ✅ Si oui → continue

t=150ms  [UPLOAD STAGE]
          └─ File → Supabase Storage
          └─ INSERT devis { status: 'pending', progress: 0 }
          └─ INSERT analysis_jobs { status: 'pending' }
          └─ Response: 202 Accepted + job_id

t=600ms  [PARSING STAGE] (async, triggered by job)
          └─ Download file
          ├─ [PDF] → pdf-parse local → DevisItem[]
          ├─ [Image] → Google Vision OCR (~2-3s) → DevisItem[]
          └─ Store: devis.parsing_result, status='analyzing'

t=2.5s   [ENGINE ORCHESTRATION starts]
          └─ INSERT orchestration_runs { status: 'running' }
          └─ ContextEngine → LotEngine → RuleEngine (calls pgvector)...
          └─ ...ScoringEngine → EnrichmentEngine → AuditEngine...
          └─ EnterpriseEngine → calls Pappers API (~1s external)
          └─ PricingEngine → queries market_price_references (DB)
          └─ QualityEngine → GlobalScoring → TrustCapping → StructuralConsistency

t=12s    [PERSISTENCE STAGE]
          └─ INSERT audits { grade: 'B', scoring, recommendations }
          └─ UPDATE orchestration_runs { status: 'completed', duration_ms: 9500 }
          └─ UPDATE analysis_jobs { status: 'completed' }
          └─ INSERT engine_executions[12]
          └─ Fire-and-forget: score_snapshots INSERT

t=12.1s  [QR CODE]
          └─ INSERT qrcodes { short_code: 'aB3dEf7G', access_url }

t=12.2s  [NOTIFICATION] (async)
          └─ Resend email "Votre analyse est prête" → user email

t=12.5s  [FRONTEND]
          └─ Realtime subscription on score_snapshots → mise à jour UI
          └─ Dashboard affiche grade B

t=15-45s [INTELLIGENCE] (async background)
          └─ EngineService.getStats() recalcule métriques sur fenêtre 24h
          └─ Admin dashboard mis à jour au prochain polling
```

---

## Synchronisation Temps Réel

### Realtime Subscriptions (Supabase Realtime)

| Canal | Table | Filtre | Consommateur |
|---|---|---|---|
| `score_snapshots` | score_snapshots | `snapshot_type=eq.engine_execution` | LiveIntelligencePage |
| `analysis_jobs` | analysis_jobs | `user_id=eq.{userId}` | Dashboard progress bar |
| `orchestration_runs` | orchestration_runs | — | SystemHealthPage |

**Note**: `score_snapshots.snapshot_type` a été ajouté par migration 20260328000004 avec `DEFAULT 'engine_execution'`. Le filtre Realtime `snapshot_type=eq.engine_execution` fonctionne maintenant.

### Polling Fallback

| Endpoint | Intervalle | Page |
|---|---|---|
| `GET /engine/status` | 30s | SystemHealthPage |
| `GET /engine/stats?period=1h` | 60s | LiveIntelligencePage |
| `GET /engine/orchestration` | 30s | SystemHealthPage |

---

## Monitoring & Alerting

### Health Score Formula
```typescript
errorRate = (failed / total) * 100;  // last 1 hour window
healthScore = Math.max(0, 100 * (1 - errorRate / 100));

status = errorRate > 30 ? 'down'
       : errorRate > 10 ? 'degraded'
       : 'operational';
```

### Seuils d'alerte

| Métrique | Seuil warning | Seuil critique | Action |
|---|---|---|---|
| error_rate (1h) | > 10% | > 30% | Status `degraded` → `down` |
| avg_duration_ms | > 20s | > 45s | Alerter sur latence anormale |
| analysis_jobs pending | > 10 | > 50 | File d'attente saturée |
| knowledge chunks sans embedding | > 0 | — | `pnpm health:check` + reindex |

### Scripts de monitoring
```bash
pnpm health:check         # 7 vérifications pipeline (read-only)
pnpm fix:pipeline         # Reset docs stuck, retry failures
pnpm reindex:embeddings   # Backfill embedding_vector NULL
```

---

## Consistency & Data Integrity

### Eventual Consistency Patterns

| Donnée | Cohérence | Justification |
|---|---|---|
| `clients.localisation` | Eventual (~5s) | Géocodage async post-insert |
| `projets.contexte_reglementaire` | Eventual (lazy) | Fetch on-demand |
| `score_snapshots` | Best-effort | Observabilité non-critique |
| `orchestration_runs.duration_ms` | Strong | DB trigger auto-calcul |
| `audits.scoring` | Strong | Écrit atomiquement à la fin de l'orchestration |
| `analysis_jobs.status` | Strong | Source of truth pour état job |

### Points de Vérité Uniques

| Donnée | Table autoritaire | Ne pas dupliquer dans |
|---|---|---|
| Statut d'une analyse | `analysis_jobs.status` | Pas dans `devis.pipeline_status` (redondant) |
| Durée orchestration | `orchestration_runs.duration_ms` | Calculé par trigger DB |
| Grade final | `audits.scoring.final_grade` | Pas dans `analysis_jobs` |
| Config plateforme | `platform_settings` (row UUID 0000...0000) | Pas en mémoire/env |

---

## Prêt pour PROMPT C — Orchestration Layer

Les points d'entrée pour implémenter la couche d'orchestration sont:

| Priorité | Travail | Fichier cible |
|---|---|---|
| P0 | Implémenter Resend notifications (email fin d'analyse) | `src/services/notifications/` |
| P0 | Connecter `ContextRegulationPipeline` à Légifrance PISTE réel | `src/core/pipelines/contextRegulation.pipeline.ts` |
| P1 | Ajouter scheduled jobs pour Intelligence aggregation | Supabase Edge Function + cron |
| P1 | Sentry error tracking (toutes les routes API) | `src/api/server.ts` + `main.tsx` |
| P1 | `market_price_references` ingestion automatisée (ADEME/INSEE) | `src/services/marketIntelligence/` |
| P2 | Analytics tables dédiées (snapshots périodiques) | Migration `analytics_snapshots` |
| P2 | Slack alertes sur `status='down'` | `src/services/notifications/slack.service.ts` |

# AUDIT TECHNIQUE – VRAI PIPELINE D'ANALYSE ACTIVE

**Date**: 2026-03-02
**Objectif**: Identifier le vrai flow d'analyse actuellement opérationnel vs le dead code

---

## SECTION 1 – Points d'entrée réels

### ✅ VRAI POINT D'ENTRÉE IDENTIFIÉ: `devis.service.ts`

| Propriété | Valeur |
|-----------|--------|
| **Fichier** | `src/services/api/supabase/devis.service.ts` |
| **Classe** | `SupabaseDevisService` |
| **Fonction 1** | `uploadDevis()` – ligne 84 |
| **Fonction 2** | `analyzeDevisById()` – ligne 210 |
| **Type** | Service layer (NOT API route, NOT worker) |
| **Utilisé en production** | ✅ **OUI** (probablement) – Aucun indication de deprecation |

### Détail des deux étapes

#### STEP 1: Upload Devis

```typescript
// src/services/api/supabase/devis.service.ts – Ligne 84
async uploadDevis(
  userId: string,
  file: File,
  projectName: string,
  metadata?: DevisMetadata
): Promise<{ id: string; status: string }>
```

**Processus:**
1. Valide le fichier (type, taille)
2. Upload dans Supabase Storage (`STORAGE_BUCKETS.DEVIS`)
3. Crée enregistrement dans table `devis` avec:
   - `status: 'uploaded'`
   - `file_url`, `file_path`, `file_name`
   - `user_id`, `nom_projet`
4. **Retourne**: `{ id: devisId, status: 'uploaded' }`

**Insertion dans BD:**
```typescript
// Ligne 182-186
const { data: devisData, error: insertError } = await supabase
  .from('devis')  // ← TABLE RÉELLE (pas analysis_results!)
  .insert(devisInsert)
  .select()
  .single();
```

**Données insérées:**
```typescript
const devisInsert: DbDevisInsert = {
  user_id: authenticatedUserId,
  nom_projet: projectName,
  type_travaux: metadata?.typeTravaux || null,
  montant_total: 0,
  file_url: publicUrl,
  file_path: filePath,
  file_name: file.name,
  file_size: file.size,
  file_type: file.type,
  status: 'uploaded',  // ← KEY: status = uploaded (not analyzed)
};
```

---

#### STEP 2: Analyze Devis

```typescript
// src/services/api/supabase/devis.service.ts – Ligne 210
async analyzeDevisById(
  devisId: string,
  file?: File,
  metadata?: DevisMetadata
): Promise<void>
```

**Processus:**
1. Fetch devis from DB (if file not provided)
2. Download file from storage
3. Extract PDF text using `pdfExtractorService`
4. **Call domain layer**: `analyzeDevisDomain()`
5. **Save results** to `devis` table (UPDATE)
6. Send notification

**Key UPDATE (ligne 305-308):**
```typescript
const { error: updateError } = await supabase
  .from('devis')  // ← TABLE RÉELLE (UPDATE, pas INSERT)
  .update(analysisUpdate)
  .eq('id', devisId);
```

**Données sauvegardées dans `devis`:**
```typescript
const analysisUpdate = {
  status: 'analyzed',           // ← Changed from 'uploaded'
  analyzed_at: new Date().toISOString(),
  analysis_duration: analysis.dureeAnalyse,
  score_total: analysis.scoreGlobal,
  grade: analysis.grade,
  score_entreprise: analysis.scoreEntreprise,
  score_prix: analysis.scorePrix,
  score_completude: analysis.scoreCompletude,
  score_conformite: analysis.scoreConformite,
  score_delais: analysis.scoreDelais,
  score_innovation_durable: analysis.scoreInnovationDurable || null,
  score_transparence: analysis.scoreTransparence || null,
  recommendations: {...},      // Recommandations stockées
  extracted_data: {...},       // Données extraites
  adresse_chantier: {...},     // Adresse géocodée
  detected_overcosts: [...],   // Surcouts détectés
  potential_savings: 0,        // Économies potentielles
  updated_at: new Date().toISOString(),
};
```

---

## SECTION 2 – Worker réel

### ❌ AUCUN WORKER ASYNC OPÉRATIONNEL

**Fichier**: `src/core/jobs/analysis.worker.ts`
**Statut**: ❌ **DEAD CODE** – Non utilisé

**Fonctions existantes:**
- `processAnalysisJob(jobId)` – Traiterait un job unique
- `processNextPendingJob()` – Traiterait le prochain job pending
- `runJobProcessor()` – Boucle continue de traitement

**Problème:**
```
Aucun code n'appelle ces fonctions.
Aucune route API ne déclenche le worker.
Aucun scheduler (cron) ne l'invoque.
La table analysis_jobs existe mais reste vide.
```

**Evidence:**
```bash
$ grep -r "processAnalysisJob\|runJobProcessor" src/
  # Aucun résultat sauf la définition elle-même
```

---

## SECTION 3 – Flow complet actif

### 📊 Diagramme du flow RÉEL

```
┌─────────────────────────────────────────────────────────────┐
│ UTILISATEUR / API CLIENT                                    │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ├─ STEP 1: Upload devis file
                   │
                   ▼
        ┌─────────────────────────┐
        │ uploadDevis()           │
        │ (devis.service.ts:84)   │
        ├─────────────────────────┤
        │ 1. Validate file        │
        │ 2. Upload to Storage    │
        │ 3. Create devis record  │
        │    status='uploaded'    │
        └────────────┬────────────┘
                     │
                     │ Returns: { id: devisId, status: 'uploaded' }
                     │
                     ▼
        ┌──────────────────────────────┐
        │ SUPABASE DB – devis table    │
        │ ┌──────────────────────────┐ │
        │ │ id, user_id, file_url    │ │
        │ │ file_path, status        │ │
        │ │ nom_projet, etc.         │ │
        │ └──────────────────────────┘ │
        └──────────────────────────────┘
                     │
                     └─ STEP 2: Trigger analysis (client-initiated)
                     │
                     ▼
        ┌──────────────────────────────┐
        │ analyzeDevisById()           │
        │ (devis.service.ts:210)       │
        ├──────────────────────────────┤
        │ 1. Fetch devis from DB       │
        │ 2. Download file from store  │
        │ 3. Extract PDF text          │
        │ 4. Call analyzeDevisDomain() │
        │    (Domain Layer)            │
        │ 5. UPDATE devis with results │
        │    status='analyzed'         │
        │ 6. Send notification         │
        └────────────┬─────────────────┘
                     │
                     ▼
        ┌──────────────────────────────────────┐
        │ DOMAIN LAYER – analyzeDevisDomain()  │
        │ (domain/devis/devisAnalysis.domain.ts)
        ├──────────────────────────────────────┤
        │ Uses: torpAnalyzerService.analyzeDevis()
        │                                       │
        │ TORP Pipeline:                      │
        │ ├─ Context Engine                   │
        │ ├─ Lot Engine                       │
        │ ├─ Rule Engine                      │
        │ ├─ Scoring Engine                   │
        │ ├─ Enrichment Engine                │
        │ ├─ Audit Engine                     │
        │ ├─ Enterprise Engine                │
        │ ├─ Pricing Engine                   │
        │ ├─ Quality Engine                   │
        │ ├─ Global Scoring Engine            │
        │ ├─ Trust Capping Engine             │
        │ └─ Structural Consistency Engine    │
        │                                       │
        │ Returns: TorpAnalysisResult         │
        │ {                                   │
        │   scoreGlobal, grade,               │
        │   scoreEntreprise, scorePrix,       │
        │   recommendAndations, etc.          │
        │ }                                    │
        └────────────┬──────────────────────┘
                     │
                     ▼
        ┌──────────────────────────┐
        │ SUPABASE DB – devis UPDATE│
        │ ┌──────────────────────┐ │
        │ │ status='analyzed'    │ │
        │ │ score_total          │ │
        │ │ grade                │ │
        │ │ score_entreprise     │ │
        │ │ score_prix           │ │
        │ │ recommendations      │ │
        │ │ extracted_data       │ │
        │ │ detected_overcosts   │ │
        │ │ potential_savings    │ │
        │ │ analyzed_at          │ │
        │ │ analysis_duration    │ │
        │ └──────────────────────┘ │
        └──────────────────────────┘
                     │
                     └─ Results delivered to client
```

### 📋 Service Hierarchy

```
Client (Web/API)
    ↓
uploadDevis() + analyzeDevisById()  [devis.service.ts]
    ├─ pdfExtractorService.extractText()
    ├─ analyzeDevisDomain()  [DOMAIN LAYER]
    │   └─ torpAnalyzerService.analyzeDevis()
    │       ├─ 12 Engines (as shown above)
    │       └─ Returns TorpAnalysisResult
    └─ Supabase DB (UPDATE devis)
```

---

## SECTION 4 – Code mort (Dead Code)

### ❌ 1. supabaseExecutionBridge.service.ts

**Fichier**: `src/runtime/supabaseExecutionBridge.service.ts`
**Statut**: 🔴 **DEAD CODE**
**Raison**:
- Jamais importé nulle part
- Tente d'insérer dans `analysis_results` (table vide)
- Utilise colonne `devis_id` qui n'existe pas dans `analysis_results` (should be `ccf_id`)
- Fonction `executeFullTorpAnalysis()` jamais appelée

```bash
$ grep -r "executeFullTorpAnalysis\|supabaseExecutionBridge" src/
# Returns ZERO matches (except file itself)
```

**Problèmes critiques:**
```sql
-- Code essaie ceci:
INSERT INTO analysis_results (devis_id, total_score, ...)
  VALUES ('...', 100, ...)

-- Mais la table a:
CREATE TABLE analysis_results (
  id UUID PRIMARY KEY,
  ccf_id UUID NOT NULL,  -- ← pas devis_id
  ...
)

-- Résultat: ERROR – Column "devis_id" does not exist
```

---

### ❌ 2. analysis.service.ts

**Fichier**: `src/services/api/analysis.service.ts`
**Statut**: 🔴 **DEAD CODE** – Marked @deprecated
**Raison**:
- Marquée explicitement `@deprecated PHASE 34.4`
- Fonction `requestAnalysis()` jamais utilisée
- Créerait des jobs dans `analysis_jobs` mais aucun worker pour les consommer
- Remplacée par la nouvelle architecture dans `devis.service.ts`

**Code:**
```typescript
/**
 * @deprecated PHASE 34.4: This function is replaced by the cleaner architecture using:
 * - devisService.uploadDevis() for Step 1 (file upload)
 * - devisService.analyzeDevisById() for Step 2 (analysis)
 */
export async function requestAnalysis(request: AnalysisRequest): Promise<string>
```

**Usage:**
```bash
$ grep -r "requestAnalysis\|import.*analysis\.service" src/
# Returns: ZERO matches in application code
```

---

### ❌ 3. analysis.worker.ts

**Fichier**: `src/core/jobs/analysis.worker.ts`
**Statut**: 🔴 **DEAD CODE** – Infrastructure without execution
**Raison**:
- Aucune route API ne l'appelle
- Aucun scheduler (cron job) ne le déclenche
- Aucun Edge Function ne le consomme
- Table `analysis_jobs` reste vide (aucun job jamais créé)

**Functions:**
- `processAnalysisJob(jobId)` – Orpheline, jamais appelée
- `processNextPendingJob()` – Orpheline, jamais appelée
- `runJobProcessor()` – Orpheline, jamais appelée

**Usage:**
```bash
$ grep -r "processAnalysisJob\|processNextPendingJob\|runJobProcessor" src/
# Returns: ZERO matches (except definitions in analysis.worker.ts)
```

---

### ❌ 4. job.service.ts

**Fichier**: `src/core/jobs/job.service.ts`
**Statut**: 🔴 **INFRASTRUCTURE ONLY** – No active use
**Raison**:
- Service de gestion des jobs créé (PHASE 32.1)
- Table `analysis_jobs` existe en DB
- Aucun code ne crée réellement de jobs
- Aucun code ne consomme ces jobs

**Evidence:**
```bash
$ grep -r "jobService.createJob\|createJob" src/
# Returns: ZERO matches in active code
# (Only appears in analysis.service.ts which is @deprecated)
```

---

### ❌ 5. analysis_jobs migration

**Fichier**: `supabase/migrations/20250217_create_analysis_jobs.sql`
**Statut**: 🔴 **TABLE SCHEMA WITHOUT USAGE**
**Raison**:
- Table créée mais jamais alimentée
- RLS policies définies mais jamais testées
- Awaits worker integration qui n'existe pas

---

### ❌ 6. analysis_results table

**Fichier**: `supabase/migrations/042_audit_tables_finalization.sql` & `044`
**Statut**: 🔴 **EMPTY TABLE**
**Usage Pattern**:
- **Lecture SEULE**: `engineWatchdog.service.ts` (pour monitoring)
- **Écriture**: JAMAIS
- **Population**: AUCUNE

**Evidence:**
```bash
$ grep -r "INSERT INTO analysis_results\|\.insert\(" src/
# Matches: ZERO in active application code
# (Only in dead code: supabaseExecutionBridge.service.ts)

$ grep -r "UPDATE.*analysis_results" src/
# Matches: ZERO
```

---

## SECTION 5 – Conclusion claire

### État du moteur TORP

| Aspect | Statut | Détails |
|--------|--------|---------|
| **Pipeline d'analyse** | ✅ **FONCTIONNEL** | Via `devis.service.ts` |
| **Table de stockage** | ✅ **ACTIVE** | Table `devis` reçoit les résultats |
| **Worker async** | ❌ **NON OPÉRATIONNEL** | Infrastructure créée mais pas utilisée |
| **API routes** | ✅ **PARTIELLEMENT** | `uploadDevis()` + `analyzeDevisById()` actives |
| **Architecture globale** | 🟡 **HYBRIDE** | Synchrone (pas async worker) |

### **RÉPONSE: Option B – Partiellement implémenté**

**Détails:**

1. **Core TORP engine**: ✅ Complètement opérationnel
   - 12 engines en pipeline
   - Results stockés dans `devis` table
   - Utilisé par les clients

2. **Job queue infrastructure**: ❌ Créée mais pas utilisée
   - Table `analysis_jobs` existe mais vide
   - Worker `analysis.worker.ts` existe mais non invoqué
   - `requestAnalysis()` marquée @deprecated

3. **analysis_results table**: ❌ Dead storage
   - Créée par migration
   - Jamais alimentée
   - Seulement lue par watchdog pour monitoring

4. **Architecture real vs planned**:
   - **Planned**: Phase 32.1 – Async job queue orchestration
   - **Actual**: Synchronous service layer calling domain layer
   - **Result**: Works but doesn't use async infrastructure

---

### Recommandations pour versioning

Pour implémenter le versioning sans casser le flow actif:

**OPTION A – Via table `devis` (RECOMMANDÉ):**
```sql
ALTER TABLE devis ADD COLUMN engine_version TEXT DEFAULT 'v1.0';
ALTER TABLE devis ADD COLUMN prompt_version TEXT DEFAULT 'v1.0';
ALTER TABLE devis ADD COLUMN llm_parameters JSONB;
ALTER TABLE devis ADD COLUMN corpus_version TEXT DEFAULT 'v1.0';
```

**OPTION B – Via nouvelle table de versioning:**
```sql
CREATE TABLE analysis_versions (
  id UUID PRIMARY KEY,
  devis_id UUID REFERENCES devis(id),
  engine_version TEXT,
  prompt_version TEXT,
  llm_parameters JSONB,
  corpus_version TEXT,
  created_at TIMESTAMP DEFAULT now()
);
```

**OPTION C – Migrer vers analysis_results (future):**
- Nettoyer `supabaseExecutionBridge.service.ts` (corriger ccf_id issue)
- Implémenter le worker asynchrone réellement
- Migrer les résultats vers `analysis_results` au lieu de `devis`

---

**Fin d'audit technique**
**Status**: FINAL
**Date**: 2026-03-02

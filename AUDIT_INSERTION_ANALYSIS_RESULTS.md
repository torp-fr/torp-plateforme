# AUDIT TECHNIQUE – INSERTION TABLE analysis_results

**Date**: 2026-03-02
**Scope**: Identification précise des points d'insertion dans la table `analysis_results`
**Objectif**: Permettre l'implémentation propre du versioning moteur

---

## SECTION 1 – Point(s) d'insertion analysis_results

### Point d'insertion UNIQUE identifié

| Propriété | Valeur |
|-----------|--------|
| **Fichier** | `src/runtime/supabaseExecutionBridge.service.ts` |
| **Ligne** | 335-339 |
| **Fonction** | `persistResultsToSupabase()` |
| **Type d'insertion** | `.insert()` – INSERT (NOT upsert, NOT update) |
| **Déclenchement** | Appelée par `executeFullTorpAnalysis()` (ligne 422) |

### Détails du code d'insertion

```typescript
// src/runtime/supabaseExecutionBridge.service.ts – Lignes 335-339

const { data: insertData, error: insertError } = await supabase
  .from('analysis_results')
  .insert([analysisResult])
  .select('id')
  .single();
```

**Objet inséré** (lignes 318-333):
```typescript
const analysisResult = {
  devis_id: devisId,                                    // ❌ INCOMPATIBLE (colonne inexistante)
  total_score: finalScore,                               // ✅ Column exists
  final_grade: finalGrade,                               // ✅ Column exists
  enterprise_score: (context.enterprise as any)?.score,   // ✅ Column exists
  price_score: (context.pricing as any)?.score,           // ✅ Column exists
  completeness_score: (context.audit as any)?.globalScore,// ✅ Column exists
  conformity_score: 0,                                     // ✅ Column exists
  delays_score: 0,                                         // ✅ Column exists
  summary: `TORP Analysis - Final Grade: ${finalGrade}...` // ✅ Column exists
  strengths: [],                                           // ✅ Column exists
  weaknesses: [],                                          // ✅ Column exists
  recommendations: [],                                     // ✅ Column exists
  created_by: (context as any)?.bridgeMetadata?.userId,   // ✅ Column exists
  created_at: new Date().toISOString(),                    // ✅ Column exists
};
```

### ⚠️ PROBLÈME CRITIQUÉ – Incompatibilité de schéma

Le code tente d'insérer `devis_id`, mais la table `analysis_results` utilise `ccf_id`:

**Migration 044** (définition actuelle):
```sql
CREATE TABLE IF NOT EXISTS analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  ccf_id UUID NOT NULL,                    -- ← NOM RÉEL (pas devis_id)
  quote_upload_id UUID REFERENCES quote_uploads(id) ON DELETE CASCADE,
  execution_context_id UUID REFERENCES execution_context_log(id),
  api_request_id UUID REFERENCES api_requests_log(id),

  -- Global scores
  total_score INTEGER,
  final_grade TEXT,
  percentage NUMERIC,
  ...
  ai_model TEXT,
  created_by UUID,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

**Impact**: L'insertion échouera si elle est appelée, car `devis_id` n'existe pas.

---

## SECTION 2 – Pipeline complet

### Vue d'ensemble du flow

```
┌─ DÉCLENCHEMENT (ACTUELLEMENT ABSENT)
│  ├─ Aucune route API ne l'appelle
│  ├─ Aucun worker ne l'appelle
│  └─ La fonction executeFullTorpAnalysis() existe mais n'est importée nulle part
│
├─ EXÉCUTION (FONCTION: executeFullTorpAnalysis)
│  ├─ Entrée: devisId: string
│  │
│  ├─ Step 1: Load devis from Supabase
│  │  └─ loadDevisFromSupabase(devisId) → SupabaseDevis
│  │     ├─ Query: SELECT * FROM devis WHERE id = devisId
│  │     └─ Retourne: devis record avec extracted_data, montant_total, etc.
│  │
│  ├─ Step 2: Build ExecutionContext
│  │  └─ buildExecutionContextFromDevis(devis) → EngineExecutionContext
│  │     ├─ Initialise context avec extracted_data
│  │     ├─ Copie scores: score_reputation, score_localisation
│  │     └─ Stocke metadata: bridgeMetadata.devisId, userId, companyId
│  │
│  ├─ Step 3: Execute full TORP pipeline
│  │  └─ executeFullTorpPipeline(context) → EngineExecutionContext (enrichie)
│  │     ├─ Lazy load 12 engines:
│  │     │  ├─ ContextEngine
│  │     │  ├─ LotEngine
│  │     │  ├─ RuleEngine
│  │     │  ├─ ScoringEngine
│  │     │  ├─ EnrichmentEngine
│  │     │  ├─ AuditEngine
│  │     │  ├─ EnterpriseEngine
│  │     │  ├─ PricingEngine
│  │     │  ├─ QualityEngine
│  │     │  ├─ GlobalScoringEngine
│  │     │  ├─ TrustCappingEngine
│  │     │  └─ StructuralConsistencyEngine
│  │     └─ Chaque engine exécute: engine.execute(context)
│  │        (Graceful degradation: continue même si un engine échoue)
│  │
│  ├─ Step 4: Extract official results
│  │  ├─ finalGrade = getOfficialGrade(context)
│  │  │  └─ Source prioritaire: context.finalProfessionalGrade
│  │  │                       → context.globalScore?.grade
│  │  │                       → context.trustCapping?.grade
│  │  │                       → 'E' (fallback)
│  │  │
│  │  └─ finalScore = getOfficialScore(context)
│  │     └─ Source: context.globalScore?.score
│  │                → context.audit?.globalScore
│  │                → 0 (fallback)
│  │
│  └─ Step 5: Persist results to Supabase
│     └─ persistResultsToSupabase(devisId, context, finalGrade, finalScore)
│        ├─ 5a: UPDATE devis table
│        │   └─ UPDATE devis SET score_total, grade, scoring_v2, scoring_breakdown
│        │
│        ├─ 5b: INSERT analysis_results ← **POINT D'INSERTION AUDIT**
│        │   └─ INSERT INTO analysis_results (devis_id, total_score, ...)
│        │      ❌ PROBLÈME: devis_id n'existe pas
│        │
│        └─ 5c: INSERT score_snapshots
│            └─ INSERT INTO score_snapshots (devis_id, execution_context_id, ...)
│
└─ RETOUR: ExecutionBridgeResult
   ├─ success: boolean
   ├─ devisId: string
   ├─ finalGrade: string
   ├─ finalScore: number
   ├─ snapshotId: UUID
   ├─ analysisResultId: UUID
   ├─ errors: string[]
   └─ metadata:
      ├─ version: '1.0'
      ├─ executedAt: ISO timestamp
      ├─ durationMs: number
      ├─ engineCount: 12
      └─ persistenceStatus: 'success'|'partial'|'failed'
```

### Détail du service

| Aspect | Valeur |
|--------|--------|
| **Type d'architecture** | TypeScript synchrone (NOT async worker) |
| **Emplacement** | `src/runtime/supabaseExecutionBridge.service.ts` |
| **Fonction principale** | `executeFullTorpAnalysis(devisId: string)` |
| **Route API qui l'appelle** | ❌ AUCUNE (non utilisée actuellement) |
| **Worker async** | ❌ NON – c'est du code synchrone pur |
| **Trigger** | ❌ NON – elle doit être appelée manuellement |
| **Bases de données** | Supabase |

### Flow des données

**Entrée:**
```
devisId (string)
└─ Charge devis depuis DB
   └─ Extrait data: extracted_data, montant_total, scores, etc.
```

**Traitement:**
```
EngineExecutionContext
├─ projectData: extracted_data du devis
├─ context: { detectedLots[], summary }
├─ lots: { normalizedLots[], complexityScore }
├─ rules: { obligations[], typeBreakdown }
├─ audit: { riskScore, globalScore }
├─ enterprise: { score, summary, yearsInBusiness, hasInsurance }
├─ pricing: { score, totalAmount, avgPerLot }
├─ quality: { score, descriptionLength, hasLegalMentions }
├─ geography: { score, region, department }
└─ bridgeMetadata: { devisId, userId, companyId, loadedAt }

(Après pipeline)
└─ Enrichie par 12 engines
   ├─ Chaque engine ajoute/met à jour ses résultats
   ├─ Derniers scores: finalProfessionalGrade, globalScore
   └─ Final: finalGrade et finalScore extraits
```

**Sortie:**
```
Trois tables insérées:
1. devis – UPDATE (score_total, grade, scoring_v2)
2. analysis_results – INSERT (scores, summary, metadata)
3. score_snapshots – INSERT (execution context snapshot)
```

---

## SECTION 3 – Versioning existant ?

### État ACTUEL du versioning

| Concept | Existe ? | Détails |
|---------|----------|---------|
| **Version moteur** | ❌ **NON** | Aucune colonne `engine_version` dans `analysis_results` |
| **Version prompt** | ❌ **NON** | Aucune colonne `prompt_version` dans `analysis_results` |
| **Modèle LLM utilisé** | ✅ **OUI** | Colonne `ai_model TEXT` en migration 042/044 |
| **Paramètres LLM** | ❌ **NON** | Aucune colonne `llm_parameters` ou `llm_config` |
| **Version corpus régul.** | ❌ **NON** | Aucune colonne `corpus_version` dans `analysis_results` |

### Versioning dans d'autres tables

**Table `devis`:**
```sql
-- Migration 010
ALTER TABLE public.devis ADD COLUMN scoring_version TEXT DEFAULT 'v1';
```
✅ La table `devis` a `scoring_version`, mais pas `analysis_results`.

**Table `knowledge_documents`:**
```sql
-- Migration 065
ALTER TABLE knowledge_documents ADD COLUMN version_number INTEGER DEFAULT 1;
```
✅ La KB a versioning, mais pas lié à `analysis_results`.

### Conclusion sur versioning

**Actuellement:**
- ✅ Modèle LLM est enregistré (colonne `ai_model`)
- ❌ Aucune version du moteur
- ❌ Aucune version du prompt
- ❌ Aucun enregistrement des paramètres LLM
- ❌ Aucune version du corpus

**Impact:** Les analyses ne sont pas traçables en termes de version du moteur. Les futures améliorations du moteur TORP ne pourront pas être distinguées de celles des versions antérieures.

---

## SECTION 4 – Architecture technique

### Type d'insertion

| Propriété | Valeur |
|-----------|--------|
| **Point d'insertion unique** | ✅ Confirmé – UN SEUL |
| **Générée via API route** | ❌ **NON** – pas d'API route actuellement |
| **Générée via worker async** | ❌ **NON** – c'est du code TypeScript synchrone |
| **Batch insert** | ✅ **OUI** – `.insert([analysisResult])` (tableau) |
| **Upsert** | ❌ **NON** – `.insert()` simple, pas `.upsert()` |
| **Update** | ❌ **NON** – INSERT uniquement |

### Appels de fonction

```typescript
// RECHERCHE: executeFullTorpAnalysis
Files referencing: src/runtime/supabaseExecutionBridge.service.ts
├─ Déclaration de export: OUI
├─ Import dans src/api/: AUCUN
├─ Import dans src/pages/: AUCUN
├─ Import dans src/services/: AUCUN
├─ Import dans src/components/: AUCUN
└─ Utilisation globale: AUCUNE
```

### Résumé architectural

```
ARCHITECTURE ACTUELLE:

┌─────────────────────────────────────────────────┐
│  supabaseExecutionBridge.service.ts             │
│  ┌──────────────────────────────────────────┐  │
│  │ executeFullTorpAnalysis (devisId)        │  │
│  ├──────────────────────────────────────────┤  │
│  │ ✅ Exportée                              │  │
│  │ ❌ Importée nulle part                   │  │
│  │ ❌ Pas de route API l'appelant           │  │
│  │ ❌ Pas de worker la déclenchant          │  │
│  └──────────────────────────────────────────┘  │
│                     ↓                            │
│  ┌──────────────────────────────────────────┐  │
│  │ 12 Engines en pipeline séquentiel        │  │
│  │ (ContextEngine → ... → StructuralEngine) │  │
│  └──────────────────────────────────────────┘  │
│                     ↓                            │
│  ┌──────────────────────────────────────────┐  │
│  │ persistResultsToSupabase()               │  │
│  ├──────────────────────────────────────────┤  │
│  │ 1. UPDATE devis                          │  │
│  │ 2. INSERT analysis_results ← AUDIT POINT │  │
│  │ 3. INSERT score_snapshots                │  │
│  └──────────────────────────────────────────┘  │
│                                                  │
│           SUPABASE (Postgres)                   │
│  ┌─────────────────────────────────────────┐   │
│  │ analysis_results (ccf_id, scores, ...)  │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### Statut: DEAD CODE?

**Hypothèse**: La fonction `executeFullTorpAnalysis()` semble être du code préparatoire non intégré.

**Indices:**
- ✅ Fonction complète et fonctionnelle
- ✅ Bien documentée
- ❌ Aucun point d'entrée (API, worker, trigger)
- ❌ N'est importée nulle part
- ❌ Incompatibilité de schéma (devis_id vs ccf_id)
- ❌ N'a jamais été appelée (probablement)

---

## ANNEXES

### A – Schéma de analysis_results

```sql
CREATE TABLE analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  ccf_id UUID NOT NULL,
  quote_upload_id UUID REFERENCES quote_uploads(id),
  execution_context_id UUID REFERENCES execution_context_log(id),
  api_request_id UUID REFERENCES api_requests_log(id),

  -- Scores (5 axes + global)
  total_score INTEGER,           -- 0-1000
  final_grade TEXT,              -- 'A','B','C','D','E','F'
  percentage NUMERIC,            -- 0-100
  enterprise_score INTEGER,      -- 250 pts
  enterprise_grade TEXT,
  price_score INTEGER,           -- 300 pts
  price_grade TEXT,
  completeness_score INTEGER,    -- 200 pts
  completeness_grade TEXT,
  conformity_score INTEGER,      -- 150 pts
  conformity_grade TEXT,
  delays_score INTEGER,          -- 100 pts
  delays_grade TEXT,

  -- Detailed results
  summary TEXT,
  strengths TEXT[],
  weaknesses TEXT[],
  recommendations TEXT[],

  -- References
  kb_references JSONB,
  criteria_used TEXT[],
  data_sources TEXT[],

  -- Metadata
  analysis_type TEXT DEFAULT 'full',
  ai_model TEXT,                 -- Model used (e.g., 'claude-opus')
  created_by UUID,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

### B – ExecutionBridgeResult type

```typescript
interface ExecutionBridgeResult {
  success: boolean;
  devisId: string;
  finalGrade?: string;
  finalScore?: number;
  snapshotId?: string;
  analysisResultId?: string;
  errors?: string[];
  metadata: {
    version: string;
    executedAt: string;
    durationMs: number;
    engineCount: number;
    persistenceStatus: 'success' | 'partial' | 'failed';
  };
}
```

### C – TORP Engine Pipeline

```
1. ContextEngine         → Détecte lots et contexte
2. LotEngine            → Normalise les lots
3. RuleEngine           → Applique règles de conformité
4. ScoringEngine        → Scoring initial
5. EnrichmentEngine     → Enrichit données
6. AuditEngine          → Audit conformité
7. EnterpriseEngine     → Évalue entreprise (250 pts)
8. PricingEngine        → Évalue prix (300 pts)
9. QualityEngine        → Évalue qualité
10. GlobalScoringEngine → Score global (1000 pts)
11. TrustCappingEngine  → Applique capping
12. StructuralConsistencyEngine → Validation
```

### D – RLS Policies sur analysis_results

```sql
-- Migration 042
CREATE POLICY "Users see analysis results for their CCFs"
  ON analysis_results FOR SELECT
  USING (
    ccf_id IN (SELECT id FROM ccf WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Service role can insert analysis results"
  ON analysis_results FOR INSERT
  WITH CHECK (true);
```

---

## RECOMMANDATIONS POUR VERSIONING

Pour implémenter le versioning du moteur correctement:

1. **Ajouter colonne `engine_version`** à `analysis_results`
2. **Ajouter colonne `prompt_version`** à `analysis_results`
3. **Ajouter colonne `llm_parameters`** (JSONB) à `analysis_results`
4. **Ajouter colonne `corpus_version`** à `analysis_results`
5. **Corriger incompatibilité**: Ajouter `ccf_id` ou `devis_id` selon la réalité (ACTUELLEMENT: `ccf_id`)
6. **Intégrer le bridge**: Créer une API route ou worker qui appelle `executeFullTorpAnalysis()`

---

**Fin d'audit technique**
**Date**: 2026-03-02

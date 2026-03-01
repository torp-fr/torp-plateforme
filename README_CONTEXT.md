# 🧠 BTP INTELLIGENCE ENGINE

## Strategic Vision Document

---

## 🎯 Vision

Ce projet n'est **pas un simple RAG**. C'est un **moteur d'évaluation contextuelle réglementaire et commerciale des devis BTP**.

Il permet :

- D'**analyser un devis** selon le contexte projet (CCF)
- D'**intégrer le profil entreprise** (INSEE, Pappers, assurances, etc.)
- D'**identifier le cadre réglementaire applicable** aux travaux
- D'**évaluer la conformité, les risques et les optimisations**
- De **générer un score multi-thématique** (A → E)
- De **produire une restitution adaptée** (B2B / B2C)

---

## 🏗️ Architecture Actuelle

### 1️⃣ Ingestion Worker (Railway)

**Rôle:** Transformer les documents sources en base de connaissances structurée et fouillable.

**Capacités:**
- Multi-format (PDF, DOCX, XLSX, Images avec OCR)
- Structuration intelligente des sections et hiérarchies
- Chunking smart (respecte les limites sémantiques)
- Enrichissement métier (catégorie, version, dates)
- Pondération réglementaire (DTU=5, MANUAL=1)
- Embeddings OpenAI text-embedding-3-small (1536-dim)
- Stockage Supabase avec pgvector

**Stack:**
- Node.js (Railway compatible)
- Supabase JS SDK v2
- OpenAI Embeddings API
- Modular architecture (extractors, processors, core)

**Metadata enrichis:**
- `category` - Type de document (DTU, EUROCODE, REGULATION, etc.)
- `document_version` - Version gelée à l'ingestion
- `authority_weight` - Poids réglementaire (1-5)
- `metier_target` - Domaine applicatif
- `document_type` - Classification
- `effective_date` / `expiration_date` - Validité temporelle

---

### 2️⃣ Recherche Experte

**Rôle:** Retrouver les sources pertinentes pour un contexte donné.

**RPC Supabase:** `search_knowledge_expert(query_embedding, match_count, filter_category, filter_metier)`

**Scoring Hybride:**
- **60%** Similarité vectorielle (distance cosinus)
- **20%** Autorité réglementaire (weight du chunk)
- **20%** Validité temporelle (effective_date ≤ now ≤ expiration_date)

**Résultat:** Top-N chunks triés par `final_score` (0-1).

---

### 3️⃣ CCF (Cahier des Charges Fonctionnel)

**Rôle:** Capturer le contexte projet pour contextualiser l'analyse.

Le moteur dispose via le wizard de :
- Nature des travaux (rénovation, neuf, extension, etc.)
- Contraintes projet (budget, délai, complexité)
- Contexte client (public/privé, secteur, localisation)
- Localisation (région, commune, altitude)

Cette contextualisation alimente :
- La sélection des normes applicables
- L'évaluation des risques
- La recommandation d'optimisations
- Le score final

---

### 4️⃣ Profil Entreprise (Future Layer)

**Rôle:** Intégrer les données publiques de l'entreprise pour affiner l'analyse.

**Sources:**
- INSEE (SIRET, effectifs, secteur)
- Pappers (structure, dirigeants, financier)
- BODACC (annonces légales, modifications)
- Assurances (garanties, sinistralités)
- Certifications (RGE, Qualibat, etc.)

**Usage:** Contextualiser les recommandations par rapport à la capacité réelle de l'entreprise.

---

## 🧭 Philosophie du Moteur

Le moteur :

✅ **Ne recopie pas les normes** - Il n'est pas Wikipedia réglementaire.

✅ **Identifie l'applicabilité** - Applique la bonne norme au bon contexte.

✅ **Contextualise** - Intègre CCF, localisation, profil entreprise.

✅ **Introduit de la nuance** - Distingue obligation, recommandation, optimisation.

✅ **Valorise l'expertise** - Met en avant les écarts positifs entreprise/standart.

✅ **Sécurise juridiquement** - Documente les décisions, trace l'analyse.

✅ **Propose des optimisations** - Identifie marges de manœuvre et gains.

---

## 🎯 Objectif Final

Créer un **moteur expert BTP capable de :**

1. **Auditer un devis** - Analyser complétude, cohérence, conformité
2. **Générer un score multi-critères** - A (excellent) → E (critique)
3. **Expliquer ce score** - Sources, logique, décisions
4. **Aider à la décision** - Recommandations actionnables

**Outcome:** De devis accepté/refusé → de devis optimisé/sécurisé.

---

## 📊 Périmètre vs Out of Scope

### ✅ In Scope

- Identification des normes applicables
- Évaluation conformité vs. normes
- Détection de risques réglementaires
- Recommandations d'optimisation
- Scoring multi-thématique (A-E)
- Audit trail complet
- Restitution contextualisée

### ❌ Out of Scope

- Calculs d'estimé (chiffrage devis)
- Négociation prix
- Planification chantier
- Gestion RH/logistique
- Reporting financier post-chantier

---

## 🔄 Data Flow

```
INGESTION PIPELINE (Worker):
┌─────────────────────────────┐
│   Document Source           │
│  (PDF/DOCX/XLSX/Images)     │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│   Multi-Format Extraction   │
│  (pdf-parse, mammoth, xlsx, │
│   Google Vision OCR)        │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│   Text Processing           │
│  (Cleaning, Normalization,  │
│   Section Detection)        │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│   Smart Chunking            │
│  (Respect Semantics)        │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│   Metadata Enrichment       │
│  (Category, Weight,         │
│   Authority, Dates)         │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│   Embedding Generation      │
│  (OpenAI text-embed-3-small)│
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│   Supabase Storage          │
│  (knowledge_chunks + pgvector)
└──────────────┬──────────────┘

RETRIEVAL PIPELINE (Search):
┌─────────────────────────────┐
│   User Query                │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│   Query Embedding           │
│  (OpenAI text-embed-3-small)│
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│   RPC search_knowledge_expert
│  (Vector + Authority + Date)│
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│   Sorted Results            │
│  (final_score descending)   │
└─────────────────────────────┘
```

---

## 📌 Prochaine Étape Stratégique

### Deliverable Critique: Définir le Modèle de Scoring Multi-Thématique

**Objectif:** Établir la logique officielle de scoring A-E.

**Dimensions à couvrir:**

1. **Conformité Réglementaire** (35%)
   - Couverture normes applicables
   - Respect structure/contenu
   - Absence pénalités légales

2. **Risques Identifiés** (25%)
   - Risques techniques/chantier
   - Risques commerciaux
   - Risques assurabilité

3. **Couverture Contratuelle** (20%)
   - Clauses essentielles présentes
   - Protection juridique
   - Responsabilités claires

4. **Opportunités d'Optimisation** (20%)
   - Gains économiques possibles
   - Améliorations processus
   - Différenciation marché

**Outcome:** Matrice scoring officielle → Implémentation moteur.

---

## 🛠️ Tech Stack Reference

### Ingestion & Storage
- **Worker Runtime:** Node.js (Railway)
- **Database:** Supabase PostgreSQL
- **Vector Search:** pgvector
- **Embeddings:** OpenAI text-embedding-3-small (1536-dim)

### Retrieval & Search
- **RPC Engine:** Supabase (SQL-based)
- **Scoring:** Hybrid (vectoriel + règles)
- **Client SDK:** Supabase JS v2

### Document Processing
- **PDF:** pdf-parse
- **DOCX:** mammoth
- **XLSX:** xlsx
- **OCR:** Google Vision API

---

## 📋 Conventions de Code

### Enrichissement Métier

Tout nouveau chunk doit inclure :
```javascript
{
  // Core
  document_id: UUID,
  chunk_index: INT,
  content: TEXT,

  // Metadata structurel
  section_title: TEXT,
  section_level: INT,
  metadata: JSONB,

  // Metadata métier
  category: TEXT,        // DTU, EUROCODE, REGULATION, etc.
  document_version: TEXT, // Gelé à l'ingestion
  authority_weight: INT,  // 1-5 based on category
  metier_target: TEXT,    // construction, renovation, etc.
  document_type: TEXT,    // Based on category
  effective_date: DATE,   // Validité start
  expiration_date: DATE,  // Validité end

  // Source & embedding
  source_type: TEXT,      // pdf, docx, xlsx, image_ocr
  extraction_confidence: TEXT, // native or ocr
  embedding: VECTOR(1536),
  embedding_generated_at: TIMESTAMP
}
```

### Scoring (RPC Level)

Tout RPC retournant des chunks doit calculer :
```sql
final_score = (
  vector_similarity * 0.60 +
  (authority_weight / 5) * 0.20 +
  temporal_validity * 0.20
)
```

---

## 🚀 Transition vers Production

### Phase 1: Knowledge Base (Actuelle)
✅ Ingestion multi-format
✅ Enrichissement métier
✅ Recherche vectorielle + RPC
⏳ Recherche hybrid scoring

### Phase 2: CCF Integration
⏳ Wizard contextualisé
⏳ Ingestion CCF en DB
⏳ Filtrage dynamique par contexte

### Phase 3: Profil Entreprise
⏳ Intégration INSEE/Pappers
⏳ Enrichissement scoring
⏳ Recommandations personnalisées

### Phase 4: Scoring & Restitution
⏳ Moteur scoring multi-thématique
⏳ Génération rapport audit
⏳ UI restitution B2B/B2C

---

## 📚 Documentation Complémentaire

- `rag-worker/README.md` - Worker architecture details
- `rag-worker/core/searchKnowledgeExpert.js` - Search API
- `rag-worker/core/embeddingService.js` - Embedding management
- Supabase docs - RPC function definitions

---

## 🎓 Principes d'Architecture

1. **Séparation des concerns** - Ingestion, recherche, scoring découplés
2. **Scalabilité** - Batch operations, async processing, pooling
3. **Auditabilité** - Metadata, timestamps, source tracking
4. **Contexualisation** - CCF + profil entreprise + localisation
5. **Humanisation** - Explainability, nuance, recommandations

---

**Last Updated:** 2026-03-01
**Version:** 1.0 - Strategic Foundation
**Status:** Active Development - Phase 1

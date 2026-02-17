# Architecture — Phase 35: Knowledge Brain System

---

## 🏗️ SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                    TORP ANALYSIS PIPELINE                        │
└─────────────────────────────────────────────────────────────────┘

USER UPLOADS DEVIS
      │
      ├─→ [DEVIS EXTRACTION]
      │       └─→ Parse PDF/text
      │
      ├─→ [ENTERPRISE ANALYSIS]
      │       ├─→ RGE verification
      │       └─→ Company info
      │
      ├─→ [PRIX ANALYSIS] ◄─── ENHANCED IN PHASE 35
      │       ├─→ Knowledge Brain: searchRelevantKnowledge()
      │       ├─→ Knowledge Brain: injectKnowledgeContext()
      │       ├─→ AI generates with context
      │       ├─→ Market Intelligence: detectAnomalies()
      │       └─→ Market Intelligence: adjustPriceScore()
      │
      ├─→ [COMPLÉTUDE ANALYSIS] ◄─── ENHANCED IN PHASE 35
      │       ├─→ Knowledge Brain: Best practices injection
      │       └─→ AI scores with context
      │
      ├─→ [CONFORMITÉ ANALYSIS] ◄─── ENHANCED IN PHASE 35
      │       ├─→ Knowledge Brain: Regulatory standards
      │       └─→ AI scores with context
      │
      ├─→ [DÉLAIS ANALYSIS] ◄─── ENHANCED IN PHASE 35
      │       ├─→ Knowledge Brain: Timeline benchmarks
      │       └─→ AI scores with context
      │
      ├─→ [INNOVATION & TRANSPARENCE]
      │       └─→ Standard scoring
      │
      ├─→ [SYNTHESIS]
      │       └─→ Final score calculation
      │
      └─→ ANALYSIS COMPLETE
            ├─→ All scores context-aware
            ├─→ Anomalies detected
            └─→ Learning feedback stored
```

---

## 📦 COMPONENT INTERACTION DIAGRAM

```
┌────────────────────────────────────────────────────────────────┐
│              TORP Analyzer Service                              │
│  (torp-analyzer.service.ts)                                     │
│                                                                 │
│  • analyzeDevis() — Main orchestration                         │
│  • analyzePrix() — Calls Knowledge Brain                       │
│  • analyzeCompletude() — Calls Knowledge Brain                 │
│  • analyzeConformite() — Calls Knowledge Brain                 │
│  • analyzeDelais() — Calls Knowledge Brain                     │
│                                                                 │
│       ↓          ↓           ↓                                  │
└───────┼──────────┼───────────┼──────────────────────────────────┘
        │          │           │
        │    ┌─────┴───────┬───┴─────┐
        │    │             │         │
        ▼    ▼             ▼         ▼
   ┌────────────────┐  ┌─────────────────────┐
   │   Hybrid AI    │  │ Knowledge Brain     │
   │    Service     │  │ Service             │
   │                │  │                     │
   │ • Generate     │  │ • Add documents     │
   │ • Temperature  │  │ • Generate embed.   │
   │ • JSON mode    │  │ • Search knowledge  │
   └────────────────┘  │ • Inject context    │
                       │ • Store feedback    │
                       │ • Get stats         │
                       │                     │
                       │      ↓              │
                       │  ┌──────────────┐   │
                       │  │ Knowledge    │   │
                       │  │ Documents DB │   │
                       │  │ • source     │   │
                       │  │ • category   │   │
                       │  │ • content    │   │
                       │  │ • reliability│   │
                       │  └──────────────┘   │
                       │                     │
                       │  ┌──────────────┐   │
                       │  │ Embeddings   │   │
                       │  │ Vector DB    │   │
                       │  │ (pgvector)   │   │
                       │  │ • 1536-dim   │   │
                       │  │ • similarity │   │
                       │  └──────────────┘   │
                       └─────────────────────┘
                             │
        ┌────────────────────┘
        │
        ▼
   ┌──────────────────────────┐
   │ Market Intelligence      │
   │ Service                  │
   │                          │
   │ • Ingest data            │
   │ • Update averages        │
   │ • Detect anomalies       │
   │ • Adjust scores          │
   │ • Get summary            │
   │                          │
   │      ↓                   │
   │  ┌──────────────────┐    │
   │  │ Market Price     │    │
   │  │ References DB    │    │
   │  │ • work type      │    │
   │  │ • region         │    │
   │  │ • min/avg/max    │    │
   │  │ • reliability    │    │
   │  └──────────────────┘    │
   │                          │
   │  ┌──────────────────┐    │
   │  │ Learning         │    │
   │  │ Feedback DB      │    │
   │  │ • corrections    │    │
   │  │ • verified       │    │
   │  │ • insights       │    │
   │  └──────────────────┘    │
   └──────────────────────────┘
```

---

## 🔄 DATA FLOW — PRICE ANALYSIS EXAMPLE

```
PRIX ANALYSIS CALLED
│
├─→ 1. buildPrixAnalysisPrompt(devisData)
│       └─→ Creates base prompt
│
├─→ 2. knowledgeBrainService.injectKnowledgeContext(prompt)
│       ├─→ Search: SELECT * FROM knowledge_documents
│       │           WHERE category='pricing' AND is_active=true
│       ├─→ Generate embedding: OpenAI embed(prompt)
│       ├─→ Vector search: embedding <-> query_embedding
│       ├─→ Fetch top 5 relevant documents
│       ├─→ Build context section
│       ├─→ Append to prompt
│       └─→ Return enriched prompt
│
├─→ 3. knowledgeBrainService.getMarketPricing(type, region)
│       └─→ Fetch market_price_references
│           WHERE type_travaux='isolation' AND region='IDF'
│
├─→ 4. Append market context to prompt
│
├─→ 5. hybridAIService.generateJSON(enrichedPrompt)
│       └─→ AI analyzes with full context
│           └─→ Returns price score
│
├─→ 6. marketIntelligenceService.adjustPriceScore()
│       ├─→ Get market average: €65/m²
│       ├─→ Get quote price: €140/m²
│       ├─→ Calculate deviation: (140-65)/65 = 115%
│       ├─→ This is > 20% threshold
│       ├─→ Is anomaly? YES
│       ├─→ Reduce score by 20
│       └─→ Return adjusted score
│
└─→ 7. Return final analysis with adjusted scores
```

---

## 🗄️ DATABASE SCHEMA RELATIONSHIPS

```
┌──────────────────────────────────┐
│    knowledge_documents           │
├──────────────────────────────────┤
│ id                               │
│ source (market_survey, etc)      │
│ category (pricing, regulations)  │
│ region (nullable)                │
│ content                          │
│ reliability_score                │
│ is_active                        │
└──────────────────┬───────────────┘
                   │ 1
                   │
                   │ N
                   ▼
        ┌──────────────────────────┐
        │  knowledge_embeddings    │
        ├──────────────────────────┤
        │ id                       │
        │ document_id (FK)         │
        │ embedding (vector-1536)  │
        │ chunk_index              │
        └──────────────────────────┘

┌──────────────────────────────────┐
│  market_price_references         │
├──────────────────────────────────┤
│ id                               │
│ type_travaux                     │
│ region                           │
│ min_price / avg_price / max_price│
│ source                           │
│ data_count (aggregation count)   │
│ reliability_score                │
│ is_active                        │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│  analysis_learning_feedback      │
├──────────────────────────────────┤
│ id                               │
│ devis_id (FK)                    │
│ user_id (FK)                     │
│ feedback_type                    │
│ correction_data (JSONB)          │
│ confidence_score                 │
│ is_verified                      │
│ created_at                       │
└──────────────────────────────────┘
```

---

## 🔐 SECURITY LAYERS

```
┌─────────────────────────────────────┐
│  Authentication (auth.users)        │
└────────────────┬────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
   ┌──────────┐   ┌──────────────────┐
   │ Admin    │   │ Authenticated    │
   │ Role     │   │ User             │
   │          │   │                  │
   │ • Add    │   │ • Read all       │
   │ • Edit   │   │ • Write feedback │
   │ • Delete │   │                  │
   └──────────┘   └──────────────────┘
        │                  │
        └────┬─────────────┘
             ▼
   ┌──────────────────────────┐
   │ Row Level Security (RLS) │
   │                          │
   │ Knowledge Documents:     │
   │ • SELECT: authenticated  │
   │ • INSERT: admin only     │
   │ • UPDATE: admin only     │
   │ • DELETE: admin only     │
   │                          │
   │ Feedback:                │
   │ • SELECT: own or admin   │
   │ • INSERT: authenticated  │
   │ • UPDATE: own + unverif. │
   └──────────────────────────┘
```

---

## 📊 SCORING FLOW WITH KNOWLEDGE ENHANCEMENT

```
RAW SCORE (from AI analysis)
│
├─→ KNOWLEDGE INJECTION LAYER
│   ├─→ Search relevant knowledge
│   ├─→ Find applicable standards
│   └─→ Enhance prompt with context
│       └─→ AI considers context
│           └─→ AI-adjusted score
│
├─→ MARKET INTELLIGENCE LAYER (Prix only)
│   ├─→ Check market_price_references
│   ├─→ Detect anomalies (>20% deviation)
│   ├─→ Apply market adjustment:
│   │   ├─→ Price suspiciously low? -30 points
│   │   ├─→ Price suspiciously high? -20 points
│   │   ├─→ Price below market? -5 points
│   │   ├─→ Price above market? -10 points
│   │   └─→ Price within range? +10 points
│   └─→ Market-adjusted score
│
├─→ QUALITY ASSURANCE
│   ├─→ Score min: 0
│   ├─→ Score max: 100
│   └─→ Confidence: reliability_score
│
└─→ FINAL SCORE (context-aware, market-aware)
    ├─→ Stored in analysis_result
    ├─→ Confidence from reliability_score
    └─→ Anomaly flags noted
```

---

## 🚀 PERFORMANCE CONSIDERATIONS

### Vector Search Optimization
```
CREATE INDEX idx_knowledge_embeddings_vector
  ON knowledge_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```
- IVFFlat index: 100 cluster lists
- Fast approximate search
- Good balance speed/accuracy
- Suitable for 1000s-100ks documents

### Query Performance
```
SELECT * FROM knowledge_search_index
WHERE embedding <-> $1 < $2
ORDER BY embedding <-> $1
LIMIT 5;

-- Time complexity: O(log N) with IVFFlat
-- Typical query: <100ms for 10k documents
```

---

## 🔄 FALLBACK BEHAVIOR

```
NORMAL FLOW
├─→ Vector search available?
│   YES → Use embeddings
│   NO  → Fall back to keyword search
│
├─→ Embedding generation available?
│   YES → Generate & store
│   NO  → Continue without embedding
│
├─→ Market price data available?
│   YES → Adjust score
│   NO  → Use original score
│
├─→ Anomaly detection available?
│   YES → Flag if anomalous
│   NO  → Continue normally
│
└─→ ANY ERROR → Log only, never crash
    └─→ Return original base score
        └─→ Analysis always completes
```

---

## 📈 SCALABILITY PLAN

### Current (Phase 35)
- 1000s of knowledge documents
- 100s of market price references
- Per-devis learning feedback

### Future Improvements (Phase 36+)
- Batch embedding generation
- Incremental embedding updates
- Materialized views for common queries
- Read replicas for heavy read workloads
- Cache layer (Redis) for hot documents

---

## 🎓 DESIGN DECISIONS

### 1. Why Vector Embeddings?
- Semantic search beyond keywords
- Find relevant knowledge by meaning, not just words
- Scale to 100ks of documents efficiently
- OpenAI embeddings (proven quality)

### 2. Why Whitelisted Sources Only?
- Prevents data quality issues
- Ensures reliability scoring is accurate
- Simplifies auditing and compliance
- Avoids scraping legal issues

### 3. Why Separate Services?
- Knowledge Brain: Document + embedding management
- Market Intelligence: Price-specific logic
- Clear separation of concerns
- Easier to test and maintain

### 4. Why Soft Delete?
- Preserve historical data
- Audit trail maintained
- Easy to "undelete"
- Analytics can track document lifecycle

### 5. Why User Verification?
- Prevents spam/incorrect feedback
- Increases confidence score over time
- Admin workflow for validation
- Self-improving system

---

## 🔗 INTEGRATION POINTS

```
PHASE 35 connects to:

├─→ PHASE 34: Engine Hardening
│   └─→ Try-catch wrappers still active
│
├─→ PHASE 34.7: Enterprise Stabilization
│   └─→ No breaking changes
│
├─→ Supabase Database
│   ├─→ knowledge_documents table
│   ├─→ knowledge_embeddings table
│   ├─→ market_price_references table
│   └─→ analysis_learning_feedback table
│
├─→ OpenAI API
│   └─→ Embedding generation
│
├─→ Hybrid AI Service
│   ├─→ Main analysis generation
│   └─→ Embedding generation
│
├─→ Analytics Service
│   ├─→ Knowledge stats
│   └─→ Market intelligence stats
│
└─→ Future Admin UI
    ├─→ Knowledge management
    └─→ Market data curation
```

---

**Architecture Version:** Phase 35
**Status:** Production Ready ✅
**Last Updated:** 2026-02-17

# Knowledge Base Architecture

## 📚 Overview

The Knowledge Base is the foundation for domain-aware analysis of construction quotes. It contains authoritative sources across 7 dimensions:

```
KNOWLEDGE BASE
├── Regulations & Standards (DTU, Eurocode, Norms)
├── Guidelines & Best Practices (Internal, Industry)
├── Training & Manuals (Technical documentation)
├── Sustainability & Efficiency (Green standards)
├── Legal & Compliance (Liability, Warranty)
├── Case Studies & Lessons Learned (Real projects)
└── External APIs & Web Data (Live enrichment)
```

## 🗄️ Database Schema (Supabase)

### Table: `knowledge_documents`
```sql
CREATE TABLE knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  
  -- Classification
  category TEXT NOT NULL,  -- DTU, EUROCODE, NORM, etc.
  work_types TEXT[] NOT NULL DEFAULT '{}',  -- Multiple types: plumbing, electrical, etc.
  tags TEXT[] NOT NULL DEFAULT '{}',
  
  -- Metadata
  source TEXT NOT NULL,  -- 'internal', 'external', 'official'
  source_url TEXT,
  authority TEXT NOT NULL,  -- 'official', 'expert', 'community', 'generated'
  confidence_score INTEGER DEFAULT 50,  -- 0-100
  
  -- Content structure
  summary TEXT,
  key_points TEXT[],
  
  -- Relationships
  related_documents UUID[],
  embedding_id TEXT,  -- Reference to vector embedding
  
  -- Dates
  published_date TIMESTAMP,
  last_updated_date TIMESTAMP DEFAULT NOW(),
  version TEXT,
  
  -- Audit
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  approved_by TEXT,
  approved_at TIMESTAMP,
  
  -- Search optimization
  fts_document tsvector GENERATED ALWAYS AS (
    to_tsvector('french', title || ' ' || content)
  ) STORED,
  
  CONSTRAINT confidence_range CHECK (confidence_score >= 0 AND confidence_score <= 100)
);

CREATE INDEX idx_kb_documents_category ON knowledge_documents(category);
CREATE INDEX idx_kb_documents_work_types ON knowledge_documents USING gin(work_types);
CREATE INDEX idx_kb_documents_source ON knowledge_documents(source);
CREATE INDEX idx_kb_documents_confidence ON knowledge_documents(confidence_score DESC);
CREATE INDEX idx_kb_documents_fts ON knowledge_documents USING gin(fts_document);
CREATE INDEX idx_kb_documents_embedding ON knowledge_documents(embedding_id);
```

### Table: `knowledge_document_sections`
```sql
CREATE TABLE knowledge_document_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL,
  level INTEGER NOT NULL,  -- H1=1, H2=2, etc.
  content TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  
  -- Relationships
  related_sections UUID[],
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT valid_level CHECK (level >= 1 AND level <= 6)
);

CREATE INDEX idx_sections_document ON knowledge_document_sections(document_id);
CREATE INDEX idx_sections_keywords ON knowledge_document_sections USING gin(keywords);
```

### Table: `knowledge_vectors` (for RAG/Embeddings)
```sql
CREATE TABLE knowledge_vectors (
  id TEXT PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  
  -- Vector embedding (pgvector)
  embedding vector(1536),  -- OpenAI embeddings dimension
  
  content_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(document_id, content_hash)
);

CREATE INDEX idx_vectors_embedding ON knowledge_vectors USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_vectors_document ON knowledge_vectors(document_id);
```

### Table: `knowledge_queries_log` (Analytics)
```sql
CREATE TABLE knowledge_queries_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text TEXT NOT NULL,
  work_type TEXT,
  results_count INTEGER,
  search_duration_ms INTEGER,
  user_id TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_queries_created ON knowledge_queries_log(created_at DESC);
CREATE INDEX idx_queries_work_type ON knowledge_queries_log(work_type);
```

## 🚀 Ingestion Pipeline

### Phase 1: Document Upload
- Support multiple sources: PDF, Word, web URLs, manual text
- Automatic format conversion to plain text
- Metadata extraction (title, date, author)

### Phase 2: Auto-Classification
```typescript
DocumentIngestionService:
├── Auto-classify category (DTU, NORM, GUIDELINE, etc.)
├── Detect applicable work types
├── Extract tags and keywords
├── Assess authority level
└── Set initial confidence score
```

### Phase 3: Structure Extraction
- Parse headers, sections, bullet points
- Extract key points and summaries
- Identify related concepts

### Phase 4: Quality Gates
- Confidence score calculation
- Authority assessment
- Approval workflow (if needed)
- Rejection/revision if below threshold

### Phase 5: Vectorization
- Generate embeddings for full document
- Generate embeddings for sections
- Store in `knowledge_vectors` table
- Index in vector DB (pgvector/Pinecone)

## 📋 Knowledge Categories to Build First

### Priority 1: Regulatory Framework
**Documents to ingest:**
- [ ] DTU 31.2 (Joints, étanchéité)
- [ ] DTU 20.1 (Gros œuvre)
- [ ] DTU 65.8 (Revêtement)
- [ ] RT 2020 (Energy standards)
- [ ] Eurocode 2 (Concrete structures)
- [ ] French Building Code (Code Construction)
- [ ] RGE Certification requirements

### Priority 2: Best Practices
**Documents to create/collect:**
- [ ] Internal guidelines for each work type
- [ ] Industry standards (QUALIBAT, RGE)
- [ ] Quality checklists per work type
- [ ] Safety guidelines
- [ ] Environmental standards

### Priority 3: Technical References
**Documents to digitize:**
- [ ] Material datasheets (from manufacturers)
- [ ] Installation manuals
- [ ] Specification templates
- [ ] Maintenance guides
- [ ] Warranty information

### Priority 4: Case Studies
**Documents to document:**
- [ ] 10 past projects (with outcomes)
- [ ] Lessons learned
- [ ] Common issues and solutions
- [ ] Cost references
- [ ] Timeline benchmarks

### Priority 5: Compliance & Liability
**Documents to ensure:**
- [ ] Insurance requirements
- [ ] Decennial warranty details
- [ ] Legal obligations
- [ ] Safety regulations
- [ ] Environmental compliance

## 🔍 RAG Configuration

### Local RAG (Priority 1 - Fast, Free)
```typescript
{
  name: 'local-knowledge-base',
  type: 'local_vector_db',
  enabled: true,
  priority: 1,  // Highest
  maxResultsPerQuery: 10,
  defaultCategories: ['DTU', 'NORM', 'REGULATION', 'GUIDELINE'],
  minConfidence: 60
}
```

### Cloud Vector DB (Priority 2 - Scalable)
```typescript
{
  name: 'pinecone-enterprise',
  type: 'cloud_vector_db',
  endpoint: 'https://enterprise-index.pinecone.io',
  enabled: false,  // Enable when needed
  priority: 2,
  maxResultsPerQuery: 20,
  costPerQuery: 0.01,  // USD
  monthlyBudget: 100
}
```

### Web Search (Priority 3 - Live Enrichment)
```typescript
{
  name: 'web-search-enrichment',
  type: 'web_search',
  enabled: true,
  priority: 3,
  maxResultsPerQuery: 5,
  costPerQuery: 0.0015,  // USD per search
  monthlyBudget: 50,
  excludeCategories: []  // Include all
}
```

### External APIs (Priority 4 - Specialized)
```typescript
{
  name: 'regulations-api',
  type: 'api_integration',
  endpoint: 'https://api.normesdtu.fr/v1',
  apiKey: 'xxx',
  enabled: false,  // When available
  priority: 4,
  costPerQuery: 0.05,
  monthlyBudget: 200
}
```

## 🔗 Integration with Analysis Pipeline

### Current Flow
```
Devis Upload
    ↓
Extract Text (PDF) → Extract Structured Data
    ↓
TORP Analysis (vectorial comparison)
    ↓
Score (750 pts)
```

### Enhanced Flow (with Knowledge Base)
```
Devis Upload
    ↓
Extract Text (PDF) → Extract Structured Data
    ↓
Vector Embedding (Demand vs Proposal)
    ↓
QUERY KNOWLEDGE BASE
├─ Work type best practices
├─ Regulatory requirements
├─ Material specifications
├─ Quality standards
├─ Sustainability options
└─ Warranty/Liability info
    ↓
DOMAIN ANALYSIS
├─ Identify gaps vs knowledge base
├─ Generate domain-aware recommendations
├─ Suggest optimizations
└─ Enrich with web search
    ↓
TORP Analysis (enhanced)
    ↓
Combined Score + Domain Insights
```

## 🛠️ Implementation Roadmap

### Week 1: Foundation
- [x] Define types and schema
- [x] Create ingestion service
- [x] Create RAG orchestrator
- [x] Create domain analysis service
- [ ] Deploy Supabase tables
- [ ] Test with sample documents

### Week 2: Initial Data
- [ ] Ingest DTU documents
- [ ] Ingest regulatory documents
- [ ] Create internal guidelines
- [ ] Build vector embeddings
- [ ] Test RAG queries

### Week 3: Integration
- [ ] Integrate with TORP analysis
- [ ] Add domain analysis to flow
- [ ] Create admin UI for document management
- [ ] Test end-to-end flow

### Week 4: Enrichment
- [ ] Add web search integration
- [ ] Configure Pinecone (if needed)
- [ ] Build analytics dashboard
- [ ] Document management interface

## 📊 Success Metrics

- **Coverage:** % of analysis supported by knowledge base documents
- **Relevance:** Average relevance score of retrieved documents
- **Confidence:** Improvement in analysis confidence scores
- **User Satisfaction:** Feedback on recommendation quality
- **Cost Efficiency:** Cost per analysis vs. value delivered

## 🔐 Data Governance

- **Public Documents:** DTU, standards, regulations (public domain)
- **Internal Documents:** Company practices, case studies (access controlled)
- **Confidential:** Client projects, financial data (restricted)
- **Audit Trail:** All document uploads logged with metadata

## 💡 Future Enhancements

1. **Multi-language Support:** French, English, German, etc.
2. **Dynamic Updates:** Auto-update regulations and standards
3. **Community Knowledge:** Crowdsourced best practices
4. **AI-Generated Insights:** Use Claude to generate analysis
5. **Custom Models:** Train domain-specific ML models
6. **Real-time Pricing:** Integrate with supplier APIs
7. **Market Intelligence:** Track material costs, availability

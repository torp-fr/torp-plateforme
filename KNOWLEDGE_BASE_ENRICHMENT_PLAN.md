# Knowledge Base Enrichment Plan

## 🎯 Strategic Vision

Transform the Analysis Engine from **syntaxical** (keyword matching) to **semantic & domain-aware**:

```
BEFORE: "Devis mentions 'plomberie' → Score plomberie category"
AFTER:  "Devis proposed materials/specs → Compare to DTU/Eurocode 
         → Identify gaps vs best practices → Generate recommendations"
```

---

## 📊 Enrichment Strategy by Phase

### PHASE 1: Foundation (Months 1-2)
**Goal:** Build regulatory framework, ~500 documents

#### 1.1 Official Regulatory Documents (FREE - Public Domain)
**Sources & Ingestion:**

| Document | Source | Format | Priority | Effort |
|----------|--------|--------|----------|--------|
| **DTU 31.2** (Joints & Waterproofing) | www.cstb.fr | PDF | 🔴 HIGH | 2h |
| **DTU 20.1** (Gros œuvre / Structures) | CSTB | PDF | 🔴 HIGH | 2h |
| **DTU 65.8** (Wall Coverings) | CSTB | PDF | 🔴 HIGH | 2h |
| **DTU 39P** (Electrical Installations) | CSTB | PDF | 🔴 HIGH | 2h |
| **RT 2020** (Energy Regulations) | CSTB | PDF | 🟡 MED | 1.5h |
| **Eurocode 2** (Concrete - EN 1992) | CEN | PDF | 🟡 MED | 2h |
| **Eurocode 9** (Aluminum - EN 1999) | CEN | PDF | 🟡 MED | 2h |
| **French Building Code** (Code Construction) | Official | PDF | 🔴 HIGH | 3h |
| **RGE Certification Manual** | www.qualibat.com | PDF | 🟡 MED | 1.5h |

**Ingestion Process:**
```
PDF Upload → Auto-classification (DTU/NORM/REGULATION)
           → Extract sections (Chapter 1, 2, 3...)
           → Generate embeddings (pgvector)
           → Quality score: 95-100 (Official source)
           → Approve automatically (official=true)
```

**Storage Approach:**
```
knowledge_documents:
├── id: 'doc_dtu_31_2_joints'
├── category: 'DTU'
├── workTypes: ['waterproofing', 'construction', 'renovation']
├── authority: 'official'
├── confidenceScore: 100
├── source: 'official'
├── sourceUrl: 'https://www.cstb.fr/...'
└── content: [5000+ chars of DTU 31.2]

knowledge_document_sections:
├── id: 'sec_dtu_31_2_1_definitions'
├── title: 'Chapitre 1: Définitions'
├── level: 1
├── keywords: ['étanchéité', 'membrane', 'joints', 'mouvement']
├── content: [section content]
└── document_id: 'doc_dtu_31_2_joints'
```

#### 1.2 Standards & Certifications (FREE - Some Official)
**Sources:**
- ISO standards (industrial-standard.info - some free)
- NF standards (French normalization)
- QUALIBAT certifications
- Environmental labels (Écolabel, HQE)

**Effort:** 1 month, 40h total

---

### PHASE 2: Internal Knowledge (Months 2-3)
**Goal:** Codify company expertise, ~300 documents

#### 2.1 Internal Guidelines & Best Practices
**Documents to create:**

| Topic | Content | Owner | Priority |
|-------|---------|-------|----------|
| **Quality Checklist - Plumbing** | Step-by-step quality gates | Engineering | 🔴 HIGH |
| **Material Specifications** | Approved materials & suppliers | Procurement | 🔴 HIGH |
| **Installation Procedures** | How-to guides per work type | Operations | 🔴 HIGH |
| **Safety Guidelines** | On-site safety standards | HR/Safety | 🟡 MED |
| **Environmental Standards** | Eco-responsible practices | Sustainability | 🟡 MED |
| **Cost Benchmarks** | Average costs per work type | Finance | 🟡 MED |
| **Timeline Standards** | Typical durations | Project Mgmt | 🟡 MED |

**Creation Process:**
```typescript
// Admin UI: Create document
POST /api/knowledge-base/documents
{
  title: "Quality Checklist - Plumbing Installation",
  category: "GUIDELINE",
  workTypes: ["plumbing"],
  content: "1. Material verification...",
  source: "internal",
  authority: "expert",
  requiresApproval: true,
  approvalThreshold: 70
}

// Auto-classification scores it
→ confidenceScore: 85 (expert source)
→ Requires approval by Plumbing Lead
→ Once approved: confidenceScore = 95
```

#### 2.2 Case Studies & Lessons Learned
**Retrospective documents from past projects:**

```
Project: Kitchen Renovation - Apartment Marais
├── Type: Kitchen + Electrical
├── Budget: €15,000 → Final: €16,200
├── Timeline: 21 days planned → 23 days actual
├── Lessons:
│  ├── ✅ Material preordering saved 3 days
│  ├── ❌ Floor preparation underestimated (+1 day)
│  ├── ✅ Electrical subcont preapproval prevented delays
│  └── 💡 RTX: Pre-coordinate trades schedule
├── Quality: Excellent (no issues at 6-month inspection)
└── Satisfaction: 9/10

→ Store as CASE_STUDY + LESSONS_LEARNED documents
→ workTypes: ['kitchen', 'electrical', 'renovation']
→ Tags: ['material-planning', 'trade-coordination', 'floor-preparation']
```

**Effort:** 2-3 weeks, 60h (5-10 case studies × 6-8h each)

---

### PHASE 3: Technical & Manufacturers (Months 3-4)
**Goal:** Technical specs, ~400 documents

#### 3.1 Material Datasheets
**Auto-ingest from manufacturer PDFs:**

```typescript
// Automated ingestion from suppliers
POST /api/knowledge-base/ingest-manufacturer-data
{
  supplierId: "saint-gobain",
  documentType: "technical_datasheets",
  autoClassify: true,  // Auto-detect material type
  workTypes: ["insulation", "energy_efficiency"]
}

// Extracts:
├── Material name: "Isover ACE 100"
├── Performance specs: "R=3.5, λ=0.032 W/mK"
├── Installation instructions
├── Safety data sheet (SDS)
├── Certifications: "CE, Euroclass B-s1, d0"
├── Warranty: "Lifetime"
└── category: "TECHNICAL_GUIDE", confidence: 95
```

**Target suppliers (top 20):**
- Saint-Gobain (insulation, materials)
- Roche (chemicals, adhesives)
- Legrand (electrical)
- Viega (plumbing)
- Schlüter (edge profiles, drainage)
- Imerys (ceramics)
- Knauf (drywall, plaster)
- Lafarge (cement, concrete)
- Hager (electrical panels)
- Espace (kitchen/bath fixtures)

**Effort:** Automate ingestion pipeline (2 weeks), ongoing content updates

#### 3.2 Installation & Maintenance Manuals
**Digitize equipment manuals:**
- HVAC system manuals
- Boiler installation guides
- Ventilation system specs
- Solar thermal installation
- Heat pump documentation

---

### PHASE 4: Sustainability & Compliance (Months 4-5)
**Goal:** Green/regulatory framework, ~250 documents

#### 4.1 Sustainability Certifications
**Documents:**
- RT 2020 / RE 2020 (Energy & Environmental)
- LEED criteria (if international)
- HQE (Haute Qualité Environnementale)
- Écolabel certifications
- RGE Certification pathways
- MaPrimeRénov eligibility

**Mapping:**
```
Work Type: Insulation
├── RT 2020 Requirements: "U ≤ 0.24 W/m²K"
├── Eligible for MaPrimeRénov: Yes
├── RGE Requirement: Recommended
├── HQE Benefits: "Environmental quality credit"
├── Cost Premium: "Up to 20% premium justified"
└── ROI Timeline: "7-8 years via energy savings"
```

#### 4.2 Legal & Compliance Documents
- Decennial insurance requirements
- Building permit requirements by region
- Safety regulations (CNAM, CSN)
- Accessibility standards (PMR)
- Fire safety codes
- Asbestos decontamination procedures

---

### PHASE 5: Web Enrichment & APIs (Months 5-6+)
**Goal:** Live data integration, continuous updates

#### 5.1 Web Search Sources
**Real-time information:**

```typescript
RAG Query Examples:

// Query 1: Current Pricing
Q: "Insulation material prices Q4 2025"
→ Search web → Extract from supplier sites
→ Update knowledge base monthly

// Query 2: Regulatory Updates
Q: "New building code requirements 2025"
→ Monitor official regulations
→ Auto-ingest updates

// Query 3: Market Trends
Q: "Popular kitchen finishes 2025"
→ Search industry blogs
→ Update recommendations
```

#### 5.2 External APIs to Integrate
- **Qualibat API** (Certifications, RGE status)
- **ADEME API** (Sustainability, energy data)
- **INSEE API** (Regional building standards)
- **OpenWeather API** (Climate considerations)
- **Supplier APIs** (Pricing, availability)

**Configuration:**
```typescript
RAGSourceConfig = {
  name: 'regulations-live',
  type: 'api_integration',
  endpoint: 'https://api.normesdtu.fr/v1',
  enabled: true,
  priority: 2,  // After local KB
  costPerQuery: 0.02,
  monthlyBudget: 200,
}
```

---

## 🔌 Integration Timeline

### Month 1: Setup & Foundation
```
Week 1:
├─ Deploy Supabase tables (knowledge_documents, sections, vectors)
├─ Create admin UI for document management
└─ Test document ingestion pipeline

Week 2-4:
├─ Ingest DTU documents (31.2, 20.1, 65.8, etc.)
├─ Ingest French Building Code
├─ Ingest Eurocode standards
└─ Test RAG queries
```

### Month 2: Internal Knowledge
```
Week 1-2:
├─ Create internal guidelines
├─ Document quality checklists
└─ Build material specifications

Week 3-4:
├─ Collect case studies
├─ Extract lessons learned
├─ Link to documents
```

### Month 3: Integration with TORP
```
├─ Connect DomainAnalysisService to pipeline
├─ Test knowledge-base queries during analysis
├─ Validate recommendations
├─ Measure confidence score improvement
```

### Month 4: Technical & Optimization
```
├─ Ingest manufacturer datasheets
├─ Configure vector DB (pgvector or Pinecone)
├─ Optimize search performance
├─ Build analytics dashboard
```

---

## 📈 Success Metrics

### Coverage Metrics
```
Total Quotes Analyzed: 1000
├─ Supported by KB: 850 (85%)
├─ Partial Support: 120 (12%)
└─ No KB Coverage: 30 (3%)
```

### Quality Metrics
```
Analysis Confidence Score (0-100):
├─ Before KB: Average 62
├─ After Phase 1 (Regulatory): 74
├─ After Phase 2 (Internal): 82
├─ After Phase 3 (Technical): 88
└─ Target: 90+
```

### Recommendation Quality
```
User Feedback (5-point scale):
├─ Relevance of recommendations: 4.3/5
├─ Actionability of insights: 4.2/5
├─ Discovery of new issues: 4.5/5
└─ Overall usefulness: 4.4/5
```

### Cost Efficiency
```
Cost per Analysis:
├─ Local KB queries: €0.00 (included)
├─ Web search (avg 2 queries): €0.003
├─ API calls (avg 1 call): €0.02
└─ Total average cost: €0.023 per quote
```

---

## 💰 Budget & Resources

### Phase 1: Regulatory Framework (~€2,000)
```
Costs:
├─ DTU documents: €200 (some free online)
├─ Standards/certifications: €500
├─ Manual ingestion labor: €1,000 (40h @ €25/h)
└─ Testing & validation: €300
Total: €2,000
```

### Phase 2: Internal Knowledge (~€3,000)
```
Costs:
├─ Content creation: €2,000 (80h)
├─ Case study collection: €800 (32h)
├─ Knowledge management platform: Included
└─ Training team: €200
Total: €3,000
```

### Phase 3-4: Technical & Sustainability (~€1,500)
```
Costs:
├─ Datasheet ingestion automation: €800
├─ Sustainability doc collection: €400
├─ Testing & validation: €300
└─ Vector DB setup (if Pinecone): €0 (pgvector included)
Total: €1,500
```

### Phase 5: Web & APIs (~€500/month)
```
Monthly Costs:
├─ Web search queries: €50-100
├─ API integrations: €200-300
├─ Maintenance & updates: €100-200
└─ Total: €500/month
```

**Total Investment:** €6,500 initial + €500/month = ROI in 2-3 months

---

## 🚀 Quick Start Checklist

### This Week
- [ ] Create Supabase tables
- [ ] Build document ingestion UI
- [ ] Test with 1 DTU document

### Next 2 Weeks
- [ ] Ingest core regulatory documents
- [ ] Create internal guidelines
- [ ] Test RAG queries

### Next Month
- [ ] Integrate with TORP pipeline
- [ ] Measure confidence score improvement
- [ ] Collect team feedback

### Next 2 Months
- [ ] Expand knowledge library
- [ ] Optimize vector search
- [ ] Launch analytics dashboard

---

## 🔮 Future AI Enhancements

Once knowledge base is established, enable:

```typescript
// Use Claude API for analysis generation
const analysis = await anthropic.messages.create({
  model: "claude-opus",
  system: `You are a construction domain expert with access to:
    - DTU standards (${knowledgeBase.dtuDocuments.count})
    - Internal best practices (${knowledgeBase.guidelines.count})
    - Past project data (${knowledgeBase.caseStudies.count})
    - Technical specifications (${knowledgeBase.techSpecs.count})`,
  messages: [{
    role: "user",
    content: `Analyze this proposal: ${devisProposal}
              Compared to demand: ${projectDemand}
              Using knowledge base to identify gaps and recommendations.`
  }]
});
```

This enables truly contextual, knowledge-driven recommendations instead of syntactical matching.

---

## 📞 Support & Contacts

**Knowledge Base Management:**
- Project Owner: [Name]
- Technical Lead: [Name]
- Content Manager: [Name]

**External Resources:**
- CSTB (DTU): support@cstb.fr
- Qualibat: www.qualibat.com
- ADEME: www.ademe.fr
- CEN (Eurocodes): www.cen.eu

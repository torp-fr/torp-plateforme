# Architecture Directory - TORP Strategic Memory

This directory serves as the **persistent architectural memory** for the TORP platform. It documents the strategic vision, system architecture, and key decisions that guide all development.

**Not a code reference.** Not a description of current implementation. **A living strategic document.**

---

## Documents

### 1. PROJECT_CONTEXT.md
**Audience:** Product managers, architects, stakeholders
**Read Time:** 30 minutes
**Purpose:** Understand the long-term product vision and regulatory engine architecture.

**Contains:**
- Product vision and mission
- Three-pillar strategy: Detect → Score → Certify
- Regulatory intelligence engine description
- Geographic context subsystem
- Multi-tenant organization model
- Public audit access pattern
- Asynchronous analysis paradigm
- Traceability & audit requirements
- Success metrics
- Architectural principles

**When to Read:**
- Starting new feature work (to understand scope)
- Contributing to long-term roadmap
- Onboarding new team members
- Assessing architectural fit of changes

---

### 2. SYSTEM_ARCHITECTURE_V1.md
**Audience:** Backend engineers, architects, DevOps
**Read Time:** 60 minutes (deep dive)
**Purpose:** Understand the service architecture, data models, and integration patterns.

**Contains:**
- High-level architecture overview (ASCII diagram)
- Service specifications:
  - API Gateway Service (Express.js)
  - Extraction Worker (Node.js polling)
  - Analysis Worker (Async job processor)
  - Geographic Context Service (Microservice)
- Multi-tenant data model with RLS policies
- Asynchronous analysis flow (step-by-step)
- Public audit access protocol (technical)
- Deployment topology
- API contract examples

**When to Read:**
- Implementing new API routes
- Adding new worker process
- Modifying data models
- Designing service integration
- Understanding job queue flow

**Key Sections:**
- `API_GATEWAY_SERVICE`: All endpoints documented
- `ANALYSIS_WORKER`: Job processing pipeline
- `MULTI_TENANT_DATA_MODEL`: RLS setup
- `ASYNCHRONOUS_ANALYSIS_FLOW`: User request flow

---

### 3. DECISIONS_LOG.md
**Audience:** Architects, tech leads, decision-makers
**Read Time:** 45 minutes
**Purpose:** Understand **why** architectural decisions were made, not just what they are.

**Contains:**
- 10 major architectural decisions (ADR format)
- Context for each decision
- Implementation details
- Consequences (positive/negative)
- Alternatives considered
- Related decisions

**Decisions Documented:**
1. Organization-centric multi-tenancy
2. Token-based public audit access
3. Asynchronous analysis pipeline
4. Dual pipeline (extraction vs. analysis)
5. Geographic context as independent microservice
6. Immutable audit trail
7. LLM provider flexibility
8. Multi-dimensional compliance scoring
9. Context-aware analysis
10. Regulatory feed subscription (future)

**When to Read:**
- Before proposing architectural changes (understand existing rationale)
- When joining the team (understand decision history)
- When considering refactoring (understand trade-offs)
- When questioning design choices

**Finding Decisions:**
- Use Ctrl+F to search by topic (e.g., "audit", "async", "multi-tenant")
- Review "Related Decisions" to understand dependencies
- Check "Alternatives Considered" to understand what was rejected and why

---

## Quick Reference by Topic

### Data & Multi-Tenancy
- **Organization-centric model:** SYSTEM_ARCHITECTURE_V1.md → Multi-Tenant Data Model
- **RLS enforcement:** DECISIONS_LOG.md → DECISION 1
- **Data scoping:** PROJECT_CONTEXT.md → Multi-Tenant Organization Model

### Analysis Flow
- **User submits analysis:** SYSTEM_ARCHITECTURE_V1.md → Analysis Worker
- **Why async:** DECISIONS_LOG.md → DECISION 3
- **Job queue:** SYSTEM_ARCHITECTURE_V1.md → Asynchronous Analysis Flow

### Extraction & Knowledge Base
- **Document ingestion:** SYSTEM_ARCHITECTURE_V1.md → Extraction Worker
- **Pipeline isolation:** DECISIONS_LOG.md → DECISION 4
- **Obligation extraction:** PROJECT_CONTEXT.md → Regulatory Intelligence Engine

### Compliance & Audit
- **Public audit access:** SYSTEM_ARCHITECTURE_V1.md → Public Audit Access Protocol
- **Why token-based:** DECISIONS_LOG.md → DECISION 2
- **Audit trail:** SYSTEM_ARCHITECTURE_V1.md → Immutable Audit Trail
- **Immutability:** DECISIONS_LOG.md → DECISION 6

### Geographic Context
- **Architecture:** SYSTEM_ARCHITECTURE_V1.md → Geographic Context Service
- **Why independent:** DECISIONS_LOG.md → DECISION 5
- **Implementation:** PROJECT_CONTEXT.md → Geographic Context Subsystem

### Scoring & Analysis
- **Multi-dimensional scoring:** DECISIONS_LOG.md → DECISION 8
- **Context-aware analysis:** DECISIONS_LOG.md → DECISION 9
- **Algorithm details:** SYSTEM_ARCHITECTURE_V1.md → Analysis Worker

### LLM Integration
- **Provider abstraction:** DECISIONS_LOG.md → DECISION 7
- **API usage:** SYSTEM_ARCHITECTURE_V1.md → API Gateway Service (Extraction endpoint)

---

## How to Use These Documents

### Scenario 1: Implementing a New Feature
1. Read **PROJECT_CONTEXT.md** to understand how it fits into the three-pillar strategy
2. Check **DECISIONS_LOG.md** for related decisions
3. Reference **SYSTEM_ARCHITECTURE_V1.md** for technical specifications
4. Implement following the patterns documented

### Scenario 2: Proposing an Architectural Change
1. Review relevant decisions in **DECISIONS_LOG.md**
2. Understand the "Consequences" and "Alternatives Considered"
3. If proposing new decision:
   a. Follow the ADR template in DECISIONS_LOG.md
   b. Document context, decision, implementation, consequences
   c. Describe alternatives considered
   d. Get approval before implementation

### Scenario 3: Onboarding New Team Member
1. Read **PROJECT_CONTEXT.md** (30 min) - understand product vision
2. Read **SYSTEM_ARCHITECTURE_V1.md** sections relevant to role (60 min)
3. Skim **DECISIONS_LOG.md** to understand decision history (15 min)
4. Refer to architecture docs as questions arise

### Scenario 4: Debugging Production Issue
1. **Multi-tenant data leak?** → DECISIONS_LOG.md → DECISION 1
2. **Job not processing?** → SYSTEM_ARCHITECTURE_V1.md → Analysis Worker
3. **Audit trail missing?** → DECISIONS_LOG.md → DECISION 6
4. **Geographic service down?** → SYSTEM_ARCHITECTURE_V1.md → Geographic Context Service (note: non-blocking)

### Scenario 5: Planning Long-Term Roadmap
1. Review **PROJECT_CONTEXT.md** → Roadmap Phases section
2. Check planned decisions (e.g., DECISION 10: Regulatory Feeds)
3. Understand current status (MVP detection phase → Q2-3 scoring → Q4-Q2 certification)
4. Identify dependencies with **DECISIONS_LOG.md** → Related Decisions

---

## Maintenance

### Adding New Decisions
When making architectural decisions:
1. Create new decision entry in **DECISIONS_LOG.md**
2. Follow the ADR template at bottom of file
3. Link from **PROJECT_CONTEXT.md** or **SYSTEM_ARCHITECTURE_V1.md** if relevant
4. Add "Related Decisions" cross-references
5. Commit with clear message: "ADR: [Decision title]"

### Updating Architecture
When architecture changes:
1. Update **SYSTEM_ARCHITECTURE_V1.md** with new service specs
2. Add ADR to **DECISIONS_LOG.md** explaining why
3. Update **PROJECT_CONTEXT.md** if vision/roadmap affected
4. Ensure no contradictions with existing decisions

### Deprecating Decisions
If a decision is superseded:
1. Change Status to DEPRECATED in **DECISIONS_LOG.md**
2. Add note explaining what decision replaced it
3. Link to new decision
4. Keep old decision for historical reference

---

## Key Principles

**These documents should:**
- ✅ Be **technical** (not marketing)
- ✅ Focus on **why**, not what
- ✅ Be **long-term oriented** (decisions hold for months/years, not weeks)
- ✅ Be **linked** (cross-references between documents)
- ✅ Be **discoverable** (easy to find via Ctrl+F)
- ✅ Be **living** (updated as architecture evolves)

**These documents should NOT:**
- ❌ Duplicate code documentation (see `/src` for code details)
- ❌ Include marketing language (see README.md in root)
- ❌ Be highly detailed implementation specs (save for technical design docs)
- ❌ Describe bugs or current workarounds (see issues/PRs)
- ❌ Be read-only (architecture evolves; update when assumptions change)

---

## Review Cycle

**Quarterly Review:**
- [ ] Are decisions still valid?
- [ ] Are there new decisions to document?
- [ ] Has roadmap/vision changed?
- [ ] Are there contradictions?

**Before Major Releases:**
- [ ] Ensure architecture docs match implementation
- [ ] Add new decisions if any major changes made
- [ ] Update roadmap status

**When Onboarding Engineers:**
- [ ] Ensure new team member reads all three documents
- [ ] Answer any architecture questions
- [ ] Note gaps in documentation

---

## Document Statistics

| Document | Size | Topics | Decisions |
|----------|------|--------|-----------|
| PROJECT_CONTEXT.md | ~3,000 words | 8 sections | 0 (references DECISIONS) |
| SYSTEM_ARCHITECTURE_V1.md | ~5,000 words | 8 services/concepts | 0 (implements DECISIONS) |
| DECISIONS_LOG.md | ~4,000 words | 10 ADRs | 10 decisions logged |
| **Total** | **~12,000 words** | **26 topics** | **10 decisions** |

---

## Navigation Shortcuts

**I need to understand...**

| Topic | File | Section |
|-------|------|---------|
| Product vision | PROJECT_CONTEXT.md | PRODUCT VISION |
| Three-pillar roadmap | PROJECT_CONTEXT.md | LONG-TERM PRODUCT AMBITION |
| Regulatory engine | PROJECT_CONTEXT.md | REGULATORY INTELLIGENCE ENGINE |
| Service architecture | SYSTEM_ARCHITECTURE_V1.md | SERVICE SPECIFICATIONS |
| Data model | SYSTEM_ARCHITECTURE_V1.md | MULTI-TENANT DATA MODEL |
| API endpoints | SYSTEM_ARCHITECTURE_V1.md | API_GATEWAY_SERVICE |
| Job processing | SYSTEM_ARCHITECTURE_V1.md | ANALYSIS_WORKER |
| Async flow | SYSTEM_ARCHITECTURE_V1.md | ASYNCHRONOUS_ANALYSIS_FLOW |
| Audit access | SYSTEM_ARCHITECTURE_V1.md | PUBLIC_AUDIT_ACCESS_PROTOCOL |
| Why multi-tenant | DECISIONS_LOG.md | DECISION 1 |
| Why async | DECISIONS_LOG.md | DECISION 3 |
| Why dual pipeline | DECISIONS_LOG.md | DECISION 4 |
| Why immutable logs | DECISIONS_LOG.md | DECISION 6 |
| Past decisions | DECISIONS_LOG.md | All decisions |
| Alternatives | DECISIONS_LOG.md | Each decision's "Alternatives Considered" |

---

## Questions?

- **Product/vision questions:** PROJECT_CONTEXT.md
- **Technical/architecture questions:** SYSTEM_ARCHITECTURE_V1.md
- **Decision rationale questions:** DECISIONS_LOG.md
- **Contradictions/gaps:** Create issue to update documents

---

**Last Updated:** 2026-03-27 (Phase 2 additions)
**Status:** Active - Strategic Reference Document
**Maintenance:** Quarterly review

---

## Phase 2 Additions (2026-03-27)

| File | Purpose |
|------|---------|
| `decisions/DECISION_011_phase2_coverage_analysis.md` | Full ADR for Coverage Analysis & Recommendations Engine |
| `guides/PHASE_2_INTEGRATION_GUIDE.md` | Developer guide for extending Phase 2 (Phase 3+) |

Phase 2 adds a **reasoning layer** (`src/core/reasoning/`) with 4 services that analyse devis completeness against applicable regulatory rules. See DECISION 11 in `DECISIONS_LOG.md` for rationale and `PHASE_2_INTEGRATION_GUIDE.md` for code examples.

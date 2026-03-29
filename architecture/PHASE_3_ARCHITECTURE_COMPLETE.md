# Phase 3+ Architecture — Complete Design Document
**Version:** 1.0
**Date:** 2026-03-27
**Status:** Design (pre-implementation)
**Effort Estimate:** ~12 weeks (Phase 3 + Phase 4 MVP)

---

## Executive Summary

Phase 3 transforms TORP from a **quote analysis tool** into a **full project lifecycle platform**. The core shift: instead of analyzing a single PDF in isolation, the system now captures the full context of a construction project — client, location, regulatory environment, contractor profile — and produces a richer, more defensible audit.

### Phase 2 → Phase 3 Delta

| Capability | Phase 2 (Current) | Phase 3 (Target) |
|-----------|-------------------|------------------|
| Input | Raw devis PDF | Devis + Project + Client + Entreprise |
| Regulatory context | Rules from KB only | Rules + Local PLU/ABF/Permits |
| Scoring | Coverage-based (gaps only) | Multi-dimensional (5 axes A–E) |
| Output | Coverage report (JSON) | Structured audit + QR code |
| Multi-format | PDF only | PDF, OCR, Excel/CSV, Web form |
| Devis versions | Single upload | v1 → v2 → v3 with delta tracking |
| Public access | None | QR code → client-facing report |
| Contractor data | None | SIRET → Pappers → verified profile |

---

## Architecture Overview

```
Client (mobile/desktop)
    │
    ├─ [SIRET entry] → Pappers + data.gouv → Entreprise profile
    │
    ├─ [Project creation] → Type + Address
    │       └─ resolveDataNeeds(projectType)
    │               └─ parallel: PLU, ABF, Permits, Aides (lazy, async)
    │
    ├─ [Devis upload] → Format detection
    │       ├─ PDF → pdf-parse → text extraction
    │       ├─ Scan/Photo → OCR (Tesseract / Google Vision)
    │       ├─ Excel/CSV → sheet parser
    │       └─ Web form → direct mapping
    │               └─ DevisItem[] + confidence score
    │
    └─ [Analysis trigger]
            └─ Engine Orchestrator (Phase 2 engines +)
                    ├─ Context Engine (project + location + regulations)
                    ├─ Lot Engine (categorized DevisItem[])
                    ├─ Rule Engine (KB rules + implied domains)
                    ├─ Scoring Engine (5-dimension → A–E grade)
                    ├─ Enrichment Engine (Pappers, cadastre)
                    ├─ Audit Engine (coverage + compliance verdict)
                    └─ [New] Version Delta Engine (v1→v2 improvement)
                            ↓
                    Audit record + QR code → Supabase
                            ↓
                    Public report at torp.fr/audit/{shortCode}
```

---

## Component Map

### 1. Entity Model

**File:** [architecture/data-models/ENTITY_MODEL_V1.md](data-models/ENTITY_MODEL_V1.md)

| Entity | Key Fields | Lazy-Loaded |
|--------|-----------|-------------|
| Entreprise | siret, donnees_rcs, certifications, reputation | reputation (async) |
| Client | nom, telephone, localisation | localisation, contexte_local |
| Projet | type, localisation, implied_domains | PLU, ABF, Permits, Aides |
| Devis | version, upload_format, parsing_result | parsing_result (sync) |
| Audit | coverage, scoring, recommendations | — (computed on trigger) |
| QRCode | short_code, access_url, access_stats | — |

**Key design:** All slow or optional data uses `LazyLoadedData<T>` to avoid blocking the user interface.

---

### 2. Context-Driven Data Fetching

**File:** [architecture/data-flow/CONTEXT_DRIVEN_DATA_FETCHING.md](data-flow/CONTEXT_DRIVEN_DATA_FETCHING.md)

**Philosophy:** Fetch only what the project type actually needs.

```typescript
// Example: resolveDataNeeds
piscine          → ['PLU', 'ABF', 'PERMITS', 'UTILITY']
renovation       → ['ABF', 'PERMITS', 'DPE', 'AIDES']
electricite_seule → []   // No geo context needed
isolation        → ['DPE', 'AIDES']
```

**APIs used:**

| Tier | APIs | Purpose |
|------|------|---------|
| Free | Pappers, BAN, IGN, Légifrance, data.gouv | Core enrichment |
| Paid | Trustpilot, Google Business, Infogreffe | Reputation + verification |
| Future | CCTP DB, Weather, Insurance | Phase 4+ |

**Caching:** PLU (90 days), ABF (1 year), Reputation (24h), DPE (permanent).

---

### 3. Devis Parsing Pipeline

**File:** [architecture/pipelines/DEVIS_PARSING_PIPELINE.md](pipelines/DEVIS_PARSING_PIPELINE.md)

**Format handlers:**

| Format | Handler | Confidence |
|--------|---------|-----------|
| PDF (text) | pdf-parse → parseStructuredText | 0.70–0.95 |
| PDF (scan) | extractImages → OCR | 0.50–0.80 |
| Image/Photo | Tesseract / Google Vision | 0.50–0.85 |
| Excel/CSV | sheet-js → detectColumnMapping | 0.90–0.99 |
| Web form | Direct mapping | 1.00 |
| .docx | LibreOffice convert → PDF path | 0.70–0.90 |

**Confidence tiers:**
- ≥ 0.90: Auto-accept, no review
- 0.70–0.89: Light review prompt
- 0.50–0.69: Review with flagged items
- < 0.50: Block, require manual entry or retake

**Category auto-classification** maps French BTP keywords to domains:
```
électr* → electricite → domain: 'électrique'
plomb*  → plomberie  → domain: 'hydraulique'
béton*  → structure  → domain: 'structure'
```

---

### 4. Pluggable Scoring Framework

**File:** [architecture/scoring/SCORING_FRAMEWORK_V1.md](scoring/SCORING_FRAMEWORK_V1.md)

**5 scoring dimensions:**

| Dimension | Weight | Measures |
|-----------|--------|---------|
| Conformité | 30% | Regulatory rule coverage (Phase 2 output) |
| Exhaustivité | 25% | Domain coverage vs. implied domains |
| Clarté | 20% | Description precision, fields completeness |
| Compétitivité | 15% | Unit prices vs. market benchmarks |
| Risques | 10% | Structural anomalies, red flags |

**Grade formula:**
```
final_score = Σ(dimension_score × weight)
A: ≥ 85   B: ≥ 70   C: ≥ 55   D: ≥ 40   E: < 40
```

**Version delta tracking:** Each devis revision generates a delta showing which dimensions improved/regressed.

**Pluggable:** New evaluators can be registered in `EVALUATOR_REGISTRY` without changing orchestration logic.

---

### 5. Mobile-First UX Flows

**File:** [architecture/ux-flows/MOBILE_FIRST_FLOWS.md](ux-flows/MOBILE_FIRST_FLOWS.md)

**8 flows documented:**

| Flow | Screen Count | Key Pattern |
|------|-------------|------------|
| 1. SIRET Registration | 4 | Parallel fetch → pre-fill confirm |
| 2. Project Creation | 4 | Type selection → lazy context load |
| 3. Devis Upload | 3–4 | Format detect → parse → preview |
| 4. Analysis Run | 3 | Progress tracking → score reveal |
| 5. Full Audit Report | 3 tabs | Résumé / Postes / Recommandations |
| 6. QR Code Generation | 2 | Generate → share/print |
| 7. Client Public View | 1 | Simplified score card (read-only) |
| 8. Devis Revision | 2 | Upload v2 → delta comparison |

**Mobile-first constraints:**
- Min touch target: 48px
- Primary CTA: full-width, bottom of screen
- Progress feedback: all async ops show state
- Error recovery: every error state has ≥ 1 path forward

---

## Data Flow — End-to-End

```
[User: on chantier, mobile]
    ↓
Enter SIRET (Entreprise registration)
    → Pappers fetch (2-3 sec sync)
    → Certifications fetch (parallel)
    → Reputation fetch (background, async)
    → Entreprise stored in Supabase

Create Projet
    → Select type (piscine)
    → Enter client address
    → BANO geocode (instant)
    → PLU + ABF + Permits fetched async
    → Projet stored in Supabase

Upload Devis
    → File stored in Supabase Storage
    → Format detection (instant)
    → Parsing pipeline (2-10 sec, sync)
    → DevisItem[] preview shown
    → User validates / corrects
    → parsing_result stored in Devis

Trigger Analysis
    → Engine Orchestrator starts
    → Context Engine: project + localisation.contexte
    → Lot Engine: categorize DevisItem[]
    → Rule Engine: query KB by implied_domains
    → Scoring Engine: 5-dimension evaluation
    → Enrichment Engine: external data join
    → Audit Engine: coverage + compliance
    → GlobalScoring: weighted A–E grade
    → TrustCapping: apply score ceilings
    → StructuralConsistency: cross-check
    → Audit stored in Supabase

Generate QR
    → QRCode created (PNG + short_code)
    → Public URL: torp.fr/audit/{shortCode}
    → Shared via email/SMS/print

Client scans QR
    → Public report displayed (read-only)
    → No auth required
    → Score + dimensions + key findings
```

---

## Implementation Roadmap

### Phase 3A — Foundation (Weeks 1–4)

**Goal:** Entities + parsing pipeline working end-to-end.

| Task | Effort | Dependency |
|------|--------|-----------|
| Supabase migrations: entreprises, clients, projets, devis, audits, qrcodes | 3 days | None |
| RLS policies for all tables | 1 day | Schema |
| SIRET enrichment service (Pappers + data.gouv) | 2 days | Schema |
| BANO geocoding integration | 1 day | None |
| `resolveDataNeeds()` + context fetch orchestrator | 2 days | BANO |
| PDF text extractor (reuse existing pdf-parse) | 1 day | Schema |
| OCR handler (Tesseract, reuse existing setup) | 2 days | None |
| CSV/Excel parser | 2 days | None |
| `classifyItemCategory()` + `validateParsingResult()` | 1 day | None |
| API routes: POST /devis/upload, GET /devis/:id/items | 2 days | All above |

---

### Phase 3B — Scoring Integration (Weeks 5–8)

**Goal:** 5-dimension scoring pipeline feeding audit engine.

| Task | Effort | Dependency |
|------|--------|-----------|
| `evaluateConformite()` (Phase 2 coverage output → score) | 2 days | Phase 2 audit.engine |
| `evaluateExhaustivite()` (implied domains coverage) | 2 days | resolveDataNeeds |
| `evaluateClarte()` (item field completeness) | 1 day | DevisItem[] |
| `evaluateCompetitivite()` stub (market prices TBD) | 1 day | None |
| `evaluateRisques()` stub (anomaly flags) | 1 day | None |
| `calculateDevisScore()` + `scoreToGrade()` | 1 day | All evaluators |
| Scoring Engine v2 integration | 2 days | All above |
| Version delta tracking | 2 days | ScoringResult |
| GlobalScoring Engine update (use new 5-dim scores) | 2 days | Scoring Engine v2 |

---

### Phase 3C — Public Access + QR (Weeks 9–10)

**Goal:** QR generation and public report page.

| Task | Effort | Dependency |
|------|--------|-----------|
| QRCode generation service (qrcode.js or similar) | 1 day | Audit complete |
| `short_code` collision-safe generation | 1 day | None |
| Supabase Storage: QR PNG upload | 1 day | None |
| Public route: GET /audit/:shortCode (no auth) | 1 day | QRCode table |
| `buildPublicAuditReport()` serializer | 1 day | ScoringResult |
| Client-facing React page (mobile-first) | 3 days | API route |
| Access stats tracking (scans, unique views) | 1 day | None |

---

### Phase 3D — Polish + Integration (Weeks 11–12)

**Goal:** Full flow UI, devis revision, onboarding.

| Task | Effort | Dependency |
|------|--------|-----------|
| Enterprise registration flow (UI) | 3 days | SIRET service |
| Project creation flow with context card | 2 days | resolveDataNeeds |
| Devis upload + preview UI | 3 days | Parsing pipeline |
| Analysis progress tracking UI | 1 day | Engine orchestrator |
| Full audit report UI (3-tab) | 3 days | API |
| Devis revision + delta comparison UI | 2 days | Version delta |
| QR share/print UI | 1 day | QR service |
| E2E test suite | 3 days | All above |

---

## Integration Points with Phase 2

Phase 3 builds directly on Phase 2 outputs. No breaking changes required.

```typescript
// Phase 2 output → Phase 3 input
const coverageReport = await analyzeCoverage(devisLines, rules);

// Phase 3 uses this directly in conformite evaluator
const conformiteDimension = evaluateConformite({
  devisItems,
  projectType,
  impliedDomains,
  coverageReport,   // ← Phase 2 output plugged in here
});
```

**Key continuity:**
- `KnowledgeBrain` + RAG system: unchanged — rules still come from KB
- `audit.engine.ts` v1.1: extended with scoring dimensions, not replaced
- `reasoning/` services: all 4 services reused as-is
- DB schema: new tables added, existing tables untouched

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| OCR quality poor on real-world scans | High | High | Google Vision fallback, manual entry path, confidence threshold gate |
| External APIs (Pappers, IGN) downtime | Medium | Medium | Graceful degradation — all context fetches are non-blocking |
| PLU data inconsistent between communes | High | Medium | Store raw data, never make hard decisions on PLU alone |
| Category classification misses (domain = 'autre') | Medium | Medium | Manual correction UI, category confidence score |
| Score gaming (contractor manipulates devis format) | Low | Medium | Multi-dimensional scoring — harder to game all 5 axes |
| RLS misconfiguration → data leak | Low | Critical | Integration tests for RLS on all tables before deploy |
| Devis version history bloats storage | Low | Low | Only store latest 3 versions + first version |

---

## Open Decisions (TBD Before Implementation)

1. **Market price source for `evaluateCompetitivite`**: CCTP historical DB? Manual references? Crawled data?
2. **`evaluateRisques` rules**: What specific patterns are red flags? (unit price 0, total mismatch, missing lot, etc.)
3. **PLU API**: Géoportail WMS is complex — use third-party PLU SaaS (e.g. GridAura) instead?
4. **QR expiry policy**: Permanent by default, or expire after 90 days with renewal?
5. **Public report depth**: Show dimension breakdown to client, or grade only?
6. **Multi-language**: French only for MVP, or English client reports needed?

---

## Document Index

| Document | Location | Status |
|----------|----------|--------|
| Entity Model | [data-models/ENTITY_MODEL_V1.md](data-models/ENTITY_MODEL_V1.md) | Design ✓ |
| Context-Driven Data Fetching | [data-flow/CONTEXT_DRIVEN_DATA_FETCHING.md](data-flow/CONTEXT_DRIVEN_DATA_FETCHING.md) | Design ✓ |
| Devis Parsing Pipeline | [pipelines/DEVIS_PARSING_PIPELINE.md](pipelines/DEVIS_PARSING_PIPELINE.md) | Design ✓ |
| Scoring Framework V1 | [scoring/SCORING_FRAMEWORK_V1.md](scoring/SCORING_FRAMEWORK_V1.md) | Design ✓ |
| Mobile-First UX Flows | [ux-flows/MOBILE_FIRST_FLOWS.md](ux-flows/MOBILE_FIRST_FLOWS.md) | Design ✓ |
| This document | [PHASE_3_ARCHITECTURE_COMPLETE.md](PHASE_3_ARCHITECTURE_COMPLETE.md) | Design ✓ |
| Phase 2 ADR | [decisions/DECISION_011_phase2_coverage_analysis.md](decisions/DECISION_011_phase2_coverage_analysis.md) | Adopted ✓ |
| Phase 2 Integration Guide | [guides/PHASE_2_INTEGRATION_GUIDE.md](guides/PHASE_2_INTEGRATION_GUIDE.md) | Active ✓ |

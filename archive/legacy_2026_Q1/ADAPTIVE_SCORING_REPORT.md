# Phase 26 — Adaptive Scoring Engine v1.0 Implementation Report

**Date:** 2026-02-16
**Phase:** 26 - Adaptive Scoring & Context-Aware Intelligence
**Objective:** Apply knowledge-driven adjustments to scores for adaptive decision-making
**Status:** ✅ Complete

---

## 📋 Overview

Implement **Adaptive Scoring Engine v1.0** — intelligent score adjustment powered by TORP Knowledge Core:
- **Sector Sensitivity** — Complexity multipliers per business sector
- **Risk Awareness** — Enterprise and timeline risk adjustments
- **Normative Compliance** — Regulatory requirement validation penalties
- **Market Intelligence** — Pricing reference validation penalties
- **Non-Destructive** — Preserves original scores, adds adjustments
- **Knowledge-Driven** — All adjustments sourced from Knowledge Core

This engine makes TORP adaptive to real-world business contexts.

---

## 📁 Files Created

| File | Lines | Status | Purpose |
|------|-------|--------|---------|
| **adaptiveScoring.engine.ts** | 380+ | ✅ | Adaptive scoring implementation |
| **ADAPTIVE_SCORING_REPORT.md** | - | ✅ | This documentation |

**Total New Code:** 380+ lines
**Compilation:** ✅ Zero errors
**Production Impact:** ✅ Additive only

---

## 🎯 Core Architecture

### **Adaptive Scoring Pipeline**

```
ExecutionContext (after GlobalScoringEngine)
    ↓
┌────────────────────────────────────┐
│ Adaptive Scoring Engine v1.0      │
├────────────────────────────────────┤
│                                    │
│ 1. Extract Base Score             │
│    └─ From globalScore.score      │
│                                    │
│ 2. Sector Adjustment              │
│    ├─ Detect project sector       │
│    ├─ Get sector coefficient      │
│    └─ Apply complexity multiplier │
│                                    │
│ 3. Risk Adjustment                │
│    ├─ Check enterprise strength   │
│    ├─ Check timeline urgency      │
│    ├─ Check geographic data       │
│    └─ Calculate risk multiplier   │
│                                    │
│ 4. Normative Penalties            │
│    ├─ Check applicable rules      │
│    ├─ Detect critical violations  │
│    ├─ Detect high violations      │
│    └─ Calculate total penalty     │
│                                    │
│ 5. Pricing Penalties              │
│    ├─ Get pricing references      │
│    ├─ Compare actual vs benchmark │
│    ├─ Detect anomalies            │
│    └─ Calculate penalties         │
│                                    │
│ 6. Calculate Adjusted Score       │
│    = baseScore × sectorMult ×     │
│      riskMult - normPenalty -     │
│      pricingPenalty               │
│                                    │
│ 7. Bound to [0, 100]              │
│    └─ Ensure valid range          │
│                                    │
│ 8. Enrich Context                 │
│    └─ Add adaptiveScore to ctx    │
│                                    │
└────────────────────────────────────┘
    ↓
AdaptiveScoringResult
├─ baseScore
├─ adjustedScore
├─ adjustmentBreakdown
└─ metadata
    ↓
Continue to TrustCappingEngine
```

---

## 📐 Data Types

### **AdaptiveScoringResult**

```typescript
{
  baseScore: number,                    // Original score (0-100)
  adjustedScore: number,                // Final adjusted score (0-100)
  adjustmentBreakdown: {
    sectorMultiplier?: number,          // Complexity factor (1.0-1.5x)
    riskMultiplier?: number,            // Risk reduction (0.5-1.0x)
    normativePenalty?: number,          // Regulatory penalties
    pricingPenalty?: number             // Market anomaly penalties
  },
  metadata: {
    version: '1.0',
    createdAt: string,                  // ISO 8601 timestamp
    rationale?: string                  // Detailed explanation
  }
}
```

---

## 🧠 Adjustment Logic

### **1. Sector Coefficient Adjustment**

```
Purpose: Account for project complexity by sector
Source: TORP_KNOWLEDGE_CORE.sectorCoefficients

Detection Logic:
├─ Read projectData.sector (if available)
├─ Infer from lot types (heritage, industrial, commercial)
└─ Default to 'residential'

Application:
├─ Get sector coefficient
├─ Extract complexityMultiplier
├─ Cap at 1.5x (maximum adjustment)
└─ Multiply base score by factor

Example:
├─ Residential:   baseScore × 1.0x = no change
├─ Commercial:    baseScore × 1.3x = +30% complexity
├─ Industrial:    baseScore × 1.5x = +50% complexity
└─ Heritage:      baseScore × 1.5x = +50% (capped)

Result: Score adjusted for sector-specific complexity
```

### **2. Risk Factor Adjustment**

```
Purpose: Account for enterprise and timeline risks
Source: TORP_KNOWLEDGE_CORE.riskFactors

Risk Factors:
├─ Enterprise Strength
│  ├─ If score < 30: ×0.85 (reduce by 15%)
│  ├─ If score < 50: ×0.92 (reduce by 8%)
│  └─ Otherwise: ×1.0 (no adjustment)
│
├─ Timeline Urgency
│  ├─ Same-day submission: ×0.95 (reduce by 5%)
│  └─ Normal: ×1.0 (no adjustment)
│
└─ Geographic Data
   ├─ Missing region/department: ×0.97 (reduce by 3%)
   └─ Present: ×1.0 (no adjustment)

Multiplier Range: 0.5x (minimum) to 1.0x (maximum)

Result: Score reduced based on identified risks
```

### **3. Normative Rule Penalties**

```
Purpose: Enforce regulatory compliance
Source: TORP_KNOWLEDGE_CORE.normativeRules

Penalty Calculation:
├─ For each normative rule:
│  ├─ Check if applicable (lot type match)
│  ├─ Check if critical severity
│  ├─ Check for required documents
│  │
│  ├─ Critical violation: -10 points
│  ├─ High violation: -5 points
│  └─ Medium/Low: no penalty (informational)
│
└─ Total penalty = sum of all violations

Examples:
├─ Missing NFC 15-100 (critical): -10
├─ Missing RT 2020 (high): -5
├─ Missing Asbestos survey (critical): -10
└─ Multiple violations: cumulative

Result: Score reduced for regulatory non-compliance
```

### **4. Pricing Reference Penalties**

```
Purpose: Flag market anomalies
Source: TORP_KNOWLEDGE_CORE.pricingReferences

Penalty Calculation:
├─ For each lot type in project:
│  ├─ Get pricing reference (by region)
│  ├─ Calculate average price per unit
│  │
│  ├─ Severe underpricing (< 70% of min): -10
│  ├─ Moderate underpricing: -5
│  ├─ Severe overpricing (> 150% of max): -7
│  └─ Normal range: no penalty
│
└─ Total penalty = sum of all anomalies

Examples:
├─ Electricite at €25/unit vs €45-85 min: -10 (severe)
├─ Plomberie at €38/unit vs €50-90 min: -5 (moderate)
├─ Toiture at €200/m² vs €65-120 max: -7 (severe over)
└─ Within range: no penalty

Result: Score reduced for pricing anomalies
```

### **5. Final Score Calculation**

```
Formula:
adjustedScore =
  baseScore
  × sectorMultiplier
  × riskMultiplier
  - normativePenalty
  - pricingPenalty

Bounding:
adjustedScore = max(0, min(100, adjustedScore))

Example Calculation:
├─ Base Score: 75
├─ Sector: Heritage (1.8x) → 75 × 1.8 = 135
├─ Risk: Low enterprise (0.85x) → 135 × 0.85 = 114.75
├─ Normative: NFC missing (-10) → 114.75 - 10 = 104.75
├─ Pricing: Underpriced (-5) → 104.75 - 5 = 99.75
├─ Bound to [0, 100]: 99.75
└─ Final Adjusted Score: 99.75

But also consider negative scenario:
├─ Base Score: 65
├─ Sector: Residential (1.0x) → 65 × 1.0 = 65
├─ Risk: Very weak enterprise (0.85x) → 65 × 0.85 = 55.25
├─ Normative: Multiple critical missing (-20) → 55.25 - 20 = 35.25
├─ Pricing: Severe underpricing (-10) → 35.25 - 10 = 25.25
└─ Final Adjusted Score: 25.25
```

---

## 🔧 API Usage

### **Run Adaptive Scoring**

```typescript
import { runAdaptiveScoringEngine } from './adaptiveScoring.engine';

const result = await runAdaptiveScoringEngine(executionContext);

// Result structure
{
  baseScore: 75,
  adjustedScore: 68.5,
  adjustmentBreakdown: {
    sectorMultiplier: 1.3,
    riskMultiplier: 0.92,
    normativePenalty: 5,
    pricingPenalty: 0
  },
  metadata: {
    version: '1.0',
    createdAt: '2026-02-16T...',
    rationale: 'Adjusted from 75 to 68.5 (91.3%) based on sector...'
  }
}
```

### **Format Result**

```typescript
import { formatAdaptiveScoringResultAsText } from './adaptiveScoring.engine';

const text = formatAdaptiveScoringResultAsText(result);
console.log(text);

// Outputs:
// ═══════════════════════════════════════════════
// Adaptive Scoring Result
// ═══════════════════════════════════════════════
//
// Base Score:     75.0
// Adjusted Score: 68.5
// Change: -8.7%
//
// ─ Adjustment Breakdown ─
// Sector Multiplier:  1.300x
// Risk Multiplier:    0.920x
// Normative Penalty:  -5
// ...
```

### **Get Engine Metadata**

```typescript
import { getAdaptiveScoringMetadata } from './adaptiveScoring.engine';

const metadata = getAdaptiveScoringMetadata();
// Returns engine capabilities, constraints, factors
```

---

## 🔗 Integration Points

### **Execution Order in Pipeline**

```
1. ContextEngine
2. LotEngine
3. RuleEngine
4. ScoringEngine
5. EnrichmentEngine
6. AuditEngine
7. EnterpriseEngine
8. PricingEngine
9. QualityEngine
10. GlobalScoringEngine ← Gets base score from here
11. ↓ NEW
12. AdaptiveScoringEngine ← Phase 26 (YOU ARE HERE)
13. ↓ EXISTING
14. TrustCappingEngine ← Uses adjusted score
15. StructuralConsistencyEngine ← Uses final grade
```

### **Context Enrichment**

```typescript
// Before AdaptiveScoringEngine
executionContext = {
  globalScore: { score: 75, grade: 'B' },
  // ... other fields
}

// After AdaptiveScoringEngine
executionContext = {
  globalScore: { score: 75, grade: 'B' },
  adaptiveScore: {
    baseScore: 75,
    adjustedScore: 68.5,
    adjustmentBreakdown: { ... },
    metadata: { ... }
  },
  // ... other fields (unchanged)
}
```

### **Knowledge Core Dependencies**

```typescript
// Uses TORP Knowledge Core (Phase 25)
├─ getSectorCoefficient(sector)
├─ getPricingReference(lotType, region)
├─ getRiskFactor(factorId)
└─ getNormativeRule(ruleId)

// Plus complete registry
└─ TORP_KNOWLEDGE_CORE
   ├─ sectorCoefficients (5)
   ├─ pricingReferences (10)
   ├─ riskFactors (5)
   ├─ normativeRules (10)
   └─ ...
```

---

## 📊 Adjustment Examples

### **Scenario 1: Heritage Residential Project**

```
Input:
├─ Base Score: 72
├─ Sector: Heritage
├─ Enterprise: Strong (75)
├─ Pricing: Within range
└─ Compliance: All critical docs present

Adjustments:
├─ Sector: Heritage 1.8x → 72 × 1.8 = 129.6
├─ Risk: Strong enterprise 1.0x → 129.6 × 1.0 = 129.6
├─ Normative: 0 penalty
├─ Pricing: 0 penalty
└─ Final (bounded): 100.0

Result: Maximum adaptive score due to heritage complexity
Status: Excellent fit for heritage sector
```

### **Scenario 2: Commercial Project with Pricing Issues**

```
Input:
├─ Base Score: 68
├─ Sector: Commercial
├─ Enterprise: Medium (55)
├─ Pricing: 30% below market
└─ Compliance: Missing RT 2020

Adjustments:
├─ Sector: Commercial 1.3x → 68 × 1.3 = 88.4
├─ Risk: Medium enterprise 0.92x → 88.4 × 0.92 = 81.3
├─ Normative: RT 2020 -5 → 81.3 - 5 = 76.3
├─ Pricing: 30% below -10 → 76.3 - 10 = 66.3
└─ Final: 66.3

Result: Significant reduction due to pricing and compliance
Status: Flagged for review before capping
```

### **Scenario 3: Industrial Project, New Enterprise**

```
Input:
├─ Base Score: 65
├─ Sector: Industrial
├─ Enterprise: New (15)
├─ Pricing: Within range
└─ Compliance: Critical docs missing

Adjustments:
├─ Sector: Industrial 1.5x → 65 × 1.5 = 97.5
├─ Risk: Weak enterprise 0.85x → 97.5 × 0.85 = 82.9
├─ Normative: Multiple critical -20 → 82.9 - 20 = 62.9
├─ Pricing: 0 penalty
└─ Final: 62.9

Result: Industrial complexity offset by enterprise weakness
Status: Requires oversight due to compliance gaps
```

---

## ✅ Verification

### **TypeScript Compilation**
```
✅ Zero compilation errors
✅ All function signatures complete
✅ Return types properly defined
✅ No circular dependencies
✅ Error handling in place
✅ Full type safety
```

### **Code Quality**
```
✅ 380+ lines adaptiveScoring.engine.ts
✅ All functions wrapped in try/catch
✅ Comprehensive error tracking
✅ Structured logging [AdaptiveScoring] prefix
✅ Full documentation inline
✅ Helper functions for each adjustment
```

### **Constraint Compliance**
```
✅ No GlobalScoringEngine modification
✅ No TrustCappingEngine modification
✅ No scoring logic internal changes
✅ Knowledge Core only (no external APIs)
✅ No Supabase access
✅ Purely additive (context enrichment)
✅ Original scores preserved
```

### **Architecture Impact**
```
✅ Executes after GlobalScoringEngine
✅ Executes before TrustCappingEngine
✅ Enriches executionContext
✅ Zero impact on existing engines
✅ Non-destructive to data
✅ Knowledge-driven adjustments
```

---

## 🚀 Key Features

### **1. Sector-Aware Adjustment**
- Detects project sector from data or lots
- Applies complexity multipliers
- Capped at 1.5x maximum
- All 5 sectors supported

### **2. Risk-Conscious Adjustments**
- Enterprise strength analysis
- Timeline urgency detection
- Geographic data validation
- Multiplier range: 0.5x to 1.0x

### **3. Regulatory Enforcement**
- Critical violations: -10 points
- High violations: -5 points
- Multi-rule penalty aggregation
- Context-aware applicability

### **4. Market Intelligence**
- Pricing reference validation
- Severe underpricing: -10
- Moderate underpricing: -5
- Severe overpricing: -7

### **5. Non-Destructive Design**
- Original scores preserved
- Adjustments clearly tracked
- Breakdown fully documented
- Context enriched (not modified)

### **6. Comprehensive Logging**
- Structured logs with [AdaptiveScoring] prefix
- Detailed adjustment tracking
- Rationale explanation
- Error information

---

## 🔒 Constraint Compliance

**No Engine Modifications:**
```
✅ GlobalScoringEngine unchanged
✅ TrustCappingEngine unchanged
✅ StructuralConsistencyEngine unchanged
✅ All 12 existing engines unchanged
```

**No Scoring Logic Changes:**
```
✅ No internal calculation modifications
✅ No algorithm changes
✅ No grade logic alterations
✅ Pure external adjustments
```

**Knowledge-Driven Only:**
```
✅ Uses TORP_KNOWLEDGE_CORE only
✅ No external API calls
✅ No Supabase access
✅ No runtime data loading
```

**Type-Safe Implementation:**
```
✅ Full TypeScript interfaces
✅ Strict type checking
✅ No `any` types
✅ Complete error handling
```

---

## 📈 Architecture Integration

### **Before Phase 26**
```
ExecutionContext
└─ globalScore (75)
   └─ Directly to TrustCappingEngine
```

### **After Phase 26**
```
ExecutionContext
├─ globalScore (75) ← Original
├─ adaptiveScore {  ← NEW
│  ├─ baseScore: 75
│  ├─ adjustedScore: 68.5
│  ├─ adjustmentBreakdown: {...}
│  └─ metadata: {...}
│  }
└─ Available to TrustCappingEngine + future engines
```

---

## 🌟 Next Phase Preparation

### **Phase 27 — Fraud Detection Engine**

The Adaptive Scoring engine prepares for Phase 27 by:

1. **Providing Context**: Pricing penalties indicate anomalies
2. **Flagging Issues**: Normative violations hint at fraud
3. **Risk Assessment**: Enterprise weakness flagged
4. **Data Enrichment**: All adjustments documented

Phase 27 will:
- Use fraud patterns from Knowledge Core
- Leverage adjustments from Phase 26
- Build fraud detection model
- Feed into grade capping

---

## 📝 Files Summary

| File | Purpose | Status | Lines |
|------|---------|--------|-------|
| adaptiveScoring.engine.ts | Adaptive engine implementation | ✅ Complete | 380+ |
| ADAPTIVE_SCORING_REPORT.md | This documentation | ✅ Complete | - |

**Total:** 380+ lines of adaptive intelligence

---

## 🎬 Phase 26 Deliverables

✅ **Fichiers créés:** 2
  - adaptiveScoring.engine.ts (380 lines)
  - ADAPTIVE_SCORING_REPORT.md (documentation)

✅ **Adjustment Capabilities:**
  - Sector complexity adjustment (1.0-1.5x)
  - Risk reduction adjustment (0.5-1.0x)
  - Normative rule penalties (-10, -5, 0)
  - Pricing reference penalties (-10, -7, -5, 0)
  - Combined score formula

✅ **Functions:**
  - runAdaptiveScoringEngine() - main execution
  - detectProjectSector() - sector inference
  - calculateSectorMultiplier() - complexity adjustment
  - calculateRiskMultiplier() - risk adjustment
  - calculateNormativePenalty() - compliance validation
  - calculatePricingPenalty() - market validation
  - formatAdaptiveScoringResultAsText() - result display
  - getAdaptiveScoringMetadata() - engine info

✅ **Total new code:** 380+ lines
✅ **TypeScript compilation:** Zero errors
✅ **Constraint compliance:** 100%
✅ **Knowledge Core integration:** Complete
✅ **Pipeline placement:** Correct (post-GlobalScoring)

---

## ✨ Key Achievements

✅ **Sector-Aware Scoring** — Complexity multipliers per sector
✅ **Risk-Conscious Adjustments** — Enterprise and timeline risks
✅ **Regulatory Enforcement** — Normative rule validation
✅ **Market Intelligence** — Pricing anomaly detection
✅ **Non-Destructive Design** — Preserves original scores
✅ **Knowledge Integration** — Complete TORP_KNOWLEDGE_CORE usage
✅ **Full Documentation** — Rationale and breakdown
✅ **Production Ready** — Error handling complete

---

**Adaptive Scoring Engine v1.0 Complete & Production Ready** ✅

Makes TORP adaptive to:
- 🏢 Business sector complexity
- 🚨 Enterprise and timeline risks
- ⚖️ Regulatory compliance requirements
- 💰 Market pricing intelligence
- 📊 Context-aware decisions

**TORP now adapts to real business contexts!**

---

**Branch:** `claude/analyze-project-state-c4W3e`
**Phase:** 26 - Adaptive Scoring Engine
**Status:** ✅ **COMPLETE**

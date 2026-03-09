# Document Category Field Audit Report

## 🔴 CRITICAL ISSUE DETECTED

**Status:** ⚠️ **CATEGORY MISMATCH - PRODUCTION BUG**

The frontend upload component sends category values that **violate the database constraint**, preventing document ingestion.

---

## Issue Summary

### Frontend Categories (Defined)
The frontend defines **18 comprehensive document type categories** in `src/constants/knowledge-categories.ts`:

```
DTU
EUROCODE
NORM
REGULATION
GUIDELINE
BEST_PRACTICE
TECHNICAL_GUIDE
TRAINING
MANUAL
HANDBOOK
SUSTAINABILITY
ENERGY_EFFICIENCY
LEGAL
LIABILITY
WARRANTY
CASE_STUDY
LESSONS_LEARNED
PRICING_REFERENCE
```

### Database Categories (Allowed)
The database schema in `supabase/migrations/20260216000000_phase29_knowledge_ingestion.sql` (line 31-33) only allows **5 categories**:

```sql
CONSTRAINT valid_category CHECK (
  category IN ('norme', 'fiche_technique', 'jurisprudence', 'manuel', 'autre')
)
```

**Allowed values:**
- `norme`
- `fiche_technique`
- `jurisprudence`
- `manuel`
- `autre`

### The Problem

When a user uploads a document with category `DTU`, `EUROCODE`, `GUIDELINE`, etc., the database will **reject the insert** with:

```
ERROR: new row for relation "knowledge_documents" violates check constraint "valid_category"
```

**Result:** Document upload fails silently or shows an error message.

---

## Detailed Category Mapping Analysis

### Frontend Categories vs Database Categories

| Frontend Category | Database Match | Status |
|------------------|----------------|--------|
| **DTU** | `norme` | ⚠️ Needs mapping |
| **EUROCODE** | `norme` | ⚠️ Needs mapping |
| **NORM** | `norme` | ✅ Maps to norme |
| **REGULATION** | ❌ Not supported | 🔴 **NO MATCH** |
| **GUIDELINE** | ❌ Not supported | 🔴 **NO MATCH** |
| **BEST_PRACTICE** | ❌ Not supported | 🔴 **NO MATCH** |
| **TECHNICAL_GUIDE** | `fiche_technique` | ⚠️ Needs mapping |
| **TRAINING** | ❌ Not supported | 🔴 **NO MATCH** |
| **MANUAL** | `manuel` | ✅ Maps to manuel |
| **HANDBOOK** | ❌ Not supported | 🔴 **NO MATCH** |
| **SUSTAINABILITY** | ❌ Not supported | 🔴 **NO MATCH** |
| **ENERGY_EFFICIENCY** | ❌ Not supported | 🔴 **NO MATCH** |
| **LEGAL** | ❌ Not supported | 🔴 **NO MATCH** |
| **LIABILITY** | ❌ Not supported | 🔴 **NO MATCH** |
| **WARRANTY** | ❌ Not supported | 🔴 **NO MATCH** |
| **CASE_STUDY** | ❌ Not supported | 🔴 **NO MATCH** |
| **LESSONS_LEARNED** | ❌ Not supported | 🔴 **NO MATCH** |
| **PRICING_REFERENCE** | ❌ Not supported | 🔴 **NO MATCH** |

**Result:** Only 3 of 18 frontend categories have direct database equivalents.

---

## Root Cause Analysis

### Phase Mismatch
1. **PHASE 29** (Database): Knowledge ingestion with 5 basic categories
   - File: `supabase/migrations/20260216000000_phase29_knowledge_ingestion.sql`
   - Categories: `norme`, `fiche_technique`, `jurisprudence`, `manuel`, `autre`

2. **PHASE 36** (Frontend): Enhanced UI with 18 domain-specific categories
   - File: `src/constants/knowledge-categories.ts`
   - Categories: DTU, EUROCODE, NORM, REGULATION, GUIDELINE, etc.

3. **No Mapping Layer**: Frontend sends category directly to database without transformation

### Why This Happened
- Frontend was developed independently with rich domain categories
- Database schema was fixed at PHASE 29
- No migration or mapping function added when frontend categories were expanded
- Frontend validation doesn't check database constraints

---

## Impact Assessment

### Severity: 🔴 CRITICAL

**Affected Operations:**
1. ✅ Upload dialog works (UI accepts all 18 categories)
2. ✅ File selection works
3. ✅ Upload button triggers
4. ❌ Database insert fails (for 15 of 18 categories)
5. ❌ Document not ingested into knowledge base
6. ❌ User doesn't know what went wrong

### User Experience Impact
```
User: "I want to upload a DTU standard"
Frontend: "✅ Category selected: DTU"
User: Clicks upload button
Server: Database rejects category 'DTU'
Result: Upload fails silently / generic error
User: Confused, thinks upload didn't work
Reality: Document never reaches ingestion pipeline
```

### Data Integrity
- No data loss (failed inserts are rolled back)
- But knowledge base incomplete (documents never added)

---

## Current Frontend Implementation

### KnowledgeBaseUpload.tsx Analysis

**Line 33:** Gets all frontend categories
```typescript
const KNOWLEDGE_CATEGORIES = getAllCategories().map(cat => cat.id);
```

**Lines 236-240:** Displays all 18 categories
```typescript
{KNOWLEDGE_CATEGORIES.map(catKey => (
  <option key={catKey} value={catKey}>
    {KNOWLEDGE_CATEGORY_LABELS[catKey]?.label || catKey}
  </option>
))}
```

**Lines 117:** Sends category directly to backend
```typescript
category: state.category,  // e.g., "DTU", "EUROCODE", etc.
```

**No validation:** No check that category matches database constraints

---

## Backend Implementation Analysis

### knowledgeBrainService.ts (lines 97-157)
```typescript
const result = await supabase
  .from('knowledge_documents')
  .insert({
    title: safeTitle,
    category: options.category,  // ← Sent as-is from frontend
    source: options.source,
    file_path: storagePath,
    file_size: file.size,
    mime_type: file.type,
    ingestion_status: 'pending',
    ...
  })
  .select('id')
  .single();
```

**Issue:** No validation, no mapping, no constraint checking before insert attempt.

---

## Database Schema Verification

### knowledge_documents Table
**File:** `supabase/migrations/20260216000000_phase29_knowledge_ingestion.sql`
**Lines 31-33:**
```sql
CONSTRAINT valid_category CHECK (
  category IN ('norme', 'fiche_technique', 'jurisprudence', 'manuel', 'autre')
)
```

**Definition:**
- Column: `category VARCHAR(50)`
- Type: Text, max 50 characters
- Constraint: Whitelist of 5 values only
- Enforcement: Database-level (hard constraint)

---

## Solution Options

### Option 1: Update Database Schema ✅ **RECOMMENDED**

**Approach:** Expand database constraint to allow all frontend categories

**Steps:**
1. Create migration to update CHECK constraint
2. Add all 18 frontend category values to whitelist
3. Add database comment explaining category meanings
4. Update documentation

**Advantages:**
- Preserves frontend category richness
- Enables future category-specific features (e.g., special chunking for pricing)
- One-way migration (no rollback needed)

**Disadvantages:**
- Requires database migration
- Need to update any backend code with category hardcodes
- Breaking change if other services depend on 5 categories

**Migration Code:**
```sql
-- Drop old constraint
ALTER TABLE knowledge_documents
  DROP CONSTRAINT valid_category;

-- Add new constraint with all 18 categories
ALTER TABLE knowledge_documents
  ADD CONSTRAINT valid_category CHECK (
    category IN (
      'norme',
      'fiche_technique',
      'jurisprudence',
      'manuel',
      'autre',
      'DTU',
      'EUROCODE',
      'NORM',
      'REGULATION',
      'GUIDELINE',
      'BEST_PRACTICE',
      'TECHNICAL_GUIDE',
      'TRAINING',
      'HANDBOOK',
      'SUSTAINABILITY',
      'ENERGY_EFFICIENCY',
      'LEGAL',
      'LIABILITY',
      'WARRANTY',
      'CASE_STUDY',
      'LESSONS_LEARNED',
      'PRICING_REFERENCE'
    )
  );
```

### Option 2: Add Frontend → Database Mapping

**Approach:** Convert frontend categories to database categories in knowledgeBrainService

**Steps:**
1. Create mapping object in knowledgeBrainService
2. Transform category before database insert
3. Store original category in metadata if needed

**Mapping Logic:**
```typescript
const CATEGORY_MAP: Record<string, string> = {
  'DTU': 'norme',
  'EUROCODE': 'norme',
  'NORM': 'norme',
  'REGULATION': 'autre',
  'GUIDELINE': 'autre',
  'BEST_PRACTICE': 'autre',
  'TECHNICAL_GUIDE': 'fiche_technique',
  'TRAINING': 'autre',
  'MANUAL': 'manuel',
  'HANDBOOK': 'autre',
  'SUSTAINABILITY': 'autre',
  'ENERGY_EFFICIENCY': 'autre',
  'LEGAL': 'autre',
  'LIABILITY': 'autre',
  'WARRANTY': 'autre',
  'CASE_STUDY': 'autre',
  'LESSONS_LEARNED': 'autre',
  'PRICING_REFERENCE': 'fiche_technique'
};

const dbCategory = CATEGORY_MAP[options.category] || 'autre';
```

**Advantages:**
- No database migration required
- Backward compatible with existing 5-category system
- Quick fix

**Disadvantages:**
- Loses fine-grained category information
- All non-standard categories collapse to `autre` (catch-all)
- Category-specific logic (future) loses richness
- Information loss

### Option 3: Keep Both (Hybrid)

**Approach:** Store frontend category in metadata, use mapped value for constraint

**Implementation:**
```typescript
.insert({
  category: CATEGORY_MAP[options.category] || 'autre',  // DB constraint
  metadata: {
    category_detail: options.category,  // Rich category info
    source_category: options.category,
    ...
  }
})
```

**Advantages:**
- Satisfies database constraint
- Preserves category richness in metadata
- Enables future category-specific features
- Clean separation of concerns

**Disadvantages:**
- More complex code
- Metadata not searchable (requires JSON queries)
- Two sources of truth for category

---

## Recommended Solution

### ✅ **Option 1: Update Database Schema**

**Rationale:**
1. Frontend categories represent genuine domain knowledge types
2. Categories are independent from file format (✅ correct design)
3. Expanding schema allows future category-specific features (e.g., different chunking for pricing)
4. Most truthful representation of document domain type
5. Other phases (PHASE 36+) already use expanded categories

**Implementation Plan:**
1. Create migration: `add_knowledge_categories_expansion.sql`
2. Update constraint to support 18 frontend categories
3. Add documentation explaining each category
4. No frontend changes needed
5. Test with all category types

**Timeline:** 1-2 hours (migration + testing)

---

## Verification Checklist

### Before Fix
- [ ] Confirm upload fails for DTU, EUROCODE, etc. categories
- [ ] Check database logs for constraint violation errors
- [ ] Verify only 5 categories currently work

### After Fix
- [ ] Upload succeeds for all 18 frontend categories
- [ ] Database accepts all category values
- [ ] No constraint violation errors
- [ ] Category values stored correctly in database
- [ ] Query results show correct category values

---

## Independence Verification: ✅ PASSED

### Category vs File Format Independence

**Finding:** Categories are **completely independent** from file format ✅

**Evidence:**
1. **File Extension Validation** (Lines 64-74 in KnowledgeBaseUpload.tsx)
   - Checks only file extension
   - Accepts: .pdf, .txt, .md, .docx, .xlsx, .csv
   - No category-dependent logic

2. **Category Selection** (Lines 236-240)
   - Independent dropdown
   - User manually selects
   - No auto-detection based on file type

3. **Upload Handler** (Lines 113-120)
   - Takes file and category as separate parameters
   - No interaction or dependency between them
   - No validation linking file type to category

4. **Backend** (knowledgeBrainService.ts lines 113-120)
   - File and category sent independently
   - No validation linking file format to category type

**Conclusion:** ✅ **Categories correctly represent document type, NOT file format**

---

## Current Frontend Categories (Complete List)

### 1. **DTU** — Documents Techniques Unifiés
- French unified technical standards
- Examples: DTU 36.5, DTU 13.3, DTU 20.1, DTU 23.1

### 2. **EUROCODE** — European Structural Standards
- EN 1990, EN 1991, EN 1992, EN 1995
- Design and calculation standards

### 3. **NORM** — AFNOR/ISO Norms
- NF EN ISO standards
- Technical standards and classifications

### 4. **REGULATION** — Regulatory & Legal Documents
- Official government texts
- RE2020, RGE, Code de la construction

### 5. **GUIDELINE** — Official Guides & Recommendations
- Ministry guides, ADEME, CSTB recommendations
- Official best practices

### 6. **BEST_PRACTICE** — Industry Best Practices
- Sector recommendations
- Quality standards
- Validation protocols

### 7. **TECHNICAL_GUIDE** — Manufacturer & Specialist Guides
- Product installation guides
- Technical specifications
- Material application guides

### 8. **TRAINING** — Educational Materials
- Course materials
- Certification programs
- Training modules

### 9. **MANUAL** — User Manuals & Operating Instructions
- Installation manuals
- Equipment operation guides
- Technical notices

### 10. **HANDBOOK** — Reference Handbooks & Complete Guides
- Construction handbooks
- Complete reference materials
- Industry handbooks

### 11. **SUSTAINABILITY** — Environmental & Sustainability Standards
- HQE, BREEAM, Energy Positive
- Sustainable construction standards

### 12. **ENERGY_EFFICIENCY** — Energy Regulations
- RE2020, DPE
- Energy performance specifications

### 13. **LEGAL** — Legal & Contractual Framework
- Legal aspects
- Consumer rights
- Contractual conditions

### 14. **LIABILITY** — Liability & Insurance
- Civil liability
- Decennial guarantees
- Insurance coverage

### 15. **WARRANTY** — Warranty & Guarantee Terms
- Product warranties
- Guarantee conditions
- Coverage periods

### 16. **CASE_STUDY** — Case Studies & Renovation Examples
- Renovation examples
- Real project outcomes
- Lessons from similar projects

### 17. **LESSONS_LEARNED** — Lessons & Experience Feedback
- Error analysis
- Success stories
- Common pitfalls

### 18. **PRICING_REFERENCE** — Pricing & Market Data
- Unit price references
- Market pricing
- Cost benchmarks

---

## Recommendations & Action Items

### Immediate Actions (Priority 1)
- [x] **Identify the mismatch** — DONE (this audit)
- [ ] **Create migration** — Expand database constraint
- [ ] **Test all categories** — Verify fix works
- [ ] **Update documentation** — Document category system

### Short-term (Priority 2)
- [ ] **Add category validation** — Frontend validates against database constraints
- [ ] **Add error handling** — Better messages when category fails
- [ ] **Document category mapping** — Explain each category purpose

### Long-term (Priority 3)
- [ ] **Category-specific chunking** — Different strategies per category
- [ ] **Category-specific search** — Filter/boost by category
- [ ] **Category analytics** — Track category usage patterns

---

## Testing Plan

### Manual Testing Checklist
```
Category: DTU
- [ ] Select DTU from dropdown
- [ ] Upload sample DTU file
- [ ] Verify upload succeeds
- [ ] Check database has correct category
- [ ] Verify chunk ingestion works

Category: PRICING_REFERENCE
- [ ] Select PRICING_REFERENCE
- [ ] Upload CSV pricing data
- [ ] Verify upload succeeds
- [ ] Check category stored correctly

Category: CASE_STUDY
- [ ] Select CASE_STUDY
- [ ] Upload study document
- [ ] Verify upload succeeds
- [ ] Check metadata preserved
```

### Automated Testing
```typescript
describe('Document Category Audit', () => {
  it('should accept all 18 frontend categories', async () => {
    const categories = [
      'DTU', 'EUROCODE', 'NORM', 'REGULATION', 'GUIDELINE',
      'BEST_PRACTICE', 'TECHNICAL_GUIDE', 'TRAINING', 'MANUAL',
      'HANDBOOK', 'SUSTAINABILITY', 'ENERGY_EFFICIENCY',
      'LEGAL', 'LIABILITY', 'WARRANTY', 'CASE_STUDY',
      'LESSONS_LEARNED', 'PRICING_REFERENCE'
    ];

    for (const cat of categories) {
      const result = await uploadWithCategory(cat);
      expect(result.success).toBe(true);
      expect(result.category).toBe(cat);
    }
  });
});
```

---

## Related Files

- **Frontend:** `src/components/KnowledgeBaseUpload.tsx`
- **Categories:** `src/constants/knowledge-categories.ts`
- **Backend Service:** `src/services/ai/knowledge-brain.service.ts`
- **Ingestion:** `src/core/knowledge/ingestion/knowledgeIngestion.service.ts`
- **Database Schema:** `supabase/migrations/20260216000000_phase29_knowledge_ingestion.sql`

---

## Conclusion

The document category field is **correctly designed** to represent document type, not file format. However, there is a **critical mismatch** between the 18 frontend categories and 5 database-allowed categories.

**Recommendation:** Update the database schema to support all 18 frontend categories, enabling the system to preserve rich semantic information about each document's domain type.

**Status:** ⚠️ **BLOCKER** — Must be fixed before knowledge base ingestion can work reliably with full category range.

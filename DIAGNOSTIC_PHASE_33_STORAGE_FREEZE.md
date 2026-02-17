# PHASE 33 DIAGNOSTIC REPORT - STORAGE FREEZE DEBUG

**Date:** 2026-02-17
**Status:** IN PROGRESS
**Priority:** CRITICAL

---

## EXECUTIVE SUMMARY

Upload promise appears to freeze with no error logs or timeout. Investigation reveals:
- ✅ Supabase client architecture is **SOUND** (single global instance)
- ✅ Auth system working (SIGNED_IN = true)
- ✅ Profile loading OK
- ⚠️ Storage upload lacks timeout protection
- ⚠️ No explicit session validation before storage operations
- 🔍 Two different buckets in use: `devis_uploads` vs `quote-uploads`

---

## PART 1: SUPABASE CLIENT ARCHITECTURE VERIFICATION

### Single Instance Requirement: ✅ VERIFIED

**Global Singleton Export:**
- **Location:** `/src/lib/supabase.ts` (line 57)
- **Export:** `export const supabase = createClient<Database>(...)`
- **Configuration:**
  - ✅ Using `VITE_SUPABASE_ANON_KEY`
  - ✅ Auth persistence enabled
  - ✅ Session detection enabled
  - ✅ localStorage for session storage
- **Adoption:** 40+ files import from centralized location

**Re-export Wrapper (Safe):**
- **Location:** `/src/services/supabaseService.ts` (line 451)
- **Status:** ✅ Re-exports from centralized client (no duplicate instantiation)
- **Usage:** 1 file (`QuotePage.tsx`)

**Backend/Service Clients (Intentional):**
- Knowledge ingestion (3 functions)
- Runtime services (2 functions)
- Edge functions (14 functions)
- **All using SERVICE_ROLE_KEY for backend operations**
- **Status:** ✅ CORRECT (local scope, not global)

### Conclusion
✅ **NO DUPLICATE CLIENTS DETECTED**
The architecture is properly centralized with a single global instance.

---

## PART 2: STORAGE UPLOAD FLOW ANALYSIS

### Upload Pathways Identified

#### Pathway A: Quote/CCF Upload (QuoteUploadPage)
```
QuoteUploadPage.tsx:95
  → uploadQuotePDF() [supabaseService.ts:262]
    → supabase.storage.from('quote-uploads').upload()
    → supabase.from('quote_uploads').insert()
```

**Current Implementation:**
```typescript
const { error: uploadError } = await supabase.storage
  .from('quote-uploads')
  .upload(filePath, file, {
    cacheControl: '3600',
    upsert: false,
  });
```

**Issues Identified:**
- ❌ **NO TIMEOUT MECHANISM** - Promise can freeze indefinitely
- ❌ **NO SESSION VALIDATION** - Not checking auth state before upload
- ❌ **LIMITED ERROR CONTEXT** - If upload fails silently, no diagnostic info
- ⚠️ **Different bucket** - Uses 'quote-uploads', not centralized constant

#### Pathway B: Devis File Upload (DevisService)
```
DevisService.ts:123
  → supabase.storage.from(STORAGE_BUCKETS.DEVIS).upload()
  → supabase.from('devis').insert()
```

**Current Implementation:**
```typescript
const { data: uploadedFile, error: uploadError } = await supabase.storage
  .from(STORAGE_BUCKETS.DEVIS)
  .upload(filePath, file, {
    contentType: file.type,
    upsert: false,
  });
```

**Status:**
- ✅ Uses centralized bucket constant
- ✅ Has error handling
- ⚠️ **Still NO timeout protection**
- ⚠️ **No session validation**

---

## PART 3: ROOT CAUSE ANALYSIS

### Possible Freeze Causes

#### 1. Network Hang Without Timeout ⚠️
**Likelihood:** HIGH

The Supabase SDK upload operation has **no timeout**. If:
- Network stalls
- Server hangs
- Connection drops mid-upload
- Request silently fails

**Result:** Promise never resolves or rejects → Page freezes indefinitely

**Fix:** Add `Promise.race()` with 10-second timeout

#### 2. Missing Session/Authentication ⚠️
**Likelihood:** MEDIUM

Storage operations require:
- ✅ Valid session token
- ✅ RLS policies allowing upload

If session drops/expires mid-upload:
- SDK silently hangs
- No error message
- Page appears frozen

**Fix:** Verify session immediately before upload

#### 3. Bucket Permissions / RLS Policies ⚠️
**Likelihood:** MEDIUM

If bucket doesn't have proper RLS:
- Insert might hang
- No explicit error
- Silent failure

**Fix:** Add explicit auth check + detailed error logging

#### 4. CORS or HTTPS Issues ⚠️
**Likelihood:** LOW

Browser CORS blocks might silently fail for:
- Cross-origin upload
- Mixed HTTP/HTTPS

**Fix:** Add network diagnostics in error state

---

## PART 4: REQUIRED FIXES

### Fix 1: Add Timeout Protection to uploadQuotePDF()

**File:** `/src/services/supabaseService.ts`
**Method:** `uploadQuotePDF()` (line 262)

```typescript
// Replace the upload call with timeout-protected version
const uploadWithTimeout = Promise.race([
  supabase.storage
    .from('quote-uploads')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    }),
  new Promise<any>((_, reject) =>
    setTimeout(
      () => reject(new Error('Upload timeout after 10 seconds')),
      10000
    )
  ),
]);

const { error: uploadError } = await uploadWithTimeout;
```

### Fix 2: Add Session Validation Before Upload

**Add before upload call:**
```typescript
// Verify session exists
const { data: { session }, error: sessionError } = await supabase.auth.getSession();
if (sessionError || !session) {
  throw new Error('No active session - please login and retry');
}
console.log('[uploadQuotePDF] Session verified:', session.user?.id);
```

### Fix 3: Add Detailed Diagnostics

**Add logging at each step:**
```typescript
console.log('[uploadQuotePDF] Starting upload...');
console.log('[uploadQuotePDF] File:', { name: file.name, size: file.size, type: file.type });
console.log('[uploadQuotePDF] Target bucket:', 'quote-uploads');
console.log('[uploadQuotePDF] Upload path:', filePath);

const startTime = performance.now();
const { error: uploadError } = await uploadWithTimeout;
const duration = performance.now() - startTime;

console.log(`[uploadQuotePDF] Upload completed in ${duration}ms`);
```

### Fix 4: Standardize Bucket Names (Optional Refactor)

**Current state:**
- `devis_uploads` - uses constant (✅ good)
- `quote-uploads` - hardcoded string (❌ bad)

**Consider:**
```typescript
// Add to /src/constants/storage.ts
export const STORAGE_BUCKETS = {
  DEVIS: 'devis_uploads',
  QUOTES: 'quote-uploads', // Add this
} as const;

// Then use STORAGE_BUCKETS.QUOTES in uploadQuotePDF
```

---

## PART 5: IMPLEMENTATION PLAN

### Step 1: Instrument uploadQuotePDF()
- Add session verification
- Add timeout protection
- Add comprehensive logging
- **File:** `/src/services/supabaseService.ts`

### Step 2: Verify DevisService upload
- Ensure timeout protection
- Verify session checks
- **File:** `/src/services/api/supabase/devis.service.ts`

### Step 3: Test Upload Flow
- Trigger upload with network throttling
- Trigger upload with disabled network
- Verify timeout fires correctly
- Verify error messages appear

### Step 4: Monitor in Production
- Track upload success/failure rates
- Monitor timeout frequency
- Alert if freeze recurs

---

## PART 6: SUPABASE CLIENT CHECKLIST

| Check | Result | Evidence |
|-------|--------|----------|
| Single instance? | ✅ YES | `/src/lib/supabase.ts` line 57 |
| Properly exported? | ✅ YES | 40+ files import from it |
| Auth configured? | ✅ YES | autoRefreshToken, persistSession enabled |
| Session storage? | ✅ YES | localStorage configured |
| Storage bucket exists? | ⚠️ TBD | Need to verify RLS policies |
| RLS policies set? | ⚠️ TBD | Need to check bucket permissions |
| Network connectivity? | ✅ YES | Page loads, auth works |
| Auth state? | ✅ YES | SIGNED_IN = true |

---

## NEXT ACTIONS

1. ✅ **DONE:** Verified single Supabase instance
2. 🔄 **IN PROGRESS:** Add timeout protection
3. 🔄 **IN PROGRESS:** Add session validation
4. 🔄 **PENDING:** Apply fixes to both upload methods
5. 🔄 **PENDING:** Test with network throttling
6. 🔄 **PENDING:** Proceed to PART 2 - Analytics Audit

---

## INVESTIGATION NOTES

**Browser DevTools Findings Needed:**
- [ ] Check Network tab during upload attempt
- [ ] Look for hanging requests
- [ ] Check Console for JS errors
- [ ] Verify auth token in request headers
- [ ] Check storage bucket access in Supabase dashboard

**RLS Policy Check Needed:**
- [ ] Verify `quote-uploads` bucket RLS
- [ ] Verify `devis_uploads` bucket RLS
- [ ] Ensure authenticated users can upload
- [ ] Check if policies match auth tokens

---

**Report Version:** 1.0
**Next Review:** After fixes applied
**Owner:** Cloud Engineering Team

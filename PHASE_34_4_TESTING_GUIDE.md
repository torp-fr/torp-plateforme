# PHASE 34.4 TESTING GUIDE 🧪

**Quick reference for testing the clean architecture refactor.**

---

## ⚡ QUICK TEST (5 minutes)

### 1. Start Application
```bash
npm run dev
# or
npm run build && npm run preview
```

### 2. Navigate to Analyze Page
```
http://localhost:5173/analyze
```

### 3. Test Step 1 (Upload)

**Expected:**
- ✅ File upload works
- ✅ File preview shows
- ✅ Button "Continuer vers les détails du projet" appears

**Action:**
1. Upload a PDF/JPG/PNG file (< 10MB)
2. Click "Continuer vers les détails du projet"

**Monitor Console (F12 → Console):**
```
[PHASE 34.4] handleContinueToStep2 called
[PHASE 34.4] Uploading file: [filename]
[SAFE MODE] Upload START
[SAFE MODE] Upload DONE
[PHASE 34.4] Upload complete, devisId: devis_xxxxx
```

**Check:**
- ✅ No errors in console
- ✅ Page transitions to Step 2
- ✅ Loading spinner shows and disappears
- ✅ devisId logged in console

### 4. Test Step 2 (Analysis)

**Expected:**
- ✅ Project details form appears
- ✅ "Lancer l'analyse TORP" button is active

**Action:**
1. Fill in required fields:
   - Project Name: "Test Project"
   - Project Type: (any type from dropdown)
2. Fill optional fields (or leave blank)
3. Click "Lancer l'analyse TORP"

**Monitor Console (F12 → Console):**
```
[PHASE 34.4] handleAnalyze called - CLEAN ARCHITECTURE
[PHASE 34.4] Current state: {devisId: "devis_xxxxx", ...}
[PHASE 34.4] Validation passed - proceeding with analysis
[PHASE 34.4] User authenticated: user_xxxxx
[PHASE 34.4] Using devisId: devis_xxxxx
[PHASE 34.4] Calling devisService.analyzeDevisById()
[Devis] Starting analysis for devis_xxxxx...
[Devis] Analysis complete
[PHASE 34.4] Navigating to devis page: devis_xxxxx
```

**Check:**
- ✅ No freeze or hang
- ✅ Loading spinner shows analysis progress
- ✅ Page navigates to `/devis/{devisId}`
- ✅ No upload re-attempted (devisId reused)

### 5. Success Indicators
- ✅ Page doesn't freeze at Step 2
- ✅ Console shows clean [PHASE 34.4] logs
- ✅ No errors about "uploadedFile" being null
- ✅ Analysis page loads successfully
- ✅ Devis record shows in database

---

## 🔍 DETAILED TEST SCENARIOS

### Scenario 1: Normal Flow (Happy Path)
**Goal:** Verify complete flow works without issues

**Steps:**
1. Open Analyze page
2. Upload file
3. Click "Continue"
4. Wait for upload to complete
5. Fill in project details
6. Click "Lancer l'analyse"
7. Wait for analysis
8. Verify result page loads

**Expected Result:** ✅ Complete flow works smoothly

**Red Flags:**
- ❌ Button freezes at Step 2
- ❌ "uploadedFile" error in console
- ❌ devisId not logged
- ❌ Page doesn't navigate

---

### Scenario 2: Form Validation (Missing Fields)
**Goal:** Verify validation works correctly

**Steps:**
1. Upload file
2. Click "Continue"
3. Leave "Project Name" blank
4. Click "Lancer l'analyse"

**Expected Result:** ✅ Error toast: "Veuillez remplir tous les champs"

**Console Expected:**
```
[PHASE 34.4] Validation failed - missing required fields
```

---

### Scenario 3: No DevisId (Edge Case)
**Goal:** Verify error handling if devisId is missing

**Steps:**
1. Manually clear devisId from browser storage (DevTools)
2. Manually navigate to Step 2
3. Click "Lancer l'analyse"

**Expected Result:** ✅ Error toast: "Devis non trouvé"

**Console Expected:**
```
[PHASE 34.4] No devisId found - cannot analyze
```

---

### Scenario 4: Database Check
**Goal:** Verify devis records are created correctly

**Steps:**
1. Complete full flow
2. Open browser DevTools → Network tab
3. Look for devis API response
4. Check Supabase database

**Expected Result:** ✅ Devis record exists in database with:
- `id` = devisId from logs
- `user_id` = authenticated user
- `file_name` = uploaded file name
- `status` = analyzed (or analyzing)

---

## 🐛 DEBUGGING CHECKLIST

### If button freezes at Step 2:
1. Check console for [PHASE 34.4] logs
2. Verify devisId was logged in Step 1
3. Check Network tab for failed API calls
4. Verify Supabase credentials are correct

### If "uploadedFile" error appears:
- This should NOT happen with Phase 34.4
- If it does, it means old code is still running
- Clear browser cache and rebuild

### If devisId is not logged:
1. Check Step 1 upload (should log upload start/done)
2. Verify upload response includes `id` field
3. Check that `setCurrentDevisId()` was called

### If navigation to devis page fails:
1. Verify route `/devis/:id` exists
2. Check that devis page component loads
3. Look for errors in console

---

## 📊 CONSOLE OUTPUT REFERENCE

### Full Success Path
```
┌─ STEP 1: UPLOAD ─────────────────────────────┐
[PHASE 34.4] handleContinueToStep2 called      │ Entry point
[PHASE 34.4] Uploading file: document.pdf      │ File name
[SAFE MODE] Upload START                       │ Upload begins
[SAFE MODE] Bucket test passed                 │ Permissions OK
[SAFE MODE] File uploaded to path              │ Upload progress
[SAFE MODE] Upload DONE                        │ Upload complete
[PHASE 34.4] Upload complete, devisId: xxx    │ Success + ID
└──────────────────────────────────────────────┘

┌─ STEP 2: ANALYSIS ───────────────────────────┐
[PHASE 34.4] handleAnalyze called              │ Entry point
[PHASE 34.4] Current state: {...}             │ State snapshot
[PHASE 34.4] Validation passed                │ Form valid
[PHASE 34.4] User authenticated: user_xxx    │ User verified
[PHASE 34.4] Using devisId: devis_xxx        │ ID confirmed
[PHASE 34.4] Calling analyzeDevisById()      │ Service call
[Devis] Starting analysis...                  │ Analysis begins
[Devis] Analysis complete                     │ Analysis done
[PHASE 34.4] Navigating to devis page        │ Navigation
└──────────────────────────────────────────────┘
```

### Error Path Examples
```
Missing fields:
[PHASE 34.4] Validation failed - missing required fields

No devisId:
[PHASE 34.4] No devisId found - cannot analyze

Upload error:
[PHASE 34.4] Upload error: [error message]

Analysis error:
[PHASE 34.4] ERROR IN ANALYSIS
[PHASE 34.4] Error message: [error details]
```

---

## 📈 PERFORMANCE METRICS

### Expected Timing
- **Step 1 Upload:** 1-5 seconds (depends on file size)
- **Step 2 Form:** < 1 second (instant)
- **Step 2 Analysis:** 3-10 seconds (depends on devis complexity)
- **Total Flow:** 5-15 seconds

### Performance Checks
- ✅ No hanging or freezing
- ✅ Loading spinners show progress
- ✅ Console logs in real-time
- ✅ No memory leaks (keep DevTools open to check)

---

## ✅ FINAL VERIFICATION CHECKLIST

Before declaring PHASE 34.4 complete:

- [ ] Step 1 upload works without errors
- [ ] Console shows [PHASE 34.4] logs
- [ ] devisId is logged and stored
- [ ] Step 2 navigation succeeds
- [ ] Step 2 form displays correctly
- [ ] "Lancer l'analyse" button is clickable
- [ ] Step 2 button click shows [PHASE 34.4] logs
- [ ] No "uploadedFile" errors appear
- [ ] Analysis executes without freeze
- [ ] Analysis navigates to result page
- [ ] Devis record appears in database
- [ ] Error handling works (validation, missing fields)
- [ ] No TypeScript errors in console
- [ ] No network errors in Network tab
- [ ] Build passes (npm run build)

---

## 🎯 SUCCESS CRITERIA

| Criterion | Before | After |
|-----------|--------|-------|
| Step 2 button freeze | YES ❌ | NO ✅ |
| uploadedFile errors | YES ❌ | NO ✅ |
| File re-upload | YES ❌ | NO ✅ |
| Console logs | Confusing | Clear [PHASE 34.4] logs |
| State loss | YES ❌ | NO ✅ |
| Architecture | Coupled | Separated ✅ |

**Phase 34.4 is successful when all "After" criteria are met.**

---

## 📞 TROUBLESHOOTING

### Issue: "devisId is undefined"
**Cause:** Upload didn't complete or return ID
**Fix:** Check network tab, verify Supabase permissions

### Issue: Button freezes at Step 2
**Cause:** Old code still running
**Fix:** Clear cache, rebuild, refresh page

### Issue: "No matching project" error
**Cause:** Database migration or schema issue
**Fix:** Check devis table exists in Supabase

### Issue: Navigation fails to `/devis/{id}`
**Cause:** Route doesn't exist or component missing
**Fix:** Verify `/devis/:id` route is defined

### Issue: Loading spinner doesn't stop
**Cause:** Analysis service hangs
**Fix:** Check browser console for errors, check Supabase logs

---

## 🚀 READY FOR TESTING

All systems are in place:
- ✅ Code changes committed
- ✅ Build passing
- ✅ Documentation complete
- ✅ Logging in place
- ✅ Error handling ready

**Start testing now!** 🧪

---

**Generated:** 2026-02-17
**Phase:** 34.4 TESTING GUIDE
**Status:** Ready for QA


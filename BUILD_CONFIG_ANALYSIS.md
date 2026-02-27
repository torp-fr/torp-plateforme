# BUILD CONFIGURATION & PACKAGE.JSON ANALYSIS

**Analysis Date:** February 27, 2026
**Project:** TORP - Plateforme SaaS d'analyse de devis BTP

---

## 1️⃣ EXACT FRONTEND FRAMEWORK

### ✅ React 18 + Vite + TypeScript

**Evidence:**
```json
{
  "type": "module",
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.30.1",
    "react-hook-form": "^7.61.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react-swc": "^3.11.0",
    "vite": "^5.4.19"
  }
}
```

**Build System:** Vite 5.4.19
- Plugin: `@vitejs/plugin-react-swc@^3.11.0` (Speedy Web Compiler)
- Configuration: `/vite.config.ts` (28 lines)
- Entry point: `/index.html` → `/src/main.tsx`
- Build output: `/dist` directory

**Not Next.js:**
- ❌ No `next.config.js`
- ❌ No `pages/` or `app/` directories (Next.js conventions)
- ❌ No server-side rendering configuration
- ✅ Pure Vite configuration only

**Language:** TypeScript 5.8.3
- `tsconfig.json`: Configuration references
- `tsconfig.app.json`: React app specific config
- `tsconfig.node.json`: Build tooling config
- JSX: `react-jsx` mode (automatic JSX runtime)

---

## 2️⃣ ARCHITECTURE: SPA (Single Page Application)

### ✅ Confirmed: Pure SPA

**Evidence:**

1. **Vercel Configuration (SPA Pattern):**
   ```json
   {
     "framework": "vite",
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ],
     "outputDirectory": "dist"
   }
   ```
   - All routes rewritten to `/index.html` (classic SPA routing)
   - No server-side rendering configuration
   - Static site deployment

2. **React Router v6:**
   ```typescript
   "react-router-dom": "^6.30.1"
   ```
   - Client-side routing only
   - No SSR/SSG adapters

3. **Build Output:**
   - Single `index.html` with bundled JavaScript
   - Asset-based routing (no server-side routing)
   - Vercel static site deployment

4. **No SSR/SSG:**
   - ❌ No `@vitejs/plugin-ssr`
   - ❌ No Next.js (which does SSR)
   - ❌ No Astro or other SSR framework
   - ✅ Pure SPA configuration

---

## 3️⃣ SERVER-SIDE RUNTIME

### ✅ Hybrid Architecture: SPA + Serverless Functions

**Frontend Deployment (SPA):**
- Vercel (static site hosting)
- React app in browser
- All routes handled client-side

**Server-Side Execution (Not Traditional Node.js):**

1. **Supabase Edge Functions** (Deno-based)
   - `/supabase/functions/` - 19 functions
   - Server-side only operations:
     - LLM API calls (generate-embedding, llm-completion, analyze-devis, etc.)
     - Database operations via service role
     - API key protection
   - Deployment: Supabase platform (separate from Vercel)
   - Runtime: Deno (not Node.js)

2. **Vercel Edge Functions** (Not Configured)
   - Could be used but currently not in use
   - No `/api/` routes visible in package.json

3. **Package.json Analysis:**
   ```json
   {
     "main": (NOT DEFINED),
     "exports": (NOT DEFINED),
     "server": (NOT DEFINED)
   }
   ```
   - ✅ No server entry point
   - ✅ No Express.js or Node.js backend
   - ✅ Pure frontend build

**Conclusion:** Frontend is SPA, backend is Supabase Edge Functions (separate infrastructure)

---

## 4️⃣ PRODUCTION-READINESS: ⚠️ CAUTION

### 🟢 What's Good

1. **Build Configuration:**
   - ✅ TypeScript compilation: `noImplicitAny: true`, `strictNullChecks: true`
   - ✅ Security headers configured in Vercel
   - ✅ Cache-Control headers for assets (31536000s = 1 year)
   - ✅ No code-splitting disabled intentionally (single bundle)
   - ✅ Environment separation (dev/prod)

2. **Deployment:**
   - ✅ Vercel platform (production-grade CDN)
   - ✅ Static site hosting (fast)
   - ✅ Security headers present:
     ```json
     "X-Content-Type-Options": "nosniff",
     "X-Frame-Options": "DENY",
     "X-XSS-Protection": "1; mode=block",
     "Referrer-Policy": "strict-origin-when-cross-origin"
     ```

3. **Dependencies:**
   - ✅ DevDependencies separate from production
   - ✅ No mixing of dev and prod packages
   - ✅ Version pinning strategy (`^` semver)

### 🟠 Issues Found

1. **TypeScript Configuration Inconsistency:**
   - `tsconfig.json` has STRICTER settings:
     ```json
     "noImplicitAny": true,
     "strictNullChecks": true,
     "strictFunctionTypes": true
     ```
   - `tsconfig.app.json` has LOOSER settings:
     ```json
     "strict": false,
     "noImplicitAny": false,
     "noUnusedLocals": false,
     "noUnusedParameters": false
     ```
   - **Problem:** App code not following strict rules
   - **Impact:** Potential runtime type errors

2. **Code-Splitting Disabled:**
   ```typescript
   // vite.config.ts
   build: {
     // Désactivation du code-splitting pour éviter les erreurs React sur Vercel
     // Un bundle unique est plus gros mais garantit le bon ordre de chargement
     chunkSizeWarningLimit: 5000,
   }
   ```
   - **Warning:** Single bundle increases initial load time
   - **Reason:** Workaround for React ordering issues on Vercel
   - **Concern:** Bundle size will be large (11.3MB+ dependencies)

3. **Build Comments Indicate Hacks:**
   - "Désactivation du code-splitting pour éviter les erreurs React sur Vercel"
   - Translation: "Disabling code-splitting to avoid React errors on Vercel"
   - **Red Flag:** Suggests previous production issues

4. **Development Mode Still Enabled in Production:**
   - `vercel.json` sets `VITE_APP_ENV=production` ✓ (Good)
   - But debug mode may still be on in some configurations
   - `src/config/env.ts` has debugMode settings

5. **No Build Optimization:**
   - No minification configuration visible
   - No tree-shaking configuration
   - No bundle analysis tools

### 🔴 Production Concerns

1. **Large Bundle Size:**
   - Dependencies: ~11.3MB (estimated)
   - With tree-shaking: ~5-7MB (gzipped: ~1.5-2MB)
   - Impact: Slow initial page load on slower connections

2. **No Performance Monitoring:**
   - No Sentry integration
   - No Web Vitals monitoring configured
   - No error boundary visible in main.tsx

3. **No Environment File Validation:**
   - Required environment variables not validated at build time
   - Potential for runtime errors if env vars missing

---

## 5️⃣ DANGEROUS DEV DEPENDENCIES IN PRODUCTION

### ✅ SAFE - All devDependencies Properly Isolated

**Analysis:**

All devDependencies are correctly marked and will NOT be bundled in production:
- ESLint and TypeScript (build-time only)
- Test runners (Vitest, Playwright, Jest-dom)
- UI tools (Lovable-tagger for dev, @vitest/ui)
- JSDOM and Happy-DOM (test environments only)

**Verification:**
```json
{
  "devDependencies": {
    "@vitejs/plugin-react-swc": "✅ Build plugin (not bundled)",
    "vite": "✅ Build tool (not bundled)",
    "@types/node": "✅ TypeScript types (not bundled)",
    "typescript": "✅ Compiler (not bundled)",
    "@playwright/test": "✅ Test runner (not bundled)",
    "vitest": "✅ Test runner (not bundled)",
    "jsdom": "✅ Test environment (not bundled)",
    "happy-dom": "✅ Test environment (not bundled)",
    "lovable-tagger": "✅ Dev UI tool (dev-only plugin)",
    "eslint": "✅ Linter (not bundled)",
    "typescript-eslint": "✅ Linter plugin (not bundled)"
  }
}
```

**Verdict:** ✅ **SAFE** - No production security risks from dev dependencies

---

## 6️⃣ UNUSED HEAVY DEPENDENCIES

### ⚠️ Found: 3 Unused Dependencies

| Dependency | Size | Used | Risk Level |
|------------|------|------|-----------|
| **qrcode** | 80KB | ❌ NO | 🟡 MEDIUM |
| **embla-carousel-react** | 100KB | ❌ NO | 🟡 MEDIUM |
| **resend** | 35KB | ❌ NO | 🟡 MEDIUM |

**Total Unused:** ~215KB (~1.9% of bundle)

### Impact Analysis

1. **qrcode** (80KB)
   - Type: QR code generation library
   - Search: 0 imports found in codebase
   - Candidate: Delete (likely imported indirectly or never implemented)

2. **embla-carousel-react** (100KB)
   - Type: Carousel component library
   - Search: 0 imports found in codebase
   - Status: Referenced in package.json but not used
   - Candidate: Delete

3. **resend** (35KB)
   - Type: Email sending SDK
   - Search: 0 imports found in codebase
   - Status: Listed but not implemented
   - Candidate: Delete or implement

### Used Heavy Dependencies (Justified)

| Dependency | Size | Imports | Purpose | Justified |
|------------|------|---------|---------|-----------|
| **pdfjs-dist** | 8000KB | 6 | PDF extraction | ✅ YES - Core feature |
| **recharts** | 850KB | 1 | Charts | ✅ YES - Analytics |
| **jspdf** | 400KB | 2 | PDF generation | ✅ YES - Reports |
| **@supabase/supabase-js** | 250KB | Many | Database client | ✅ YES - Core |
| **openai** | 180KB | 1 | OpenAI API | ✅ YES - AI features |
| **@anthropic-ai/sdk** | 200KB | 1 | Claude API | ✅ YES - AI features |
| **date-fns** | 100KB | 18 | Date utilities | ✅ YES - Heavy use |
| **@tanstack/react-query** | 80KB | 10 | Data fetching | ✅ YES - Heavy use |

### Radix UI Components (27 Components)

**Total Size:** ~650KB for all 27 components

**Status:** ✅ Most used in codebase
- Query results show usage of many components
- Dialog, Select, Toast, Tabs, etc. actively used

**Concern:** 27 components is a lot
- Some likely unused (AspectRatio, Slot, etc.)
- Candidate for tree-shaking analysis

---

## 7️⃣ BUNDLE SIZE PROJECTION

### Current Dependencies

```
Frontend Bundle Estimate:
├── Core frameworks (React, React-DOM, Router): ~90KB
├── UI Components (Radix UI - 27): ~650KB
├── PDF Processing (pdfjs, jspdf): ~8.4MB
├── Charts (recharts): ~850KB
├── API clients (Supabase, OpenAI, Anthropic): ~650KB
├── Utilities (date-fns, zod, react-hook-form): ~280KB
├── Unused (qrcode, embla, resend): ~215KB
└── Other dependencies: ~400KB
────────────────────────
TOTAL: ~11.3MB (uncompressed)
       ~2-2.5MB (gzipped, tree-shaken)
```

### Optimization Opportunities

1. **Remove unused (215KB):**
   - qrcode
   - embla-carousel-react
   - resend

2. **PDF.js optimization (8MB):**
   - Currently: Full PDF.js (8MB+)
   - Alternative: Lazy-load PDF.js or use lighter alternative
   - Potential saving: 4-6MB

3. **Radix UI tree-shaking:**
   - Currently: All 27 components bundled
   - Potential: Only import used components
   - Potential saving: 200-300KB

4. **Code-splitting re-enable:**
   - Currently: Single bundle (disabled)
   - Recommendation: Enable code-splitting if stability allows
   - Potential saving: Better caching, faster initial load

---

## 8️⃣ PRODUCTION-READY ASSESSMENT

### 🟡 PARTIALLY READY (70% Ready)

| Category | Status | Details |
|----------|--------|---------|
| **Framework** | ✅ READY | React 18 + Vite, mature stack |
| **Build System** | ✅ READY | Vite 5.4 properly configured |
| **Deployment** | ✅ READY | Vercel with security headers |
| **Type Safety** | ⚠️ PARTIAL | Loose TypeScript in app code |
| **Bundle Size** | 🔴 ISSUE | 11.3MB deps too large |
| **Code-Splitting** | 🔴 DISABLED | Workaround for React issues |
| **Environment** | ✅ READY | Proper separation |
| **Dev Dependencies** | ✅ SAFE | All properly isolated |
| **Error Handling** | 🔴 MISSING | No Sentry/monitoring |
| **Performance** | 🔴 ISSUE | No metrics collection |

---

## 9️⃣ CRITICAL CONFIGURATION ISSUES

### 🔴 ISSUE #1: Loose TypeScript in Production

**Problem:**
```json
// tsconfig.app.json (what the app actually uses)
{
  "strict": false,              // ❌ All strict checks disabled
  "noImplicitAny": false,       // ❌ Implicit any allowed
  "noUnusedLocals": false,      // ❌ Unused variables allowed
  "noUnusedParameters": false   // ❌ Unused params allowed
}
```

**Impact:** Type errors not caught at compile time
**Fix:** Enable strict mode in tsconfig.app.json

---

### 🔴 ISSUE #2: Code-Splitting Disabled

**Problem:**
```typescript
// vite.config.ts
build: {
  chunkSizeWarningLimit: 5000,
  // Comment: "Désactivation du code-splitting pour éviter les erreurs React sur Vercel"
}
```

**Impact:** Single large bundle (slower initial load)
**Root Cause:** React ordering issues on Vercel
**Fix:** Either fix React issues or accept larger bundle

---

### 🟠 ISSUE #3: No Bundle Analysis

**Missing:**
- No `vite-plugin-visualizer`
- No bundle size monitoring
- No performance baselines

**Recommendation:** Add bundle analysis to CI/CD

---

### 🟠 ISSUE #4: Large PDF.js Bundle

**Current:** 8MB+ (pdfjs-dist bundled entirely)
**Recommendation:** Lazy-load or use smaller alternative

---

## 🔟 RECOMMENDATIONS (Priority Order)

### 🔴 CRITICAL (Before Production)

1. **Enable Strict TypeScript**
   - Change `tsconfig.app.json`:
     ```json
     "strict": true,
     "noImplicitAny": true,
     "noUnusedLocals": true,
     "noUnusedParameters": true
     ```
   - Effort: 4-8 hours (fixing existing type errors)
   - Impact: Catch errors at compile time

2. **Remove Unused Dependencies**
   ```bash
   npm uninstall qrcode embla-carousel-react resend
   ```
   - Saves: 215KB (~1.9% of bundle)
   - Effort: 30 minutes
   - Impact: Smaller bundle

3. **Add Error Monitoring**
   - Integrate Sentry or similar
   - Effort: 2-3 hours
   - Impact: Production debugging capability

### 🟠 HIGH (Before Scaling)

4. **Fix React Issues & Re-enable Code-Splitting**
   - Investigate React ordering errors on Vercel
   - Enable code-splitting for faster initial loads
   - Effort: 4-6 hours
   - Impact: Better caching, faster page loads

5. **Optimize PDF.js Bundle**
   - Lazy-load PDF.js or use lighter alternative (pdfworker.js)
   - Effort: 3-4 hours
   - Impact: 50% bundle size reduction

6. **Add Bundle Size Monitoring**
   - Install vite-plugin-visualizer
   - Add to CI/CD pipeline
   - Effort: 1-2 hours
   - Impact: Prevent future bloat

### 🟡 MEDIUM (Ongoing)

7. **Add Web Vitals Monitoring**
   - Integrate web-vitals library
   - Track Core Web Vitals
   - Effort: 2-3 hours

8. **Tree-Shake Radix UI Components**
   - Import only used components
   - Potential saving: 200-300KB
   - Effort: 3-4 hours

---

## FINAL ASSESSMENT

### Framework: ✅ React 18 + Vite
- Modern, production-grade stack
- Excellent build tooling
- Good TypeScript support

### Architecture: ✅ SPA + Serverless
- Pure client-side rendering
- Supabase Edge Functions for backend
- Hybrid architecture works well

### Production-Ready: ⚠️ **70% READY**
- Deployment infrastructure: Ready
- Code quality: Needs improvement (loose TypeScript)
- Performance: Needs optimization (large bundle)
- Monitoring: Missing (no error tracking)
- Production fixes needed: 3 critical issues

### Build Configuration: ✅ **GENERALLY GOOD**
- Vercel setup: Excellent
- Security headers: Present
- Environment separation: Good
- Dependencies: Properly isolated (dev vs prod)

### Blocking Issues for Production:
1. ❌ Loose TypeScript (type safety risk)
2. ❌ Code-splitting disabled (performance risk)
3. ❌ No error monitoring (debugging risk)

**Recommended Timeline:**
- Fix issues: 1-2 weeks
- Test thoroughly: 1-2 weeks
- Deploy to production: 2-3 weeks total


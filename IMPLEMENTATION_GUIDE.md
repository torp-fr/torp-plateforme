# GUIDE D'IMPLÉMENTATION - AUDIT TORP
**Roadmap détaillée pour résoudre les issues critiques**

---

## PHASE 0: P0 BLOCKERS (Semaine 1)

### P0.1: Déployer Sentry Error Tracking [4-6 heures]

**Objectif:** Avoir visibility sur tous les erreurs frontend

**Step-by-step:**

#### 1. Install Sentry SDK
```bash
npm install @sentry/react @sentry/tracing
```

#### 2. Create src/lib/sentry.ts
```typescript
import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";

export const initSentry = () => {
  if (import.meta.env.PROD) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      integrations: [
        new BrowserTracing(),
        new Sentry.Replay({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      tracesSampleRate: 1.0,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      environment: import.meta.env.MODE,
    });
  }
};

export const captureException = (error: Error, context?: Record<string, any>) => {
  Sentry.captureException(error, {
    contexts: {
      app: context,
    },
  });
};

export const captureMessage = (message: string, level: Sentry.SeverityLevel = "info") => {
  Sentry.captureMessage(message, level);
};
```

#### 3. Update src/main.tsx
```typescript
import { initSentry } from '@/lib/sentry';

initSentry();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

#### 4. Wrap ErrorBoundary with Sentry
```typescript
import * as Sentry from "@sentry/react";
import ErrorBoundary from '@/components/error/ErrorBoundary';

const SentryErrorBoundary = Sentry.withErrorBoundary(ErrorBoundary, {
  fallback: <div>An error occurred</div>,
  showDialog: true,
});

// Use in App.tsx
<SentryErrorBoundary>
  {/* app content */}
</SentryErrorBoundary>
```

#### 5. Add environment variable
```bash
# .env.production
VITE_SENTRY_DSN=https://[key]@[domain].ingest.sentry.io/[project-id]
```

#### 6. Test it
```typescript
// Somewhere in a component
import { captureException } from '@/lib/sentry';

try {
  throw new Error('Test error');
} catch (error) {
  captureException(error as Error, { component: 'TestComponent' });
}
```

**Validation:**
- ✓ Erreur de test visible dans Sentry dashboard
- ✓ Environment labels correct
- ✓ Source maps uploadés

**Timeline:** 4-6 heures
**Owner:** DevOps / Backend Lead

---

### P0.2: Audit et Fix RLS Policies [3-5 jours]

**Objectif:** Avoir un set clair et testable de RLS policies

**Step 1: Audit Current State (4 hours)**

Créer script d'audit:
```sql
-- audit_rls.sql
-- List all RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
ORDER BY schemaname, tablename, policyname;

-- Identify duplicates/conflicts
SELECT
  tablename,
  policyname,
  COUNT(*) as count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename, policyname
HAVING COUNT(*) > 1;

-- Check for overly permissive policies
SELECT * FROM pg_policies
WHERE qual = 'true' -- allows all
OR with_check = 'true';
```

Run audit:
```bash
psql postgresql://[connection-string] < audit_rls.sql > audit_results.txt
```

**Step 2: Document Intent (8 hours)**

Créer `supabase/RLS_POLICY_INTENT.md`:

```markdown
# RLS Policy Design Document

## Table: profiles
- **Owner reads own**: auth.uid() = user_id
- **Public reads public fields**: (is_public = true)
- **Admin reads all**: admin_role = true
- **Constraint**: No one modifies other user's data

## Table: knowledge_documents
- **Owner access**: auth.uid() = created_by
- **Team access**: auth.uid() IN (SELECT user_id FROM team_members WHERE doc_id = id)
- **Public docs**: visibility = 'public'
- **Admin override**: admin_role = true

## Table: devis
- **B2C owner**: auth.uid() = owner_id
- **B2B owner**: auth.uid() IN (SELECT user_id FROM company_employees WHERE company_id = devis.company_id)
- **Read-only analyst**: role = 'analyst' AND assignment = devis_id
- **Admin override**: admin_role = true

## Cross-Table Rules
- No user can modify another user's data
- Admin can read/modify everything
- Timestamps auto-managed by triggers
```

**Step 3: Clean Up Policies (1 day)**

Create clean migration:
```sql
-- supabase/migrations/YYYYMMDD_cleanup_rls_policies.sql

-- DISABLE old RLS temporarily
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE devis DISABLE ROW LEVEL SECURITY;

-- DROP all existing policies
DROP POLICY IF EXISTS "enable_select_for_authenticated" ON profiles;
DROP POLICY IF EXISTS "enable_update_for_own_record" ON profiles;
DROP POLICY IF EXISTS "enable_delete_for_own_record" ON profiles;
-- ... (repeat for all tables)

-- RE-CREATE clean policies

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Admin can view all profiles"
ON profiles FOR SELECT
USING (
  auth.jwt() ->> 'user_role' = 'admin'
);

-- Knowledge Documents
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own documents"
ON knowledge_documents FOR SELECT
USING (auth.uid() = created_by);

CREATE POLICY "Users can update own documents"
ON knowledge_documents FOR UPDATE
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete own documents"
ON knowledge_documents FOR DELETE
USING (auth.uid() = created_by);

-- ... repeat for other tables
```

**Step 4: Test RLS (1 day)**

Create test suite:
```typescript
// tests/rls.test.ts
import { createClient } from '@supabase/supabase-js';

describe('RLS Policies', () => {
  let userA: any, userB: any, admin: any;

  beforeAll(async () => {
    // Create test users
    userA = createClient(SUPABASE_URL, SERVICE_KEY).auth.signUp({...});
    userB = createClient(SUPABASE_URL, SERVICE_KEY).auth.signUp({...});
    admin = createClient(SUPABASE_URL, SERVICE_KEY).auth.signUp({...});
  });

  describe('Profiles RLS', () => {
    test('User A can read own profile', async () => {
      const { data, error } = await userA
        .from('profiles')
        .select('*')
        .eq('id', userA.id)
        .single();
      expect(error).toBeNull();
      expect(data.id).toBe(userA.id);
    });

    test('User A cannot read User B profile', async () => {
      const { data, error } = await userA
        .from('profiles')
        .select('*')
        .eq('id', userB.id)
        .single();
      expect(error).not.toBeNull();
      expect(error?.code).toBe('PGRST116'); // Row level security violation
    });

    test('User A cannot modify User B profile', async () => {
      const { error } = await userA
        .from('profiles')
        .update({ name: 'Hacked' })
        .eq('id', userB.id);
      expect(error).not.toBeNull();
    });

    test('Admin can read all profiles', async () => {
      const { data, error } = await admin
        .from('profiles')
        .select('*');
      expect(error).toBeNull();
      expect(data.length).toBeGreaterThan(1);
    });
  });

  // ... repeat for other tables
});
```

Run tests:
```bash
npm test -- tests/rls.test.ts
```

**Deliverables:**
- ✓ RLS audit report
- ✓ RLS policy intent document
- ✓ Clean migration file
- ✓ RLS test suite (all passing)
- ✓ Documentation updated

**Timeline:** 3-5 days
**Owner:** Security + Backend Lead

---

### P0.3: Merge Obligation Extraction Engines [2 days]

**Objective:** Single source of truth for obligation extraction

**Step 1: Compare Implementations (4 hours)**

```bash
# Find differences
diff -u src/engines/obligationExtractionEngine.js \
         src/engines/regulatoryObligationExtractionEngine.js > engine-diff.patch

# Analyze size
wc -l src/engines/{obligation,regulatory}ExtractionEngine.js
# obligationExtractionEngine: 551 LOC
# regulatoryObligationExtractionEngine: 651 LOC
```

**Decision:** Use `obligationExtractionEngine.js` as base (simpler, cleaner code)

**Step 2: Extract Best Practices from Both**

```typescript
// src/engines/mergedObligationEngine.ts (FINAL)

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// ============================================================================
// CONSTANTS & VALIDATION (from both)
// ============================================================================

const ENGINE_VERSION = 'v3_merged_extraction';
const OBLIGATION_TYPES = ['exigence', 'interdiction', 'recommandation', 'tolérance'];
const APPLICABLE_PHASES = ['conception', 'execution', 'controle'];
const SANCTION_RISKS = ['faible', 'moyen', 'eleve'];

// Merged validation logic
function validateObligation(obligation: any) {
  const errors: string[] = [];

  if (!obligation.article_reference) {
    errors.push('article_reference required');
  }

  if (!OBLIGATION_TYPES.includes(obligation.obligation_type)) {
    errors.push(`obligation_type must be one of: ${OBLIGATION_TYPES.join(', ')}`);
  }

  if (!Number.isInteger(obligation.severity_level) ||
      obligation.severity_level < 1 || obligation.severity_level > 5) {
    errors.push('severity_level must be 1-5');
  }

  // ... other validations from both engines

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// MAIN FUNCTION (unified interface)
// ============================================================================

export async function extractObligationsFromChunk(
  chunk: { id: string; content: string },
  documentId: string,
  supabase: any,
  openaiClient: OpenAI,
  options?: { logger?: any }
): Promise<ExtractionResult> {
  // Implementation combining best parts from both
  // ... (full code)
}

export async function extractObligationsFromChunks(
  chunks: any[],
  documentId: string,
  supabase: any,
  openaiClient: OpenAI,
  options?: { logger?: any }
): Promise<BatchResult> {
  // Batch processing
}

export { ENGINE_VERSION };
```

**Step 3: Update All Imports**

```bash
# Find all imports of old engines
grep -r "regulatoryObligationExtractionEngine" src/

# Create migration script
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i \
  's|from .*regulatoryObligationExtractionEngine|from ./mergedObligationEngine|g'

find src -name "*.ts" -o -name "*.tsx" | xargs sed -i \
  's|from .*obligationExtractionEngine|from ./mergedObligationEngine|g'
```

**Step 4: Test Migration**

```typescript
// tests/mergedObligationEngine.test.ts
import { extractObligationsFromChunk } from '@/engines/mergedObligationEngine';

describe('Merged Obligation Engine', () => {
  test('extracts obligations correctly', async () => {
    const chunk = {
      id: 'test-chunk-1',
      content: 'Article 5: Tous les projets doivent respecter les normes DTU...',
    };

    const result = await extractObligationsFromChunk(
      chunk,
      'test-doc-1',
      supabase,
      openai
    );

    expect(result.inserted_count).toBeGreaterThan(0);
    expect(result.obligations).toHaveLength(result.inserted_count);
    expect(result.obligations[0]).toHaveProperty('article_reference');
    expect(result.obligations[0]).toHaveProperty('obligation_type');
  });
});
```

**Step 5: Delete Old Engines**

```bash
rm src/engines/regulatoryObligationExtractionEngine.js
git add -u  # Stage deletion
```

**Deliverables:**
- ✓ Single merged engine
- ✓ All imports updated
- ✓ Tests passing
- ✓ Old engines deleted
- ✓ Migration guide documented

**Timeline:** 2 days
**Owner:** Backend Lead

---

### P0.4: Config Validation at Startup [4 hours]

**Create src/config/validation.ts:**

```typescript
import { z } from 'zod';

// ============================================================================
// ENV SCHEMA WITH ZOD
// ============================================================================

const envSchema = z.object({
  // Supabase (REQUIRED)
  VITE_SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  VITE_SUPABASE_ANON_KEY: z.string().min(10, 'Invalid Supabase key'),

  // OpenAI (REQUIRED for production)
  VITE_OPENAI_API_KEY: z.string().optional(),

  // Anthropic (REQUIRED for production)
  VITE_ANTHROPIC_API_KEY: z.string().optional(),

  // AI Provider
  VITE_AI_PRIMARY_PROVIDER: z.enum(['openai', 'claude']).default('openai'),
  VITE_AI_FALLBACK_ENABLED: z.boolean().default(true),

  // File Upload
  VITE_MAX_FILE_SIZE: z.coerce.number().default(10485760), // 10MB
  VITE_ALLOWED_FILE_TYPES: z.string().default('.pdf,.docx,.xlsx'),

  // Feature Flags
  VITE_FREE_MODE: z.boolean().default(false),
  VITE_DEFAULT_CREDITS: z.coerce.number().default(0),
  VITE_STRIPE_ENABLED: z.boolean().default(false),

  // Optional Services
  VITE_SENTRY_DSN: z.string().optional(),
  VITE_INSEE_API_KEY: z.string().optional(),
  VITE_GOOGLE_MAPS_API_KEY: z.string().optional(),

  // Node env
  NODE_ENV: z.enum(['development', 'production']).default('development'),
});

// ============================================================================
// PARSE & VALIDATE
// ============================================================================

export function validateConfig() {
  const env = import.meta.env;

  const result = envSchema.safeParse(env);

  if (!result.success) {
    // Pretty print errors
    console.error('❌ Environment Configuration Errors:\n');
    Object.entries(result.error.flatten().fieldErrors).forEach(([key, errors]) => {
      console.error(`  ${key}:`);
      errors?.forEach(error => console.error(`    - ${error}`));
    });

    // Throw with clear message
    throw new Error(
      `Configuration validation failed. Check environment variables.\n` +
      `Failed fields: ${Object.keys(result.error.flatten().fieldErrors).join(', ')}`
    );
  }

  // Validation-specific checks
  const { VITE_OPENAI_API_KEY, VITE_ANTHROPIC_API_KEY, VITE_AI_PRIMARY_PROVIDER } = result.data;

  if (VITE_AI_PRIMARY_PROVIDER === 'openai' && !VITE_OPENAI_API_KEY) {
    throw new Error(
      '❌ VITE_OPENAI_API_KEY required when VITE_AI_PRIMARY_PROVIDER=openai'
    );
  }

  if (VITE_AI_PRIMARY_PROVIDER === 'claude' && !VITE_ANTHROPIC_API_KEY) {
    throw new Error(
      '❌ VITE_ANTHROPIC_API_KEY required when VITE_AI_PRIMARY_PROVIDER=claude'
    );
  }

  return result.data;
}

export const config = validateConfig();
```

**Update src/main.tsx:**

```typescript
import { config, validateConfig } from '@/config/validation';

// Validate config before rendering anything
try {
  validateConfig();
  console.log('✅ Configuration validated');
} catch (error) {
  console.error(error);
  // Render error page
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <div style={{ padding: '20px' }}>
      <h1>Configuration Error</h1>
      <p>{error.message}</p>
      <p>Please check your .env file and environment variables.</p>
    </div>
  );
  throw error;
}

// Then render app
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Update .env files:**

```bash
# .env.example
# Required
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_OPENAI_API_KEY=sk-proj-...
# or
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

**Test it:**

```bash
# Remove required env var
unset VITE_SUPABASE_URL

npm run dev  # Should fail with clear error message
```

**Deliverables:**
- ✓ Validation module
- ✓ Early startup errors
- ✓ Clear error messages
- ✓ .env files updated

**Timeline:** 4 hours
**Owner:** DevOps

---

## PHASE 1: FOUNDATION (Semaine 2-4)

### M1: Database Optimization [1 week]

**Create missing indexes:**

```sql
-- supabase/migrations/YYYYMMDD_add_critical_indexes.sql

-- Knowledge chunks (hot table)
CREATE INDEX CONCURRENTLY idx_knowledge_chunks_document_id
  ON knowledge_chunks(document_id);

CREATE INDEX CONCURRENTLY idx_knowledge_chunks_status
  ON knowledge_chunks(document_id, embedding_status);

CREATE INDEX CONCURRENTLY idx_knowledge_chunks_generated_at
  ON knowledge_chunks(embedding_generated_at DESC NULLS LAST);

-- Knowledge documents (polling table)
CREATE INDEX CONCURRENTLY idx_knowledge_documents_status
  ON knowledge_documents(ingestion_status, created_at DESC);

CREATE INDEX CONCURRENTLY idx_knowledge_documents_user_id
  ON knowledge_documents(created_by);

-- Devis (analytics table)
CREATE INDEX CONCURRENTLY idx_devis_user_id_created
  ON devis(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_devis_status
  ON devis(analysis_status);

-- Add partial indexes for common filters
CREATE INDEX CONCURRENTLY idx_knowledge_documents_pending
  ON knowledge_documents(id)
  WHERE ingestion_status = 'pending';

CREATE INDEX CONCURRENTLY idx_knowledge_chunks_incomplete
  ON knowledge_chunks(document_id)
  WHERE embedding_status != 'completed';
```

**Run analysis:**

```sql
-- Analyze query performance before/after
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM knowledge_chunks
WHERE document_id = 'xxx'
ORDER BY chunk_index ASC;

-- Check index usage
SELECT * FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

**Deliverables:**
- ✓ Indexes created
- ✓ Performance baseline (before/after)
- ✓ Query analysis report

---

### M2: LLM Response Caching [3-4 days]

**Install Redis:**

```bash
npm install redis ioredis
```

**Create src/lib/llmCache.ts:**

```typescript
import { createClient } from 'redis';
import crypto from 'crypto';

const redis = createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

export async function getCachedLLMResponse(
  prompt: string,
  model: string
): Promise<string | null> {
  const key = generateCacheKey(prompt, model);
  const cached = await redis.get(key);
  return cached ? JSON.parse(cached) : null;
}

export async function setCachedLLMResponse(
  prompt: string,
  model: string,
  response: string,
  ttlSeconds = 604800 // 7 days
): Promise<void> {
  const key = generateCacheKey(prompt, model);
  await redis.setex(key, ttlSeconds, JSON.stringify(response));
}

function generateCacheKey(prompt: string, model: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(prompt + model)
    .digest('hex');
  return `llm:${model}:${hash}`;
}
```

**Update obligation extraction:**

```typescript
import { getCachedLLMResponse, setCachedLLMResponse } from '@/lib/llmCache';

async function callLlmForExtraction(
  openaiClient: OpenAI,
  systemPrompt: string,
  userPrompt: string,
  logger: Logger
): Promise<ExtractionResult> {
  const cacheKey = systemPrompt + userPrompt;

  // Check cache
  const cached = await getCachedLLMResponse(cacheKey, 'gpt-4o-mini');
  if (cached) {
    logger.info('llm_cache_hit', { cacheKey });
    return JSON.parse(cached);
  }

  // Call LLM
  const response = await openaiClient.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  const parsed = JSON.parse(content!);

  // Cache result
  await setCachedLLMResponse(cacheKey, 'gpt-4o-mini', content!);

  logger.info('llm_cache_miss', { cacheKey });
  return parsed;
}
```

**Measure savings:**

```typescript
// Add to monitoring
async function trackLLMMetrics() {
  const cacheStats = await redis.info('stats');
  console.log('LLM Cache Stats:', {
    hits: cacheStats.hits,
    misses: cacheStats.misses,
    hitRate: (cacheStats.hits / (cacheStats.hits + cacheStats.misses) * 100).toFixed(2) + '%',
  });
}
```

**Deliverables:**
- ✓ Redis integration
- ✓ Cache key strategy
- ✓ Cache hit metrics
- ✓ Cost savings report (estimated)

---

### M3: TypeScript Strict Mode [1 week]

**Enable strict mode:**

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

**Fix compilation errors:**

```bash
# Run build to see errors
npm run build 2>&1 | grep "error TS" | head -20

# Create script to identify problematic files
grep -r "as any" src/ | wc -l  # 774 occurrences to fix
```

**Create type-safe replacements:**

```typescript
// Before (unsafe)
const data: any = await fetchData();
const value = data.someProperty;

// After (safe)
interface DataShape {
  someProperty: string;
  nested: {
    value: number;
  };
}

const data: DataShape = await fetchData();
const value = data.someProperty; // Type-safe!
```

**Add CI check:**

```bash
# .github/workflows/type-check.yml
name: Type Check

on: [push, pull_request]

jobs:
  type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npx tsc --noEmit
```

**Deliverables:**
- ✓ Strict mode enabled
- ✓ Zero compilation errors
- ✓ Type checking in CI/CD

---

### M4: Repository Pattern [1 week]

**Define repository interfaces:**

```typescript
// src/repositories/repository.interface.ts
export interface Repository<T> {
  getById(id: string): Promise<T | null>;
  getAll(filters?: Record<string, any>): Promise<T[]>;
  create(entity: Omit<T, 'id'>): Promise<T>;
  update(id: string, entity: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}

// Knowledge chunk repository
// src/repositories/knowledgeChunk.repository.ts
import { Repository } from './repository.interface';

export interface KnowledgeChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  embedding: number[];
  // ... other fields
}

export interface KnowledgeChunkRepository extends Repository<KnowledgeChunk> {
  findByDocumentId(documentId: string): Promise<KnowledgeChunk[]>;
  searchByEmbedding(embedding: number[], limit: number): Promise<KnowledgeChunk[]>;
  updateEmbedding(id: string, embedding: number[]): Promise<void>;
}
```

**Implement Supabase repository:**

```typescript
// src/repositories/supabase/knowledgeChunk.supabase-repository.ts
import { supabase } from '@/lib/supabase';
import { KnowledgeChunkRepository, KnowledgeChunk } from '../knowledgeChunk.repository';

export class SupabaseKnowledgeChunkRepository implements KnowledgeChunkRepository {
  async getById(id: string): Promise<KnowledgeChunk | null> {
    const { data, error } = await supabase
      .from('knowledge_chunks')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async findByDocumentId(documentId: string): Promise<KnowledgeChunk[]> {
    const { data, error } = await supabase
      .from('knowledge_chunks')
      .select('*')
      .eq('document_id', documentId)
      .order('chunk_index', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  }

  // ... implement other methods
}
```

**Create mock repository for testing:**

```typescript
// src/repositories/mock/knowledgeChunk.mock-repository.ts
import { KnowledgeChunkRepository, KnowledgeChunk } from '../knowledgeChunk.repository';

export class MockKnowledgeChunkRepository implements KnowledgeChunkRepository {
  private store: Map<string, KnowledgeChunk> = new Map();

  async getById(id: string): Promise<KnowledgeChunk | null> {
    return this.store.get(id) || null;
  }

  async create(entity: Omit<KnowledgeChunk, 'id'>): Promise<KnowledgeChunk> {
    const chunk = { ...entity, id: `test-${Date.now()}` } as KnowledgeChunk;
    this.store.set(chunk.id, chunk);
    return chunk;
  }

  // ... implement other methods for testing
}
```

**Update services to use repository:**

```typescript
// Before
import { supabase } from '@/lib/supabase';

export class ObligationService {
  async extractFromChunk(chunkId: string) {
    const { data: chunk } = await supabase
      .from('knowledge_chunks')
      .select('*')
      .eq('id', chunkId)
      .single();

    // ... process chunk
  }
}

// After
import { KnowledgeChunkRepository } from '@/repositories/knowledgeChunk.repository';

export class ObligationService {
  constructor(private chunkRepository: KnowledgeChunkRepository) {}

  async extractFromChunk(chunkId: string) {
    const chunk = await this.chunkRepository.getById(chunkId);
    if (!chunk) throw new Error('Chunk not found');

    // ... process chunk
  }
}

// Testing
const mockRepo = new MockKnowledgeChunkRepository();
const service = new ObligationService(mockRepo);
await service.extractFromChunk('test-chunk-1');
```

**Deliverables:**
- ✓ Repository interfaces defined
- ✓ Supabase implementations
- ✓ Mock implementations for tests
- ✓ Services refactored to use repos
- ✓ Tests passing

---

### M5: Input Validation [3-4 days]

**Create validation schemas:**

```typescript
// src/validators/devis.schemas.ts
import { z } from 'zod';

export const CreateDevisSchema = z.object({
  title: z.string().min(3, 'Title too short').max(255),
  description: z.string().min(10, 'Description too short'),
  budget: z.number().positive('Budget must be positive'),
  currency: z.enum(['EUR', 'USD']).default('EUR'),
  items: z.array(z.object({
    description: z.string(),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
  })),
  attachments: z.array(z.string().url()).optional(),
});

export type CreateDevisInput = z.infer<typeof CreateDevisSchema>;

export const UpdateDevisSchema = CreateDevisSchema.partial();
```

**Create validation middleware:**

```typescript
// src/middleware/validation.ts
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.flatten().fieldErrors,
      });
    }

    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      return res.status(400).json({
        error: 'Query validation failed',
        details: result.error.flatten().fieldErrors,
      });
    }

    req.query = result.data;
    next();
  };
}
```

**Apply to all endpoints:**

```typescript
// src/routes/devis.routes.ts
import express from 'express';
import { validateBody } from '@/middleware/validation';
import { CreateDevisSchema, UpdateDevisSchema } from '@/validators/devis.schemas';
import { devisController } from '@/controllers/devis.controller';

const router = express.Router();

router.post('/', validateBody(CreateDevisSchema), devisController.create);
router.put('/:id', validateBody(UpdateDevisSchema), devisController.update);

export default router;
```

**Deliverables:**
- ✓ Validation schemas for all endpoints
- ✓ Validation middleware
- ✓ All routes protected
- ✓ Consistent error responses

---

## SUMMARY CHECKLIST

### Phase 0 (P0 Blockers) - Semaine 1
- [ ] Sentry deployed
- [ ] RLS audit complete + fixed
- [ ] Config validation implemented
- [ ] Obligation engines merged

### Phase 1 (Foundation) - Semaine 2-4
- [ ] Database indexes created
- [ ] LLM caching in production
- [ ] TypeScript strict mode enabled
- [ ] Repository pattern implemented
- [ ] Input validation on all endpoints

### Phase 2 (Architectural) - Mois 2+
- [ ] Event-driven worker
- [ ] Microservices separation
- [ ] Engine standardization
- [ ] RGPD compliance
- [ ] Observability stack

---

**Next:** See AUDIT_TECHNIQUE_COMPLET.md for Phase 2 detailed plans

Generated: 28 février 2026

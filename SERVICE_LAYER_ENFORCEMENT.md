# 🏗️ SERVICE LAYER ENFORCEMENT (PHASE 31.6)

**Status:** LOCKED ✅
**Enforced By:** Architecture checks + ESLint rules
**Violation Penalty:** Build failure + deployment block

---

## 📋 Core Principle

> **No React component shall directly access the database.**

```
FORBIDDEN:                         REQUIRED:
─────────────────────────────────  ──────────────────────────────
components/Foo.tsx:                services/api/foo.service.ts:
  import { supabase }                export async function
  const data =                       getFooData(id) {
    supabase.from('foo')               return supabase.from('foo')
           .select()                          .select()
           .eq('id', id)                      .eq('id', id)
```

---

## 🚫 FORBIDDEN PATTERNS

### ❌ Pattern 1: Direct `supabase.from()` in Components

```typescript
// ❌ FORBIDDEN
export function ProfilePage() {
  const { data } = supabase
    .from('profiles')
    .select();
  return <div>{data}</div>;
}
```

**Why:**
- Breaks separation of concerns
- Couples UI to database structure
- Makes testing impossible
- Creates circular dependencies

**Correction:**
```typescript
// ✅ CORRECT
import { getProfiles } from '@/services/api/profile.service';

export function ProfilePage() {
  const { data } = useQuery(
    ['profiles'],
    () => getProfiles()
  );
  return <div>{data}</div>;
}
```

---

### ❌ Pattern 2: Database Calls in Event Handlers

```typescript
// ❌ FORBIDDEN
function onSubmit(data) {
  supabase
    .from('users')
    .insert([data])
    .then(...)
}
```

**Correction:**
```typescript
// ✅ CORRECT
import { createUser } from '@/services/api/user.service';

function onSubmit(data) {
  createUser(data)
    .then(...)
}
```

---

### ❌ Pattern 3: Auth Logic in Components

```typescript
// ❌ FORBIDDEN - Auth logic in page
export function LoginPage() {
  async function handleLogin(email, password) {
    const { data: { user } } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
  }
}
```

**Correction:**
```typescript
// ✅ CORRECT - Auth service handles logic
import { signIn } from '@/services/api/supabase/auth.service';

export function LoginPage() {
  async function handleLogin(email, password) {
    const user = await signIn(email, password);
  }
}
```

---

## ✅ APPROVED PATTERNS

### Approved Pattern 1: Service-Based Data Fetching

```typescript
// src/services/api/profile.service.ts
export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

// src/pages/ProfilePage.tsx
import { getProfile } from '@/services/api/profile.service';

export function ProfilePage() {
  const { data } = useQuery(['profile'], () => getProfile(userId));
  return <Profile data={data} />;
}
```

---

### Approved Pattern 2: Custom Hooks with Service Layer

```typescript
// src/hooks/useProfile.ts
import { getProfile } from '@/services/api/profile.service';

export function useProfile(userId: string) {
  const query = useQuery(
    ['profile', userId],
    () => getProfile(userId)
  );
  return query;
}

// src/pages/ProfilePage.tsx
export function ProfilePage() {
  const { data } = useProfile(userId);
  return <Profile data={data} />;
}
```

---

### Approved Pattern 3: Service with Error Handling

```typescript
// src/services/api/company.service.ts
export async function searchCompanies(query: string) {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select()
      .ilike('name', `%${query}%`)
      .limit(10);

    if (error) {
      console.error('[Company Service]', error);
      return [];
    }

    return data;
  } catch (err) {
    console.error('[Company Service] Unexpected error:', err);
    return [];
  }
}

// src/components/CompanySearch.tsx
import { searchCompanies } from '@/services/api/company.service';

export function CompanySearch() {
  const [results, setResults] = useState([]);

  const handleSearch = async (query: string) => {
    const companies = await searchCompanies(query);
    setResults(companies);
  };

  return <SearchBox onSearch={handleSearch} />;
}
```

---

## 📁 Approved Service Locations

```
✅ Allowed database access:
  src/services/
  src/services/api/
  src/services/api/supabase/
  src/core/
  src/core/audit/
  src/hooks/  (calling services only)

❌ NOT allowed:
  src/components/
  src/pages/
  src/App.tsx
  src/main.tsx
```

---

## 🔍 Enforcement Methods

### Method 1: ESLint Rule (Automatic)

```javascript
// .eslintrc.cjs
{
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "patterns": [
          {
            "group": ["@supabase/supabase-js"],
            "message": "Import only from centralized /lib/supabase or use a service"
          }
        ]
      }
    ]
  }
}
```

### Method 2: Architecture Check Script

```bash
node scripts/architecture-lock-check.mjs
```

Checks:
- ❌ No `supabase.from()` in components/pages
- ❌ No `supabase.auth` in components
- ✅ Only services use database

### Method 3: Type Safety

```typescript
// Services return typed data
export async function getUsers(): Promise<User[]> {
  // Database access here
}

// Components can only access typed service responses
const users: User[] = await getUsers();
```

---

## 🧪 Testing Pattern

```typescript
// ❌ BAD - Can't test component logic independently
export function UserList() {
  const users = supabase.from('users').select();
  return <List items={users} />;
}

// ✅ GOOD - Can mock service
export function UserList({ users }: { users: User[] }) {
  return <List items={users} />;
}

// Test with mock data
const mockUsers = [{ id: '1', name: 'Test' }];
<UserList users={mockUsers} />
```

---

## 📋 Service Layer Template

```typescript
/**
 * [Feature] Service
 * Database access layer for [feature]
 */

import { supabase } from '@/lib/supabase';
import type { [Entity] } from '@/types/[entity]';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface [Entity]Input {
  name: string;
  // ... fields
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Get [entity] by ID
 */
export async function get[Entity](id: string): Promise<[Entity] | null> {
  const { data, error } = await supabase
    .from('[table]')
    .select()
    .eq('id', id)
    .single();

  if (error) {
    console.error(`[${[Entity]} Service] Get error:`, error);
    return null;
  }

  return data;
}

/**
 * Create [entity]
 */
export async function create[Entity](input: [Entity]Input): Promise<[Entity]> {
  const { data, error } = await supabase
    .from('[table]')
    .insert([input])
    .select()
    .single();

  if (error) {
    console.error(`[${[Entity]} Service] Create error:`, error);
    throw error;
  }

  return data;
}

/**
 * Update [entity]
 */
export async function update[Entity](
  id: string,
  updates: Partial<[Entity]Input>
): Promise<[Entity]> {
  const { data, error } = await supabase
    .from('[table]')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error(`[${[Entity]} Service] Update error:`, error);
    throw error;
  }

  return data;
}

/**
 * Delete [entity]
 */
export async function delete[Entity](id: string): Promise<void> {
  const { error } = await supabase
    .from('[table]')
    .delete()
    .eq('id', id);

  if (error) {
    console.error(`[${[Entity]} Service] Delete error:`, error);
    throw error;
  }
}
```

---

## 🚨 Violation Penalties

| Violation | Detection | Penalty |
|-----------|-----------|---------|
| `supabase.from()` in component | ESLint + Architecture check | Build failure |
| `supabase.auth` in component | ESLint + Architecture check | Build failure |
| Direct database import in page | ESLint | Build failure |
| Service layer bypass | Code review | Rejection + learning |

---

## 📊 Compliance Metrics

```
Service Layer Compliance Checklist:
  ✅ 100% of database access in /services
  ✅ 0 ESLint violations for direct DB access
  ✅ All components receive typed props
  ✅ All services have error handling
  ✅ All services have TypeScript types
```

---

## 🔗 Related Documents

- `ARCHITECTURE_RLS_LOCK.md` - RLS security guarantees
- `src/lib/supabase.ts` - Centralized client (locked)
- `scripts/architecture-lock-check.mjs` - Automated enforcement
- `PHASE_31.5_COMPLETION_REPORT.md` - Hardening completion

---

**STATUS: LOCKED UNTIL PHASE 33**

This architectural pattern is immutable and required for Phase 32 scale-out.

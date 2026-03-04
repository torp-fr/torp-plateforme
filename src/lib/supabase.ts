/**
 * Supabase Client Configuration
 * Centralized Supabase client instance
 *
 * ⚠️  ARCHITECTURE LOCKDOWN (PHASE 31.6)
 *
 * This is the ONLY Supabase client instantiation allowed in the entire codebase.
 *
 * CRITICAL RULE:
 *   Do NOT create another createClient() anywhere else.
 *   All database access MUST import this instance: import { supabase } from '@/lib/supabase'
 *
 * ENFORCEMENT:
 *   • Automated audit: scripts/architecture-lock-check.mjs
 *   • ESLint rule: no-restricted-imports (blocks @supabase/supabase-js)
 *   • Pre-commit hook: Verifies no duplicate createClient() in codebase
 *
 * VIOLATION IMPACT:
 *   Creating a duplicate client causes:
 *   ❌ Session state inconsistency
 *   ❌ Connection pool duplication
 *   ❌ Memory leaks
 *   ❌ Auth context loss
 *   ❌ Real-time subscription conflicts
 *
 * If you need to use Supabase, import from here. Period.
 *
 * INITIALIZATION:
 *   The client is initialized LAZILY on first access (not at module import time).
 *   This allows Node.js scripts (batch ingestion, migrations) to load the module
 *   before environment variables are available, and to supply credentials via
 *   dotenv at startup.
 *
 *   Credential resolution order:
 *     URL  : VITE_SUPABASE_URL → SUPABASE_URL
 *     KEY  : SUPABASE_SERVICE_ROLE_KEY → VITE_SUPABASE_ANON_KEY
 *
 *   Batch / server scripts should set SUPABASE_SERVICE_ROLE_KEY so they can
 *   invoke Edge Functions and write to DB without a user session.
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { env } from '@/config/env';

// ---------------------------------------------------------------------------
// Lazy singleton
// ---------------------------------------------------------------------------

let _supabase: ReturnType<typeof createClient<Database>> | null = null;

/**
 * Returns the shared Supabase client, creating it on first call.
 *
 * Credential resolution (first non-empty value wins):
 *   URL : import.meta.env.VITE_SUPABASE_URL → process.env.VITE_SUPABASE_URL → process.env.SUPABASE_URL
 *   KEY : process.env.SUPABASE_SERVICE_ROLE_KEY → import.meta.env.VITE_SUPABASE_ANON_KEY → process.env.VITE_SUPABASE_ANON_KEY
 *
 * Throws with a clear message if the URL or key is missing, so callers fail
 * fast with an actionable error rather than a cryptic network failure later.
 */
export function getSupabase(): ReturnType<typeof createClient<Database>> {
  if (!_supabase) {
    // Safe accessor for Vite env (undefined in Node.js / tsx context)
    const _metaEnv = (import.meta.env ?? {}) as Record<string, string | undefined>;

    const url =
      _metaEnv.VITE_SUPABASE_URL ??
      process.env.VITE_SUPABASE_URL ??
      process.env.SUPABASE_URL ??
      '';

    // Prefer the service role key (batch scripts / server) over the anon key (browser).
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      _metaEnv.VITE_SUPABASE_ANON_KEY ??
      process.env.VITE_SUPABASE_ANON_KEY ??
      '';

    if (!url) {
      throw new Error(
        '[Supabase] Missing Supabase URL.\n' +
        'Set VITE_SUPABASE_URL (or SUPABASE_URL) in .env.local before running this script.\n' +
        'Get the value from: Supabase Dashboard → Project → Settings → API → Project URL'
      );
    }

    if (!key) {
      throw new Error(
        '[Supabase] Missing Supabase credentials.\n' +
        'For batch / server scripts : set SUPABASE_SERVICE_ROLE_KEY in .env.local\n' +
        'For browser / frontend     : set VITE_SUPABASE_ANON_KEY in .env.local\n' +
        'Get the values from: Supabase Dashboard → Project → Settings → API'
      );
    }

    _supabase = createClient<Database>(url, key, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
      global: {
        headers: {
          'x-application-name': 'torp-web-app',
        },
      },
    });
  }

  return _supabase;
}

// ---------------------------------------------------------------------------
// Backward-compatible `supabase` export
//
// All existing callers that do `import { supabase } from '@/lib/supabase'`
// continue to work without changes.  The Proxy defers the `getSupabase()`
// call (and thus `createClient()`) until the first property access, which
// happens well after dotenv has loaded the environment variables.
// ---------------------------------------------------------------------------

type SupabaseClient = ReturnType<typeof createClient<Database>>;

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop: string | symbol) {
    const client = getSupabase();
    const val = (client as unknown as Record<string | symbol, unknown>)[prop];
    // Bind methods so `this` inside Supabase SDK code resolves correctly.
    return typeof val === 'function' ? (val as (...a: unknown[]) => unknown).bind(client) : val;
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if Supabase is fully configured and mock mode is off.
 */
export const isSupabaseConfigured = (): boolean => {
  const _metaEnv = (import.meta.env ?? {}) as Record<string, string | undefined>;
  const url = _metaEnv.VITE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    _metaEnv.VITE_SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY ??
    '';
  return Boolean(url && key && !env.api.useMock);
};

/**
 * Get current authenticated user
 */
export const getCurrentUser = async () => {
  const { data: { user }, error } = await getSupabase().auth.getUser();
  if (error) throw error;
  return user;
};

/**
 * Get current session
 */
export const getSession = async () => {
  const { data: { session }, error } = await getSupabase().auth.getSession();
  if (error) throw error;
  return session;
};

/**
 * Sign out
 */
export const signOut = async () => {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw error;
};

/**
 * Upload file to Supabase Storage
 */
export const uploadFile = async (
  bucket: string,
  path: string,
  file: File,
  options?: { upsert?: boolean }
) => {
  const { data, error } = await getSupabase().storage
    .from(bucket)
    .upload(path, file, options);

  if (error) throw error;
  return data;
};

/**
 * Get public URL for a file
 */
export const getPublicUrl = (bucket: string, path: string) => {
  const { data } = getSupabase().storage
    .from(bucket)
    .getPublicUrl(path);

  return data.publicUrl;
};

/**
 * Get signed URL for a private file (expires after 1 hour by default)
 */
export const getSignedUrl = async (
  bucket: string,
  path: string,
  expiresIn: number = 3600
) => {
  const { data, error } = await getSupabase().storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) throw error;
  return data.signedUrl;
};

/**
 * Delete file from storage
 */
export const deleteFile = async (bucket: string, path: string) => {
  const { error } = await getSupabase().storage
    .from(bucket)
    .remove([path]);

  if (error) throw error;
};

/**
 * Real-time subscription helper
 */
export const subscribeToTable = <T = unknown>(
  table: string,
  callback: (payload: T) => void,
  filter?: string
) => {
  const client = getSupabase();
  const channel = client
    .channel(`${table}_changes`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter,
      },
      (payload) => callback(payload.new as T)
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
};

export default supabase;

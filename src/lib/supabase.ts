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
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { env } from '@/config/env';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

// Get Supabase credentials from environment
const supabaseUrl = env.app.env === 'production'
  ? import.meta.env.VITE_SUPABASE_URL
  : import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321';

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

log('[Supabase Config] URL:', supabaseUrl);
log('[Supabase Config] Key exists:', !!supabaseAnonKey);
log('[Supabase Config] Key length:', supabaseAnonKey ? supabaseAnonKey.length : 0);
log('[Supabase Config] env.app.env:', env.app.env);
log('[Supabase Config] env.api.useMock:', env.api.useMock);

if (!supabaseUrl || !supabaseAnonKey) {
  warn(
    '⚠️  Supabase credentials not found. Using mock services.\n' +
    'To use real Supabase, set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env'
  );
}

// DEBUG: Detect duplicate Supabase client instantiation
if (!supabaseUrl) {
  console.error('🔥 CRITICAL: supabaseUrl is EMPTY - This indicates a duplicate Supabase client initialization outside /src/lib/supabase.ts');
}

/**
 * Supabase client instance
 * Typed with Database schema for full TypeScript support
 */
let _supabase: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabase() {
  if (!_supabase) {
    // DEBUG GLOBAL COUNTER
    // @ts-ignore
    window.__SUPABASE_INIT_COUNT = (window.__SUPABASE_INIT_COUNT || 0) + 1;

    _supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
      },
      global: {
        headers: {
          'x-application-name': 'torp-web-app',
        },
      },
    });

    log('🔥 SUPABASE INIT COUNT =', window.__SUPABASE_INIT_COUNT);
  }

  return _supabase;
}

export const supabase = getSupabase();

// DEBUG: Verify supabase client URL for Edge Function invoke debugging
log('[SUPABASE CLIENT INIT]', {
  supabaseUrl,
  hasAnonKey: !!supabaseAnonKey,
  clientUrl: supabase.supabaseUrl,
});

/**
 * Check if Supabase is configured
 */
export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabaseAnonKey && !env.api.useMock);
};

/**
 * Get current authenticated user
 */
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
};

/**
 * Get current session
 */
export const getSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
};

/**
 * Sign out
 */
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
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
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, options);

  if (error) throw error;
  return data;
};

/**
 * Get public URL for a file
 */
export const getPublicUrl = (bucket: string, path: string) => {
  const { data } = supabase.storage
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
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) throw error;
  return data.signedUrl;
};

/**
 * Delete file from storage
 */
export const deleteFile = async (bucket: string, path: string) => {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  if (error) throw error;
};

/**
 * Real-time subscription helper
 */
export const subscribeToTable = <T = any>(
  table: string,
  callback: (payload: T) => void,
  filter?: string
) => {
  const channel = supabase
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
    supabase.removeChannel(channel);
  };
};

export default supabase;

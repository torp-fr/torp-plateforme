/**
 * Server-side Supabase client for Vercel serverless functions.
 *
 * Uses process.env exclusively (no import.meta.env — Vite is not available here).
 * Prefers SUPABASE_SERVICE_ROLE_KEY for full DB access without RLS restrictions.
 *
 * This is intentionally separate from src/lib/supabase.ts which is a browser
 * singleton. Serverless functions are stateless Node.js processes that require
 * their own client instance per invocation.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type ServerSupabaseClient = SupabaseClient;

/**
 * Returns a Supabase client configured for server-side use.
 * Call once per request — serverless functions are stateless.
 */
export function getServerSupabase(): ServerSupabaseClient {
  const url =
    process.env.SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    '';

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY ??
    '';

  if (!url) {
    throw new Error(
      '[api/_lib/supabase] Missing Supabase URL. Set SUPABASE_URL in Vercel environment variables.'
    );
  }

  if (!key) {
    throw new Error(
      '[api/_lib/supabase] Missing Supabase key. Set SUPABASE_SERVICE_ROLE_KEY (preferred) or VITE_SUPABASE_ANON_KEY in Vercel environment variables.'
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

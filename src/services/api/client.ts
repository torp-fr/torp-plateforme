/**
 * Centralized API Client Wrapper
 * Provides a consistent interface for frontend API calls.
 * Automatically attaches the Supabase JWT as Bearer token on every request.
 */

import { supabase } from '@/lib/supabase';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

export async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: await getAuthHeaders() });
  if (!response.ok) {
    throw new Error(`API GET failed: ${response.status}`);
  }
  const result = await response.json();
  return result.data;
}

export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`API POST failed: ${response.status}`);
  }
  const result = await response.json();
  return result.data;
}

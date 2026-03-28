/**
 * Admin Settings API Service
 * Handles GET/PUT /api/v1/admin/settings with JWT auth
 * Uses Supabase session token — no localStorage dependency
 */

import { supabase } from '@/lib/supabase';

async function getAuthHeader(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('No active session');
  return `Bearer ${session.access_token}`;
}

export const adminSettingsService = {
  async getSettings(): Promise<Record<string, unknown>> {
    const authorization = await getAuthHeader();
    const res = await fetch('/api/v1/admin/settings', {
      headers: { Authorization: authorization },
    });
    if (res.status === 401) {
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }
    const json = await res.json();
    if (!json.success) throw new Error(json.error ?? 'Failed to load settings');
    return json.data as Record<string, unknown>;
  },

  async updateSettings(updates: Record<string, unknown>): Promise<Record<string, unknown>> {
    const authorization = await getAuthHeader();
    const res = await fetch('/api/v1/admin/settings', {
      method: 'PUT',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
    if (res.status === 401) {
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }
    const json = await res.json();
    if (!json.success) throw new Error(json.error ?? 'Failed to update settings');
    return json.data as Record<string, unknown>;
  },
};

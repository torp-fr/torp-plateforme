/**
 * useUserRole Hook (Phase 30.1)
 * Centralized source of truth for user role from Supabase
 * Ensures admin@admin.com and other admins are properly identified
 */

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { createClient } from '@supabase/supabase-js';

export type UserRole = 'user' | 'admin' | 'super_admin';

interface UseUserRoleReturn {
  role: UserRole;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * Get Supabase client
 */
function getSupabaseClient() {
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Fetch user role from Supabase profiles table
 */
async function fetchUserRoleFromProfiles(userId: string): Promise<UserRole | null> {
  try {
    console.log('[useUserRole] Fetching role for user:', userId);

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error) {
      console.warn('[useUserRole] Failed to fetch profile:', error);
      return null;
    }

    const role = (data?.role || 'user') as UserRole;
    console.log('[useUserRole] Role fetched:', role);

    return role;
  } catch (error) {
    console.error('[useUserRole] Error fetching role:', error);
    return null;
  }
}

/**
 * Fetch user role from Supabase auth metadata (alternative source)
 */
async function fetchUserRoleFromAuthMetadata(userId: string): Promise<UserRole | null> {
  try {
    console.log('[useUserRole] Checking auth metadata for:', userId);

    const supabase = getSupabaseClient();

    // Get auth metadata
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    // Check custom claims in user metadata
    const role = (user.user_metadata?.role || 'user') as UserRole;
    console.log('[useUserRole] Role from auth metadata:', role);

    return role;
  } catch (error) {
    console.error('[useUserRole] Error fetching auth metadata:', error);
    return null;
  }
}

/**
 * Determine role from email (hardcoded admins - should be migrated to Supabase)
 * DEPRECATED: Use profiles table instead
 */
function getRoleFromEmail(email: string): UserRole | null {
  const adminEmails = ['admin@admin.com', 'admin@torp.fr', 'super@torp.fr'];

  if (adminEmails.includes(email)) {
    console.warn('[useUserRole] Using deprecated email-based role detection');
    return 'admin';
  }

  return null;
}

/**
 * Main hook: Get current user's role
 * Priority: Supabase profiles > Auth metadata > Email fallback
 */
export function useUserRole(): UseUserRoleReturn {
  const { user } = useApp();
  const [role, setRole] = useState<UserRole>('user');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setRole('user');
      setLoading(false);
      return;
    }

    // If role is already in user object, use it
    if (user.role && ['admin', 'super_admin', 'user'].includes(user.role)) {
      setRole(user.role as UserRole);
      setLoading(false);
      return;
    }

    // Otherwise, fetch from Supabase
    (async () => {
      try {
        // Try profiles table first
        let fetchedRole = await fetchUserRoleFromProfiles(user.id);

        // Fall back to auth metadata
        if (!fetchedRole) {
          fetchedRole = await fetchUserRoleFromAuthMetadata(user.id);
        }

        // Fall back to email detection (deprecated)
        if (!fetchedRole && user.email) {
          fetchedRole = getRoleFromEmail(user.email);
        }

        // Default to user role
        setRole(fetchedRole || 'user');
        console.log('[useUserRole] Final role:', fetchedRole || 'user');
      } catch (err) {
        console.error('[useUserRole] Error determining role:', err);
        setError(err instanceof Error ? err.message : 'Failed to determine role');
        setRole('user');
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id, user?.role, user?.email]);

  return {
    role,
    isAdmin: role === 'admin' || role === 'super_admin',
    isSuperAdmin: role === 'super_admin',
    loading,
    error,
  };
}

export default useUserRole;

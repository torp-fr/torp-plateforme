/**
 * Admin API Service
 * Handles admin initialization and user role management
 */

import { supabase } from '@/lib/supabase';

/**
 * Check if system has an admin
 */
export async function checkAdminStatus() {
  try {
    const { data, error } = await supabase.rpc('get_admin_status');

    if (error) {
      console.error('[Admin Status] Error:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[Admin Status] Exception:', error);
    return null;
  }
}

/**
 * Promote first user to admin
 */
export async function promoteFirstAdmin(email: string) {
  try {
    // Check if admin already exists
    const adminStatus = await checkAdminStatus();
    if (adminStatus && !adminStatus.can_create_admin) {
      return {
        success: false,
        error: 'Admin already exists. Contact existing admin to manage roles.',
      };
    }

    // Promote user to admin via RPC
    const { data, error } = await supabase.rpc('promote_user_to_admin', {
      user_email: email,
    });

    if (error) {
      console.error('[Promote Admin] Error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log('[Promote Admin] Success:', data);
    return data;
  } catch (error) {
    console.error('[Promote Admin] Exception:', error);
    return {
      success: false,
      error: String(error),
    };
  }
}

/**
 * Get current user's admin status
 */
export async function getCurrentUserAdminStatus() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.log('[User Admin Status] No authenticated user');
      return null;
    }

    // Fetch user profile with role info from profiles table
    const { data: userData, error: dataError } = await supabase
      .from('profiles')
      .select('id, email, role, is_admin, can_upload_kb')
      .eq('id', user.id)
      .single();

    if (dataError) {
      console.warn('[User Admin Status] Error fetching user:', dataError);
      return null;
    }

    return {
      isAdmin: userData.is_admin || false,
      role: userData.role || 'user',
      canUploadKb: userData.can_upload_kb || false,
    };
  } catch (error) {
    console.error('[User Admin Status] Exception:', error);
    return null;
  }
}

/**
 * List all users and their roles
 */
export async function listUsersWithRoles() {
  try {
    const adminStatus = await getCurrentUserAdminStatus();

    if (!adminStatus?.isAdmin) {
      return {
        success: false,
        error: 'Only admins can view user list',
        data: null,
      };
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name as name, role, is_admin, can_upload_kb, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[List Users] Error:', error);
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }

    return {
      success: true,
      data: data || [],
    };
  } catch (error) {
    console.error('[List Users] Exception:', error);
    return {
      success: false,
      error: String(error),
      data: null,
    };
  }
}

/**
 * Update user role
 */
export async function updateUserRole(userId: string, newRole: 'user' | 'admin' | 'super_admin') {
  try {
    const adminStatus = await getCurrentUserAdminStatus();

    if (!adminStatus?.isAdmin) {
      return {
        success: false,
        error: 'Only admins can modify user roles',
      };
    }

    const isAdmin = newRole === 'admin' || newRole === 'super_admin';

    const { data, error } = await supabase
      .from('profiles')
      .update({
        role: newRole,
        is_admin: isAdmin,
        can_upload_kb: isAdmin,
        updated_role_date: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('[Update Role] Error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    // profiles table is now the source of truth, no syncing needed

    return {
      success: true,
      data: data,
    };
  } catch (error) {
    console.error('[Update Role] Exception:', error);
    return {
      success: false,
      error: String(error),
    };
  }
}

/**
 * Admin Service
 * Manages user roles and admin functions
 */

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';

type DbProfile = Database['public']['Tables']['profiles']['Row'];

export interface AdminUser {
  id: string;
  email: string;
  full_name?: string;
  role: 'user' | 'admin' | 'super_admin';
  is_admin: boolean;
  can_upload_kb: boolean;
  created_at: string;
  updated_role_date?: string;
}

export class AdminService {
  /**
   * Get all users (admin only)
   */
  async getAllUsers(): Promise<AdminUser[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, is_admin, can_upload_kb, created_at, updated_role_date')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[AdminService] Error fetching users:', error);
      throw error;
    }

    return data as AdminUser[];
  }

  /**
   * Get single user details
   */
  async getUser(userId: string): Promise<AdminUser | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, is_admin, can_upload_kb, created_at, updated_role_date')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[AdminService] Error fetching user:', error);
      return null;
    }

    return data as AdminUser;
  }

  /**
   * Promote user to admin
   */
  async promoteToAdmin(userId: string): Promise<boolean> {
    try {
      // Call the Supabase function
      const { error } = await supabase.rpc('promote_user_to_admin', {
        user_id: userId,
      });

      if (error) {
        console.error('[AdminService] Error promoting user:', error);
        return false;
      }

      console.log('[AdminService] User promoted to admin:', userId);
      return true;
    } catch (error) {
      console.error('[AdminService] Exception promoting user:', error);
      return false;
    }
  }

  /**
   * Demote admin to user
   */
  async demoteToUser(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('demote_admin_to_user', {
        user_id: userId,
      });

      if (error) {
        console.error('[AdminService] Error demoting admin:', error);
        return false;
      }

      console.log('[AdminService] Admin demoted to user:', userId);
      return true;
    } catch (error) {
      console.error('[AdminService] Exception demoting admin:', error);
      return false;
    }
  }

  /**
   * Check if user is admin
   */
  async isUserAdmin(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('is_user_admin', {
        user_id: userId,
      });

      if (error) {
        console.error('[AdminService] Error checking admin status:', error);
        return false;
      }

      return data as boolean;
    } catch (error) {
      console.error('[AdminService] Exception checking admin status:', error);
      return false;
    }
  }

  /**
   * Get audit log
   */
  async getAuditLog(limit: number = 100): Promise<any[]> {
    const { data, error } = await supabase
      .from('admin_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[AdminService] Error fetching audit log:', error);
      return [];
    }

    return data || [];
  }
}

export const adminService = new AdminService();

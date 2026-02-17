/**
 * Supabase Auth Service
 * Real authentication using Supabase Auth + Profiles
 *
 * CRITICAL: Uses profiles table, NOT deleted users table
 */

import { supabase } from '@/lib/supabase';
import { User, UserType } from '@/context/AppContext';
import type { Database } from '@/types/supabase';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  type: UserType;
  company?: string;
  phone?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken?: string;
}

type DbProfile = Database['public']['Tables']['profiles']['Row'];

/**
 * Convert Supabase profile to app User format
 */
function mapDbProfileToAppUser(profile: DbProfile): User {
  return {
    id: profile.id,
    email: profile.email,
    name: profile.full_name || undefined,
    type: 'B2C', // Default type (B2B determined by company fields)
    isAdmin: profile.role === 'admin' || profile.role === 'super_admin',
    role: profile.role || 'user',
    canUploadKb: profile.can_upload_kb || false,
    phone: profile.phone || undefined,
    city: profile.city || undefined,
    postal_code: profile.postal_code || undefined,
    company: profile.company_name || undefined,
    company_siret: profile.company_siret || undefined,
  };
}

export class SupabaseAuthService {
  /**
   * Login with email and password
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    // Validate input
    if (!credentials.email || !credentials.password) {
      throw new Error('Email and password are required');
    }

    // Sign in with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (authError) {
      throw new Error(authError.message);
    }

    if (!authData.user) {
      throw new Error('Authentication failed');
    }

    // Fetch user profile from profiles table
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      console.error('[Login] Profile load error:', profileError);
      throw new Error('Failed to load user profile');
    }

    if (!profileData) {
      throw new Error('User profile not found');
    }

    const mappedUser = mapDbProfileToAppUser(profileData);
    console.log('✓ Login successful:', mappedUser.email, '- Admin:', mappedUser.isAdmin, '- Role:', mappedUser.role);

    return {
      user: mappedUser,
      token: authData.session?.access_token || '',
      refreshToken: authData.session?.refresh_token,
    };
  }

  /**
   * Register new user
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    // Validate input
    if (!data.email || !data.password || !data.name) {
      throw new Error('Email, password and name are required');
    }

    if (data.password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Create auth user (profile will be created automatically by database trigger)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          name: data.name,
          user_type: data.type,
          company: data.company,
          phone: data.phone,
        },
      },
    });

    if (authError) {
      throw new Error(authError.message);
    }

    if (!authData.user) {
      throw new Error('Registration failed');
    }

    // Create user profile using RPC function
    const { data: profileData, error: profileError } = await supabase.rpc('create_user_profile', {
      p_user_id: authData.user.id,
      p_email: data.email,
      p_name: data.name,
      p_user_type: data.type,
      p_company: data.company || null,
      p_phone: data.phone || null,
    });

    if (profileError || !profileData) {
      console.error('Failed to create user profile after registration:', profileError);
      throw new Error('Failed to create user profile');
    }

    const mappedUser = mapDbProfileToAppUser(profileData as DbProfile);

    return {
      user: mappedUser,
      token: authData.session?.access_token || '',
      refreshToken: authData.session?.refresh_token,
    };
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Get current user from profiles table
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      // Get current session
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

      if (authError) {
        console.error('[getCurrentUser] Auth error:', authError);
        return null;
      }

      if (!authUser) {
        console.log('[getCurrentUser] No auth user found');
        return null;
      }

      console.log('[getCurrentUser] Auth user found:', authUser.email);

      // Fetch user profile from profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profileError) {
        console.error('[getCurrentUser] Profile load error:', profileError);
        throw new Error('Failed to load user profile');
      }

      if (!profileData) {
        throw new Error('User profile not found');
      }

      const mappedUser = mapDbProfileToAppUser(profileData);
      console.log('[getCurrentUser] Profile loaded:', mappedUser.email, '- Admin:', mappedUser.isAdmin, '- Role:', mappedUser.role);
      return mappedUser;
    } catch (error) {
      console.error('[getCurrentUser] Exception:', error);
      return null;
    }
  }

  /**
   * Refresh auth token
   */
  async refreshToken(refreshToken: string): Promise<{ token: string }> {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.session?.access_token) {
      throw new Error('Failed to refresh token');
    }

    return {
      token: data.session.access_token,
    };
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<{ success: boolean }> {
    if (!email) {
      throw new Error('Email is required');
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      throw new Error(error.message);
    }

    return { success: true };
  }

  /**
   * Reset password
   */
  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean }> {
    if (!token || !newPassword) {
      throw new Error('Token and new password are required');
    }

    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      throw new Error(error.message);
    }

    return { success: true };
  }

  /**
   * Verify email
   */
  async verifyEmail(token: string): Promise<{ success: boolean }> {
    // Note: Supabase handles email verification automatically via magic links
    // This method is kept for API compatibility but may not be needed
    // The actual verification happens when user clicks the link in their email

    return { success: true };
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updates: Partial<DbProfile>): Promise<User> {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update profile: ${error.message}`);
    }

    return mapDbProfileToAppUser(data);
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (user: User | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth State Change] Event:', event, 'Session:', !!session);

      if (session?.user) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (error) {
            console.error('[Auth State Change] Error fetching user profile:', error);
            throw new Error('Failed to load user profile');
          }

          if (data) {
            const mappedUser = mapDbProfileToAppUser(data);
            console.log('[Auth State Change] User profile loaded:', mappedUser.email);
            callback(mappedUser);
          } else {
            // Profile doesn't exist - create temporary user from auth metadata
            const tempUser: User = {
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata?.name || 'User',
              type: (session.user.user_metadata?.user_type as UserType) || 'B2C',
              company: session.user.user_metadata?.company,
              phone: session.user.user_metadata?.phone,
            };
            console.log('[Auth State Change] No profile found, using temporary user:', tempUser.email);
            callback(tempUser);
          }
        } catch (error) {
          console.error('[Auth State Change] Exception:', error);
          // Fallback: create temporary user from auth data instead of disconnecting
          const tempUser: User = {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || 'User',
            type: (session.user.user_metadata?.user_type as UserType) || 'B2C',
            company: session.user.user_metadata?.company,
            phone: session.user.user_metadata?.phone,
          };
          console.log('[Auth State Change] Error occurred, using temporary user:', tempUser.email);
          callback(tempUser);
        }
      } else {
        console.log('[Auth State Change] No session, calling callback with null');
        callback(null);
      }
    });
  }
}

export const authService = new SupabaseAuthService();
export default authService;

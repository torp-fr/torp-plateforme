/**
 * Supabase Auth Service
 * Real authentication using Supabase Auth
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

type DbUser = Database['public']['Tables']['users']['Row'];

/**
 * Convert Supabase user to app User format with all profile fields
 */
function mapDbUserToAppUser(dbUser: DbUser): User {
  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name || undefined,
    type: dbUser.user_type,
    phone: dbUser.phone || undefined,
    city: (dbUser as Record<string, unknown>).city as string || undefined,
    postal_code: (dbUser as Record<string, unknown>).postal_code as string || undefined,
    // B2C
    company: dbUser.company || undefined,
    property_type: (dbUser as Record<string, unknown>).property_type as string || undefined,
    property_surface: (dbUser as Record<string, unknown>).property_surface as number || undefined,
    property_year: (dbUser as Record<string, unknown>).property_year as number || undefined,
    property_rooms: (dbUser as Record<string, unknown>).property_rooms as number || undefined,
    property_address: (dbUser as Record<string, unknown>).property_address as string || undefined,
    property_energy_class: (dbUser as Record<string, unknown>).property_energy_class as string || undefined,
    is_owner: (dbUser as Record<string, unknown>).is_owner as boolean ?? undefined,
    // B2B
    company_siret: (dbUser as Record<string, unknown>).company_siret as string || undefined,
    company_activity: (dbUser as Record<string, unknown>).company_activity as string || undefined,
    company_size: (dbUser as Record<string, unknown>).company_size as string || undefined,
    company_role: (dbUser as Record<string, unknown>).company_role as string || undefined,
    company_address: (dbUser as Record<string, unknown>).company_address as string || undefined,
    company_code_ape: (dbUser as Record<string, unknown>).company_code_ape as string || undefined,
    company_rcs: (dbUser as Record<string, unknown>).company_rcs as string || undefined,
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

    // Fetch user profile from users table (all columns for profile pre-fill)
    // If no profile exists yet, create a basic user object from auth data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    let mappedUser: User;

    if (userError || !userData) {
      // User profile doesn't exist yet, create basic user from auth data
      console.warn('User profile not found, creating from auth data:', authData.user.email);
      mappedUser = {
        id: authData.user.id,
        email: authData.user.email || '',
        name: authData.user.user_metadata?.name || undefined,
        type: (authData.user.user_metadata?.user_type as UserType) || 'B2C',
      };
    } else {
      mappedUser = mapDbUserToAppUser(userData);
    }

    console.log('✓ Login réussi:', mappedUser.email, '- Type:', mappedUser.type);

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

    // Create user profile using RPC function (bypasses RLS timing issues)
    // This works even without an active session, which is the case when email confirmation is required
    const { data: userData, error: userError } = await supabase.rpc('create_user_profile', {
      p_user_id: authData.user.id,
      p_email: data.email,
      p_name: data.name,
      p_user_type: data.type,
      p_company: data.company || null,
      p_phone: data.phone || null,
    });

    if (userError || !userData) {
      console.error('Failed to create user profile after registration:', userError);
      // Fallback: return a basic user object based on auth data
      const user = {
        id: authData.user.id,
        email: data.email,
        name: data.name,
        type: data.type,
        company: data.company,
        phone: data.phone,
      };

      return {
        user,
        token: authData.session?.access_token || '',
        refreshToken: authData.session?.refresh_token,
      };
    }

    // RPC now returns JSONB object directly (not an array)
    const mappedUser = mapDbUserToAppUser(userData as DbUser);

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
   * Get current user
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

      // Fetch user profile (all columns for profile pre-fill)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (userError) {
        console.error('[getCurrentUser] Error fetching user profile:', userError);
        return null;
      }

      if (!userData) {
        console.warn('[getCurrentUser] No user profile found for auth user');
        return null;
      }

      const mappedUser = mapDbUserToAppUser(userData);
      console.log('[getCurrentUser] User profile loaded:', mappedUser.email, 'Type:', mappedUser.type);
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
  async updateProfile(userId: string, updates: Partial<DbUser>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update profile: ${error.message}`);
    }

    return mapDbUserToAppUser(data);
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
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          if (error) {
            console.warn('[Auth State Change] Error fetching user profile:', error);
            // If profile doesn't exist yet, create temporary user from auth data
            // This handles newly registered users waiting for profile creation
            const tempUser: User = {
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata?.name || 'User',
              type: (session.user.user_metadata?.user_type as UserType) || 'B2C',
              company: session.user.user_metadata?.company,
              phone: session.user.user_metadata?.phone,
            };
            console.log('[Auth State Change] Using temporary user profile:', tempUser.email);
            callback(tempUser);
            return;
          }

          if (data) {
            const mappedUser = mapDbUserToAppUser(data);
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

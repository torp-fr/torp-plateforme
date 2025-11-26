/**
 * Supabase Auth Service
 * Real authentication using Supabase Auth
 */

import { supabase } from '@/lib/supabase';
import { User, UserType } from '@/context/AppContext';
import type { Database } from '@/types/supabase';
import { analyticsService } from '@/services/analytics/analyticsService';

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
 * Convert Supabase user to app User format
 */
function mapDbUserToAppUser(dbUser: DbUser): User {
  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name || undefined,
    type: dbUser.user_type,
    company: dbUser.company || undefined,
    phone: dbUser.phone || undefined,
    avatarUrl: dbUser.avatar_url || undefined,
    subscriptionPlan: dbUser.subscription_plan || undefined,
    subscriptionStatus: dbUser.subscription_status || undefined,
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

    // Fetch user profile from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (userError) {
      throw new Error('Failed to fetch user profile');
    }

    const mappedUser = mapDbUserToAppUser(userData);

    // Track login event
    try {
      await analyticsService.trackLogin(mappedUser.type === 'admin' ? 'B2C' : mappedUser.type);
    } catch (trackError) {
      console.warn('Failed to track login event:', trackError);
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

    // Wait a moment for the trigger to create the profile
    await new Promise(resolve => setTimeout(resolve, 500));

    // Fetch the created profile (created automatically by database trigger)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (userError) {
      console.error('Failed to fetch user profile after registration:', userError);
      // Profile might not exist yet if trigger failed, but user was created
      // Return a basic user object based on auth data
      const user = {
        id: authData.user.id,
        email: data.email,
        name: data.name,
        type: data.type,
        company: data.company,
        phone: data.phone,
      };

      // Track signup event
      await analyticsService.trackSignup(data.type === 'admin' ? 'B2C' : data.type);

      return {
        user,
        token: authData.session?.access_token || '',
        refreshToken: authData.session?.refresh_token,
      };
    }

    const mappedUser = mapDbUserToAppUser(userData);

    // Track signup event
    await analyticsService.trackSignup(mappedUser.type === 'admin' ? 'B2C' : mappedUser.type);

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

      // Fetch user profile
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
            .single();

          if (error) {
            console.error('[Auth State Change] Error fetching user profile:', error);
            callback(null);
            return;
          }

          if (data) {
            const mappedUser = mapDbUserToAppUser(data);
            console.log('[Auth State Change] User profile loaded:', mappedUser.email);
            callback(mappedUser);
          } else {
            console.warn('[Auth State Change] No user profile found for session');
            callback(null);
          }
        } catch (error) {
          console.error('[Auth State Change] Exception:', error);
          callback(null);
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

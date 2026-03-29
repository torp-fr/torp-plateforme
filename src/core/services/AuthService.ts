// ─────────────────────────────────────────────────────────────────────────────
// AuthService — Phase 3B Jalon 1
// Thin wrapper over Supabase auth operations. All methods use the service-role
// client so they bypass RLS and are safe for server-side use only.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin' | 'super_admin';
  is_admin: boolean;
  can_upload_kb: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export interface RateLimitConfig {
  user_id: string;
  requests_per_minute: number;
  requests_per_hour: number;
  requests_per_day: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class AuthService {
  private readonly admin: SupabaseClient;

  constructor() {
    if (!config.supabase.url || !config.supabase.serviceRoleKey) {
      throw new Error('[AuthService] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }
    this.admin = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  // ── Auth operations ──────────────────────────────────────────────────────

  async register(email: string, password: string, fullName: string): Promise<UserProfile> {
    const { data, error } = await this.admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // skip email verification in dev
      user_metadata: { full_name: fullName },
    });

    if (error) {
      if (error.message.includes('already registered') || error.code === 'email_exists') {
        const err = new Error('User with this email already exists');
        (err as NodeJS.ErrnoException).code = 'USER_EXISTS';
        throw err;
      }
      throw new Error(`Registration failed: ${error.message}`);
    }

    if (!data.user) throw new Error('Registration succeeded but no user returned');

    // Create profile row
    const { error: profileError } = await this.admin
      .from('profiles')
      .insert({
        id: data.user.id,
        email: data.user.email,
        full_name: fullName,
        role: 'user',
        is_admin: false,
        can_upload_kb: false,
      });

    if (profileError) {
      // Rollback: delete the auth user to keep DB consistent
      await this.admin.auth.admin.deleteUser(data.user.id);
      throw new Error(`Profile creation failed: ${profileError.message}`);
    }

    // Create default rate limits
    await this.admin.from('rate_limits').insert({
      user_id: data.user.id,
      requests_per_minute: 100,
      requests_per_hour: 1000,
      requests_per_day: 10000,
    });

    return await this.getProfile(data.user.id);
  }

  async login(email: string, password: string): Promise<AuthSession> {
    // Use anon key for signInWithPassword (respects auth policies)
    const anonClient = createClient(config.supabase.url, config.supabase.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await anonClient.auth.signInWithPassword({ email, password });

    if (error || !data.session || !data.user) {
      const err = new Error('Invalid email or password');
      (err as NodeJS.ErrnoException).code = 'INVALID_CREDENTIALS';
      throw err;
    }

    const profile = await this.getProfile(data.user.id);

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in ?? config.auth.tokenExpiry,
      user: {
        id: data.user.id,
        email: data.user.email ?? email,
        role: profile.role,
      },
    };
  }

  async refreshSession(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    const anonClient = createClient(config.supabase.url, config.supabase.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await anonClient.auth.refreshSession({ refresh_token: refreshToken });

    if (error || !data.session) {
      const err = new Error('Invalid or expired refresh token');
      (err as NodeJS.ErrnoException).code = 'INVALID_REFRESH_TOKEN';
      throw err;
    }

    return {
      accessToken: data.session.access_token,
      expiresIn: data.session.expires_in ?? config.auth.tokenExpiry,
    };
  }

  async validateToken(token: string): Promise<{ id: string; email: string } | null> {
    const { data, error } = await this.admin.auth.getUser(token);
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? '' };
  }

  // ── Profile operations ───────────────────────────────────────────────────

  async getProfile(userId: string): Promise<UserProfile> {
    const { data, error } = await this.admin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      const err = new Error('Profile not found');
      (err as NodeJS.ErrnoException).code = 'PROFILE_NOT_FOUND';
      throw err;
    }

    return data as UserProfile;
  }

  async updateProfile(userId: string, updates: Partial<Pick<UserProfile, 'full_name' | 'avatar_url'>>): Promise<UserProfile> {
    const { data, error } = await this.admin
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error || !data) throw new Error(`Profile update failed: ${error?.message}`);
    return data as UserProfile;
  }

  // ── User management (admin) ──────────────────────────────────────────────

  async deleteUser(userId: string): Promise<void> {
    const { error } = await this.admin.auth.admin.deleteUser(userId);
    if (error) throw new Error(`Delete user failed: ${error.message}`);
  }

  async listUsers(page = 1, limit = 20): Promise<{ users: UserProfile[]; total: number }> {
    const from = (page - 1) * limit;

    const { data, error, count } = await this.admin
      .from('profiles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);

    if (error) throw new Error(`List users failed: ${error.message}`);

    return {
      users: (data ?? []) as UserProfile[],
      total: count ?? 0,
    };
  }

  // ── Rate limits (admin) ──────────────────────────────────────────────────

  async getRateLimits(userId: string): Promise<RateLimitConfig | null> {
    const { data } = await this.admin
      .from('rate_limits')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    return data as RateLimitConfig | null;
  }

  async updateRateLimits(userId: string, limits: Partial<Omit<RateLimitConfig, 'user_id'>>): Promise<RateLimitConfig> {
    const { data, error } = await this.admin
      .from('rate_limits')
      .update(limits)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) throw new Error(`Rate limit update failed: ${error?.message}`);
    return data as RateLimitConfig;
  }

  async listRateLimits(): Promise<Array<RateLimitConfig & { profile: UserProfile | null }>> {
    const { data, error } = await this.admin
      .from('rate_limits')
      .select('*, profile:profiles(id, email, full_name, role)')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`List rate limits failed: ${error.message}`);
    return (data ?? []) as Array<RateLimitConfig & { profile: UserProfile | null }>;
  }

  // ── Platform settings (admin) ────────────────────────────────────────────

  static readonly SETTINGS_ID = '00000000-0000-0000-0000-000000000000';

  async getSettings(): Promise<Record<string, unknown>> {
    const { data, error } = await this.admin
      .from('platform_settings')
      .select('*')
      .eq('id', AuthService.SETTINGS_ID)
      .single();

    if (error || !data) {
      const err = new Error('Platform settings not found');
      (err as NodeJS.ErrnoException).code = 'SETTINGS_NOT_FOUND';
      throw err;
    }

    return data as Record<string, unknown>;
  }

  async updateSettings(
    updates: Record<string, unknown>,
    updatedBy: string,
  ): Promise<Record<string, unknown>> {
    const { data, error } = await this.admin
      .from('platform_settings')
      .update({ ...updates, updated_at: new Date().toISOString(), updated_by: updatedBy })
      .eq('id', AuthService.SETTINGS_ID)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Settings update failed: ${error?.message ?? 'no data returned'}`);
    }

    return data as Record<string, unknown>;
  }

  // ── Email helpers ────────────────────────────────────────────────────────

  async sendPasswordResetEmail(email: string): Promise<void> {
    const anonClient = createClient(config.supabase.url, config.supabase.anonKey);
    await anonClient.auth.resetPasswordForEmail(email);
  }
}

// Singleton — import this everywhere instead of instantiating directly
export const authService = new AuthService();

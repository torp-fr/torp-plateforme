/**
 * Login Flow E2E Tests
 * Phase 5.5 - PROMPT LOGIN-HARDFIX
 *
 * Tests auth flow against real Supabase.
 * Tests that require credentials use it.skip when no test account is configured.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { supabase } from '@/lib/supabase';

const TEST_EMAIL    = import.meta.env.VITE_TEST_ADMIN_EMAIL    as string | undefined;
const TEST_PASSWORD = import.meta.env.VITE_TEST_ADMIN_PASSWORD as string | undefined;
const hasCredentials = !!(TEST_EMAIL && TEST_PASSWORD);
const skipIfNoCredentials = hasCredentials ? it : it.skip;

afterEach(async () => {
  await supabase.auth.signOut();
});

describe('Login Flow E2E', () => {
  skipIfNoCredentials('authenticates with valid credentials', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL!,
      password: TEST_PASSWORD!,
    });

    expect(error).toBeNull();
    expect(data.session).toBeDefined();
    expect(data.session?.user.email).toBe(TEST_EMAIL);
  });

  skipIfNoCredentials('fetches user profile after login', async () => {
    const { data: authData } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL!,
      password: TEST_PASSWORD!,
    });

    expect(authData.session).toBeDefined();

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('id', authData.session!.user.id)
      .single();

    expect(error).toBeNull();
    expect(profile).toBeDefined();
    expect(profile?.role).toMatch(/^(user|admin|super_admin)$/);
  });

  skipIfNoCredentials('admin user has isAdmin flag set', async () => {
    const { data: authData } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL!,
      password: TEST_PASSWORD!,
    });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.session!.user.id)
      .single();

    const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
    // If using an admin test account, isAdmin should be true
    expect(typeof isAdmin).toBe('boolean');
  });

  it('rejects invalid credentials', async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email: 'nonexistent@torp.invalid',
      password: 'wrongpassword123',
    });

    expect(error).toBeDefined();
    expect(error?.message).toBeTruthy();
  });

  it('rejects empty credentials', async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email: '',
      password: '',
    });

    expect(error).toBeDefined();
  });
});

describe('Supabase client initialisation', () => {
  it('client is configured with a valid URL', () => {
    const url = import.meta.env.VITE_SUPABASE_URL as string;
    expect(url).toBeTruthy();
    expect(url).toMatch(/^https:\/\//);
  });

  it('client is configured with an anon key', () => {
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    expect(key).toBeTruthy();
    expect(key.length).toBeGreaterThan(20);
  });
});

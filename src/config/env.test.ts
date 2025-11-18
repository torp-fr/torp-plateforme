/**
 * Tests for environment configuration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Environment Configuration', () => {
  beforeEach(() => {
    // Reset modules before each test
    vi.resetModules();
  });

  it('should have default values for app config', async () => {
    const { env } = await import('./env');

    expect(env.app.name).toBeDefined();
    expect(env.app.env).toMatch(/development|production|test/);
    expect(env.app.version).toBeDefined();
  });

  it('should have API configuration', async () => {
    const { env } = await import('./env');

    expect(env.api.baseUrl).toBeDefined();
    expect(env.api.timeout).toBeGreaterThan(0);
    expect(typeof env.api.useMock).toBe('boolean');
  });

  it('should have auth configuration', async () => {
    const { env } = await import('./env');

    expect(env.auth.provider).toMatch(/mock|supabase|auth0|firebase/);
  });

  it('should have upload configuration', async () => {
    const { env } = await import('./env');

    expect(env.upload.maxFileSize).toBeGreaterThan(0);
    expect(Array.isArray(env.upload.allowedTypes)).toBe(true);
  });

  it('should have feature flags', async () => {
    const { env } = await import('./env');

    expect(typeof env.features.paymentEnabled).toBe('boolean');
    expect(typeof env.features.chatAIEnabled).toBe('boolean');
    expect(typeof env.features.marketplaceEnabled).toBe('boolean');
    expect(typeof env.features.analyticsEnabled).toBe('boolean');
  });
});

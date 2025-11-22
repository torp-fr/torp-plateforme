/**
 * Mock Auth Service
 * Simulates backend API for authentication
 * TODO: Replace with real auth provider (Supabase, Auth0, etc.)
 */

import { env } from '@/config/env';
import { User, UserType } from '@/context/AppContext';

const delay = (ms: number = 500) => new Promise(resolve => setTimeout(resolve, ms));

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
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken?: string;
}

export class MockAuthService {
  /**
   * Login with email and password
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    if (!env.api.useMock) {
      throw new Error('Real auth not implemented yet');
    }

    await delay(1000);

    // Mock validation
    if (!credentials.email || !credentials.password) {
      throw new Error('Email and password are required');
    }

    if (credentials.password.length < 6) {
      throw new Error('Invalid credentials');
    }

    // Mock user based on email
    const mockUser: User = {
      id: `user-${Date.now()}`,
      email: credentials.email,
      name: credentials.email.split('@')[0],
      type: credentials.email.includes('pro') ? 'B2B' : 'B2C',
      company: credentials.email.includes('pro') ? 'Mock Company' : undefined,
    };

    return {
      user: mockUser,
      token: `mock-token-${Date.now()}`,
      refreshToken: `mock-refresh-${Date.now()}`,
    };
  }

  /**
   * Register new user
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    if (!env.api.useMock) {
      throw new Error('Real auth not implemented yet');
    }

    await delay(1200);

    // Mock validation
    if (!data.email || !data.password || !data.name) {
      throw new Error('All fields are required');
    }

    if (data.password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    const mockUser: User = {
      id: `user-${Date.now()}`,
      email: data.email,
      name: data.name,
      type: data.type,
      company: data.company,
    };

    return {
      user: mockUser,
      token: `mock-token-${Date.now()}`,
      refreshToken: `mock-refresh-${Date.now()}`,
    };
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    if (!env.api.useMock) {
      throw new Error('Real auth not implemented yet');
    }

    await delay(300);
    // Clear token from storage
    localStorage.removeItem('auth_token');
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User | null> {
    if (!env.api.useMock) {
      throw new Error('Real auth not implemented yet');
    }

    await delay(500);

    // Check if we have a token
    const token = localStorage.getItem('auth_token');
    if (!token) {
      return null;
    }

    // Return mock user
    return {
      id: 'mock-user-1',
      email: 'demo@torp.app',
      name: 'Demo User',
      type: 'B2C',
    };
  }

  /**
   * Refresh auth token
   */
  async refreshToken(refreshToken: string): Promise<{ token: string }> {
    if (!env.api.useMock) {
      throw new Error('Real auth not implemented yet');
    }

    await delay(300);

    return {
      token: `mock-token-${Date.now()}`,
    };
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<{ success: boolean }> {
    if (!env.api.useMock) {
      throw new Error('Real auth not implemented yet');
    }

    await delay(800);

    if (!email) {
      throw new Error('Email is required');
    }

    return { success: true };
  }

  /**
   * Reset password
   */
  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean }> {
    if (!env.api.useMock) {
      throw new Error('Real auth not implemented yet');
    }

    await delay(800);

    if (!token || !newPassword) {
      throw new Error('Token and new password are required');
    }

    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    return { success: true };
  }

  /**
   * Verify email
   */
  async verifyEmail(token: string): Promise<{ success: boolean }> {
    if (!env.api.useMock) {
      throw new Error('Real auth not implemented yet');
    }

    await delay(500);

    return { success: true };
  }
}

export const authService = new MockAuthService();
export default authService;

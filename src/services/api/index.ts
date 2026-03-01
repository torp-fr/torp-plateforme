/**
 * API Services Index
 * Central export point for all API services with automatic mock/real switching
 */

import { env } from '@/config/env';

export { apiClient, ApiClient } from './client';
export type { ApiError, ApiResponse } from './client';

// Export external API services
export { gpuService } from './gpu.service';
export type {
  GPUZoneUrba,
  GPUPrescription,
  GPUDocument,
  GPUServitude,
  PLUAnalysisResult,
} from './gpu.service';

// Import mock services
import { MockAuthService } from './mock/auth.service';
import { MockDevisService } from './mock/devis.service';
import { MockProjectService } from './mock/project.service';

// Import Supabase services
import { SupabaseAuthService } from './supabase/auth.service';
import { SupabaseDevisService } from './supabase/devis.service';
import { SupabaseProjectService } from './supabase/project.service';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

// Re-export types
export type { LoginCredentials, RegisterData, AuthResponse } from './mock/auth.service';

/**
 * Service selection based on configuration
 * - If VITE_MOCK_API=true or VITE_AUTH_PROVIDER=mock: use mock services
 * - If VITE_AUTH_PROVIDER=supabase: use Supabase services
 */
const useMock = env.api.useMock || env.auth.provider === 'mock';

/**
 * Auth Service
 * Handles user authentication, registration, and session management
 */
export const authService = useMock
  ? new MockAuthService()
  : new SupabaseAuthService();

/**
 * Devis Service
 * Handles devis/quote upload, analysis, and management
 */
export const devisService = useMock
  ? new MockDevisService()
  : new SupabaseDevisService();

/**
 * Project Service
 * Handles project CRUD operations and analytics
 */
export const projectService = useMock
  ? new MockProjectService()
  : new SupabaseProjectService();

/**
 * Service factory to switch between mock and real services
 */
export const services = {
  auth: authService,
  devis: devisService,
  project: projectService,
};

/**
 * Service status check
 * Useful for debugging which services are active
 */
export const getServiceStatus = () => {
  return {
    mode: useMock ? 'mock' : 'real',
    authProvider: env.auth.provider,
    apiBaseUrl: env.api.baseUrl,
    services: {
      auth: useMock ? 'MockAuthService' : 'SupabaseAuthService',
      devis: useMock ? 'MockDevisService' : 'SupabaseDevisService',
      project: useMock ? 'MockProjectService' : 'SupabaseProjectService',
    },
  };
};

// Log service status in development mode
if (env.app.debugMode) {
  log('[Services] Configuration:', getServiceStatus());
}

export default services;

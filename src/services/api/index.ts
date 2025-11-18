/**
 * API Services Index
 * Central export point for all API services
 */

export { apiClient, ApiClient } from './client';
export type { ApiError, ApiResponse } from './client';

// Mock services (will be replaced with real services when backend is ready)
export { devisService, MockDevisService } from './mock/devis.service';
export { projectService, MockProjectService } from './mock/project.service';
export { authService, MockAuthService } from './mock/auth.service';
export type { LoginCredentials, RegisterData, AuthResponse } from './mock/auth.service';

/**
 * Service factory to switch between mock and real services
 * When backend is ready, this will return real service implementations
 */
export const services = {
  auth: authService,
  devis: devisService,
  project: projectService,
};

export default services;

/**
 * API Client
 * Centralized HTTP client for all API calls
 */

import { env } from '@/config/env';

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export class ApiClient {
  private baseUrl: string;
  private timeout: number;

  constructor() {
    this.baseUrl = env.api.baseUrl;
    this.timeout = env.api.timeout;
  }

  /**
   * Generic fetch wrapper with error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw await this.handleError(response);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw this.createError('Request timeout', 'TIMEOUT', 408);
        }
      }
      throw error;
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = params
      ? `${endpoint}?${new URLSearchParams(params)}`
      : endpoint;

    return this.request<T>(url, {
      method: 'GET',
    });
  }

  /**
   * POST request
   */
  async post<T, D = unknown>(endpoint: string, data?: D): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T, D = unknown>(endpoint: string, data?: D): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PATCH request
   */
  async patch<T, D = unknown>(endpoint: string, data?: D): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }

  /**
   * Upload file
   */
  async upload<T>(endpoint: string, file: File, data?: Record<string, unknown>): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);

    if (data) {
      Object.entries(data).forEach(([key, value]) => {
        formData.append(key, JSON.stringify(value));
      });
    }

    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout * 2); // Double timeout for uploads

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw await this.handleError(response);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw this.createError('Upload timeout', 'UPLOAD_TIMEOUT', 408);
      }
      throw error;
    }
  }

  /**
   * Handle HTTP errors
   */
  private async handleError(response: Response): Promise<ApiError> {
    let message = 'An error occurred';
    let details;

    try {
      const errorData = await response.json();
      message = errorData.message || errorData.error || message;
      details = errorData.details;
    } catch {
      message = response.statusText || message;
    }

    return this.createError(message, 'API_ERROR', response.status, details);
  }

  /**
   * Create standardized error object
   */
  private createError(
    message: string,
    code: string,
    status?: number,
    details?: unknown
  ): ApiError {
    return {
      message,
      code,
      status,
      details,
    };
  }

  /**
   * Set authorization token
   */
  setAuthToken(token: string): void {
    // This will be implemented when we add real auth
    // For now, store it in memory or localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  }

  /**
   * Get authorization token
   */
  getAuthToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  }

  /**
   * Clear authorization token
   */
  clearAuthToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient;

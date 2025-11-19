/**
 * Environment Configuration
 * Centralized, type-safe access to environment variables
 */

interface EnvConfig {
  // Application
  app: {
    name: string;
    env: 'development' | 'production' | 'test';
    version: string;
    debugMode: boolean;
  };

  // API
  api: {
    baseUrl: string;
    timeout: number;
    useMock: boolean;
  };

  // Authentication
  auth: {
    provider: 'mock' | 'supabase' | 'auth0' | 'firebase';
    supabase?: {
      url: string;
      anonKey: string;
    };
  };

  // File Upload
  upload: {
    maxFileSize: number;
    allowedTypes: string[];
  };

  // Feature Flags
  features: {
    paymentEnabled: boolean;
    chatAIEnabled: boolean;
    marketplaceEnabled: boolean;
    analyticsEnabled: boolean;
  };

  // AI / LLM Configuration
  ai: {
    openai?: {
      apiKey: string;
    };
    anthropic?: {
      apiKey: string;
    };
    primaryProvider: 'openai' | 'claude';
    fallbackEnabled: boolean;
  };

  // Third-party services
  services: {
    sentry?: {
      dsn: string;
    };
    analytics?: {
      id: string;
    };
    stripe?: {
      publicKey: string;
    };
    googleMaps?: {
      apiKey: string;
    };
  };
}

/**
 * Get environment variable with fallback
 */
const getEnv = (key: string, fallback: string = ''): string => {
  return import.meta.env[key] || fallback;
};

/**
 * Get boolean environment variable
 */
const getBoolEnv = (key: string, fallback: boolean = false): boolean => {
  const value = import.meta.env[key];
  if (value === undefined) return fallback;
  return value === 'true' || value === true;
};

/**
 * Get number environment variable
 */
const getNumEnv = (key: string, fallback: number = 0): number => {
  const value = import.meta.env[key];
  if (value === undefined) return fallback;
  const num = parseInt(value, 10);
  return isNaN(num) ? fallback : num;
};

/**
 * Environment configuration object
 */
export const env: EnvConfig = {
  app: {
    name: getEnv('VITE_APP_NAME', 'TORP'),
    env: (getEnv('VITE_APP_ENV', 'development') as EnvConfig['app']['env']),
    version: getEnv('VITE_APP_VERSION', '1.0.0'),
    debugMode: getBoolEnv('VITE_DEBUG_MODE', true),
  },

  api: {
    baseUrl: getEnv('VITE_API_BASE_URL', 'http://localhost:3000/api'),
    timeout: getNumEnv('VITE_API_TIMEOUT', 30000),
    useMock: getBoolEnv('VITE_MOCK_API', true),
  },

  auth: {
    provider: (getEnv('VITE_AUTH_PROVIDER', 'mock') as EnvConfig['auth']['provider']),
    supabase: {
      url: getEnv('VITE_SUPABASE_URL') || getEnv('VITE_AUTH_SUPABASE_URL'),
      anonKey: getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('VITE_AUTH_SUPABASE_ANON_KEY'),
    },
  },

  upload: {
    maxFileSize: getNumEnv('VITE_MAX_FILE_SIZE', 10485760), // 10MB default
    allowedTypes: getEnv('VITE_ALLOWED_FILE_TYPES', '.pdf,.jpg,.jpeg,.png,.doc,.docx').split(','),
  },

  features: {
    paymentEnabled: getBoolEnv('VITE_FEATURE_PAYMENT_ENABLED', true),
    chatAIEnabled: getBoolEnv('VITE_FEATURE_CHAT_AI_ENABLED', true),
    marketplaceEnabled: getBoolEnv('VITE_FEATURE_MARKETPLACE_ENABLED', true),
    analyticsEnabled: getBoolEnv('VITE_FEATURE_ANALYTICS_ENABLED', false),
  },

  ai: {
    openai: getEnv('VITE_OPENAI_API_KEY') ? {
      apiKey: getEnv('VITE_OPENAI_API_KEY'),
    } : undefined,
    anthropic: getEnv('VITE_ANTHROPIC_API_KEY') ? {
      apiKey: getEnv('VITE_ANTHROPIC_API_KEY'),
    } : undefined,
    primaryProvider: (getEnv('VITE_AI_PRIMARY_PROVIDER', 'claude') as 'openai' | 'claude'),
    fallbackEnabled: getBoolEnv('VITE_AI_FALLBACK_ENABLED', true),
  },

  services: {
    sentry: getEnv('VITE_SENTRY_DSN') ? {
      dsn: getEnv('VITE_SENTRY_DSN'),
    } : undefined,
    analytics: getEnv('VITE_ANALYTICS_ID') ? {
      id: getEnv('VITE_ANALYTICS_ID'),
    } : undefined,
    stripe: getEnv('VITE_STRIPE_PUBLIC_KEY') ? {
      publicKey: getEnv('VITE_STRIPE_PUBLIC_KEY'),
    } : undefined,
    googleMaps: getEnv('VITE_GOOGLE_MAPS_API_KEY') ? {
      apiKey: getEnv('VITE_GOOGLE_MAPS_API_KEY'),
    } : undefined,
  },
};

/**
 * Validate required environment variables
 */
export const validateEnv = (): void => {
  const requiredVars: string[] = [];

  // In production, require real auth configuration
  if (env.app.env === 'production' && env.auth.provider === 'mock') {
    console.warn('⚠️  WARNING: Using mock authentication in production!');
  }

  // Validate production-specific requirements
  if (env.app.env === 'production') {
    if (!env.api.baseUrl || env.api.baseUrl.includes('localhost')) {
      requiredVars.push('VITE_API_BASE_URL');
    }

    if (env.auth.provider === 'supabase') {
      if (!env.auth.supabase?.url) requiredVars.push('VITE_AUTH_SUPABASE_URL');
      if (!env.auth.supabase?.anonKey) requiredVars.push('VITE_AUTH_SUPABASE_ANON_KEY');
    }
  }

  if (requiredVars.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${requiredVars.map(v => `  - ${v}`).join('\n')}`
    );
  }
};

/**
 * Log environment info (dev only)
 */
export const logEnvInfo = (): void => {
  if (env.app.debugMode) {
    console.log('🔧 Environment Configuration:');
    console.log(`   App: ${env.app.name} v${env.app.version}`);
    console.log(`   Environment: ${env.app.env}`);
    console.log(`   API: ${env.api.baseUrl}`);
    console.log(`   Auth Provider: ${env.auth.provider}`);
    console.log(`   Mock API: ${env.api.useMock ? 'Yes' : 'No'}`);
    console.log(`   Features: Payment=${env.features.paymentEnabled}, AI=${env.features.chatAIEnabled}, Marketplace=${env.features.marketplaceEnabled}`);
  }
};

// Auto-validate on import (only in production)
if (env.app.env === 'production') {
  validateEnv();
}

export default env;

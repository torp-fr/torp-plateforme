/**
 * Admin Navigation Routes
 * Centralized definition of all admin-only routes
 * Used by AdminRoute for access control
 */

export const ADMIN_ROUTES = {
  DASHBOARD: '/analytics',
  SYSTEM: '/analytics/system',
  INTELLIGENCE: '/analytics/intelligence',
  ORCHESTRATIONS: '/analytics/orchestrations',
  KNOWLEDGE: '/analytics/knowledge',
  INGESTION: '/analytics/ingestion',
  SECURITY: '/analytics/security',
  SETTINGS: '/analytics/settings',
} as const;

export const ADMIN_ROUTE_PATHS = Object.values(ADMIN_ROUTES);

/**
 * Check if a route is an admin route
 */
export function isAdminRoute(pathname: string): boolean {
  return ADMIN_ROUTE_PATHS.some(route => {
    // Exact match or starts with for dynamic routes
    return pathname === route || pathname.startsWith(route + '/');
  });
}

export type AdminRoutePath = typeof ADMIN_ROUTES[keyof typeof ADMIN_ROUTES];

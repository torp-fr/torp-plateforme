/**
 * Admin Navigation Routes
 * Centralized definition of all admin-only routes
 * Used by AdminRoute for access control
 */

export const ADMIN_ROUTES = {
  DASHBOARD:       '/admin',
  SYSTEM:          '/admin/system',
  INTELLIGENCE:    '/admin/intelligence',
  ORCHESTRATIONS:  '/admin/orchestrations',
  KNOWLEDGE:       '/admin/knowledge',
  SECURITY:        '/admin/security',
  SETTINGS:        '/admin/settings',
  // Phase 4 — PROMPT G
  API_MONITORING:  '/admin/api-monitoring',
  COST_TRACKING:   '/admin/costs',
  PIPELINE_HEALTH: '/admin/pipeline-health',
  // H3-ENRICHI — enrichment tools
  RENOVATION_AIDS:  '/admin/aids',
  NATURAL_HAZARDS:  '/admin/hazards',
} as const;

export const ADMIN_ROUTE_PATHS = Object.values(ADMIN_ROUTES);

/**
 * Check if a route is an admin route
 */
export function isAdminRoute(pathname: string): boolean {
  return ADMIN_ROUTE_PATHS.some(route => {
    return pathname === route || pathname.startsWith(route + '/');
  });
}

export type AdminRoutePath = typeof ADMIN_ROUTES[keyof typeof ADMIN_ROUTES];

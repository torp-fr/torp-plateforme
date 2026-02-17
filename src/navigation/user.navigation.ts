/**
 * User Navigation Routes
 * Centralized definition of all user routes
 * Used by ProtectedRoute for access control
 */

export const USER_ROUTES = {
  DASHBOARD: '/dashboard',
  ANALYZE: '/analyze',
  PROJECTS: '/projects',
  PROJECT_DETAIL: '/project/:projectId',
  COMPANY: '/company',
  SETTINGS: '/settings',
  RESULTS: '/results',
  PROFILE: '/profile',
} as const;

export const USER_ROUTE_PATHS = [
  USER_ROUTES.DASHBOARD,
  USER_ROUTES.ANALYZE,
  USER_ROUTES.PROJECTS,
  USER_ROUTES.COMPANY,
  USER_ROUTES.SETTINGS,
  USER_ROUTES.RESULTS,
  USER_ROUTES.PROFILE,
];

/**
 * Check if a route is a user route
 */
export function isUserRoute(pathname: string): boolean {
  return USER_ROUTE_PATHS.some(route => {
    // Exact match or starts with for dynamic routes
    return pathname === route || pathname.startsWith(route + '/');
  });
}

export type UserRoutePath = typeof USER_ROUTES[keyof typeof USER_ROUTES];

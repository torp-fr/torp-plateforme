/**
 * Protected Route Component
 * Wraps routes that require authentication
 */

import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { UserType } from '@/context/AppContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredTypes?: UserType[];
  redirectTo?: string;
}

/**
 * Protected Route HOC
 * Redirects to login if user is not authenticated
 * Optionally checks for required user types
 */
export function ProtectedRoute({
  children,
  requiredTypes,
  redirectTo = '/login',
}: ProtectedRouteProps) {
  const { user, userType, isLoading } = useApp();
  const location = useLocation();

  // Show loading while auth state is being determined
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  // Check if user is authenticated
  if (!user) {
    // Redirect to login, preserving the intended destination
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Check if user type is allowed
  if (requiredTypes && !requiredTypes.includes(userType)) {
    // Redirect to appropriate dashboard based on user type
    const dashboardMap: Record<UserType, string> = {
      B2C: '/dashboard',
      B2B: '/pro',
      B2G: '/dashboard',
      admin: '/admin-dashboard',
      super_admin: '/admin/analytics',
    };

    return <Navigate to={dashboardMap[userType] || '/'} replace />;
  }

  return <>{children}</>;
}

/**
 * Public Only Route
 * Redirects authenticated users away from auth pages (login, register)
 */
export function PublicOnlyRoute({
  children,
  redirectTo = '/dashboard',
}: {
  children: ReactNode;
  redirectTo?: string;
}) {
  const { user, userType, isLoading } = useApp();

  // Show loading while auth state is being determined
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (user) {
    // Redirect to appropriate dashboard based on user type
    const dashboardMap: Record<UserType, string> = {
      B2C: '/dashboard',
      B2B: '/pro',
      B2G: '/dashboard',
      admin: '/admin-dashboard',
      super_admin: '/admin/analytics',
    };
    return <Navigate to={dashboardMap[userType] || redirectTo} replace />;
  }

  return <>{children}</>;
}

/**
 * Role-based access control
 */
export function RequireRole({
  children,
  roles,
  fallback,
}: {
  children: ReactNode;
  roles: UserType[];
  fallback?: ReactNode;
}) {
  const { userType } = useApp();

  if (!roles.includes(userType)) {
    return <>{fallback || null}</>;
  }

  return <>{children}</>;
}

export default ProtectedRoute;

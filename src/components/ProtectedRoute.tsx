/**
 * ProtectedRoute Component (Phase 30.1)
 * Protects routes based on user role
 * Usage: <ProtectedRoute requiredRole="admin" component={AnalyticsPage} />
 */

import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUserRole, type UserRole } from '@/hooks/useUserRole';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  component: React.ComponentType;
  requiredRole?: UserRole;
  children?: ReactNode;
}

export function ProtectedRoute({
  component: Component,
  requiredRole,
  children,
}: ProtectedRouteProps) {
  const location = useLocation();
  const { role, loading } = useUserRole();

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Check if user has required role
  const hasRequiredRole = !requiredRole || role === requiredRole;

  if (!hasRequiredRole) {
    console.warn(
      `[ProtectedRoute] Access denied: required role=${requiredRole}, user role=${role}`
    );
    return <Navigate to="/dashboard" state={{ from: location }} />;
  }

  return children ? <>{children}</> : <Component />;
}

/**
 * Admin-only route wrapper
 */
export function AdminRoute({
  component: Component,
  children,
}: Omit<ProtectedRouteProps, 'requiredRole'>) {
  return (
    <ProtectedRoute component={Component} requiredRole="admin">
      {children}
    </ProtectedRoute>
  );
}

export default ProtectedRoute;

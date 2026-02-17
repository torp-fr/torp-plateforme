/**
 * ProRoute Component
 * Protected route wrapper for B2B professional users
 */

import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useApp } from '@/context/AppContext';

interface ProRouteProps {
  children: ReactNode;
  /** Redirect path when access is denied (default: /login) */
  redirectTo?: string;
  /** Allow admin users to access pro routes (default: true) */
  allowAdmin?: boolean;
}

/**
 * Protects routes that should only be accessible by B2B users (professionals)
 */
export const ProRoute = ({
  children,
  redirectTo = '/login',
  allowAdmin = true,
}: ProRouteProps) => {
  const { user, isLoading, isAuthenticated } = useApp();
  const location = useLocation();

  // Show nothing while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="h-12 w-12 rounded-full bg-primary/20 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // If we have a profile, check authorization
  if (user) {
    // Check if user is B2B or admin (if allowed)
    const isAuthorized =
      user.type === 'B2B' || (allowAdmin && user.type === 'admin');

    if (!isAuthorized) {
      // User is B2C, redirect to B2C dashboard with a message
      return (
        <Navigate
          to="/dashboard"
          state={{
            message: 'Cette page est réservée aux professionnels.',
            from: location,
          }}
          replace
        />
      );
    }
  }

  return <>{children}</>;
};

/**
 * ProtectedRoute Component
 * Generic protected route wrapper for authenticated users (any type)
 */
interface ProtectedRouteProps {
  children: ReactNode;
  redirectTo?: string;
}

export const ProtectedRoute = ({
  children,
  redirectTo = '/login',
}: ProtectedRouteProps) => {
  const { isLoading, isAuthenticated } = useApp();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="h-12 w-12 rounded-full bg-primary/20 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  // Check session authentication, not profile existence
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

/**
 * AdminRoute Component
 * Protected route wrapper for admin users only
 */
interface AdminRouteProps {
  children: ReactNode;
  redirectTo?: string;
}

export const AdminRoute = ({
  children,
  redirectTo = '/dashboard',
}: AdminRouteProps) => {
  const { user, isLoading, isAuthenticated } = useApp();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="h-12 w-12 rounded-full bg-primary/20 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  // Check session authentication first
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Then check admin role if we have a profile
  if (user && user.type !== 'admin') {
    return (
      <Navigate
        to={redirectTo}
        state={{
          message: 'Accès réservé aux administrateurs.',
          from: location,
        }}
        replace
      />
    );
  }

  return <>{children}</>;
};

export default ProRoute;

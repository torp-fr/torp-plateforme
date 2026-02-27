/**
 * AdminRoute - Protects routes for admin users only
 * Uses official Supabase auth pattern with isLoading state
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { warn } from '@/lib/logger';

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { user, isLoading } = useApp();

  // While auth initialization is in progress, show spinner
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  // Auth complete. Check access deterministically.
  // Not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Not admin
  if (!user.isAdmin) {
    warn('[AdminRoute] Access denied: user is not admin');
    return <Navigate to="/dashboard" replace />;
  }

  // Admin user → allow access
  return <>{children}</>;
}

/**
 * AdminRoute - Protects routes for admin users only
 * Uses user.isAdmin from AppContext (loaded during auth bootstrap)
 * NO separate role fetching - prevents infinite loading on tab navigation
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

  // Show loading only during initial bootstrap
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement de la session...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Not admin (role from Supabase profiles, loaded during bootstrap)
  if (!user.isAdmin) {
    warn('[AdminRoute] Access denied: user is not admin');
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

/**
 * AdminRoute - Protects routes for admin users only
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { user, isAdmin, isLoading } = useApp();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Vérification des permissions...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Not admin
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

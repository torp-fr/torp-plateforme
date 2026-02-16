/**
 * AdminRoute - Protects routes for admin users only (Phase 30.1)
 * Uses Supabase profiles.role as source of truth
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { useUserRole } from '@/hooks/useUserRole';

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { user, isLoading: contextLoading } = useApp();
  const { isAdmin, loading: roleLoading } = useUserRole();

  const loading = contextLoading || roleLoading;

  if (loading) {
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

  // Not admin (role from Supabase profiles)
  if (!isAdmin) {
    console.warn('[AdminRoute] Access denied: user is not admin');
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

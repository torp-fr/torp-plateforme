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

  // During bootstrap, return null (loading spinner shown in App root)
  if (isLoading) {
    return null;
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Not admin (role from Supabase profiles, loaded in background)
  if (!user.isAdmin) {
    warn('[AdminRoute] Access denied: user is not admin');
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

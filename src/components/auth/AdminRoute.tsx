/**
 * AdminRoute - Protects routes for admin users only
 * Relies on Supabase auth listener for session state
 * Profile data (isAdmin) loads in background
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { warn } from '@/lib/logger';

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { user, roleLoaded } = useApp();

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Wait silently until role is loaded from profile
  // This prevents incorrect redirect to /dashboard while profile is being fetched
  if (!roleLoaded) {
    return null;
  }

  // Not admin (role from Supabase profiles, loaded in background)
  if (!user.isAdmin) {
    warn('[AdminRoute] Access denied: user is not admin');
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

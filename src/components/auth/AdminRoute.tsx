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
  const { user } = useApp();

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Wait silently until role is determined from profile
  // isAdmin is undefined while profile loads, false if not admin, true if admin
  if (user.isAdmin === undefined) {
    return null;
  }

  // Not admin (role from Supabase profiles, loaded in background)
  if (!user.isAdmin) {
    warn('[AdminRoute] Access denied: user is not admin');
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

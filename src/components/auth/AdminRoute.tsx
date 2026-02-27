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

  // PHASE 6: Hard mode - no visible spinner
  // Return null (blank) during session bootstrap instead of showing spinner
  // Bootstrap is <200ms anyway, and null avoids "Chargement de la session..." entirely
  if (isLoading) {
    return null;  // Minimal blocking - just return null instead of spinner
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

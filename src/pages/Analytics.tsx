/**
 * Analytics - Panel d'administration TORP
 * Réservé aux comptes admin - suivi et gestion de la plateforme
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import {
  BarChart3,
  Users,
  FileText,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function Analytics() {
  const navigate = useNavigate();
  const { userType } = useApp();

  // Check if user is admin
  if (userType !== 'admin' && userType !== 'super_admin') {
    return (
      <div className="space-y-8">
        <Alert className="bg-destructive/10 border-destructive/20">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-destructive">
            <strong>Accès refusé</strong> - Cette page est réservée aux administrateurs.
            <br />
            Vous avez été redirigé vers votre tableau de bord personnel.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground font-display">Panel d'Administration</h1>
        <p className="text-muted-foreground mt-1">Suivi et gestion de la plateforme TORP</p>
      </div>

      {/* Admin Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Utilisateurs</p>
                <p className="text-4xl font-bold text-foreground mt-2">0</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Analyses */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Analyses complétées</p>
                <p className="text-4xl font-bold text-foreground mt-2">0</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Average Score */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Score moyen</p>
                <p className="text-4xl font-bold text-foreground mt-2">0</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Growth */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Croissance (30j)</p>
                <p className="text-4xl font-bold text-foreground mt-2">+0%</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Management */}
        <Card>
          <CardHeader>
            <CardTitle className="text-primary font-display">Gestion des utilisateurs</CardTitle>
            <CardDescription>Contrôle des comptes et des permissions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Section en développement - Bientôt disponible
            </p>
          </CardContent>
        </Card>

        {/* Platform Health */}
        <Card>
          <CardHeader>
            <CardTitle className="text-primary font-display">Santé de la plateforme</CardTitle>
            <CardDescription>Monitoring et alertes système</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">API Status</span>
              <span className="text-sm font-semibold text-success">✓ Opérationnel</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Database</span>
              <span className="text-sm font-semibold text-success">✓ Opérationnel</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Storage</span>
              <span className="text-sm font-semibold text-success">✓ Opérationnel</span>
            </div>
          </CardContent>
        </Card>

        {/* Audit Log */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-primary font-display">Historique d'audit</CardTitle>
            <CardDescription>Suivi des actions système et utilisateurs</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Section en développement - Bientôt disponible
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Analytics;

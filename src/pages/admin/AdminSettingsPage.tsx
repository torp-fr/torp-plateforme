/**
 * Admin Settings Page — Phase 3B
 * Configuration de la plateforme — à implémenter dans une version ultérieure
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Settings, Globe, Bell, Lock } from 'lucide-react';

export function AdminSettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Paramètres d'Administration</h1>
        <p className="text-muted-foreground mt-1">Configuration globale de la plateforme</p>
      </div>

      {/* Coming Soon Banner */}
      <Card className="border-2 border-dashed border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-700">
        <CardContent className="p-8 text-center space-y-3">
          <Settings className="h-12 w-12 mx-auto text-yellow-600 dark:text-yellow-500" />
          <h2 className="text-xl font-semibold text-yellow-800 dark:text-yellow-400">
            Bientôt disponible
          </h2>
          <p className="text-sm text-yellow-700 dark:text-yellow-500 max-w-sm mx-auto">
            Cette section sera implémentée dans une version ultérieure. Elle permettra de
            configurer les paramètres globaux de la plateforme.
          </p>
          <p className="text-xs text-yellow-600 dark:text-yellow-600 mt-2">
            Fonctionnalités prévues : nom plateforme, URL, mode maintenance, timeout de session,
            notifications, politiques d'accès.
          </p>
        </CardContent>
      </Card>

      {/* Preview of planned sections (disabled) */}
      <div className="opacity-40 pointer-events-none space-y-4" aria-hidden="true">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4" />
              Général
            </CardTitle>
            <CardDescription>Configuration globale de la plateforme</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" />
              Notifications
            </CardTitle>
            <CardDescription>Alertes et résumés automatiques</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4" />
              Sécurité
            </CardTitle>
            <CardDescription>2FA, IP whitelist, timeout de session</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}

export default AdminSettingsPage;

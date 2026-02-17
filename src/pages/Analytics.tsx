/**
 * Analytics - Panel d'administration TORP
 * Réservé aux comptes admin - suivi et gestion de la plateforme
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KnowledgeBaseUpload } from '@/components/KnowledgeBaseUpload';
import {
  BarChart3,
  Users,
  FileText,
  TrendingUp,
  AlertCircle,
  Database,
  Settings,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

type TabType = 'overview' | 'upload-kb' | 'users' | 'settings';

export function Analytics() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground font-display">Panel d'Administration</h1>
        <p className="text-muted-foreground mt-1">Suivi et gestion de la plateforme TORP</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b overflow-x-auto">
        <Button
          variant={activeTab === 'overview' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('overview')}
          className="rounded-b-none"
        >
          <BarChart3 className="h-4 w-4 mr-2" />
          Vue d'ensemble
        </Button>
        <Button
          variant={activeTab === 'upload-kb' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('upload-kb')}
          className="rounded-b-none"
        >
          <Database className="h-4 w-4 mr-2" />
          Base de Connaissances
        </Button>
        <Button
          variant={activeTab === 'users' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('users')}
          className="rounded-b-none"
        >
          <Users className="h-4 w-4 mr-2" />
          Utilisateurs
        </Button>
        <Button
          variant={activeTab === 'settings' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('settings')}
          className="rounded-b-none"
        >
          <Settings className="h-4 w-4 mr-2" />
          Paramètres
        </Button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'upload-kb' && <UploadKBTab />}
      {activeTab === 'users' && <UsersTab navigate={navigate} />}
      {activeTab === 'settings' && <SettingsTab />}
    </div>
  );
}

/**
 * Overview Tab Component
 */
function OverviewTab() {
  return (
    <div className="space-y-8">
      {/* Admin Stats Cards */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

      {/* Growth - Analyses (30 jours) */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Croissance analyses (30j)</p>
              <p className="text-4xl font-bold text-foreground mt-2">+0%</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

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
    </div>
  );
}

/**
 * Upload KB Tab Component
 */
function UploadKBTab() {
  return (
    <div className="space-y-6">
      <KnowledgeBaseUpload />

      <Card>
        <CardHeader>
          <CardTitle>Documents Récemment Uploadés</CardTitle>
          <CardDescription>Les derniers documents métier ingérés</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Les documents apparaîtront ici après upload.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Users Tab Component
 */
function UsersTab({ navigate }: { navigate: any }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gestion des Utilisateurs</h2>
          <p className="text-muted-foreground">Gérez les rôles et permissions</p>
        </div>
        <Button onClick={() => navigate('/admin/users')}>
          Gérer les utilisateurs
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Accédez à la page de gestion</CardTitle>
          <CardDescription>Cliquez sur le bouton ci-dessus pour accéder à la gestion complète des utilisateurs</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Vous pouvez promouvoir des utilisateurs au rôle d'administrateur, gérer les permissions KB, et consulter l'historique d'audit.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Settings Tab Component
 */
function SettingsTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Paramètres d'Administration</CardTitle>
          <CardDescription>Configurez les paramètres de la plateforme</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Section en développement - Bientôt disponible
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default Analytics;

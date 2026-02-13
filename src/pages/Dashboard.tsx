/**
 * Dashboard - Tableau de bord principal TORP
 * Structure prête à être enrichie avec des données réelles
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  TrendingUp,
  Clock,
  BarChart3,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useApp();

  // TODO: Remplacer par de vrais appels API
  const stats = {
    totalProjects: 0,
    totalAnalyses: 0,
    averageScore: 0,
    pending: 0,
  };

  const recentProjects: any[] = [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground font-display">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Vue d'ensemble de vos projets et analyses</p>
        </div>
        <Button
          onClick={() => navigate('/analyze')}
          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
        >
          <Plus className="h-5 w-5" />
          Nouveau Projet
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Projects Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Projets</p>
                <p className="text-4xl font-bold text-foreground mt-2">{stats.totalProjects}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Analyses Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Analyses</p>
                <p className="text-4xl font-bold text-foreground mt-2">{stats.totalAnalyses}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Average Score Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Score moyen</p>
                <p className="text-4xl font-bold text-foreground mt-2">{stats.averageScore}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-sm">En attente</p>
                <p className="text-4xl font-bold text-foreground mt-2">{stats.pending}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Projects Section - Empty State */}
      <div>
        <h2 className="text-2xl font-bold text-foreground font-display mb-4">Projets récents</h2>

        {recentProjects.length === 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="p-12 text-center">
              <div className="mb-4">
                <FileText className="h-16 w-16 text-muted-foreground/30 mx-auto" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Aucun projet pour le moment</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Commencez par créer votre premier projet pour bénéficier de notre système de valorisation intelligente des devis.
              </p>
              <Button
                onClick={() => navigate('/analyze')}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Créer mon premier projet
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {/* Projects will be rendered here */}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;

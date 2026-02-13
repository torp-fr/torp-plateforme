/**
 * Dashboard - Tableau de bord principal TORP
 * Modèle cohérent avec la charte Lovable
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  TrendingUp,
  Clock,
  BarChart3,
  ChevronRight,
  Plus,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Mock data - à remplacer par des vraies données
const MOCK_STATS = {
  totalProjects: 3,
  totalAnalyses: 1,
  averageScore: 782,
  pending: 2,
};

const MOCK_RECENT_PROJECTS = [
  {
    id: '1',
    name: 'Rénovation Appartement Haussmannien',
    address: '45 Rue de Rivoli, 75001 Paris',
    type: 'rénovation',
    status: 'analysé',
    score: 782,
    maxScore: 1000,
    grade: 'B',
  },
  {
    id: '2',
    name: 'Extension Maison Individuelle',
    address: '12 Allée des Chênes, 33000 Bordeaux',
    type: 'neuf',
    status: 'en analyse',
    score: null,
    maxScore: 1000,
    grade: null,
  },
  {
    id: '3',
    name: 'Maintenance Immeuble Bureau',
    address: '8 Bd Haussmann, 75009 Paris',
    type: 'maintenance',
    status: 'brouilion',
    score: null,
    maxScore: 1000,
    grade: null,
  },
];

const GRADE_COLORS: { [key: string]: string } = {
  'A': 'bg-success/10 text-success',
  'B': 'bg-primary/10 text-primary',
  'C': 'bg-warning/10 text-warning',
  'D': 'bg-accent/10 text-accent',
  'E': 'bg-destructive/10 text-destructive',
};

const STATUS_BADGES: { [key: string]: string } = {
  'analysé': 'bg-success/10 text-success border-success/20',
  'en analyse': 'bg-warning/10 text-warning border-warning/20',
  'brouilion': 'bg-muted text-muted-foreground border-border',
};

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useApp();

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
                <p className="text-4xl font-bold text-foreground mt-2">{MOCK_STATS.totalProjects}</p>
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
                <p className="text-4xl font-bold text-foreground mt-2">{MOCK_STATS.totalAnalyses}</p>
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
                <p className="text-4xl font-bold text-foreground mt-2">{MOCK_STATS.averageScore}</p>
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
                <p className="text-4xl font-bold text-foreground mt-2">{MOCK_STATS.pending}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Projects Section */}
      <div>
        <h2 className="text-2xl font-bold text-foreground font-display mb-4">Projets récents</h2>
        <div className="space-y-3">
          {MOCK_RECENT_PROJECTS.map((project) => (
            <Card
              key={project.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/projet/${project.id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-foreground truncate">
                        {project.name}
                      </h3>
                      <Badge
                        variant="outline"
                        className={STATUS_BADGES[project.status]}
                      >
                        {project.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{project.address}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="capitalize">{project.type}</span>
                      {project.score !== null && (
                        <>
                          <span>•</span>
                          <span>{project.score} m²</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Score Section */}
                  {project.score !== null && project.grade && (
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-foreground">{project.score}</p>
                        <p className="text-xs text-muted-foreground">
                          / {project.maxScore}
                        </p>
                      </div>
                      <Badge
                        className={`${GRADE_COLORS[project.grade]} text-base font-bold px-3 py-1`}
                      >
                        {project.grade}
                      </Badge>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}

                  {/* Pending State */}
                  {project.score === null && (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Empty State Info */}
      {MOCK_RECENT_PROJECTS.length === 0 && (
        <Card className="border-2 border-dashed">
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground mb-4">Aucun projet pour le moment</p>
            <Button
              onClick={() => navigate('/analyze')}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Créer mon premier projet
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default Dashboard;

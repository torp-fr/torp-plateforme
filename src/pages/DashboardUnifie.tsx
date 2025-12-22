/**
 * DashboardUnifie - Dashboard principal clair et actionnable
 * Met en avant le parcours projet BTP et les outils IA
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PlusCircle,
  FolderOpen,
  FileSearch,
  Sparkles,
  ArrowRight,
  Building2,
  TrendingUp,
  Clock,
  CheckCircle2,
  Lightbulb,
  Send,
  HardHat,
  Wrench,
  Search,
  ChevronRight,
  Hammer,
  Euro,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

// Mock data pour les projets récents
const MOCK_PROJECTS = [
  {
    id: '1',
    nom: 'Rénovation Appartement Paris 16',
    adresse: '42 Avenue Victor Hugo, 75016 Paris',
    phase: 2,
    phaseName: 'Consultation',
    avancement: 45,
    budget: 85000,
    updatedAt: '2024-01-18',
  },
  {
    id: '2',
    nom: 'Extension Maison Neuilly',
    adresse: '15 Rue de la Paix, 92200 Neuilly',
    phase: 1,
    phaseName: 'Conception',
    avancement: 20,
    budget: 120000,
    updatedAt: '2024-01-17',
  },
  {
    id: '3',
    nom: 'Réhabilitation Bureaux',
    adresse: '8 Boulevard Haussmann, 75009 Paris',
    phase: 3,
    phaseName: 'Exécution',
    avancement: 70,
    budget: 250000,
    updatedAt: '2024-01-16',
  },
];

const PHASES = [
  { id: 1, name: 'Conception', icon: Lightbulb, color: 'text-amber-600', bg: 'bg-amber-50' },
  { id: 2, name: 'Consultation', icon: Send, color: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 3, name: 'Exécution', icon: HardHat, color: 'text-orange-600', bg: 'bg-orange-50' },
  { id: 4, name: 'Réception', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
  { id: 5, name: 'Maintenance', icon: Wrench, color: 'text-purple-600', bg: 'bg-purple-50' },
];

export function DashboardUnifie() {
  const navigate = useNavigate();
  const { user, userType } = useApp();
  const isB2B = userType === 'B2B';

  // Stats mock
  const stats = {
    total: 5,
    enCours: 3,
    termines: 2,
    budgetTotal: 455000,
  };

  return (
    <div className="space-y-8">
      {/* Header de bienvenue */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bonjour {user?.name?.split(' ')[0] || 'Bienvenue'} 👋
        </h1>
        <p className="text-gray-600 mt-1">
          Gérez vos projets BTP avec l'intelligence artificielle
        </p>
      </div>

      {/* Actions rapides - TRÈS VISIBLE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className="cursor-pointer hover:shadow-lg transition-all border-2 border-primary/20 hover:border-primary/40"
          onClick={() => navigate('/projet/nouveau')}
        >
          <CardContent className="flex items-center gap-4 p-6">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <PlusCircle className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Nouveau projet</h3>
              <p className="text-sm text-gray-500">Créer un projet BTP</p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-lg transition-all"
          onClick={() => navigate('/analyze')}
        >
          <CardContent className="flex items-center gap-4 p-6">
            <div className="h-14 w-14 rounded-full bg-blue-50 flex items-center justify-center">
              <FileSearch className="h-7 w-7 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Analyser un devis</h3>
              <div className="flex items-center gap-1 text-sm text-primary">
                <Sparkles className="h-3 w-3" />
                Analyse IA instantanée
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-lg transition-all"
          onClick={() => navigate('/recherche-entreprises')}
        >
          <CardContent className="flex items-center gap-4 p-6">
            <div className="h-14 w-14 rounded-full bg-green-50 flex items-center justify-center">
              <Search className="h-7 w-7 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Trouver des entreprises</h3>
              <p className="text-sm text-gray-500">Entreprises RGE certifiées</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Le parcours TORP - Explication visuelle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Le parcours TORP
          </CardTitle>
          <CardDescription>
            5 phases pour piloter votre projet BTP de A à Z avec l'IA
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between overflow-x-auto pb-2">
            {PHASES.map((phase, index) => {
              const Icon = phase.icon;
              return (
                <React.Fragment key={phase.id}>
                  <div className="flex flex-col items-center min-w-[100px]">
                    <div className={cn(
                      'w-12 h-12 rounded-full flex items-center justify-center mb-2',
                      phase.bg
                    )}>
                      <Icon className={cn('h-6 w-6', phase.color)} />
                    </div>
                    <span className="text-xs font-medium text-gray-700">Phase {phase.id}</span>
                    <span className="text-xs text-gray-500">{phase.name}</span>
                  </div>
                  {index < PHASES.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-gray-300 flex-shrink-0 mx-2" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Stats et Projets */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Stats */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-gray-500">Projets total</p>
                </div>
                <FolderOpen className="h-8 w-8 text-gray-300" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-blue-600">{stats.enCours}</p>
                  <p className="text-sm text-gray-500">En cours</p>
                </div>
                <Clock className="h-8 w-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-green-600">{stats.termines}</p>
                  <p className="text-sm text-gray-500">Terminés</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Projets récents */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Mes projets</CardTitle>
                <CardDescription>Vos projets BTP en cours</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/projets')}>
                Voir tout
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              {MOCK_PROJECTS.length === 0 ? (
                <div className="text-center py-12">
                  <FolderOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">Aucun projet pour le moment</p>
                  <Button onClick={() => navigate('/projet/nouveau')}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Créer mon premier projet
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {MOCK_PROJECTS.map((project) => {
                    const phase = PHASES.find(p => p.id === project.phase);
                    const PhaseIcon = phase?.icon || Lightbulb;

                    return (
                      <Link
                        key={project.id}
                        to={`/projet/${project.id}`}
                        className="flex items-center gap-4 p-4 rounded-lg border hover:bg-gray-50 transition-colors group"
                      >
                        <div className={cn(
                          'h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0',
                          phase?.bg || 'bg-gray-100'
                        )}>
                          <PhaseIcon className={cn('h-5 w-5', phase?.color || 'text-gray-600')} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium truncate">{project.nom}</h4>
                            <Badge variant="secondary" className="text-xs">
                              Phase {project.phase}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                            <span className="flex items-center gap-1 truncate">
                              <MapPin className="h-3 w-3" />
                              {project.adresse}
                            </span>
                            <span className="flex items-center gap-1">
                              <Euro className="h-3 w-3" />
                              {project.budget.toLocaleString('fr-FR')} €
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-24 hidden sm:block">
                            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                              <span>Avancement</span>
                              <span>{project.avancement}%</span>
                            </div>
                            <Progress value={project.avancement} className="h-1.5" />
                          </div>
                          <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-primary transition-colors" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CTA Analyse IA - Mise en avant de la valeur */}
      <Card className="bg-gradient-to-r from-primary/5 to-blue-50 border-primary/20">
        <CardContent className="flex items-center justify-between p-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Analyse de devis par IA</h3>
              <p className="text-gray-600">
                Uploadez un devis et obtenez une analyse détaillée en quelques secondes
              </p>
            </div>
          </div>
          <Button size="lg" onClick={() => navigate('/analyze')}>
            Analyser maintenant
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default DashboardUnifie;

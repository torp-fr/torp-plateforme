/**
 * TORP Phase 2 - Liste des Chantiers
 * Vue d'ensemble de tous les chantiers actifs avec accès rapide aux fonctionnalités
 * ZÉRO MOCK - Données réelles depuis Supabase
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Building2,
  Calendar,
  Users,
  ClipboardList,
  Search,
  HardHat,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  MapPin,
  Euro,
  LayoutGrid,
  List
} from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { useApp } from '@/context/AppContext';
import { useChantiers, ChantierStatus } from '@/hooks/useChantiers';

// Labels adaptés par profil
const PROFILE_LABELS = {
  B2C: {
    pageTitle: 'Mes Chantiers',
    pageDescription: 'Gérez et suivez tous vos chantiers en cours',
    totalLabel: 'Total chantiers',
    enCoursLabel: 'En cours',
    preparationLabel: 'Préparation',
    alertesLabel: 'Alertes',
    avancementLabel: 'Avancement moyen',
    entreprisesLabel: 'artisan(s)',
    newProjectLabel: 'Créer un projet',
    seeProjectsLabel: 'Voir tous les projets',
    planningLabel: 'Planning',
    reunionsLabel: 'Réunions',
    journalLabel: 'Journal',
    voirChantierLabel: 'Voir le chantier',
  },
  B2B: {
    pageTitle: 'Gestion des Chantiers',
    pageDescription: 'Suivi opérationnel de vos chantiers en cours',
    totalLabel: 'Chantiers actifs',
    enCoursLabel: 'En exécution',
    preparationLabel: 'En préparation',
    alertesLabel: 'Points d\'attention',
    avancementLabel: 'Avancement global',
    entreprisesLabel: 'sous-traitant(s)',
    newProjectLabel: 'Nouveau projet',
    seeProjectsLabel: 'Portefeuille projets',
    planningLabel: 'Gantt',
    reunionsLabel: 'CR chantier',
    journalLabel: 'Registre',
    voirChantierLabel: 'Ouvrir le chantier',
  },
  B2G: {
    pageTitle: 'Suivi des Marchés',
    pageDescription: 'Tableau de bord des marchés de travaux en exécution',
    totalLabel: 'Marchés en cours',
    enCoursLabel: 'En exécution',
    preparationLabel: 'Préparation OS',
    alertesLabel: 'Points de vigilance',
    avancementLabel: 'Avancement marché',
    entreprisesLabel: 'titulaire(s)',
    newProjectLabel: 'Nouveau marché',
    seeProjectsLabel: 'Tous les marchés',
    planningLabel: 'Planning TCE',
    reunionsLabel: 'Comités',
    journalLabel: 'Registre',
    voirChantierLabel: 'Consulter le marché',
  },
};

// Statuts de chantier
const CHANTIER_STATUS = {
  preparation: { label: 'En préparation', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  en_cours: { label: 'En cours', color: 'bg-green-100 text-green-800', icon: HardHat },
  suspendu: { label: 'Suspendu', color: 'bg-orange-100 text-orange-800', icon: AlertTriangle },
  termine: { label: 'Terminé', color: 'bg-blue-100 text-blue-800', icon: CheckCircle2 },
};

export default function ChantiersListPage() {
  const navigate = useNavigate();
  const { userType } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<ChantierStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Labels adaptés au profil utilisateur
  const labels = PROFILE_LABELS[userType as keyof typeof PROFILE_LABELS] || PROFILE_LABELS.B2C;

  // Hook pour les données réelles depuis Supabase
  const {
    chantiers: allChantiers,
    stats,
    isLoading,
  } = useChantiers({
    userType: userType as 'B2C' | 'B2B' | 'B2G',
  });

  // Filtrer les chantiers localement par recherche et statut
  const filteredChantiers = allChantiers.filter(chantier => {
    const matchSearch =
      chantier.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chantier.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chantier.adresse.toLowerCase().includes(searchTerm.toLowerCase());

    const matchStatus = filterStatus === 'all' || chantier.status === filterStatus;

    return matchSearch && matchStatus;
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          {/* Header Skeleton */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-10 w-40" />
          </div>

          {/* Stats Cards Skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Skeleton className="h-4 w-20 mb-2" />
                      <Skeleton className="h-8 w-12" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filters Skeleton */}
          <Card>
            <CardContent className="py-4">
              <div className="flex gap-4">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-10 w-48" />
              </div>
            </CardContent>
          </Card>

          {/* Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-6 w-48 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-2 w-full" />
                  <div className="grid grid-cols-2 gap-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{labels.pageTitle}</h1>
            <p className="text-muted-foreground mt-1">
              {labels.pageDescription}
            </p>
          </div>
          <Button onClick={() => navigate('/phase0/dashboard')}>
            <Building2 className="h-4 w-4 mr-2" />
            {labels.seeProjectsLabel}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{labels.totalLabel}</p>
                  <p className="text-2xl font-bold">{stats?.total || 0}</p>
                </div>
                <HardHat className="h-8 w-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{labels.enCoursLabel}</p>
                  <p className="text-2xl font-bold text-green-600">{stats?.enCours || 0}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{labels.preparationLabel}</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats?.preparation || 0}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{labels.alertesLabel}</p>
                  <p className="text-2xl font-bold text-orange-600">{stats?.alertes || 0}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{labels.avancementLabel}</p>
                  <p className="text-2xl font-bold">{stats?.avancementMoyen || 0}%</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex gap-4 items-center w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un chantier..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Tabs value={filterStatus} onValueChange={setFilterStatus}>
                  <TabsList>
                    <TabsTrigger value="all">Tous</TabsTrigger>
                    <TabsTrigger value="en_cours">En cours</TabsTrigger>
                    <TabsTrigger value="preparation">Préparation</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chantiers List/Grid */}
        {filteredChantiers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <HardHat className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Aucun chantier trouvé</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || filterStatus !== 'all'
                  ? 'Modifiez vos critères de recherche'
                  : 'Commencez par créer un projet et lancez la consultation'}
              </p>
              <Button onClick={() => navigate('/phase0/new')}>
                {labels.newProjectLabel}
              </Button>
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredChantiers.map((chantier) => {
              const statusConfig = CHANTIER_STATUS[chantier.status];
              const StatusIcon = statusConfig.icon;

              return (
                <Card key={chantier.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{chantier.nom}</CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {chantier.adresse}
                        </CardDescription>
                      </div>
                      <Badge className={statusConfig.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Avancement */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Avancement</span>
                        <span className="font-medium">{chantier.avancement}%</span>
                      </div>
                      <Progress value={chantier.avancement} />
                    </div>

                    {/* Infos */}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        {chantier.entreprisesActives} {labels.entreprisesLabel}
                      </div>
                      {chantier.montant && chantier.montant > 0 && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Euro className="h-4 w-4" />
                          {new Intl.NumberFormat('fr-FR').format(chantier.montant)} €
                        </div>
                      )}
                    </div>

                    {/* Alertes */}
                    {chantier.alertes > 0 && (
                      <div className="flex items-center gap-2 text-orange-600 text-sm">
                        <AlertTriangle className="h-4 w-4" />
                        {chantier.alertes} alerte(s)
                      </div>
                    )}

                    {/* Actions rapides */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => navigate(`/phase2/${chantier.projectId}/planning`)}
                      >
                        <Calendar className="h-3 w-3 mr-1" />
                        {labels.planningLabel}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => navigate(`/phase2/${chantier.projectId}/reunions`)}
                      >
                        <Users className="h-3 w-3 mr-1" />
                        {labels.reunionsLabel}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => navigate(`/phase2/${chantier.projectId}/journal`)}
                      >
                        <ClipboardList className="h-3 w-3 mr-1" />
                        {labels.journalLabel}
                      </Button>
                    </div>

                    {/* Voir détails */}
                    <Button
                      className="w-full"
                      onClick={() => navigate(`/phase2/${chantier.projectId}`)}
                    >
                      {labels.voirChantierLabel}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          /* List View */
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {filteredChantiers.map((chantier) => {
                  const statusConfig = CHANTIER_STATUS[chantier.status];
                  const StatusIcon = statusConfig.icon;

                  return (
                    <div
                      key={chantier.id}
                      className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <HardHat className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium truncate">{chantier.nom}</h3>
                            <Badge variant="outline" className="text-xs">
                              {chantier.reference}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {chantier.adresse}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="hidden md:block w-32">
                          <div className="flex justify-between text-xs mb-1">
                            <span>Avancement</span>
                            <span>{chantier.avancement}%</span>
                          </div>
                          <Progress value={chantier.avancement} className="h-2" />
                        </div>

                        <Badge className={statusConfig.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig.label}
                        </Badge>

                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/phase2/${chantier.projectId}/planning`)}
                            title={labels.planningLabel}
                          >
                            <Calendar className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/phase2/${chantier.projectId}/reunions`)}
                            title={labels.reunionsLabel}
                          >
                            <Users className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/phase2/${chantier.projectId}/journal`)}
                            title={labels.journalLabel}
                          >
                            <ClipboardList className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/phase2/${chantier.projectId}`)}
                            title={labels.voirChantierLabel}
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

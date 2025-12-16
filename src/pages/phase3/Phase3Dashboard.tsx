/**
 * TORP Phase 3 - Dashboard Exécution des Travaux
 * Vue d'ensemble de l'avancement, contrôles qualité, coordination et situations
 * ZÉRO MOCK - Données réelles depuis Supabase
 */

import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp,
  ClipboardCheck,
  Euro,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Users,
  FileText,
  CheckCircle2,
  Clock,
  HardHat,
} from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { useProjectDetails } from '@/hooks/useProjectDetails';
import { useQualityControls, useSituations, useCoordination, useProgressReport } from '@/hooks/phase3';

export default function Phase3Dashboard() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  // Hook pour les détails du projet
  const {
    project,
    isLoading: isLoadingProject,
  } = useProjectDetails({
    projectId: projectId || '',
    enabled: !!projectId,
  });

  // Hooks phase 3
  const { stats: controlStats, isLoading: isLoadingControls } = useQualityControls(projectId || '');
  const { stats: situationStats, isLoading: isLoadingSituations } = useSituations(projectId || '');
  const { reunions, incidents, isLoading: isLoadingCoordination } = useCoordination(projectId || '');
  const { report, isLoading: isLoadingReport } = useProgressReport(projectId || '');

  const isLoading = isLoadingProject || isLoadingControls || isLoadingSituations || isLoadingCoordination;

  // État de chargement
  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-9 w-64 mb-2" />
              <Skeleton className="h-5 w-48" />
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-8 w-40" />
            </div>
          </div>

          {/* KPIs Skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded" />
                    <div>
                      <Skeleton className="h-8 w-16 mb-1" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Content Skeleton */}
          <Card>
            <CardContent className="pt-6">
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <HardHat className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Projet non trouvé</h2>
          <p className="text-muted-foreground mb-4">Ce projet n'existe pas ou vous n'y avez pas accès.</p>
          <Button onClick={() => navigate('/phase2/chantiers')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour aux chantiers
          </Button>
        </div>
      </AppLayout>
    );
  }

  // Calculs d'avancement
  const progression = report?.progression || project.progress || 0;
  const budgetConsomme = project.budget?.spent || 0;
  const budgetTotal = project.budget?.total || 1;
  const budgetPourcent = Math.round((budgetConsomme / budgetTotal) * 100);

  // Incidents non résolus
  const incidentsOuverts = incidents?.filter(i => !i.resolved)?.length || 0;

  const handleNextPhase = () => {
    navigate(`/phase4/${projectId}`);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="sm" onClick={() => navigate('/phase2/chantiers')}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Chantiers
              </Button>
            </div>
            <h1 className="text-3xl font-bold">{project.name}</h1>
            <p className="text-muted-foreground">Exécution des travaux</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold">{progression}%</div>
              <div className="text-sm text-muted-foreground">Avancement global</div>
            </div>
            <Badge className="text-lg px-4 py-2 bg-green-600">
              Phase 3 - Exécution
            </Badge>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-blue-500" />
                <div>
                  <div className="text-2xl font-bold">{progression}%</div>
                  <div className="text-sm text-muted-foreground">Avancement</div>
                </div>
              </div>
              <Progress value={progression} className="mt-3 h-2" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Euro className="h-8 w-8 text-green-500" />
                <div>
                  <div className="text-2xl font-bold">{budgetPourcent}%</div>
                  <div className="text-sm text-muted-foreground">Budget consommé</div>
                </div>
              </div>
              <Progress value={budgetPourcent} className="mt-3 h-2" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <ClipboardCheck className="h-8 w-8 text-purple-500" />
                <div>
                  <div className="text-2xl font-bold">{controlStats?.passRate || 0}%</div>
                  <div className="text-sm text-muted-foreground">Qualité</div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {controlStats?.total || 0} contrôles effectués
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className={`h-8 w-8 ${incidentsOuverts > 0 ? 'text-orange-500' : 'text-gray-400'}`} />
                <div>
                  <div className="text-2xl font-bold">{incidentsOuverts}</div>
                  <div className="text-sm text-muted-foreground">Incidents ouverts</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Onglets */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="controles">Contrôles</TabsTrigger>
            <TabsTrigger value="coordination">Coordination</TabsTrigger>
            <TabsTrigger value="situations">Situations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Avancement par lot */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Avancement par lot
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {project.phases && project.phases.length > 0 ? (
                    <div className="space-y-4">
                      {project.phases.slice(0, 5).map((phase) => (
                        <div key={phase.id}>
                          <div className="flex justify-between text-sm mb-1">
                            <span>{phase.name}</span>
                            <span className="font-medium">{phase.progress}%</span>
                          </div>
                          <Progress value={phase.progress} className="h-2" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      Aucune phase définie
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Prochaines échéances */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Prochaines échéances
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {reunions && reunions.length > 0 ? (
                    <div className="space-y-3">
                      {reunions.slice(0, 4).map((reunion) => (
                        <div key={reunion.id} className="flex items-center gap-3 p-2 border rounded-lg">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1">
                            <div className="font-medium text-sm">{reunion.objet || 'Réunion'}</div>
                            <div className="text-xs text-muted-foreground">
                              {reunion.date_reunion ? new Date(reunion.date_reunion).toLocaleDateString('fr-FR') : 'Date à définir'}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {reunion.type || 'RDV'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      Aucune réunion planifiée
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Alertes */}
            {project.alerts && project.alerts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    Alertes en cours
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {project.alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-3 rounded-lg border ${
                          alert.type === 'error'
                            ? 'bg-red-50 border-red-200'
                            : alert.type === 'warning'
                            ? 'bg-orange-50 border-orange-200'
                            : 'bg-blue-50 border-blue-200'
                        }`}
                      >
                        <div className="font-medium text-sm">{alert.message}</div>
                        <div className="text-xs text-muted-foreground mt-1">{alert.date}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="controles">
            <Card>
              <CardHeader>
                <CardTitle>Contrôles Qualité</CardTitle>
                <CardDescription>Suivi des contrôles et non-conformités</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{controlStats?.passed || 0}</div>
                    <div className="text-sm text-muted-foreground">Conformes</div>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">{controlStats?.pending || 0}</div>
                    <div className="text-sm text-muted-foreground">En attente</div>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{controlStats?.failed || 0}</div>
                    <div className="text-sm text-muted-foreground">Non-conformes</div>
                  </div>
                </div>
                <Button asChild>
                  <Link to={`/phase3/${projectId}/controles`}>
                    Voir tous les contrôles
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="coordination">
            <Card>
              <CardHeader>
                <CardTitle>Coordination Chantier</CardTitle>
                <CardDescription>Réunions, incidents et suivi des intervenants</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-5 w-5 text-blue-500" />
                      <span className="font-medium">Réunions</span>
                    </div>
                    <div className="text-2xl font-bold">{reunions?.length || 0}</div>
                    <div className="text-sm text-muted-foreground">planifiées</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                      <span className="font-medium">Incidents</span>
                    </div>
                    <div className="text-2xl font-bold">{incidents?.length || 0}</div>
                    <div className="text-sm text-muted-foreground">signalés</div>
                  </div>
                </div>
                <Button asChild>
                  <Link to={`/phase3/${projectId}/coordination`}>
                    Accéder à la coordination
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="situations">
            <Card>
              <CardHeader>
                <CardTitle>Situations de Travaux</CardTitle>
                <CardDescription>Suivi financier et avancements mensuels</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-5 w-5 text-green-500" />
                      <span className="font-medium">Situations</span>
                    </div>
                    <div className="text-2xl font-bold">{situationStats?.total || 0}</div>
                    <div className="text-sm text-muted-foreground">établies</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Euro className="h-5 w-5 text-blue-500" />
                      <span className="font-medium">Montant cumulé</span>
                    </div>
                    <div className="text-2xl font-bold">
                      {(situationStats?.montantCumule || budgetConsomme).toLocaleString('fr-FR')} €
                    </div>
                    <div className="text-sm text-muted-foreground">facturé</div>
                  </div>
                </div>
                <Button asChild>
                  <Link to={`/phase3/${projectId}/situations`}>
                    Gérer les situations
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Action vers Phase 4 */}
        {progression >= 90 && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <h3 className="font-bold text-lg text-green-800">Travaux quasi terminés !</h3>
                  </div>
                  <p className="text-green-600">Préparez les opérations de réception.</p>
                </div>
                <Button onClick={handleNextPhase} size="lg" className="bg-green-600 hover:bg-green-700">
                  Phase 4 - Réception
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

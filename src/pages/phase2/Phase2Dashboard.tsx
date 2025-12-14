/**
 * TORP Phase 2 - Dashboard Chantier
 * Vue d'ensemble d'un chantier en préparation/exécution
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Building2,
  Calendar,
  FileText,
  Users,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  ClipboardList,
  Truck,
  HardHat,
  ArrowLeft,
} from 'lucide-react';

import { ChantierService, ReunionService, PlanningService, LogistiqueService } from '@/services/phase2';
import type { Chantier, ChantierAlerte, Reunion, ChecklistDemarrage } from '@/types/phase2';
import type { PlanningStats } from '@/services/phase2/planning.service';

const STATUT_LABELS: Record<string, { label: string; color: string }> = {
  preparation: { label: 'En préparation', color: 'bg-yellow-500' },
  ordre_service: { label: 'OS émis', color: 'bg-blue-500' },
  en_cours: { label: 'En cours', color: 'bg-green-500' },
  suspendu: { label: 'Suspendu', color: 'bg-orange-500' },
  reception: { label: 'Réception', color: 'bg-purple-500' },
  garantie_parfait_achevement: { label: 'GPA', color: 'bg-indigo-500' },
  clos: { label: 'Clos', color: 'bg-gray-500' },
};

export default function Phase2Dashboard() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [chantier, setChantier] = useState<Chantier | null>(null);
  const [alertes, setAlertes] = useState<ChantierAlerte[]>([]);
  const [prochaineReunion, setProchaineReunion] = useState<Reunion | null>(null);
  const [planningStats, setPlanningStats] = useState<PlanningStats | null>(null);
  const [checklist, setChecklist] = useState<ChecklistDemarrage | null>(null);

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  const loadData = async () => {
    if (!projectId) return;

    try {
      setLoading(true);

      // Charger le chantier
      let loadedChantier = await ChantierService.getChantierByProject(projectId);

      // Si pas de chantier, en créer un
      if (!loadedChantier) {
        loadedChantier = await ChantierService.createChantier({
          projectId,
          nom: 'Nouveau chantier',
        });

        // Créer aussi l'installation et la checklist
        await LogistiqueService.createInstallation(loadedChantier.id);
        await LogistiqueService.createChecklist(loadedChantier.id);
      }

      setChantier(loadedChantier);

      // Charger les données associées en parallèle
      const [alertesData, reunionData, statsData, checklistData] = await Promise.all([
        ChantierService.getAlertes(loadedChantier.id),
        ReunionService.getProchaineReunion(loadedChantier.id),
        PlanningService.getStats(loadedChantier.id),
        LogistiqueService.getChecklist(loadedChantier.id),
      ]);

      setAlertes(alertesData);
      setProchaineReunion(reunionData);
      setPlanningStats(statsData);
      setChecklist(checklistData);
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!chantier) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>
            Impossible de charger le chantier. Veuillez réessayer.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const statutConfig = STATUT_LABELS[chantier.statut] || { label: chantier.statut, color: 'bg-gray-500' };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{chantier.nom}</h1>
              <Badge className={`${statutConfig.color} text-white`}>
                {statutConfig.label}
              </Badge>
            </div>
            {chantier.reference && (
              <p className="text-muted-foreground">Réf: {chantier.reference}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={`/phase2/${projectId}/planning`}>
              <Calendar className="h-4 w-4 mr-2" />
              Planning
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/phase2/${projectId}/reunions`}>
              <Users className="h-4 w-4 mr-2" />
              Réunions
            </Link>
          </Button>
        </div>
      </div>

      {/* Alertes */}
      {alertes.length > 0 && (
        <div className="mb-6 space-y-2">
          {alertes.map((alerte, index) => (
            <Alert key={index} variant={alerte.niveau === 'error' ? 'destructive' : 'default'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{alerte.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Métriques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Avancement global */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avancement global
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="text-3xl font-bold">{chantier.avancementGlobal}%</div>
              <Progress value={chantier.avancementGlobal} className="flex-1" />
            </div>
          </CardContent>
        </Card>

        {/* Dates */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Délais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {chantier.dateDebutPrevue && (
                <div className="flex justify-between text-sm">
                  <span>Début:</span>
                  <span className="font-medium">
                    {new Date(chantier.dateDebutPrevue).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              )}
              {chantier.dateFinPrevue && (
                <div className="flex justify-between text-sm">
                  <span>Fin:</span>
                  <span className="font-medium">
                    {new Date(chantier.dateFinPrevue).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Budget */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Montant marché
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {chantier.montantMarcheHT
                ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(chantier.montantMarcheHT)
                : '-'}
            </div>
            {chantier.montantTravauxSupHT && chantier.montantTravauxSupHT > 0 && (
              <p className="text-sm text-muted-foreground">
                +{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(chantier.montantTravauxSupHT)} TS
              </p>
            )}
          </CardContent>
        </Card>

        {/* Checklist démarrage */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Checklist démarrage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="text-3xl font-bold">{checklist?.pourcentageCompletion || 0}%</div>
              {checklist?.peutDemarrer ? (
                <Badge className="bg-green-500 text-white">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Prêt
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <Clock className="h-3 w-3 mr-1" />
                  En cours
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contenu principal */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="planning">Planning</TabsTrigger>
          <TabsTrigger value="logistique">Logistique</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        {/* Vue d'ensemble */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Prochaine réunion */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Prochaine réunion
                </CardTitle>
              </CardHeader>
              <CardContent>
                {prochaineReunion ? (
                  <div className="space-y-2">
                    <p className="font-medium">{prochaineReunion.titre}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(prochaineReunion.dateReunion).toLocaleDateString('fr-FR')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {prochaineReunion.heureDebut}
                      </span>
                    </div>
                    {prochaineReunion.lieu && (
                      <p className="text-sm">{prochaineReunion.lieu}</p>
                    )}
                    <Button className="mt-2" variant="outline" size="sm" asChild>
                      <Link to={`/phase2/${projectId}/reunions/${prochaineReunion.id}`}>
                        Voir détails
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground mb-2">Aucune réunion planifiée</p>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/phase2/${projectId}/reunions/nouvelle`}>
                        Planifier une réunion
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Statistiques planning */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Statistiques planning
                </CardTitle>
              </CardHeader>
              <CardContent>
                {planningStats && planningStats.nombreTaches > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{planningStats.nombreLots}</p>
                      <p className="text-sm text-muted-foreground">Lots</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{planningStats.nombreTaches}</p>
                      <p className="text-sm text-muted-foreground">Tâches</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{planningStats.tachesTerminees}</p>
                      <p className="text-sm text-muted-foreground">Terminées</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">{planningStats.tachesEnRetard}</p>
                      <p className="text-sm text-muted-foreground">En retard</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground mb-2">Aucune tâche planifiée</p>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/phase2/${projectId}/planning`}>
                        Créer le planning
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions rapides */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Actions rapides
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button variant="outline" className="h-auto py-4 flex-col" asChild>
                    <Link to={`/phase2/${projectId}/os/nouveau`}>
                      <FileText className="h-6 w-6 mb-2" />
                      <span>Nouvel OS</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-auto py-4 flex-col" asChild>
                    <Link to={`/phase2/${projectId}/journal`}>
                      <ClipboardList className="h-6 w-6 mb-2" />
                      <span>Journal</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-auto py-4 flex-col" asChild>
                    <Link to={`/phase2/${projectId}/approvisionnements`}>
                      <Truck className="h-6 w-6 mb-2" />
                      <span>Appro.</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-auto py-4 flex-col" asChild>
                    <Link to={`/phase2/${projectId}/installation`}>
                      <HardHat className="h-6 w-6 mb-2" />
                      <span>Installation</span>
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Planning */}
        <TabsContent value="planning">
          <Card>
            <CardHeader>
              <CardTitle>Planning d'exécution</CardTitle>
              <CardDescription>
                Diagramme de Gantt et gestion des tâches
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  Consultez le planning détaillé pour gérer les lots et les tâches
                </p>
                <Button asChild>
                  <Link to={`/phase2/${projectId}/planning`}>
                    Ouvrir le planning
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logistique */}
        <TabsContent value="logistique">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardHat className="h-5 w-5" />
                  Installation chantier
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" asChild>
                  <Link to={`/phase2/${projectId}/installation`}>
                    Gérer l'installation
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Approvisionnements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" asChild>
                  <Link to={`/phase2/${projectId}/approvisionnements`}>
                    Gérer les approvisionnements
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Checklist démarrage
                </CardTitle>
              </CardHeader>
              <CardContent>
                {checklist && (
                  <div className="space-y-2">
                    <Progress value={checklist.pourcentageCompletion} />
                    <p className="text-sm text-muted-foreground">
                      {checklist.itemsValides} / {checklist.itemsTotal} items validés
                    </p>
                  </div>
                )}
                <Button variant="outline" className="w-full mt-4" asChild>
                  <Link to={`/phase2/${projectId}/checklist`}>
                    Voir la checklist
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Journal de chantier
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" asChild>
                  <Link to={`/phase2/${projectId}/journal`}>
                    Accéder au journal
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documents chantier
              </CardTitle>
              <CardDescription>
                Gestion des documents administratifs et techniques
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to={`/phase2/${projectId}/documents`}>
                  Gérer les documents
                </Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

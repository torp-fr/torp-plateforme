/**
 * TORP Phase 4 - Dashboard Réception & Garanties
 * Vue d'ensemble de la réception des travaux et suivi des garanties
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  ClipboardCheck,
  FileCheck,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  FileText,
  Building2,
  ArrowLeft,
  ArrowRight,
  Home,
  Users,
  Euro,
  Camera,
  BookOpen,
  ChevronRight,
} from 'lucide-react';

import { OPRSessionCard, ReservesList, GarantiesTracker, DOEProgress } from '@/components/phase4';
import {
  oprService,
  receptionService,
  reservesService,
  garantiesService,
  doeDiuoService,
} from '@/services/phase4';
import type { OPRSession, Reception, Reserve, Garantie, DOE } from '@/types/phase4.types';

export default function Phase4Dashboard() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const chantierId = projectId || '';

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // États
  const [oprSessions, setOprSessions] = useState<OPRSession[]>([]);
  const [reception, setReception] = useState<Reception | null>(null);
  const [reserves, setReserves] = useState<Reserve[]>([]);
  const [garanties, setGaranties] = useState<Garantie[]>([]);
  const [doe, setDoe] = useState<DOE | null>(null);

  // Stats calculés
  const [stats, setStats] = useState({
    reservesOuvertes: 0,
    reservesEnRetard: 0,
    reservesLevees: 0,
    tauxLevee: 0,
    garantiesActives: 0,
    garantiesExpirantBientot: 0,
    doeComplet: false,
    doeProgres: 0,
  });

  useEffect(() => {
    if (chantierId) {
      loadData();
    }
  }, [chantierId]);

  const loadData = async () => {
    if (!chantierId) return;

    try {
      setLoading(true);

      // Charger toutes les données en parallèle
      const [
        oprData,
        receptionData,
        reservesData,
        garantiesData,
        doeData,
      ] = await Promise.all([
        oprService.getSessionsByChantier(chantierId),
        receptionService.getReceptionByChantier(chantierId),
        reservesService.getReservesByChantier(chantierId),
        garantiesService.getGarantiesByChantier(chantierId),
        doeDiuoService.getDOEByChantier(chantierId),
      ]);

      setOprSessions(oprData);
      setReception(receptionData);
      setReserves(reservesData);
      setGaranties(garantiesData);
      setDoe(doeData);

      // Calculer les stats
      const now = new Date();
      const reservesOuvertes = reservesData.filter(r => ['ouverte', 'en_cours'].includes(r.statut)).length;
      const reservesEnRetard = reservesData.filter(r =>
        ['ouverte', 'en_cours'].includes(r.statut) && new Date(r.dateEcheance) < now
      ).length;
      const reservesLevees = reservesData.filter(r => r.statut === 'levee').length;
      const garantiesActives = garantiesData.filter(g => g.active).length;

      // Garanties expirant dans 90 jours
      const in90Days = new Date();
      in90Days.setDate(in90Days.getDate() + 90);
      const garantiesExpirantBientot = garantiesData.filter(g =>
        g.active && new Date(g.dateFin) <= in90Days && new Date(g.dateFin) > now
      ).length;

      setStats({
        reservesOuvertes,
        reservesEnRetard,
        reservesLevees,
        tauxLevee: reservesData.length > 0 ? Math.round((reservesLevees / reservesData.length) * 100) : 0,
        garantiesActives,
        garantiesExpirantBientot,
        doeComplet: doeData?.statut === 'complet' || doeData?.statut === 'remis' || doeData?.statut === 'valide',
        doeProgres: doeData?.pourcentageComplet || 0,
      });

    } catch (error) {
      console.error('[Phase4] Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPhaseStatus = () => {
    if (!reception) {
      const latestOPR = oprSessions[0];
      if (!latestOPR) {
        return { label: 'OPR à planifier', color: 'bg-gray-500', step: 1 };
      }
      if (latestOPR.statut === 'planifiee') {
        return { label: 'OPR planifiée', color: 'bg-blue-500', step: 1 };
      }
      if (latestOPR.statut === 'en_cours') {
        return { label: 'OPR en cours', color: 'bg-orange-500', step: 1 };
      }
      if (latestOPR.statut === 'terminee') {
        return { label: 'Prêt pour réception', color: 'bg-yellow-500', step: 2 };
      }
    }

    if (reception) {
      if (reception.decision === 'refusee') {
        return { label: 'Réception refusée', color: 'bg-red-500', step: 2 };
      }
      if (reception.decision === 'reportee') {
        return { label: 'Réception reportée', color: 'bg-orange-500', step: 2 };
      }
      if (reception.nombreReservesLevees < reception.nombreReserves) {
        return { label: 'Levée des réserves', color: 'bg-purple-500', step: 3 };
      }
      return { label: 'Période de garantie', color: 'bg-green-500', step: 4 };
    }

    return { label: 'En cours', color: 'bg-gray-500', step: 0 };
  };

  const phaseStatus = getPhaseStatus();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement de la phase réception...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(`/project/${chantierId}`)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">Phase 4 : Réception & Garanties</h1>
                <p className="text-sm text-muted-foreground">
                  Projet #{chantierId.slice(0, 8)}
                </p>
              </div>
            </div>
            <Badge className={`${phaseStatus.color} text-white`}>
              {phaseStatus.label}
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Progression globale */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Progression Phase 4</span>
              <span className="text-sm text-muted-foreground">Étape {phaseStatus.step}/4</span>
            </div>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={`flex-1 h-2 rounded ${
                    step <= phaseStatus.step ? 'bg-purple-600' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>OPR</span>
              <span>Réception</span>
              <span>Réserves</span>
              <span>Garanties</span>
            </div>
          </CardContent>
        </Card>

        {/* Alertes */}
        {stats.reservesEnRetard > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Réserves en retard</AlertTitle>
            <AlertDescription>
              {stats.reservesEnRetard} réserve(s) ont dépassé leur date d'échéance et nécessitent une action immédiate.
            </AlertDescription>
          </Alert>
        )}

        {stats.garantiesExpirantBientot > 0 && (
          <Alert className="border-orange-200 bg-orange-50">
            <Clock className="h-4 w-4 text-orange-600" />
            <AlertTitle className="text-orange-800">Garanties bientôt expirées</AlertTitle>
            <AlertDescription className="text-orange-700">
              {stats.garantiesExpirantBientot} garantie(s) expire(nt) dans les 90 prochains jours.
            </AlertDescription>
          </Alert>
        )}

        {/* Navigation tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="opr">OPR</TabsTrigger>
            <TabsTrigger value="reserves">Réserves</TabsTrigger>
            <TabsTrigger value="garanties">Garanties</TabsTrigger>
            <TabsTrigger value="doe">DOE</TabsTrigger>
          </TabsList>

          {/* Vue d'ensemble */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Sessions OPR
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{oprSessions.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {oprSessions.filter(s => s.statut === 'terminee').length} terminée(s)
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Réserves
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{reserves.length}</div>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="destructive" className="text-xs">
                      {stats.reservesOuvertes} ouvertes
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {stats.tauxLevee}% levées
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Garanties actives
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.garantiesActives}</div>
                  <p className="text-xs text-muted-foreground">
                    sur {garanties.length} garanties
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    DOE
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.doeProgres}%</div>
                  <Progress value={stats.doeProgres} className="h-2 mt-2" />
                </CardContent>
              </Card>
            </div>

            {/* Sections principales */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Dernière session OPR */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-purple-600" />
                    Opérations Préalables
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {oprSessions.length > 0 ? (
                    <OPRSessionCard
                      session={oprSessions[0]}
                      onSelect={() => setActiveTab('opr')}
                      onUpdate={loadData}
                    />
                  ) : (
                    <div className="text-center py-8">
                      <ClipboardCheck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-muted-foreground mb-4">
                        Aucune session OPR planifiée
                      </p>
                      <Button onClick={() => setActiveTab('opr')}>
                        Planifier une OPR
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* État réception */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileCheck className="h-5 w-5 text-green-600" />
                    Réception des travaux
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {reception ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Décision</span>
                        <Badge className={
                          reception.decision === 'acceptee_sans_reserve' ? 'bg-green-600' :
                          reception.decision === 'acceptee_avec_reserves' ? 'bg-orange-600' :
                          reception.decision === 'refusee' ? 'bg-red-600' : 'bg-gray-600'
                        }>
                          {reception.decision === 'acceptee_sans_reserve' ? 'Acceptée sans réserve' :
                           reception.decision === 'acceptee_avec_reserves' ? 'Acceptée avec réserves' :
                           reception.decision === 'refusee' ? 'Refusée' : 'Reportée'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Date</span>
                        <span>{new Date(reception.dateReception).toLocaleDateString('fr-FR')}</span>
                      </div>
                      {reception.nombreReserves > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Réserves levées</span>
                          <span>{reception.nombreReservesLevees}/{reception.nombreReserves}</span>
                        </div>
                      )}
                      {reception.pvSigne && (
                        <Button variant="outline" className="w-full">
                          <FileText className="h-4 w-4 mr-2" />
                          Voir le PV de réception
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FileCheck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-muted-foreground mb-4">
                        Réception non encore prononcée
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Terminez d'abord les opérations préalables
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Résumé réserves et garanties */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Résumé réserves */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    Réserves
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('reserves')}>
                    Voir tout
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {reserves.length > 0 ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="p-3 bg-red-50 rounded-lg">
                          <div className="text-2xl font-bold text-red-700">{stats.reservesOuvertes}</div>
                          <div className="text-xs text-red-600">Ouvertes</div>
                        </div>
                        <div className="p-3 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-700">{stats.reservesLevees}</div>
                          <div className="text-xs text-green-600">Levées</div>
                        </div>
                        <div className="p-3 bg-orange-50 rounded-lg">
                          <div className="text-2xl font-bold text-orange-700">{stats.reservesEnRetard}</div>
                          <div className="text-xs text-orange-600">En retard</div>
                        </div>
                      </div>
                      <Progress value={stats.tauxLevee} className="h-2" />
                      <p className="text-sm text-center text-muted-foreground">
                        {stats.tauxLevee}% des réserves levées
                      </p>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-4">
                      Aucune réserve enregistrée
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Résumé garanties */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-purple-600" />
                    Garanties
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('garanties')}>
                    Voir tout
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {garanties.length > 0 ? (
                    <div className="space-y-3">
                      {garanties.slice(0, 3).map((garantie) => {
                        const joursRestants = Math.ceil(
                          (new Date(garantie.dateFin).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                        );
                        return (
                          <div key={garantie.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Shield className={`h-4 w-4 ${garantie.active ? 'text-green-600' : 'text-gray-400'}`} />
                              <span className="text-sm font-medium">
                                {garantie.type === 'parfait_achevement' ? '1 an' :
                                 garantie.type === 'biennale' ? '2 ans' : '10 ans'}
                              </span>
                            </div>
                            <Badge variant={garantie.active ? 'default' : 'secondary'}>
                              {garantie.active ? `${joursRestants}j` : 'Expirée'}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-4">
                      Garanties non encore activées
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* OPR */}
          <TabsContent value="opr" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Opérations Préalables à la Réception</h2>
              <Button>
                <Calendar className="h-4 w-4 mr-2" />
                Planifier une OPR
              </Button>
            </div>

            {oprSessions.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {oprSessions.map((session) => (
                  <OPRSessionCard
                    key={session.id}
                    session={session}
                    onUpdate={loadData}
                  />
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <ClipboardCheck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucune session OPR</h3>
                <p className="text-muted-foreground mb-4">
                  Planifiez une session d'opérations préalables pour préparer la réception des travaux.
                </p>
                <Button>
                  <Calendar className="h-4 w-4 mr-2" />
                  Planifier la première OPR
                </Button>
              </Card>
            )}
          </TabsContent>

          {/* Réserves */}
          <TabsContent value="reserves">
            <ReservesList
              chantierId={chantierId}
              userRole="maitre_ouvrage"
            />
          </TabsContent>

          {/* Garanties */}
          <TabsContent value="garanties">
            <GarantiesTracker chantierId={chantierId} />
          </TabsContent>

          {/* DOE */}
          <TabsContent value="doe">
            <DOEProgress
              chantierId={chantierId}
              onCreateCarnet={() => {/* TODO */}}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

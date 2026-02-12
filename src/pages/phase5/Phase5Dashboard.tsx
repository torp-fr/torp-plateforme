/**
 * Phase5Dashboard - Maintenance & Exploitation
 * Dashboard principal de la Phase 5 : Carnet numérique du logement
 */

import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  BookOpen,
  FileCheck,
  Wrench,
  AlertTriangle,
  Calendar,
  Shield,
  Home,
  FileText,
  Clock,
  CheckCircle2,
  Plus,
  Download,
} from 'lucide-react';
import { useCarnet } from '@/hooks/phase5/useCarnet';

export function Phase5Dashboard() {
  const { projectId } = useParams<{ projectId: string }>();
  const {
    carnet,
    travaux,
    diagnostics,
    entretiens,
    garanties,
    sinistres,
    stats,
    isLoading,
  } = useCarnet({ projectId: projectId! });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Alertes prioritaires
  const alertes = [];
  if (stats.entretiensEnRetard > 0) {
    alertes.push({
      type: 'warning',
      title: 'Entretiens en retard',
      description: `${stats.entretiensEnRetard} entretien(s) à réaliser de toute urgence`,
    });
  }
  if (stats.diagnosticsARenouveler > 0) {
    alertes.push({
      type: 'warning',
      title: 'Diagnostics à renouveler',
      description: `${stats.diagnosticsARenouveler} diagnostic(s) expiré(s) ou à renouveler`,
    });
  }
  if (stats.sinistresEnCours > 0) {
    alertes.push({
      type: 'destructive',
      title: 'Sinistres en cours',
      description: `${stats.sinistresEnCours} sinistre(s) en cours de traitement`,
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-purple-100 text-purple-800">Phase 5</Badge>
            <Badge variant="outline">Maintenance</Badge>
          </div>
          <h1 className="text-3xl font-bold">Carnet Numérique du Logement</h1>
          <p className="text-muted-foreground">
            Historique, diagnostics, entretiens et garanties de votre bien
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exporter le carnet
          </Button>
          <Button>
            <BookOpen className="h-4 w-4 mr-2" />
            Consulter le carnet
          </Button>
        </div>
      </div>

      {/* Alertes */}
      {alertes.length > 0 && (
        <div className="space-y-2">
          {alertes.map((alerte, index) => (
            <Alert key={index} variant={alerte.type as 'default' | 'destructive'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{alerte.title}</AlertTitle>
              <AlertDescription>{alerte.description}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Shield className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.garantiesActives}</p>
                <p className="text-sm text-muted-foreground">Garanties actives</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileCheck className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{diagnostics.filter(d => d.statut === 'valide').length}</p>
                <p className="text-sm text-muted-foreground">Diagnostics à jour</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Wrench className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{entretiens.filter(e => e.statut === 'a_faire').length}</p>
                <p className="text-sm text-muted-foreground">Entretiens planifiés</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <FileText className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{travaux.length}</p>
                <p className="text-sm text-muted-foreground">Travaux réalisés</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contenu principal */}
      <Tabs defaultValue="carnet">
        <TabsList>
          <TabsTrigger value="carnet">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="travaux">Historique travaux</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
          <TabsTrigger value="entretien">Entretien</TabsTrigger>
          <TabsTrigger value="sinistres">Sinistres</TabsTrigger>
        </TabsList>

        <TabsContent value="carnet" className="mt-4 space-y-4">
          {/* Informations du bien */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5" />
                Informations du bien
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Adresse</p>
                  <p className="font-medium">{carnet?.bien?.adresse || 'Non renseignée'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Type de bien</p>
                  <p className="font-medium capitalize">{carnet?.bien?.type || 'Non renseigné'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Surface</p>
                  <p className="font-medium">{carnet?.bien?.surface_habitable || '?'} m²</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Prochaines échéances */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Prochain entretien</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.prochainEntretien ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{stats.prochainEntretien.titre}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(stats.prochainEntretien.prochaine_echeance).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <Badge variant={stats.prochainEntretien.statut === 'en_retard' ? 'destructive' : 'outline'}>
                      {stats.prochainEntretien.priorite}
                    </Badge>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Aucun entretien planifié</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Prochain diagnostic à renouveler</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.prochainDiagnostic ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium capitalize">{stats.prochainDiagnostic.type}</p>
                      <p className="text-sm text-muted-foreground">
                        Expire le {new Date(stats.prochainDiagnostic.date_validite).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <Badge variant="destructive">À renouveler</Badge>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Tous les diagnostics sont à jour</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="travaux" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Historique des travaux</CardTitle>
                <CardDescription>Tous les travaux réalisés sur le bien</CardDescription>
              </div>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter
              </Button>
            </CardHeader>
            <CardContent>
              {travaux.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucun travaux enregistré
                </p>
              ) : (
                <div className="space-y-4">
                  {travaux.map((t) => (
                    <div key={t.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{t.description}</span>
                        <Badge variant="outline">
                          {new Date(t.date_realisation).toLocaleDateString('fr-FR')}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Type: {t.type}</span>
                        <span>Montant: {t.montant_total?.toLocaleString('fr-FR')} €</span>
                        <span>Lots: {t.lots?.join(', ')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diagnostics" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Diagnostics obligatoires</CardTitle>
                <CardDescription>État des diagnostics du bien</CardDescription>
              </div>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter
              </Button>
            </CardHeader>
            <CardContent>
              {diagnostics.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucun diagnostic enregistré
                </p>
              ) : (
                <div className="space-y-4">
                  {diagnostics.map((d) => (
                    <div key={d.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileCheck className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium capitalize">{d.type.replace('_', ' ')}</p>
                          <p className="text-sm text-muted-foreground">
                            Valide jusqu'au {new Date(d.date_validite).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          d.statut === 'valide' ? 'default' :
                          d.statut === 'a_renouveler' ? 'secondary' : 'destructive'
                        }
                      >
                        {d.statut === 'valide' ? 'Valide' :
                         d.statut === 'a_renouveler' ? 'À renouveler' : 'Expiré'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entretien" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Planning d'entretien</CardTitle>
                <CardDescription>Entretiens programmés et réalisés</CardDescription>
              </div>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Planifier
              </Button>
            </CardHeader>
            <CardContent>
              {entretiens.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucun entretien planifié
                </p>
              ) : (
                <div className="space-y-4">
                  {entretiens.map((e) => (
                    <div key={e.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {e.statut === 'realise' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : e.statut === 'en_retard' ? (
                          <AlertTriangle className="h-5 w-5 text-red-600" />
                        ) : (
                          <Clock className="h-5 w-5 text-orange-600" />
                        )}
                        <div>
                          <p className="font-medium">{e.titre}</p>
                          <p className="text-sm text-muted-foreground">
                            {e.statut === 'realise'
                              ? `Réalisé le ${new Date(e.derniere_realisation!).toLocaleDateString('fr-FR')}`
                              : `Prévu le ${new Date(e.prochaine_echeance).toLocaleDateString('fr-FR')}`
                            }
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={e.priorite === 'haute' ? 'destructive' : 'outline'}>
                          {e.priorite}
                        </Badge>
                        {e.statut !== 'realise' && (
                          <Button variant="outline" size="sm">
                            Marquer réalisé
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sinistres" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Déclarations de sinistres</CardTitle>
                <CardDescription>Historique des sinistres et réclamations</CardDescription>
              </div>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Déclarer
              </Button>
            </CardHeader>
            <CardContent>
              {sinistres.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucun sinistre déclaré
                </p>
              ) : (
                <div className="space-y-4">
                  {sinistres.map((s) => (
                    <div key={s.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{s.description}</span>
                        <Badge>{s.statut}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Type: {s.type} • Déclaré le {new Date(s.date_declaration).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default Phase5Dashboard;

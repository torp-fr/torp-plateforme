/**
 * GarantiesPage - Suivi des garanties
 * Gestion des garanties légales : parfait achèvement, biennale, décennale
 */

import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  Plus,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Building2,
} from 'lucide-react';
import { useWarrantyClaims } from '@/hooks/phase4/useWarrantyClaims';
import { WarrantyDashboard } from '@/components/phase4/WarrantyDashboard';
import { GarantiesTracker } from '@/components/phase4/GarantiesTracker';

export function GarantiesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { claims, stats, isLoading } = useWarrantyClaims(projectId!);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Calcul des dates de garanties (simulées)
  const dateReception = new Date();
  const garanties = [
    {
      type: 'Parfait achèvement',
      duree: '1 an',
      debut: dateReception,
      fin: new Date(dateReception.getFullYear() + 1, dateReception.getMonth(), dateReception.getDate()),
      statut: 'active',
      progression: 30,
    },
    {
      type: 'Garantie biennale',
      duree: '2 ans',
      debut: dateReception,
      fin: new Date(dateReception.getFullYear() + 2, dateReception.getMonth(), dateReception.getDate()),
      statut: 'active',
      progression: 15,
    },
    {
      type: 'Garantie décennale',
      duree: '10 ans',
      debut: dateReception,
      fin: new Date(dateReception.getFullYear() + 10, dateReception.getMonth(), dateReception.getDate()),
      statut: 'active',
      progression: 3,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-purple-100 text-purple-800">Phase 4</Badge>
            <Badge variant="outline">Garanties</Badge>
          </div>
          <h1 className="text-3xl font-bold">Suivi des Garanties</h1>
          <p className="text-muted-foreground">
            Gérez les garanties légales et les réclamations
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Déclarer un désordre
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Shield className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">3</p>
                <p className="text-sm text-muted-foreground">Garanties actives</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.desordresEnCours || 0}</p>
                <p className="text-sm text-muted-foreground">Désordres en cours</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.reclamationsEnAttente || 0}</p>
                <p className="text-sm text-muted-foreground">Réclamations</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.desordresResolus || 0}</p>
                <p className="text-sm text-muted-foreground">Résolus</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* État des garanties */}
      <Card>
        <CardHeader>
          <CardTitle>État des garanties légales</CardTitle>
          <CardDescription>
            Suivi des périodes de garantie depuis la réception
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {garanties.map((garantie, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <span className="font-medium">{garantie.type}</span>
                    <Badge variant="outline">{garantie.duree}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Expire le {garantie.fin.toLocaleDateString('fr-FR')}
                  </div>
                </div>
                <Progress value={garantie.progression} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{garantie.debut.toLocaleDateString('fr-FR')}</span>
                  <span>{100 - garantie.progression}% restant</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Contenu principal */}
      <Tabs defaultValue="desordres">
        <TabsList>
          <TabsTrigger value="desordres">Désordres signalés</TabsTrigger>
          <TabsTrigger value="reclamations">Réclamations</TabsTrigger>
          <TabsTrigger value="assurances">Assurances</TabsTrigger>
          <TabsTrigger value="contacts">Entreprises</TabsTrigger>
        </TabsList>

        <TabsContent value="desordres" className="mt-4">
          <WarrantyDashboard projectId={projectId!} />
        </TabsContent>

        <TabsContent value="reclamations" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Réclamations en cours</CardTitle>
            </CardHeader>
            <CardContent>
              {claims.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucune réclamation en cours
                </p>
              ) : (
                <div className="space-y-4">
                  {claims.map((claim) => (
                    <div key={claim.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{claim.description}</span>
                        <Badge>{claim.statut}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assurances" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Attestations d'assurance</CardTitle>
              <CardDescription>
                Documents d'assurance des entreprises intervenantes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Attestation décennale - Lot Gros Œuvre</p>
                      <p className="text-sm text-muted-foreground">Valide jusqu'au 31/12/2025</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">Voir</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts" className="mt-4">
          <GarantiesTracker projectId={projectId!} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default GarantiesPage;

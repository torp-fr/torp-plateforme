/**
 * OPRPage - Page des Opérations Préalables à la Réception
 * Gestion des sessions OPR, contrôles et vérifications avant réception
 */

import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ClipboardCheck,
  Plus,
  Calendar,
  Users,
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { useOPR } from '@/hooks/phase4/useOPR';
import { OPRManager } from '@/components/phase4/OPRManager';
import { OPRChecklist } from '@/components/phase4/OPRChecklist';

export function OPRPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { sessions, stats, isLoading } = useOPR(projectId!);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-purple-100 text-purple-800">Phase 4</Badge>
            <Badge variant="outline">OPR</Badge>
          </div>
          <h1 className="text-3xl font-bold">Opérations Préalables à la Réception</h1>
          <p className="text-muted-foreground">
            Vérifiez la conformité des travaux avant la réception officielle
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle session OPR
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ClipboardCheck className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalSessions || 0}</p>
                <p className="text-sm text-muted-foreground">Sessions OPR</p>
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
                <p className="text-2xl font-bold">{stats?.controlesConformes || 0}</p>
                <p className="text-sm text-muted-foreground">Conformes</p>
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
                <p className="text-2xl font-bold">{stats?.reservesEnCours || 0}</p>
                <p className="text-sm text-muted-foreground">Réserves</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FileCheck className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.tauxConformite || 0}%</p>
                <p className="text-sm text-muted-foreground">Taux conformité</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progression globale */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Progression des contrôles</span>
            <span className="text-lg font-normal text-muted-foreground">
              {stats?.controlesRealises || 0} / {stats?.totalControles || 0}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress
            value={stats?.totalControles ? (stats.controlesRealises / stats.totalControles) * 100 : 0}
            className="h-3"
          />
          <div className="flex justify-between mt-2 text-sm text-muted-foreground">
            <span>Contrôles réalisés</span>
            <span>{stats?.tauxConformite || 0}% de conformité</span>
          </div>
        </CardContent>
      </Card>

      {/* Contenu principal */}
      <Tabs defaultValue="sessions">
        <TabsList>
          <TabsTrigger value="sessions">Sessions OPR</TabsTrigger>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="mt-4">
          <OPRManager projectId={projectId!} />
        </TabsContent>

        <TabsContent value="checklist" className="mt-4">
          <OPRChecklist projectId={projectId!} />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Documents OPR</CardTitle>
              <CardDescription>
                PV de réception, rapports de contrôle, fiches de non-conformité
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Les documents générés apparaîtront ici après chaque session OPR.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default OPRPage;

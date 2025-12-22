/**
 * ReservesPage - Gestion des réserves
 * Suivi et levée des réserves identifiées lors de la réception
 */

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  Camera,
} from 'lucide-react';
import { useReserves } from '@/hooks/phase4/useReserves';
import { ReservesList } from '@/components/phase4/ReservesList';
import { ReserveForm } from '@/components/phase4/ReserveForm';

export function ReservesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { reserves, stats, isLoading } = useReserves(projectId!);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Filtrer les réserves
  const filteredReserves = reserves.filter(r =>
    r.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.localisation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.lot_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-purple-100 text-purple-800">Phase 4</Badge>
            <Badge variant="outline">Réserves</Badge>
          </div>
          <h1 className="text-3xl font-bold">Gestion des Réserves</h1>
          <p className="text-muted-foreground">
            Suivez et gérez la levée des réserves du chantier
          </p>
        </div>
        <Button onClick={() => setShowAddForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle réserve
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.bloquantes || 0}</p>
                <p className="text-sm text-muted-foreground">Bloquantes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.enCours || 0}</p>
                <p className="text-sm text-muted-foreground">En cours</p>
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
                <p className="text-2xl font-bold">{stats?.levees || 0}</p>
                <p className="text-sm text-muted-foreground">Levées</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Camera className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.tauxLevee || 0}%</p>
                <p className="text-sm text-muted-foreground">Taux levée</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barre de recherche */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une réserve..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline">
          <Filter className="h-4 w-4 mr-2" />
          Filtres
        </Button>
      </div>

      {/* Contenu */}
      <Tabs defaultValue="toutes">
        <TabsList>
          <TabsTrigger value="toutes">
            Toutes ({stats?.total || 0})
          </TabsTrigger>
          <TabsTrigger value="bloquantes">
            Bloquantes ({stats?.bloquantes || 0})
          </TabsTrigger>
          <TabsTrigger value="en-cours">
            En cours ({stats?.enCours || 0})
          </TabsTrigger>
          <TabsTrigger value="levees">
            Levées ({stats?.levees || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="toutes" className="mt-4">
          <ReservesList
            reserves={filteredReserves}
            projectId={projectId!}
          />
        </TabsContent>

        <TabsContent value="bloquantes" className="mt-4">
          <ReservesList
            reserves={filteredReserves.filter(r => r.gravite === 'bloquante')}
            projectId={projectId!}
          />
        </TabsContent>

        <TabsContent value="en-cours" className="mt-4">
          <ReservesList
            reserves={filteredReserves.filter(r => r.statut === 'en_cours' || r.statut === 'signalée')}
            projectId={projectId!}
          />
        </TabsContent>

        <TabsContent value="levees" className="mt-4">
          <ReservesList
            reserves={filteredReserves.filter(r => r.statut === 'levee')}
            projectId={projectId!}
          />
        </TabsContent>
      </Tabs>

      {/* Modal ajout réserve */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-auto">
            <h2 className="text-xl font-bold mb-4">Nouvelle réserve</h2>
            <ReserveForm
              projectId={projectId!}
              onClose={() => setShowAddForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ReservesPage;

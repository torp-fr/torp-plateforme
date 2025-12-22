/**
 * ProjetsListePage - Liste des projets simplifiée et claire
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PlusCircle,
  FolderOpen,
  Search,
  Filter,
  ChevronRight,
  Lightbulb,
  Send,
  HardHat,
  CheckCircle2,
  Wrench,
  MapPin,
  Euro,
  Calendar,
  MoreVertical,
  Pencil,
  Trash2,
  Copy,
  LayoutGrid,
  List,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const PHASES = [
  { id: 1, name: 'Conception', icon: Lightbulb, color: 'text-amber-600', bg: 'bg-amber-50' },
  { id: 2, name: 'Consultation', icon: Send, color: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 3, name: 'Exécution', icon: HardHat, color: 'text-orange-600', bg: 'bg-orange-50' },
  { id: 4, name: 'Réception', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
  { id: 5, name: 'Maintenance', icon: Wrench, color: 'text-purple-600', bg: 'bg-purple-50' },
];

// Mock projects
const MOCK_PROJECTS = [
  {
    id: '1',
    nom: 'Rénovation Appartement Paris 16',
    adresse: '42 Avenue Victor Hugo, 75016 Paris',
    type: 'Rénovation',
    phase: 2,
    avancement: 45,
    budget: 85000,
    createdAt: '2024-01-15',
    updatedAt: '2024-01-18',
    status: 'en_cours',
  },
  {
    id: '2',
    nom: 'Extension Maison Neuilly',
    adresse: '15 Rue de la Paix, 92200 Neuilly',
    type: 'Extension',
    phase: 1,
    avancement: 20,
    budget: 120000,
    createdAt: '2024-01-10',
    updatedAt: '2024-01-17',
    status: 'en_cours',
  },
  {
    id: '3',
    nom: 'Réhabilitation Bureaux',
    adresse: '8 Boulevard Haussmann, 75009 Paris',
    type: 'Réhabilitation',
    phase: 3,
    avancement: 70,
    budget: 250000,
    createdAt: '2023-12-01',
    updatedAt: '2024-01-16',
    status: 'en_cours',
  },
  {
    id: '4',
    nom: 'Maison Individuelle Versailles',
    adresse: '5 Rue du Château, 78000 Versailles',
    type: 'Construction neuve',
    phase: 5,
    avancement: 100,
    budget: 350000,
    createdAt: '2023-06-01',
    updatedAt: '2023-12-15',
    status: 'termine',
  },
];

export function ProjetsListePage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const filteredProjects = MOCK_PROJECTS.filter(project => {
    const matchesSearch = project.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          project.adresse.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPhase = phaseFilter === 'all' || project.phase.toString() === phaseFilter;
    return matchesSearch && matchesPhase;
  });

  const enCours = MOCK_PROJECTS.filter(p => p.status === 'en_cours').length;
  const termines = MOCK_PROJECTS.filter(p => p.status === 'termine').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mes projets</h1>
          <p className="text-gray-500">Gérez tous vos projets BTP</p>
        </div>
        <Button onClick={() => navigate('/projet/nouveau')}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Nouveau projet
        </Button>
      </div>

      {/* Tabs statut */}
      <Tabs defaultValue="tous" className="w-full">
        <TabsList>
          <TabsTrigger value="tous">
            Tous ({MOCK_PROJECTS.length})
          </TabsTrigger>
          <TabsTrigger value="en_cours">
            En cours ({enCours})
          </TabsTrigger>
          <TabsTrigger value="termines">
            Terminés ({termines})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tous" className="mt-4">
          {/* Filtres et recherche */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher un projet..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={phaseFilter} onValueChange={setPhaseFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Toutes les phases" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les phases</SelectItem>
                {PHASES.map(phase => (
                  <SelectItem key={phase.id} value={phase.id.toString()}>
                    Phase {phase.id} - {phase.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex border rounded-lg">
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-r-none"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-l-none"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Liste des projets */}
          {filteredProjects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <FolderOpen className="h-16 w-16 text-gray-300 mb-4" />
                <p className="text-gray-500 mb-4">Aucun projet trouvé</p>
                <Button onClick={() => navigate('/projet/nouveau')}>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Créer un projet
                </Button>
              </CardContent>
            </Card>
          ) : viewMode === 'list' ? (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {filteredProjects.map((project) => {
                    const phase = PHASES.find(p => p.id === project.phase);
                    const PhaseIcon = phase?.icon || Lightbulb;

                    return (
                      <div
                        key={project.id}
                        className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors group"
                      >
                        <Link
                          to={`/projet/${project.id}`}
                          className="flex items-center gap-4 flex-1"
                        >
                          <div className={cn(
                            'h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0',
                            phase?.bg || 'bg-gray-100'
                          )}>
                            <PhaseIcon className={cn('h-6 w-6', phase?.color || 'text-gray-600')} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium truncate">{project.nom}</h4>
                              <Badge variant="outline" className="text-xs">
                                {project.type}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                              <span className="flex items-center gap-1 truncate">
                                <MapPin className="h-3 w-3 flex-shrink-0" />
                                {project.adresse}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right hidden md:block">
                              <Badge className={cn(phase?.bg, phase?.color, 'border-0')}>
                                Phase {project.phase} - {phase?.name}
                              </Badge>
                            </div>
                            <div className="w-24 hidden lg:block">
                              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                <span>Avancement</span>
                                <span>{project.avancement}%</span>
                              </div>
                              <Progress value={project.avancement} className="h-1.5" />
                            </div>
                            <div className="text-right hidden sm:block">
                              <div className="font-medium">{project.budget.toLocaleString('fr-FR')} €</div>
                              <div className="text-xs text-gray-500">Budget</div>
                            </div>
                          </div>
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/projet/${project.id}`)}>
                              <ChevronRight className="h-4 w-4 mr-2" />
                              Ouvrir
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Pencil className="h-4 w-4 mr-2" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Copy className="h-4 w-4 mr-2" />
                              Dupliquer
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map((project) => {
                const phase = PHASES.find(p => p.id === project.phase);
                const PhaseIcon = phase?.icon || Lightbulb;

                return (
                  <Card
                    key={project.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/projet/${project.id}`)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className={cn(
                          'h-10 w-10 rounded-full flex items-center justify-center',
                          phase?.bg || 'bg-gray-100'
                        )}>
                          <PhaseIcon className={cn('h-5 w-5', phase?.color || 'text-gray-600')} />
                        </div>
                        <Badge className={cn(phase?.bg, phase?.color, 'border-0')}>
                          Phase {project.phase}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg mt-3">{project.nom}</CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {project.adresse}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Budget</span>
                          <span className="font-medium">{project.budget.toLocaleString('fr-FR')} €</span>
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-gray-500">Avancement</span>
                            <span className="font-medium">{project.avancement}%</span>
                          </div>
                          <Progress value={project.avancement} className="h-2" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="en_cours" className="mt-4">
          {/* Même contenu filtré par status */}
          <p className="text-gray-500">Projets en cours...</p>
        </TabsContent>

        <TabsContent value="termines" className="mt-4">
          {/* Même contenu filtré par status */}
          <p className="text-gray-500">Projets terminés...</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ProjetsListePage;

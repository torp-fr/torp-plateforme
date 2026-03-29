/**
 * ProjetsListePage - Liste des projets simplifiée et claire
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import {
  PlusCircle,
  FolderOpen,
  Search,
  ChevronRight,
  HardHat,
  MapPin,
  MoreVertical,
  Trash2,
  LayoutGrid,
  List,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

// ── DB row type ───────────────────────────────────────────────────────────────

interface ProjetRow {
  id: string;
  nom_projet: string;
  type_travaux: string | null;
  adresse: { label?: string; city?: string; postcode?: string } | null;
  budget: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export function ProjetsListePage() {
  const navigate = useNavigate();
  const { user } = useApp();
  const [projects, setProjects]         = useState<ProjetRow[]>([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [searchQuery, setSearchQuery]   = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy]             = useState<'newest' | 'oldest'>('newest');
  const [viewMode, setViewMode]         = useState<'list' | 'grid'>('list');
  const [page, setPage]                 = useState(1);
  const PAGE_SIZE = 10;

  const loadProjects = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, nom_projet, type_travaux, adresse, budget, status, created_at, updated_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects((data ?? []) as ProjetRow[]);
    } catch (err) {
      console.error('[ProjetsListePage] load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { void loadProjects(); }, [loadProjects]);

  // Helpers
  function adresseLabel(row: ProjetRow): string {
    const a = row.adresse;
    if (!a) return '—';
    return a.label ?? [a.postcode, a.city].filter(Boolean).join(' ') ?? '—';
  }

  const filtered = projects.filter(p => {
    const searchLower = searchQuery.toLowerCase();
    const matchSearch = !searchQuery
      || p.nom_projet.toLowerCase().includes(searchLower)
      || adresseLabel(p).toLowerCase().includes(searchLower);
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const sorted = [...filtered].sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    return sortBy === 'oldest' ? ta - tb : tb - ta;
  });

  const totalPages       = Math.ceil(sorted.length / PAGE_SIZE);
  const filteredProjects = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const enCours = projects.filter(p => p.status === 'draft' || p.status === 'analyzing').length;
  const termines = projects.filter(p => p.status === 'completed' || p.status === 'accepted').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mes projets</h1>
          <p className="text-gray-500">Gérez tous vos projets BTP</p>
        </div>
        <Button onClick={() => navigate('/projects/new')}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Nouveau projet
        </Button>
      </div>

      {/* Tabs statut */}
      <Tabs defaultValue="tous" className="w-full">
        <TabsList>
          <TabsTrigger value="tous" onClick={() => setStatusFilter('all')}>
            Tous ({projects.length})
          </TabsTrigger>
          <TabsTrigger value="en_cours" onClick={() => setStatusFilter('draft')}>
            En cours ({enCours})
          </TabsTrigger>
          <TabsTrigger value="termines" onClick={() => setStatusFilter('completed')}>
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
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Select value={sortBy} onValueChange={(v) => { setSortBy(v as typeof sortBy); setPage(1); }}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Trier par" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Plus récents</SelectItem>
                <SelectItem value="oldest">Plus anciens</SelectItem>
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

          {/* Loading state */}
          {isLoading ? (
            <Card><CardContent className="flex items-center justify-center py-16">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </CardContent></Card>
          ) : filteredProjects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <FolderOpen className="h-16 w-16 text-gray-300 mb-4" />
                <p className="text-gray-500 mb-4">
                  {projects.length === 0 ? 'Aucun projet pour le moment' : 'Aucun projet ne correspond à votre recherche'}
                </p>
                {projects.length === 0 && (
                  <Button onClick={() => navigate('/projects/new')}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Créer mon premier projet
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : viewMode === 'list' ? (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {filteredProjects.map((project) => (
                    <div
                      key={project.id}
                      className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors group"
                    >
                      <Link
                        to={`/project/${project.id}`}
                        className="flex items-center gap-4 flex-1 min-w-0"
                      >
                        <div className="h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 bg-primary/10">
                          <HardHat className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium truncate">{project.nom_projet}</h4>
                            {project.type_travaux && (
                              <Badge variant="outline" className="text-xs shrink-0">
                                {project.type_travaux}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5 truncate">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{adresseLabel(project)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-5 shrink-0">
                          {project.budget != null && (
                            <div className="text-right hidden sm:block">
                              <div className="font-medium">{project.budget.toLocaleString('fr-FR')} €</div>
                              <div className="text-xs text-gray-500">Budget</div>
                            </div>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {project.status}
                          </Badge>
                        </div>
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/project/${project.id}`)}>
                            <ChevronRight className="h-4 w-4 mr-2" />
                            Ouvrir
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map((project) => (
                <Card
                  key={project.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/project/${project.id}`)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="h-10 w-10 rounded-full flex items-center justify-center bg-primary/10">
                        <HardHat className="h-5 w-5 text-primary" />
                      </div>
                      {project.type_travaux && (
                        <Badge variant="outline" className="text-xs">{project.type_travaux}</Badge>
                      )}
                    </div>
                    <CardTitle className="text-base mt-3 line-clamp-2">{project.nom_projet}</CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{adresseLabel(project)}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm">
                      {project.budget != null ? (
                        <span className="font-medium">{project.budget.toLocaleString('fr-FR')} €</span>
                      ) : <span className="text-gray-400">—</span>}
                      <Badge variant="outline" className="text-xs">{project.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
              <span>
                Affichage {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sortedProjects.length)} sur {sortedProjects.length}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Précédent
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <Button
                    key={p}
                    variant={p === page ? 'secondary' : 'ghost'}
                    size="sm"
                    className="w-8 h-8 p-0"
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Suivant
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="en_cours" className="mt-4">
          <p className="text-gray-500 text-sm">Affichage filtré dans l'onglet Tous.</p>
        </TabsContent>
        <TabsContent value="termines" className="mt-4">
          <p className="text-gray-500 text-sm">Affichage filtré dans l'onglet Tous.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ProjetsListePage;

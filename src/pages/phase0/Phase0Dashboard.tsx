/**
 * Dashboard des projets Phase 0
 * Liste et gestion des projets de l'utilisateur
 */

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Plus, Search, Filter, MoreVertical, Edit, Copy, Trash2, FileText,
  MapPin, Calendar, Euro, Loader2, FolderOpen, AlertTriangle
} from 'lucide-react';
import { Phase0ProjectService, Phase0Summary, Phase0Status, PHASE0_STATUS_CONFIG } from '@/services/phase0';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';
import { AppLayout } from '@/components/layout';

export function Phase0Dashboard() {
  const navigate = useNavigate();
  const { user } = useApp();
  const { toast } = useToast();

  const [projects, setProjects] = useState<Phase0Summary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Phase0Status | 'all'>('all');

  // Charger les projets
  useEffect(() => {
    const loadProjects = async () => {
      if (!user?.id) return;

      setIsLoading(true);
      setError(null);

      try {
        const result = await Phase0ProjectService.getUserProjects(user.id);
        // getUserProjects returns Phase0ProjectList with items array of Phase0Summary
        setProjects(result.items || []);
      } catch (err) {
        console.error('Erreur chargement projets:', err);
        setError('Impossible de charger vos projets');
      } finally {
        setIsLoading(false);
      }
    };

    loadProjects();
  }, [user]);

  // Filtrer les projets
  const filteredProjects = projects.filter(project => {
    const matchesSearch = searchQuery === '' ||
      project.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.propertyAddress?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Actions sur un projet
  const handleDuplicate = async (projectId: string) => {
    try {
      const duplicated = await Phase0ProjectService.duplicateProject(projectId);
      // Reload projects to get the new summary
      const result = await Phase0ProjectService.getUserProjects(user!.id);
      setProjects(result.items || []);
      toast({
        title: 'Projet dupliqué',
        description: 'Nouveau projet créé avec succès',
      });
    } catch (err) {
      toast({
        title: 'Erreur',
        description: 'Impossible de dupliquer le projet',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce projet ?')) return;

    try {
      await Phase0ProjectService.deleteProject(projectId);
      setProjects(prev => prev.filter(p => p.projectId !== projectId));
      toast({
        title: 'Projet supprimé',
      });
    } catch (err) {
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer le projet',
        variant: 'destructive',
      });
    }
  };

  // Rendu du statut
  const renderStatus = (status: Phase0Status) => {
    const config = PHASE0_STATUS_CONFIG[status];
    const variants: Record<Phase0Status, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      draft: 'secondary',
      in_progress: 'default',
      pending_validation: 'outline',
      validated: 'default',
      archived: 'secondary',
      cancelled: 'destructive',
    };

    return (
      <Badge variant={variants[status]}>
        {config.label}
      </Badge>
    );
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        {/* En-tête */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Mes projets</h1>
            <p className="text-muted-foreground">
              Gérez vos projets de travaux Phase 0
            </p>
          </div>
          <Button onClick={() => navigate('/phase0')}>
            <Plus className="w-4 h-4 mr-2" />
            Nouveau projet
          </Button>
        </div>

        {/* Filtres */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un projet..."
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as Phase0Status | 'all')}>
            <SelectTrigger className="w-full md:w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {Object.entries(PHASE0_STATUS_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Liste des projets */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : filteredProjects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FolderOpen className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun projet</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || statusFilter !== 'all'
                  ? 'Aucun projet ne correspond à vos critères'
                  : 'Créez votre premier projet de travaux'}
              </p>
              <Button onClick={() => navigate('/phase0')}>
                <Plus className="w-4 h-4 mr-2" />
                Créer un projet
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProjects.map((project) => (
              <Card
                key={project.projectId}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/phase0/project/${project.projectId}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {renderStatus(project.status)}
                      </div>
                      <CardTitle className="text-lg truncate">
                        {project.projectName}
                      </CardTitle>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/phase0/wizard/${project.projectId}`);
                        }}>
                          <Edit className="w-4 h-4 mr-2" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(project.projectId);
                        }}>
                          <Copy className="w-4 h-4 mr-2" />
                          Dupliquer
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/phase0/project/${project.projectId}/documents`);
                        }}>
                          <FileText className="w-4 h-4 mr-2" />
                          Documents
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(project.projectId);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Adresse */}
                  {project.propertyAddress && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      {project.propertyAddress}
                    </div>
                  )}

                  {/* Infos */}
                  <div className="flex items-center gap-4 text-sm">
                    {project.estimatedBudget && (
                      <div className="flex items-center gap-1">
                        <Euro className="w-4 h-4 text-muted-foreground" />
                        <span>
                          {project.estimatedBudget.min?.toLocaleString('fr-FR')} - {project.estimatedBudget.max?.toLocaleString('fr-FR')} €
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span>{project.selectedLotsCount} lot(s)</span>
                    </div>
                  </div>

                  {/* Progression */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Complétude</span>
                      <span>{project.completeness}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${project.completeness}%` }}
                      />
                    </div>
                  </div>

                  {/* Date */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                    <Calendar className="w-3 h-3" />
                    Modifié le {new Date(project.updatedAt).toLocaleDateString('fr-FR')}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default Phase0Dashboard;

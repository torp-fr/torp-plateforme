/**
 * ProProjects Page
 * Liste des projets clients pour les professionnels B2B
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProLayout } from '@/components/pro/ProLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import {
  PlusCircle,
  Search,
  Loader2,
  Eye,
  Briefcase,
  MapPin,
  Calendar,
  Filter,
} from 'lucide-react';

interface Project {
  id: string;
  reference: string;
  status: string;
  created_at: string;
  updated_at: string;
  client?: {
    identity?: {
      name?: string;
      companyName?: string;
      clientType?: string;
    };
    site?: {
      address?: {
        city?: string;
        postalCode?: string;
      };
    };
    context?: {
      projectType?: string;
    };
  };
  owner_profile?: {
    identity?: {
      name?: string;
    };
  };
  property?: {
    address?: {
      city?: string;
    };
  };
}

export default function ProProjects() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (user?.id) {
      loadProjects();
    }
  }, [user?.id]);

  async function loadProjects() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('phase0_projects')
        .select('id, reference, status, created_at, updated_at, client, owner_profile, property')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('[ProProjects] Erreur:', error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Terminé</Badge>;
      case 'in_progress':
        return <Badge variant="secondary">En cours</Badge>;
      case 'draft':
        return <Badge variant="outline">Brouillon</Badge>;
      case 'validated':
        return <Badge className="bg-blue-500">Validé</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  function getProjectTypeLabel(type?: string): string {
    const labels: Record<string, string> = {
      renovation_globale: 'Rénovation globale',
      renovation_energetique: 'Rénovation énergétique',
      extension: 'Extension',
      amenagement: 'Aménagement',
      mise_aux_normes: 'Mise aux normes',
      maintenance: 'Maintenance',
      construction_neuve: 'Construction neuve',
    };
    return type ? labels[type] || type : 'Projet';
  }

  function getClientName(project: Project): string {
    if (project.client?.identity?.name) {
      return project.client.identity.name;
    }
    if (project.client?.identity?.companyName) {
      return project.client.identity.companyName;
    }
    if (project.owner_profile?.identity?.name) {
      return project.owner_profile.identity.name;
    }
    return 'Client non renseigné';
  }

  function getLocation(project: Project): string | null {
    const city = project.client?.site?.address?.city || project.property?.address?.city;
    const postalCode = project.client?.site?.address?.postalCode;
    if (city && postalCode) return `${postalCode} ${city}`;
    return city || null;
  }

  // Filtrage
  const filteredProjects = projects.filter(project => {
    const matchesSearch = searchQuery === '' ||
      getClientName(project).toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getLocation(project)?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <ProLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ProLayout>
    );
  }

  return (
    <ProLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Mes projets</h1>
            <p className="text-muted-foreground">
              {projects.length} projet{projects.length > 1 ? 's' : ''} client{projects.length > 1 ? 's' : ''}
            </p>
          </div>
          <Button onClick={() => navigate('/pro/projects/new')}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nouveau projet
          </Button>
        </div>

        {/* Filtres */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par client, référence, ville..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="draft">Brouillon</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="validated">Validé</SelectItem>
                  <SelectItem value="completed">Terminé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Liste des projets */}
        {filteredProjects.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
              {projects.length === 0 ? (
                <>
                  <p className="mb-2 font-medium">Aucun projet pour le moment</p>
                  <p className="text-sm mb-6">
                    Créez votre premier projet pour commencer
                  </p>
                  <Button onClick={() => navigate('/pro/projects/new')}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Créer mon premier projet
                  </Button>
                </>
              ) : (
                <p>Aucun projet ne correspond à vos critères de recherche</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredProjects.map((project) => (
              <Card
                key={project.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => navigate(`/pro/projects/${project.id}`)}
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="p-2 rounded-lg bg-muted">
                        <Briefcase className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">
                            {getClientName(project)}
                          </p>
                          {getStatusBadge(project.status)}
                          <span className="text-xs text-muted-foreground">
                            #{project.reference}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span>{getProjectTypeLabel(project.client?.context?.projectType)}</span>
                          {getLocation(project) && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {getLocation(project)}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(project.created_at).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ProLayout>
  );
}

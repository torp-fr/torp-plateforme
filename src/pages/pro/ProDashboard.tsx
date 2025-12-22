/**
 * ProDashboard Page
 * Tableau de bord pour les professionnels B2B
 * Orienté projets clients et génération de documents
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import {
  PlusCircle,
  ArrowRight,
  Building2,
  Loader2,
  Eye,
  Briefcase,
  MapPin,
} from 'lucide-react';

interface RecentProject {
  id: string;
  reference_number: string | null;
  name: string;
  status: string;
  created_at: string;
  // Denormalized client fields
  client_name?: string | null;
  client_type?: string | null;
  owner_profile?: {
    identity?: {
      type?: string;
      firstName?: string;
      lastName?: string;
      companyName?: string;
    };
  };
  property?: {
    identification?: {
      address?: {
        city?: string;
      };
    };
  };
}

export default function ProDashboard() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasCompany, setHasCompany] = useState<boolean | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user?.id]);

  async function loadData() {
    try {
      setLoading(true);

      // Vérifier si l'utilisateur a une entreprise
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id')
        .eq('user_id', user!.id)
        .single();

      if (companyError || !company) {
        setHasCompany(false);
        setLoading(false);
        return;
      }

      setHasCompany(true);

      // Charger les projets Phase 0 récents
      try {
        const { data: projects } = await supabase
          .from('phase0_projects')
          .select('id, reference_number, status, created_at, owner_profile, property, name, client_name, client_type')
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false })
          .limit(5);

        setRecentProjects(projects || []);
      } catch (e) {
        console.log('[ProDashboard] phase0_projects table not available');
        setRecentProjects([]);
      }
    } catch (error) {
      console.error('[ProDashboard] Erreur:', error);
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

  function getClientName(project: RecentProject): string {
    // Use denormalized client_name first
    if (project.client_name) {
      return project.client_name;
    }
    // Fallback to owner_profile
    const identity = project.owner_profile?.identity;
    if (identity) {
      if (identity.companyName) return identity.companyName;
      if (identity.firstName || identity.lastName) {
        return `${identity.firstName || ''} ${identity.lastName || ''}`.trim();
      }
    }
    return project.name || 'Client non renseigné';
  }

  function getLocation(project: RecentProject): string | null {
    return project.property?.identification?.address?.city || null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Si pas d'entreprise, afficher l'onboarding
  if (!hasCompany) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <Building2 className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
        <h1 className="text-2xl font-bold mb-4">
          Bienvenue sur TORP Pro
        </h1>
        <p className="text-muted-foreground mb-8">
          Pour commencer, vous devez créer le profil de votre entreprise.
          Cela nous permettra de personnaliser vos projets et de générer
          les documents adaptés à votre activité.
        </p>
        <Button size="lg" onClick={() => navigate('/pro/onboarding')}>
          <PlusCircle className="h-5 w-5 mr-2" />
          Créer mon profil entreprise
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Tableau de bord</h1>
          <p className="text-muted-foreground">
            Bienvenue, {user?.name || 'Professionnel'}
          </p>
        </div>

        {/* Projets récents */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Projets récents</CardTitle>
              <CardDescription>Vos derniers projets clients</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/pro/projects">
                Voir tout <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentProjects.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-2 font-medium">Aucun projet pour le moment</p>
                <p className="text-sm mb-6">
                  Créez votre premier projet pour commencer à générer vos documents
                </p>
                <Button onClick={() => navigate('/pro/projects/new')}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Créer mon premier projet
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentProjects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/pro/projects/${project.id}`)}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="p-2 rounded-lg bg-muted">
                        <Briefcase className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">
                            {getClientName(project)}
                          </p>
                          {getStatusBadge(project.status)}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          {project.client_type && <span>{project.client_type}</span>}
                          {getLocation(project) && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {getLocation(project)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-sm text-muted-foreground">
                        {new Date(project.created_at).toLocaleDateString('fr-FR')}
                      </span>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  );
}

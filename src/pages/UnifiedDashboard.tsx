/**
 * Dashboard Unifié TORP
 * S'adapte automatiquement au profil utilisateur (B2C/B2B/B2G)
 * Centralise les projets Phase0 comme élément principal
 */

import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Header } from '@/components/Header';
import { useApp } from '@/context/AppContext';
import { Phase0ProjectService, PHASE0_STATUS_CONFIG, Phase0Status } from '@/services/phase0';
import { supabase } from '@/lib/supabase';
import {
  Plus,
  FileSearch,
  FolderOpen,
  MapPin,
  Euro,
  FileText,
  MoreVertical,
  Edit,
  Eye,
  Trash2,
  Copy,
  ArrowRight,
  TrendingUp,
  PiggyBank,
  Hammer,
  Building2,
  Users,
  Shield,
  Clock,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Target,
  Loader2,
  Sparkles,
  Ticket,
  FileCheck,
  Landmark,
  Scale,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Phase0Summary } from '@/services/phase0';

// Types pour les segments utilisateur
type UserSegment = 'B2C' | 'B2B' | 'B2G' | 'admin';

interface SegmentConfig {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  primaryColor: string;
  features: string[];
  ctaLabel: string;
  ctaLink: string;
}

// Configuration par segment
const SEGMENT_CONFIGS: Record<UserSegment, SegmentConfig> = {
  B2C: {
    title: 'Tableau de bord',
    subtitle: 'Gérez vos projets de travaux en toute sérénité',
    icon: <Hammer className="w-6 h-6" />,
    primaryColor: 'primary',
    features: ['Définition de projet', 'Analyse de devis', 'Suivi des travaux'],
    ctaLabel: 'Définir un projet',
    ctaLink: '/phase0/new',
  },
  B2B: {
    title: 'Espace Professionnel',
    subtitle: 'Optimisez vos analyses et valorisez votre expertise',
    icon: <Building2 className="w-6 h-6" />,
    primaryColor: 'blue',
    features: ['Analyses avancées', 'Tickets TORP', 'Certifications'],
    ctaLabel: 'Nouvelle analyse',
    ctaLink: '/pro/analyses/new',
  },
  B2G: {
    title: 'Espace Collectivités',
    subtitle: 'Pilotez vos marchés publics avec conformité',
    icon: <Landmark className="w-6 h-6" />,
    primaryColor: 'purple',
    features: ['Appels d\'offres', 'Conformité réglementaire', 'Suivi budgétaire'],
    ctaLabel: 'Nouveau marché',
    ctaLink: '/phase0/new',
  },
  admin: {
    title: 'Administration TORP',
    subtitle: 'Vue globale de la plateforme',
    icon: <Shield className="w-6 h-6" />,
    primaryColor: 'orange',
    features: ['Métriques', 'Utilisateurs', 'Configuration'],
    ctaLabel: 'Voir les stats',
    ctaLink: '/admin-dashboard',
  },
};

// Composant Stats selon segment
interface DashboardStats {
  projectsCount: number;
  analysesCount: number;
  averageScore: number | null;
  totalSavings: number;
  pendingItems: number;
}

export default function UnifiedDashboard() {
  const navigate = useNavigate();
  const { user, userType, projects, phase0Projects, refreshPhase0Projects } = useApp();

  // Rediriger les utilisateurs B2B vers l'espace Pro dédié
  useEffect(() => {
    if (userType === 'B2B') {
      navigate('/pro', { replace: true });
    }
  }, [userType, navigate]);

  // États
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeTab, setActiveTab] = useState('projects');

  // Déterminer le segment utilisateur
  const segment: UserSegment = useMemo(() => {
    if (userType === 'admin') return 'admin';
    if (userType === 'B2B') return 'B2B';
    // TODO: Détecter B2G basé sur le profil utilisateur
    return 'B2C';
  }, [userType]);

  const config = SEGMENT_CONFIGS[segment];

  // Projets Phase0 actifs
  const activePhase0Projects = useMemo(() => {
    return phase0Projects.filter(
      p => p.status !== 'archived' && p.status !== 'cancelled'
    );
  }, [phase0Projects]);

  // Analyses complétées
  const completedAnalyses = useMemo(() => {
    return projects.filter(p => p.status === 'completed');
  }, [projects]);

  // Charger les stats
  useEffect(() => {
    const loadStats = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // Calculer le score moyen
        const avgScore = completedAnalyses.length > 0
          ? Math.round(
              completedAnalyses.reduce((sum, p) => sum + (p.score || 0), 0) /
              completedAnalyses.length
            )
          : null;

        // Calculer les économies (depuis priceComparison)
        const totalSavings = completedAnalyses.reduce((sum, p) => {
          if (p.analysisResult?.priceComparison) {
            const current = p.analysisResult.priceComparison.current;
            const high = p.analysisResult.priceComparison.high;
            return sum + Math.max(0, high - current);
          }
          return sum;
        }, 0);

        // Compter les éléments en attente
        const pendingItems = projects.filter(
          p => p.status === 'analyzing' || p.status === 'uploaded'
        ).length;

        setStats({
          projectsCount: activePhase0Projects.length,
          analysesCount: completedAnalyses.length,
          averageScore: avgScore,
          totalSavings,
          pendingItems,
        });
      } catch (err) {
        console.error('Erreur chargement stats:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, [user, completedAnalyses, activePhase0Projects, projects]);

  // Actions sur les projets
  const handleDeletePhase0Project = async (projectId: string, projectTitle: string) => {
    const confirmed = window.confirm(
      `Êtes-vous sûr de vouloir supprimer "${projectTitle}" ? Cette action est irréversible.`
    );

    if (!confirmed) return;

    try {
      await Phase0ProjectService.deleteProject(projectId);
      await refreshPhase0Projects();
      toast.success('Projet supprimé avec succès');
    } catch (error) {
      console.error('Error deleting phase0 project:', error);
      toast.error('Erreur lors de la suppression du projet');
    }
  };

  // Rendu du statut Phase0
  const renderPhase0Status = (status: Phase0Status) => {
    const statusConfig = PHASE0_STATUS_CONFIG[status];
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
        {statusConfig.label}
      </Badge>
    );
  };

  // Composant KPI Card
  const KPICard = ({
    icon,
    label,
    value,
    subValue,
    bgColor = 'bg-primary/10',
    iconColor = 'text-primary',
  }: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    subValue?: string;
    bgColor?: string;
    iconColor?: string;
  }) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">
              {value}
              {subValue && (
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  {subValue}
                </span>
              )}
            </p>
          </div>
          <div className={`w-12 h-12 ${bgColor} rounded-full flex items-center justify-center`}>
            <span className={iconColor}>{icon}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* En-tête avec segment */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <div className={`p-3 bg-${config.primaryColor}/10 rounded-xl`}>
                {config.icon}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {config.title}
                </h1>
                <p className="text-muted-foreground">
                  {user ? `Bonjour ${user.name}` : config.subtitle}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => navigate(config.ctaLink)}>
                <Plus className="h-4 w-4 mr-2" />
                {config.ctaLabel}
              </Button>
            </div>
          </div>

          {/* KPIs adaptés au segment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <KPICard
              icon={<FolderOpen className="w-5 h-5" />}
              label={segment === 'B2G' ? 'Marchés en cours' : 'Projets en définition'}
              value={stats?.projectsCount ?? 0}
              bgColor="bg-primary/10"
              iconColor="text-primary"
            />

            <KPICard
              icon={<FileSearch className="w-5 h-5" />}
              label="Analyses réalisées"
              value={stats?.analysesCount ?? 0}
              bgColor="bg-blue-500/10"
              iconColor="text-blue-500"
            />

            {stats?.averageScore !== null && (
              <KPICard
                icon={<TrendingUp className="w-5 h-5" />}
                label="Score moyen"
                value={stats.averageScore}
                subValue="/1000"
                bgColor="bg-green-500/10"
                iconColor="text-green-500"
              />
            )}

            {stats && stats.totalSavings > 0 && (
              <KPICard
                icon={<PiggyBank className="w-5 h-5" />}
                label={segment === 'B2B' ? 'Valeur détectée' : 'Économies potentielles'}
                value={`${Math.round(stats.totalSavings).toLocaleString()}€`}
                bgColor="bg-emerald-500/10"
                iconColor="text-emerald-500"
              />
            )}

            {segment === 'B2B' && (
              <KPICard
                icon={<Ticket className="w-5 h-5" />}
                label="Tickets TORP"
                value={0}
                bgColor="bg-purple-500/10"
                iconColor="text-purple-500"
              />
            )}

            {segment === 'B2G' && (
              <KPICard
                icon={<Scale className="w-5 h-5" />}
                label="Conformité"
                value="100%"
                bgColor="bg-purple-500/10"
                iconColor="text-purple-500"
              />
            )}
          </div>

          {/* Onglets de navigation */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
            <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
              <TabsTrigger value="projects" className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Projets</span>
              </TabsTrigger>
              <TabsTrigger value="analyses" className="flex items-center gap-2">
                <FileSearch className="w-4 h-4" />
                <span className="hidden sm:inline">Analyses</span>
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Activité</span>
              </TabsTrigger>
            </TabsList>

            {/* Contenu : Projets Phase0 */}
            <TabsContent value="projects" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <FolderOpen className="w-5 h-5" />
                      {segment === 'B2G' ? 'Mes marchés' : 'Mes projets de travaux'}
                    </CardTitle>
                    <Button size="sm" variant="outline" onClick={() => navigate('/phase0/new')}>
                      <Plus className="h-4 w-4 mr-2" />
                      {segment === 'B2G' ? 'Nouveau marché' : 'Nouveau projet'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {activePhase0Projects.length === 0 ? (
                    <div className="text-center py-12">
                      <FolderOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        {segment === 'B2G'
                          ? 'Commencez par définir votre marché'
                          : 'Commencez par définir votre projet'}
                      </h3>
                      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                        {segment === 'B2B'
                          ? 'Définissez le contexte du projet client pour une analyse plus pertinente.'
                          : segment === 'B2G'
                            ? 'Structurez votre consultation pour recevoir des offres conformes.'
                            : 'Décrivez vos travaux pour obtenir une analyse sur-mesure de vos devis.'}
                      </p>
                      <Button onClick={() => navigate('/phase0/new')}>
                        <Plus className="w-4 h-4 mr-2" />
                        {config.ctaLabel}
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {activePhase0Projects.map((project) => (
                        <div
                          key={project.id}
                          className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="font-mono text-xs">
                                  {project.reference}
                                </Badge>
                                {renderPhase0Status(project.status)}
                              </div>
                              <h3 className="font-semibold truncate">{project.title}</h3>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => navigate(`/phase0/project/${project.id}`)}
                                >
                                  <Eye className="w-4 h-4 mr-2" />
                                  Voir le projet
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => navigate(`/phase0/wizard/${project.id}`)}
                                >
                                  <Edit className="w-4 h-4 mr-2" />
                                  Modifier
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() =>
                                    handleDeletePhase0Project(project.id, project.title)
                                  }
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Supprimer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          {/* Adresse */}
                          {project.propertyAddress && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                              <MapPin className="w-4 h-4" />
                              {project.propertyAddress}
                            </div>
                          )}

                          {/* Infos */}
                          <div className="flex items-center gap-4 text-sm mb-3">
                            {project.estimatedBudget && (
                              <div className="flex items-center gap-1">
                                <Euro className="w-4 h-4 text-muted-foreground" />
                                <span>
                                  {project.estimatedBudget.min?.toLocaleString('fr-FR')} -{' '}
                                  {project.estimatedBudget.max?.toLocaleString('fr-FR')} €
                                </span>
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <FileText className="w-4 h-4 text-muted-foreground" />
                              <span>{project.selectedLotsCount} lot(s)</span>
                            </div>
                          </div>

                          {/* Progression */}
                          <div className="space-y-1 mb-4">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Complétude</span>
                              <span>{project.completeness}%</span>
                            </div>
                            <Progress value={project.completeness} className="h-1.5" />
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => navigate(`/phase0/project/${project.id}`)}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Voir
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={() =>
                                navigate(`/phase0/project/${project.id}/analyze`)
                              }
                            >
                              <FileSearch className="w-4 h-4 mr-2" />
                              Analyser un devis
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Contenu : Analyses */}
            <TabsContent value="analyses" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Mes analyses de devis
                    </CardTitle>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate('/analyze')}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Nouvelle analyse
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {projects.slice(0, 10).map((project) => (
                      <Link
                        key={project.id}
                        to={`/results?devisId=${project.id}`}
                        className="block"
                      >
                        <div className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md hover:border-primary/50 transition-all">
                          <div className="flex items-center space-x-4">
                            <div
                              className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg
                                ${
                                  project.score && project.score >= 800
                                    ? 'bg-emerald-500 text-white'
                                    : project.score && project.score >= 600
                                      ? 'bg-yellow-500 text-white'
                                      : project.score && project.score > 0
                                        ? 'bg-red-500 text-white'
                                        : 'bg-muted text-muted-foreground'
                                }`}
                            >
                              {project.grade || '?'}
                            </div>
                            <div>
                              <h3 className="font-semibold text-foreground">
                                {project.name}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {project.company || 'Entreprise'} •{' '}
                                {new Date(project.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <span className="text-lg font-semibold text-foreground">
                              {project.amount}
                            </span>
                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                      </Link>
                    ))}

                    {projects.length === 0 && (
                      <div className="text-center py-12">
                        <FileSearch className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-foreground mb-2">
                          Aucune analyse pour le moment
                        </h3>
                        <p className="text-muted-foreground mb-4">
                          {activePhase0Projects.length > 0
                            ? 'Sélectionnez un projet et analysez un devis'
                            : 'Définissez d\'abord votre projet, puis analysez vos devis'}
                        </p>
                        <Button onClick={() => navigate('/analyze')}>
                          <Plus className="w-4 h-4 mr-2" />
                          Analyser un devis
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Contenu : Activité */}
            <TabsContent value="activity" className="mt-6">
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Activité récente */}
                <div className="lg:col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        Activité récente
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {projects.length === 0 && activePhase0Projects.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">
                            Aucune activité récente
                          </p>
                        ) : (
                          <>
                            {/* Combiner projets et analyses récents */}
                            {activePhase0Projects.slice(0, 3).map((project) => (
                              <div
                                key={`p0-${project.id}`}
                                className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
                              >
                                <div className="p-2 bg-primary/10 rounded-lg">
                                  <FolderOpen className="w-4 h-4 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{project.title}</p>
                                  <p className="text-sm text-muted-foreground">
                                    Projet créé • {new Date(project.createdAt).toLocaleDateString()}
                                  </p>
                                </div>
                                {renderPhase0Status(project.status)}
                              </div>
                            ))}

                            {projects.slice(0, 3).map((project) => (
                              <div
                                key={`an-${project.id}`}
                                className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
                              >
                                <div className="p-2 bg-blue-500/10 rounded-lg">
                                  <FileSearch className="w-4 h-4 text-blue-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{project.name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    Analyse • {new Date(project.createdAt).toLocaleDateString()}
                                  </p>
                                </div>
                                <Badge variant={project.status === 'completed' ? 'default' : 'secondary'}>
                                  {project.status === 'completed' ? 'Terminé' : 'En cours'}
                                </Badge>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Aide contextuelle selon segment */}
                <div>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        {segment === 'B2B' ? 'Boostez vos analyses' : 'Comment ça marche ?'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                      {segment === 'B2C' && (
                        <>
                          <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-primary font-bold">1</span>
                            </div>
                            <div>
                              <p className="font-medium">Définissez votre projet</p>
                              <p className="text-muted-foreground">
                                Décrivez vos travaux, votre bien, vos contraintes
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-primary font-bold">2</span>
                            </div>
                            <div>
                              <p className="font-medium">Recevez des devis</p>
                              <p className="text-muted-foreground">
                                Sollicitez des artisans pour votre projet
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-primary font-bold">3</span>
                            </div>
                            <div>
                              <p className="font-medium">Analysez vos devis</p>
                              <p className="text-muted-foreground">
                                TORP analyse et compare vos devis en contexte
                              </p>
                            </div>
                          </div>
                        </>
                      )}

                      {segment === 'B2B' && (
                        <>
                          <div className="flex gap-3">
                            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-medium">Générez des tickets TORP</p>
                              <p className="text-muted-foreground">
                                Offrez à vos clients une garantie de qualité
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <Shield className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-medium">Certifications à jour</p>
                              <p className="text-muted-foreground">
                                Vos qualifications valorisent vos analyses
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <Target className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-medium">Analyses contextuelles</p>
                              <p className="text-muted-foreground">
                                Liez analyses et définitions de projet
                              </p>
                            </div>
                          </div>
                        </>
                      )}

                      {segment === 'B2G' && (
                        <>
                          <div className="flex gap-3">
                            <Scale className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-medium">Conformité marchés</p>
                              <p className="text-muted-foreground">
                                Vérifiez la conformité des offres reçues
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <FileCheck className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-medium">CCTP automatisé</p>
                              <p className="text-muted-foreground">
                                Générez des cahiers des charges conformes
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <BarChart3 className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-medium">Reporting budgétaire</p>
                              <p className="text-muted-foreground">
                                Suivez vos engagements et prévisions
                              </p>
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Alertes selon segment */}
                  {stats && stats.pendingItems > 0 && (
                    <Alert className="mt-4">
                      <Clock className="h-4 w-4" />
                      <AlertTitle>Analyses en attente</AlertTitle>
                      <AlertDescription>
                        {stats.pendingItems} analyse(s) en cours de traitement
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

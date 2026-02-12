/**
 * ProjetPage - Page projet unifiée avec navigation par phases
 * Les phases sont affichées comme onglets dans le CONTENU, pas dans le sidebar
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Lightbulb,
  Send,
  HardHat,
  CheckCircle2,
  Wrench,
  ChevronLeft,
  Sparkles,
  Building2,
  MapPin,
  Calendar,
  Euro,
  AlertCircle,
  Check,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

// Import des contenus de phase
import Phase0Dashboard from '@/pages/phase0/Phase0Dashboard';
import Phase1Consultation from '@/pages/phase1/Phase1Consultation';
import Phase2Dashboard from '@/pages/phase2/Phase2Dashboard';
import Phase3Dashboard from '@/pages/phase3/Phase3Dashboard';
import Phase4Dashboard from '@/pages/phase4/Phase4Dashboard';
import Phase5Dashboard from '@/pages/phase5/Phase5Dashboard';

interface Phase {
  id: number;
  key: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
  aiFeatures: string[];
}

const PHASES: Phase[] = [
  {
    id: 0,
    key: 'conception',
    title: 'Phase 1',
    subtitle: 'Conception',
    icon: Lightbulb,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    description: 'Définir le projet, les lots et estimer le budget',
    aiFeatures: ['Déduction automatique des lots', 'Estimation budget IA', 'Génération CCTP'],
  },
  {
    id: 1,
    key: 'consultation',
    title: 'Phase 2',
    subtitle: 'Consultation',
    icon: Send,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    description: 'Consulter et sélectionner les entreprises',
    aiFeatures: ['Matching entreprises RGE', 'Analyse des devis', 'Scoring automatique'],
  },
  {
    id: 2,
    key: 'execution',
    title: 'Phase 3',
    subtitle: 'Exécution',
    icon: HardHat,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    description: 'Suivre et contrôler les travaux',
    aiFeatures: ['Suivi temps réel', 'Analyse photos chantier', 'Alertes automatiques'],
  },
  {
    id: 3,
    key: 'reception',
    title: 'Phase 4',
    subtitle: 'Réception',
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    description: 'Réceptionner et lever les réserves',
    aiFeatures: ['OPR guidée', 'PV automatique', 'Suivi garanties'],
  },
  {
    id: 4,
    key: 'maintenance',
    title: 'Phase 5',
    subtitle: 'Maintenance',
    icon: Wrench,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    description: 'Maintenir et exploiter le bien',
    aiFeatures: ['Carnet numérique', 'Rappels entretien', 'Gestion sinistres'],
  },
];

export function ProjetPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Phase active depuis l'URL ou par défaut
  const activePhaseKey = searchParams.get('phase') || 'conception';
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Simuler le chargement du projet
  useEffect(() => {
    const loadProject = async () => {
      setLoading(true);
      // Simuler un appel API
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mock project data
      setProject({
        id: projectId,
        nom: 'Rénovation Appartement Paris 16',
        adresse: '42 Avenue Victor Hugo, 75016 Paris',
        type: 'Rénovation complète',
        surface: 120,
        budget_estime: 85000,
        phase_actuelle: 1,
        avancement: 35,
        date_creation: '2024-01-15',
        lots: ['Électricité', 'Plomberie', 'Peinture', 'Menuiserie'],
      });
      setLoading(false);
    };

    if (projectId) {
      loadProject();
    }
  }, [projectId]);

  const setActivePhase = (phaseKey: string) => {
    setSearchParams({ phase: phaseKey });
  };

  const activePhase = PHASES.find(p => p.key === activePhaseKey) || PHASES[0];
  const activePhaseIndex = PHASES.findIndex(p => p.key === activePhaseKey);

  const getPhaseStatus = (phase: Phase): 'completed' | 'active' | 'pending' => {
    if (!project) return 'pending';
    const projectPhase = project.phase_actuelle || 0;

    if (phase.id < projectPhase) return 'completed';
    if (phase.id === projectPhase) return 'active';
    return 'pending';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <AlertCircle className="h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Projet non trouvé</h2>
        <p className="text-gray-500 mb-6">Ce projet n'existe pas ou a été supprimé.</p>
        <Button onClick={() => navigate('/projets')}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Retour aux projets
        </Button>
      </div>
    );
  }

  const globalProgress = Math.round(((project.phase_actuelle + 1) / PHASES.length) * 100);

  return (
    <div className="space-y-6">
      {/* Header projet */}
      <div className="flex items-start justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2"
            onClick={() => navigate('/projets')}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Mes projets
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">{project.nom}</h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {project.adresse}
            </span>
            <span className="flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              {project.surface} m²
            </span>
            <span className="flex items-center gap-1">
              <Euro className="h-4 w-4" />
              {project.budget_estime?.toLocaleString('fr-FR')} €
            </span>
          </div>
        </div>
        <div className="text-right">
          <Badge className={activePhase.bgColor + ' ' + activePhase.color + ' border ' + activePhase.borderColor}>
            {activePhase.title} - {activePhase.subtitle}
          </Badge>
        </div>
      </div>

      {/* Barre de progression globale */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progression globale du projet</span>
            <span className="text-sm text-gray-500">{project.avancement}%</span>
          </div>
          <Progress value={project.avancement} className="h-2" />
        </CardContent>
      </Card>

      {/* Navigation phases - VISUELLE */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4">
          <div className="flex items-center justify-between">
            {PHASES.map((phase, index) => {
              const Icon = phase.icon;
              const status = getPhaseStatus(phase);
              const isActive = phase.key === activePhaseKey;

              return (
                <React.Fragment key={phase.key}>
                  <button
                    onClick={() => setActivePhase(phase.key)}
                    className={cn(
                      'flex flex-col items-center p-3 rounded-xl transition-all relative',
                      'hover:bg-white hover:shadow-md',
                      isActive && 'bg-white shadow-md ring-2 ring-primary/20',
                      status === 'completed' && !isActive && 'opacity-70'
                    )}
                  >
                    {/* Badge de statut */}
                    {status === 'completed' && (
                      <div className="absolute -top-1 -right-1 h-5 w-5 bg-green-500 rounded-full flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                    {status === 'active' && !isActive && (
                      <div className="absolute -top-1 -right-1 h-5 w-5 bg-blue-500 rounded-full flex items-center justify-center">
                        <Clock className="h-3 w-3 text-white" />
                      </div>
                    )}

                    <div
                      className={cn(
                        'w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-colors',
                        isActive ? phase.bgColor : 'bg-gray-200',
                        status === 'completed' && 'bg-green-100'
                      )}
                    >
                      {status === 'completed' ? (
                        <CheckCircle2 className="h-6 w-6 text-green-600" />
                      ) : (
                        <Icon className={cn('h-6 w-6', isActive ? phase.color : 'text-gray-400')} />
                      )}
                    </div>
                    <span className={cn(
                      'text-xs font-medium',
                      isActive ? 'text-gray-900' : 'text-gray-500'
                    )}>
                      {phase.title}
                    </span>
                    <span className={cn(
                      'text-xs',
                      isActive ? 'text-gray-700' : 'text-gray-400'
                    )}>
                      {phase.subtitle}
                    </span>
                  </button>

                  {/* Connecteur */}
                  {index < PHASES.length - 1 && (
                    <div className={cn(
                      'flex-1 h-0.5 mx-2',
                      status === 'completed' ? 'bg-green-300' : 'bg-gray-200'
                    )}>
                      <ArrowRight className={cn(
                        'h-4 w-4 -mt-1.5 ml-auto mr-auto',
                        status === 'completed' ? 'text-green-400' : 'text-gray-300'
                      )} />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Info phase active + Fonctionnalités IA */}
      <Card className={cn('border-l-4', activePhase.borderColor)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {React.createElement(activePhase.icon, { className: cn('h-5 w-5', activePhase.color) })}
                {activePhase.subtitle}
              </CardTitle>
              <CardDescription>{activePhase.description}</CardDescription>
            </div>
            <div className="flex items-center gap-2 text-sm text-primary">
              <Sparkles className="h-4 w-4" />
              Fonctionnalités IA
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            {activePhase.aiFeatures.map((feature, i) => (
              <Badge key={i} variant="secondary" className="bg-primary/5 text-primary">
                <Sparkles className="h-3 w-3 mr-1" />
                {feature}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Contenu de la phase active */}
      <div className="bg-white rounded-lg border p-6">
        {activePhaseKey === 'conception' && (
          <Phase0ProjectContent projectId={projectId!} project={project} />
        )}
        {activePhaseKey === 'consultation' && (
          <Phase1ProjectContent projectId={projectId!} project={project} />
        )}
        {activePhaseKey === 'execution' && (
          <Phase2ProjectContent projectId={projectId!} project={project} />
        )}
        {activePhaseKey === 'reception' && (
          <Phase3ProjectContent projectId={projectId!} project={project} />
        )}
        {activePhaseKey === 'maintenance' && (
          <Phase4ProjectContent projectId={projectId!} project={project} />
        )}
      </div>
    </div>
  );
}

// Contenus simplifiés pour chaque phase
function Phase0ProjectContent({ projectId, project }: { projectId: string; project: any }) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/phase0/project/${projectId}`)}>
          <CardHeader>
            <CardTitle className="text-lg">Définir le projet</CardTitle>
            <CardDescription>Type de travaux, surface, pièces</CardDescription>
          </CardHeader>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/phase0/project/${projectId}?tab=lots`)}>
          <CardHeader>
            <CardTitle className="text-lg">Lots & Budget</CardTitle>
            <CardDescription>Estimation automatique par l'IA</CardDescription>
          </CardHeader>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/phase0/project/${projectId}/analyze`)}>
          <CardHeader>
            <CardTitle className="text-lg">Analyser des devis</CardTitle>
            <CardDescription>Comparer les propositions reçues</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {project.lots && project.lots.length > 0 && (
        <div>
          <h3 className="font-medium mb-3">Lots identifiés ({project.lots.length})</h3>
          <div className="flex flex-wrap gap-2">
            {project.lots.map((lot: string, i: number) => (
              <Badge key={i} variant="outline">{lot}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Phase1ProjectContent({ projectId, project }: { projectId: string; project: any }) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/phase1/project/${projectId}`)}>
          <CardHeader>
            <CardTitle className="text-lg">Consulter des entreprises</CardTitle>
            <CardDescription>Trouver des artisans RGE qualifiés</CardDescription>
          </CardHeader>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg">Comparer les devis</CardTitle>
            <CardDescription>Analyse IA des propositions</CardDescription>
          </CardHeader>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg">Sélectionner</CardTitle>
            <CardDescription>Choisir les entreprises retenues</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}

function Phase2ProjectContent({ projectId, project }: { projectId: string; project: any }) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/phase2/${projectId}`)}>
          <CardHeader>
            <CardTitle className="text-lg">Vue d'ensemble</CardTitle>
            <CardDescription>Dashboard chantier</CardDescription>
          </CardHeader>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/phase2/${projectId}/planning`)}>
          <CardHeader>
            <CardTitle className="text-lg">Planning</CardTitle>
            <CardDescription>Gantt et jalons</CardDescription>
          </CardHeader>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/phase2/${projectId}/reunions`)}>
          <CardHeader>
            <CardTitle className="text-lg">Réunions</CardTitle>
            <CardDescription>Comptes-rendus</CardDescription>
          </CardHeader>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/phase2/${projectId}/journal`)}>
          <CardHeader>
            <CardTitle className="text-lg">Journal</CardTitle>
            <CardDescription>Suivi quotidien</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}

function Phase3ProjectContent({ projectId, project }: { projectId: string; project: any }) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/phase4/${projectId}`)}>
          <CardHeader>
            <CardTitle className="text-lg">OPR</CardTitle>
            <CardDescription>Opérations préalables à réception</CardDescription>
          </CardHeader>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/phase4/${projectId}/reserves`)}>
          <CardHeader>
            <CardTitle className="text-lg">Réserves</CardTitle>
            <CardDescription>Suivi des réserves</CardDescription>
          </CardHeader>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/phase4/${projectId}/garanties`)}>
          <CardHeader>
            <CardTitle className="text-lg">Garanties</CardTitle>
            <CardDescription>Suivi des garanties</CardDescription>
          </CardHeader>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/phase4/${projectId}/doe`)}>
          <CardHeader>
            <CardTitle className="text-lg">DOE</CardTitle>
            <CardDescription>Documents ouvrages exécutés</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}

function Phase4ProjectContent({ projectId, project }: { projectId: string; project: any }) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/phase5/${projectId}`)}>
          <CardHeader>
            <CardTitle className="text-lg">Carnet numérique</CardTitle>
            <CardDescription>Documentation du logement</CardDescription>
          </CardHeader>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/phase5/${projectId}/diagnostics`)}>
          <CardHeader>
            <CardTitle className="text-lg">Diagnostics</CardTitle>
            <CardDescription>DPE, Électricité, etc.</CardDescription>
          </CardHeader>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/phase5/${projectId}/entretien`)}>
          <CardHeader>
            <CardTitle className="text-lg">Entretien</CardTitle>
            <CardDescription>Planning maintenance</CardDescription>
          </CardHeader>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/phase5/${projectId}/sinistres`)}>
          <CardHeader>
            <CardTitle className="text-lg">Sinistres</CardTitle>
            <CardDescription>Gestion des sinistres</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}

export default ProjetPage;

/**
 * NextStepsCard - Guide l'utilisateur vers les prochaines étapes
 * Affiche des actions contextuelles selon le type d'utilisateur (B2C, B2B, B2G)
 * et le statut du projet
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ArrowRight,
  FileSearch,
  Users,
  Send,
  FileText,
  HardHat,
  CheckCircle2,
  Briefcase,
  Building2,
  Landmark,
  Home,
  ClipboardList,
  UserSearch,
  Scale,
  FileSpreadsheet,
} from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import type { Phase0Project } from '@/services/phase0';

interface NextStepsCardProps {
  project: Phase0Project;
  hasTender?: boolean;
  hasDocuments?: boolean;
}

interface NextStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  buttonLabel: string;
  variant?: 'default' | 'outline' | 'secondary';
  badge?: string;
  completed?: boolean;
  priority: number;
}

export function NextStepsCard({ project, hasTender, hasDocuments }: NextStepsCardProps) {
  const navigate = useNavigate();
  const { isB2C, isB2B, isB2G, labels } = useProfile();

  // Calculer les étapes complétées
  const completedSteps = [
    project.completeness?.overall >= 80, // Projet bien rempli
    hasDocuments, // Documents générés
    hasTender, // DCE/Appel d'offres créé
    project.status === 'in_consultation' || project.status === 'validated', // Consultation lancée
  ].filter(Boolean).length;

  const totalSteps = 4;
  const progressPercent = (completedSteps / totalSteps) * 100;

  // Déterminer les prochaines étapes selon le profil
  const getNextSteps = (): NextStep[] => {
    const steps: NextStep[] = [];
    const projectId = project.id;

    if (isB2C) {
      // Parcours B2C : Particulier cherchant des artisans
      steps.push({
        id: 'generate-docs',
        title: 'Générer votre cahier des charges',
        description: 'Créez les documents techniques pour préciser vos besoins aux artisans',
        icon: <FileText className="w-5 h-5" />,
        action: () => navigate(`/phase0/project/${projectId}`, { state: { tab: 'documents' } }),
        buttonLabel: 'Générer documents',
        variant: hasDocuments ? 'outline' : 'default',
        completed: hasDocuments,
        priority: hasDocuments ? 3 : 1,
      });

      steps.push({
        id: 'find-artisans',
        title: 'Trouver des artisans',
        description: 'Recherchez et comparez des artisans qualifiés près de chez vous',
        icon: <UserSearch className="w-5 h-5" />,
        action: () => navigate(`/phase1/project/${projectId}`),
        buttonLabel: 'Rechercher',
        variant: 'default',
        badge: 'Recommandé',
        priority: 1,
      });

      steps.push({
        id: 'analyze-quotes',
        title: 'Analyser vos devis',
        description: 'Importez et analysez les devis reçus avec notre IA TORP',
        icon: <FileSearch className="w-5 h-5" />,
        action: () => navigate(`/phase0/project/${projectId}/analyze`),
        buttonLabel: 'Analyser devis',
        variant: 'outline',
        priority: 2,
      });

      if (project.status === 'in_consultation' || project.status === 'validated') {
        steps.push({
          id: 'start-works',
          title: 'Démarrer le chantier',
          description: 'Suivez l\'avancement de vos travaux en temps réel',
          icon: <HardHat className="w-5 h-5" />,
          action: () => navigate(`/phase2/${projectId}`),
          buttonLabel: 'Gérer le chantier',
          variant: 'default',
          badge: 'Nouveau',
          priority: 0,
        });
      }
    } else if (isB2B) {
      // Parcours B2B : Professionnel préparant une offre ou gérant un projet
      steps.push({
        id: 'prepare-offer',
        title: 'Préparer votre offre',
        description: 'Analysez la demande et préparez votre proposition commerciale',
        icon: <ClipboardList className="w-5 h-5" />,
        action: () => navigate(`/phase1/project/${projectId}`),
        buttonLabel: 'Préparer l\'offre',
        variant: 'default',
        badge: 'Pro',
        priority: 1,
      });

      steps.push({
        id: 'generate-docs',
        title: 'Générer les documents techniques',
        description: 'Créez le mémoire technique, DPGF et planning détaillé',
        icon: <FileSpreadsheet className="w-5 h-5" />,
        action: () => navigate(`/phase0/project/${projectId}`, { state: { tab: 'documents' } }),
        buttonLabel: 'Documents',
        variant: hasDocuments ? 'outline' : 'default',
        completed: hasDocuments,
        priority: hasDocuments ? 3 : 2,
      });

      steps.push({
        id: 'manage-subcontractors',
        title: 'Gérer les sous-traitants',
        description: 'Consultez et sélectionnez vos sous-traitants pour ce projet',
        icon: <Users className="w-5 h-5" />,
        action: () => navigate(`/phase1/project/${projectId}`, { state: { tab: 'subcontractors' } }),
        buttonLabel: 'Sous-traitants',
        variant: 'outline',
        priority: 2,
      });

      if (project.status === 'in_consultation' || project.status === 'validated') {
        steps.push({
          id: 'manage-site',
          title: 'Piloter le chantier',
          description: 'Gérez le planning, les ressources et le suivi d\'avancement',
          icon: <HardHat className="w-5 h-5" />,
          action: () => navigate(`/phase2/${projectId}`),
          buttonLabel: 'Chantier',
          variant: 'default',
          badge: 'En cours',
          priority: 0,
        });
      }
    } else if (isB2G) {
      // Parcours B2G : Collectivité lançant un marché public
      steps.push({
        id: 'create-dce',
        title: 'Créer l\'appel d\'offres',
        description: 'Générez le DCE complet (RC, CCTP, DPGF, AE)',
        icon: <Send className="w-5 h-5" />,
        action: () => navigate(`/phase0/project/${projectId}`, { state: { tab: 'tender' } }),
        buttonLabel: 'Créer l\'AO',
        variant: hasTender ? 'outline' : 'default',
        badge: 'Marché public',
        completed: hasTender,
        priority: hasTender ? 3 : 1,
      });

      steps.push({
        id: 'launch-consultation',
        title: 'Lancer la mise en concurrence',
        description: 'Publiez l\'appel d\'offres et invitez les entreprises',
        icon: <Scale className="w-5 h-5" />,
        action: () => navigate(`/phase1/project/${projectId}`),
        buttonLabel: 'Consultation',
        variant: 'default',
        priority: hasTender ? 1 : 2,
      });

      steps.push({
        id: 'analyze-responses',
        title: 'Analyser les offres',
        description: 'Évaluez les réponses avec le scoring TORP',
        icon: <FileSearch className="w-5 h-5" />,
        action: () => navigate(`/phase0/project/${projectId}/analyze`),
        buttonLabel: 'Analyser',
        variant: 'outline',
        priority: 2,
      });

      if (project.status === 'in_consultation' || project.status === 'validated') {
        steps.push({
          id: 'follow-execution',
          title: 'Suivre l\'exécution',
          description: 'Pilotez le marché et contrôlez l\'avancement',
          icon: <HardHat className="w-5 h-5" />,
          action: () => navigate(`/phase2/${projectId}`),
          buttonLabel: 'Suivi marché',
          variant: 'default',
          priority: 0,
        });
      }
    }

    // Trier par priorité (0 = plus important)
    return steps.sort((a, b) => a.priority - b.priority);
  };

  const steps = getNextSteps();
  const primaryStep = steps[0];
  const secondarySteps = steps.slice(1, 4);

  // Icône du profil
  const ProfileIcon = isB2C ? Home : isB2B ? Building2 : Landmark;

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <ProfileIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Prochaines étapes</CardTitle>
              <CardDescription>
                {isB2C && 'Trouvez les meilleurs artisans pour votre projet'}
                {isB2B && 'Préparez et soumettez votre offre'}
                {isB2G && 'Lancez votre consultation publique'}
              </CardDescription>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground mb-1">Progression</div>
            <div className="flex items-center gap-2">
              <Progress value={progressPercent} className="w-24 h-2" />
              <span className="text-sm font-medium">{completedSteps}/{totalSteps}</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Action principale */}
        {primaryStep && (
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {primaryStep.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{primaryStep.title}</h4>
                    {primaryStep.badge && (
                      <Badge variant="default" className="text-xs">{primaryStep.badge}</Badge>
                    )}
                    {primaryStep.completed && (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {primaryStep.description}
                  </p>
                </div>
              </div>
              <Button onClick={primaryStep.action} className="flex-shrink-0">
                {primaryStep.buttonLabel}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Actions secondaires */}
        {secondarySteps.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {secondarySteps.map((step) => (
              <div
                key={step.id}
                className="p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={step.action}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                    {step.icon}
                  </div>
                  {step.completed && (
                    <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />
                  )}
                </div>
                <h5 className="font-medium text-sm">{step.title}</h5>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {step.description}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-7 text-xs px-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    step.action();
                  }}
                >
                  {step.buttonLabel}
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default NextStepsCard;

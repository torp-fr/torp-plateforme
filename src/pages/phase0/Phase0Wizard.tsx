/**
 * Page du wizard Phase 0
 * S'adapte automatiquement au type d'utilisateur (B2C/B2B/B2G)
 */

import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Building2, Landmark, Home } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { WizardContainer } from '@/components/phase0/wizard';
import { useApp, UserType } from '@/context/AppContext';
import type { WizardMode } from '@/types/phase0/wizard.types';

// Configuration par type d'utilisateur
const WIZARD_CONFIG: Record<UserType, {
  mode: WizardMode;
  title: string;
  titleEdit: string;
  description: string;
  badge?: string;
  badgeColor?: string;
  icon: React.ReactNode;
}> = {
  B2C: {
    mode: 'b2c',
    title: 'Créer votre projet',
    titleEdit: 'Modifier votre projet',
    description: 'Suivez les étapes pour définir votre projet de travaux',
    icon: <Home className="w-6 h-6" />,
  },
  B2B: {
    mode: 'b2b',
    title: 'Nouvelle mission',
    titleEdit: 'Modifier la mission',
    description: 'Définissez le projet client pour une analyse contextualisée',
    badge: 'Pro',
    badgeColor: 'bg-blue-500',
    icon: <Building2 className="w-6 h-6" />,
  },
  B2G: {
    mode: 'b2g',
    title: 'Nouveau marché public',
    titleEdit: 'Modifier le marché',
    description: 'Structurez votre consultation pour des offres conformes',
    badge: 'Collectivité',
    badgeColor: 'bg-purple-500',
    icon: <Landmark className="w-6 h-6" />,
  },
  admin: {
    mode: 'b2c', // Admin utilise B2C par défaut
    title: 'Créer un projet (Admin)',
    titleEdit: 'Modifier le projet',
    description: 'Mode administrateur',
    badge: 'Admin',
    badgeColor: 'bg-orange-500',
    icon: <Home className="w-6 h-6" />,
  },
};

export function Phase0Wizard() {
  const { projectId } = useParams<{ projectId?: string }>();
  const { userType } = useApp();

  // Configuration basée sur le type d'utilisateur
  const config = useMemo(() => {
    return WIZARD_CONFIG[userType] || WIZARD_CONFIG.B2C;
  }, [userType]);

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="container max-w-5xl mx-auto px-4 py-8">
        {/* Navigation retour */}
        <div className="mb-6">
          <Button variant="ghost" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour au tableau de bord
            </Link>
          </Button>
        </div>

        {/* Titre avec badge selon le mode */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="text-primary">{config.icon}</span>
            <h1 className="text-3xl font-bold">
              {projectId ? config.titleEdit : config.title}
            </h1>
            {config.badge && (
              <Badge className={`${config.badgeColor} text-white`}>
                {config.badge}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            {config.description}
          </p>
        </div>

        {/* Wizard avec le mode approprié */}
        <WizardContainer
          projectId={projectId}
          mode={config.mode}
          onComplete={(project) => {
            console.log('Projet créé:', project);
            // La navigation est gérée dans le WizardContainer
          }}
        />
      </div>
    </div>
  );
}

export default Phase0Wizard;

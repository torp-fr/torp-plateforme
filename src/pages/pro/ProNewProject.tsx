/**
 * Page du wizard Phase 0 pour Professionnels (B2B)
 * Adapté pour la création de projets client par les entreprises
 */

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Building2 } from 'lucide-react';
import { WizardContainer } from '@/components/phase0/wizard';


export function Phase0WizardB2B() {
  const { projectId } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="max-w-5xl mx-auto">
        {/* Navigation retour */}
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate('/pro')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour au tableau de bord
          </Button>
        </div>

        {/* Titre */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Building2 className="w-8 h-8 text-primary" />
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">
              PRO
            </span>
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {projectId ? 'Modifier le projet client' : 'Nouveau projet client'}
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Renseignez les informations de votre client et du chantier.
            La plateforme générera automatiquement les documents adaptés (DCE, CCTP, devis...).
          </p>
        </div>

        {/* Wizard en mode B2B */}
        <WizardContainer
          projectId={projectId}
          mode="b2b_professional"
          onComplete={(project) => {
            console.log('Projet B2B créé:', project);
            // Redirection vers le détail du projet
            navigate(`/pro/projects/${project.id}`);
          }}
        />
      </div>
    </div>
  );
}

export default Phase0WizardB2B;

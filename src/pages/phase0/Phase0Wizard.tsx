/**
 * Page du wizard Phase 0 pour particuliers (B2C)
 */

import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { WizardContainer } from '@/components/phase0/wizard';

export function Phase0Wizard() {
  const { projectId } = useParams<{ projectId?: string }>();

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="container max-w-5xl mx-auto px-4 py-8">
        {/* Navigation retour */}
        <div className="mb-6">
          <Button variant="ghost" asChild>
            <Link to="/phase0">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Link>
          </Button>
        </div>

        {/* Titre */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">
            {projectId ? 'Modifier votre projet' : 'Créer votre projet'}
          </h1>
          <p className="text-muted-foreground">
            Suivez les étapes pour définir votre projet de travaux
          </p>
        </div>

        {/* Wizard */}
        <WizardContainer
          projectId={projectId}
          mode="b2c"
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

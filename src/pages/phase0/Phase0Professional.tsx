/**
 * Page du formulaire professionnel Phase 0 (B2B)
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ProfessionalForm } from '@/components/phase0/forms';

export function Phase0Professional() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="container max-w-4xl mx-auto px-4 py-8">
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
            Créer un projet professionnel
          </h1>
          <p className="text-muted-foreground">
            Formulaire complet pour les professionnels du bâtiment
          </p>
        </div>

        {/* Formulaire */}
        <ProfessionalForm
          onSuccess={(projectId) => {
            navigate(`/phase0/project/${projectId}`);
          }}
        />
      </div>
    </div>
  );
}

export default Phase0Professional;

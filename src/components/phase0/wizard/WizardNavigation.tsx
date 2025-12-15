/**
 * Composant de navigation du wizard Phase 0
 * Boutons précédent/suivant et actions
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Check, Loader2, SkipForward, Save } from 'lucide-react';

export interface WizardNavigationProps {
  canGoPrevious: boolean;
  canGoNext: boolean;
  isFirstStep: boolean;
  isLastStep: boolean;
  isOptionalStep?: boolean;
  isLoading?: boolean;
  isSaving?: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSkip?: () => void;
  onSaveDraft?: () => void;
  onComplete?: () => void;
  className?: string;
}

export function WizardNavigation({
  canGoPrevious,
  canGoNext,
  isFirstStep,
  isLastStep,
  isOptionalStep = false,
  isLoading = false,
  isSaving = false,
  onPrevious,
  onNext,
  onSkip,
  onSaveDraft,
  onComplete,
  className,
}: WizardNavigationProps) {
  const isProcessing = isLoading || isSaving;

  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      {/* Groupe gauche */}
      <div className="flex items-center gap-2">
        {/* Bouton précédent */}
        {!isFirstStep && (
          <Button
            variant="outline"
            onClick={onPrevious}
            disabled={!canGoPrevious || isProcessing}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Précédent
          </Button>
        )}

        {/* Bouton sauvegarder brouillon */}
        {onSaveDraft && (
          <Button
            variant="ghost"
            onClick={onSaveDraft}
            disabled={isProcessing}
            className="hidden sm:flex"
          >
            <Save className="w-4 h-4 mr-2" />
            Sauvegarder
          </Button>
        )}
      </div>

      {/* Groupe droite */}
      <div className="flex items-center gap-2">
        {/* Bouton passer (étape optionnelle) */}
        {isOptionalStep && onSkip && !isLastStep && (
          <Button
            variant="ghost"
            onClick={onSkip}
            disabled={isProcessing}
          >
            <SkipForward className="w-4 h-4 mr-2" />
            Passer
          </Button>
        )}

        {/* Bouton suivant ou terminer */}
        {isLastStep ? (
          <Button
            onClick={onComplete}
            disabled={!canGoNext || isProcessing}
            className="min-w-[140px]"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Finalisation...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Terminer
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={onNext}
            disabled={!canGoNext || isProcessing}
            className="min-w-[120px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Chargement...
              </>
            ) : (
              <>
                Suivant
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

export default WizardNavigation;

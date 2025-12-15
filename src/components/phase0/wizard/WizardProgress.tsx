/**
 * Composant de progression du wizard Phase 0
 * Affiche les étapes et leur état de complétion
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Check, Loader2 } from 'lucide-react';

// Interface simplifiée pour la progression
export interface ProgressStep {
  id: string;
  title: string;
  shortTitle?: string;
  description?: string;
  isOptional?: boolean;
}

export interface WizardProgressProps {
  steps: ProgressStep[];
  currentStepId: string;
  completedStepIds: string[];
  onStepClick?: (stepId: string) => void;
  isProcessing?: boolean;
  className?: string;
}

export function WizardProgress({
  steps,
  currentStepId,
  completedStepIds,
  onStepClick,
  isProcessing = false,
  className,
}: WizardProgressProps) {
  const currentIndex = steps.findIndex(s => s.id === currentStepId);

  return (
    <div className={cn('w-full', className)}>
      {/* Vue desktop */}
      <nav className="hidden md:block" aria-label="Progression">
        <ol className="flex items-center justify-between">
          {steps.map((step, index) => {
            const isCompleted = completedStepIds.includes(step.id);
            const isCurrent = step.id === currentStepId;
            const isPast = index < currentIndex;
            const isClickable = isCompleted || isPast || index === currentIndex;

            return (
              <li key={step.id} className="flex-1 relative">
                {/* Ligne de connexion */}
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'absolute top-5 left-1/2 w-full h-0.5',
                      isCompleted || isPast ? 'bg-primary' : 'bg-muted'
                    )}
                    aria-hidden="true"
                  />
                )}

                <button
                  onClick={() => isClickable && onStepClick?.(step.id)}
                  disabled={!isClickable}
                  className={cn(
                    'relative flex flex-col items-center group w-full',
                    isClickable ? 'cursor-pointer' : 'cursor-not-allowed'
                  )}
                >
                  {/* Cercle indicateur */}
                  <span
                    className={cn(
                      'relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all',
                      isCompleted
                        ? 'bg-primary border-primary text-primary-foreground'
                        : isCurrent
                        ? 'bg-background border-primary text-primary'
                        : 'bg-background border-muted text-muted-foreground'
                    )}
                  >
                    {isProcessing && isCurrent ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : isCompleted ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <span className="text-sm font-medium">{index + 1}</span>
                    )}
                  </span>

                  {/* Titre */}
                  <span
                    className={cn(
                      'mt-2 text-xs font-medium text-center transition-colors',
                      isCurrent
                        ? 'text-primary'
                        : isCompleted
                        ? 'text-foreground'
                        : 'text-muted-foreground',
                      isClickable && 'group-hover:text-primary'
                    )}
                  >
                    {step.title}
                  </span>

                  {/* Badge optionnel */}
                  {step.isOptional && (
                    <span className="mt-1 text-[10px] text-muted-foreground">
                      (optionnel)
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Vue mobile */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            Étape {currentIndex + 1} sur {steps.length}
          </span>
          <span className="text-sm text-muted-foreground">
            {Math.round((completedStepIds.length / steps.length) * 100)}%
          </span>
        </div>

        {/* Barre de progression */}
        <div className="relative h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-primary transition-all duration-300"
            style={{ width: `${(completedStepIds.length / steps.length) * 100}%` }}
          />
        </div>

        {/* Titre de l'étape courante */}
        <div className="mt-3">
          <h2 className="text-lg font-semibold">
            {steps[currentIndex]?.title}
          </h2>
          {steps[currentIndex]?.description && (
            <p className="text-sm text-muted-foreground mt-1">
              {steps[currentIndex].description}
            </p>
          )}
        </div>

        {/* Liste des étapes (accordéon) */}
        <details className="mt-4">
          <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
            Voir toutes les étapes
          </summary>
          <ol className="mt-2 space-y-2">
            {steps.map((step, index) => {
              const isCompleted = completedStepIds.includes(step.id);
              const isCurrent = step.id === currentStepId;

              return (
                <li
                  key={step.id}
                  className={cn(
                    'flex items-center gap-3 py-2 px-3 rounded-md',
                    isCurrent && 'bg-muted'
                  )}
                >
                  <span
                    className={cn(
                      'flex items-center justify-center w-6 h-6 rounded-full text-xs',
                      isCompleted
                        ? 'bg-primary text-primary-foreground'
                        : isCurrent
                        ? 'border-2 border-primary text-primary'
                        : 'border border-muted-foreground text-muted-foreground'
                    )}
                  >
                    {isCompleted ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span
                    className={cn(
                      'text-sm',
                      isCurrent ? 'font-medium' : 'text-muted-foreground'
                    )}
                  >
                    {step.title}
                  </span>
                </li>
              );
            })}
          </ol>
        </details>
      </div>
    </div>
  );
}

export default WizardProgress;

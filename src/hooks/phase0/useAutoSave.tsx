/**
 * Hook d'auto-save pour les projets Phase 0
 * Sauvegarde automatique avec debounce et gestion des conflits
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Phase0ProjectService } from '@/services/phase0/project.service';
import { WizardService } from '@/services/phase0/wizard.service';
import type { Phase0Project } from '@/types/phase0/project.types';
import { useToast } from '@/hooks/use-toast';

// =============================================================================
// TYPES
// =============================================================================

export interface UseAutoSaveOptions {
  projectId?: string;
  enabled?: boolean;
  debounceMs?: number;
  onSaveStart?: () => void;
  onSaveSuccess?: (project: Phase0Project) => void;
  onSaveError?: (error: Error) => void;
}

export interface UseAutoSaveReturn {
  isSaving: boolean;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
  saveNow: () => Promise<void>;
  markDirty: () => void;
  error: string | null;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_DEBOUNCE_MS = 2000; // 2 secondes
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

// =============================================================================
// HOOK
// =============================================================================

export function useAutoSave(
  projectData: Partial<Phase0Project> | null,
  options: UseAutoSaveOptions = {}
): UseAutoSaveReturn {
  const {
    projectId,
    enabled = true,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    onSaveStart,
    onSaveSuccess,
    onSaveError,
  } = options;

  const { toast } = useToast();

  // États
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs pour éviter les closures stales
  const projectDataRef = useRef(projectData);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const lastSavedDataRef = useRef<string | null>(null);

  // Mettre à jour la ref quand les données changent
  useEffect(() => {
    projectDataRef.current = projectData;
  }, [projectData]);

  // Fonction de sauvegarde
  const performSave = useCallback(async () => {
    if (!projectId || !projectDataRef.current || !enabled) {
      return;
    }

    // Vérifier si les données ont vraiment changé
    const currentDataString = JSON.stringify(projectDataRef.current);
    if (currentDataString === lastSavedDataRef.current) {
      setHasUnsavedChanges(false);
      return;
    }

    setIsSaving(true);
    setError(null);
    onSaveStart?.();

    try {
      const updatedProject = await Phase0ProjectService.updateProject(
        projectId,
        projectDataRef.current
      );

      // Sauvegarder aussi l'état du wizard si des réponses sont présentes
      if (projectDataRef.current.wizardState?.answers) {
        await WizardService.saveAnswers(
          projectId,
          Object.fromEntries(
            Object.entries(projectDataRef.current.wizardState.answers)
              .map(([k, v]) => [k, typeof v === 'object' && v !== null && 'value' in v ? v.value : v])
          )
        );
      }

      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      lastSavedDataRef.current = currentDataString;
      retryCountRef.current = 0;

      onSaveSuccess?.(updatedProject);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';

      // Ignorer silencieusement les erreurs de schéma/table manquante (mode mémoire)
      const isSchemaError = errorMessage.includes('schema cache') ||
        errorMessage.includes('PGRST') ||
        errorMessage.includes('column') ||
        errorMessage.includes('table');

      if (isSchemaError) {
        console.warn('[AutoSave] Tables non disponibles, mode mémoire actif');
        setHasUnsavedChanges(false); // Marquer comme "sauvé" pour éviter les retries
        retryCountRef.current = 0;
      } else {
        setError(errorMessage);

        // Retry automatique uniquement pour les erreurs non-schéma
        if (retryCountRef.current < MAX_RETRY_ATTEMPTS) {
          retryCountRef.current++;
          console.warn(`[AutoSave] Retry ${retryCountRef.current}/${MAX_RETRY_ATTEMPTS}`);

          setTimeout(() => {
            performSave();
          }, RETRY_DELAY_MS * retryCountRef.current);
        } else {
          onSaveError?.(err instanceof Error ? err : new Error(errorMessage));
          toast({
            title: 'Erreur de sauvegarde',
            description: 'Impossible de sauvegarder vos modifications. Veuillez réessayer.',
            variant: 'destructive',
          });
        }
      }
    } finally {
      setIsSaving(false);
    }
  }, [projectId, enabled, onSaveStart, onSaveSuccess, onSaveError, toast]);

  // Sauvegarde avec debounce
  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      performSave();
    }, debounceMs);
  }, [performSave, debounceMs]);

  // Détecter les changements et déclencher l'auto-save
  useEffect(() => {
    if (!enabled || !projectId || !projectData) {
      return;
    }

    const currentDataString = JSON.stringify(projectData);
    if (currentDataString !== lastSavedDataRef.current) {
      setHasUnsavedChanges(true);
      debouncedSave();
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [projectData, enabled, projectId, debouncedSave]);

  // Sauvegarder avant de quitter la page
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'Vous avez des modifications non sauvegardées. Êtes-vous sûr de vouloir quitter ?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Sauvegarde immédiate
  const saveNow = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    await performSave();
  }, [performSave]);

  // Marquer comme modifié
  const markDirty = useCallback(() => {
    setHasUnsavedChanges(true);
    debouncedSave();
  }, [debouncedSave]);

  return {
    isSaving,
    lastSaved,
    hasUnsavedChanges,
    saveNow,
    markDirty,
    error,
  };
}

// =============================================================================
// COMPOSANT INDICATEUR
// =============================================================================

export interface AutoSaveIndicatorProps {
  isSaving: boolean;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
  error: string | null;
  className?: string;
}

export function AutoSaveIndicator({
  isSaving,
  lastSaved,
  hasUnsavedChanges,
  error,
  className,
}: AutoSaveIndicatorProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (error) {
    return (
      <div className={`flex items-center gap-2 text-sm text-destructive ${className || ''}`}>
        <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
        Erreur de sauvegarde
      </div>
    );
  }

  if (isSaving) {
    return (
      <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className || ''}`}>
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        Sauvegarde en cours...
      </div>
    );
  }

  if (hasUnsavedChanges) {
    return (
      <div className={`flex items-center gap-2 text-sm text-amber-600 ${className || ''}`}>
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        Modifications non sauvegardées
      </div>
    );
  }

  if (lastSaved) {
    return (
      <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className || ''}`}>
        <span className="w-2 h-2 rounded-full bg-green-500" />
        Sauvegardé à {formatTime(lastSaved)}
      </div>
    );
  }

  return null;
}

export default useAutoSave;

/**
 * TORP Phase 2 - Hook useChecklistState
 * Gestion de l'état de la checklist de démarrage chantier
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LogistiqueService } from '@/services/phase2/logistique.service';
import type { ChecklistDemarrage, ChecklistItem } from '@/types/phase2';

interface ChecklistItemUpdate {
  valide?: boolean;
  commentaire?: string;
  documentUrl?: string;
}

interface UseChecklistStateReturn {
  // Data
  checklist: ChecklistItem[];
  fullChecklist: ChecklistDemarrage | null;

  // Computed
  progress: number;
  completedCount: number;
  totalCount: number;
  isReadyToStart: boolean;
  requiredMissing: ChecklistItem[];
  byCategory: Record<string, ChecklistItem[]>;

  // Loading states
  isLoading: boolean;
  isUpdating: boolean;

  // Error
  error: Error | null;

  // Actions
  updateItem: (itemId: string, updates: ChecklistItemUpdate) => void;
  validateItem: (itemId: string) => void;
  invalidateItem: (itemId: string) => void;
  addComment: (itemId: string, comment: string) => void;
  attachDocument: (itemId: string, documentUrl: string) => void;
  validateChecklist: () => Promise<void>;
  resetChecklist: () => Promise<void>;

  // Refresh
  refresh: () => void;
}

export function useChecklistState(chantierId: string): UseChecklistStateReturn {
  const queryClient = useQueryClient();

  // ============================================
  // QUERIES
  // ============================================

  const checklistQuery = useQuery({
    queryKey: ['checklist', chantierId],
    queryFn: () => LogistiqueService.getChecklist(chantierId),
    enabled: !!chantierId,
  });

  // ============================================
  // COMPUTED VALUES
  // ============================================

  const checklist = checklistQuery.data?.items || [];
  const fullChecklist = checklistQuery.data || null;

  const completedCount = checklist.filter(item => item.valide).length;
  const totalCount = checklist.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const requiredMissing = checklist.filter(item => item.obligatoire && !item.valide);
  const isReadyToStart = requiredMissing.length === 0 && totalCount > 0;

  // Grouper par catégorie
  const byCategory = checklist.reduce((acc, item) => {
    const category = item.categorie || 'Autre';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, ChecklistItem[]>);

  // ============================================
  // MUTATIONS
  // ============================================

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, updates }: { itemId: string; updates: ChecklistItemUpdate }) =>
      LogistiqueService.updateChecklistItem(chantierId, itemId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist', chantierId] });
    },
  });

  const validateChecklistMutation = useMutation({
    mutationFn: () => LogistiqueService.validateChecklist(chantierId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist', chantierId] });
    },
  });

  const resetChecklistMutation = useMutation({
    mutationFn: () => LogistiqueService.resetChecklist(chantierId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist', chantierId] });
    },
  });

  // ============================================
  // ACTIONS
  // ============================================

  const updateItem = (itemId: string, updates: ChecklistItemUpdate) => {
    updateItemMutation.mutate({ itemId, updates });
  };

  const validateItem = (itemId: string) => {
    updateItemMutation.mutate({
      itemId,
      updates: {
        valide: true,
      },
    });
  };

  const invalidateItem = (itemId: string) => {
    updateItemMutation.mutate({
      itemId,
      updates: {
        valide: false,
      },
    });
  };

  const addComment = (itemId: string, comment: string) => {
    updateItemMutation.mutate({
      itemId,
      updates: {
        commentaire: comment,
      },
    });
  };

  const attachDocument = (itemId: string, documentUrl: string) => {
    updateItemMutation.mutate({
      itemId,
      updates: {
        documentUrl,
      },
    });
  };

  const validateChecklist = async () => {
    await validateChecklistMutation.mutateAsync();
  };

  const resetChecklist = async () => {
    await resetChecklistMutation.mutateAsync();
  };

  // ============================================
  // REFRESH
  // ============================================

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['checklist', chantierId] });
  };

  // ============================================
  // RETURN
  // ============================================

  return {
    // Data
    checklist,
    fullChecklist,

    // Computed
    progress,
    completedCount,
    totalCount,
    isReadyToStart,
    requiredMissing,
    byCategory,

    // Loading states
    isLoading: checklistQuery.isLoading,
    isUpdating: updateItemMutation.isPending,

    // Error
    error: checklistQuery.error || null,

    // Actions
    updateItem,
    validateItem,
    invalidateItem,
    addComment,
    attachDocument,
    validateChecklist,
    resetChecklist,

    // Refresh
    refresh,
  };
}

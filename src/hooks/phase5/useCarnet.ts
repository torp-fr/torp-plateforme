/**
 * Hook useCarnet - Phase 5
 * Gestion du carnet numérique du logement
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { carnetService } from '@/services/phase5/carnet.service';
import { useToast } from '@/hooks/use-toast';
import type {
  CarnetNumerique,
  TravauxHistorique,
  DiagnosticCarnet,
  EntretienProgramme,
  GarantieActive,
  Sinistre,
  DocumentCarnet,
  Phase5Stats,
} from '@/types/phase5';

export interface UseCarnetOptions {
  projectId: string;
  enabled?: boolean;
}

export function useCarnet({ projectId, enabled = true }: UseCarnetOptions) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ==========================================================================
  // QUERIES
  // ==========================================================================

  const carnetQuery = useQuery({
    queryKey: ['carnet', projectId],
    queryFn: () => carnetService.getCarnet(projectId),
    enabled: enabled && !!projectId,
  });

  const travauxQuery = useQuery({
    queryKey: ['travaux-historique', projectId],
    queryFn: () => carnetService.getTravauxHistorique(projectId),
    enabled: enabled && !!projectId,
  });

  const diagnosticsQuery = useQuery({
    queryKey: ['diagnostics-carnet', projectId],
    queryFn: () => carnetService.getDiagnostics(projectId),
    enabled: enabled && !!projectId,
  });

  const entretiensQuery = useQuery({
    queryKey: ['entretiens', projectId],
    queryFn: () => carnetService.getEntretiens(projectId),
    enabled: enabled && !!projectId,
  });

  const garantiesQuery = useQuery({
    queryKey: ['garanties-carnet', projectId],
    queryFn: () => carnetService.getGaranties(projectId),
    enabled: enabled && !!projectId,
  });

  const sinistresQuery = useQuery({
    queryKey: ['sinistres', projectId],
    queryFn: () => carnetService.getSinistres(projectId),
    enabled: enabled && !!projectId,
  });

  const documentsQuery = useQuery({
    queryKey: ['documents-carnet', projectId],
    queryFn: () => carnetService.getDocuments(projectId),
    enabled: enabled && !!projectId,
  });

  const statsQuery = useQuery({
    queryKey: ['phase5-stats', projectId],
    queryFn: () => carnetService.getStats(projectId),
    enabled: enabled && !!projectId,
  });

  // ==========================================================================
  // MUTATIONS
  // ==========================================================================

  const addTravauxMutation = useMutation({
    mutationFn: (travaux: Omit<TravauxHistorique, 'id'>) =>
      carnetService.addTravaux(projectId, travaux),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travaux-historique', projectId] });
      toast({ title: 'Travaux ajoutés', description: 'L\'historique a été mis à jour.' });
    },
  });

  const addDiagnosticMutation = useMutation({
    mutationFn: (diagnostic: Omit<DiagnosticCarnet, 'id' | 'statut'>) =>
      carnetService.addDiagnostic(projectId, diagnostic),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diagnostics-carnet', projectId] });
      toast({ title: 'Diagnostic ajouté', description: 'Le diagnostic a été enregistré.' });
    },
  });

  const addEntretienMutation = useMutation({
    mutationFn: (entretien: Omit<EntretienProgramme, 'id' | 'statut'>) =>
      carnetService.addEntretien(projectId, entretien),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entretiens', projectId] });
      toast({ title: 'Entretien planifié', description: 'L\'entretien a été ajouté au planning.' });
    },
  });

  const marquerEntretienRealiseMutation = useMutation({
    mutationFn: (entretienId: string) =>
      carnetService.marquerEntretienRealise(entretienId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entretiens', projectId] });
      toast({ title: 'Entretien réalisé', description: 'L\'entretien a été marqué comme effectué.' });
    },
  });

  const updateEntretienMutation = useMutation({
    mutationFn: ({ entretienId, data }: { entretienId: string; data: Partial<EntretienProgramme> }) =>
      carnetService.updateEntretien(entretienId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entretiens', projectId] });
      toast({ title: 'Entretien mis à jour', description: 'Les informations ont été enregistrées.' });
    },
  });

  const declarerSinistreMutation = useMutation({
    mutationFn: (sinistre: Omit<Sinistre, 'id'>) =>
      carnetService.declarerSinistre(projectId, sinistre),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sinistres', projectId] });
      toast({ title: 'Sinistre déclaré', description: 'Le sinistre a été enregistré.' });
    },
  });

  const addDocumentMutation = useMutation({
    mutationFn: (document: Omit<DocumentCarnet, 'id' | 'date_ajout'>) =>
      carnetService.addDocument(projectId, document),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents-carnet', projectId] });
      toast({ title: 'Document ajouté', description: 'Le document a été enregistré.' });
    },
  });

  // ==========================================================================
  // COMPUTED
  // ==========================================================================

  const stats: Phase5Stats = statsQuery.data || {
    garantiesActives: 0,
    diagnosticsARenouveler: 0,
    entretiensEnRetard: 0,
    sinistresEnCours: 0,
  };

  const isLoading = carnetQuery.isLoading ||
    travauxQuery.isLoading ||
    diagnosticsQuery.isLoading ||
    entretiensQuery.isLoading;

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    // Data
    carnet: carnetQuery.data,
    travaux: travauxQuery.data || [],
    diagnostics: diagnosticsQuery.data || [],
    entretiens: entretiensQuery.data || [],
    garanties: garantiesQuery.data || [],
    sinistres: sinistresQuery.data || [],
    documents: documentsQuery.data || [],
    stats,
    isLoading,

    // Actions
    addTravaux: addTravauxMutation.mutate,
    addDiagnostic: addDiagnosticMutation.mutate,
    addEntretien: addEntretienMutation.mutate,
    updateEntretien: updateEntretienMutation.mutate,
    marquerEntretienRealise: marquerEntretienRealiseMutation.mutate,
    declarerSinistre: declarerSinistreMutation.mutate,
    addSinistre: declarerSinistreMutation.mutate, // Alias for compatibility
    addDocument: addDocumentMutation.mutate,

    // Refresh
    refetch: () => {
      carnetQuery.refetch();
      travauxQuery.refetch();
      diagnosticsQuery.refetch();
      entretiensQuery.refetch();
      garantiesQuery.refetch();
      sinistresQuery.refetch();
      documentsQuery.refetch();
      statsQuery.refetch();
    },
  };
}

export default useCarnet;

/**
 * TORP Phase 2 - Hook useChantier
 * Gestion de l'état du chantier et des ordres de service
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChantierService } from '@/services/phase2/chantier.service';
import type { Chantier, OrdreService, ChantierAlerte, TypeOrdreService, StatutOrdreService } from '@/types/phase2';

interface CreateOSInput {
  type: TypeOrdreService;
  objet: string;
  dateEffet: string;
  details?: string;
  destinataires?: Array<{ entrepriseId: string; entrepriseNom: string }>;
}

interface UseChantierReturn {
  // Data
  chantier: Chantier | null;
  ordresService: OrdreService[];
  alertes: ChantierAlerte[];

  // Computed
  hasActiveOS: boolean;
  lastOS: OrdreService | null;
  pendingAlertes: ChantierAlerte[];
  criticalAlertes: ChantierAlerte[];

  // Loading states
  isLoading: boolean;
  isCreatingOS: boolean;
  isUpdatingChantier: boolean;

  // Error
  error: Error | null;

  // Actions - Chantier
  updateChantier: (updates: Partial<Chantier>) => void;
  updateStatut: (statut: Chantier['statut']) => void;
  updateAvancement: (avancement: number) => void;

  // Actions - Ordres de Service
  createOrdreService: (os: CreateOSInput) => void;
  updateOrdreService: (osId: string, updates: Partial<OrdreService>) => void;
  validerOrdreService: (osId: string) => void;
  annulerOrdreService: (osId: string) => void;

  // Actions - OS types spécifiques
  createOSDemarrage: (dateEffet: string, destinataires?: CreateOSInput['destinataires']) => void;
  createOSSuspension: (dateEffet: string, motif: string) => void;
  createOSReprise: (dateEffet: string) => void;

  // Actions - Alertes
  dismissAlerte: (alerteId: string) => void;
  resolveAlerte: (alerteId: string) => void;

  // Refresh
  refresh: () => void;
}

export function useChantier(chantierId: string): UseChantierReturn {
  const queryClient = useQueryClient();

  // ============================================
  // QUERIES
  // ============================================

  const chantierQuery = useQuery({
    queryKey: ['chantier', chantierId],
    queryFn: () => ChantierService.getChantier(chantierId),
    enabled: !!chantierId,
  });

  const ordresServiceQuery = useQuery({
    queryKey: ['ordres-service', chantierId],
    queryFn: () => ChantierService.getOrdresService(chantierId),
    enabled: !!chantierId,
  });

  const alertesQuery = useQuery({
    queryKey: ['alertes-chantier', chantierId],
    queryFn: () => ChantierService.getAlertes(chantierId),
    enabled: !!chantierId,
  });

  // ============================================
  // COMPUTED VALUES
  // ============================================

  const chantier = chantierQuery.data || null;
  const ordresService = ordresServiceQuery.data || [];
  const alertes = alertesQuery.data || [];

  const hasActiveOS = ordresService.some(os =>
    os.statut === 'valide' && os.type === 'demarrage'
  );

  const lastOS = ordresService.length > 0
    ? ordresService.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0]
    : null;

  const pendingAlertes = alertes.filter(a => a.niveau === 'warning');
  const criticalAlertes = alertes.filter(a => a.niveau === 'error');

  // ============================================
  // MUTATIONS - CHANTIER
  // ============================================

  const updateChantierMutation = useMutation({
    mutationFn: (updates: Partial<Chantier>) =>
      ChantierService.updateChantier(chantierId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chantier', chantierId] });
    },
  });

  // ============================================
  // MUTATIONS - ORDRES DE SERVICE
  // ============================================

  const createOSMutation = useMutation({
    mutationFn: (os: CreateOSInput) =>
      ChantierService.createOrdreService({
        chantierId,
        ...os,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordres-service', chantierId] });
      queryClient.invalidateQueries({ queryKey: ['chantier', chantierId] });
    },
  });

  const updateOSMutation = useMutation({
    mutationFn: ({ osId, updates }: { osId: string; updates: Partial<OrdreService> }) =>
      ChantierService.updateOrdreService(osId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordres-service', chantierId] });
    },
  });

  const validerOSMutation = useMutation({
    mutationFn: (osId: string) =>
      ChantierService.validerOrdreService(osId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordres-service', chantierId] });
      queryClient.invalidateQueries({ queryKey: ['chantier', chantierId] });
    },
  });

  const annulerOSMutation = useMutation({
    mutationFn: (osId: string) =>
      ChantierService.annulerOrdreService(osId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordres-service', chantierId] });
    },
  });

  // ============================================
  // ACTIONS - CHANTIER
  // ============================================

  const updateChantier = (updates: Partial<Chantier>) => {
    updateChantierMutation.mutate(updates);
  };

  const updateStatut = (statut: Chantier['statut']) => {
    updateChantierMutation.mutate({ statut });
  };

  const updateAvancement = (avancement: number) => {
    updateChantierMutation.mutate({ avancementGlobal: avancement });
  };

  // ============================================
  // ACTIONS - ORDRES DE SERVICE
  // ============================================

  const createOrdreService = (os: CreateOSInput) => {
    createOSMutation.mutate(os);
  };

  const updateOrdreService = (osId: string, updates: Partial<OrdreService>) => {
    updateOSMutation.mutate({ osId, updates });
  };

  const validerOrdreService = (osId: string) => {
    validerOSMutation.mutate(osId);
  };

  const annulerOrdreService = (osId: string) => {
    annulerOSMutation.mutate(osId);
  };

  // ============================================
  // ACTIONS - OS SPÉCIFIQUES
  // ============================================

  const createOSDemarrage = (dateEffet: string, destinataires?: CreateOSInput['destinataires']) => {
    createOSMutation.mutate({
      type: 'demarrage',
      objet: 'Ordre de service de démarrage des travaux',
      dateEffet,
      destinataires,
    });
  };

  const createOSSuspension = (dateEffet: string, motif: string) => {
    createOSMutation.mutate({
      type: 'suspension',
      objet: 'Ordre de service de suspension des travaux',
      dateEffet,
      details: motif,
    });
  };

  const createOSReprise = (dateEffet: string) => {
    createOSMutation.mutate({
      type: 'reprise',
      objet: 'Ordre de service de reprise des travaux',
      dateEffet,
    });
  };

  // ============================================
  // ACTIONS - ALERTES
  // ============================================

  const dismissAlerte = (alerteId: string) => {
    // Les alertes sont générées dynamiquement, pas de persistance nécessaire
    queryClient.setQueryData(['alertes-chantier', chantierId], (old: ChantierAlerte[] | undefined) =>
      old?.filter(a => a.id !== alerteId) || []
    );
  };

  const resolveAlerte = (alerteId: string) => {
    // Marquer l'alerte comme résolue (si persistée)
    dismissAlerte(alerteId);
  };

  // ============================================
  // REFRESH
  // ============================================

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['chantier', chantierId] });
    queryClient.invalidateQueries({ queryKey: ['ordres-service', chantierId] });
    queryClient.invalidateQueries({ queryKey: ['alertes-chantier', chantierId] });
  };

  // ============================================
  // RETURN
  // ============================================

  return {
    // Data
    chantier,
    ordresService,
    alertes,

    // Computed
    hasActiveOS,
    lastOS,
    pendingAlertes,
    criticalAlertes,

    // Loading states
    isLoading: chantierQuery.isLoading,
    isCreatingOS: createOSMutation.isPending,
    isUpdatingChantier: updateChantierMutation.isPending,

    // Error
    error: chantierQuery.error || ordresServiceQuery.error || null,

    // Actions - Chantier
    updateChantier,
    updateStatut,
    updateAvancement,

    // Actions - Ordres de Service
    createOrdreService,
    updateOrdreService,
    validerOrdreService,
    annulerOrdreService,

    // Actions - OS spécifiques
    createOSDemarrage,
    createOSSuspension,
    createOSReprise,

    // Actions - Alertes
    dismissAlerte,
    resolveAlerte,

    // Refresh
    refresh,
  };
}

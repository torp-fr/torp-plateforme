/**
 * useProgressReport - Hook React pour les rapports d'avancement Phase 3
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { siteMonitoringAgent } from '@/ai/agents/phase3';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface UseProgressReportOptions {
  projetId: string;
  enabled?: boolean;
}

export function useProgressReport({ projetId, enabled = true }: UseProgressReportOptions) {
  const queryClient = useQueryClient();

  // Query keys
  const keys = {
    all: ['progress-report', projetId] as const,
    latest: ['progress-report', projetId, 'latest'] as const,
    history: ['progress-report', projetId, 'history'] as const,
    alerts: ['progress-report', projetId, 'alerts'] as const,
  };

  // Dernier rapport
  const latestReportQuery = useQuery({
    queryKey: keys.latest,
    queryFn: async () => {
      const { data } = await supabase
        .from('progress_reports')
        .select('*')
        .eq('projet_id', projetId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      return data;
    },
    enabled: enabled && !!projetId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Historique des rapports
  const historyQuery = useQuery({
    queryKey: keys.history,
    queryFn: async () => {
      const { data } = await supabase
        .from('progress_reports')
        .select('*')
        .eq('projet_id', projetId)
        .order('created_at', { ascending: false })
        .limit(12); // 3 derniers mois
      return data || [];
    },
    enabled: enabled && !!projetId,
    staleTime: 15 * 60 * 1000,
  });

  // Alertes actives
  const alertsQuery = useQuery({
    queryKey: keys.alerts,
    queryFn: async () => {
      const report = latestReportQuery.data;
      if (!report) return [];
      return report.contenu?.alertes || [];
    },
    enabled: enabled && !!projetId && !!latestReportQuery.data,
    staleTime: 5 * 60 * 1000,
  });

  // Mutation: Générer un nouveau rapport
  const generateReport = useMutation({
    mutationFn: async () => {
      toast.info('Génération du rapport en cours...', { duration: 5000 });
      return siteMonitoringAgent.analyzeWeeklyProgress(projetId);
    },
    onSuccess: (report) => {
      toast.success(`Rapport généré: ${report.alertes.length} alerte(s) détectée(s)`);
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de la génération: ${error.message}`);
    },
  });

  // Mutation: Générer un plan de rattrapage pour un lot
  const generateCatchUpPlan = useMutation({
    mutationFn: (lotId: string) => siteMonitoringAgent.generateCatchUpPlan(projetId, lotId),
    onSuccess: () => {
      toast.success('Plan de rattrapage généré');
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de la génération: ${error.message}`);
    },
  });

  // Calculer les tendances d'avancement
  const calculateTrends = () => {
    const history = historyQuery.data || [];
    if (history.length < 2) return null;

    const lastTwo = history.slice(0, 2);
    const current = lastTwo[0]?.avancement_global || 0;
    const previous = lastTwo[1]?.avancement_global || 0;
    const progression = current - previous;

    // Calcul de la vélocité moyenne
    const velocities = history.slice(0, 4).map((r, i, arr) => {
      if (i === arr.length - 1) return 0;
      return (r.avancement_global || 0) - (arr[i + 1]?.avancement_global || 0);
    });
    const avgVelocity = velocities.reduce((a, b) => a + b, 0) / Math.max(velocities.length - 1, 1);

    return {
      currentProgress: current,
      weeklyProgression: progression,
      averageVelocity: avgVelocity,
      trend: progression > avgVelocity ? 'acceleration' : progression < 0 ? 'regression' : 'stable',
    };
  };

  return {
    // Queries
    latestReport: latestReportQuery.data,
    history: historyQuery.data || [],
    alerts: alertsQuery.data || [],
    trends: calculateTrends(),
    isLoading: latestReportQuery.isLoading,
    isLoadingHistory: historyQuery.isLoading,
    error: latestReportQuery.error,

    // Mutations
    generateReport: generateReport.mutate,
    generateCatchUpPlan: generateCatchUpPlan.mutate,

    // Mutation states
    isGenerating: generateReport.isPending,
    isGeneratingPlan: generateCatchUpPlan.isPending,

    // Computed values
    hasActiveAlerts: (alertsQuery.data || []).some(
      (a: any) => a.severite === 'critical' || a.severite === 'warning'
    ),
    criticalAlertsCount: (alertsQuery.data || []).filter((a: any) => a.severite === 'critical')
      .length,

    // Refetch
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
  };
}

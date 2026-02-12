/**
 * Analytics Dashboard Page
 * Complete audit trail visualization for quote analysis
 */

import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import { Home, Download, RefreshCw } from 'lucide-react';

import { auditService } from '@/services/audit';
import {
  AnalyticsOverviewCards,
  AnalysisHistoryTable,
  ExecutionContextPanel,
  CriteriaBreakdownTable,
  ApiCallsTimeline,
} from '@/components/analytics';

import type {
  ExecutionTrace,
  AnalysisRecord,
  ExecutionContext,
  CriteriaScore,
  ApiCall,
} from '@/types/audit';

export function AnalyticsDashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  // State
  const ccfId = searchParams.get('ccfId');
  const executionId = searchParams.get('executionId');

  const [analysisHistory, setAnalysisHistory] = useState<AnalysisRecord[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisRecord | null>(null);
  const [executionTrace, setExecutionTrace] = useState<ExecutionTrace | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingTrace, setIsLoadingTrace] = useState(false);

  // Load analysis history
  useEffect(() => {
    if (!ccfId) {
      toast({
        title: 'Erreur',
        description: 'CCF ID requis',
        variant: 'destructive',
      });
      navigate('/');
      return;
    }

    const loadHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const history = await auditService.getAnalysisHistory(ccfId, {
          limit: 50,
        });

        setAnalysisHistory(history);

        // If executionId provided, select it
        if (executionId) {
          const selected = history.find(a => a.executionId === executionId);
          if (selected) {
            setSelectedAnalysis(selected);
          }
        } else if (history.length > 0) {
          // Default to latest
          setSelectedAnalysis(history[0]);
        }
      } catch (error) {
        console.error('Failed to load analysis history:', error);
        toast({
          title: 'Erreur',
          description: 'Impossible de charger l\'historique',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadHistory();
  }, [ccfId, executionId, navigate, toast]);

  // Load execution trace when analysis selected
  useEffect(() => {
    if (!selectedAnalysis?.executionId) {
      setExecutionTrace(null);
      return;
    }

    const loadTrace = async () => {
      setIsLoadingTrace(true);
      try {
        const trace = await auditService.getExecutionTrace(selectedAnalysis.executionId);
        setExecutionTrace(trace);
      } catch (error) {
        console.error('Failed to load execution trace:', error);
        toast({
          title: 'Erreur',
          description: 'Impossible de charger la trace d\'exécution',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingTrace(false);
      }
    };

    loadTrace();
  }, [selectedAnalysis?.executionId, toast]);

  // Process data for display
  const stats = {
    totalAnalyses: analysisHistory.length,
    averageScore: analysisHistory.length
      ? Math.round(
          analysisHistory.reduce((sum, a) => sum + a.totalScore, 0) / analysisHistory.length
        )
      : 0,
    latestGrade: analysisHistory.length ? analysisHistory[0].finalGrade : 'N/A',
    apiCallsCount: executionTrace?.externalApiCalls?.length || 0,
    lastAnalysisDate: analysisHistory[0]?.analysisDate,
    averageResponseTime: executionTrace?.externalApiCalls
      ? Math.round(
          executionTrace.externalApiCalls.reduce((sum, c) => sum + (c.responseTimeMs || 0), 0) /
            executionTrace.externalApiCalls.length
        )
      : undefined,
  };

  const criteriaData: CriteriaScore[] =
    executionTrace?.criteriaEvaluations?.map(c => ({
      axis: c.criterionAxis || 'OTHER',
      criterionName: c.criterionName,
      score: c.score,
      maxScore: c.maxScore,
      percentage: c.percentage,
      grade: c.grade,
      justification: c.justification,
    })) || [];

  const apiCallsData: ApiCall[] =
    executionTrace?.externalApiCalls?.map(c => ({
      service: c.externalService,
      endpoint: c.endpoint,
      calledAt: c.calledAt,
      responseTimeMs: c.responseTimeMs,
      statusCode: c.responseStatus,
      errorOccurred: c.errorOccurred,
      errorMessage: c.errorMessage,
    })) || [];

  // Export functions
  const exportAsJSON = async () => {
    if (!executionTrace) return;

    const json = JSON.stringify(executionTrace, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trace-${selectedAnalysis?.executionId}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Exporté',
      description: 'Trace d\'audit téléchargée',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 w-full backdrop-blur-md bg-background/80 z-50 border-b border-border shadow-sm">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-foreground">
            Tableau de bord Analytics
          </h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/')}
            >
              <Home className="h-4 w-4 mr-2" />
              Accueil
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="py-8 px-6">
        <div className="container mx-auto max-w-7xl space-y-8">
          {/* Overview Cards */}
          {isLoadingHistory ? (
            <div className="flex justify-center py-8">
              <Spinner className="h-8 w-8" />
            </div>
          ) : (
            <>
              <AnalyticsOverviewCards {...stats} />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: History */}
                <div className="lg:col-span-1">
                  <AnalysisHistoryTable
                    analyses={analysisHistory}
                    onSelectAnalysis={setSelectedAnalysis}
                    isLoading={isLoadingHistory}
                  />
                </div>

                {/* Right Column: Details */}
                <div className="lg:col-span-2 space-y-8">
                  {isLoadingTrace ? (
                    <div className="flex justify-center py-8">
                      <Spinner className="h-8 w-8" />
                    </div>
                  ) : selectedAnalysis && executionTrace ? (
                    <>
                      {/* Export Button */}
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={exportAsJSON}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Exporter JSON
                        </Button>
                      </div>

                      {/* Execution Context */}
                      {executionTrace.executionContext && (
                        <ExecutionContextPanel context={executionTrace.executionContext} />
                      )}

                      {/* Criteria Breakdown */}
                      {criteriaData.length > 0 && (
                        <CriteriaBreakdownTable criteria={criteriaData} byAxis={true} />
                      )}

                      {/* API Calls Timeline */}
                      {apiCallsData.length > 0 && (
                        <ApiCallsTimeline
                          calls={apiCallsData}
                          totalDurationMs={executionTrace.executionContext?.totalDurationMs}
                        />
                      )}
                    </>
                  ) : (
                    <Card className="bg-card border-border p-8 text-center">
                      <p className="text-muted-foreground">
                        Sélectionnez une analyse pour afficher les détails
                      </p>
                    </Card>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default AnalyticsDashboard;

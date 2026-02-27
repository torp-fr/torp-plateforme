/**
 * Quote Analysis Page - Résultats de l'analyse avec RAG
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScoreGauge } from '@/components/ScoreGauge';
import { Home, Download, AlertCircle, CheckCircle2, TrendingUp, Zap } from 'lucide-react';
import type { CCFData } from '@/components/guided-ccf/GuidedCCF';
import type { EnrichedClientData } from '@/types/enrichment';
import { log, warn } from '@/lib/logger';

interface AnalysisResult {
  score: number;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  conformity: number;
  alerts: Array<{ type: string; message: string; severity?: number }>;
  recommendations: Array<{ title: string; description: string; priority?: string }>;
  filename?: string;
  projectName?: string;
}

export function QuoteAnalysisPage() {
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAnalysis = async () => {
      try {
        // Récupérer données uploadées et CCF
        const uploadedQuote = localStorage.getItem('uploadedQuote');
        const ccfJson = localStorage.getItem('currentCCF');
        const enrichedJson = localStorage.getItem('enrichedClientData');

        if (!uploadedQuote || !ccfJson) {
          navigate('/quote-upload');
          return;
        }

        const quoteData = JSON.parse(uploadedQuote);
        const ccfData = JSON.parse(ccfJson) as CCFData;
        const enrichedData = enrichedJson ? JSON.parse(enrichedJson) as EnrichedClientData : null;

        let analysisResult: AnalysisResult = {
          score: 75,
          status: 'good',
          conformity: 80,
          filename: quoteData.filename,
          projectName: ccfData.projectName || 'Projet sans nom',
          alerts: [
            {
              type: 'info',
              message: `Timeline: ${ccfData.timeline || 'non spécifiée'}`,
            },
          ],
          recommendations: [
            {
              title: 'Vérifier les détails des finitions',
              description: 'Assurez-vous que toutes les finitions sont incluses dans le devis',
              priority: 'medium',
            },
          ],
        };

        // NOTE: Enhanced RAG analysis now goes through Edge Functions (rag-query)
        // For MVP, using basic analysis from form data
        // TODO: Integrate with supabase.functions.invoke('rag-query', {...}) for full analysis
        if (enrichedData && ccfData) {
          log('📊 Analysis page loaded with enriched data and CCF');
        }

        setAnalysis(analysisResult);
      } catch (error) {
        console.error('❌ Error loading analysis:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalysis();
  }, [navigate]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'bg-green-100 text-green-800';
      case 'good':
        return 'bg-blue-100 text-blue-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-muted text-foreground';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical':
        return '🔴';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '📌';
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-50 border-red-200';
      case 'medium':
        return 'bg-yellow-50 border-yellow-200';
      case 'low':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Zap className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-muted-foreground">Analyse en cours...</p>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 w-full backdrop-blur-md bg-background/80 z-50 border-b border-border shadow-sm">
        <div className="container mx-auto px-6 h-16 flex items-center">
          <h1 className="font-display text-2xl font-bold text-foreground">Résultats de l'analyse</h1>
        </div>
      </header>

      {/* Content */}
      <main className="py-12 px-6">
        <div className="container mx-auto max-w-3xl space-y-8">
          {/* Project Info Card */}
          <Card className="bg-card border-border shadow-md">
            <CardHeader>
              <CardTitle className="font-display text-foreground">Analyse du devis</CardTitle>
              <CardDescription className="text-muted-foreground">
                {analysis.filename} • {analysis.projectName}
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Score Card */}
          <Card className="bg-gradient-to-br from-background to-card border-border shadow-md">
            <CardContent className="pt-8">
              <div className="flex items-center justify-between gap-8">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground font-medium mb-4">Score de conformité</p>
                  <div className="flex items-baseline gap-3 mb-4">
                    <span className="text-muted-foreground text-sm">/100</span>
                  </div>
                  <Badge className={`${getStatusColor(analysis.status)} border-0`}>
                    {analysis.status.toUpperCase()}
                  </Badge>
                </div>
                <ScoreGauge score={analysis.score} maxScore={100} size="lg" grade={analysis.status.charAt(0).toUpperCase()} />
              </div>
            </CardContent>
          </Card>

          {/* Conformity Details */}
          <Card className="bg-card border-border shadow-md">
            <CardHeader>
              <CardTitle className="text-foreground">Analyse détaillée</CardTitle>
              <CardDescription>Conformité par rapport à votre CCF</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-foreground font-medium">Conformité globale</span>
                  <span className="font-bold text-foreground">{analysis.conformity}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-3">
                  <div
                    className="gradient-primary h-3 rounded-full transition-all"
                    style={{ width: `${analysis.conformity}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Alerts */}
          {analysis.alerts.length > 0 && (
            <Card className="bg-card border-border shadow-md">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Alertes et contexte
                </CardTitle>
                <CardDescription>{analysis.alerts.length} élément(s) identifié(s)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {analysis.alerts.map((alert, idx) => {
                  const alertColorMap: Record<string, string> = {
                    critical: 'bg-red-50 border-red-200 text-red-900',
                    warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
                    info: 'bg-blue-50 border-blue-200 text-blue-900',
                  };
                  const colorClass = alertColorMap[alert.type] || 'bg-slate-50 border-slate-200 text-slate-900';

                  return (
                    <div key={idx} className={`flex gap-3 p-4 rounded-lg border ${colorClass}`}>
                      <span className="text-xl flex-shrink-0">{getAlertIcon(alert.type)}</span>
                      <div className="flex-1">
                        <p className="font-medium">{alert.message}</p>
                        {alert.severity && (
                          <p className="text-xs opacity-70 mt-1">Sévérité: {alert.severity}/5</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {analysis.recommendations.length > 0 && (
            <Card className="bg-card border-border shadow-md">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Recommandations
                </CardTitle>
                <CardDescription>{analysis.recommendations.length} recommandation(s)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {analysis.recommendations.map((rec, idx) => (
                  <div key={idx} className={`p-4 rounded-lg border ${getPriorityColor(rec.priority)}`}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h4 className="font-semibold text-foreground">{rec.title}</h4>
                      {rec.priority && (
                        <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'secondary' : 'outline'}>
                          {rec.priority.toUpperCase()}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{rec.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              onClick={() => {
                const report = `Rapport d'analyse - Score: ${analysis.score}/100`;
                const blob = new Blob([report], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `rapport_${new Date().toISOString().split('T')[0]}.txt`;
                link.click();
              }}
              className="flex-1 text-lg px-8 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
            >
              <Download className="h-5 w-5 mr-2" />
              Télécharger le rapport
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/')}
              className="flex-1 text-lg px-8"
            >
              <Home className="h-5 w-5 mr-2" />
              Retour à l'accueil
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default QuoteAnalysisPage;

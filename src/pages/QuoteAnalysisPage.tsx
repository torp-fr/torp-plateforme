/**
 * Quote Analysis Page - Résultats de l'analyse
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Home, Download, AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react';

interface AnalysisResult {
  score: number;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  conformity: number;
  alerts: Array<{ type: string; message: string }>;
  recommendations: string[];
}

export function QuoteAnalysisPage() {
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    // Simulate analysis
    const uploadedQuote = localStorage.getItem('uploadedQuote');
    if (!uploadedQuote) {
      navigate('/quote-upload');
      return;
    }

    // Mock analysis result
    const mockAnalysis: AnalysisResult = {
      score: 78,
      status: 'good',
      conformity: 85,
      alerts: [
        {
          type: 'warning',
          message: 'Budget dépassé de 12% par rapport au CCF',
        },
        {
          type: 'info',
          message: 'Timeline conforme aux attentes',
        },
      ],
      recommendations: [
        'Vérifier les détails des finitions incluses',
        'Négocier les coûts de main d\'œuvre',
        'Ajouter clause de révision de prix',
      ],
    };

    setAnalysis(mockAnalysis);
  }, [navigate]);

  if (!analysis) {
    return null;
  }

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
        return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-cyan-50">
      {/* Header */}
      <header className="sticky top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-blue-100/30 shadow-sm">
        <div className="container mx-auto px-6 h-16 flex items-center">
          <h1 className="text-2xl font-bold text-slate-900">Résultats de l'analyse</h1>
        </div>
      </header>

      {/* Content */}
      <main className="py-12 px-6">
        <div className="container mx-auto max-w-3xl space-y-8">
          {/* Score Card */}
          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200 shadow-md">
            <CardContent className="pt-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 font-medium mb-2">Score de conformité</p>
                  <div className="flex items-baseline gap-3">
                    <span className="text-6xl font-bold text-blue-600">{analysis.score}</span>
                    <span className="text-slate-600">/100</span>
                  </div>
                  <Badge className={`mt-4 ${getStatusColor(analysis.status)} border-0`}>
                    {analysis.status.toUpperCase()}
                  </Badge>
                </div>
                <TrendingUp className="h-24 w-24 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          {/* Conformity Details */}
          <Card className="bg-white shadow-md">
            <CardHeader>
              <CardTitle className="text-slate-900">Analyse détaillée</CardTitle>
              <CardDescription>Conformité par rapport à votre CCF</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-700 font-medium">Conformité globale</span>
                  <span className="font-bold text-slate-900">{analysis.conformity}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-cyan-500 h-3 rounded-full transition-all"
                    style={{ width: `${analysis.conformity}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Alerts */}
          {analysis.alerts.length > 0 && (
            <Card className="bg-white shadow-md">
              <CardHeader>
                <CardTitle className="text-slate-900 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  Alertes et informations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analysis.alerts.map((alert, idx) => (
                  <div key={idx} className="flex gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-900">{alert.message}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {analysis.recommendations.length > 0 && (
            <Card className="bg-white shadow-md">
              <CardHeader>
                <CardTitle className="text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Recommandations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analysis.recommendations.map((rec, idx) => (
                  <div key={idx} className="flex gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-green-900">{rec}</p>
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

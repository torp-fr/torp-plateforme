/**
 * TORP B2B - Page publique d'affichage d'un ticket TORP
 *
 * Accessible sans authentification via le lien public /t/:code
 * Affiche le badge TORP avec le score et le grade de l'entreprise
 *
 * @route /t/:code
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getAnalysisByTicketCode, trackTicketView } from '@/services/api/pro/analysisService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Shield,
  CheckCircle2,
  Award,
  Building2,
  Calendar,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import type { ProDevisAnalysis } from '@/types/pro';

export default function TicketPublicView() {
  const { code } = useParams<{ code: string }>();
  const [analysis, setAnalysis] = useState<ProDevisAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (code) {
      loadTicket();
    }
  }, [code]);

  const loadTicket = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getAnalysisByTicketCode(code!);

      if (!data) {
        setError('Ce ticket TORP n\'existe pas ou n\'est plus valide');
        return;
      }

      setAnalysis(data);

      // Tracker la vue du ticket
      await trackTicketView(code!, 'link_viewed');
    } catch (err: any) {
      console.error('Erreur chargement ticket:', err);
      setError('Erreur lors du chargement du ticket');
    } finally {
      setLoading(false);
    }
  };

  const getGradeColor = (grade?: string): string => {
    if (!grade) return 'bg-gray-500';

    const colors: Record<string, string> = {
      'A+': 'bg-gradient-to-br from-green-600 to-green-700',
      'A': 'bg-gradient-to-br from-green-500 to-green-600',
      'A-': 'bg-gradient-to-br from-green-400 to-green-500',
      'B+': 'bg-gradient-to-br from-blue-500 to-blue-600',
      'B': 'bg-gradient-to-br from-blue-400 to-blue-500',
      'B-': 'bg-gradient-to-br from-blue-300 to-blue-400',
      'C+': 'bg-gradient-to-br from-yellow-500 to-yellow-600',
      'C': 'bg-gradient-to-br from-yellow-400 to-yellow-500',
      'C-': 'bg-gradient-to-br from-yellow-300 to-yellow-400',
      'D': 'bg-gradient-to-br from-orange-500 to-orange-600',
      'F': 'bg-gradient-to-br from-red-600 to-red-700',
    };

    return colors[grade] || 'bg-gray-500';
  };

  const getScoreLabel = (score?: number): string => {
    if (!score) return 'Non évalué';
    if (score >= 900) return 'Excellent';
    if (score >= 800) return 'Très bon';
    if (score >= 700) return 'Bon';
    if (score >= 600) return 'Satisfaisant';
    if (score >= 500) return 'Moyen';
    return 'À améliorer';
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <Skeleton className="h-10 w-64 mx-auto mb-4" />
            <Skeleton className="h-4 w-48 mx-auto" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error || !analysis) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl">Ticket introuvable</CardTitle>
            <CardDescription>
              {error || 'Ce ticket TORP n\'existe pas ou n\'est plus valide'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Success state - Display ticket
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border">
            <Shield className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-gray-700">Badge TORP Certifié</span>
          </div>
          <p className="text-sm text-gray-500">Code : {analysis.ticket_code}</p>
        </div>

        {/* Main ticket card */}
        <Card className="shadow-xl border-2">
          <CardHeader className="text-center pb-8 bg-gradient-to-br from-gray-50 to-white">
            {/* Grade badge */}
            <div className="flex justify-center mb-6">
              <div className={`w-32 h-32 rounded-2xl ${getGradeColor(analysis.grade)} shadow-lg flex items-center justify-center transform hover:scale-105 transition-transform`}>
                <span className="text-5xl font-bold text-white">{analysis.grade || 'N/A'}</span>
              </div>
            </div>

            <CardTitle className="text-3xl font-bold mb-2">
              Score TORP : {analysis.score_total || 0}/1000
            </CardTitle>
            <CardDescription className="text-lg">
              {getScoreLabel(analysis.score_total)}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            {/* Reference devis */}
            <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
              <Building2 className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-gray-900">Référence du devis</div>
                <div className="text-sm text-gray-600">{analysis.reference_devis}</div>
                {analysis.nom_projet && (
                  <div className="text-sm text-gray-500 mt-1">Projet : {analysis.nom_projet}</div>
                )}
              </div>
            </div>

            {/* Date */}
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <Calendar className="w-4 h-4" />
              <span>
                Badge généré le {analysis.ticket_generated_at ? new Date(analysis.ticket_generated_at).toLocaleDateString('fr-FR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }) : 'N/A'}
              </span>
            </div>

            {/* Detailed scores */}
            {analysis.score_details && (
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <TrendingUp className="w-4 h-4" />
                  <span>Détail des scores TORP</span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {/* Transparence */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-700">Transparence</span>
                      <span className="font-semibold text-gray-900">{analysis.score_details.transparence}/250</span>
                    </div>
                    <Progress value={(analysis.score_details.transparence / 250) * 100} className="h-2" />
                  </div>

                  {/* Offre */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-700">Offre</span>
                      <span className="font-semibold text-gray-900">{analysis.score_details.offre}/250</span>
                    </div>
                    <Progress value={(analysis.score_details.offre / 250) * 100} className="h-2" />
                  </div>

                  {/* Robustesse */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-700">Robustesse</span>
                      <span className="font-semibold text-gray-900">{analysis.score_details.robustesse}/250</span>
                    </div>
                    <Progress value={(analysis.score_details.robustesse / 250) * 100} className="h-2" />
                  </div>

                  {/* Prix */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-700">Prix</span>
                      <span className="font-semibold text-gray-900">{analysis.score_details.prix}/250</span>
                    </div>
                    <Progress value={(analysis.score_details.prix / 250) * 100} className="h-2" />
                  </div>
                </div>
              </div>
            )}

            {/* Certificate badge */}
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <AlertTitle className="text-green-900">Badge certifié</AlertTitle>
              <AlertDescription className="text-green-700">
                Ce devis a été analysé et évalué selon la méthodologie TORP (Transparence, Offre, Robustesse, Prix).
              </AlertDescription>
            </Alert>

            {/* Footer info */}
            <div className="text-center text-xs text-gray-500 pt-4 border-t">
              <p>Vues : {analysis.ticket_view_count || 0}</p>
              {analysis.ticket_last_viewed_at && (
                <p>Dernière consultation : {new Date(analysis.ticket_last_viewed_at).toLocaleDateString('fr-FR')}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Powered by TORP */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-sm text-gray-500">
            <Award className="w-4 h-4" />
            <span>Propulsé par TORP - Évaluation de devis</span>
          </div>
        </div>
      </div>
    </div>
  );
}

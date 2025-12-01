/**
 * TORP B2B - Détail d'une Analyse de Devis
 *
 * Affiche les résultats complets d'une analyse :
 * - Score TORP sur 1000 points
 * - Grade (A+, A, B, C, etc.)
 * - Scores détaillés (4 axes)
 * - Recommandations d'amélioration
 * - Génération de ticket TORP
 *
 * @route /pro/analysis/:id
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { getAnalysis, generateTicket } from '@/services/api/pro/analysisService';
import { getCompanyProfile } from '@/services/api/pro/companyService';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Sparkles,
  Download,
  QrCode,
  Eye,
  Calendar,
  Euro,
  Building2,
  Lightbulb,
  Loader2,
} from 'lucide-react';
import type { ProDevisAnalysis, CompanyProfile, Recommendation } from '@/types/pro';

export default function ProAnalysisDetail() {
  const navigate = useNavigate();
  const { userType } = useApp();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ProDevisAnalysis | null>(null);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [generatingTicket, setGeneratingTicket] = useState(false);

  useEffect(() => {
    if (userType !== 'B2B') {
      navigate('/dashboard');
      return;
    }

    if (id) {
      loadAnalysis();
    }
  }, [userType, id, navigate]);

  const loadAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);

      // Charger l'analyse
      const analysisData = await getAnalysis(id!);

      if (!analysisData) {
        setError('Analyse non trouvée');
        return;
      }

      setAnalysis(analysisData);

      // Charger le profil entreprise
      const profileData = await getCompanyProfile();
      setProfile(profileData);

    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement de l\'analyse');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTicket = async () => {
    if (!analysis) return;

    try {
      setGeneratingTicket(true);

      const ticket = await generateTicket(analysis.id);

      // Recharger l'analyse pour afficher le ticket
      await loadAnalysis();

      toast({
        title: "✅ Ticket généré avec succès !",
        description: `Code : ${ticket.ticket_code}`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: err.message || 'Impossible de générer le ticket',
      });
    } finally {
      setGeneratingTicket(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Terminée
          </Badge>
        );
      case 'PROCESSING':
        return (
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1 animate-spin" />
            En cours d'analyse
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge variant="outline">
            <Clock className="w-3 h-3 mr-1" />
            En attente
          </Badge>
        );
      case 'FAILED':
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Échec
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getGradeBadge = (grade?: string) => {
    if (!grade) return null;

    const gradeColors: Record<string, string> = {
      'A+': 'bg-green-600 text-white border-green-700',
      'A': 'bg-green-500 text-white border-green-600',
      'A-': 'bg-green-400 text-white border-green-500',
      'B+': 'bg-blue-500 text-white border-blue-600',
      'B': 'bg-blue-400 text-white border-blue-500',
      'B-': 'bg-blue-300 text-white border-blue-400',
      'C+': 'bg-yellow-500 text-white border-yellow-600',
      'C': 'bg-yellow-400 text-white border-yellow-500',
      'C-': 'bg-yellow-300 text-black border-yellow-400',
      'D': 'bg-orange-500 text-white border-orange-600',
      'F': 'bg-red-600 text-white border-red-700',
    };

    return (
      <div className={`inline-flex items-center justify-center w-20 h-20 rounded-xl border-4 text-3xl font-bold ${gradeColors[grade] || 'bg-gray-500 text-white border-gray-600'}`}>
        {grade}
      </div>
    );
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive">Prioritaire</Badge>;
      case 'medium':
        return <Badge variant="default">Moyen</Badge>;
      case 'low':
        return <Badge variant="secondary">Faible</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const getDifficultyBadge = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">Facile</Badge>;
      case 'medium':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">Moyen</Badge>;
      case 'hard':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">Difficile</Badge>;
      default:
        return <Badge variant="outline">{difficulty}</Badge>;
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48" />
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !analysis) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/pro/dashboard')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour au dashboard
          </Button>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>
              {error || 'Analyse non trouvée'}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // En attente ou en cours d'analyse
  if (analysis.status === 'PENDING' || analysis.status === 'PROCESSING') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/pro/dashboard')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour au dashboard
          </Button>

          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-blue-600 animate-pulse" />
              </div>
              <CardTitle className="text-2xl">
                {analysis.status === 'PENDING' ? 'Analyse en attente' : 'Analyse en cours'}
              </CardTitle>
              <CardDescription className="text-base mt-2">
                {analysis.status === 'PENDING'
                  ? 'Votre devis est en file d\'attente et sera analysé dans quelques instants.'
                  : 'Notre IA analyse votre devis en détail. Cela prend généralement 30 secondes à 2 minutes.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progression</span>
                  <span className="font-medium">Analyse en cours...</span>
                </div>
                <Progress value={analysis.status === 'PENDING' ? 10 : 60} className="h-2" />
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="text-sm font-semibold mb-2">Informations du devis</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Référence :</span>
                    <span className="font-medium">{analysis.reference_devis}</span>
                  </div>
                  {analysis.nom_projet && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Projet :</span>
                      <span className="font-medium">{analysis.nom_projet}</span>
                    </div>
                  )}
                  {analysis.montant_ttc && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Montant TTC :</span>
                      <span className="font-medium">{analysis.montant_ttc.toLocaleString('fr-FR')} €</span>
                    </div>
                  )}
                </div>
              </div>

              <p className="text-sm text-center text-muted-foreground">
                Rafraîchissez cette page dans quelques instants pour voir les résultats
              </p>

              <Button
                onClick={() => loadAnalysis()}
                variant="outline"
                className="w-full"
              >
                Actualiser
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Analyse terminée - Afficher les résultats
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/pro/dashboard')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour au dashboard
          </Button>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <FileText className="w-8 h-8 text-primary" />
                Analyse de devis
              </h1>
              <p className="text-muted-foreground mt-1">
                Référence : {analysis.reference_devis}
              </p>
            </div>
            {getStatusBadge(analysis.status)}
          </div>
        </div>

        {/* Score principal */}
        <Card className="border-2">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between">
              <span>Score TORP</span>
              {getGradeBadge(analysis.grade)}
            </CardTitle>
            <CardDescription>
              Évaluation globale de votre devis sur 1000 points
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-bold">{analysis.score_total || 0}/1000</span>
                    <span className="text-sm text-muted-foreground">
                      {analysis.score_total ? `${Math.round((analysis.score_total / 1000) * 100)}%` : '0%'}
                    </span>
                  </div>
                  <Progress
                    value={analysis.score_total ? (analysis.score_total / 1000) * 100 : 0}
                    className="h-3"
                  />
                </div>
              </div>

              {analysis.analyzed_at && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Analysé le {new Date(analysis.analyzed_at).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Scores détaillés (4 axes) */}
        {analysis.score_details && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Scores détaillés
              </CardTitle>
              <CardDescription>
                Analyse sur les 4 axes TORP (250 points chacun)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Transparence */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Transparence</span>
                    <span className="text-sm font-semibold">{analysis.score_details.transparence}/250</span>
                  </div>
                  <Progress
                    value={(analysis.score_details.transparence / 250) * 100}
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    Clarté des informations, mentions légales, détails matériaux
                  </p>
                </div>

                {/* Offre */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Offre</span>
                    <span className="text-sm font-semibold">{analysis.score_details.offre}/250</span>
                  </div>
                  <Progress
                    value={(analysis.score_details.offre / 250) * 100}
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    Complétude du devis, prestations détaillées, quantitatifs
                  </p>
                </div>

                {/* Robustesse */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Robustesse</span>
                    <span className="text-sm font-semibold">{analysis.score_details.robustesse}/250</span>
                  </div>
                  <Progress
                    value={(analysis.score_details.robustesse / 250) * 100}
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    Garanties, assurances, certifications, solidité juridique
                  </p>
                </div>

                {/* Prix */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Prix</span>
                    <span className="text-sm font-semibold">{analysis.score_details.prix}/250</span>
                  </div>
                  <Progress
                    value={(analysis.score_details.prix / 250) * 100}
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    Cohérence tarifaire, détail des coûts, conditions de paiement
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recommandations */}
        {analysis.recommandations && analysis.recommandations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5" />
                Recommandations d'amélioration
              </CardTitle>
              <CardDescription>
                {analysis.recommandations.length} suggestion(s) pour optimiser votre devis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analysis.recommandations.map((rec: Recommendation, index: number) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-medium">{rec.message}</p>
                        {rec.example && (
                          <p className="text-sm text-muted-foreground mt-1 italic">
                            {rec.example}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        {getPriorityBadge(rec.priority)}
                        {getDifficultyBadge(rec.difficulty)}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Impact :</span>
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          {rec.impact}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Axe :</span>
                        <Badge variant="secondary">{rec.type}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Informations du devis */}
        <Card>
          <CardHeader>
            <CardTitle>Informations du devis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="w-4 h-4" />
                  <span>Référence</span>
                </div>
                <p className="font-medium">{analysis.reference_devis}</p>
              </div>

              {analysis.nom_projet && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="w-4 h-4" />
                    <span>Projet</span>
                  </div>
                  <p className="font-medium">{analysis.nom_projet}</p>
                </div>
              )}

              {analysis.montant_ht && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Euro className="w-4 h-4" />
                    <span>Montant HT</span>
                  </div>
                  <p className="font-medium">{analysis.montant_ht.toLocaleString('fr-FR')} €</p>
                </div>
              )}

              {analysis.montant_ttc && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Euro className="w-4 h-4" />
                    <span>Montant TTC</span>
                  </div>
                  <p className="font-medium">{analysis.montant_ttc.toLocaleString('fr-FR')} €</p>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>Créé le</span>
                </div>
                <p className="font-medium">
                  {new Date(analysis.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="w-4 h-4" />
                  <span>Version</span>
                </div>
                <p className="font-medium">v{analysis.version}</p>
              </div>
            </div>

            {analysis.file_url && (
              <div className="mt-4">
                <Button variant="outline" size="sm" asChild>
                  <a href={analysis.file_url} target="_blank" rel="noopener noreferrer">
                    <Download className="w-4 h-4 mr-2" />
                    Télécharger le devis
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Actions disponibles</CardTitle>
            <CardDescription>
              Générez un ticket TORP ou créez une nouvelle version de votre devis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analysis.status === 'COMPLETED' && !analysis.ticket_genere && (
              <Button
                className="w-full"
                size="lg"
                onClick={handleGenerateTicket}
                disabled={generatingTicket}
              >
                {generatingTicket ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Génération en cours...
                  </>
                ) : (
                  <>
                    <QrCode className="w-5 h-5 mr-2" />
                    Générer un ticket TORP
                  </>
                )}
              </Button>
            )}

            {analysis.status === 'COMPLETED' && analysis.ticket_genere && (
              <Button
                className="w-full"
                size="lg"
                variant="outline"
                onClick={() => window.open(`/t/${analysis.ticket_code}`, '_blank')}
              >
                <CheckCircle2 className="w-5 h-5 mr-2 text-green-600" />
                Voir le ticket TORP
                <Badge variant="secondary" className="ml-2">{analysis.ticket_code}</Badge>
              </Button>
            )}

            {analysis.status !== 'COMPLETED' && (
              <Button className="w-full" size="lg" disabled>
                <QrCode className="w-5 h-5 mr-2" />
                Générer un ticket TORP
                <Badge variant="secondary" className="ml-2">Analyse requise</Badge>
              </Button>
            )}

            <Button variant="outline" className="w-full" disabled>
              <Sparkles className="w-4 h-4 mr-2" />
              Ré-analyser avec un devis amélioré
              <Badge variant="secondary" className="ml-2">Bientôt</Badge>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

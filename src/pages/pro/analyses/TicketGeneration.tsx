/**
 * TORP B2B - Génération de Ticket TORP
 *
 * Page de génération et prévisualisation du ticket TORP (badge de certification)
 *
 * Fonctionnalités:
 * - Génération automatique du ticket si pas encore généré
 * - Prévisualisation du PDF généré
 * - Téléchargement du PDF
 * - Copie du lien de vérification
 * - Instructions d'utilisation
 *
 * @route /pro/analyses/:id/ticket
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { getAnalysis, generateTicket, getTicketInfo } from '@/services/api/pro/analysisService';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Download,
  Copy,
  CheckCircle2,
  ExternalLink,
  Loader2,
  QrCode,
  AlertTriangle,
  Info,
  Eye,
} from 'lucide-react';
import type { ProDevisAnalysis } from '@/types/pro';

export default function TicketGeneration() {
  const navigate = useNavigate();
  const { userType } = useApp();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ProDevisAnalysis | null>(null);
  const [generating, setGenerating] = useState(false);
  const [ticketInfo, setTicketInfo] = useState<{
    ticket_code: string;
    short_code: string;
    ticket_url: string;
    pdf_url: string;
    pdf_file_name: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (userType !== 'B2B') {
      navigate('/dashboard');
      return;
    }

    if (id) {
      loadData();
    }
  }, [userType, id, navigate]);

  const loadData = async () => {
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

      // Si le ticket existe déjà, charger ses infos
      if (analysisData.ticket_genere && analysisData.ticket_code) {
        const info = await getTicketInfo(analysisData.id);
        if (info) {
          setTicketInfo(info);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTicket = async () => {
    if (!analysis) return;

    try {
      setGenerating(true);

      const ticket = await generateTicket(analysis.id);

      setTicketInfo(ticket);

      // Recharger l'analyse
      const updatedAnalysis = await getAnalysis(analysis.id);
      if (updatedAnalysis) {
        setAnalysis(updatedAnalysis);
      }

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
      setGenerating(false);
    }
  };

  const handleCopyLink = async () => {
    if (!ticketInfo) return;

    try {
      await navigator.clipboard.writeText(ticketInfo.ticket_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      toast({
        title: "✅ Lien copié !",
        description: "Le lien de vérification a été copié dans le presse-papiers",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de copier le lien",
      });
    }
  };

  const handleDownloadPDF = () => {
    if (!ticketInfo) return;

    // Ouvrir le PDF dans un nouvel onglet pour téléchargement
    window.open(ticketInfo.pdf_url, '_blank');
  };

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
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
            onClick={() => navigate(`/pro/analysis/${id}`)}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à l'analyse
          </Button>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>{error || 'Analyse non trouvée'}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // Analysis not completed
  if (analysis.status !== 'COMPLETED') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/pro/analysis/${id}`)}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à l'analyse
          </Button>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Analyse en cours</AlertTitle>
            <AlertDescription>
              Vous pourrez générer le ticket TORP une fois l'analyse terminée.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/pro/analysis/${id}`)}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à l'analyse
          </Button>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <QrCode className="w-8 h-8 text-primary" />
                Ticket TORP
              </h1>
              <p className="text-muted-foreground mt-1">
                Badge de certification pour votre devis
              </p>
            </div>
            {ticketInfo && (
              <Badge variant="default" className="bg-green-600">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Ticket généré
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Prévisualisation */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Prévisualisation
              </CardTitle>
              <CardDescription>
                Aperçu du ticket TORP pour votre devis
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!ticketInfo ? (
                <div className="border-2 border-dashed rounded-lg p-12 text-center">
                  <QrCode className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Le ticket n'a pas encore été généré
                  </p>
                  <Button
                    onClick={handleGenerateTicket}
                    disabled={generating}
                    size="lg"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Génération en cours...
                      </>
                    ) : (
                      <>
                        <QrCode className="w-5 h-5 mr-2" />
                        Générer le ticket
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="border rounded-lg overflow-hidden bg-gray-50">
                    <iframe
                      src={ticketInfo.pdf_url}
                      className="w-full h-[400px]"
                      title="Prévisualisation du ticket TORP"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleDownloadPDF}
                      className="flex-1"
                      variant="default"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Télécharger le PDF
                    </Button>
                    <Button
                      onClick={() => window.open(ticketInfo.pdf_url, '_blank')}
                      variant="outline"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Informations et actions */}
          <div className="space-y-6">
            {/* Informations du ticket */}
            {ticketInfo && (
              <Card>
                <CardHeader>
                  <CardTitle>Informations du ticket</CardTitle>
                  <CardDescription>
                    Détails de votre ticket de certification
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Code de vérification
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 px-3 py-2 bg-muted rounded-md font-mono text-sm">
                        {ticketInfo.ticket_code}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(ticketInfo.ticket_code);
                          toast({ title: "Code copié !" });
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Lien de vérification public
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm overflow-x-auto">
                        {ticketInfo.ticket_url}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyLink}
                      >
                        {copied ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.open(ticketInfo.ticket_url, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Voir la page publique
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Instructions */}
            <Card>
              <CardHeader>
                <CardTitle>Comment utiliser votre ticket ?</CardTitle>
                <CardDescription>
                  Guide d'utilisation du badge TORP
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                      1
                    </div>
                    <div>
                      <p className="font-medium">Téléchargez le ticket PDF</p>
                      <p className="text-sm text-muted-foreground">
                        Cliquez sur "Télécharger le PDF" pour obtenir votre badge
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                      2
                    </div>
                    <div>
                      <p className="font-medium">Intégrez-le à votre devis</p>
                      <p className="text-sm text-muted-foreground">
                        Ajoutez le ticket en dernière page de votre devis PDF ou dans l'en-tête
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                      3
                    </div>
                    <div>
                      <p className="font-medium">Partagez avec votre client</p>
                      <p className="text-sm text-muted-foreground">
                        Votre client pourra scanner le QR code ou entrer le code de vérification
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                      4
                    </div>
                    <div>
                      <p className="font-medium">Renforcez la confiance</p>
                      <p className="text-sm text-muted-foreground">
                        Le ticket TORP prouve la qualité et la transparence de votre devis
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Analyse info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Devis associé</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Référence :</span>
                  <span className="font-medium">{analysis.reference_devis}</span>
                </div>
                {analysis.nom_projet && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Projet :</span>
                    <span className="font-medium">{analysis.nom_projet}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Score TORP :</span>
                  <span className="font-bold">{analysis.score_total}/1000</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Grade :</span>
                  <Badge variant="outline">{analysis.grade}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

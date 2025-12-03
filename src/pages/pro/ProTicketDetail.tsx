/**
 * ProTicketDetail Page
 * Affiche les détails d'un ticket TORP
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ProLayout } from '@/components/pro/ProLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import {
  Ticket,
  ArrowLeft,
  Download,
  QrCode,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Calendar,
  Building2,
  Award,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TorpTicketDetail {
  id: string;
  reference: string;
  analyse_id: string | null;
  nom_projet: string | null;
  client_nom: string | null;
  score_torp: number;
  grade: string;
  status: 'draft' | 'active' | 'expired' | 'revoked';
  date_generation: string;
  date_expiration: string | null;
  qr_code_url: string | null;
  pdf_url: string | null;
  created_at: string;
}

export default function ProTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useApp();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [ticket, setTicket] = useState<TorpTicketDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id && id) {
      loadTicket();
    }
  }, [user?.id, id]);

  async function loadTicket() {
    try {
      // D'abord récupérer la company de l'utilisateur
      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('user_id', user!.id)
        .single();

      if (!company) {
        navigate('/pro/tickets');
        return;
      }

      // Récupérer le ticket
      const { data, error } = await supabase
        .from('torp_tickets')
        .select('*')
        .eq('id', id)
        .eq('company_id', company.id)
        .single();

      if (error || !data) {
        console.error('[ProTicketDetail] Erreur:', error);
        navigate('/pro/tickets');
        return;
      }

      setTicket(data);
    } catch (error) {
      console.error('[ProTicketDetail] Erreur:', error);
      navigate('/pro/tickets');
    } finally {
      setLoading(false);
    }
  }

  function copyReference() {
    if (ticket?.reference) {
      navigator.clipboard.writeText(ticket.reference);
      toast({
        title: 'Référence copiée',
        description: ticket.reference,
      });
    }
  }

  function getGradeBg(grade: string) {
    switch (grade) {
      case 'A':
      case 'A+':
        return 'bg-emerald-500';
      case 'B':
        return 'bg-green-500';
      case 'C':
        return 'bg-yellow-500';
      case 'D':
        return 'bg-orange-500';
      default:
        return 'bg-red-500';
    }
  }

  function getGradeLabel(grade: string) {
    switch (grade) {
      case 'A+':
        return 'Exceptionnel';
      case 'A':
        return 'Excellent';
      case 'B':
        return 'Très bon';
      case 'C':
        return 'Correct';
      case 'D':
        return 'À améliorer';
      default:
        return 'Insuffisant';
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-green-500 text-white">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Actif
          </Badge>
        );
      case 'draft':
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Brouillon
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="outline" className="text-orange-600 border-orange-600">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Expiré
          </Badge>
        );
      case 'revoked':
        return (
          <Badge variant="destructive">
            Révoqué
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  function isExpired(date: string | null) {
    if (!date) return false;
    return new Date(date) < new Date();
  }

  function getDaysRemaining(date: string | null) {
    if (!date) return null;
    const expDate = new Date(date);
    const now = new Date();
    const diffTime = expDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  if (loading) {
    return (
      <ProLayout>
        <div className="flex justify-center items-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ProLayout>
    );
  }

  if (!ticket) {
    return (
      <ProLayout>
        <div className="text-center py-24">
          <Ticket className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">Ticket non trouvé</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/pro/tickets')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour aux tickets
          </Button>
        </div>
      </ProLayout>
    );
  }

  const daysRemaining = getDaysRemaining(ticket.date_expiration);

  return (
    <ProLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate('/pro/tickets')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Ticket TORP</h1>
            <p className="text-muted-foreground">Détails du certificat de conformité</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Carte principale - Score et Grade */}
          <Card className="lg:col-span-1">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                {/* Grade */}
                <div
                  className={`w-32 h-32 mx-auto rounded-2xl flex flex-col items-center justify-center text-white ${getGradeBg(
                    ticket.grade
                  )}`}
                >
                  <span className="text-5xl font-bold">{ticket.grade}</span>
                  <span className="text-sm opacity-80">{ticket.score_torp}/1000</span>
                </div>

                <div>
                  <p className="text-lg font-semibold">{getGradeLabel(ticket.grade)}</p>
                  {getStatusBadge(ticket.status)}
                </div>

                {/* Référence */}
                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-1">Référence</p>
                  <div className="flex items-center justify-center gap-2">
                    <code className="text-lg font-mono font-bold tracking-wider">
                      {ticket.reference}
                    </code>
                    <Button variant="ghost" size="sm" onClick={copyReference}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Expiration */}
                {ticket.date_expiration && (
                  <div className="pt-4 border-t">
                    <p className="text-xs text-muted-foreground mb-1">Validité</p>
                    {isExpired(ticket.date_expiration) ? (
                      <p className="text-destructive font-medium">Expiré</p>
                    ) : daysRemaining !== null && daysRemaining <= 30 ? (
                      <p className="text-warning font-medium">
                        Expire dans {daysRemaining} jour{daysRemaining > 1 ? 's' : ''}
                      </p>
                    ) : (
                      <p className="text-muted-foreground">
                        Jusqu'au {new Date(ticket.date_expiration).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Informations détaillées */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5" />
                Informations du ticket
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Projet */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Projet</p>
                  <p className="font-medium">{ticket.nom_projet || 'Non spécifié'}</p>
                </div>
                {ticket.client_nom && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Client</p>
                    <p className="font-medium flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {ticket.client_nom}
                    </p>
                  </div>
                )}
              </div>

              {/* Dates */}
              <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Date de génération</p>
                  <p className="font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {new Date(ticket.date_generation).toLocaleDateString('fr-FR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                {ticket.date_expiration && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Date d'expiration</p>
                    <p className="font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {new Date(ticket.date_expiration).toLocaleDateString('fr-FR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                )}
              </div>

              {/* Score détaillé */}
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-3">Score TORP</p>
                <div className="flex items-center gap-4">
                  <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                    <div
                      className={`h-full ${getGradeBg(ticket.grade)} transition-all`}
                      style={{ width: `${(ticket.score_torp / 1000) * 100}%` }}
                    />
                  </div>
                  <span className="font-bold text-lg">{ticket.score_torp}/1000</span>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t flex flex-wrap gap-3">
                {ticket.qr_code_url && (
                  <Button variant="outline">
                    <QrCode className="h-4 w-4 mr-2" />
                    Afficher QR Code
                  </Button>
                )}
                {ticket.pdf_url && (
                  <Button variant="outline" asChild>
                    <a href={ticket.pdf_url} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" />
                      Télécharger PDF
                    </a>
                  </Button>
                )}
                <Button variant="outline" onClick={() => {
                  const verificationUrl = `${window.location.origin}/verify/${ticket.reference}`;
                  navigator.clipboard.writeText(verificationUrl);
                  toast({
                    title: 'Lien copié',
                    description: 'Le lien de vérification a été copié',
                  });
                }}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Copier lien de vérification
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info box */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Award className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <p className="font-medium text-blue-700">
                  Certificat de conformité TORP
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  Ce ticket atteste de la qualité de votre devis selon la méthodologie TORP.
                  Partagez la référence ou le QR code avec vos clients pour qu'ils puissent
                  vérifier l'authenticité de ce certificat.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ProLayout>
  );
}

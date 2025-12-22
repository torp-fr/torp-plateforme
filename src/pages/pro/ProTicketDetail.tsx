/**
 * ProTicketDetail Page
 * Affiche les détails d'un ticket TORP avec QR code et téléchargement PDF
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import {
  Ticket,
  ArrowLeft,
  Download,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Calendar,
  Building2,
  Award,
  Copy,
  FileText,
  User,
  Hash,
  Key,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';

interface TorpTicketDetail {
  id: string;
  reference: string;
  analyse_id: string | null;
  nom_projet: string | null;
  client_nom: string | null;
  entreprise_nom: string | null;
  score_torp: number;
  grade: string;
  status: 'draft' | 'active' | 'expired' | 'revoked';
  date_generation: string;
  date_emission: string | null;
  date_expiration: string | null;
  code_acces: string | null;
  numero_devis: string | null;
  duree_validite: number | null;
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
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (user?.id && id) {
      loadTicket();
    }
  }, [user?.id, id]);

  async function loadTicket() {
    try {
      const { data: company } = await supabase
        .from('companies')
        .select('id, name')
        .eq('user_id', user!.id)
        .single();

      if (!company) {
        navigate('/pro/tickets');
        return;
      }

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

      // Si entreprise_nom n'est pas défini, utiliser le nom de la company
      if (!data.entreprise_nom) {
        data.entreprise_nom = company.name;
      }

      setTicket(data);
    } catch (error) {
      console.error('[ProTicketDetail] Erreur:', error);
      navigate('/pro/tickets');
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast({
      title: `${label} copié`,
      description: text,
    });
  }

  function getGradeBg(grade: string) {
    switch (grade) {
      case 'A+': return 'bg-emerald-500';
      case 'A': return 'bg-emerald-500';
      case 'B': return 'bg-green-500';
      case 'C': return 'bg-yellow-500';
      case 'D': return 'bg-orange-500';
      default: return 'bg-red-500';
    }
  }

  function getGradeColor(grade: string) {
    switch (grade) {
      case 'A+': return '#10b981';
      case 'A': return '#10b981';
      case 'B': return '#22c55e';
      case 'C': return '#eab308';
      case 'D': return '#f97316';
      default: return '#ef4444';
    }
  }

  function getGradeLabel(grade: string) {
    switch (grade) {
      case 'A+': return 'Exceptionnel';
      case 'A': return 'Excellent';
      case 'B': return 'Très bon';
      case 'C': return 'Correct';
      case 'D': return 'À améliorer';
      default: return 'Insuffisant';
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
        return <Badge variant="destructive">Révoqué</Badge>;
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
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // Générer l'URL du QR Code
  function getQRCodeUrl() {
    if (!ticket) return '';
    const verificationUrl = `${window.location.origin}/verify/${ticket.code_acces || ticket.reference}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(verificationUrl)}`;
  }

  // Télécharger le ticket en PDF
  async function downloadTicketPDF() {
    if (!ticket) return;

    setDownloading(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // En-tête
      doc.setFillColor(37, 99, 235); // Bleu TORP
      doc.rect(0, 0, pageWidth, 45, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('TICKET TORP', pageWidth / 2, 20, { align: 'center' });

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('Certificat de Conformité Devis', pageWidth / 2, 30, { align: 'center' });
      doc.text(`Référence: ${ticket.reference}`, pageWidth / 2, 38, { align: 'center' });

      // Grade et Score
      const gradeColor = getGradeColor(ticket.grade);
      doc.setFillColor(parseInt(gradeColor.slice(1, 3), 16), parseInt(gradeColor.slice(3, 5), 16), parseInt(gradeColor.slice(5, 7), 16));
      doc.roundedRect(pageWidth / 2 - 25, 55, 50, 50, 5, 5, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(32);
      doc.setFont('helvetica', 'bold');
      doc.text(ticket.grade, pageWidth / 2, 80, { align: 'center' });

      doc.setFontSize(12);
      doc.text(`${ticket.score_torp}/1000`, pageWidth / 2, 95, { align: 'center' });

      // Informations principales
      doc.setTextColor(0, 0, 0);
      let yPos = 120;

      // Section Entreprise
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('INFORMATIONS', 20, yPos);
      yPos += 10;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');

      const addInfo = (label: string, value: string | null) => {
        if (value) {
          doc.setFont('helvetica', 'bold');
          doc.text(`${label}:`, 20, yPos);
          doc.setFont('helvetica', 'normal');
          doc.text(value, 70, yPos);
          yPos += 8;
        }
      };

      addInfo('Entreprise', ticket.entreprise_nom);
      addInfo('Client', ticket.client_nom);
      addInfo('Projet', ticket.nom_projet);
      addInfo('N° Devis', ticket.numero_devis);

      yPos += 5;

      // Section Dates
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('DATES', 20, yPos);
      yPos += 10;

      doc.setFontSize(11);

      if (ticket.date_emission) {
        addInfo('Émission', new Date(ticket.date_emission).toLocaleDateString('fr-FR'));
      }
      addInfo('Génération', new Date(ticket.date_generation).toLocaleDateString('fr-FR'));
      if (ticket.date_expiration) {
        addInfo('Validité', `Jusqu'au ${new Date(ticket.date_expiration).toLocaleDateString('fr-FR')}`);
      }
      if (ticket.duree_validite) {
        addInfo('Délai réponse', `${ticket.duree_validite} jours`);
      }

      // QR Code et Code d'accès
      yPos += 10;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('VÉRIFICATION CLIENT', 20, yPos);
      yPos += 10;

      // Charger et ajouter le QR Code
      const qrUrl = getQRCodeUrl();
      try {
        const response = await fetch(qrUrl);
        const blob = await response.blob();
        const reader = new FileReader();

        await new Promise<void>((resolve) => {
          reader.onload = () => {
            const imgData = reader.result as string;
            doc.addImage(imgData, 'PNG', 20, yPos, 40, 40);
            resolve();
          };
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.error('Erreur chargement QR:', e);
      }

      // Instructions à droite du QR
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Scannez ce QR code ou utilisez', 70, yPos + 10);
      doc.text('le code d\'accès ci-dessous:', 70, yPos + 17);

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(ticket.code_acces || ticket.reference, 70, yPos + 30);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`sur ${window.location.origin}/verify`, 70, yPos + 38);

      // Pied de page
      doc.setFillColor(245, 245, 245);
      doc.rect(0, 270, pageWidth, 30, 'F');

      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('Ce document est un certificat officiel TORP attestant de la conformité du devis analysé.', pageWidth / 2, 278, { align: 'center' });
      doc.text(`Document généré le ${new Date().toLocaleDateString('fr-FR')} - ${window.location.origin}`, pageWidth / 2, 285, { align: 'center' });

      // Télécharger
      doc.save(`Ticket-TORP-${ticket.reference}.pdf`);

      toast({
        title: 'Téléchargement réussi',
        description: `Ticket-TORP-${ticket.reference}.pdf`,
      });
    } catch (error) {
      console.error('[ProTicketDetail] Erreur PDF:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de générer le PDF',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-center items-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="space-y-6">
        <div className="text-center py-24">
          <Ticket className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">Ticket non trouvé</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/pro/tickets')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour aux tickets
          </Button>
        </div>
      </div>
    );
  }

  const daysRemaining = getDaysRemaining(ticket.date_expiration);

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => navigate('/pro/tickets')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Ticket TORP</h1>
              <p className="text-muted-foreground">Certificat de conformité devis</p>
            </div>
          </div>
          <Button onClick={downloadTicketPDF} disabled={downloading}>
            {downloading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {downloading ? 'Génération...' : 'Télécharger le ticket'}
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Colonne gauche - Grade et QR Code */}
          <Card className="lg:col-span-1">
            <CardContent className="pt-6">
              <div className="text-center space-y-6">
                {/* Grade */}
                <div
                  className={`w-36 h-36 mx-auto rounded-2xl flex flex-col items-center justify-center text-white ${getGradeBg(ticket.grade)}`}
                >
                  <span className="text-6xl font-bold">{ticket.grade}</span>
                  <span className="text-lg opacity-90">{ticket.score_torp}/1000</span>
                </div>

                <div>
                  <p className="text-xl font-semibold">{getGradeLabel(ticket.grade)}</p>
                  {getStatusBadge(ticket.status)}
                </div>

                {/* QR Code */}
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-3">QR Code de vérification</p>
                  <div className="bg-white p-3 rounded-lg inline-block shadow-sm border">
                    <img
                      src={getQRCodeUrl()}
                      alt="QR Code de vérification"
                      className="w-40 h-40"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Scannable par le client
                  </p>
                </div>

                {/* Code d'accès */}
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">Code d'accès client</p>
                  <div className="flex items-center justify-center gap-2">
                    <code className="text-xl font-mono font-bold tracking-widest bg-muted px-4 py-2 rounded">
                      {ticket.code_acces || ticket.reference}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(ticket.code_acces || ticket.reference, 'Code d\'accès')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    À saisir sur {window.location.host}/verify
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Colonne droite - Informations */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5" />
                Détails du ticket
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Entreprise et Client */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Entreprise
                  </p>
                  <p className="font-semibold text-lg">{ticket.entreprise_nom || 'Non spécifié'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Client
                  </p>
                  <p className="font-semibold text-lg">{ticket.client_nom || 'Non spécifié'}</p>
                </div>
              </div>

              {/* Projet et N° Devis */}
              <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Projet
                  </p>
                  <p className="font-medium">{ticket.nom_projet || 'Non spécifié'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    N° Devis (réf. entreprise)
                  </p>
                  <p className="font-mono font-medium">{ticket.numero_devis || 'Non spécifié'}</p>
                </div>
              </div>

              {/* Référence TORP */}
              <div className="pt-4 border-t">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Référence TORP
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="font-mono font-bold text-lg tracking-wider">
                      {ticket.reference}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(ticket.reference, 'Référence')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="grid md:grid-cols-3 gap-4 pt-4 border-t">
                {ticket.date_emission && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Date d'émission
                    </p>
                    <p className="font-medium">
                      {new Date(ticket.date_emission).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Date de génération
                  </p>
                  <p className="font-medium">
                    {new Date(ticket.date_generation).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                {ticket.date_expiration && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Date limite de validité
                    </p>
                    <p className={`font-medium ${isExpired(ticket.date_expiration) ? 'text-destructive' : daysRemaining !== null && daysRemaining <= 7 ? 'text-warning' : ''}`}>
                      {new Date(ticket.date_expiration).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                      {isExpired(ticket.date_expiration) && (
                        <Badge variant="destructive" className="ml-2">Expiré</Badge>
                      )}
                      {!isExpired(ticket.date_expiration) && daysRemaining !== null && daysRemaining <= 7 && (
                        <Badge variant="outline" className="ml-2 text-warning border-warning">
                          {daysRemaining} jour{daysRemaining > 1 ? 's' : ''} restant{daysRemaining > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </p>
                  </div>
                )}
              </div>

              {/* Délai de réponse */}
              {ticket.duree_validite && (
                <div className="pt-4 border-t">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-amber-700">
                      <Clock className="h-5 w-5" />
                      <span className="font-semibold">Délai de réponse client: {ticket.duree_validite} jours</span>
                    </div>
                    <p className="text-sm text-amber-600 mt-1">
                      Le client dispose de {ticket.duree_validite} jours pour accepter ce devis.
                    </p>
                  </div>
                </div>
              )}

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
            </CardContent>
          </Card>
        </div>

        {/* Info box */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Award className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-blue-700">
                  Comment votre client peut vérifier ce devis ?
                </p>
                <div className="text-sm text-blue-600 mt-2 space-y-2">
                  <p><strong>Option 1:</strong> Scanner le QR code avec son téléphone pour accéder directement à l'analyse.</p>
                  <p><strong>Option 2:</strong> Se rendre sur <code className="bg-blue-100 px-1 rounded">{window.location.host}/verify</code> et saisir le code d'accès <strong>{ticket.code_acces || ticket.reference}</strong>.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

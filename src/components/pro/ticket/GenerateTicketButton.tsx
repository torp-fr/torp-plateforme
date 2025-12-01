/**
 * TORP B2B - Bouton Générer/Voir Ticket TORP
 *
 * Composant réutilisable pour gérer la génération et l'accès aux tickets TORP
 * Utilisable dans la page détail d'analyse et dans la liste des analyses
 *
 * Props:
 * - analysis: L'analyse dont on veut générer/voir le ticket
 * - variant: 'full' (bouton complet) ou 'compact' (version liste)
 * - onSuccess: Callback après génération réussie
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { generateTicket } from '@/services/api/pro/analysisService';
import {
  QrCode,
  Loader2,
  CheckCircle2,
  Eye,
  Download,
} from 'lucide-react';
import type { ProDevisAnalysis } from '@/types/pro';

interface GenerateTicketButtonProps {
  analysis: ProDevisAnalysis;
  variant?: 'full' | 'compact';
  showDownload?: boolean;
  onSuccess?: (ticketData: any) => void;
}

export default function GenerateTicketButton({
  analysis,
  variant = 'full',
  showDownload = false,
  onSuccess,
}: GenerateTicketButtonProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);

  const handleGenerateTicket = async (e?: React.MouseEvent) => {
    e?.stopPropagation(); // Empêcher la propagation si dans une liste cliquable

    if (!analysis) return;

    try {
      setGenerating(true);

      const ticket = await generateTicket(analysis.id);

      toast({
        title: "✅ Ticket généré avec succès !",
        description: `Code : ${ticket.ticket_code}`,
      });

      if (onSuccess) {
        onSuccess(ticket);
      }

      // Naviguer vers la page de prévisualisation
      navigate(`/pro/analyses/${analysis.id}/ticket`);
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

  const handleViewTicket = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigate(`/pro/analyses/${analysis.id}/ticket`);
  };

  // Analyse non terminée
  if (analysis.status !== 'COMPLETED') {
    if (variant === 'compact') {
      return (
        <Button variant="ghost" size="sm" disabled>
          <QrCode className="w-4 h-4 mr-1" />
          Ticket
        </Button>
      );
    }

    return (
      <Button className="w-full" size="lg" disabled>
        <QrCode className="w-5 h-5 mr-2" />
        Générer un ticket TORP
        <Badge variant="secondary" className="ml-2">Analyse requise</Badge>
      </Button>
    );
  }

  // Ticket non généré
  if (!analysis.ticket_genere) {
    if (variant === 'compact') {
      return (
        <Button
          variant="default"
          size="sm"
          onClick={handleGenerateTicket}
          disabled={generating}
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              Génération...
            </>
          ) : (
            <>
              <QrCode className="w-4 h-4 mr-1" />
              Générer ticket
            </>
          )}
        </Button>
      );
    }

    return (
      <Button
        className="w-full"
        size="lg"
        onClick={handleGenerateTicket}
        disabled={generating}
      >
        {generating ? (
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
    );
  }

  // Ticket déjà généré
  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleViewTicket}
        >
          <Eye className="w-4 h-4 mr-1" />
          Voir ticket
        </Button>
        {showDownload && analysis.ticket_url && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              window.open(analysis.ticket_url, '_blank');
            }}
          >
            <Download className="w-4 h-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        className="w-full"
        size="lg"
        variant="default"
        onClick={handleViewTicket}
      >
        <CheckCircle2 className="w-5 h-5 mr-2 text-white" />
        Voir le ticket TORP
        {analysis.ticket_code && (
          <Badge variant="secondary" className="ml-2 bg-white/20 text-white border-white/30">
            {analysis.ticket_code}
          </Badge>
        )}
      </Button>

      {showDownload && analysis.ticket_url && (
        <Button
          variant="outline"
          className="w-full"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            window.open(analysis.ticket_url, '_blank');
          }}
        >
          <Download className="w-4 h-4 mr-2" />
          Télécharger le PDF
        </Button>
      )}
    </div>
  );
}

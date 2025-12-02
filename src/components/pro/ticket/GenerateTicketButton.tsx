/**
 * Bouton réutilisable pour générer/accéder au ticket TORP
 * Utilisé dans la page détail analyse et la liste
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Ticket, Download, Loader2, QrCode } from 'lucide-react';
import { generateTicket } from '@/lib/pro/ticket/ticket-service';
import type { ProDevisAnalysis } from '@/types/pro';

// Support pour deux interfaces : objet analysis complet ou props individuelles
interface GenerateTicketButtonPropsWithAnalysis {
  analysis: ProDevisAnalysis;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'full';
  size?: 'default' | 'sm' | 'lg';
  showDownload?: boolean;
  onSuccess?: () => void;
}

interface GenerateTicketButtonPropsIndividual {
  analysisId: string;
  ticketGenere: boolean;
  ticketUrl?: string | null;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'full';
  size?: 'default' | 'sm' | 'lg';
  showDownload?: boolean;
  onSuccess?: () => void;
}

type GenerateTicketButtonProps = GenerateTicketButtonPropsWithAnalysis | GenerateTicketButtonPropsIndividual;

// Type guard pour vérifier si on a l'objet analysis
function hasAnalysis(props: GenerateTicketButtonProps): props is GenerateTicketButtonPropsWithAnalysis {
  return 'analysis' in props;
}

export function GenerateTicketButton(props: GenerateTicketButtonProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Extraire les valeurs selon l'interface utilisée
  const analysisId = hasAnalysis(props) ? props.analysis.id : props.analysisId;
  const ticketGenere = hasAnalysis(props) ? props.analysis.ticket_genere : props.ticketGenere;
  const ticketUrl = hasAnalysis(props) ? props.analysis.ticket_url : props.ticketUrl;
  const variant = props.variant || 'default';
  const size = props.size || 'default';
  const showDownload = props.showDownload ?? false;
  const onSuccess = props.onSuccess;

  async function handleGenerate() {
    setLoading(true);
    try {
      await generateTicket(analysisId);
      if (onSuccess) {
        onSuccess();
      }
      navigate(`/pro/analyses/${analysisId}/ticket`);
    } catch (error) {
      console.error('Error generating ticket:', error);
      alert('Erreur lors de la génération du ticket');
    } finally {
      setLoading(false);
    }
  }

  // Variant "full" : affichage complet avec card
  if (variant === 'full') {
    if (ticketGenere) {
      return (
        <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-950/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-600 rounded-lg">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-green-900 dark:text-green-100">
                Ticket TORP généré
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                Prêt à être intégré à votre devis
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => navigate(`/pro/analyses/${analysisId}/ticket`)}
              className="flex-1"
            >
              <Ticket className="mr-2 h-4 w-4" />
              Voir le ticket
            </Button>
            {ticketUrl && (
              <Button
                variant="outline"
                onClick={() => window.open(ticketUrl, '_blank')}
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="border rounded-lg p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <QrCode className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold">Générer un ticket TORP</p>
            <p className="text-sm text-muted-foreground">
              Badge de certification pour votre devis
            </p>
          </div>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Génération en cours...
            </>
          ) : (
            <>
              <QrCode className="mr-2 h-4 w-4" />
              Générer le ticket
            </>
          )}
        </Button>
      </div>
    );
  }

  // Variants normaux : bouton simple
  if (ticketGenere) {
    return (
      <div className="flex gap-2">
        <Button
          variant={variant === 'full' ? 'default' : variant}
          size={size}
          onClick={() => navigate(`/pro/analyses/${analysisId}/ticket`)}
        >
          <Ticket className="mr-2 h-4 w-4" />
          Voir le ticket
        </Button>
        {showDownload && ticketUrl && (
          <Button
            variant="outline"
            size={size}
            onClick={() => window.open(ticketUrl, '_blank')}
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <Button
      variant={variant === 'full' ? 'default' : variant}
      size={size}
      onClick={handleGenerate}
      disabled={loading}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Génération...
        </>
      ) : (
        <>
          <Ticket className="mr-2 h-4 w-4" />
          Générer le ticket
        </>
      )}
    </Button>
  );
}

export default GenerateTicketButton;

/**
 * Page publique d'affichage du ticket TORP
 * Route : /t/:code
 * Accessible sans authentification
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PublicTicketView, type PublicTicketViewData } from '@/components/public/ticket/PublicTicketView';
import { getPublicTicketData, trackTicketView } from '@/services/api/pro/analysisService';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileQuestion, ArrowLeft, Search } from 'lucide-react';

export default function TicketPublicView() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PublicTicketViewData | null>(null);

  useEffect(() => {
    if (!code) {
      setError('Code manquant');
      setLoading(false);
      return;
    }

    loadTicketData();
  }, [code]);

  async function loadTicketData() {
    try {
      setLoading(true);
      setError(null);

      const result = await getPublicTicketData(code!);

      if (!result.valid || !result.data) {
        setError(result.error || 'Ticket non trouvé');
        return;
      }

      setData(result.data);

      // Tracker la vue
      try {
        await trackTicketView(code!, 'link_viewed', {
          userAgent: navigator.userAgent,
          referrer: document.referrer,
        });
      } catch (trackError) {
        // Ne pas bloquer si tracking échoue
        console.error('Error tracking ticket view:', trackError);
      }
    } catch (err: any) {
      console.error('Error loading ticket data:', err);
      setError(err.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  // Error / Not found state
  if (error || !data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <FileQuestion className="h-8 w-8 text-muted-foreground" />
            </div>

            <h1 className="text-2xl font-bold mb-2">Ticket non trouvé</h1>

            <p className="text-muted-foreground mb-6">
              {error ||
                "Ce code de vérification n'existe pas ou n'est plus valide. Vérifiez que vous avez bien scanné le QR code ou copié le lien complet."}
            </p>

            <div className="space-y-3">
              <Button onClick={() => navigate('/')} className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour à l'accueil
              </Button>

              <Button variant="outline" onClick={() => navigate('/analyze')} className="w-full">
                <Search className="mr-2 h-4 w-4" />
                Analyser un devis
              </Button>
            </div>

            <p className="mt-6 text-xs text-muted-foreground">
              Besoin d'aide ? Contactez-nous à support@torp.fr
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <PublicTicketView data={data} />;
}

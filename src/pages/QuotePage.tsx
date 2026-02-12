/**
 * Quote Page - Guided CCF avec Enrichissement Automatique
 * Utilisateur crée son cahier des charges fonctionnel
 * Enrichissement auto des données client via APIs
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GuidedCCFEnriched } from '@/components/guided-ccf/GuidedCCFEnriched';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import type { CCFData } from '@/components/guided-ccf/GuidedCCF';
import type { EnrichedClientData } from '@/types/enrichment';
import { createCCF, storeEnrichedData, logAction } from '@/services/supabaseService';

export function QuotePage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleCCFSubmit = async (data: CCFData & { enrichedData?: EnrichedClientData }) => {
    setIsLoading(true);
    try {
      // Stocke d'abord en localStorage pour fallback
      localStorage.setItem('currentCCF', JSON.stringify(data));

      // Créer CCF dans Supabase
      const createdCCF = await createCCF(data);

      if (createdCCF) {
        // Stocker enriched data si disponible
        if (data.enrichedData) {
          await storeEnrichedData(createdCCF.id, data.enrichedData);
          console.log('✅ CCF + Enriched Data Created in Supabase:', createdCCF.id);
        }

        // Log l'action
        await logAction(createdCCF.id, 'ccf_created', {
          has_enrichment: !!data.enrichedData,
        });

        // Stocker le CCF ID pour utilisation dans les pages suivantes
        localStorage.setItem('currentCCFId', createdCCF.id);
      } else {
        console.warn('⚠️ Failed to create CCF in Supabase, using localStorage fallback');
      }

      // Redirection vers la page de succès
      navigate('/quote-success');
    } catch (error) {
      console.error('❌ Error:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 w-full backdrop-blur-md bg-background/80 z-50 border-b border-border shadow-sm">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-5 w-5 mr-2" />
              Retour
            </Button>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Créer votre Cahier des Charges
            </h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="py-12 px-6">
        <div className="container mx-auto max-w-4xl">
          <GuidedCCFEnriched onSubmit={handleCCFSubmit} isLoading={isLoading} />
        </div>
      </main>
    </div>
  );
}

export default QuotePage;

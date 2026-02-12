/**
 * Quote Page - Guided CCF (Single Page)
 * Utilisateur crée son cahier des charges fonctionnel en une seule page
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GuidedCCFSinglePage, type CCFData } from '@/components/guided-ccf/GuidedCCFSinglePage';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';

export function QuotePage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleCCFSubmit = async (data: CCFData) => {
    setIsLoading(true);
    try {
      // Stocke en localStorage pour demo
      localStorage.setItem('currentCCF', JSON.stringify(data));
      console.log('✅ CCF Created:', data);

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
            <h1 className="font-display text-2xl font-bold text-foreground">Créer votre CCF</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="py-12 px-6">
        <div className="container mx-auto max-w-4xl">
          <GuidedCCFSinglePage onSubmit={handleCCFSubmit} isLoading={isLoading} />
        </div>
      </main>
    </div>
  );
}

export default QuotePage;

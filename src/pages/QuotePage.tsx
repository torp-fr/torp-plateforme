/**
 * Quote Page - Guided CCF
 * Utilisateur crée son cahier des charges fonctionnel
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GuidedCCF, type CCFData } from '@/components/guided-ccf';
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
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-cyan-50">
      {/* Header */}
      <header className="sticky top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-blue-100/30 shadow-sm">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-slate-600 hover:text-blue-600"
            >
              <ChevronLeft className="h-5 w-5 mr-2" />
              Retour
            </Button>
            <h1 className="text-2xl font-bold text-slate-900">Créer votre CCF</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="py-12 px-6">
        <div className="container mx-auto">
          <GuidedCCF onSubmit={handleCCFSubmit} isLoading={isLoading} />
        </div>
      </main>
    </div>
  );
}

export default QuotePage;

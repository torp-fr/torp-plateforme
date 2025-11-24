/**
 * Final CTA Section
 * Last conversion opportunity
 */

import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";

export const FinalCTA = () => {
  const { user } = useApp();
  const navigate = useNavigate();

  const handleCTA = () => {
    // Redirection directe vers l'analyse, sans wizard intermédiaire
    navigate('/analyze');
  };

  return (
    <section className="py-20 bg-gradient-to-br from-primary to-primary/80 text-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
      <div className="absolute top-10 right-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex">
            <div className="px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-semibold">Rejoignez +50K utilisateurs</span>
            </div>
          </div>

          {/* Headline */}
          <h2 className="text-4xl md:text-5xl font-bold leading-tight">
            Prêt à économiser sur vos travaux ?
          </h2>

          <p className="text-xl text-white/90 max-w-2xl mx-auto">
            Analysez votre devis en 3 minutes et découvrez comment économiser
            jusqu'à 30% sur vos projets de travaux.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button
              onClick={handleCTA}
              size="lg"
              variant="secondary"
              className="bg-white text-primary hover:bg-white/90 text-lg h-14 px-8 group"
            >
              Analyser mon devis gratuitement
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              onClick={() => navigate('/pricing')}
              size="lg"
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10 text-lg h-14 px-8"
            >
              Voir les tarifs
            </Button>
          </div>

          {/* Trust signals */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-8 text-white/80">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-sm">4.9/5 sur 2 547 avis</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="text-sm">Données sécurisées (RGPD)</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm">Sans engagement</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

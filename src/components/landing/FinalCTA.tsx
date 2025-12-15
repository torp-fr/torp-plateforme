/**
 * Final CTA Section - Refonte
 * Message positif aligné avec la vision TORP
 */

import { Button } from "@/components/ui/button";
import { ArrowRight, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";

export const FinalCTA = () => {
  const { user } = useApp();
  const navigate = useNavigate();

  const handleCTA = () => {
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
              <Shield className="h-4 w-4" />
              <span className="text-sm font-semibold">Transparence et confiance</span>
            </div>
          </div>

          {/* Headline */}
          <h2 className="text-4xl md:text-5xl font-bold leading-tight">
            Prêt à construire en toute confiance ?
          </h2>

          <p className="text-xl text-white/90 max-w-2xl mx-auto">
            Rejoignez TORP et participez à une nouvelle ère de transparence dans le BTP.
            Des devis clairs pour des projets réussis.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button
              onClick={handleCTA}
              size="lg"
              variant="secondary"
              className="bg-white text-primary hover:bg-white/90 text-lg h-14 px-8 group"
            >
              Analyser un devis
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
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-sm">Transparent</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="text-sm">Sécurisé (RGPD)</span>
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

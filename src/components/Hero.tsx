/**
 * Hero Component - Version professionnelle
 * Message centré sur le produit et sa valeur ajoutée concrète
 */

import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, FileSearch, Users, Award, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import heroImage from "@/assets/hero-image.jpg";
import { BRANDING } from "@/config/branding";

export const Hero = () => {
  const { user } = useApp();
  const navigate = useNavigate();

  const handleCTA = () => {
    navigate('/analyze');
  };

  return (
    <section className="relative bg-gradient-to-br from-background via-primary/5 to-background py-16 lg:py-24 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      <div className="absolute top-20 right-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl"></div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column - Content */}
          <div className="space-y-8 animate-fade-in">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <img src={BRANDING.logoPrimary} alt="TORP" className="h-12 w-auto" />
              <span className="text-2xl font-bold text-primary">TORP</span>
            </div>

            {/* Headline */}
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
                Votre assistant technique pour{" "}
                <span className="text-primary">comprendre et valider</span>{" "}
                vos devis
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl">
                TORP analyse et vulgarise les aspects techniques de vos devis, valorise les
                entreprises compétentes, et vous aide à prendre des décisions éclairées en toute confiance.
              </p>
            </div>

            {/* Value Props */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0 mt-1" />
                <div>
                  <span className="text-sm font-semibold text-foreground">Expertise accessible</span>
                  <p className="text-sm text-muted-foreground">Vulgarisation technique pour comprendre chaque poste</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0 mt-1" />
                <div>
                  <span className="text-sm font-semibold text-foreground">Valorisation des pros compétents</span>
                  <p className="text-sm text-muted-foreground">Identification des entreprises sérieuses et qualifiées</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0 mt-1" />
                <div>
                  <span className="text-sm font-semibold text-foreground">Transparence totale</span>
                  <p className="text-sm text-muted-foreground">Analyse claire des prix, délais et conformité technique</p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <Button
                onClick={() => navigate('/phase0')}
                size="lg"
                className="bg-primary hover:bg-primary/90 text-lg h-14 px-8 group"
              >
                <FileText className="mr-2 h-5 w-5" />
                Définir mon projet
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                onClick={handleCTA}
                size="lg"
                variant="outline"
                className="text-lg h-14 px-8 group"
              >
                Analyser un devis
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>

            {/* Sub-text */}
            <p className="text-sm text-muted-foreground">
              Commencez par définir votre projet pour obtenir des devis adaptés, ou analysez directement vos devis existants.
            </p>
          </div>

          {/* Right Column - Visual */}
          <div className="relative lg:block animate-fade-in">
            {/* Main image */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-accent/20 rounded-2xl transform rotate-3"></div>
              <img
                src={heroImage}
                alt="TORP - Analyse de devis"
                className="relative rounded-2xl shadow-2xl border border-border/50"
              />

              {/* Floating card 1 - Compréhension */}
              <div className="absolute -top-4 -right-4 bg-background rounded-xl p-4 shadow-xl border border-border/50 animate-float">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <FileSearch className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Compréhension</div>
                    <div className="text-xs text-muted-foreground">Technique simplifiée</div>
                  </div>
                </div>
              </div>

              {/* Floating card 2 - Valorisation */}
              <div className="absolute -bottom-6 -left-6 bg-background rounded-xl p-4 shadow-xl border border-border/50 animate-float-delayed hidden sm:block">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                    <Award className="h-6 w-6 text-orange-500" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Valorisation</div>
                    <div className="text-xs text-muted-foreground">Pros compétents</div>
                  </div>
                </div>
              </div>

              {/* Floating card 3 - Confiance */}
              <div className="absolute top-1/2 -left-8 bg-background rounded-xl p-3 shadow-xl border border-border/50 animate-float hidden lg:block">
                <div className="flex flex-col items-center gap-1">
                  <Users className="h-8 w-8 text-success" />
                  <div className="text-xs font-semibold text-center">Confiance</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        @keyframes float-delayed {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }

        .animate-float-delayed {
          animation: float-delayed 3s ease-in-out infinite;
          animation-delay: 1s;
        }
      `}</style>
    </section>
  );
};

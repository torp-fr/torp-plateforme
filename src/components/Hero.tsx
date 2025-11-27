/**
 * Hero Component - Refonte complète
 * Message positif rassemblant B2C et B2B autour de la confiance
 */

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Shield, Users, CheckCircle2, FileText } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import heroImage from "@/assets/hero-image.jpg";

export const Hero = () => {
  const { user } = useApp();
  const navigate = useNavigate();

  const handleCTA = () => {
    navigate('/analyze');
  };

  return (
    <section className="relative bg-gradient-to-br from-primary/5 via-background to-primary/5 py-20 lg:py-32 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      <div className="absolute top-20 right-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl"></div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column - Content */}
          <div className="space-y-8 animate-fade-in">
            {/* Badge */}
            <div className="inline-flex">
              <Badge variant="secondary" className="gap-2 py-2 px-4">
                <Shield className="h-4 w-4" />
                Transparence et Confiance
              </Badge>
            </div>

            {/* Headline */}
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
                Une vision partagée pour des{" "}
                <span className="text-primary">devis justes</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl">
                TORP réunit particuliers et professionnels du BTP autour d'un objectif commun :
                établir la confiance grâce à des devis clairs, transparents et équitables.
              </p>
            </div>

            {/* Value Props */}
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                <span className="text-sm font-medium">Transparent</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                <span className="text-sm font-medium">Pour tous</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                <span className="text-sm font-medium">Simple</span>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                onClick={handleCTA}
                size="lg"
                className="bg-primary hover:bg-primary/90 text-lg h-14 px-8 group"
              >
                Analyser un devis
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Link to="/demo">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-14 px-8 text-lg"
                >
                  Voir la démo
                </Button>
              </Link>
            </div>

            {/* Vision statement */}
            <div className="pt-4 border-t border-border/50">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">
                    Notre mission
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Créer un écosystème où particuliers et professionnels travaillent ensemble
                    en toute confiance, avec des devis transparents qui bénéficient à tous.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Visual */}
          <div className="relative lg:block animate-fade-in">
            {/* Main image */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-accent/20 rounded-2xl transform rotate-3"></div>
              <img
                src={heroImage}
                alt="TORP - Transparence dans les devis"
                className="relative rounded-2xl shadow-2xl border border-border/50"
              />

              {/* Floating card 1 - Trust */}
              <div className="absolute -top-4 -right-4 bg-background rounded-xl p-4 shadow-xl border border-border/50 animate-float">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                    <Shield className="h-6 w-6 text-success" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Confiance</div>
                    <div className="text-xs text-muted-foreground">Partagée</div>
                  </div>
                </div>
              </div>

              {/* Floating card 2 - Transparency */}
              <div className="absolute -bottom-6 -left-6 bg-background rounded-xl p-4 shadow-xl border border-border/50 animate-float-delayed hidden sm:block">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Transparence</div>
                    <div className="text-xs text-muted-foreground">Totale</div>
                  </div>
                </div>
              </div>

              {/* Floating card 3 - Community */}
              <div className="absolute top-1/2 -left-8 bg-background rounded-xl p-3 shadow-xl border border-border/50 animate-float hidden lg:block">
                <div className="flex flex-col items-center gap-1">
                  <Users className="h-8 w-8 text-primary" />
                  <div className="text-xs font-semibold">Ensemble</div>
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

/**
 * Optimized Hero Component
 * Clear value proposition with single CTA
 */

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Sparkles, Shield, TrendingUp, CheckCircle2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import heroImage from "@/assets/hero-image.jpg";

export const Hero = () => {
  const { user } = useApp();
  const navigate = useNavigate();

  const handleCTA = () => {
    if (user) {
      navigate('/analyze');
    } else {
      navigate('/discovery');
    }
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
                <Sparkles className="h-4 w-4" />
                Analyse par Intelligence Artificielle
              </Badge>
            </div>

            {/* Headline */}
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
                Ne vous faites plus{" "}
                <span className="text-primary">arnaquer</span> par vos devis de travaux
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl">
                TORP analyse vos devis en 3 minutes avec l'IA et vous dit si le prix est juste,
                si l'entreprise est fiable et comment négocier.
              </p>
            </div>

            {/* Value Props */}
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                <span className="text-sm font-medium">Gratuit</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                <span className="text-sm font-medium">3 minutes</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                <span className="text-sm font-medium">Sans engagement</span>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                onClick={handleCTA}
                size="lg"
                className="bg-primary hover:bg-primary/90 text-lg h-14 px-8 group"
              >
                Analyser mon devis gratuitement
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

            {/* Social Proof */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pt-4">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-sm font-semibold"
                  >
                    {i === 1 ? '👨' : i === 2 ? '👩' : i === 3 ? '🧑' : i === 4 ? '👴' : '👵'}
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1 text-yellow-500">
                  {'★'.repeat(5)}
                </div>
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">2 547</span> devis analysés ce mois-ci
                </p>
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
                alt="Analyse de devis TORP"
                className="relative rounded-2xl shadow-2xl border border-border/50"
              />

              {/* Floating card 1 - Score */}
              <div className="absolute -top-4 -right-4 bg-background rounded-xl p-4 shadow-xl border border-border/50 animate-float">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                    <span className="text-2xl font-bold text-success">A</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Score TORP</div>
                    <div className="text-xs text-muted-foreground">850/1000 pts</div>
                  </div>
                </div>
              </div>

              {/* Floating card 2 - Savings */}
              <div className="absolute -bottom-6 -left-6 bg-background rounded-xl p-4 shadow-xl border border-border/50 animate-float-delayed hidden sm:block">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Économie détectée</div>
                    <div className="text-lg font-bold text-primary">-1 850€</div>
                  </div>
                </div>
              </div>

              {/* Floating card 3 - Security */}
              <div className="absolute top-1/2 -left-8 bg-background rounded-xl p-3 shadow-xl border border-border/50 animate-float hidden lg:block">
                <div className="flex flex-col items-center gap-1">
                  <Shield className="h-8 w-8 text-success" />
                  <div className="text-xs font-semibold">Certifié</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16 pt-16 border-t border-border/50">
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-primary">50K+</div>
            <div className="text-sm text-muted-foreground mt-1">Devis analysés</div>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-primary">2M€</div>
            <div className="text-sm text-muted-foreground mt-1">Économisés</div>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-primary">98%</div>
            <div className="text-sm text-muted-foreground mt-1">Satisfaction</div>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-primary">3min</div>
            <div className="text-sm text-muted-foreground mt-1">Analyse moyenne</div>
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

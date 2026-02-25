/**
 * TORP Landing Page
 * Plateforme BTP - Phase 1: Valorisation de devis
 * Fond clair et moderne, no auth pour dev
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  BarChart3,
  Menu,
  X,
  Zap,
  TrendingUp,
  Clock,
  Target,
  ChevronRight,
  Lightbulb,
  Shield,
  Brain,
} from 'lucide-react';

export function LandingPage() {
  const navigate = useNavigate();
  const { user } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    {
      number: '01',
      title: 'Structurez votre devis',
      description:
        'Questionnaire guidé pour structurer chaque élément: postes, travaux, détails techniques',
      icon: FileText,
      color: 'bg-gradient-primary',
    },
    {
      number: '02',
      title: 'Validez le chiffrage',
      description:
        'Vérifiez que tous les postes sont inclus et bien chiffrés vs standards du marché',
      icon: BarChart3,
      color: 'bg-gradient-primary',
    },
    {
      number: '03',
      title: 'Valorisez votre expertise',
      description:
        'Suggestions pour mieux mettre en avant votre savoir-faire et qualifications',
      icon: TrendingUp,
      color: 'bg-gradient-primary',
    },
    {
      number: '04',
      title: 'Gagnez du temps',
      description: 'Générez automatiquement les sections manquantes - focus sur les chantiers',
      icon: Clock,
      color: 'bg-gradient-primary',
    },
  ];

  const benefits = [
    {
      title: 'Zéro oubli',
      description:
        'Grille complète qui garantit qu\'aucun poste n\'est oublié - meilleure couverture budgétaire',
      icon: CheckCircle2,
    },
    {
      title: 'Meilleur chiffrage',
      description:
        'Comparaison avec les standards de votre secteur et région - prix justifiés et compétitifs',
      icon: BarChart3,
    },
    {
      title: 'Valorisation expertise',
      description:
        'Descriptions techniques qui mettent en avant qualifications, expérience et compétences',
      icon: Lightbulb,
    },
    {
      title: '-2h par devis',
      description: 'Réduisez drastiquement le temps de rédaction - plus de temps sur les chantiers',
      icon: Clock,
    },
    {
      title: '+35% taux acceptation',
      description: 'Devis structurés, complets et professionnels inspirent confiance aux clients',
      icon: Target,
    },
    {
      title: 'Meilleure trésorerie',
      description:
        'Moins de devis incomplets = moins de litiges = flux de trésorerie plus régulier',
      icon: TrendingUp,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 w-full backdrop-blur-md bg-background/80 z-50 border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center shadow-md">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-foreground">TORP</span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <a
              href="#features"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              Comment ça marche
            </a>
            <a
              href="#benefits"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              Avantages
            </a>
          </nav>

          <div className="hidden md:flex items-center gap-4">
            {!user && (
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Connexion
                </Button>
              </Link>
            )}
            <Button
              onClick={() => navigate('/quote')}
              className="gradient-primary text-primary-foreground border-0 font-display"
            >
              Commencer maintenant
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <button
            className="md:hidden p-2 text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-background border-t border-border p-4 space-y-4">
            <a href="#features" className="block text-sm text-muted-foreground font-medium">
              Comment ça marche
            </a>
            <a href="#benefits" className="block text-sm text-muted-foreground font-medium">
              Avantages
            </a>
            <div className="pt-4 border-t border-border space-y-3">
              {!user && (
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full">
                    Connexion
                  </Button>
                </Link>
              )}
              <Button
                onClick={() => navigate('/quote')}
                className="w-full gradient-primary text-primary-foreground border-0"
              >
                Commencer maintenant
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 gradient-dark opacity-95" />
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23c4703c\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }}
        />
        <div className="container mx-auto px-6 relative z-10 text-center max-w-4xl">
          <Badge className="mb-4 bg-orange-100/20 text-orange-100 border-orange-300/30 font-display">
            <Zap className="h-3 w-3 mr-2" />
            Plateforme BTP - Phase 1
          </Badge>

          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight text-white">
            Vos devis,
            <br />
            <span className="text-gradient">mieux valorisés</span>
          </h1>

          <p className="text-xl md:text-2xl text-white/70 mb-4 font-medium">Structurez, validez, valorisez.</p>

          <p className="text-lg text-white/60 mb-10">
            L'outil quotidien pour faire de meilleurs devis, plus complets, mieux chiffrés.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button
              size="lg"
              onClick={() => navigate('/quote')}
              className="text-lg px-8 gradient-primary text-primary-foreground border-0 font-display shadow-lg hover:shadow-xl transition-shadow"
            >
              Essayer maintenant
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 border-white/20 text-white hover:bg-white/10 font-display"
              onClick={() => navigate('/quote')}
            >
              Voir la démo (3 min)
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 md:gap-8 pt-8 border-t border-white/20">
            <div>
              <div className="text-3xl md:text-4xl font-bold text-gradient">+35%</div>
              <div className="text-sm text-white/60 mt-2 font-medium">Taux acceptation</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-gradient">-2h</div>
              <div className="text-sm text-white/60 mt-2 font-medium">Par devis</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-gradient">+€</div>
              <div className="text-sm text-white/60 mt-2 font-medium">Meilleure tréso</div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 bg-background">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-4 text-foreground">
              Comment ça marche
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-medium">
              Quatre étapes pour structurer et valoriser chaque devis
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div key={idx} className="relative">
                  {idx < features.length - 1 && (
                    <div className="hidden lg:block absolute top-1/4 -right-3 text-border">
                      <ChevronRight className="h-6 w-6" />
                    </div>
                  )}

                  <Card className="bg-card border-border h-full hover:shadow-lg hover:border-primary/40 transition-all">
                    <CardHeader>
                      <div className="flex items-start justify-between mb-4">
                        <span className="text-3xl font-display font-bold text-border/50">
                          {feature.number}
                        </span>
                        <div className={`h-10 w-10 rounded-lg ${feature.color} flex items-center justify-center shadow-md`}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                      </div>
                      <CardTitle className="text-foreground font-display">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground text-sm">{feature.description}</p>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section id="benefits" className="py-20 px-6 bg-card">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-4 text-foreground">
              Les bénéfices concrets
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-medium">
              Pour votre chiffre d'affaires, votre trésorerie et votre temps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((benefit, idx) => {
              const Icon = benefit.icon;
              return (
                <Card
                  key={idx}
                  className="bg-background border-border hover:shadow-lg hover:border-primary/40 transition-all"
                >
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg gradient-primary flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <CardTitle className="text-foreground font-display">{benefit.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm">{benefit.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-background">
        <div className="container mx-auto max-w-3xl">
          <div className="rounded-2xl gradient-dark p-12 text-center relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-5"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(196,112,60,0.3) 35px, rgba(196,112,60,0.3) 36px)',
              }}
            />
            <div className="relative z-10">
              <h2 className="font-display text-3xl font-bold text-white mb-4">
                Prêt à valoriser vos devis?
              </h2>
              <p className="text-white/60 mb-8">
                7 jours d'essai gratuit. Pas de carte bancaire. Annulation facile.
              </p>
              <Button
                size="lg"
                onClick={() => navigate('/quote')}
                className="text-lg px-8 gradient-primary text-primary-foreground border-0 font-display shadow-lg"
              >
                Commencer maintenant
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-card border-t border-border">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center shadow-md">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="font-display font-bold text-xl text-foreground">TORP</span>
            </div>
            <div className="flex gap-8 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors font-medium">
                Conditions
              </a>
              <a href="#" className="hover:text-foreground transition-colors font-medium">
                Confidentialité
              </a>
              <a href="#" className="hover:text-foreground transition-colors font-medium">
                Contact
              </a>
            </div>
            <p className="text-sm text-muted-foreground">© 2025 TORP - Plateforme BTP</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;

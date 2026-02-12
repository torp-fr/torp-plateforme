/**
 * Quote-Insight Landing Page
 * Outil de valorisation de devis pour entreprises/artisans
 * "Meilleur chiffrage, pas d'oublis, valorisation de l'expertise"
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
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
  AlertCircle,
} from 'lucide-react';

export function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    {
      number: '01',
      title: 'Structurez votre devis',
      description: 'Questionnaire guidé pour structurer chaque élément: postes, travaux, détails techniques',
      icon: FileText,
      color: 'bg-blue-500',
    },
    {
      number: '02',
      title: 'Validez le chiffrage',
      description: 'Vérifiez que tous les postes sont inclus et bien chiffrés vs standards du marché',
      icon: BarChart3,
      color: 'bg-purple-500',
    },
    {
      number: '03',
      title: 'Valorisez votre expertise',
      description: 'Suggestions pour mieux mettre en avant votre savoir-faire et qualifications',
      icon: TrendingUp,
      color: 'bg-green-500',
    },
    {
      number: '04',
      title: 'Gagnez du temps',
      description: 'Générez automatiquement les sections manquantes - focus sur les chantiers',
      icon: Clock,
      color: 'bg-orange-500',
    },
  ];

  const benefits = [
    {
      title: 'Zéro oubli',
      description: 'Grille complète qui garantit qu\'aucun poste n\'est oublié - meilleure couverture budgétaire',
      icon: CheckCircle2,
    },
    {
      title: 'Meilleur chiffrage',
      description: 'Comparaison avec les standards de votre secteur et région - prix justifiés et compétitifs',
      icon: BarChart3,
    },
    {
      title: 'Valorisation expertise',
      description: 'Descriptions techniques qui mettent en avant qualifications, expérience et compétences',
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
      description: 'Moins de devis incomplets = moins de litiges = flux de trésorerie plus régulier',
      icon: TrendingUp,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-white">
      {/* Header */}
      <header className="fixed top-0 w-full bg-slate-950/80 backdrop-blur-md z-50 border-b border-slate-800">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl">Quote-Insight</span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-slate-300 hover:text-white transition-colors">
              Comment ça marche
            </a>
            <a href="#benefits" className="text-sm text-slate-300 hover:text-white transition-colors">
              Avantages
            </a>
            <a href="#pricing" className="text-sm text-slate-300 hover:text-white transition-colors">
              Tarifs
            </a>
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <Link to="/login">
              <Button variant="ghost" className="text-slate-300 hover:text-white">
                Connexion
              </Button>
            </Link>
            <Link to="/register">
              <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600">
                Essayer gratuitement
              </Button>
            </Link>
          </div>

          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-900 border-t border-slate-800 p-4 space-y-4">
            <a href="#features" className="block text-sm text-slate-300">
              Comment ça marche
            </a>
            <a href="#benefits" className="block text-sm text-slate-300">
              Avantages
            </a>
            <a href="#pricing" className="block text-sm text-slate-300">
              Tarifs
            </a>
            <div className="pt-4 border-t border-slate-800 space-y-2">
              <Link to="/login" className="block">
                <Button variant="outline" className="w-full border-slate-700 text-white hover:bg-slate-800">
                  Connexion
                </Button>
              </Link>
              <Link to="/register" className="block">
                <Button className="w-full bg-gradient-to-r from-blue-500 to-cyan-500">
                  Essayer gratuitement
                </Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6">
        <div className="container mx-auto text-center max-w-4xl">
          <Badge className="mb-4 bg-slate-800 text-cyan-400 border-cyan-500/30">
            <Zap className="h-3 w-3 mr-2" />
            Pour les entreprises et artisans
          </Badge>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Vos devis,
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              mieux valorisés
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-slate-300 mb-4">
            Structurez, validez, valorisez.
          </p>

          <p className="text-lg text-slate-400 mb-10">
            L'outil quotidien pour faire de meilleurs devis, plus complets, mieux chiffrés.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link to="/register">
              <Button size="lg" className="text-lg px-8 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600">
                Essayer gratuitement
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 border-slate-600 text-white hover:bg-slate-800"
            >
              Voir la démo (3 min)
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 md:gap-8 pt-8 border-t border-slate-800/50">
            <div>
              <div className="text-3xl md:text-4xl font-bold text-cyan-400">+35%</div>
              <div className="text-sm text-slate-400 mt-2">Taux acceptation</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-cyan-400">-2h</div>
              <div className="text-sm text-slate-400 mt-2">Par devis</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-cyan-400">+€</div>
              <div className="text-sm text-slate-400 mt-2">Meilleure tréso</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 bg-slate-900/50">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Comment ça marche</h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              Quatre étapes pour structurer et valoriser chaque devis
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div key={idx} className="relative">
                  {idx < features.length - 1 && (
                    <div className="hidden lg:block absolute top-1/4 -right-3 text-slate-600">
                      <ChevronRight className="h-6 w-6" />
                    </div>
                  )}

                  <Card className="bg-slate-800/50 border-slate-700 h-full hover:bg-slate-800 transition-colors">
                    <CardHeader>
                      <div className="flex items-start justify-between mb-4">
                        <span className="text-3xl font-bold text-slate-500">{feature.number}</span>
                        <div className={`h-10 w-10 rounded-lg ${feature.color} flex items-center justify-center`}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                      </div>
                      <CardTitle className="text-white">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-slate-300 text-sm">{feature.description}</p>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section id="benefits" className="py-20 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Les bénéfices concrets</h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              Pour votre chiffre d'affaires, votre trésorerie et votre temps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((benefit, idx) => {
              const Icon = benefit.icon;
              return (
                <Card key={idx} className="bg-slate-800/50 border-slate-700 hover:bg-slate-800/80 transition-all hover:border-cyan-500/30">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6 text-cyan-400" />
                    </div>
                    <CardTitle className="text-white">{benefit.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-300 text-sm">{benefit.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6 bg-slate-900/50">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Tarification simple</h2>
            <p className="text-lg text-slate-300">
              De l'artisan indépendant à la grande entreprise
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Solo */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-xl">Solo</CardTitle>
                <CardDescription>Artisans indépendants</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold mb-1 text-cyan-400">Gratuit</div>
                <p className="text-sm text-slate-400 mb-6">pour toujours</p>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start gap-2 text-slate-300 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <span>Jusqu'à 10 devis/mois</span>
                  </li>
                  <li className="flex items-start gap-2 text-slate-300 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <span>Toutes les fonctionnalités</span>
                  </li>
                  <li className="flex items-start gap-2 text-slate-300 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <span>Support par email</span>
                  </li>
                </ul>
                <Button className="w-full bg-slate-700 hover:bg-slate-600 text-white">
                  Commencer
                </Button>
              </CardContent>
            </Card>

            {/* Pro */}
            <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-cyan-500/30 relative">
              <div className="absolute top-0 right-0 bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-3 py-1 text-xs font-bold rounded-bl-lg">
                POPULAIRE
              </div>
              <CardHeader>
                <CardTitle className="text-white text-xl">Pro</CardTitle>
                <CardDescription>PME et petites équipes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold mb-2 text-cyan-400">49€</div>
                <p className="text-xs text-slate-400 mb-6">par mois (ou 490€/an -17%)</p>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start gap-2 text-slate-300 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <span>Devis illimités</span>
                  </li>
                  <li className="flex items-start gap-2 text-slate-300 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <span>Historique complet</span>
                  </li>
                  <li className="flex items-start gap-2 text-slate-300 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <span>2 utilisateurs</span>
                  </li>
                  <li className="flex items-start gap-2 text-slate-300 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <span>Support prioritaire</span>
                  </li>
                </ul>
                <Button className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white">
                  Essayer 7j gratuit
                </Button>
              </CardContent>
            </Card>

            {/* Enterprise */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-xl">Enterprise</CardTitle>
                <CardDescription>Grandes structures</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-6 text-slate-400">Sur demande</div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start gap-2 text-slate-300 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <span>Tout illimité</span>
                  </li>
                  <li className="flex items-start gap-2 text-slate-300 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <span>Utilisateurs illimités</span>
                  </li>
                  <li className="flex items-start gap-2 text-slate-300 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <span>API & intégrations</span>
                  </li>
                  <li className="flex items-start gap-2 text-slate-300 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <span>Support 24/7 dédié</span>
                  </li>
                </ul>
                <Button variant="outline" className="w-full border-slate-600 text-white hover:bg-slate-800">
                  Nous contacter
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-3xl">
          <Card className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-cyan-500/30 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-cyan-500/10" />
            <CardContent className="pt-12 pb-12 text-center relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Prêt à valoriser vos devis?
              </h2>
              <p className="text-lg text-slate-300 mb-8">
                7 jours d'essai gratuit. Pas de carte bancaire. Annulation facile.
              </p>
              <Link to="/register">
                <Button size="lg" className="text-lg px-8 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600">
                  Commencer maintenant
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-slate-800 bg-slate-950/50">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-xl">Quote-Insight</span>
            </div>
            <div className="flex gap-8 text-sm text-slate-400">
              <a href="#" className="hover:text-white transition-colors">
                Conditions
              </a>
              <a href="#" className="hover:text-white transition-colors">
                Confidentialité
              </a>
              <a href="#" className="hover:text-white transition-colors">
                Contact
              </a>
            </div>
            <p className="text-sm text-slate-500">
              © 2025 Quote-Insight - Valorisez vos devis
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;

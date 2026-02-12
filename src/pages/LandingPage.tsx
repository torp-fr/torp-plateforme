/**
 * TORP Landing Page
 * Plateforme BTP - Phase 1: Valorisation de devis
 * Fond clair et moderne, no auth pour dev
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from 'lucide-react';

export function LandingPage() {
  const navigate = useNavigate();
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
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-cyan-50">
      {/* Header */}
      <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-blue-100/30 shadow-sm">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center shadow-md">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl text-slate-900">TORP</span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-slate-600 hover:text-blue-600 transition-colors font-medium">
              Comment ça marche
            </a>
            <a href="#benefits" className="text-sm text-slate-600 hover:text-blue-600 transition-colors font-medium">
              Avantages
            </a>
            <a href="#pricing" className="text-sm text-slate-600 hover:text-blue-600 transition-colors font-medium">
              Tarifs
            </a>
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <Button
              onClick={() => navigate('/quote')}
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-md"
            >
              Commencer maintenant
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <button
            className="md:hidden p-2 text-slate-900"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-blue-100/30 p-4 space-y-4">
            <a href="#features" className="block text-sm text-slate-600 font-medium">
              Comment ça marche
            </a>
            <a href="#benefits" className="block text-sm text-slate-600 font-medium">
              Avantages
            </a>
            <a href="#pricing" className="block text-sm text-slate-600 font-medium">
              Tarifs
            </a>
            <div className="pt-4 border-t border-blue-100/30">
              <Button
                onClick={() => navigate('/quote')}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white"
              >
                Commencer maintenant
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6">
        <div className="container mx-auto text-center max-w-4xl">
          <Badge className="mb-4 bg-blue-100 text-blue-700 border-blue-300/50">
            <Zap className="h-3 w-3 mr-2" />
            Plateforme BTP - Phase 1
          </Badge>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600 bg-clip-text text-transparent">
            Vos devis,
            <br />
            mieux valorisés
          </h1>

          <p className="text-xl md:text-2xl text-slate-700 mb-4 font-medium">
            Structurez, validez, valorisez.
          </p>

          <p className="text-lg text-slate-600 mb-10">
            L'outil quotidien pour faire de meilleurs devis, plus complets, mieux chiffrés.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button
              size="lg"
              onClick={() => navigate('/quote')}
              className="text-lg px-8 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg hover:shadow-xl transition-shadow"
            >
              Essayer maintenant
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 border-blue-300 text-blue-700 hover:bg-blue-50"
              onClick={() => navigate('/quote')}
            >
              Voir la démo (3 min)
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 md:gap-8 pt-8 border-t border-blue-200/50">
            <div>
              <div className="text-3xl md:text-4xl font-bold text-blue-600">+35%</div>
              <div className="text-sm text-slate-600 mt-2 font-medium">Taux acceptation</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-blue-600">-2h</div>
              <div className="text-sm text-slate-600 mt-2 font-medium">Par devis</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-blue-600">+€</div>
              <div className="text-sm text-slate-600 mt-2 font-medium">Meilleure tréso</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 bg-gradient-to-r from-white to-blue-50">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900">Comment ça marche</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto font-medium">
              Quatre étapes pour structurer et valoriser chaque devis
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div key={idx} className="relative">
                  {idx < features.length - 1 && (
                    <div className="hidden lg:block absolute top-1/4 -right-3 text-blue-300">
                      <ChevronRight className="h-6 w-6" />
                    </div>
                  )}

                  <Card className="bg-white border-blue-200/50 h-full hover:shadow-lg hover:border-blue-300/50 transition-all">
                    <CardHeader>
                      <div className="flex items-start justify-between mb-4">
                        <span className="text-3xl font-bold text-blue-200">{feature.number}</span>
                        <div className={`h-10 w-10 rounded-lg ${feature.color} flex items-center justify-center shadow-md`}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                      </div>
                      <CardTitle className="text-slate-900">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-slate-600 text-sm">{feature.description}</p>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section id="benefits" className="py-20 px-6 bg-gradient-to-r from-cyan-50 to-white">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900">Les bénéfices concrets</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto font-medium">
              Pour votre chiffre d'affaires, votre trésorerie et votre temps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((benefit, idx) => {
              const Icon = benefit.icon;
              return (
                <Card key={idx} className="bg-white border-blue-200/50 hover:shadow-lg hover:border-blue-300/50 transition-all">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6 text-blue-600" />
                    </div>
                    <CardTitle className="text-slate-900">{benefit.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-600 text-sm">{benefit.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6 bg-white">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900">Tarification simple</h2>
            <p className="text-lg text-slate-600">
              De l'artisan indépendant à la grande entreprise
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Solo */}
            <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200/50 hover:shadow-lg transition-all">
              <CardHeader>
                <CardTitle className="text-slate-900 text-xl">Solo</CardTitle>
                <CardDescription className="text-slate-600">Artisans indépendants</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold mb-1 text-blue-600">Gratuit</div>
                <p className="text-sm text-slate-600 mb-6 font-medium">pour toujours</p>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start gap-2 text-slate-700 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>Jusqu'à 10 devis/mois</span>
                  </li>
                  <li className="flex items-start gap-2 text-slate-700 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>Toutes les fonctionnalités</span>
                  </li>
                  <li className="flex items-start gap-2 text-slate-700 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>Support par email</span>
                  </li>
                </ul>
                <Button className="w-full bg-slate-200 hover:bg-slate-300 text-slate-900">
                  Commencer
                </Button>
              </CardContent>
            </Card>

            {/* Pro */}
            <Card className="bg-gradient-to-br from-blue-600 to-cyan-600 border-blue-500 relative shadow-lg">
              <div className="absolute top-0 right-0 bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 py-1 text-xs font-bold rounded-bl-lg shadow-md">
                POPULAIRE
              </div>
              <CardHeader>
                <CardTitle className="text-white text-xl">Pro</CardTitle>
                <CardDescription className="text-blue-100">PME et petites équipes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold mb-2 text-white">49€</div>
                <p className="text-xs text-blue-100 mb-6 font-medium">par mois (ou 490€/an -17%)</p>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start gap-2 text-white text-sm">
                    <CheckCircle2 className="h-5 w-5 text-blue-200 flex-shrink-0 mt-0.5" />
                    <span>Devis illimités</span>
                  </li>
                  <li className="flex items-start gap-2 text-white text-sm">
                    <CheckCircle2 className="h-5 w-5 text-blue-200 flex-shrink-0 mt-0.5" />
                    <span>Historique complet</span>
                  </li>
                  <li className="flex items-start gap-2 text-white text-sm">
                    <CheckCircle2 className="h-5 w-5 text-blue-200 flex-shrink-0 mt-0.5" />
                    <span>2 utilisateurs</span>
                  </li>
                  <li className="flex items-start gap-2 text-white text-sm">
                    <CheckCircle2 className="h-5 w-5 text-blue-200 flex-shrink-0 mt-0.5" />
                    <span>Support prioritaire</span>
                  </li>
                </ul>
                <Button className="w-full bg-white text-blue-600 hover:bg-blue-50 font-semibold">
                  Essayer 7j gratuit
                </Button>
              </CardContent>
            </Card>

            {/* Enterprise */}
            <Card className="bg-gradient-to-br from-slate-50 to-white border-blue-200/50 hover:shadow-lg transition-all">
              <CardHeader>
                <CardTitle className="text-slate-900 text-xl">Enterprise</CardTitle>
                <CardDescription className="text-slate-600">Grandes structures</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-6 text-slate-400">Sur demande</div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start gap-2 text-slate-700 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>Tout illimité</span>
                  </li>
                  <li className="flex items-start gap-2 text-slate-700 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>Utilisateurs illimités</span>
                  </li>
                  <li className="flex items-start gap-2 text-slate-700 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>API & intégrations</span>
                  </li>
                  <li className="flex items-start gap-2 text-slate-700 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>Support 24/7 dédié</span>
                  </li>
                </ul>
                <Button variant="outline" className="w-full border-blue-300 text-blue-600 hover:bg-blue-50 font-semibold">
                  Nous contacter
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-gradient-to-r from-blue-600 to-cyan-600">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
              Prêt à valoriser vos devis?
            </h2>
            <p className="text-lg text-blue-100 mb-8">
              7 jours d'essai gratuit. Pas de carte bancaire. Annulation facile.
            </p>
            <Button
              size="lg"
              onClick={() => navigate('/quote')}
              className="text-lg px-8 bg-white text-blue-600 hover:bg-blue-50 font-semibold shadow-lg"
            >
              Commencer maintenant
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-white border-t border-blue-100/30">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center shadow-md">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-xl text-slate-900">TORP</span>
            </div>
            <div className="flex gap-8 text-sm text-slate-600">
              <a href="#" className="hover:text-blue-600 transition-colors font-medium">
                Conditions
              </a>
              <a href="#" className="hover:text-blue-600 transition-colors font-medium">
                Confidentialité
              </a>
              <a href="#" className="hover:text-blue-600 transition-colors font-medium">
                Contact
              </a>
            </div>
            <p className="text-sm text-slate-500">
              © 2025 TORP - Plateforme BTP
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;

/**
 * TORP Landing Page - Version épurée
 * Présentation des 5 phases sans éléments marketing inventés
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  Send,
  Calendar,
  HardHat,
  Shield,
  Brain,
  Building2,
  Users,
  TrendingUp,
  FileText,
  ChevronRight,
  Sparkles,
  Target,
  Menu,
  X,
} from 'lucide-react';

export function LandingPage() {
  const [activeSegment, setActiveSegment] = useState('b2c');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const phases = [
    {
      number: 0,
      title: 'Conception',
      icon: Lightbulb,
      color: 'bg-yellow-500',
      description: 'Définissez votre projet',
      features: ['Qualification du projet', 'Génération CCTP', 'Estimation budget & aides'],
    },
    {
      number: 1,
      title: 'Consultation',
      icon: Send,
      color: 'bg-blue-500',
      description: 'Trouvez les entreprises',
      features: ['Recherche entreprises RGE', 'Analyse des offres', 'Génération contrats'],
    },
    {
      number: 2,
      title: 'Préparation',
      icon: Calendar,
      color: 'bg-purple-500',
      description: 'Planifiez le chantier',
      features: ['Planning Gantt', 'Checklist administrative', 'Coordination équipes'],
    },
    {
      number: 3,
      title: 'Exécution',
      icon: HardHat,
      color: 'bg-orange-500',
      description: 'Suivez les travaux',
      features: ['Suivi avancement', 'Contrôles qualité', 'Gestion financière'],
    },
    {
      number: 4,
      title: 'Réception',
      icon: Shield,
      color: 'bg-green-500',
      description: 'Réceptionnez et garanties',
      features: ['OPR', 'Gestion réserves', 'Suivi garanties'],
    },
  ];

  const segments = {
    b2c: {
      title: 'Particuliers',
      subtitle: 'Gérez votre projet de rénovation',
      description: 'TORP vous accompagne de la conception à la réception de votre projet.',
      benefits: [
        'Estimation budget',
        'Recherche entreprises',
        'Suivi de chantier',
        'Gestion garanties',
      ],
      link: '/login',
    },
    b2b: {
      title: 'Professionnels BTP',
      subtitle: 'Optimisez vos chantiers',
      description: 'Gérez vos projets, coordonnez vos équipes et suivez vos chantiers.',
      benefits: [
        'Gestion multi-projets',
        'Planning optimisé',
        'Coordination équipes',
        'Tableau de bord',
      ],
      link: '/pro',
    },
    b2g: {
      title: 'Collectivités',
      subtitle: 'Marchés publics',
      description: 'Conformité réglementaire et traçabilité pour vos projets publics.',
      benefits: [
        'DCE conformes',
        'Traçabilité',
        'Reporting',
        'Suivi marchés',
      ],
      link: '/login',
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold">T</span>
            </div>
            <span className="font-bold text-xl">TORP</span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#phases" className="text-sm hover:text-primary transition-colors">Phases</a>
            <a href="#segments" className="text-sm hover:text-primary transition-colors">Solutions</a>
            <a href="#ia" className="text-sm hover:text-primary transition-colors">IA</a>
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <Link to="/login">
              <Button variant="ghost">Connexion</Button>
            </Link>
            <Link to="/register">
              <Button>S'inscrire</Button>
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t p-4 space-y-4">
            <a href="#phases" className="block text-sm hover:text-primary" onClick={() => setMobileMenuOpen(false)}>Phases</a>
            <a href="#segments" className="block text-sm hover:text-primary" onClick={() => setMobileMenuOpen(false)}>Solutions</a>
            <a href="#ia" className="block text-sm hover:text-primary" onClick={() => setMobileMenuOpen(false)}>IA</a>
            <div className="pt-4 border-t space-y-2">
              <Link to="/login" className="block">
                <Button variant="outline" className="w-full">Connexion</Button>
              </Link>
              <Link to="/register" className="block">
                <Button className="w-full">S'inscrire</Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto text-center">
          <Badge className="mb-4" variant="secondary">
            <Sparkles className="h-3 w-3 mr-1" />
            Gestion de projets BTP
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Vos projets BTP
            <br />
            <span className="text-primary">maîtrisés de A à Z</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            TORP accompagne la gestion de vos projets de construction et rénovation,
            de la conception jusqu'à la fin des garanties.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/login">
              <Button size="lg" className="text-lg px-8 w-full sm:w-auto">
                Accéder à la plateforme
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Phases */}
      <section id="phases" className="py-20 px-6 bg-gray-50">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">5 phases de projet</h2>
            <p className="text-lg text-muted-foreground">
              Une plateforme unique pour tout le cycle de vie de votre projet
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {phases.map((phase) => {
              const Icon = phase.icon;
              return (
                <Card key={phase.number} className="relative overflow-hidden hover:shadow-lg transition-shadow">
                  <div className={`absolute top-0 left-0 w-full h-1 ${phase.color}`} />
                  <CardHeader className="pb-2">
                    <div className={`h-12 w-12 rounded-lg ${phase.color} flex items-center justify-center mb-2`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <span className="text-xl font-bold text-muted-foreground">0{phase.number}</span>
                      {phase.title}
                    </CardTitle>
                    <CardDescription className="text-sm">{phase.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {phase.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Segments */}
      <section id="segments" className="py-20 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Pour qui ?</h2>
          </div>

          <Tabs value={activeSegment} onValueChange={setActiveSegment} className="max-w-4xl mx-auto">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="b2c" className="flex items-center gap-2 text-xs md:text-sm">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Particuliers</span>
                <span className="sm:hidden">B2C</span>
              </TabsTrigger>
              <TabsTrigger value="b2b" className="flex items-center gap-2 text-xs md:text-sm">
                <Building2 className="h-4 w-4" />
                <span className="hidden sm:inline">Professionnels</span>
                <span className="sm:hidden">B2B</span>
              </TabsTrigger>
              <TabsTrigger value="b2g" className="flex items-center gap-2 text-xs md:text-sm">
                <Target className="h-4 w-4" />
                <span className="hidden sm:inline">Collectivités</span>
                <span className="sm:hidden">B2G</span>
              </TabsTrigger>
            </TabsList>

            {Object.entries(segments).map(([key, segment]) => (
              <TabsContent key={key} value={key}>
                <Card className="border-2">
                  <CardHeader>
                    <Badge className="w-fit mb-2">{segment.title}</Badge>
                    <CardTitle className="text-2xl md:text-3xl">{segment.subtitle}</CardTitle>
                    <CardDescription className="text-base md:text-lg">{segment.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid sm:grid-cols-2 gap-4 mb-6">
                      {segment.benefits.map((benefit, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg">
                          <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                          <span>{benefit}</span>
                        </div>
                      ))}
                    </div>
                    <Link to={segment.link}>
                      <Button size="lg" className="w-full md:w-auto">
                        Accéder
                        <ChevronRight className="ml-2 h-5 w-5" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </section>

      {/* AI Features */}
      <section id="ia" className="py-20 px-6 bg-gray-50">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="mb-4" variant="secondary">
                <Brain className="h-3 w-3 mr-1" />
                Intelligence Artificielle
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Fonctionnalités IA</h2>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Génération documentaire</h3>
                    <p className="text-muted-foreground">
                      CCTP, DCE, PV de réception générés automatiquement.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <Brain className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Analyse photos chantier</h3>
                    <p className="text-muted-foreground">
                      Vision par ordinateur pour l'analyse de l'avancement et de la qualité.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Suivi intelligent</h3>
                    <p className="text-muted-foreground">
                      Alertes et recommandations basées sur l'avancement du projet.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-8 flex items-center justify-center">
              <div className="text-center">
                <Brain className="h-20 md:h-24 w-20 md:w-24 mx-auto text-primary mb-4" />
                <p className="text-lg font-medium">IA intégrée à chaque phase</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="pt-12 pb-12 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Prêt à démarrer ?</h2>
              <p className="text-lg md:text-xl opacity-90 mb-8 max-w-2xl mx-auto">
                Connectez-vous pour accéder à la plateforme TORP.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/login">
                  <Button size="lg" variant="secondary" className="text-lg px-8 w-full sm:w-auto">
                    Connexion
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="lg" variant="outline" className="text-lg px-8 w-full sm:w-auto border-white text-white hover:bg-white/10">
                    S'inscrire
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold">T</span>
              </div>
              <span className="font-bold text-xl">TORP</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 TORP - Plateforme de gestion de projets BTP
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;

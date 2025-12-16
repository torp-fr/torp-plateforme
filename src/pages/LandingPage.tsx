/**
 * TORP Landing Page - Version complète avec 5 phases et IA
 * Page d'accueil optimisée pour la conversion
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
  Euro,
  Star,
  Play,
  ChevronRight,
  Sparkles,
  Target,
  Clock,
  Award,
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
      description: 'Définissez votre projet avec l\'IA',
      features: ['Qualification intelligente', 'Génération CCTP automatique', 'Estimation budget & aides'],
    },
    {
      number: 1,
      title: 'Consultation',
      icon: Send,
      color: 'bg-blue-500',
      description: 'Trouvez les meilleures entreprises',
      features: ['Matching entreprises RGE', 'Analyse comparative offres', 'Contrats sécurisés'],
    },
    {
      number: 2,
      title: 'Préparation',
      icon: Calendar,
      color: 'bg-purple-500',
      description: 'Planifiez votre chantier',
      features: ['Planning Gantt interactif', 'Checklist administrative', 'Coordination équipes'],
    },
    {
      number: 3,
      title: 'Exécution',
      icon: HardHat,
      color: 'bg-orange-500',
      description: 'Pilotez en temps réel',
      features: ['Suivi avancement', 'Contrôles qualité', 'Gestion financière'],
    },
    {
      number: 4,
      title: 'Réception',
      icon: Shield,
      color: 'bg-green-500',
      description: 'Réceptionnez sereinement',
      features: ['OPR guidée', 'Gestion réserves', 'Suivi garanties 10 ans'],
    },
  ];

  const segments = {
    b2c: {
      title: 'Particuliers',
      subtitle: 'Rénovez en toute confiance',
      description: 'Fini les mauvaises surprises ! TORP vous accompagne de A à Z dans votre projet de rénovation.',
      benefits: [
        'Estimation budget fiable',
        'Entreprises vérifiées',
        'Suivi en temps réel',
        'Protection juridique',
      ],
      cta: 'Estimer mon projet gratuitement',
      link: '/register',
    },
    b2b: {
      title: 'Professionnels BTP',
      subtitle: 'Gagnez en productivité',
      description: 'Automatisez vos devis, optimisez vos chantiers et fidélisez vos clients.',
      benefits: [
        'Génération devis IA',
        'Planning optimisé',
        'Gestion multi-chantiers',
        'Tableau de bord KPIs',
      ],
      cta: 'Demander une démo',
      link: '/pro',
    },
    b2g: {
      title: 'Collectivités',
      subtitle: 'Marchés publics simplifiés',
      description: 'Conformité réglementaire et traçabilité totale pour vos projets publics.',
      benefits: [
        'DCE conformes',
        'Traçabilité complète',
        'Reporting automatique',
        'Observatoire prix',
      ],
      cta: 'Contacter notre équipe',
      link: '/register',
    },
  };

  const stats = [
    { value: '50k€', label: 'Économies moyennes', icon: Euro },
    { value: '85%', label: 'Temps gagné', icon: Clock },
    { value: '4.8/5', label: 'Satisfaction client', icon: Star },
    { value: '100%', label: 'Entreprises vérifiées', icon: Award },
  ];

  const testimonials = [
    {
      quote: "TORP m'a permis d'économiser 30% sur ma rénovation énergétique. L'analyse des devis est bluffante.",
      author: 'Marie D.',
      role: 'Propriétaire, Lyon',
      avatar: 'M',
    },
    {
      quote: "En tant qu'architecte, je recommande TORP à tous mes clients. Le suivi de chantier est impeccable.",
      author: 'Jean-Pierre L.',
      role: 'Architecte DPLG',
      avatar: 'JP',
    },
    {
      quote: "Nous utilisons TORP pour tous nos marchés publics. La conformité documentaire nous fait gagner un temps fou.",
      author: 'Sophie M.',
      role: 'Directrice Services Techniques',
      avatar: 'S',
    },
  ];

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
            <a href="#features" className="text-sm hover:text-primary transition-colors">Fonctionnalités</a>
            <a href="#segments" className="text-sm hover:text-primary transition-colors">Solutions</a>
            <a href="#testimonials" className="text-sm hover:text-primary transition-colors">Témoignages</a>
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <Link to="/login">
              <Button variant="ghost">Connexion</Button>
            </Link>
            <Link to="/register">
              <Button>Commencer gratuitement</Button>
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
            <a href="#features" className="block text-sm hover:text-primary" onClick={() => setMobileMenuOpen(false)}>Fonctionnalités</a>
            <a href="#segments" className="block text-sm hover:text-primary" onClick={() => setMobileMenuOpen(false)}>Solutions</a>
            <a href="#testimonials" className="block text-sm hover:text-primary" onClick={() => setMobileMenuOpen(false)}>Témoignages</a>
            <div className="pt-4 border-t space-y-2">
              <Link to="/login" className="block">
                <Button variant="outline" className="w-full">Connexion</Button>
              </Link>
              <Link to="/register" className="block">
                <Button className="w-full">Commencer gratuitement</Button>
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
            Propulsé par l'IA
          </Badge>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-gray-900 via-primary to-gray-900 bg-clip-text text-transparent">
            Vos projets BTP
            <br />
            maîtrisés de A à Z
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            TORP révolutionne la gestion de projets construction et rénovation grâce à l'intelligence artificielle.
            Particuliers, professionnels, collectivités : reprenez le contrôle.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register">
              <Button size="lg" className="text-lg px-8 w-full sm:w-auto">
                Démarrer gratuitement
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/demo">
              <Button size="lg" variant="outline" className="text-lg px-8 w-full sm:w-auto">
                <Play className="mr-2 h-5 w-5" />
                Voir la démo
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Aucune carte bancaire requise
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 bg-primary/5">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className="text-center">
                  <Icon className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <div className="text-2xl md:text-3xl font-bold">{stat.value}</div>
                  <div className="text-xs md:text-sm text-muted-foreground">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Phases */}
      <section id="features" className="py-20 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">5 phases, une seule plateforme</h2>
            <p className="text-lg md:text-xl text-muted-foreground">
              De la première idée à la garantie décennale, TORP vous accompagne
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
      <section id="segments" className="py-20 px-6 bg-gray-50">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Une solution pour chaque besoin</h2>
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
                        {segment.cta}
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
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="mb-4" variant="secondary">
                <Brain className="h-3 w-3 mr-1" />
                Intelligence Artificielle
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">L'IA au service de vos projets</h2>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Analyse de devis instantanée</h3>
                    <p className="text-muted-foreground">
                      80+ critères analysés automatiquement. Détection des anomalies et comparaison aux prix du marché.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <Brain className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Vision par ordinateur</h3>
                    <p className="text-muted-foreground">
                      Analysez vos photos de chantier : avancement, qualité, conformité en un clic.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Prédictions intelligentes</h3>
                    <p className="text-muted-foreground">
                      Anticipez les retards, optimisez votre budget et prenez les bonnes décisions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-8 aspect-square flex items-center justify-center">
              <div className="text-center">
                <Brain className="h-20 md:h-24 w-20 md:w-24 mx-auto text-primary mb-4" />
                <p className="text-lg font-medium mb-4">Essayez l'analyse IA</p>
                <Link to="/analyze">
                  <Button variant="outline">
                    <Play className="mr-2 h-4 w-4" />
                    Analyser un devis
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 px-6 bg-gray-50">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ils nous font confiance</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-muted-foreground mb-4">"{t.quote}"</p>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                      {t.avatar}
                    </div>
                    <div>
                      <p className="font-medium">{t.author}</p>
                      <p className="text-sm text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="pt-12 pb-12 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Prêt à transformer vos projets ?</h2>
              <p className="text-lg md:text-xl opacity-90 mb-8 max-w-2xl mx-auto">
                Rejoignez des milliers d'utilisateurs qui ont déjà adopté TORP pour leurs projets BTP.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/register">
                  <Button size="lg" variant="secondary" className="text-lg px-8 w-full sm:w-auto">
                    Créer un compte gratuit
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/demo">
                  <Button size="lg" variant="outline" className="text-lg px-8 w-full sm:w-auto border-white text-white hover:bg-white/10">
                    Demander une démo
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold">T</span>
                </div>
                <span className="font-bold text-xl">TORP</span>
              </div>
              <p className="text-sm text-muted-foreground">
                La plateforme intelligente pour vos projets BTP.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Produit</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/pricing" className="hover:text-primary">Tarifs</Link></li>
                <li><Link to="/demo" className="hover:text-primary">Démo</Link></li>
                <li><a href="#features" className="hover:text-primary">Fonctionnalités</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Ressources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/knowledge-base" className="hover:text-primary">Documentation</Link></li>
                <li><a href="https://github.com/torp-fr/quote-insight-tally" className="hover:text-primary">GitHub</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Entreprise</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="mailto:contact@torp.fr" className="hover:text-primary">Contact</a></li>
                <li><a href="#" className="hover:text-primary">Mentions légales</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-muted-foreground">
              © 2025 TORP. Tous droits réservés.
            </p>
            <div className="flex gap-4 mt-4 md:mt-0 text-sm">
              <a href="#" className="text-muted-foreground hover:text-primary">CGU</a>
              <a href="#" className="text-muted-foreground hover:text-primary">Confidentialité</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;

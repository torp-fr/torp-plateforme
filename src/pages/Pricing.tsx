import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Header } from '@/components/Header';
import { BackButton } from '@/components/BackButton';
import { Check, Star, Zap, Shield, Headphones, BarChart3, Users, Building } from 'lucide-react';

export default function Pricing() {
  const [isAnnual, setIsAnnual] = useState(false);
  const [userType, setUserType] = useState<'B2C' | 'B2B' | 'B2G' | 'B2B2C'>('B2C');

  // Offres B2C (Particuliers) - Prix fixes et clairs
  const b2cPlans = [
    {
      name: 'Pack Sécurité',
      description: 'Première évaluation rapide',
      price: 9.90,
      period: '/ devis',
      features: [
        'Score de confiance A-E instantané',
        '3 alertes principales identifiées',
        'Vérification SIREN/SIRET & adresse entreprise',
        'Détection des risques majeurs',
        'Export PDF inclus',
      ],
      buttonText: 'Vérifier maintenant',
      popular: false,
      ideal: 'Première évaluation, détection rapide des risques'
    },
    {
      name: 'Pack Analyse',
      description: 'Analyse technique complète',
      price: 19.90,
      period: '/ devis',
      features: [
        'Checklist technique détaillée (30-50 points)',
        'Écarts vs prix locaux du marché',
        '5 recommandations IA personnalisées',
        'Rapport PDF professionnel',
        'Support prioritaire',
      ],
      buttonText: 'Analyser en détail',
      popular: true,
      ideal: 'Projets moyens, besoin de détails techniques'
    },
    {
      name: 'Pack Comparaison',
      description: 'Choisir entre plusieurs devis',
      price: 29.90,
      period: '(pack de 3 devis)',
      features: [
        'Analyse comparative de 2-3 devis',
        'Tableau de comparaison détaillé',
        'Recommandation du meilleur choix',
        'Points forts/faibles de chaque devis',
      ],
      buttonText: 'Comparer mes devis',
      popular: false,
      ideal: 'Hésitation entre plusieurs entreprises'
    },
    {
      name: 'Pack Complet + CCTP',
      description: 'Analyse + Document contractuel',
      price: 44.90,
      period: '/ devis',
      features: [
        'Analyse technique complète',
        'CCTP personnalisé et contextuel',
        'Document contractuel téléchargeable',
        'Suivi interactif depuis votre espace',
        'Support prioritaire téléphonique',
        'Garantie de conformité',
      ],
      buttonText: 'Pack Complet',
      popular: false,
      ideal: 'Gros projets, besoin de sécurisation contractuelle'
    }
  ];

  // Offres B2B (Entreprises BTP) - Plans fixes sans configurateur complexe
  const b2bPlans = [
    {
      name: 'TORP Starter',
      description: 'Fonctionnalités de base pour TPE',
      price: isAnnual ? 490 : 49,
      period: isAnnual ? '€ HT/an' : '€ HT/mois',
      subtitle: isAnnual ? 'Économisez 98€ par an' : '49€ HT/mois',
      features: [
        '10 analyses/mois incluses',
        'Scoring automatique A-E',
        'Dashboard basique',
        'Support email',
        'Formation onboarding 2h',
        'Export PDF des rapports'
      ],
      target: 'Artisans 1-2 personnes, < 30 devis/mois',
      buttonText: 'Commencer Starter',
      popular: false,
      icon: '⚡'
    },
    {
      name: 'TORP Business',
      description: 'Solution complète pour PME',
      price: isAnnual ? 1490 : 149,
      period: isAnnual ? '€ HT/an' : '€ HT/mois',
      subtitle: isAnnual ? 'Économisez 298€ par an' : '149€ HT/mois',
      features: [
        '50 analyses/mois incluses',
        'Analytics avancés & KPIs',
        'Gestion équipe (5 utilisateurs)',
        'API & intégrations',
        'Support téléphonique prioritaire',
        'Formation équipe incluse',
        'Rapports personnalisés'
      ],
      target: 'PME BTP 3-15 personnes',
      buttonText: 'Choisir Business',
      popular: true,
      icon: '📊'
    },
    {
      name: 'TORP Enterprise',
      description: 'Solution sur-mesure pour grandes entreprises',
      price: 'Sur devis',
      period: '',
      subtitle: 'À partir de 500€ HT/mois',
      features: [
        'Analyses illimitées',
        'Utilisateurs illimités',
        'White label personnalisé',
        'API complète + intégrations ERP/CRM',
        'Account manager dédié',
        'Formation sur-site',
        'Support premium 24/7'
      ],
      target: 'Grandes entreprises 50+ personnes',
      buttonText: 'Contacter l\'équipe',
      popular: false,
      icon: '🎯'
    }
  ];

  // Offres B2B2C (Prescripteurs)  
  const b2b2cPlans = [
    {
      name: 'Standard',
      price: isAnnual ? 649 : 64.90,
      period: isAnnual ? '€ HT/an' : '€ HT/mois',
      subtitle: isAnnual ? 'Économisez 129€ par an' : '64,90€ HT/mois',
      description: 'Analyses illimitées pour certification',
      features: [
        'Analyses TORP illimitées (max 200/mois)',
        'Score TORP 0-10 avec justification',
        'Certificat PDF basique à joindre',
        'Dashboard prescripteur (historique 6 mois)',
        '2 utilisateurs maximum',
        'Support email standard',
      ],
      target: 'Syndics, Architectes indépendants, Agences locales',
      buttonText: 'Choisir Standard',
      popular: true,
      icon: '⚡'
    },
    {
      name: 'Premium',
      price: isAnnual ? 1490 : 149,
      period: isAnnual ? '€ HT/an' : '€ HT/mois',
      subtitle: isAnnual ? 'Économisez 298€ par an' : '149€ HT/mois',
      description: 'Analyse détaillée + rapports personnalisés',
      features: [
        'Tous les avantages Standard',
        'Analyses illimitées (max 500/mois)',
        'Analyse détaillée (conformité DTU, normes)',
        'Recommandations d\'amélioration',
        'Comparaison prix marché régional',
        'Rapports personnalisés (logo prescripteur)',
        'Historique analyses illimité',
        '5 utilisateurs maximum',
        'Support téléphonique prioritaire',
      ],
      target: 'Maîtres d\'œuvre, Bureaux d\'études, Syndics pro',
      buttonText: 'Choisir Premium',
      popular: false,
      icon: '🎯'
    }
  ];

  // Offres B2G (Collectivités)
  const b2gPlans = [
    {
      name: 'Collectivité Standard',
      price: 'Sur devis',
      period: '',
      subtitle: 'À partir de 2 500€ HT/mois',
      description: 'Gestion patrimoine immobilier public',
      features: [
        'Crédits d\'analyse prépayés',
        'Dashboard patrimoine immobilier',
        'Suivi maintenance prédictive',
        'Rapports conformité réglementaire',
        'Interface multi-utilisateurs',
        'Formation équipes incluse',
        'Support prioritaire',
      ],
      target: 'Mairies, Départements, Régions, Bailleurs sociaux',
      buttonText: 'Demander un devis',
      popular: true,
      icon: '🏛️'
    },
    {
      name: 'Collectivité Premium',
      price: 'Sur devis',
      period: '',
      subtitle: 'Solution sur-mesure',
      description: 'Plateforme complète + services',
      features: [
        'Tous les avantages Standard',
        'IA prédictive maintenance',
        'Optimisation énergétique assistée',
        'Intégration ERP/SIRH existant',
        'Account manager dédié',
        'Consulting spécialisé inclus',
        'API complète',
        'White label possible',
      ],
      target: 'Grandes collectivités, Métropoles, EPIC',
      buttonText: 'Contacter l\'équipe',
      popular: false,
      icon: '🌟'
    }
  ];

  const getCurrentPlans = () => {
    switch (userType) {
      case 'B2C': return b2cPlans;
      case 'B2B': return b2bPlans;
      case 'B2G': return b2gPlans;
      case 'B2B2C': return b2b2cPlans;
      default: return b2cPlans;
    }
  };

  const currentPlans = getCurrentPlans();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-7xl mx-auto">
          {/* En-tête */}
          <div className="text-center mb-12">
            <div className="mb-6">
              <BackButton to="/dashboard" label="Dashboard" />
            </div>
            
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Tarifs transparents pour tous
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Choisissez l'offre qui correspond à vos besoins
            </p>

            {/* Toggle type d'utilisateur */}
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="grid grid-cols-4 bg-muted rounded-lg p-1">
                <button
                  onClick={() => setUserType('B2C')}
                  className={`px-4 py-3 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                    userType === 'B2C' 
                      ? 'bg-background text-foreground shadow-soft' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  B2C
                </button>
                <button
                  onClick={() => setUserType('B2B')}
                  className={`px-4 py-3 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                    userType === 'B2B' 
                      ? 'bg-background text-foreground shadow-soft' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Building className="w-4 h-4" />
                  B2B
                </button>
                <button
                  onClick={() => setUserType('B2G')}
                  className={`px-4 py-3 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                    userType === 'B2G' 
                      ? 'bg-background text-foreground shadow-soft' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  🏛️
                  B2G
                </button>
                <button
                  onClick={() => setUserType('B2B2C')}
                  className={`px-4 py-3 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                    userType === 'B2B2C' 
                      ? 'bg-background text-foreground shadow-soft' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  🎯
                  B2B2C
                </button>
              </div>
            </div>

            {/* Toggle annuel/mensuel - seulement pour B2B et B2B2C */}
            {(userType === 'B2B' || userType === 'B2B2C') && (
              <div className="flex items-center justify-center gap-4">
                <span className={`text-sm ${!isAnnual ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                  Mensuel
                </span>
                <Switch
                  checked={isAnnual}
                  onCheckedChange={setIsAnnual}
                />
                <span className={`text-sm ${isAnnual ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                  Annuel
                </span>
                {isAnnual && (
                  <Badge variant="outline" className="bg-success/10 text-success border-success">
                    -17%
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Grille des tarifs */}
          <div className={`grid gap-8 ${
            userType === 'B2C' ? 'lg:grid-cols-2 xl:grid-cols-4' : 
            userType === 'B2B' ? 'lg:grid-cols-3' :
            'lg:grid-cols-2'
          } mb-16`}>
            {currentPlans.map((plan, index) => (
              <Card key={index} className={`relative ${plan.popular ? 'border-primary shadow-strong' : 'border-border'}`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-4 py-1">
                      <Star className="w-3 h-3 mr-1" />
                      Recommandé
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="text-center pb-6">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    {plan.icon && <span className="text-2xl">{plan.icon}</span>}
                    <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                  </div>
                  
                  {plan.subtitle && (
                    <p className="text-sm text-muted-foreground mb-2">{plan.subtitle}</p>
                  )}
                  
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-center gap-2">
                      {typeof plan.price === 'number' ? (
                        <span className="text-4xl font-bold text-foreground">
                          {plan.price}€
                        </span>
                      ) : (
                        <span className="text-3xl font-bold text-foreground">
                          {plan.price}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{plan.period}</p>
                  </div>
                  <p className="text-muted-foreground">{plan.description}</p>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Liste des fonctionnalités */}
                  <ul className="space-y-3">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Target audience */}
                  {plan.target && (
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <p className="text-xs text-muted-foreground">
                        <strong>Idéal pour :</strong> {plan.target}
                      </p>
                    </div>
                  )}

                  {/* Ideal use case pour B2C */}
                  {plan.ideal && (
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <p className="text-xs text-muted-foreground">
                        <strong>Usage :</strong> {plan.ideal}
                      </p>
                    </div>
                  )}

                  {/* Bouton d'action */}
                  <Button 
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                  >
                    {plan.buttonText}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Section complémentaire selon le type d'utilisateur */}
          {userType === 'B2B' && (
            <div className="text-center space-y-6">
              <div className="bg-muted/20 rounded-lg p-8">
                <h3 className="text-2xl font-bold text-foreground mb-4">
                  Besoin d'une solution personnalisée ?
                </h3>
                <p className="text-muted-foreground mb-6">
                  Contactez notre équipe pour une démonstration personnalisée et un devis adapté à vos besoins spécifiques.
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  <Button>
                    <Headphones className="w-4 h-4 mr-2" />
                    Demander une démo
                  </Button>
                  <Button variant="outline">
                    Parler à un expert
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* FAQ Section */}
          <div className="mt-16">
            <h3 className="text-2xl font-bold text-center text-foreground mb-8">
              Questions fréquentes
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Puis-je changer d'offre ?</h4>
                  <p className="text-sm text-muted-foreground">
                    Oui, vous pouvez upgrader ou downgrader votre abonnement à tout moment depuis votre espace client.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Les prix incluent-ils la TVA ?</h4>
                  <p className="text-sm text-muted-foreground">
                    Les prix B2C incluent la TVA. Les prix B2B, B2G et B2B2C sont HT.
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Puis-je tester gratuitement ?</h4>
                  <p className="text-sm text-muted-foreground">
                    Oui, nous proposons une période d'essai gratuite pour toutes nos offres professionnelles.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Support client inclus ?</h4>
                  <p className="text-sm text-muted-foreground">
                    Le support est inclus dans toutes nos offres, avec des niveaux de service différents selon votre plan.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
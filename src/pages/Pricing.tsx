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
  const [userType, setUserType] = useState<'particulier' | 'entreprise'>('particulier');

  const particularPlans = [
    {
      name: 'Découverte',
      price: 0,
      period: 'Gratuit',
      description: 'Pour découvrir TORP',
      features: [
        '2 analyses de devis par mois',
        'Score TORP basique',
        'Comparaison prix marché',
        'Support email',
      ],
      limitations: [
        'Pas de rapport PDF',
        'Historique limité à 30 jours'
      ],
      buttonText: 'Commencer gratuitement',
      popular: false
    },
    {
      name: 'Essentiel',
      price: isAnnual ? 9 : 12,
      originalPrice: isAnnual ? 12 : null,
      period: isAnnual ? '/mois (facturé annuellement)' : '/mois',
      description: 'Pour les projets réguliers',
      features: [
        '10 analyses de devis par mois',
        'Score TORP détaillé',
        'Comparaison prix marché',
        'Rapports PDF détaillés',
        'Recommandations personnalisées',
        'Historique illimité',
        'Support email prioritaire',
      ],
      buttonText: 'Choisir Essentiel',
      popular: true
    },
    {
      name: 'Premium',
      price: isAnnual ? 19 : 25,
      originalPrice: isAnnual ? 25 : null,
      period: isAnnual ? '/mois (facturé annuellement)' : '/mois',
      description: 'Pour les gros projets',
      features: [
        'Analyses illimitées',
        'Score TORP avancé',
        'Comparaison prix marché premium',
        'Rapports PDF personnalisés',
        'Suivi de projet complet',
        'Conseils juridiques de base',
        'Support téléphonique',
        'Accès anticipé aux nouvelles fonctionnalités',
      ],
      buttonText: 'Choisir Premium',
      popular: false
    }
  ];

  const enterprisePlans = [
    {
      name: 'Professionnel',
      price: isAnnual ? 49 : 59,
      originalPrice: isAnnual ? 59 : null,
      period: isAnnual ? '/mois (facturé annuellement)' : '/mois',
      description: 'Pour les artisans et PME',
      features: [
        'Analyses illimitées',
        'Dashboard entreprise',
        'Gestion des devis clients',
        'Optimisation automatique des devis',
        'Analytics et statistiques',
        'Intégration CRM basique',
        'Support prioritaire',
      ],
      buttonText: 'Essayer Professionnel',
      popular: true
    },
    {
      name: 'Entreprise',
      price: isAnnual ? 149 : 179,
      originalPrice: isAnnual ? 179 : null,
      period: isAnnual ? '/mois (facturé annuellement)' : '/mois',
      description: 'Pour les grandes entreprises',
      features: [
        'Tout du plan Professionnel',
        'Utilisateurs illimités',
        'API complète',
        'Intégrations avancées',
        'Rapports personnalisés',
        'Formation équipe incluse',
        'Support dédié',
        'SLA garanti',
      ],
      buttonText: 'Contacter l\'équipe',
      popular: false
    },
    {
      name: 'Sur mesure',
      price: 'Sur devis',
      period: '',
      description: 'Solution personnalisée',
      features: [
        'Solution 100% personnalisée',
        'Intégration sur mesure',
        'Développement spécifique',
        'Support premium 24/7',
        'Formation complète',
        'Accompagnement dédié',
        'Contrat de service personnalisé',
      ],
      buttonText: 'Nous contacter',
      popular: false
    }
  ];

  const currentPlans = userType === 'particulier' ? particularPlans : enterprisePlans;

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
              <div className="flex bg-muted rounded-lg p-1">
                <button
                  onClick={() => setUserType('particulier')}
                  className={`px-6 py-3 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                    userType === 'particulier' 
                      ? 'bg-background text-foreground shadow-soft' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Particulier
                </button>
                <button
                  onClick={() => setUserType('entreprise')}
                  className={`px-6 py-3 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                    userType === 'entreprise' 
                      ? 'bg-background text-foreground shadow-soft' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Building className="w-4 h-4" />
                  Entreprise
                </button>
              </div>
            </div>

            {/* Toggle annuel/mensuel */}
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
                  -25%
                </Badge>
              )}
            </div>
          </div>

          {/* Grille des tarifs */}
          <div className={`grid gap-8 ${userType === 'particulier' ? 'lg:grid-cols-3' : 'lg:grid-cols-3'} mb-16`}>
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
                  <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-center gap-2">
                      {typeof plan.price === 'number' ? (
                        <>
                          {plan.originalPrice && (
                            <span className="text-lg text-muted-foreground line-through">
                              {plan.originalPrice}€
                            </span>
                          )}
                          <span className="text-4xl font-bold text-foreground">
                            {plan.price}€
                          </span>
                        </>
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
                  <div className="space-y-3">
                    {plan.features.map((feature, featureIndex) => (
                      <div key={featureIndex} className="flex items-start gap-3">
                        <Check className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-foreground">{feature}</span>
                      </div>
                    ))}
                    
                    {plan.limitations?.map((limitation, limitIndex) => (
                      <div key={limitIndex} className="flex items-start gap-3 opacity-60">
                        <div className="w-4 h-4 mt-0.5 flex-shrink-0">
                          <div className="w-2 h-2 bg-muted-foreground rounded-full mt-1 mx-auto"></div>
                        </div>
                        <span className="text-sm text-muted-foreground">{limitation}</span>
                      </div>
                    ))}
                  </div>

                  <Button 
                    className={`w-full ${plan.popular ? '' : 'variant-outline'}`}
                    variant={plan.popular ? 'default' : 'outline'}
                    size="lg"
                  >
                    {plan.buttonText}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Section fonctionnalités */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold text-center text-foreground mb-12">
              Toutes les fonctionnalités TORP
            </h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Analyse instantanée</h3>
                <p className="text-muted-foreground text-sm">
                  Résultats en moins de 3 minutes grâce à notre IA
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-success" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">100% sécurisé</h3>
                <p className="text-muted-foreground text-sm">
                  Vos données sont chiffrées et protégées
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-info/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-8 h-8 text-info" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Analytics avancés</h3>
                <p className="text-muted-foreground text-sm">
                  Statistiques détaillées sur vos analyses
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Headphones className="w-8 h-8 text-warning" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Support expert</h3>
                <p className="text-muted-foreground text-sm">
                  Équipe d'experts BTP à votre écoute
                </p>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-8">
              Questions fréquentes
            </h2>
            
            <div className="max-w-3xl mx-auto space-y-6">
              <Card>
                <CardContent className="p-6 text-left">
                  <h3 className="font-semibold text-foreground mb-2">
                    Puis-je changer d'offre à tout moment ?
                  </h3>
                  <p className="text-muted-foreground">
                    Oui, vous pouvez upgrader ou downgrader votre offre à tout moment. 
                    Les changements prennent effet immédiatement.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-left">
                  <h3 className="font-semibold text-foreground mb-2">
                    Y a-t-il un engagement ?
                  </h3>
                  <p className="text-muted-foreground">
                    Non, tous nos abonnements sont sans engagement. 
                    Vous pouvez annuler à tout moment.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-left">
                  <h3 className="font-semibold text-foreground mb-2">
                    Proposez-vous une période d'essai ?
                  </h3>
                  <p className="text-muted-foreground">
                    Oui, toutes nos offres payantes incluent 14 jours d'essai gratuit. 
                    Aucune carte bancaire n'est requise.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
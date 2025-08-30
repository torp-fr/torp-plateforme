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
      name: 'Analyse Rapide',
      price: 9.90,
      period: '/ devis',
      description: 'Pour une première évaluation rapide',
      features: [
        'Score A-E du devis',
        '3 drapeaux majeurs identifiés',
        'Mini-résumé technique',
        'Vérification SIREN/SIRET & adresse entreprise',
      ],
      options: [
        'Export PDF : +0,90€/devis'
      ],
      buttonText: 'Analyser maintenant',
      popular: false,
      ideal: 'Première approche, budget serré, projet simple'
    },
    {
      name: 'Analyse Complète',
      price: 19.90,
      period: '/ devis',
      description: 'L\'offre la plus populaire',
      features: [
        'Checklist détaillée (30-50 points)',
        'Écarts vs prix locaux du marché',
        '5 recommandations IA personnalisées',
        'Rapport PDF professionnel',
        'Support prioritaire',
      ],
      options: [
        'Comparatif devis supplémentaires : +4,90€/devis',
        'Ré-analyse après ajustements : +1,90€/devis'
      ],
      buttonText: 'Choisir Complète',
      popular: true,
      ideal: 'Projets moyens, besoin de détails techniques'
    },
    {
      name: 'Complète + CBP',
      price: 39.90,
      period: '/ devis',
      description: 'Pour une signature sereine',
      features: [
        'Tous les avantages de l\'Analyse Complète',
        'CBP (Contrat/Charte) personnalisé inclus',
        '1 comparatif devis inclus',
        'Support prioritaire téléphonique',
      ],
      options: [
        'Comparatifs supplémentaires : +4,90€ (après le 1er inclus)',
        'Ré-analyse après ajustements : +1,90€/devis'
      ],
      buttonText: 'Choisir Premium',
      popular: false,
      ideal: 'Gros projets, clients exigeants, besoin de sécurisation'
    },
    {
      name: 'Comparaison Devis',
      price: 29.90,
      period: '',
      description: 'Pour choisir entre plusieurs propositions',
      features: [
        'Analyse de 2-3 devis simultanément',
        'Comparaison détaillée point par point',
        'Recommandation du meilleur choix',
        'Tableau synthétique des avantages/inconvénients',
      ],
      buttonText: 'Comparer mes devis',
      popular: false,
      ideal: 'Hésitation entre plusieurs entreprises'
    }
  ];

  const enterprisePlans = [
    {
      name: 'TORP Starter',
      price: 49,
      period: '€ HT/mois',
      subtitle: 'À partir de 49€ HT/mois',
      description: 'Idéal pour TPE et artisans indépendants',
      configuration: '10 devis/mois • Score seul (2,9€/devis) • Limite ≤ 5 000€',
      features: [
        'Scoring automatique A-E',
        'Audit pré-envoi',
        'Dashboard basique',
        'Support email',
        'Formation onboarding 2h',
      ],
      target: 'Artisans 1-2 personnes, < 30 devis/mois',
      buttonText: 'Commencer Starter',
      popular: false,
      icon: '⚡'
    },
    {
      name: 'TORP Business',
      price: 192,
      period: '€ HT/mois',
      subtitle: 'Configuration type',
      description: 'Pour PME en développement',
      configuration: '30 devis/mois • Score + recommandations (4,9€/devis) • Limite ≤ 15 000€ • Remise -10%',
      features: [
        'Analyses illimitées',
        'Recommandations d\'amélioration',
        'Tableau de bord & exports',
        'Formation équipe 4h',
        'Support email + téléphone 12h',
        'Multi-utilisateurs (5 comptes inclus)',
      ],
      additionalServices: [
        'Utilisateur supplémentaire : +2€/mois',
        'Certification TORP : 149€/an'
      ],
      target: 'PME 3-10 personnes, projets structurés',
      buttonText: 'Choisir Business',
      popular: true,
      icon: '📊'
    },
    {
      name: 'TORP Pro',
      price: 'À partir de 450',
      period: '€ HT/mois',
      subtitle: 'Configuration type',
      description: 'Pour grandes entreprises',
      configuration: '100+ devis/mois • Score + Reco + CBP (5,9€/devis) • Limite > 50 000€ • Remise -20%',
      features: [
        'Utilisateurs illimités',
        'Génération CBP automatique',
        'White label personnalisé',
        'API complète + intégrations ERP/CRM',
        'Account manager dédié',
        'Formation sur-site',
        'Support prioritaire < 4h',
        'SLA 99,5% garanti',
      ],
      additionalServices: [
        'Setup initial : 500€',
        'Consulting personnalisé : 800€/jour',
        'Intégration sur-mesure : 2 500€',
        'Support premium : +50€/mois (< 2h)'
      ],
      target: 'Grandes entreprises 10+ personnes',
      buttonText: 'Contacter l\'équipe',
      popular: false,
      icon: '🎯'
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
          <div className={`grid gap-8 ${userType === 'particulier' ? 'lg:grid-cols-2 xl:grid-cols-4' : 'lg:grid-cols-3'} mb-16`}>
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
                        <>
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
                  
                  {plan.configuration && (
                    <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                      {plan.configuration}
                    </p>
                  )}
                </CardHeader>

                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    {plan.features.map((feature, featureIndex) => (
                      <div key={featureIndex} className="flex items-start gap-3">
                        <Check className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-foreground">{feature}</span>
                      </div>
                    ))}
                    
                    {plan.options?.map((option, optionIndex) => (
                      <div key={optionIndex} className="flex items-start gap-3 opacity-75">
                        <div className="w-4 h-4 mt-0.5 flex-shrink-0">
                          <div className="w-2 h-2 bg-warning rounded-full mt-1 mx-auto"></div>
                        </div>
                        <span className="text-xs text-muted-foreground">{option}</span>
                      </div>
                    ))}
                    
                    {plan.additionalServices?.map((service, serviceIndex) => (
                      <div key={serviceIndex} className="flex items-start gap-3 opacity-60">
                        <div className="w-4 h-4 mt-0.5 flex-shrink-0">
                          <div className="w-2 h-2 bg-info rounded-full mt-1 mx-auto"></div>
                        </div>
                        <span className="text-xs text-muted-foreground">{service}</span>
                      </div>
                    ))}
                  </div>

                  {plan.ideal && (
                    <div className="bg-muted/30 p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Idéal pour :</span> {plan.ideal}
                      </p>
                    </div>
                  )}

                  {plan.target && (
                    <div className="bg-muted/30 p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Cible :</span> {plan.target}
                      </p>
                    </div>
                  )}

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

          {/* Section tarification détaillée B2B */}
          {userType === 'entreprise' && (
            <div className="mb-16 bg-muted/20 rounded-lg p-8">
              <h3 className="text-2xl font-bold text-center text-foreground mb-8">
                Tarification détaillée B2B
              </h3>
              
              <div className="grid md:grid-cols-3 gap-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Niveaux de Service</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span>Score seul</span>
                        <span className="font-medium">2,9€/devis</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Score + Reco</span>
                        <span className="font-medium">4,9€/devis</span>
                      </div>
                      <div className="flex justify-between">
                        <span>+ CBP</span>
                        <span className="font-medium">5,9€/devis</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Limites de Devis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span>≤ 1 000€</span>
                        <span className="font-medium">x0,9</span>
                      </div>
                      <div className="flex justify-between">
                        <span>≤ 5 000€</span>
                        <span className="font-medium">x1,0</span>
                      </div>
                      <div className="flex justify-between">
                        <span>≤ 15 000€</span>
                        <span className="font-medium">x1,3</span>
                      </div>
                      <div className="flex justify-between">
                        <span>≤ 50 000€</span>
                        <span className="font-medium">x1,7</span>
                      </div>
                       <div className="flex justify-between">
                         <span>&gt; 50 000€</span>
                         <span className="font-medium">x2,4</span>
                       </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Remises Volume</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span>10 devis/mois</span>
                        <span className="font-medium">0%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>20 devis/mois</span>
                        <span className="font-medium">-5%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>30 devis/mois</span>
                        <span className="font-medium">-10%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>50 devis/mois</span>
                        <span className="font-medium">-15%</span>
                      </div>
                       <div className="flex justify-between">
                         <span>100+ devis/mois</span>
                         <span className="font-medium">-20%</span>
                       </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="mt-8 p-4 bg-info/10 rounded-lg">
                <p className="text-sm text-center text-info-foreground">
                  <span className="font-semibold">Formule de calcul :</span> Prix mensuel = max(49€, 19€ + N × U × g × r)
                  <br />
                  <span className="text-xs">N=devis/mois, U=niveau service, g=coeff limite, r=remise volume</span>
                </p>
              </div>
            </div>
          )}

          {/* Section offres promotionnelles */}
          <div className="mb-16">
            <h3 className="text-2xl font-bold text-center text-foreground mb-8">
              🎁 Offres Promotionnelles
            </h3>
            
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <Card className="border-success">
                <CardHeader>
                  <CardTitle className="text-lg text-success">
                    {userType === 'particulier' ? 'B2C - Offre Lancement' : 'B2B - Early Adopter'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {userType === 'particulier' ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-success" />
                        <span>3 premiers mois : Analyse Rapide à 4,99€ (-50%)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-success" />
                        <span>Pack découverte : 3 analyses pour 19,99€ (-20%)</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-success" />
                        <span>3 premiers mois : -50% sur abonnement choisi</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-success" />
                        <span>Certification TORP : Offerte (valeur 149€)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-success" />
                        <span>Formation équipe : Incluse (valeur 500€)</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-primary">
                <CardHeader>
                  <CardTitle className="text-lg text-primary">
                    {userType === 'particulier' ? 'Garantie Satisfaction' : 'POC Gratuit'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {userType === 'particulier' ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-primary" />
                        <span>7 jours ou remboursé</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-primary" />
                        <span>RGPD stricte, suppression sur demande</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-primary" />
                        <span>30 jours d'essai B2B</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-primary" />
                        <span>Formation équipe incluse</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-primary" />
                        <span>Accompagnement dédié</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
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
                    Comment fonctionne la tarification B2B ?
                  </h3>
                  <p className="text-muted-foreground">
                    Notre tarification B2B utilise une formule basée sur le volume de devis, 
                    le niveau de service et la complexité des projets, avec des remises dégressives.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-left">
                  <h3 className="font-semibold text-foreground mb-2">
                    Que comprend le CBP personnalisé ?
                  </h3>
                  <p className="text-muted-foreground">
                    Le Cahier des Charges Techniques Personnalisé (CBP) détaille l'intégralité 
                    des modalités, process, normes et fournitures de votre projet pour sécuriser votre chantier.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-left">
                  <h3 className="font-semibold text-foreground mb-2">
                    Y a-t-il des garanties ?
                  </h3>
                  <p className="text-muted-foreground">
                    Oui, nous offrons 7 jours satisfaction ou remboursé pour les particuliers, 
                    et 30 jours d'essai gratuit pour les entreprises.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-left">
                  <h3 className="font-semibold text-foreground mb-2">
                    Proposez-vous des formations ?
                  </h3>
                  <p className="text-muted-foreground">
                    Oui, nous incluons des formations selon l'offre : 2h pour Starter, 
                    4h pour Business et formation sur-site pour Pro.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-left">
                  <h3 className="font-semibold text-foreground mb-2">
                    Comment contacter l'équipe commerciale ?
                  </h3>
                  <p className="text-muted-foreground">
                    Contactez-nous à contact@torp.fr pour une démo personnalisée 
                    ou un conseil sur l'offre la plus adaptée à vos besoins.
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
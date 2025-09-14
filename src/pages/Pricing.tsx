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

  // Offres B2C (Particuliers)
  const b2cPacks = [
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
      name: 'Pack Complet + CCTP',
      description: 'Analyse + Document contractuel',
      price: 39.90,
      period: '/ devis',
      features: [
        'Tous les avantages du Pack Analyse',
        'CCTP personnalisé et contextuel',
        'Document contractuel téléchargeable',
        'Suivi interactif depuis votre espace',
        'Support prioritaire téléphonique',
      ],
      buttonText: 'Pack Complet',
      popular: false,
      ideal: 'Gros projets, besoin de sécurisation contractuelle'
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
    }
  ];

  const [devisCount, setDevisCount] = useState(30);
  const [serviceLevel, setServiceLevel] = useState(2);
  const [projectLimit, setProjectLimit] = useState(2);
  const [cctpPackage, setCctpPackage] = useState(false);

  const serviceOptions = [
    { id: 1, name: 'Score seul', price: 2.9 },
    { id: 2, name: 'Score + Recommandations', price: 4.9 },
    { id: 3, name: 'Audit complet', price: 5.9 }
  ];

  const limitOptions = [
    { id: 1, name: '≤ 1 000€', coeff: 0.9 },
    { id: 2, name: '≤ 5 000€', coeff: 1.0 },
    { id: 3, name: '≤ 15 000€', coeff: 1.3 },
    { id: 4, name: '≤ 50 000€', coeff: 1.7 },
    { id: 5, name: '> 50 000€', coeff: 2.4 }
  ];

  const getVolumeDiscount = (count: number) => {
    if (count >= 100) return 0.8;
    if (count >= 50) return 0.85;
    if (count >= 30) return 0.9;
    if (count >= 20) return 0.95;
    return 1.0;
  };

  const calculatePrice = () => {
    const basePrice = 19;
    const selectedService = serviceOptions.find(s => s.id === serviceLevel);
    const selectedLimit = limitOptions.find(l => l.id === projectLimit);
    const discount = getVolumeDiscount(devisCount);
    
    const monthlyPrice = Math.max(
      49,
      basePrice + (devisCount * selectedService!.price * selectedLimit!.coeff * discount)
    );
    
    const cctpPrice = cctpPackage ? 99 : 0;
    return Math.round(monthlyPrice + cctpPrice);
  };

  // Offres B2B (Entreprises BTP)
  const b2bPlans = [
    {
      name: 'TORP Starter',
      price: 49,
      period: '€ HT/mois',
      subtitle: 'À partir de 49€ HT/mois',
      description: 'Fonctionnalités de base pour TPE',
      configuration: '10 devis/mois • Score seul • Limite ≤ 5 000€',
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
      name: 'Configurateur B2B',
      price: calculatePrice(),
      period: '€ HT/mois',
      subtitle: 'Tarif personnalisé',
      description: 'Configurez selon vos besoins',
      isCustom: true,
      features: [
        'Fonctionnalités adaptées à votre usage',
        'Tableau de bord & exports',
        'Support selon configuration',
        'Multi-utilisateurs disponible',
        'API et intégrations possibles',
      ],
      target: 'Toutes tailles d\'entreprise',
      buttonText: 'Configurer mon offre',
      popular: true,
      icon: '📊'
    },
    {
      name: 'TORP Enterprise',
      price: 'Sur devis',
      period: '',
      subtitle: 'Solution sur-mesure',
      description: 'Offre personnalisée pour grandes entreprises',
      configuration: 'Volume élevé • Fonctionnalités avancées • Support dédié',
      features: [
        'Utilisateurs illimités',
        'White label personnalisé',
        'API complète + intégrations ERP/CRM',
        'Account manager dédié',
        'Formation sur-site',
        'Support prioritaire',
      ],
      additionalServices: [
        'Setup initial inclus',
        'Consulting personnalisé',
        'Intégration sur-mesure',
        'Support premium'
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
      price: 649,
      period: '€ HT/an',
      subtitle: '64,90€ HT/mois',
      description: 'Analyses illimitées pour certification',
      configuration: '200 analyses/mois • Score TORP • Certification PDF',
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
      price: 1490,
      period: '€ HT/an',
      subtitle: '149€ HT/mois',
      description: 'Analyse détaillée + rapports personnalisés',
      configuration: '500 analyses/mois • Analyse complète • Rapports personnalisés',
      features: [
        'Tous les avantages Standard',
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
      configuration: 'Volume adapté • Analytics avancés • Support dédié',
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
      configuration: 'Illimité • IA prédictive • Consulting inclus',
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
      case 'B2C': return b2cPacks;
      case 'B2B': return b2bPlans;
      case 'B2G': return b2gPlans;
      case 'B2B2C': return b2b2cPlans;
      default: return b2cPacks;
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
                        <>
                          <span className="text-4xl font-bold text-foreground">
                            {userType === 'B2B' && typeof plan.price === 'number' && !plan.isCustom && isAnnual ? 
                              Math.round(plan.price * 10) : 
                              plan.price}€
                          </span>
                          {userType === 'B2B' && !plan.isCustom && isAnnual && (
                            <span className="text-base text-muted-foreground">/an</span>
                          )}
                        </>
                      ) : (
                        <span className="text-3xl font-bold text-foreground">
                          {plan.price}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {userType === 'B2B' && typeof plan.price === 'number' && !plan.isCustom && isAnnual ? 
                        'Facturé annuellement (-2 mois)' : 
                        plan.period}
                    </p>
                  </div>
                  <p className="text-muted-foreground">{plan.description}</p>
                  
                  {plan.configuration && (
                    <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                      {plan.configuration}
                    </p>
                  )}
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Configurateur B2B */}
                  {plan.isCustom && userType === 'B2B' && (
                    <div className="space-y-4 p-4 bg-muted/20 rounded-lg">
                      <h4 className="font-semibold text-sm">Configurez votre offre :</h4>
                      
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium">Nombre de devis/mois</label>
                          <select 
                            value={devisCount} 
                            onChange={(e) => setDevisCount(Number(e.target.value))}
                            className="w-full mt-1 p-2 text-xs border rounded"
                          >
                            <option value={10}>10 devis/mois</option>
                            <option value={20}>20 devis/mois</option>
                            <option value={30}>30 devis/mois</option>
                            <option value={50}>50 devis/mois</option>
                            <option value={100}>100 devis/mois</option>
                            <option value={200}>200+ devis/mois</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-medium">Niveau de service</label>
                          <select 
                            value={serviceLevel} 
                            onChange={(e) => setServiceLevel(Number(e.target.value))}
                            className="w-full mt-1 p-2 text-xs border rounded"
                          >
                            {serviceOptions.map(option => (
                              <option key={option.id} value={option.id}>
                                {option.name} ({option.price}€/devis)
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-medium">Limite de projet</label>
                          <select 
                            value={projectLimit} 
                            onChange={(e) => setProjectLimit(Number(e.target.value))}
                            className="w-full mt-1 p-2 text-xs border rounded"
                          >
                            {limitOptions.map(option => (
                              <option key={option.id} value={option.id}>
                                {option.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            id="cctp-package"
                            checked={cctpPackage}
                            onChange={(e) => setCctpPackage(e.target.checked)}
                            className="w-3 h-3"
                          />
                          <label htmlFor="cctp-package" className="text-xs">
                            Package CCTP (+99€/mois)
                          </label>
                        </div>

                        <div className="text-center p-2 bg-primary/10 rounded">
                          <span className="text-sm font-bold">Votre tarif : {calculatePrice()}€ HT/mois</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {plan.features.map((feature, featureIndex) => (
                      <div key={featureIndex} className="flex items-start gap-3">
                        <Check className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-foreground">{feature}</span>
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
          {userType === 'B2B' && (
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
                        <span>+ Audit complet</span>
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
                  <span className="font-semibold">Information :</span> Nous proposons des fonctionnalités avancées mais ne garantissons aucun retour spécifique sur investissement.
                  <br />
                  <span className="text-xs">Formule : Prix mensuel = max(49€, 19€ + N × U × g × r) + Package CCTP optionnel</span>
                </p>
              </div>

              <div className="mt-6 p-4 bg-warning/10 rounded-lg">
                <h4 className="font-semibold text-sm mb-2">Package CCTP optionnel :</h4>
                <p className="text-xs text-muted-foreground">
                  Le package CCTP (Cahier des Charges Techniques Personnalisé) est disponible en option pour 99€/mois. 
                  Il inclut la génération automatique de documents contractuels personnalisés et contextuels, 
                  ainsi que le suivi interactif depuis votre espace client.
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
                    {userType === 'B2C' ? 'B2C - Offre Lancement' : 'B2B - Early Adopter'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {userType === 'B2C' ? (
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
                    {userType === 'B2C' ? 'Garantie Satisfaction' : 'POC Gratuit'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {userType === 'B2C' ? (
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
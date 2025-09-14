import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Check, Building, Zap, BarChart3, Crown } from 'lucide-react';

export default function B2BPricing() {
  const [isAnnual, setIsAnnual] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  // 5 Paliers par montant de devis
  const tiers = [
    { name: 'MICRO', limit: '≤5k€', target: 'Artisans 1-2 personnes' },
    { name: 'STARTER', limit: '≤15k€', target: 'TPE 3-5 personnes' },
    { name: 'BUSINESS', limit: '≤30k€', target: 'PME 5-10 personnes' },
    { name: 'PREMIUM', limit: '≤50k€', target: 'Entreprises 10-20 personnes' },
    { name: 'ENTERPRISE', limit: '+50k€', target: 'Grandes entreprises 20+ personnes' }
  ];

  // 3 Services par palier
  const getServicesForTier = (tierName: string) => {
    const basePrices = {
      'MICRO': { basic: 29, complet: 49, premium: 69 },
      'STARTER': { basic: 49, complet: 79, premium: 109 },
      'BUSINESS': { basic: 79, complet: 129, premium: 179 },
      'PREMIUM': { basic: 129, complet: 199, premium: 269 },
      'ENTERPRISE': { basic: 199, complet: 299, premium: 399 }
    };

    const prices = basePrices[tierName as keyof typeof basePrices];
    const annualPrices = {
      basic: Math.floor(prices.basic * 10), // 10 mois facturés = 2 mois offerts
      complet: Math.floor(prices.complet * 10),
      premium: Math.floor(prices.premium * 10)
    };

    return [
      {
        name: 'Basic',
        description: 'Fonctionnalités essentielles',
        price: isAnnual ? annualPrices.basic : prices.basic,
        period: isAnnual ? '€ HT/an' : '€ HT/mois',
        savings: isAnnual ? `Économie: ${(prices.basic * 2)}€/an` : null,
        features: [
          'Score TORP + certification',
          'QR Code sur devis',
          'Dashboard basique',
          'Support email',
          'Formation onboarding 2h'
        ],
        icon: <Zap className="w-5 h-5" />,
        popular: false
      },
      {
        name: 'Complet',
        description: 'Solution professionnelle',
        price: isAnnual ? annualPrices.complet : prices.complet,
        period: isAnnual ? '€ HT/an' : '€ HT/mois',
        savings: isAnnual ? `Économie: ${(prices.complet * 2)}€/an` : null,
        features: [
          'Tout Basic +',
          'Analyses détaillées + recommandations',
          'Analytics avancés & KPIs',
          'API & intégrations',
          'Support téléphonique prioritaire',
          'Formation équipe incluse'
        ],
        icon: <BarChart3 className="w-5 h-5" />,
        popular: true
      },
      {
        name: 'Premium',
        description: 'Solution complète',
        price: isAnnual ? annualPrices.premium : prices.premium,
        period: isAnnual ? '€ HT/an' : '€ HT/mois',
        savings: isAnnual ? `Économie: ${(prices.premium * 2)}€/an` : null,
        features: [
          'Tout Complet +',
          'CCTP + comparaisons',
          'Audit illimités',
          'Rapports personnalisés',
          'Account manager dédié',
          'Support premium 24/7'
        ],
        icon: <Crown className="w-5 h-5" />,
        popular: false
      }
    ];
  };

  return (
    <div className="space-y-8">
      {/* En-tête B2B */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-foreground mb-4">
          Entreprises BTP - Professionnalisez vos devis
        </h2>
        <p className="text-lg text-muted-foreground mb-2">
          <strong>"Professionnalisez vos devis selon vos ambitions"</strong>
        </p>
        <p className="text-muted-foreground">
          5 paliers par montant de devis × 3 services = 15 combinaisons
        </p>
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
          <Badge variant="outline" className="bg-success-light text-success border-success">
            -20% (2 mois offerts)
          </Badge>
        )}
      </div>

      {/* Innovation : Équité Tarifaire */}
      <div className="bg-primary-light border border-primary/20 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Building className="w-6 h-6 text-primary" />
          <h3 className="text-xl font-semibold text-foreground">
            Innovation : Équité Tarifaire par Montant de Devis
          </h3>
        </div>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div>
            <h4 className="font-medium text-foreground mb-2">Principe :</h4>
            <p className="text-muted-foreground">Plus gros projets = analyse plus poussée = prix justifié</p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-2">Évolution :</h4>
            <p className="text-muted-foreground">Clients grandissent avec leurs projets naturellement</p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-2">Avantage :</h4>
            <p className="text-muted-foreground">Barrière concurrentielle par compréhension métier BTP</p>
          </div>
        </div>
      </div>

      {/* Étape 1: Choix du palier par montant */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-center text-foreground">
          Étape 1: Quel est le montant maximum de vos devis ?
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {tiers.map((tier) => (
            <Card 
              key={tier.name}
              className={`cursor-pointer transition-all hover:shadow-medium ${
                selectedTier === tier.name 
                  ? 'border-primary shadow-strong bg-primary-light' 
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => setSelectedTier(tier.name)}
            >
              <CardContent className="p-4 text-center">
                <h4 className="font-bold text-foreground text-lg">{tier.name}</h4>
                <p className="text-sm text-primary font-medium">{tier.limit}</p>
                <p className="text-xs text-muted-foreground mt-2">{tier.target}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Étape 2: Choix du service (si palier sélectionné) */}
      {selectedTier && (
        <div className="space-y-6">
          <h3 className="text-xl font-semibold text-center text-foreground">
            Étape 2: Quels services voulez-vous pour le palier {selectedTier} ?
          </h3>
          
          <div className="grid lg:grid-cols-3 gap-6">
            {getServicesForTier(selectedTier).map((service, index) => (
              <Card key={index} className={`relative ${service.popular ? 'border-primary shadow-strong' : 'border-border'}`}>
                {service.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-4 py-1">
                      <BarChart3 className="w-3 h-3 mr-1" />
                      Recommandé
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="text-primary">{service.icon}</div>
                    <CardTitle className="text-xl font-bold">{service.name}</CardTitle>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-3xl font-bold text-foreground">
                        {service.price}
                      </span>
                      <span className="text-sm text-muted-foreground">{service.period}</span>
                    </div>
                    {service.savings && (
                      <p className="text-xs text-success font-medium">{service.savings}</p>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{service.description}</p>
                </CardHeader>

                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {service.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button 
                    className="w-full"
                    variant={service.popular ? "default" : "outline"}
                  >
                    Choisir {service.name}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* CTA Section */}
      <div className="text-center bg-muted/20 rounded-lg p-8">
        <h3 className="text-2xl font-bold text-foreground mb-4">
          Conversion via B2C - Sourcing Inversé
        </h3>
        <p className="text-muted-foreground mb-6">
          Les particuliers utilisant notre suivi paiements invitent automatiquement les entreprises non-TORP à s'inscrire gratuitement, créant une conversion naturelle vers nos abonnements B2B.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button>
            Démarrer l'essai gratuit
          </Button>
          <Button variant="outline">
            Demander une démo
          </Button>
        </div>
      </div>
    </div>
  );
}
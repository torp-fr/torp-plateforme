import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Check, Award, Target, Users, Building2 } from 'lucide-react';

export default function B2B2CPricing() {
  const [isAnnual, setIsAnnual] = useState(true);

  const b2b2cPlans = [
    {
      name: 'Standard',
      description: 'Analyses illimitées pour certification',
      price: isAnnual ? 649 : 64.90,
      period: isAnnual ? '€ HT/an' : '€ HT/mois',
      savings: isAnnual ? 'Économisez 129€ par an' : null,
      features: [
        'Analyses TORP illimitées (max 200/mois)',
        'Score TORP 0-10 avec justification',
        'Certificat PDF basique à joindre',
        'Dashboard prescripteur (historique 6 mois)',
        '2 utilisateurs maximum',
        'Support email standard',
        'Au-delà 200/mois : 3€ HT/analyse'
      ],
      targets: [
        'Syndics indépendants',
        'Architectes individuels',
        'Agences immobilières locales',
        'Petits bureaux d\'études'
      ],
      buttonText: 'Choisir Standard',
      popular: true,
      icon: <Award className="w-6 h-6" />
    },
    {
      name: 'Premium',
      description: 'Analyse détaillée + rapports personnalisés',
      price: isAnnual ? 1490 : 149,
      period: isAnnual ? '€ HT/an' : '€ HT/mois',
      savings: isAnnual ? 'Économisez 298€ par an' : null,
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
        'Au-delà 500/mois : 2€ HT/analyse'
      ],
      targets: [
        'Maîtres d\'œuvre',
        'Bureaux d\'études moyens',
        'Syndics professionnels',
        'Cabinets d\'architecture'
      ],
      buttonText: 'Choisir Premium',
      popular: false,
      icon: <Target className="w-6 h-6" />
    }
  ];

  const segments = [
    {
      name: 'Syndics',
      description: 'Certification entreprises pour AG copropriétés',
      icon: <Building2 className="w-5 h-5" />,
      usage: '1 syndic = 50+ certifications/an'
    },
    {
      name: 'Architectes',
      description: 'Validation entreprises recommandées',
      icon: <Users className="w-5 h-5" />,
      usage: 'Légitimité auprès clients finaux'
    },
    {
      name: 'Maîtres d\'œuvre',
      description: 'Certification devis artisans',
      icon: <Award className="w-5 h-5" />,
      usage: 'Sécurisation recommandations'
    },
    {
      name: 'Bureaux d\'études',
      description: 'Expertise technique validée',
      icon: <Target className="w-5 h-5" />,
      usage: 'Crédibilité technique renforcée'
    }
  ];

  return (
    <div className="space-y-8">
      {/* En-tête B2B2C */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-foreground mb-4">
          Prescripteurs - Certifiez vos recommandations
        </h2>
        <p className="text-lg text-muted-foreground mb-2">
          <strong>"Certifiez la qualité des entreprises que vous recommandez"</strong>
        </p>
        <p className="text-muted-foreground">
          Analyses illimitées avec limites anti-abus pour tous types de prescripteurs
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
            -17%
          </Badge>
        )}
      </div>

      {/* Segments cibles */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {segments.map((segment, index) => (
          <Card key={index} className="border-border hover:border-primary/50 transition-colors">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="text-primary">{segment.icon}</div>
                <h4 className="font-semibold text-foreground">{segment.name}</h4>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{segment.description}</p>
              <p className="text-xs text-primary font-medium">{segment.usage}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Innovation : Effet Levier */}
      <div className="bg-primary-light border border-primary/20 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Target className="w-6 h-6 text-primary" />
          <h3 className="text-xl font-semibold text-foreground">
            Innovation : Effet Levier - Multiplication Organique
          </h3>
        </div>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div>
            <h4 className="font-medium text-foreground mb-2">Principe :</h4>
            <p className="text-muted-foreground">1 prescripteur = 50+ certifications/an minimum</p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-2">Impact :</h4>
            <p className="text-muted-foreground">Certification renforce crédibilité TORP globalement</p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-2">Synergies :</h4>
            <p className="text-muted-foreground">Prescription croisée vers autres segments</p>
          </div>
        </div>
      </div>

      {/* Plans B2B2C */}
      <div className="grid lg:grid-cols-2 gap-8">
        {b2b2cPlans.map((plan, index) => (
          <Card key={index} className={`relative ${plan.popular ? 'border-primary shadow-strong' : 'border-border'}`}>
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground px-4 py-1">
                  <Award className="w-3 h-3 mr-1" />
                  Recommandé
                </Badge>
              </div>
            )}
            
            <CardHeader className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="text-primary">{plan.icon}</div>
                <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold text-foreground">
                    {plan.price}
                  </span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>
                {plan.savings && (
                  <p className="text-sm text-success font-medium">{plan.savings}</p>
                )}
              </div>
              <p className="text-muted-foreground">{plan.description}</p>
            </CardHeader>

            <CardContent className="space-y-6">
              <ul className="space-y-3">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="p-4 bg-muted/30 rounded-lg">
                <h4 className="font-medium text-foreground mb-2">Idéal pour :</h4>
                <ul className="space-y-1">
                  {plan.targets.map((target, targetIndex) => (
                    <li key={targetIndex} className="text-xs text-muted-foreground">
                      • {target}
                    </li>
                  ))}
                </ul>
              </div>

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

      {/* Usage Principal */}
      <div className="bg-muted/20 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-foreground mb-4 text-center">
          Usage Principal des Prescripteurs
        </h3>
        <div className="text-center max-w-4xl mx-auto">
          <p className="text-muted-foreground mb-4">
            Les prescripteurs utilisent TORP pour <strong>valider/certifier les devis des entreprises qu'ils recommandent</strong>, 
            apportant légitimité et crédibilité auprès de leurs clients finaux.
          </p>
          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div>
              <h4 className="font-medium text-foreground mb-2">Avant TORP :</h4>
              <p className="text-sm text-muted-foreground">
                Recommandation basée sur la confiance personnelle uniquement
              </p>
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-2">Avec TORP :</h4>
              <p className="text-sm text-muted-foreground">
                Certification technique objective + légitimité institutionnelle
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA final */}
      <div className="text-center">
        <Button size="lg" className="px-8">
          <Award className="w-4 h-4 mr-2" />
          Commencer la certification
        </Button>
      </div>
    </div>
  );
}
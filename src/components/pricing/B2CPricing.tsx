import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Shield, FileText, Users, Eye } from 'lucide-react';

export default function B2CPricing() {
  const b2cPlans = [
    {
      name: 'Analyse Flash',
      description: 'Première évaluation rapide',
      price: 9.90,
      icon: <Eye className="w-6 h-6" />,
      features: [
        'Vérification cohérence tarifs vs marché',
        'Détection anomalies majeures', 
        'Score TORP simplifié (A à E)',
        'Rapport PDF 2 pages'
      ],
      usage: 'Projets modestes, vérification rapide',
      value: 'Un œil expert pour éviter les arnaques',
      buttonText: 'Analyse Flash',
      popular: false
    },
    {
      name: 'Analyse Complète',
      description: 'Analyse technique complète + Suivi paiements',
      price: 19.90,
      icon: <Shield className="w-6 h-6" />,
      features: [
        'Tout Analyse Flash +',
        'Vérification conformité technique (DTU)',
        'Évaluation qualité entreprise',
        '🔐 SUIVI PAIEMENTS INTÉGRÉ',
        'Rapport PDF 4-5 pages'
      ],
      usage: 'Projets standards + Suivi paiements',
      value: 'Audit expert + Paiements sécurisés',
      buttonText: 'Analyse Complète',
      popular: true
    },
    {
      name: 'Comparaison Multi-devis',
      description: 'Choisir entre plusieurs devis',
      price: 29.90,
      icon: <Users className="w-6 h-6" />,
      features: [
        'Analyse de jusqu\'à 3 devis',
        'Tableau comparatif détaillé',
        'Recommandation finale argumentée',
        '🔐 SUIVI PAIEMENTS INTÉGRÉ'
      ],
      usage: 'Plusieurs devis + Suivi paiements',
      value: 'Choisir + Sécuriser en toute sérénité',
      buttonText: 'Comparer mes devis',
      popular: false
    },
    {
      name: 'Analyse + CCTP',
      description: 'Protection contractuelle maximale',
      price: 44.90,
      icon: <FileText className="w-6 h-6" />,
      features: [
        'Analyse complète + génération CCTP personnalisé',
        'Document contractuellement engageant',
        '🔐 SUIVI PAIEMENTS INTÉGRÉ',
        'Protection maximale client'
      ],
      usage: 'Gros projets, besoin de sécurisation contractuelle',
      value: 'Cahier des charges + Paiements trackés',
      buttonText: 'Pack Complet',
      popular: false
    }
  ];

  return (
    <div className="space-y-8">
      {/* En-tête B2C */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-foreground mb-4">
          Particuliers - Expertise accessible
        </h2>
        <p className="text-lg text-muted-foreground mb-2">
          <strong>"L'expertise BTP accessible à tous les budgets + Paiements sécurisés"</strong>
        </p>
        <p className="text-muted-foreground">
          Pay-per-use TTC avec suivi paiements intégré (dès Analyse Complète)
        </p>
      </div>

      {/* Innovation Suivi Paiements */}
      <div className="bg-primary-light border border-primary/20 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-6 h-6 text-primary" />
          <h3 className="text-xl font-semibold text-foreground">
            Innovation : Suivi Paiements Tiers de Confiance
          </h3>
        </div>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-medium text-foreground mb-2">Comment ça marche :</h4>
            <ul className="space-y-1 text-muted-foreground">
              <li>✓ Client génère lien paiement sécurisé</li>
              <li>✓ Entreprise s'inscrit gratuitement sur TORP</li>
              <li>✓ Demandes paiement structurées par étapes</li>
              <li>✓ TORP suit sans commission (tiers neutre)</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-2">Différenciation unique :</h4>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Analyse experte + Sécurisation financière</li>
              <li>• Position tiers de confiance sans commission</li>
              <li>• Protection mutuelle client/entreprise</li>
              <li>• Conversion automatique entreprises vers B2B</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Grille des plans B2C */}
      <div className="grid lg:grid-cols-2 xl:grid-cols-4 gap-6">
        {b2cPlans.map((plan, index) => (
          <Card key={index} className={`relative ${plan.popular ? 'border-primary shadow-strong' : 'border-border'}`}>
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground px-4 py-1">
                  <Shield className="w-3 h-3 mr-1" />
                  Recommandé
                </Badge>
              </div>
            )}
            
            <CardHeader className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="text-primary">{plan.icon}</div>
                <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-3xl font-bold text-foreground">
                    {plan.price}€
                  </span>
                  <span className="text-sm text-muted-foreground">TTC</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{plan.description}</p>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="p-3 bg-primary-light/50 rounded-lg border border-primary/20">
                <p className="text-xs text-primary font-medium">
                  <strong>Value :</strong> {plan.value}
                </p>
              </div>

              <ul className="space-y-2">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  <strong>Usage :</strong> {plan.usage}
                </p>
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
    </div>
  );
}
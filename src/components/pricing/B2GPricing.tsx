import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Building, MapPin, Users, Crown, BarChart3 } from 'lucide-react';

export default function B2GPricing() {
  const [selectedCollectivity, setSelectedCollectivity] = useState<string | null>(null);

  const collectivities = [
    {
      name: 'Région',
      population: '5M habitants',
      observatory: 60000,
      participation: { minimal: 300000, recommended: 600000, optimal: 1200000 },
      coverage: 'Toute la région + inter-régional',
      canRefacture: 'Peut refacturer départements/métropoles',
      icon: <Crown className="w-6 h-6" />
    },
    {
      name: 'Département', 
      population: '500k habitants',
      observatory: 10000,
      participation: { minimal: 30000, recommended: 60000, optimal: 120000 },
      coverage: 'Tout le département + communal',
      canRefacture: 'Peut refacturer communes du département',
      icon: <MapPin className="w-6 h-6" />
    },
    {
      name: 'Métropole/Agglo',
      population: '400k habitants', 
      observatory: 6000,
      participation: { minimal: 20000, recommended: 40000, optimal: 80000 },
      coverage: 'Communes métropolitaines + benchmarks',
      canRefacture: 'Peut refacturer communes membres',
      icon: <Building className="w-6 h-6" />
    },
    {
      name: 'CDC',
      population: '100k habitants',
      observatory: 3000,
      participation: { minimal: 5000, recommended: 12000, optimal: 25000 },
      coverage: 'Communes intercommunales + analytics',
      canRefacture: 'Peut refacturer communes membres',
      icon: <Users className="w-6 h-6" />
    },
    {
      name: 'Commune',
      population: '50k habitants',
      observatory: 1500,
      participation: { minimal: 2000, recommended: 5000, optimal: 10000 },
      coverage: 'Données commune + rapports',
      canRefacture: 'Financement propre uniquement',
      icon: <Building className="w-6 h-6" />
    }
  ];

  const getParticipationOptions = (collectivity: any) => [
    {
      name: 'Minimal',
      budget: collectivity.participation.minimal,
      capture: collectivity.name === 'Commune' ? '8%' : '10%',
      description: 'Couverture de base',
      popular: false
    },
    {
      name: 'Recommandé',
      budget: collectivity.participation.recommended,
      capture: collectivity.name === 'CDC' ? '22%' : collectivity.name === 'Commune' ? '18%' : '20%',
      description: 'Couverture équilibrée',
      popular: true
    },
    {
      name: 'Optimal',
      budget: collectivity.participation.optimal,
      capture: collectivity.name === 'CDC' ? '45%' : collectivity.name === 'Commune' ? '35%' : '40%',
      description: 'Couverture maximale',
      popular: false
    }
  ];

  return (
    <div className="space-y-8">
      {/* En-tête B2G */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-foreground mb-4">
          Collectivités - Premier service public numérique BTP
        </h2>
        <p className="text-lg text-muted-foreground mb-2">
          <strong>"Premier service public numérique BTP territorial"</strong>
        </p>
        <p className="text-muted-foreground">
          Double facturation : Observatoire + Enveloppe participation habitants
        </p>
      </div>

      {/* Innovation : Service Public */}
      <div className="bg-primary-light border border-primary/20 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Building className="w-6 h-6 text-primary" />
          <h3 className="text-xl font-semibold text-foreground">
            Innovation : Premier Service Public Numérique BTP Territorial
          </h3>
        </div>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-medium text-foreground mb-2">Composante 1 - Observatoire :</h4>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Facturé immédiatement</li>
              <li>• Analytics territoire temps réel</li>
              <li>• Benchmarks inter-territoriaux</li>
              <li>• Dashboard dédié collectivité</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-2">Composante 2 - Participation :</h4>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Enveloppe crédits habitants</li>
              <li>• Taux participation modulable 30-100%</li>
              <li>• Décompte automatique à l'usage</li>
              <li>• Collectivité couvre partiellement</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Principe Couverture Hiérarchique */}
      <div className="bg-warning-light border border-warning/20 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <MapPin className="w-6 h-6 text-warning" />
          <h3 className="text-xl font-semibold text-foreground">
            Règle Anti-Doublon : Couverture Hiérarchique
          </h3>
        </div>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div>
            <h4 className="font-medium text-foreground mb-2">Principe :</h4>
            <p className="text-muted-foreground">Un seul payeur par territoire selon hiérarchie</p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-2">Exemple :</h4>
            <p className="text-muted-foreground">Région adhérente → Communes accès gratuit automatique</p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-2">Fallback :</h4>
            <p className="text-muted-foreground">Si région non-adhérente → Département peut couvrir</p>
          </div>
        </div>
      </div>

      {/* Étape 1: Choix type de collectivité */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-center text-foreground">
          Quel type de collectivité êtes-vous ?
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {collectivities.map((collectivity) => (
            <Card 
              key={collectivity.name}
              className={`cursor-pointer transition-all hover:shadow-medium ${
                selectedCollectivity === collectivity.name 
                  ? 'border-primary shadow-strong bg-primary-light' 
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => setSelectedCollectivity(collectivity.name)}
            >
              <CardContent className="p-4 text-center">
                <div className="flex justify-center mb-2 text-primary">
                  {collectivity.icon}
                </div>
                <h4 className="font-bold text-foreground">{collectivity.name}</h4>
                <p className="text-xs text-muted-foreground">{collectivity.population}</p>
                <div className="mt-2 pt-2 border-t border-border">
                  <p className="text-xs text-primary font-medium">
                    Observatoire: {collectivity.observatory.toLocaleString()}€ HT/an
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Détail collectivité sélectionnée */}
      {selectedCollectivity && (
        <div className="space-y-6">
          {(() => {
            const collectivity = collectivities.find(c => c.name === selectedCollectivity)!;
            const totalBudgets = {
              minimal: collectivity.observatory + collectivity.participation.minimal,
              recommended: collectivity.observatory + collectivity.participation.recommended,
              optimal: collectivity.observatory + collectivity.participation.optimal
            };

            return (
              <>
                <h3 className="text-xl font-semibold text-center text-foreground">
                  Configuration pour {collectivity.name} ({collectivity.population})
                </h3>

                {/* Informations collectivité */}
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="border-border">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-primary" />
                        Observatoire Territorial
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Prix annuel :</span>
                        <span className="font-bold text-foreground">{collectivity.observatory.toLocaleString()}€ HT</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p><strong>Accès données :</strong> {collectivity.coverage}</p>
                        <p><strong>Refacturation :</strong> {collectivity.canRefacture}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Users className="w-5 h-5 text-primary" />
                        Algorithme de Calcul
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        <strong>Formule :</strong> (Foyers × 12% Taux Travaux × Taux Capture × 15€ Prix Moyen)
                      </p>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>• Foyers estimés territoire : ~{Math.floor(parseInt(collectivity.population.replace(/[^\d]/g, '')) * 0.4).toLocaleString()}</p>
                        <p>• Taux travaux annuel : 12%</p>
                        <p>• Prix moyen analyse : 15€</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Options de participation */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-center text-foreground">
                    Choisissez votre niveau de participation habitants
                  </h4>
                  <div className="grid lg:grid-cols-3 gap-6">
                    {getParticipationOptions(collectivity).map((option, index) => (
                      <Card key={index} className={`relative ${option.popular ? 'border-primary shadow-strong' : 'border-border'}`}>
                        {option.popular && (
                          <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                            <Badge className="bg-primary text-primary-foreground px-4 py-1">
                              Recommandé
                            </Badge>
                          </div>
                        )}
                        
                        <CardHeader className="text-center">
                          <CardTitle className="text-xl">{option.name}</CardTitle>
                          <div className="space-y-2">
                            <div className="text-sm text-muted-foreground">Enveloppe participation</div>
                            <div className="text-2xl font-bold text-foreground">
                              {option.budget.toLocaleString()}€ HT
                            </div>
                            <div className="text-sm text-primary font-medium">
                              Capture {option.capture} du marché
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-4">
                          <div className="p-3 bg-muted/30 rounded-lg">
                            <div className="text-sm space-y-1">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Observatoire :</span>
                                <span className="font-medium">{collectivity.observatory.toLocaleString()}€</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Participation :</span>
                                <span className="font-medium">{option.budget.toLocaleString()}€</span>
                              </div>
                              <hr className="border-border" />
                              <div className="flex justify-between font-bold">
                                <span>TOTAL :</span>
                                <span className="text-primary">
                                  {(collectivity.observatory + option.budget).toLocaleString()}€ HT/an
                                </span>
                              </div>
                            </div>
                          </div>

                          <Button 
                            className="w-full"
                            variant={option.popular ? "default" : "outline"}
                          >
                            Choisir {option.name}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Mécanisme participation */}
                <div className="bg-muted/20 rounded-lg p-6">
                  <h4 className="font-semibold text-foreground mb-3">Mécanisme de Participation</h4>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <h5 className="font-medium text-foreground mb-2">Fonctionnement :</h5>
                      <ul className="space-y-1 text-muted-foreground">
                        <li>• Collectivité choisit taux participation (30% à 100%)</li>
                        <li>• Appliqué sur prix HT analyses TORP (-15% collectivités)</li>
                        <li>• Habitant paie reliquat + TVA totale</li>
                        <li>• Crédits décomptés automatiquement à l'usage</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-medium text-foreground mb-2">Dashboard inclus :</h5>
                      <ul className="space-y-1 text-muted-foreground">
                        <li>• Observatoire territorial temps réel</li>
                        <li>• Gestion participation (curseur 30-100%)</li>
                        <li>• Suivi crédits et consommation</li>
                        <li>• Analytics usage et comparaisons</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* CTA Section */}
      <div className="text-center bg-gradient-hero text-white rounded-lg p-8">
        <h3 className="text-2xl font-bold mb-4">
          Stratégie Commerciale : Priorité Absolue B2G
        </h3>
        <p className="mb-6 opacity-90">
          Ciblage hiérarchique : 13 Régions (8,58M€ potentiel) → Départements → Métropoles → Communes
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button variant="outline" className="bg-white text-primary hover:bg-white/90">
            <Building className="w-4 h-4 mr-2" />
            Demander un devis personnalisé
          </Button>
          <Button variant="outline" className="bg-white text-primary hover:bg-white/90">
            Contacter l'équipe dédiée
          </Button>
        </div>
      </div>
    </div>
  );
}
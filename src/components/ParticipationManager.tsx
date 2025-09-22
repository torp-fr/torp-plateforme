import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Euro, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Settings, 
  Download,
  CreditCard,
  Target,
  BarChart3,
  RefreshCw,
  Calculator
} from 'lucide-react';

interface BudgetConfig {
  initialAmount: number;
  currentAmount: number;
  consumedAmount: number;
  participationRate: number;
  dailyConsumption: number;
  projectedEndDate: string;
}

const ParticipationManager = () => {
  const [participationRate, setParticipationRate] = useState([70]);
  const [budgetConfig, setBudgetConfig] = useState<BudgetConfig>({
    initialAmount: 60000,
    currentAmount: 42500,
    consumedAmount: 17500,
    participationRate: 70,
    dailyConsumption: 285,
    projectedEndDate: '2024-12-15'
  });

  // Calculs temps réel
  const participationValue = participationRate[0];
  const remainingPercentage = (budgetConfig.currentAmount / budgetConfig.initialAmount) * 100;
  const daysRemaining = Math.floor(budgetConfig.currentAmount / budgetConfig.dailyConsumption);
  const monthlyProjection = budgetConfig.dailyConsumption * 30;

  // Simulations d'impact
  const impactSimulation = {
    currentCapture: Math.round((participationValue / 100) * 1247), // Nb analyses simulées
    potentialCapture: Math.round(1247 * 0.85), // Max théorique
    citizenSavings: Math.round(17500 * 0.7), // Économies citoyens
    avgAnalysisPrice: 15
  };

  const alerts = [
    {
      type: 'warning',
      message: 'Budget sous le seuil de 80% - Rechargement recommandé dans 2 semaines',
      action: 'Planifier rechargement'
    },
    {
      type: 'info', 
      message: 'Pic saisonnier détecté - Consommation +25% vs mois précédent',
      action: 'Ajuster prévisions'
    }
  ];

  const monthlyStats = [
    { month: 'Mars', analyses: 387, montant: 8750, economiesCitoyens: 6125 },
    { month: 'Février', analyses: 342, montant: 7980, economiesCitoyens: 5586 },
    { month: 'Janvier', analyses: 298, montant: 6850, economiesCitoyens: 4795 }
  ];

  return (
    <div className="space-y-6">
      {/* Header avec contrôle participation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Euro className="w-5 h-5 text-primary" />
            Gestion Participation Financière Territoriale
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Curseur participation temps réel */}
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-lg">Taux de Participation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-primary">{participationValue}%</div>
                    <div className="text-sm text-muted-foreground">de prise en charge</div>
                  </div>
                  
                  <Slider
                    value={participationRate}
                    onValueChange={setParticipationRate}
                    min={30}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                  
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>30% Min</span>
                    <span>100% Max</span>
                  </div>
                  
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span>Prix citoyen (15€) :</span>
                        <span className="font-medium">{(15 * (1 - participationValue/100)).toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Prise en charge :</span>
                        <span className="font-medium text-primary">{(15 * participationValue/100).toFixed(2)}€</span>
                      </div>
                    </div>
                  </div>
                  
                  <Button className="w-full" size="sm">
                    <Settings className="w-4 h-4 mr-2" />
                    Appliquer nouveau taux
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* État budget actuel */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Enveloppe Budgétaire</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{budgetConfig.currentAmount.toLocaleString()}€</div>
                    <div className="text-sm text-muted-foreground">disponible sur {budgetConfig.initialAmount.toLocaleString()}€</div>
                  </div>
                  
                  <Progress value={remainingPercentage} className="h-3" />
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-center p-2 bg-green-50 dark:bg-green-950 rounded">
                      <div className="font-bold text-green-600 dark:text-green-400">{remainingPercentage.toFixed(1)}%</div>
                      <div className="text-xs text-green-700 dark:text-green-300">Restant</div>
                    </div>
                    <div className="text-center p-2 bg-blue-50 dark:bg-blue-950 rounded">
                      <div className="font-bold text-blue-600 dark:text-blue-400">{daysRemaining}j</div>
                      <div className="text-xs text-blue-700 dark:text-blue-300">Autonomie</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Consommé ce mois :</span>
                      <span className="font-medium">{budgetConfig.consumedAmount.toLocaleString()}€</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Projection mensuelle :</span>
                      <span className="font-medium">{monthlyProjection.toLocaleString()}€</span>
                    </div>
                  </div>
                  
                  <Button variant="outline" size="sm" className="w-full">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Recharger enveloppe
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Impact et métriques */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Impact Territorial</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-center p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                      <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                        {impactSimulation.currentCapture}
                      </div>
                      <div className="text-xs text-purple-700 dark:text-purple-300">Analyses financées</div>
                    </div>
                    <div className="text-center p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                      <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                        {((impactSimulation.currentCapture / 1247) * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-orange-700 dark:text-orange-300">Taux capture</div>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                    <div className="text-lg font-bold text-green-600 dark:text-green-400">
                      {impactSimulation.citizenSavings.toLocaleString()}€
                    </div>
                    <div className="text-sm text-green-700 dark:text-green-300">Économies citoyens générées</div>
                  </div>
                  
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Prix moyen analyse :</span>
                      <span className="font-medium">{impactSimulation.avgAnalysisPrice}€</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Capture potentielle :</span>
                      <span className="font-medium">{impactSimulation.potentialCapture} projets</span>
                    </div>
                  </div>
                  
                  <Button variant="outline" size="sm" className="w-full">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Rapport d'impact
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Alertes budgétaires */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Alertes Budgétaires
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map((alert, index) => (
                <Alert key={index} className={alert.type === 'warning' ? 'border-warning' : 'border-blue-200'}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>{alert.message}</span>
                    <Button size="sm" variant="outline">
                      {alert.action}
                    </Button>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analytics détaillés */}
      <Tabs defaultValue="evolution" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="evolution">Évolution</TabsTrigger>
          <TabsTrigger value="simulation">Simulations</TabsTrigger>
          <TabsTrigger value="export">Exports</TabsTrigger>
        </TabsList>

        <TabsContent value="evolution">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Évolution Consommation & Impact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {monthlyStats.map((stat, index) => (
                    <div key={index} className="p-4 border rounded-lg space-y-2">
                      <div className="font-medium text-foreground">{stat.month} 2024</div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Analyses :</span>
                          <span className="font-medium">{stat.analyses}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Budget :</span>
                          <span className="font-medium">{stat.montant.toLocaleString()}€</span>
                        </div>
                        <div className="flex justify-between text-green-600 dark:text-green-400">
                          <span>Économies :</span>
                          <span className="font-medium">{stat.economiesCitoyens.toLocaleString()}€</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-muted/30 rounded-lg">
                  <h4 className="font-medium mb-3">Tendances Détectées</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="font-medium">Adoption croissante</span>
                      </div>
                      <p className="text-muted-foreground">+13% d'analyses par mois depuis janvier</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-blue-500" />
                        <span className="font-medium">ROI citoyen</span>
                      </div>
                      <p className="text-muted-foreground">Retour 4.2x sur investissement collectivité</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="simulation">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                Simulateur Budgétaire
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Scénarios de Participation</h4>
                  <div className="space-y-3">
                    {[
                      { rate: 30, analyses: 374, budget: 18000, savings: 12600 },
                      { rate: 50, analyses: 623, budget: 30000, savings: 21000 },
                      { rate: 70, analyses: 872, budget: 42000, savings: 29400 },
                      { rate: 100, analyses: 1247, budget: 60000, savings: 42000 }
                    ].map((scenario, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <Badge variant={scenario.rate === participationValue ? 'default' : 'outline'}>
                            {scenario.rate}% participation
                          </Badge>
                          <Button size="sm" variant="ghost" className="text-xs">
                            Simuler
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <div className="font-medium">{scenario.analyses}</div>
                            <div className="text-muted-foreground">analyses</div>
                          </div>
                          <div>
                            <div className="font-medium">{scenario.budget.toLocaleString()}€</div>
                            <div className="text-muted-foreground">budget</div>
                          </div>
                          <div>
                            <div className="font-medium text-green-600">{scenario.savings.toLocaleString()}€</div>
                            <div className="text-muted-foreground">économies</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Optimisation Recommandée</h4>
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                    <div className="text-sm space-y-2">
                      <p><strong>Recommandation IA :</strong> Passer à 85% de participation</p>
                      <p className="text-muted-foreground">
                        Basé sur l'analyse des tendances, une participation à 85% optimiserait 
                        votre ROI territorial tout en maximisant l'adoption citoyenne.
                      </p>
                      <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                        <div>
                          <div className="font-medium">+156 analyses/mois</div>
                          <div className="text-muted-foreground">vs actuel</div>
                        </div>
                        <div>
                          <div className="font-medium">+2.3k€ économies</div>
                          <div className="text-muted-foreground">citoyens/mois</div>
                        </div>
                      </div>
                    </div>
                    <Button size="sm" className="mt-3">
                      Appliquer recommandation
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                Exports & Rapports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-medium">Rapports Standards</h4>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start">
                      <Download className="w-4 h-4 mr-2" />
                      Rapport mensuel conseil municipal
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <Download className="w-4 h-4 mr-2" />
                      Dashboard exécutif PDF
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <Download className="w-4 h-4 mr-2" />
                      Données anonymisées Open Data
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <Download className="w-4 h-4 mr-2" />
                      Export Excel détaillé
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium">Rapports Personnalisés</h4>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start">
                      <Settings className="w-4 h-4 mr-2" />
                      Configurer rapport périodique
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Programmation automatique
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <Target className="w-4 h-4 mr-2" />
                      Rapport sur-mesure
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="font-medium text-sm">Conformité RGPD & Transparence</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Tous les exports respectent les règles d'anonymisation et de confidentialité. 
                  Les données personnelles sont automatiquement masquées selon le niveau d'habilitation.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ParticipationManager;
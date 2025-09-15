import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Building2, 
  TrendingUp, 
  MapPin, 
  Users, 
  AlertTriangle,
  CheckCircle,
  Euro,
  BarChart3,
  PieChart,
  Settings,
  Download,
  Map,
  Shield,
  Lightbulb,
  TreePine,
  Home,
  Construction,
  Zap,
  Award,
  Target,
  Activity
} from "lucide-react";

const CollectivitesDashboard = () => {
  const kpisTerritoriaux = [
    {
      title: "Devis Analysés",
      value: "1,247",
      change: "+18.2%",
      period: "Ce mois",
      icon: BarChart3,
      color: "bg-blue-500"
    },
    {
      title: "Montant Économique",
      value: "€2.8M",
      change: "+25.6%",
      period: "Trimestre",
      icon: Euro,
      color: "bg-green-500"
    },
    {
      title: "Score Territorial",
      value: "B+",
      change: "+0.3pts",
      period: "Évolution",
      icon: Award,
      color: "bg-purple-500"
    },
    {
      title: "Économies Générées",
      value: "€187k",
      change: "+31%",
      period: "Arnaques évitées",
      icon: Shield,
      color: "bg-orange-500"
    }
  ];

  const typologieTravaux = [
    { type: "Rénovation Énergétique", pourcentage: 42, montant: "€1.2M", projets: 523 },
    { type: "Construction Neuve", pourcentage: 28, montant: "€780k", projets: 189 },
    { type: "Rénovation Traditionnelle", pourcentage: 23, montant: "€645k", projets: 387 },
    { type: "Maintenance/Dépannage", pourcentage: 7, montant: "€195k", projets: 148 }
  ];

  const quartiers = [
    { nom: "Centre-Ville", projets: 234, score: "A-", montantMoyen: "€15.2k" },
    { nom: "Quartier Nord", projets: 189, score: "B+", montantMoyen: "€12.8k" },
    { nom: "Zone Sud", projets: 156, score: "B", montantMoyen: "€18.1k" },
    { nom: "Secteur Est", projets: 198, score: "B+", montantMoyen: "€14.5k" },
    { nom: "Périphérie Ouest", projets: 102, score: "C+", montantMoyen: "€11.3k" }
  ];

  const alertesCritiques = [
    { 
      type: "critical", 
      titre: "Acompte suspect détecté", 
      description: "Entreprise demandant 65% d'acompte - Quartier Nord",
      action: "Alerte citoyens",
      time: "Il y a 1h"
    },
    { 
      type: "warning", 
      titre: "Hausse prix matériaux", 
      description: "Isolation +22% par rapport au mois dernier",
      action: "Surveillance",
      time: "Il y a 3h"
    },
    { 
      type: "info", 
      titre: "Nouveau record mensuel", 
      description: "147 devis analysés cette semaine",
      action: "Communication",
      time: "Il y a 6h"
    }
  ];

  const entreprisesLocales = [
    { nom: "EcoBat Solutions", score: "A", projets: 87, specialite: "Rénovation énergétique" },
    { nom: "Constructions Durables", score: "A-", projets: 65, specialite: "Construction neuve" },
    { nom: "Artisans Réunis", score: "B+", projets: 43, specialite: "Rénovation générale" },
    { nom: "TechBat Innovation", score: "A-", projets: 39, specialite: "Domotique" }
  ];

  const stars = Array.from({length: 5}, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Building2 className="w-8 h-8 text-primary" />
              Observatoire Territorial BTP
            </h1>
            <p className="text-muted-foreground mt-2">Premier service public numérique BTP territorial</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="success">Observatoire: 10k€/an</Badge>
              <Badge variant="outline">Participation: 70% active</Badge>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Rapport
            </Button>
            <Button variant="outline" size="sm">
              <Map className="w-4 h-4 mr-2" />
              Cartographie
            </Button>
            <Button variant="default" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Configuration
            </Button>
          </div>
        </div>

        <Tabs defaultValue="executive" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="executive">Vue Exécutive</TabsTrigger>
            <TabsTrigger value="operational">Opérationnel</TabsTrigger>
            <TabsTrigger value="citizens">Citoyens</TabsTrigger>
            <TabsTrigger value="participation">Participation</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="alerts">Alertes</TabsTrigger>
          </TabsList>

          <TabsContent value="executive" className="space-y-6">
            {/* KPIs Territoriaux */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {kpisTerritoriaux.map((kpi, index) => {
                const Icon = kpi.icon;
                return (
                  <Card key={index} className="relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-1 h-full ${kpi.color}`} />
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{kpi.value}</div>
                      <div className="flex items-center justify-between mt-2">
                        <Badge variant="default">{kpi.change}</Badge>
                        <span className="text-xs text-muted-foreground">{kpi.period}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Vue d'ensemble territoriale */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5" />
                    Répartition des Travaux
                  </CardTitle>
                  <CardDescription>Distribution par type de projet</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {typologieTravaux.map((type, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">{type.type}</span>
                          <div className="text-right">
                            <div className="text-sm font-bold">{type.pourcentage}%</div>
                            <div className="text-xs text-muted-foreground">{type.projets} projets</div>
                          </div>
                        </div>
                        <Progress value={type.pourcentage} className="h-2" />
                        <div className="text-xs text-muted-foreground text-right">{type.montant}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Impact Économique Territorial
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">€187k</div>
                        <div className="text-sm text-green-700 dark:text-green-300">Arnaques évitées</div>
                      </div>
                      <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">94%</div>
                        <div className="text-sm text-blue-700 dark:text-blue-300">Satisfaction citoyens</div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm">Retombées économiques locales</span>
                        <span className="font-medium">€2.1M</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Emplois BTP soutenus</span>
                        <span className="font-medium">847</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Entreprises actives</span>
                        <span className="font-medium">156</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="operational" className="space-y-6">
            {/* Observatoire des travaux locaux */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Observatoire Géographique
                </CardTitle>
                <CardDescription>Répartition des projets par secteur territorial</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                  {quartiers.map((quartier, index) => (
                    <div key={index} className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">{quartier.nom}</h4>
                        <Badge variant="outline">{quartier.score}</Badge>
                      </div>
                      <div className="text-2xl font-bold">{quartier.projets}</div>
                      <div className="text-xs text-muted-foreground">projets</div>
                      <div className="text-sm font-medium">{quartier.montantMoyen}</div>
                      <div className="text-xs text-muted-foreground">montant moyen</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Entreprises locales */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Construction className="w-5 h-5" />
                  Tissu Entrepreneurial Local
                </CardTitle>
                <CardDescription>Entreprises BTP actives sur le territoire</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {entreprisesLocales.map((entreprise, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <Badge variant={entreprise.score.startsWith('A') ? 'default' : 'secondary'}>
                          {entreprise.score}
                        </Badge>
                        <div>
                          <h4 className="font-medium">{entreprise.nom}</h4>
                          <p className="text-sm text-muted-foreground">{entreprise.specialite}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{entreprise.projets} projets</div>
                        <div className="text-sm text-muted-foreground">Cette année</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="citizens" className="space-y-6">
            {/* Baromètre citoyen */}
            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Adoption Service
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">2,847</div>
                  <p className="text-sm text-muted-foreground mt-1">citoyens utilisateurs</p>
                  <Progress value={68} className="mt-3" />
                  <p className="text-xs text-muted-foreground mt-2">68% de la population cible</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Satisfaction
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">4.7/5</div>
                  <p className="text-sm text-muted-foreground mt-1">note moyenne service</p>
                  <div className="flex gap-1 mt-3">
                    {stars.map((star) => (
                      <div key={star} className={`w-4 h-4 rounded ${star <= 5 ? 'bg-yellow-400' : 'bg-gray-200'}`} />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">94% recommanderaient</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Protection Effective
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">€187k</div>
                  <p className="text-sm text-muted-foreground mt-1">économies citoyens</p>
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Arnaques évitées</span>
                      <span className="font-medium">23</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Litiges prévenus</span>
                      <span className="font-medium">47</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Communication publique */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5" />
                  Communication & Transparence
                </CardTitle>
                <CardDescription>Données publiques anonymisées pour les citoyens</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-4">
                    <h4 className="font-medium">Prix de Référence Territoriaux</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Isolation combles (100m²)</span>
                        <span className="font-medium">€2,400 - €3,200</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Pompe à chaleur</span>
                        <span className="font-medium">€8,500 - €12,000</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Fenêtres PVC (unité)</span>
                        <span className="font-medium">€450 - €650</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h4 className="font-medium">Conseils Saisonniers</h4>
                    <div className="space-y-2 text-sm">
                      <p>🍂 <strong>Automne :</strong> Période idéale pour l'isolation</p>
                      <p>❄️ <strong>Hiver :</strong> Planification des travaux de printemps</p>
                      <p>🌸 <strong>Printemps :</strong> Pic d'activité, anticipez vos projets</p>
                      <p>☀️ <strong>Été :</strong> Travaux extérieurs et toiture</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {/* Analytics avancées */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TreePine className="w-5 h-5" />
                    Transition Énergétique
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Logements rénovés/an</span>
                      <span className="font-medium">12.3%</span>
                    </div>
                    <Progress value={12.3} />
                    
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div className="p-3 bg-green-50 dark:bg-green-950 rounded">
                        <div className="text-lg font-bold text-green-600 dark:text-green-400">-847t</div>
                        <div className="text-xs text-green-700 dark:text-green-300">CO2 évitées</div>
                      </div>
                      <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded">
                        <div className="text-lg font-bold text-blue-600 dark:text-blue-400">€1.2M</div>
                        <div className="text-xs text-blue-700 dark:text-blue-300">Aides mobilisées</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Prédictions IA
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded">
                      <h4 className="font-medium text-blue-800 dark:text-blue-200">Pic d'activité prévu</h4>
                      <p className="text-sm text-blue-700 dark:text-blue-300">Mars-Avril : +35% de projets attendus</p>
                    </div>
                    
                    <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded">
                      <h4 className="font-medium text-orange-800 dark:text-orange-200">Risque pénurie</h4>
                      <p className="text-sm text-orange-700 dark:text-orange-300">Isolation : délais +15% prévus</p>
                    </div>
                    
                    <div className="p-3 bg-green-50 dark:bg-green-950 rounded">
                      <h4 className="font-medium text-green-800 dark:text-green-200">Opportunité</h4>
                      <p className="text-sm text-green-700 dark:text-green-300">5 nouvelles entreprises certifiées</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-6">
            {/* Centre d'alertes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Centre d'Alertes Territorial
                </CardTitle>
                <CardDescription>Monitoring temps réel et alertes critiques</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {alertesCritiques.map((alerte, index) => (
                    <div key={index} className="flex items-start gap-4 p-4 border rounded-lg">
                      <div className={`w-3 h-3 rounded-full mt-1 ${
                        alerte.type === 'critical' ? 'bg-red-500' :
                        alerte.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                      }`} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{alerte.titre}</h4>
                          <Badge variant="outline">{alerte.action}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{alerte.description}</p>
                        <p className="text-xs text-muted-foreground mt-2">{alerte.time}</p>
                      </div>
                      <Button size="sm" variant="outline">Action</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Système de monitoring */}
            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Performance Service</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">99.8%</div>
                  <p className="text-sm text-muted-foreground">Disponibilité</p>
                  <Progress value={99.8} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Qualité Analyses</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">94.3%</div>
                  <p className="text-sm text-muted-foreground">Précision</p>
                  <Progress value={94.3} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Temps Réponse</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">Moins de 30s</div>
                  <p className="text-sm text-muted-foreground">Moyenne</p>
                  <div className="mt-2 h-2 bg-secondary rounded">
                    <div className="h-2 bg-purple-500 rounded w-4/5"></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CollectivitesDashboard;
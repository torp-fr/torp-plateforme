import { useState } from "react";
import { Header } from "@/components/Header";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ClientPortfolio } from "@/components/ClientPortfolio";
import { AutoRecommendations } from "@/components/AutoRecommendations";
import { 
  Target,
  Users, 
  FileText, 
  TrendingUp, 
  Award,
  Plus,
  Download,
  Eye,
  Building,
  Phone,
  Mail,
  Calendar,
  BarChart3,
  CheckCircle,
  Clock,
  Star,
  Shield,
  Zap,
  Settings,
  UserCheck,
  Activity
} from "lucide-react";

export default function B2B2CDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [prescriptorLevel] = useState("Premium"); // Standard ou Premium

  // Mock data for prescriptor stats
  const stats = {
    monthlyAnalyses: 47,
    totalClients: 156,
    conversionRate: 73,
    valueGenerated: 340000,
    npsScore: 67,
    savedAmount: 45200
  };

  const clientSegments = [
    { segment: "Acquéreurs immobilier", clients: 45, analyses: 23, conversion: 78, color: "bg-blue-500" },
    { segment: "Copropriétés", clients: 38, analyses: 18, conversion: 85, color: "bg-green-500" },
    { segment: "Investisseurs", clients: 28, analyses: 12, conversion: 65, color: "bg-purple-500" },
    { segment: "Particuliers premium", clients: 45, analyses: 19, conversion: 71, color: "bg-orange-500" }
  ];

  const recentAnalyses = [
    {
      id: 1,
      clientName: "M. Dupont",
      projectType: "Rénovation énergétique",
      company: "EcoBat Solutions",
      amount: "€24,500",
      score: "A-",
      recommendations: "Validé - Entreprise recommandée",
      date: "2024-01-22",
      status: "completed"
    },
    {
      id: 2,
      clientName: "Copro Les Jardins",
      projectType: "Ravalement façade",
      company: "RénoPro Façades",
      amount: "€67,800",
      score: "B+",
      recommendations: "Points d'amélioration identifiés",
      date: "2024-01-21",
      status: "completed"
    },
    {
      id: 3,
      clientName: "Mme Martin",
      projectType: "Cuisine équipée",
      company: "CuisinePlus",
      amount: "€18,200",
      score: "A",
      recommendations: "Excellent - Aucun risque détecté",
      date: "2024-01-20",
      status: "completed"
    }
  ];

  const clientFeedback = [
    {
      client: "M. Rousseau",
      project: "Extension maison",
      rating: 5,
      comment: "Grâce à l'analyse TORP, j'ai évité une arnaque à 15k€. Merci !",
      date: "2024-01-18"
    },
    {
      client: "Syndic ABC",
      project: "Toiture copropriété",
      rating: 5,
      comment: "Certification TORP = gage de qualité pour nos AG",
      date: "2024-01-16"
    },
    {
      client: "Famille Dubois",
      project: "Pompe à chaleur",
      rating: 4,
      comment: "Analyse très détaillée, nous a rassurés sur notre choix",
      date: "2024-01-15"
    }
  ];

  const enterpriseNetwork = [
    { name: "EcoBat Solutions", score: "A", certifications: 34, specialty: "Rénovation énergétique", clients: 12 },
    { name: "BatiPro Excellence", score: "A-", certifications: 28, specialty: "Construction neuve", clients: 8 },
    { name: "RénoPro Façades", score: "B+", certifications: 22, specialty: "Ravalement", clients: 6 },
    { name: "CuisinePlus", score: "A", certifications: 19, specialty: "Cuisine & SDB", clients: 9 }
  ];

  const usageStats = {
    currentMonth: 47,
    limit: prescriptorLevel === "Premium" ? 500 : 200,
    overage: 0
  };

  const getScoreColor = (score: string) => {
    if (score.startsWith('A')) return 'success';
    if (score.startsWith('B')) return 'warning';
    return 'destructive';
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <BackButton />
        
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning/10 rounded-lg">
                <Target className="h-6 w-6 text-warning" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Dashboard Prescripteur B2B2C</h1>
                <p className="text-muted-foreground">Multipliez votre impact conseil par l'expertise TORP</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={prescriptorLevel === "Premium" ? "default" : "outline"}>
                    {prescriptorLevel}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {prescriptorLevel === "Premium" ? "197€ HT/mois" : "147€ HT/mois"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Rapport mensuel
              </Button>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle certification
              </Button>
            </div>
          </div>

          {/* Stats rapides */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-foreground">{stats.monthlyAnalyses}</div>
                <div className="text-xs text-muted-foreground">Analyses ce mois</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-primary">{stats.totalClients}</div>
                <div className="text-xs text-muted-foreground">Clients actifs</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-success">{stats.conversionRate}%</div>
                <div className="text-xs text-muted-foreground">Taux conversion</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-warning">{(stats.valueGenerated / 1000).toFixed(0)}k€</div>
                <div className="text-xs text-muted-foreground">Valeur générée</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-info">+{stats.npsScore}</div>
                <div className="text-xs text-muted-foreground">NPS Score</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-destructive">{(stats.savedAmount / 1000).toFixed(0)}k€</div>
                <div className="text-xs text-muted-foreground">Économies clients</div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
              <TabsList className="inline-flex h-auto min-w-full w-max p-2 bg-transparent gap-1">
                <TabsTrigger value="overview" className="whitespace-nowrap">Vue d'ensemble</TabsTrigger>
                <TabsTrigger value="portfolio" className="whitespace-nowrap relative">
                  <span className="font-semibold">Portefeuille Clients</span>
                  <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0.5">NEW</Badge>
                </TabsTrigger>
                <TabsTrigger value="recommendations" className="whitespace-nowrap relative">
                  <span className="font-semibold">Recommandations IA</span>
                  <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0.5">NEW</Badge>
                </TabsTrigger>
                <TabsTrigger value="analyses" className="whitespace-nowrap">Certifications</TabsTrigger>
                <TabsTrigger value="clients" className="whitespace-nowrap">Clients</TabsTrigger>
                <TabsTrigger value="network" className="whitespace-nowrap">Réseau Entreprises</TabsTrigger>
                <TabsTrigger value="performance" className="whitespace-nowrap">Performance</TabsTrigger>
                <TabsTrigger value="settings" className="whitespace-nowrap">Paramètres</TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value="overview" className="space-y-6">
            {/* Performance metrics */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Performance Prescription
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Analyses prescrites</span>
                      <span className="font-bold text-primary">{stats.monthlyAnalyses} ce mois</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Taux de conversion clients</span>
                      <span className="font-bold text-success">{stats.conversionRate}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Valeur projets sécurisés</span>
                      <span className="font-bold text-warning">{(stats.valueGenerated / 1000).toFixed(0)}k€</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">ROI démontré</span>
                      <Badge variant="success">Excellent</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Répartition Clientèle
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {clientSegments.map((segment, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">{segment.segment}</span>
                          <div className="text-right">
                            <div className="text-sm font-bold">{segment.clients} clients</div>
                            <div className="text-xs text-muted-foreground">{segment.conversion}% conversion</div>
                          </div>
                        </div>
                        <Progress value={(segment.clients / stats.totalClients) * 100} className="h-2" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Usage and limits */}
            <Card className="border-warning/20 bg-gradient-to-r from-warning/5 to-warning/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-warning" />
                  Quota Mensuel - {prescriptorLevel}
                </CardTitle>
                <CardDescription>
                  Analyses illimitées avec protection anti-abus
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-warning">{usageStats.currentMonth}</div>
                    <div className="text-sm text-muted-foreground">Analyses ce mois</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">{usageStats.limit}</div>
                    <div className="text-sm text-muted-foreground">Limite mensuelle</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-success">{usageStats.limit - usageStats.currentMonth}</div>
                    <div className="text-sm text-muted-foreground">Analyses restantes</div>
                  </div>
                </div>
                <Progress value={(usageStats.currentMonth / usageStats.limit) * 100} className="mt-4" />
                <p className="text-xs text-muted-foreground mt-2">
                  Au-delà de {usageStats.limit} analyses : {prescriptorLevel === "Premium" ? "2€ HT" : "3€ HT"} par analyse supplémentaire
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="portfolio" className="space-y-6">
            <ClientPortfolio />
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-6">
            <AutoRecommendations />
          </TabsContent>

          <TabsContent value="analyses" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Certifications Récentes
                </CardTitle>
                <CardDescription>
                  Analyses TORP prescrites pour vos clients
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentAnalyses.map((analysis) => (
                    <div key={analysis.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-medium">{analysis.clientName}</h4>
                            <Badge variant={getScoreColor(analysis.score)}>
                              Score {analysis.score}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                            <div>
                              <span className="font-medium">Projet:</span> {analysis.projectType}
                            </div>
                            <div>
                              <span className="font-medium">Entreprise:</span> {analysis.company}
                            </div>
                            <div>
                              <span className="font-medium">Montant:</span> {analysis.amount}
                            </div>
                            <div>
                              <span className="font-medium">Date:</span> {analysis.date}
                            </div>
                          </div>
                          <div className="mt-2">
                            <Badge variant="outline" className="text-xs">
                              {analysis.recommendations}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-1" />
                            Rapport
                          </Button>
                          <Button variant="outline" size="sm">
                            <Phone className="h-4 w-4 mr-1" />
                            Client
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clients" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5" />
                    Retours Clients
                  </CardTitle>
                  <CardDescription>
                    Satisfaction et témoignages de vos clients
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {clientFeedback.map((feedback, index) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium text-sm">{feedback.client}</h5>
                          <div className="flex items-center gap-1">
                            {Array.from({length: 5}, (_, i) => (
                              <Star 
                                key={i} 
                                className={`h-3 w-3 ${i < feedback.rating ? 'text-yellow-500 fill-current' : 'text-muted-foreground'}`} 
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground italic">"{feedback.comment}"</p>
                        <div className="flex items-center justify-between mt-2">
                          <Badge variant="outline" className="text-xs">{feedback.project}</Badge>
                          <span className="text-xs text-muted-foreground">{feedback.date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Impact Métier
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Réduction litiges post-vente</span>
                        <span className="font-bold text-success">-67%</span>
                      </div>
                      <Progress value={67} className="h-2" />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Fidélisation clients</span>
                        <span className="font-bold text-primary">+23 pts NPS</span>
                      </div>
                      <Progress value={85} className="h-2" />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Différenciation concurrentielle</span>
                        <Badge variant="success">Forte</Badge>
                      </div>
                      <Progress value={90} className="h-2" />
                    </div>

                    <div className="pt-4 border-t">
                      <h5 className="font-medium mb-2">Argument commercial quantifié :</h5>
                      <p className="text-sm text-muted-foreground">
                        "Certification TORP = {stats.savedAmount.toLocaleString()}€ d'économies générées pour mes clients cette année"
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="network" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Réseau Entreprises Certifiées
                </CardTitle>
                <CardDescription>
                  Entreprises que vous recommandez avec certification TORP
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {enterpriseNetwork.map((enterprise, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-medium">{enterprise.name}</h4>
                            <Badge variant={getScoreColor(enterprise.score)}>
                              Score {enterprise.score}
                            </Badge>
                            <Badge variant="outline">
                              {enterprise.certifications} certifications
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                            <div>
                              <span className="font-medium">Spécialité:</span> {enterprise.specialty}
                            </div>
                            <div>
                              <span className="font-medium">Vos clients:</span> {enterprise.clients} recommandations
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-1" />
                            Profil
                          </Button>
                          <Button variant="outline" size="sm">
                            <Phone className="h-4 w-4 mr-1" />
                            Contact
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Évolution Mensuelle
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Analyses prescrites</span>
                      <div className="text-right">
                        <span className="font-bold">{stats.monthlyAnalyses}</span>
                        <Badge variant="success" className="ml-2">+34%</Badge>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Nouveaux clients</span>
                      <div className="text-right">
                        <span className="font-bold">12</span>
                        <Badge variant="success" className="ml-2">+15%</Badge>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Taux de satisfaction</span>
                      <div className="text-right">
                        <span className="font-bold">4.7/5</span>
                        <Badge variant="success" className="ml-2">+0.3</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Objectifs & Récompenses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Objectif mensuel</span>
                        <span className="font-bold">40 analyses</span>
                      </div>
                      <Progress value={(stats.monthlyAnalyses / 40) * 100} className="h-2" />
                      <p className="text-xs text-success mt-1">Objectif dépassé ! 🎉</p>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Badge "Expert TORP"</span>
                        <Badge variant="default">Débloqué</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">+100 certifications réalisées</p>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Prochaine récompense</span>
                        <span className="font-bold">Formation gratuite</span>
                      </div>
                      <Progress value={75} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">15 nouveaux clients à atteindre</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Configuration Compte
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Abonnement {prescriptorLevel}</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      {prescriptorLevel === "Premium" ? "197€ HT/mois - Analyses détaillées + Rapports personnalisés" : "147€ HT/mois - Analyses illimitées + Certification"}
                    </p>
                    <Button variant="outline" size="sm">
                      {prescriptorLevel === "Standard" ? "Upgrader vers Premium" : "Gérer abonnement"}
                    </Button>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Intégration API</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Connectez TORP à votre CRM/ERP existant
                    </p>
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4 mr-1" />
                      Configurer
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5" />
                    Support & Formation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Formation Équipe</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Webinaires mensuels + Support dédié
                    </p>
                    <Button variant="outline" size="sm">
                      <Calendar className="h-4 w-4 mr-1" />
                      Prochaine session
                    </Button>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Account Manager</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      {prescriptorLevel === "Premium" ? "Marie Dupont - Disponible" : "Disponible en Premium"}
                    </p>
                    <Button variant="outline" size="sm" disabled={prescriptorLevel !== "Premium"}>
                      <Phone className="h-4 w-4 mr-1" />
                      Contacter
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
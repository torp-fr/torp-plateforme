import { useState } from "react";
import { Header } from "@/components/Header";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdvancedAnalytics } from "@/components/AdvancedAnalytics";
import { ActiveAssistant } from "@/components/ActiveAssistant";
import { PaymentManager } from "@/components/PaymentManager";
import { MarketplaceTab } from "@/components/marketplace/MarketplaceTab";
import { MultiProjectManagement } from "@/components/MultiProjectManagement";
import { TeamScheduler } from "@/components/TeamScheduler";
import { 
  Building2, 
  Users, 
  Target, 
  Euro, 
  Settings,
  Plus,
  Download,
  Upload,
  FileText,
  Calendar,
  BarChart3,
  UserCheck,
  Truck,
  Receipt,
  ShoppingCart,
  Award,
  QrCode,
  TrendingUp,
  CheckCircle,
  Clock,
  AlertTriangle,
  Zap,
  Star,
  Activity
} from "lucide-react";

export default function ImprovedB2BDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedTier] = useState("BUSINESS"); // MICRO, STARTER, BUSINESS, PREMIUM, ENTERPRISE
  const [selectedService] = useState("Complet"); // Basic, Complet, Premium

  const companyStats = {
    activeProjects: 23,
    totalRevenue: 456780,
    teamMembers: 12,
    clientSatisfaction: 4.7,
    averageScore: 8.7,
    monthlyGrowth: 12.5,
    torpScore: "B+",
    conversionRate: 34.2,
    responseTime: 2.3,
    conformityRate: 96
  };

  // Subscription tiers and pricing
  const subscriptionInfo = {
    tier: selectedTier,
    service: selectedService,
    monthlyPrice: selectedTier === "BUSINESS" && selectedService === "Complet" ? 129 : 79,
    features: selectedService === "Premium" ? "Tout inclus + CCTP + Audit illimité" : 
              selectedService === "Complet" ? "Analyses détaillées + Recommandations" :
              "Score TORP + Certification + QR Code"
  };

  const teamMembers = [
    { id: 1, name: 'Jean Dupont', role: 'Chef d\'équipe', projects: 8, score: 9.1, status: 'Actif' },
    { id: 2, name: 'Marie Martin', role: 'Commerciale', projects: 12, score: 8.8, status: 'Actif' },
    { id: 3, name: 'Pierre Durand', role: 'Technicien', projects: 5, score: 8.5, status: 'Congés' },
    { id: 4, name: 'Sophie Leblanc', role: 'Devis/Admin', projects: 15, score: 9.2, status: 'Actif' }
  ];

  const suppliers = [
    { id: 1, name: 'Matériaux Pro', category: 'Matériaux', contact: 'contact@materiaux-pro.fr', lastOrder: '2024-01-20', amount: 15600, reliability: 95 },
    { id: 2, name: 'Outillage Expert', category: 'Outillage', contact: 'vente@outillage-expert.com', lastOrder: '2024-01-18', amount: 8900, reliability: 88 },
    { id: 3, name: 'Élec Fournitures', category: 'Électricité', contact: 'pro@elec-fournitures.fr', lastOrder: '2024-01-22', amount: 12300, reliability: 92 }
  ];

  const invoices = [
    { id: 'F-2024-001', client: 'Résidence Modern', amount: 45600, status: 'Payée', date: '2024-01-15', dueDate: '2024-02-15' },
    { id: 'F-2024-002', client: 'Villa Contemporaine', amount: 28900, status: 'En attente', date: '2024-01-20', dueDate: '2024-02-20' },
    { id: 'F-2024-003', client: 'Copro Les Jardins', amount: 67800, status: 'En retard', date: '2024-01-10', dueDate: '2024-02-10' }
  ];

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'payée': 
      case 'actif': return 'success';
      case 'en attente': 
      case 'congés': return 'warning';
      case 'en retard': return 'destructive';
      default: return 'secondary';
    }
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
              <div className="p-2 bg-primary/10 rounded-lg">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Dashboard Entreprise B2B</h1>
                <p className="text-muted-foreground">Professionnalisez vos devis selon vos ambitions</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="default">{subscriptionInfo.tier} - {subscriptionInfo.service}</Badge>
                  <span className="text-sm text-muted-foreground">{subscriptionInfo.monthlyPrice}€ HT/mois</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exporter
              </Button>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nouveau projet
              </Button>
            </div>
          </div>

          {/* Stats rapides */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-6">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-foreground">{companyStats.activeProjects}</div>
                <div className="text-xs text-muted-foreground">Projets actifs</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-success">{(companyStats.totalRevenue / 1000).toFixed(0)}k€</div>
                <div className="text-xs text-muted-foreground">CA mensuel</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-primary">{companyStats.teamMembers}</div>
                <div className="text-xs text-muted-foreground">Équipe</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-foreground">{companyStats.clientSatisfaction}</div>
                <div className="text-xs text-muted-foreground">Satisfaction /5</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-warning">{companyStats.torpScore}</div>
                <div className="text-xs text-muted-foreground">Score TORP</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-success">+{companyStats.monthlyGrowth}%</div>
                <div className="text-xs text-muted-foreground">Croissance</div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
              <TabsList className="inline-flex h-auto min-w-full w-max p-2 bg-transparent gap-1">
                <TabsTrigger value="overview" className="whitespace-nowrap">Vue d'ensemble</TabsTrigger>
                <TabsTrigger value="projects" className="whitespace-nowrap relative">
                  <span className="font-semibold">Gestion Projets</span>
                  <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0.5">NEW</Badge>
                </TabsTrigger>
                <TabsTrigger value="planning" className="whitespace-nowrap relative">
                  <span className="font-semibold">Planning Équipe</span>
                  <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0.5">NEW</Badge>
                </TabsTrigger>
                <TabsTrigger value="tools" className="whitespace-nowrap">Outils Métier</TabsTrigger>
                <TabsTrigger value="analytics" className="whitespace-nowrap">Analytics</TabsTrigger>
                <TabsTrigger value="team" className="whitespace-nowrap">Équipe</TabsTrigger>
                <TabsTrigger value="suppliers" className="whitespace-nowrap">Fournitures</TabsTrigger>
                <TabsTrigger value="marketplace" className="whitespace-nowrap">Marketplace</TabsTrigger>
                <TabsTrigger value="invoicing" className="whitespace-nowrap">Facturation</TabsTrigger>
                <TabsTrigger value="payments" className="whitespace-nowrap">Paiements</TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value="overview" className="space-y-6">
            {/* Subscription status */}
            <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  Votre Formule TORP - {subscriptionInfo.tier} {subscriptionInfo.service}
                </CardTitle>
                <CardDescription>
                  {subscriptionInfo.features} - {subscriptionInfo.monthlyPrice}€ HT/mois
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{companyStats.torpScore}</div>
                    <div className="text-sm text-muted-foreground">Score TORP moyen</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-success">{companyStats.conversionRate}%</div>
                    <div className="text-sm text-muted-foreground">Taux conversion</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-warning">{companyStats.conformityRate}%</div>
                    <div className="text-sm text-muted-foreground">Conformité projets</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Performance Commerciale
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Taux de conversion</span>
                      <div className="text-right">
                        <span className="font-bold text-success">{companyStats.conversionRate}%</span>
                        <Badge variant="success" className="ml-2">+5%</Badge>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Pipeline actuel</span>
                      <span className="font-bold">{(companyStats.totalRevenue / 1000).toFixed(0)}k€</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Délai moyen réponse</span>
                      <span className="font-bold text-primary">{companyStats.responseTime}h</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Objectif mensuel</span>
                      <Badge variant="success">Atteint</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Différenciation TORP
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Score TORP moyen</span>
                      <Badge variant="success" className="font-bold">{companyStats.torpScore}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">QR Code certification</span>
                      <div className="flex items-center gap-2">
                        <QrCode className="h-4 w-4 text-primary" />
                        <Badge variant="outline">Actif</Badge>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Satisfaction client</span>
                      <Badge variant="success" className="font-bold">{companyStats.clientSatisfaction}/5</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Évolution qualité</span>
                      <Badge variant="success">+0.4pts ce mois</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Actions Rapides</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button variant="outline" className="h-20 flex flex-col gap-2">
                    <Upload className="h-5 w-5" />
                    <span className="text-xs">Analyser devis</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col gap-2">
                    <FileText className="h-5 w-5" />
                    <span className="text-xs">Générer devis</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col gap-2">
                    <QrCode className="h-5 w-5" />
                    <span className="text-xs">QR Code certif</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col gap-2">
                    <Settings className="h-5 w-5" />
                    <span className="text-xs">Paramètres</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projects" className="space-y-6">
            <MultiProjectManagement />
          </TabsContent>

          <TabsContent value="planning" className="space-y-6">
            <TeamScheduler />
          </TabsContent>

          <TabsContent value="tools" className="space-y-6">
            {/* Professional tools section */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Générateur Devis Intelligent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">Templates 20+ secteurs</h4>
                      <p className="text-sm text-muted-foreground">Plomberie, électricité, maçonnerie...</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">Auto-completion IA</h4>
                      <p className="text-sm text-muted-foreground">Prix et matériaux contextuels</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">Preview Score TORP</h4>
                      <p className="text-sm text-muted-foreground">Simulation avant envoi client</p>
                    </div>
                    <Button className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Créer un devis
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Certification et QR Code
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg bg-primary/5">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">Badge TORP Pro</h4>
                        <Badge variant="success">Actif</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">Logo sur devis et supports marketing</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">QR Code Certification</h4>
                        <QrCode className="h-5 w-5 text-primary" />
                      </div>
                      <p className="text-sm text-muted-foreground">Client scanne = analyse flash gratuite</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-1">Score visible: {companyStats.torpScore}</h4>
                      <p className="text-sm text-muted-foreground">Note sur chaque devis</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Optimization suggestions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Optimisations Suggérées IA
                </CardTitle>
                <CardDescription>3-5 actions d'amélioration ce mois</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg border-success/20 bg-success/5">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      <h4 className="font-medium">Améliorer descriptions techniques</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">+0.3pts score TORP attendu</p>
                  </div>
                  
                  <div className="p-4 border rounded-lg border-warning/20 bg-warning/5">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-warning" />
                      <h4 className="font-medium">Réduire délai réponse</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">Objectif: 2h (actuellement {companyStats.responseTime}h)</p>
                  </div>
                  
                  <div className="p-4 border rounded-lg border-primary/20 bg-primary/5">
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="h-4 w-4 text-primary" />
                      <h4 className="font-medium">Optimiser prix matériaux</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">Économies détectées sur 3 postes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <AdvancedAnalytics userType="B2B" />
          </TabsContent>

          <TabsContent value="team" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5" />
                    Gestion d'équipe
                  </CardTitle>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter membre
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {teamMembers.map((member) => (
                    <div key={member.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-medium">{member.name}</h4>
                            <Badge variant="outline">{member.role}</Badge>
                            <Badge variant={getStatusColor(member.status)}>
                              {member.status}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground">
                            <span>Projets: {member.projects}</span>
                            <span>Score: {member.score}/10</span>
                            <span>Performance: Excellente</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm">Profil</Button>
                          <Button variant="outline" size="sm">Planning</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="suppliers" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    Fournisseurs et matériaux
                  </CardTitle>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Nouveau fournisseur
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {suppliers.map((supplier) => (
                    <div key={supplier.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-medium">{supplier.name}</h4>
                            <Badge variant="outline">{supplier.category}</Badge>
                            <Badge variant={supplier.reliability > 90 ? 'success' : 'warning'}>
                              Fiabilité: {supplier.reliability}%
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground">
                            <span>Contact: {supplier.contact}</span>
                            <span>Dernière commande: {supplier.lastOrder}</span>
                            <span>CA: {supplier.amount.toLocaleString()}€</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm">Commander</Button>
                          <Button variant="outline" size="sm">Historique</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoicing" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-5 w-5" />
                    Facturation et suivi
                  </CardTitle>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Nouvelle facture
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {invoices.map((invoice) => (
                    <div key={invoice.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-medium">{invoice.id}</h4>
                            <Badge variant={getStatusColor(invoice.status)}>
                              {invoice.status}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-4 gap-4 text-sm text-muted-foreground">
                            <span>Client: {invoice.client}</span>
                            <span>Montant: {invoice.amount.toLocaleString()}€</span>
                            <span>Émise: {invoice.date}</span>
                            <span>Échéance: {invoice.dueDate}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm">
                            <Download className="h-4 w-4 mr-1" />
                            PDF
                          </Button>
                          <Button variant="outline" size="sm">Relancer</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="space-y-6">
            <PaymentManager 
              projectId="1" 
              userType="B2B" 
              projectAmount="150000"
            />
          </TabsContent>

          <TabsContent value="marketplace" className="space-y-6">
            <MarketplaceTab 
              userType="B2B" 
              projectContext={{
                projectType: "commercial",
                analysisResult: { score: companyStats.averageScore }
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Assistant actif */}
      <ActiveAssistant userType="B2B" context={activeTab} />
    </div>
  );
}
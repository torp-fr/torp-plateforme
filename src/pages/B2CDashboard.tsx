import { useState } from "react";
import { Header } from "@/components/Header";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useApp } from '@/context/AppContext';
import { Link } from 'react-router-dom';
import { 
  Home,
  FileText, 
  TrendingUp, 
  PiggyBank, 
  Shield,
  Plus,
  Clock,
  CheckCircle,
  AlertTriangle,
  QrCode,
  Upload,
  Download,
  Eye,
  Star,
  Users,
  CreditCard,
  Building,
  Phone,
  Hammer,
  Activity,
  BarChart3,
  Target,
  Calendar
} from "lucide-react";

export default function B2CDashboard() {
  const { user, projects } = useApp();
  const [activeTab, setActiveTab] = useState("overview");

  // Statistics calculation
  const completedProjects = projects.filter(p => p.status === 'completed');
  const avgScore = completedProjects.length > 0 
    ? Math.round(completedProjects.reduce((sum, p) => sum + (p.score || 0), 0) / completedProjects.length)
    : 0;
  const totalSavings = 2850;
  const protectionEvents = 3;

  // Mock data for payment tracking
  const activePaymentTracking = [
    {
      id: 1,
      projectName: "Rénovation Cuisine",
      company: "BatiCuisine Pro",
      totalAmount: 15600,
      paidAmount: 4680, // 30%
      stages: [
        { name: "Signature", amount: 4680, status: "completed", date: "2024-01-15" },
        { name: "Démolition", amount: 6240, status: "pending", date: "2024-02-01" },
        { name: "Installation", amount: 3120, status: "upcoming", date: "2024-02-15" },
        { name: "Finition", amount: 1560, status: "upcoming", date: "2024-03-01" }
      ]
    },
    {
      id: 2,
      projectName: "Isolation Combles",
      company: "IsoTherm Expert",
      totalAmount: 8900,
      paidAmount: 2670, // 30%
      stages: [
        { name: "Acompte", amount: 2670, status: "completed", date: "2024-01-20" },
        { name: "Livraison matériaux", amount: 3560, status: "pending", date: "2024-02-05" },
        { name: "Solde travaux", amount: 2670, status: "upcoming", date: "2024-02-20" }
      ]
    }
  ];

  const analysisHistory = [
    {
      id: 1,
      type: "Analyse Flash",
      projectName: "Carrelage Salon",
      company: "Sol Parfait",
      amount: "€3,200",
      score: "B+",
      savings: "€380",
      date: "2024-01-18",
      status: "completed"
    },
    {
      id: 2,
      type: "Analyse Complète + Suivi",
      projectName: "Rénovation Cuisine",
      company: "BatiCuisine Pro", 
      amount: "€15,600",
      score: "A-",
      savings: "€1,200",
      date: "2024-01-15",
      status: "tracking"
    },
    {
      id: 3,
      type: "Comparaison Multi-devis",
      projectName: "Isolation Combles",
      company: "IsoTherm Expert",
      amount: "€8,900",
      score: "A",
      savings: "€1,100",
      date: "2024-01-20",
      status: "tracking"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'tracking': return 'default';
      case 'pending': return 'warning';
      case 'upcoming': return 'secondary';
      default: return 'secondary';
    }
  };

  const getPaymentProgress = (paidAmount: number, totalAmount: number) => {
    return (paidAmount / totalAmount) * 100;
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
                <Home className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Tableau de bord Particulier</h1>
                <p className="text-muted-foreground">L'expertise BTP dans votre poche + Paiements sécurisés</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {user ? `Bonjour ${user.name}` : 'Bienvenue sur TORP'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/analyze">
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle Analyse
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats rapides */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-foreground">{projects.length}</div>
                <div className="text-xs text-muted-foreground">Devis analysés</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-success">€{totalSavings}</div>
                <div className="text-xs text-muted-foreground">Économies détectées</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-primary">{avgScore > 0 ? `${avgScore}/100` : 'N/A'}</div>
                <div className="text-xs text-muted-foreground">Score moyen</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-warning">{protectionEvents}</div>
                <div className="text-xs text-muted-foreground">Protections actives</div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="analysis">Mes Analyses</TabsTrigger>
            <TabsTrigger value="payments">Suivi Paiements</TabsTrigger>
            <TabsTrigger value="projects">Projets Actifs</TabsTrigger>
            <TabsTrigger value="services">Services TORP</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Innovation Suivi Paiements */}
            <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Innovation : Suivi Paiements Tiers de Confiance
                </CardTitle>
                <CardDescription>
                  Sécurisez vos paiements sans commission - Service gratuit TORP
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Comment ça fonctionne :</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>✓ Génération lien paiement sécurisé</li>
                      <li>✓ Invitation automatique entrepreneur</li>
                      <li>✓ Jalons de paiement par étapes</li>
                      <li>✓ Notifications temps réel</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Vos avantages :</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>✅ Protection contre les arnaques</li>
                      <li>✅ Traçabilité complète</li>
                      <li>✅ Position de force en négociation</li>
                      <li>✅ Service gratuit (0% commission)</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions rapides */}
            <div className="grid md:grid-cols-4 gap-4">
              <Link to="/analyze">
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-6 text-center">
                    <Upload className="h-8 w-8 text-primary mx-auto mb-2" />
                    <h4 className="font-medium">Analyse Flash</h4>
                    <p className="text-sm text-muted-foreground">9,90€ TTC</p>
                    <Badge variant="outline" className="mt-2">30 secondes</Badge>
                  </CardContent>
                </Card>
              </Link>

              <Link to="/analyze">
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-6 text-center">
                    <FileText className="h-8 w-8 text-success mx-auto mb-2" />
                    <h4 className="font-medium">Analyse Complète</h4>
                    <p className="text-sm text-muted-foreground">19,90€ TTC</p>
                    <Badge variant="outline" className="mt-2">+ Suivi paiements</Badge>
                  </CardContent>
                </Card>
              </Link>

              <Link to="/analyze">
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-6 text-center">
                    <BarChart3 className="h-8 w-8 text-warning mx-auto mb-2" />
                    <h4 className="font-medium">Multi-devis</h4>
                    <p className="text-sm text-muted-foreground">29,90€ TTC</p>
                    <Badge variant="outline" className="mt-2">Jusqu'à 5 devis</Badge>
                  </CardContent>
                </Card>
              </Link>

              <Link to="/analyze">
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-6 text-center">
                    <Shield className="h-8 w-8 text-destructive mx-auto mb-2" />
                    <h4 className="font-medium">Analyse + CCTP</h4>
                    <p className="text-sm text-muted-foreground">44,90€ TTC</p>
                    <Badge variant="outline" className="mt-2">Protection max</Badge>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Historique des Analyses
                </CardTitle>
                <CardDescription>
                  Vos analyses TORP et résultats obtenus
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analysisHistory.map((analysis) => (
                    <div key={analysis.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge variant="outline">{analysis.type}</Badge>
                            <Badge variant={getStatusColor(analysis.status)}>
                              {analysis.status === 'tracking' ? 'Suivi actif' : 'Terminé'}
                            </Badge>
                          </div>
                          <h4 className="font-medium">{analysis.projectName}</h4>
                          <p className="text-sm text-muted-foreground">{analysis.company} • {analysis.date}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="font-medium">Montant: {analysis.amount}</span>
                            <span className="text-success">Score: {analysis.score}</span>
                            <span className="text-primary">Économies: {analysis.savings}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-1" />
                            Rapport
                          </Button>
                          {analysis.status === 'tracking' && (
                            <Button variant="outline" size="sm">
                              <Shield className="h-4 w-4 mr-1" />
                              Suivi
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Suivi Paiements Tiers de Confiance
                </CardTitle>
                <CardDescription>
                  Vos paiements sécurisés par étapes - Service gratuit
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {activePaymentTracking.map((project) => (
                    <div key={project.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="font-medium">{project.projectName}</h4>
                          <p className="text-sm text-muted-foreground">{project.company}</p>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">€{project.paidAmount.toLocaleString()} / €{project.totalAmount.toLocaleString()}</div>
                          <Progress value={getPaymentProgress(project.paidAmount, project.totalAmount)} className="w-32 mt-1" />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h5 className="font-medium text-sm">Échéancier :</h5>
                        {project.stages.map((stage, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded">
                            <div className="flex items-center gap-3">
                              {stage.status === 'completed' && <CheckCircle className="h-4 w-4 text-success" />}
                              {stage.status === 'pending' && <Clock className="h-4 w-4 text-warning" />}
                              {stage.status === 'upcoming' && <Calendar className="h-4 w-4 text-muted-foreground" />}
                              <div>
                                <div className="font-medium text-sm">{stage.name}</div>
                                <div className="text-xs text-muted-foreground">{stage.date}</div>
                              </div>
                            </div>
                            <div className="font-medium">€{stage.amount.toLocaleString()}</div>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 mt-4">
                        <Button variant="outline" size="sm">
                          <Phone className="h-4 w-4 mr-1" />
                          Contacter entreprise
                        </Button>
                        <Button variant="outline" size="sm">
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          Signaler problème
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projects" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Hammer className="h-5 w-5" />
                    Projets en Cours
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {projects.filter(p => p.status !== 'completed').slice(0, 3).map(project => (
                      <div key={project.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{project.name}</h4>
                            <p className="text-sm text-muted-foreground">{project.company}</p>
                          </div>
                          <Badge variant={getStatusColor(project.status)}>
                            {project.status === 'analyzing' ? 'En analyse' : 'Brouillon'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5" />
                    Entreprises Recommandées
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">EcoBat Solutions</h4>
                          <p className="text-sm text-muted-foreground">Rénovation énergétique</p>
                          <div className="flex items-center gap-1 mt-1">
                            <Badge variant="success">Score A</Badge>
                            <QrCode className="h-4 w-4 text-primary" />
                          </div>
                        </div>
                        <Button variant="outline" size="sm">Contacter</Button>
                      </div>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">BatiCuisine Pro</h4>
                          <p className="text-sm text-muted-foreground">Cuisine & salle de bain</p>
                          <div className="flex items-center gap-1 mt-1">
                            <Badge variant="success">Score A-</Badge>
                            <QrCode className="h-4 w-4 text-primary" />
                          </div>
                        </div>
                        <Button variant="outline" size="sm">Contacter</Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="services" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Services d'Analyse TORP</CardTitle>
                  <CardDescription>Choisissez le niveau d'expertise adapté à votre projet</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">Analyse Flash</h4>
                      <Badge variant="outline">9,90€ TTC</Badge>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Score TORP instantané (A-E)</li>
                      <li>• Détection anomalies prix</li>
                      <li>• Comparatif marché local</li>
                      <li>• Rapport PDF 2 pages</li>
                    </ul>
                    <Link to="/analyze">
                      <Button className="w-full mt-3" size="sm">Choisir</Button>
                    </Link>
                  </div>

                  <div className="p-4 border rounded-lg border-primary">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">Analyse Complète</h4>
                      <div className="text-right">
                        <Badge variant="default">19,90€ TTC</Badge>
                        <div className="text-xs text-primary">+ Suivi paiements</div>
                      </div>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Tout Analyse Flash</li>
                      <li>• Vérification DTU/normes</li>
                      <li>• Scoring entreprise complet</li>
                      <li>• 🔒 Suivi paiements intégré</li>
                      <li>• Rapport PDF 4-5 pages</li>
                    </ul>
                    <Link to="/analyze">
                      <Button className="w-full mt-3" size="sm">Choisir</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Vos Statistiques</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Économies réalisées</span>
                        <span className="font-bold text-success">€{totalSavings}</span>
                      </div>
                      <Progress value={75} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">Objectif annuel : €4,000</p>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Score moyen projets</span>
                        <span className="font-bold text-primary">{avgScore}/100</span>
                      </div>
                      <Progress value={avgScore} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">Excellent ! Continuez ainsi</p>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Niveau de protection</span>
                        <span className="font-bold text-warning">Expert</span>
                      </div>
                      <Progress value={90} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">3 projets avec suivi paiements</p>
                    </div>
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
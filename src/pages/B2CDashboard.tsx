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
import { ProjectTimeline } from "@/components/ProjectTimeline";
import { ProjectBudget } from "@/components/ProjectBudget";
import { ProjectDocuments } from "@/components/ProjectDocuments";
import { ConstructionTracking } from "@/components/ConstructionTracking";
import { DOEGenerator } from "@/components/DOEGenerator";
import { CCTPGenerator } from "@/components/CCTPGenerator";
import { DigitalHomeBook } from "@/components/DigitalHomeBook";
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
  Calendar,
  FileCheck
} from "lucide-react";

export default function B2CDashboard() {
  const { user, projects } = useApp();
  const [activeTab, setActiveTab] = useState("overview");

  // Statistics calculation based on real data
  const completedProjects = projects.filter(p => p.status === 'completed');
  const avgScore = completedProjects.length > 0
    ? Math.round(completedProjects.reduce((sum, p) => sum + (p.score || 0), 0) / completedProjects.length)
    : 0;

  // Calculate real stats from projects (no mock data)
  const totalSavings = completedProjects.reduce((sum, p) => {
    const surcouts = p.analysisResult?.rawData?.surcoutsDetectes || 0;
    return sum + surcouts;
  }, 0);

  // Count projects with payment tracking enabled
  const protectionEvents = projects.filter(p => p.status === 'completed' || p.status === 'analyzing').length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'tracking': return 'default';
      case 'pending': return 'warning';
      case 'upcoming': return 'secondary';
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
          <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
              <TabsList className="inline-flex h-auto min-w-full w-max p-2 bg-transparent gap-1">
                <TabsTrigger 
                  value="overview" 
                  className="flex items-center gap-2 whitespace-nowrap data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                >
                  <Home className="h-4 w-4" />
                  <span>Vue d'ensemble</span>
                </TabsTrigger>
                
                <TabsTrigger 
                  value="analysis" 
                  className="flex items-center gap-2 whitespace-nowrap data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                >
                  <FileText className="h-4 w-4" />
                  <span>Mes Analyses</span>
                </TabsTrigger>
                
                <TabsTrigger 
                  value="cctp" 
                  className="flex items-center gap-2 whitespace-nowrap relative data-[state=active]:bg-purple-100 dark:data-[state=active]:bg-purple-950/30 data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-400"
                >
                  <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <span className="font-semibold">Générateur CCTP</span>
                  <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0.5">NEW</Badge>
                </TabsTrigger>
                
                <TabsTrigger 
                  value="timeline" 
                  className="flex items-center gap-2 whitespace-nowrap data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                >
                  <Calendar className="h-4 w-4" />
                  <span>Planning</span>
                </TabsTrigger>
                
                <TabsTrigger 
                  value="budget" 
                  className="flex items-center gap-2 whitespace-nowrap data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                >
                  <PiggyBank className="h-4 w-4" />
                  <span>Budget</span>
                </TabsTrigger>
                
                <TabsTrigger 
                  value="documents" 
                  className="flex items-center gap-2 whitespace-nowrap data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                >
                  <FileText className="h-4 w-4" />
                  <span>Documents</span>
                </TabsTrigger>
                
                <TabsTrigger 
                  value="tracking" 
                  className="flex items-center gap-2 whitespace-nowrap relative data-[state=active]:bg-orange-100 dark:data-[state=active]:bg-orange-950/30 data-[state=active]:text-orange-700 dark:data-[state=active]:text-orange-400"
                >
                  <Hammer className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  <span className="font-semibold">Suivi Chantier</span>
                  <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0.5">NEW</Badge>
                </TabsTrigger>
                
                <TabsTrigger 
                  value="doe" 
                  className="flex items-center gap-2 whitespace-nowrap relative data-[state=active]:bg-green-100 dark:data-[state=active]:bg-green-950/30 data-[state=active]:text-green-700 dark:data-[state=active]:text-green-400"
                >
                  <FileCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="font-semibold">DOE</span>
                  <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0.5">NEW</Badge>
                </TabsTrigger>
                
                <TabsTrigger 
                  value="carnet" 
                  className="flex items-center gap-2 whitespace-nowrap relative data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-950/30 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400"
                >
                  <Home className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="font-semibold">Carnet Logement</span>
                  <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0.5">NEW</Badge>
                </TabsTrigger>
                
                <TabsTrigger 
                  value="payments" 
                  className="flex items-center gap-2 whitespace-nowrap data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Paiements</span>
                </TabsTrigger>
                
                <TabsTrigger 
                  value="projects" 
                  className="flex items-center gap-2 whitespace-nowrap data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                >
                  <Building className="h-4 w-4" />
                  <span>Projets</span>
                </TabsTrigger>
                
                <TabsTrigger 
                  value="services" 
                  className="flex items-center gap-2 whitespace-nowrap data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                >
                  <Shield className="h-4 w-4" />
                  <span>Services</span>
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

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
                {completedProjects.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h4 className="font-medium text-muted-foreground mb-2">Aucune analyse terminée</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Analysez votre premier devis pour voir vos résultats ici.
                    </p>
                    <Link to="/analyze">
                      <Button size="sm">
                        <Upload className="h-4 w-4 mr-2" />
                        Analyser un devis
                      </Button>
                    </Link>
                  </div>
                ) : (
                <div className="space-y-4">
                  {completedProjects.map((project) => (
                    <div key={project.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge variant="outline">Analyse TORP</Badge>
                            <Badge variant="success">Terminé</Badge>
                          </div>
                          <h4 className="font-medium">{project.name}</h4>
                          <p className="text-sm text-muted-foreground">{project.company || 'Entreprise'} • {new Date(project.createdAt).toLocaleDateString('fr-FR')}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="font-medium">Montant: {project.amount}</span>
                            <span className="text-success">Score: {project.score}/1000 ({project.grade})</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link to={`/results?devisId=${project.id}`}>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4 mr-1" />
                              Rapport
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: TIMELINE */}
          <TabsContent value="timeline" className="space-y-6">
            <ProjectTimeline projectId={projects[0]?.id || undefined} />
          </TabsContent>

          {/* TAB: CCTP GENERATOR */}
          <TabsContent value="cctp" className="space-y-6">
            <CCTPGenerator />
          </TabsContent>

          {/* TAB: BUDGET */}
          <TabsContent value="budget" className="space-y-6">
            <ProjectBudget projectId={projects[0]?.id || undefined} />
          </TabsContent>

          {/* TAB: DOCUMENTS */}
          <TabsContent value="documents" className="space-y-6">
            <ProjectDocuments projectId={projects[0]?.id || undefined} />
          </TabsContent>

          {/* TAB: CONSTRUCTION TRACKING */}
          <TabsContent value="tracking" className="space-y-6">
            <ConstructionTracking />
          </TabsContent>

          {/* TAB: DOE GENERATOR */}
          <TabsContent value="doe" className="space-y-6">
            <DOEGenerator />
          </TabsContent>

          {/* TAB: DIGITAL HOME BOOK */}
          <TabsContent value="carnet" className="space-y-6">
            <DigitalHomeBook />
          </TabsContent>

          {/* TAB: PAYMENTS */}
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
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h4 className="font-medium text-muted-foreground mb-2">Aucun suivi de paiement actif</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Le suivi des paiements sera disponible après une analyse complète de votre devis.
                  </p>
                  <Link to="/analyze">
                    <Button size="sm">
                      <Upload className="h-4 w-4 mr-2" />
                      Analyser un devis
                    </Button>
                  </Link>
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
                  <div className="text-center py-6">
                    <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Fonctionnalité bientôt disponible
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Nous travaillons à établir un réseau d'entreprises de confiance vérifiées par TORP.
                    </p>
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
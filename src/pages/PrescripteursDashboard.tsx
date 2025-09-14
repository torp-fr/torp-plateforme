import { useState } from "react";
import { Header } from "@/components/Header";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  FileText, 
  Upload, 
  CheckCircle, 
  TrendingUp, 
  Users, 
  Award,
  Calendar,
  Download,
  Building2,
  Shield,
  Zap,
  Target
} from "lucide-react";

export default function PrescripteursDashboard() {
  const [selectedPlan, setSelectedPlan] = useState<'standard' | 'premium'>('standard');

  const stats = {
    analysesThisMonth: 47,
    limitMonth: selectedPlan === 'standard' ? 200 : 500,
    clientsCertified: 134,
    scoreMoyen: 7.8,
    credibilityBoost: 89
  };

  const recentAnalyses = [
    { 
      id: 1, 
      client: "Copropriété Les Jardins", 
      entreprise: "Rénov'Pro SARL", 
      score: 8.4, 
      grade: "A", 
      date: "2024-01-15",
      type: "Ravalement façade"
    },
    { 
      id: 2, 
      client: "Mme Dupont", 
      entreprise: "ElecPlus", 
      score: 7.1, 
      grade: "B", 
      date: "2024-01-14",
      type: "Installation électrique"
    },
    { 
      id: 3, 
      client: "M. Martin", 
      entreprise: "Plomberie Moderne", 
      score: 6.8, 
      grade: "C", 
      date: "2024-01-13",
      type: "Rénovation salle de bain"
    }
  ];

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'bg-success text-success-foreground';
      case 'B': return 'bg-success/80 text-success-foreground';
      case 'C': return 'bg-warning text-warning-foreground';
      case 'D': return 'bg-destructive/80 text-destructive-foreground';
      case 'E': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <BackButton />
        
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Target className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Dashboard Prescripteur</h1>
              <p className="text-muted-foreground">Certifiez la qualité des entreprises que vous recommandez</p>
            </div>
          </div>

          {/* Plan Status */}
          <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-lg">
                      Abonnement {selectedPlan === 'standard' ? 'Standard' : 'Premium'}
                    </CardTitle>
                    <CardDescription>
                      Analyses illimitées • {selectedPlan === 'standard' ? '649€/an' : '1,490€/an'}
                    </CardDescription>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedPlan(selectedPlan === 'standard' ? 'premium' : 'standard')}
                >
                  {selectedPlan === 'standard' ? 'Passer au Premium' : 'Revenir au Standard'}
                </Button>
              </div>
            </CardHeader>
          </Card>
        </div>

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="certify">Certifier Devis</TabsTrigger>
            <TabsTrigger value="reports">Rapports</TabsTrigger>
            <TabsTrigger value="billing">Facturation</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm font-medium">Analyses ce mois</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.analysesThisMonth}</div>
                  <div className="mt-2">
                    <Progress 
                      value={(stats.analysesThisMonth / stats.limitMonth) * 100} 
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.limitMonth - stats.analysesThisMonth} restantes
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm font-medium">Clients certifiés</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.clientsCertified}</div>
                  <p className="text-xs text-muted-foreground">+12 ce mois</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-success" />
                    <CardTitle className="text-sm font-medium">Score moyen</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.scoreMoyen}/10</div>
                  <p className="text-xs text-success">Qualité excellente</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-warning" />
                    <CardTitle className="text-sm font-medium">Crédibilité</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">+{stats.credibilityBoost}%</div>
                  <p className="text-xs text-muted-foreground">Confiance clients</p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Analyses */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-success" />
                  Analyses récentes
                </CardTitle>
                <CardDescription>
                  Dernières certifications TORP effectuées
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentAnalyses.map((analysis) => (
                    <div key={analysis.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-medium">{analysis.client}</h4>
                          <Badge className={getGradeColor(analysis.grade)}>
                            Grade {analysis.grade}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <p>{analysis.entreprise} • {analysis.type}</p>
                          <p>Score TORP: {analysis.score}/10 • {analysis.date}</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-1" />
                        Certificat
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Value Proposition */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-success/20 bg-success/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-success">
                    <Zap className="h-5 w-5" />
                    Impact Prescripteur
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Crédibilité renforcée</span>
                    <span className="font-bold text-success">+89%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Taux de conversion</span>
                    <span className="font-bold text-success">+34%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Satisfaction client</span>
                    <span className="font-bold text-success">+67%</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <Building2 className="h-5 w-5" />
                    ROI Calculé
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Coût abonnement/an</span>
                    <span className="font-bold">{selectedPlan === 'standard' ? '649€' : '1,490€'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">1 projet sauvé</span>
                    <span className="font-bold text-success">ROI 300%+</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Un seul projet protégé rentabilise votre abonnement annuel
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="certify" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-primary" />
                  Certifier un nouveau devis
                </CardTitle>
                <CardDescription>
                  Uploadez le devis à analyser et obtenez votre certification TORP
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Upload Zone */}
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Glissez votre devis ici</h3>
                  <p className="text-muted-foreground mb-4">
                    Formats acceptés: PDF, JPG, PNG (max 10MB)
                  </p>
                  <Button>
                    Sélectionner un fichier
                  </Button>
                </div>

                {/* Process Steps */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-2 text-sm font-bold">1</div>
                    <h4 className="font-medium mb-1">Upload Devis</h4>
                    <p className="text-xs text-muted-foreground">Téléchargez le document</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-2 text-sm font-bold">2</div>
                    <h4 className="font-medium mb-1">Analyse TORP</h4>
                    <p className="text-xs text-muted-foreground">2-3 minutes d'analyse</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="w-8 h-8 bg-success text-success-foreground rounded-full flex items-center justify-center mx-auto mb-2 text-sm font-bold">3</div>
                    <h4 className="font-medium mb-1">Certification</h4>
                    <p className="text-xs text-muted-foreground">Rapport PDF personnalisé</p>
                  </div>
                </div>

                {selectedPlan === 'premium' && (
                  <Card className="border-warning/20 bg-warning/5">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Award className="h-5 w-5 text-warning" />
                        <h4 className="font-medium">Avantages Premium</h4>
                      </div>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Analyse détaillée (conformité DTU, normes)</li>
                        <li>• Recommandations d'amélioration personnalisées</li>
                        <li>• Comparaison prix marché régional</li>
                        <li>• Rapport avec votre logo d'entreprise</li>
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Rapports et historique</CardTitle>
                <CardDescription>
                  Consultez tous vos rapports de certification TORP
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">Historique des rapports</h3>
                  <p>Vos rapports de certification apparaîtront ici</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Plan Actuel */}
              <Card className={`border-2 ${selectedPlan === 'standard' ? 'border-primary' : 'border-muted'}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Standard</CardTitle>
                    {selectedPlan === 'standard' && (
                      <Badge variant="default">Actuel</Badge>
                    )}
                  </div>
                  <div className="text-3xl font-bold">649€<span className="text-lg font-normal">/an</span></div>
                  <CardDescription>64,90€ HT/mois • Analyses illimitées</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      200 analyses/mois (anti-abus)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      Score TORP 0-10 avec justification
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      Certificat PDF basique
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      Dashboard (historique 6 mois)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      2 utilisateurs maximum
                    </li>
                  </ul>
                  {selectedPlan !== 'standard' && (
                    <Button className="w-full" onClick={() => setSelectedPlan('standard')}>
                      Choisir Standard
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Plan Premium */}
              <Card className={`border-2 ${selectedPlan === 'premium' ? 'border-primary' : 'border-muted'}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Premium</CardTitle>
                    {selectedPlan === 'premium' && (
                      <Badge variant="default">Actuel</Badge>
                    )}
                  </div>
                  <div className="text-3xl font-bold">1,490€<span className="text-lg font-normal">/an</span></div>
                  <CardDescription>149€ HT/mois • Analyse complète</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      Tout du Standard +
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      500 analyses/mois
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      Analyse détaillée (DTU, normes)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      Rapports personnalisés (logo)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      5 utilisateurs maximum
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      Support téléphone prioritaire
                    </li>
                  </ul>
                  {selectedPlan !== 'premium' && (
                    <Button className="w-full" onClick={() => setSelectedPlan('premium')}>
                      Passer au Premium
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Usage Current Month */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Usage ce mois
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Analyses effectuées</span>
                      <span>{stats.analysesThisMonth}/{stats.limitMonth}</span>
                    </div>
                    <Progress 
                      value={(stats.analysesThisMonth / stats.limitMonth) * 100}
                      className="h-3"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-sm text-muted-foreground">Économies estimées</p>
                      <p className="text-2xl font-bold text-success">15,000€</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">ROI ce mois</p>
                      <p className="text-2xl font-bold text-success">2,300%</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
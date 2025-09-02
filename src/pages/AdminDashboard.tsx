import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Users, 
  TrendingUp, 
  DollarSign, 
  Activity, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  BarChart3,
  PieChart,
  LineChart,
  Settings,
  Download,
  RefreshCw
} from "lucide-react";

const AdminDashboard = () => {
  const kpis = [
    {
      title: "MRR (Monthly Recurring Revenue)",
      value: "€187,450",
      change: "+12.5%",
      trend: "up",
      icon: DollarSign,
      target: "€200,000",
      progress: 93.7
    },
    {
      title: "Utilisateurs Actifs",
      value: "2,847",
      change: "+8.3%",
      trend: "up",
      icon: Users,
      target: "3,000",
      progress: 94.9
    },
    {
      title: "Analyses Traitées",
      value: "15,284",
      change: "+23.1%",
      trend: "up",
      icon: Activity,
      target: "18,000",
      progress: 84.9
    },
    {
      title: "Taux de Conversion",
      value: "18.7%",
      change: "-2.1%",
      trend: "down",
      icon: Target,
      target: "20%",
      progress: 93.5
    }
  ];

  const businessMetrics = [
    { label: "CAC (B2C)", value: "€47", trend: "+5%" },
    { label: "CAC (B2B)", value: "€312", trend: "-8%" },
    { label: "LTV Moyen", value: "€1,847", trend: "+15%" },
    { label: "Churn Rate", value: "3.2%", trend: "-12%" },
    { label: "NPS Score", value: "68", trend: "+6%" },
    { label: "Support CSAT", value: "4.7/5", trend: "+3%" }
  ];

  const systemMetrics = [
    { label: "Uptime", value: "99.97%", status: "excellent" },
    { label: "Temps Réponse API", value: "247ms", status: "good" },
    { label: "Précision OCR", value: "94.3%", status: "excellent" },
    { label: "Précision IA", value: "91.8%", status: "good" },
    { label: "Satisfaction Algorithm", value: "88.5%", status: "good" },
    { label: "Queue Processing", value: "< 30s", status: "excellent" }
  ];

  const recentAlerts = [
    { type: "critical", message: "Pic d'utilisation détecté - Scaling automatique activé", time: "Il y a 2h" },
    { type: "warning", message: "Taux de conversion B2B en baisse sur 7 jours", time: "Il y a 4h" },
    { type: "info", message: "Nouveau record mensuel d'analyses traitées", time: "Il y a 6h" },
    { type: "success", message: "Mise à jour algorithme déployée avec succès", time: "Il y a 1j" }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard Admin TORP</h1>
            <p className="text-muted-foreground mt-2">Pilotage stratégique et opérationnel de la plateforme</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Exporter
            </Button>
            <Button variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
            <Button variant="default" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Paramètres
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="business">Business</TabsTrigger>
            <TabsTrigger value="technical">Technique</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* KPIs Principaux */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {kpis.map((kpi, index) => {
                const Icon = kpi.icon;
                return (
                  <Card key={index} className="relative overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{kpi.value}</div>
                      <div className="flex items-center justify-between mt-2">
                        <Badge variant={kpi.trend === "up" ? "default" : "destructive"}>
                          {kpi.change}
                        </Badge>
                        <span className="text-xs text-muted-foreground">vs {kpi.target}</span>
                      </div>
                      <Progress value={kpi.progress} className="mt-3" />
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Alertes Récentes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Alertes & Notifications
                </CardTitle>
                <CardDescription>Événements récents nécessitant une attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentAlerts.map((alert, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 rounded-lg border">
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        alert.type === 'critical' ? 'bg-red-500' :
                        alert.type === 'warning' ? 'bg-yellow-500' :
                        alert.type === 'success' ? 'bg-green-500' : 'bg-blue-500'
                      }`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{alert.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">{alert.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="business" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {businessMetrics.map((metric, index) => (
                <Card key={index}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{metric.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metric.value}</div>
                    <Badge variant={metric.trend.startsWith('+') ? 'default' : 'destructive'} className="mt-2">
                      {metric.trend}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Évolution Revenue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Graphique Revenue MRR/ARR
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5" />
                    Répartition Clients
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Graphique B2C vs B2B
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="technical" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {systemMetrics.map((metric, index) => (
                <Card key={index}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{metric.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metric.value}</div>
                    <Badge 
                      variant={
                        metric.status === 'excellent' ? 'default' :
                        metric.status === 'good' ? 'secondary' : 'destructive'
                      } 
                      className="mt-2"
                    >
                      {metric.status === 'excellent' ? 'Excellent' :
                       metric.status === 'good' ? 'Bon' : 'Attention'}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="w-5 h-5" />
                  Performance Système
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                  Graphiques temps réel : CPU, Mémoire, Réseau, Database
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Usage par Fonctionnalité</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Analyse Simple</span>
                      <span className="font-medium">67%</span>
                    </div>
                    <Progress value={67} />
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Analyse Premium</span>
                      <span className="font-medium">28%</span>
                    </div>
                    <Progress value={28} />
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Comparaison Multi-devis</span>
                      <span className="font-medium">5%</span>
                    </div>
                    <Progress value={5} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Acquisition Channels</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Organique (SEO)</span>
                      <span className="font-medium">42%</span>
                    </div>
                    <Progress value={42} />
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Référencement</span>
                      <span className="font-medium">31%</span>
                    </div>
                    <Progress value={31} />
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Social Media</span>
                      <span className="font-medium">18%</span>
                    </div>
                    <Progress value={18} />
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Publicité</span>
                      <span className="font-medium">9%</span>
                    </div>
                    <Progress value={9} />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Insights IA & Recommandations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                    <h4 className="font-medium text-green-800 dark:text-green-200">Opportunité détectée</h4>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      Le taux de conversion B2C augmente de +15% en fin de mois. Recommandation : intensifier la communication pendant cette période.
                    </p>
                  </div>
                  
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <h4 className="font-medium text-yellow-800 dark:text-yellow-200">Point d'attention</h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      Temps de réponse API en légère hausse (+8%). Surveiller les performances de la base de données.
                    </p>
                  </div>
                  
                  <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="font-medium text-blue-800 dark:text-blue-200">Prédiction</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Basé sur les tendances actuelles, objectif MRR de €200k devrait être atteint dans 6 semaines.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
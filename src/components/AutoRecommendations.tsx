import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { 
  Sparkles, 
  TrendingUp,
  Target,
  AlertCircle,
  CheckCircle2,
  Clock,
  Euro,
  Star,
  Send,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Lightbulb,
  Building2,
  Users,
  Award,
  BarChart3
} from "lucide-react";
import { toast } from "sonner";

interface Recommendation {
  id: number;
  type: 'opportunity' | 'alert' | 'insight' | 'action';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  client: string;
  potentialValue: number;
  confidence: number;
  reason: string;
  suggestedAction: string;
  deadline?: string;
  relatedProjects?: string[];
}

export function AutoRecommendations() {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  const recommendations: Recommendation[] = [
    {
      id: 1,
      type: 'opportunity',
      priority: 'high',
      title: "Copropriété Les Jardins - Projet Chauffage",
      description: "Le client a mentionné un projet de remplacement du chauffage collectif lors du dernier échange",
      client: "Copropriété Les Jardins",
      potentialValue: 89000,
      confidence: 92,
      reason: "Historique d'analyses positives (A/B+), budget disponible confirmé, mention explicite du projet",
      suggestedAction: "Proposer une analyse préventive avant la recherche d'entreprises",
      deadline: "2024-03-15",
      relatedProjects: ["Ravalement façade (A)", "Toiture (A)"]
    },
    {
      id: 2,
      type: 'alert',
      priority: 'high',
      title: "M. Rousseau - Risque concurrent",
      description: "Le client investisseur n'a pas sollicité TORP depuis 3 semaines, période inhabituelle",
      client: "M. Rousseau",
      potentialValue: 125000,
      confidence: 78,
      reason: "Changement de pattern: habituellement 1 analyse/semaine, silence depuis 21 jours",
      suggestedAction: "Contact proactif pour maintenir la relation et proposer veille marché",
      deadline: "2024-02-25",
      relatedProjects: ["Extension maison (A-)", "Studio neuf (B+)"]
    },
    {
      id: 3,
      type: 'opportunity',
      priority: 'high',
      title: "Mme Martin - Extension de services",
      description: "Cliente premium satisfaite (4.9/5) avec budget élevé, opportunité de recommandation à son réseau",
      client: "Mme Martin",
      potentialValue: 245000,
      confidence: 88,
      reason: "Score satisfaction exceptionnel, 15 analyses réalisées, profil prescripteur potentiel",
      suggestedAction: "Proposer programme de parrainage avec avantages exclusifs",
      relatedProjects: ["Villa complète (A)", "Piscine & terrasse (A-)"]
    },
    {
      id: 4,
      type: 'insight',
      priority: 'medium',
      title: "Tendance marché - Isolation thermique",
      description: "Hausse de 34% des demandes d'analyses pour isolation dans votre portefeuille ce mois",
      client: "Segment Acquéreurs",
      potentialValue: 0,
      confidence: 95,
      reason: "Analyse algorithmique des 47 analyses de février vs janvier",
      suggestedAction: "Créer un webinaire/guide sur 'Bien choisir son isolation' pour vos clients",
      relatedProjects: []
    },
    {
      id: 5,
      type: 'action',
      priority: 'high',
      title: "M. Bernard - Relance post-analyse",
      description: "Client acquéreur avec analyse positive (A) il y a 15 jours, aucun retour sur signature",
      client: "M. Bernard",
      potentialValue: 18200,
      confidence: 72,
      reason: "Délai inhabituel après analyse positive, risque de perte",
      suggestedAction: "Appel de suivi pour confirmer la signature ou identifier les blocages",
      deadline: "2024-02-23",
      relatedProjects: ["Cuisine équipée (A)"]
    },
    {
      id: 6,
      type: 'opportunity',
      priority: 'medium',
      title: "Copropriétés - Campagne printemps",
      description: "5 copropriétés de votre portefeuille planifient des AG entre mars et avril",
      client: "Segment Copropriétés",
      potentialValue: 450000,
      confidence: 85,
      reason: "Calendrier AG récupéré via échanges précédents",
      suggestedAction: "Campagne email ciblée 'Préparez vos travaux 2024' avec offre spéciale",
      deadline: "2024-03-01",
      relatedProjects: []
    },
    {
      id: 7,
      type: 'insight',
      priority: 'low',
      title: "Performance - Taux de conversion optimal",
      description: "Votre taux de conversion analyses → signatures atteint 73%, +8pts vs moyenne plateforme",
      client: "Votre performance",
      potentialValue: 0,
      confidence: 100,
      reason: "Statistiques plateforme TORP février 2024",
      suggestedAction: "Continuez votre approche actuelle, vous êtes dans le top 15% des prescripteurs",
      relatedProjects: []
    },
    {
      id: 8,
      type: 'alert',
      priority: 'medium',
      title: "Budget Marketing - Optimisation possible",
      description: "40% de vos clients proviennent de recommandations, leviers gratuits à exploiter",
      client: "Acquisition",
      potentialValue: 0,
      confidence: 82,
      reason: "Analyse source d'acquisition de vos 156 clients",
      suggestedAction: "Structurer programme de parrainage pour augmenter ce canal à 60%",
      relatedProjects: []
    }
  ];

  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'opportunity':
        return { label: 'Opportunité', color: 'bg-green-500/10 text-green-700', icon: Target };
      case 'alert':
        return { label: 'Alerte', color: 'bg-red-500/10 text-red-700', icon: AlertCircle };
      case 'insight':
        return { label: 'Insight', color: 'bg-blue-500/10 text-blue-700', icon: Lightbulb };
      case 'action':
        return { label: 'Action', color: 'bg-orange-500/10 text-orange-700', icon: Clock };
      default:
        return { label: type, color: '', icon: Sparkles };
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return '';
    }
  };

  const filteredRecommendations = selectedFilter === 'all' 
    ? recommendations 
    : recommendations.filter(r => r.type === selectedFilter);

  const stats = {
    total: recommendations.length,
    high: recommendations.filter(r => r.priority === 'high').length,
    opportunities: recommendations.filter(r => r.type === 'opportunity').length,
    avgConfidence: Math.round(recommendations.reduce((acc, r) => acc + r.confidence, 0) / recommendations.length)
  };

  const handleAction = (rec: Recommendation) => {
    toast.success("Action planifiée");
  };

  const handleDismiss = (rec: Recommendation) => {
    toast.info("Recommandation masquée");
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-purple-600" />
                Recommandations IA
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Insights automatiques basés sur votre activité et vos clients
              </CardDescription>
            </div>
            <Badge className="bg-purple-500/10 text-purple-700 text-lg px-4 py-2">
              <Sparkles className="w-4 h-4 mr-2" />
              {stats.total} recommandations
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.high}</div>
              <p className="text-sm text-muted-foreground">Priorité haute</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.opportunities}</div>
              <p className="text-sm text-muted-foreground">Opportunités</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.avgConfidence}%</div>
              <p className="text-sm text-muted-foreground">Confiance moy.</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {recommendations.filter(r => r.potentialValue > 0).reduce((acc, r) => acc + r.potentialValue, 0) / 1000}k€
              </div>
              <p className="text-sm text-muted-foreground">Valeur potentielle</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex gap-2">
        <Button
          variant={selectedFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedFilter('all')}
        >
          Toutes
        </Button>
        <Button
          variant={selectedFilter === 'opportunity' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedFilter('opportunity')}
        >
          <Target className="w-4 h-4 mr-2" />
          Opportunités
        </Button>
        <Button
          variant={selectedFilter === 'alert' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedFilter('alert')}
        >
          <AlertCircle className="w-4 h-4 mr-2" />
          Alertes
        </Button>
        <Button
          variant={selectedFilter === 'insight' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedFilter('insight')}
        >
          <Lightbulb className="w-4 h-4 mr-2" />
          Insights
        </Button>
        <Button
          variant={selectedFilter === 'action' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedFilter('action')}
        >
          <Clock className="w-4 h-4 mr-2" />
          Actions
        </Button>
      </div>

      {/* Recommendations List */}
      <div className="space-y-4">
        {filteredRecommendations.map(rec => {
          const typeConfig = getTypeConfig(rec.type);
          const TypeIcon = typeConfig.icon;
          return (
            <Card key={rec.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <TypeIcon className="w-5 h-5 text-muted-foreground" />
                      <Badge className={typeConfig.color}>{typeConfig.label}</Badge>
                      <Badge variant="outline" className={getPriorityColor(rec.priority)}>
                        {rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢'}
                        {rec.priority === 'high' ? 'Urgent' : rec.priority === 'medium' ? 'Important' : 'Normal'}
                      </Badge>
                      {rec.deadline && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          {rec.deadline}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-lg mb-1">{rec.title}</CardTitle>
                    <CardDescription>{rec.description}</CardDescription>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-2xl font-bold text-purple-600">{rec.confidence}%</div>
                    <p className="text-xs text-muted-foreground">Confiance</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Client & Value */}
                <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Client concerné</p>
                    <p className="font-medium flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      {rec.client}
                    </p>
                  </div>
                  {rec.potentialValue > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Valeur potentielle</p>
                      <p className="font-medium flex items-center gap-2 text-green-600">
                        <Euro className="w-4 h-4" />
                        {rec.potentialValue.toLocaleString()}€
                      </p>
                    </div>
                  )}
                </div>

                {/* Reason */}
                <div>
                  <p className="text-sm font-medium mb-1">Pourquoi cette recommandation ?</p>
                  <p className="text-sm text-muted-foreground">{rec.reason}</p>
                </div>

                {/* Related Projects */}
                {rec.relatedProjects && rec.relatedProjects.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Projets associés</p>
                    <div className="flex flex-wrap gap-2">
                      {rec.relatedProjects.map((project, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {project}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggested Action */}
                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium mb-1">Action suggérée</p>
                      <p className="text-sm text-muted-foreground">{rec.suggestedAction}</p>
                    </div>
                  </div>
                </div>

                {/* Confidence Bar */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Niveau de confiance</span>
                    <span className="font-medium">{rec.confidence}%</span>
                  </div>
                  <Progress value={rec.confidence} className="h-2" />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button className="flex-1" onClick={() => handleAction(rec)}>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Agir maintenant
                  </Button>
                  <Button variant="outline" onClick={() => handleAction(rec)}>
                    <Send className="w-4 h-4 mr-2" />
                    Planifier
                  </Button>
                  <Button variant="outline">
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" onClick={() => handleDismiss(rec)}>
                    <ThumbsDown className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* AI Info */}
      <Card className="border-purple-500/20 bg-purple-50/50 dark:bg-purple-950/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-purple-600 mt-0.5" />
            <div>
              <h4 className="font-medium mb-1">Comment ça marche ?</h4>
              <p className="text-sm text-muted-foreground">
                L'IA TORP analyse en temps réel votre portefeuille clients, l'historique des projets, les patterns de comportement et les tendances marché pour générer des recommandations personnalisées qui maximisent votre croissance et la satisfaction de vos clients.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
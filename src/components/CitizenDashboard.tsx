import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { 
  MapPin, 
  TrendingUp,
  Home,
  Building2,
  TreePine,
  Lightbulb,
  Euro,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Filter,
  Eye,
  ThumbsUp,
  MessageSquare,
  Share2,
  Download,
  Bell,
  Users,
  Target
} from "lucide-react";
import { toast } from "sonner";

interface PublicProject {
  id: number;
  name: string;
  category: 'école' | 'voirie' | 'espaces-verts' | 'bâtiment-public' | 'éclairage' | 'social';
  location: string;
  budget: number;
  torpScore: string;
  savings: number;
  status: 'planned' | 'in-progress' | 'completed';
  startDate: string;
  endDate: string;
  progress: number;
  description: string;
  impact: string[];
  contractor: string;
  citizenScore: number;
  comments: number;
  updates: {
    date: string;
    message: string;
  }[];
}

export function CitizenDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const publicProjects: PublicProject[] = [
    {
      id: 1,
      name: "Rénovation École Primaire Jules Ferry",
      category: 'école',
      location: "Centre-Ville, Rue de la République",
      budget: 450000,
      torpScore: "A",
      savings: 67000,
      status: 'in-progress',
      startDate: "2024-01-15",
      endDate: "2024-06-30",
      progress: 45,
      description: "Rénovation énergétique complète avec isolation thermique, changement des menuiseries et installation de panneaux solaires",
      impact: ["500 élèves bénéficiaires", "Économie énergétique 40%", "Confort thermique amélioré"],
      contractor: "EcoBat Solutions",
      citizenScore: 4.6,
      comments: 23,
      updates: [
        { date: "2024-02-15", message: "Installation de l'isolation des combles terminée" },
        { date: "2024-02-10", message: "Démarrage des travaux de menuiserie" }
      ]
    },
    {
      id: 2,
      name: "Réfection Rue du Commerce",
      category: 'voirie',
      location: "Quartier Nord",
      budget: 280000,
      torpScore: "B+",
      savings: 34000,
      status: 'planned',
      startDate: "2024-03-01",
      endDate: "2024-05-15",
      progress: 0,
      description: "Réfection complète de la voirie avec création de pistes cyclables et amélioration de l'accessibilité PMR",
      impact: ["2km de voirie rénovée", "Sécurité piétons renforcée", "Mobilité douce favorisée"],
      contractor: "Travaux Publics Moderne",
      citizenScore: 4.3,
      comments: 45,
      updates: []
    },
    {
      id: 3,
      name: "Éclairage LED Centre-Ville",
      category: 'éclairage',
      location: "Secteur Centre",
      budget: 125000,
      torpScore: "A-",
      savings: 23000,
      status: 'completed',
      startDate: "2023-11-01",
      endDate: "2024-01-31",
      progress: 100,
      description: "Remplacement de l'éclairage public par des LED connectées pour réduire la consommation énergétique",
      impact: ["150 points lumineux", "Économie 60% sur facture", "Réduction pollution lumineuse"],
      contractor: "LumièreTech",
      citizenScore: 4.8,
      comments: 12,
      updates: [
        { date: "2024-01-31", message: "Projet terminé - Économies visibles dès le 1er mois" }
      ]
    },
    {
      id: 4,
      name: "Parc Municipal Vert",
      category: 'espaces-verts',
      location: "Zone Sud",
      budget: 380000,
      torpScore: "A",
      savings: 45000,
      status: 'in-progress',
      startDate: "2024-01-10",
      endDate: "2024-07-30",
      progress: 30,
      description: "Création d'un nouveau parc de 2 hectares avec aires de jeux, parcours sportif et zone de biodiversité",
      impact: ["5000 riverains concernés", "Îlot de fraîcheur urbain", "Biodiversité locale préservée"],
      contractor: "Jardins & Paysages",
      citizenScore: 4.9,
      comments: 67,
      updates: [
        { date: "2024-02-12", message: "Plantations des arbres effectuées" },
        { date: "2024-02-05", message: "Aménagement des allées en cours" }
      ]
    },
    {
      id: 5,
      name: "Maison de Quartier Rénovée",
      category: 'social',
      location: "Quartier Est",
      budget: 195000,
      torpScore: "B+",
      savings: 28000,
      status: 'in-progress',
      startDate: "2024-02-01",
      endDate: "2024-04-30",
      progress: 55,
      description: "Rénovation et mise aux normes de la maison de quartier avec création d'espaces polyvalents",
      impact: ["300 usagers/semaine", "Accessibilité PMR", "Services sociaux renforcés"],
      contractor: "BatiSocial Pro",
      citizenScore: 4.4,
      comments: 34,
      updates: [
        { date: "2024-02-18", message: "Salles polyvalentes opérationnelles" }
      ]
    }
  ];

  const getCategoryConfig = (category: string) => {
    switch (category) {
      case 'école':
        return { label: 'Éducation', color: 'bg-blue-500/10 text-blue-700', icon: '🏫' };
      case 'voirie':
        return { label: 'Voirie', color: 'bg-gray-500/10 text-gray-700', icon: '🛣️' };
      case 'espaces-verts':
        return { label: 'Espaces Verts', color: 'bg-green-500/10 text-green-700', icon: '🌳' };
      case 'bâtiment-public':
        return { label: 'Bâtiments', color: 'bg-orange-500/10 text-orange-700', icon: '🏛️' };
      case 'éclairage':
        return { label: 'Éclairage', color: 'bg-yellow-500/10 text-yellow-700', icon: '💡' };
      case 'social':
        return { label: 'Social', color: 'bg-purple-500/10 text-purple-700', icon: '👥' };
      default:
        return { label: category, color: '', icon: '📋' };
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'planned':
        return { label: 'Planifié', color: 'bg-blue-500/10 text-blue-700' };
      case 'in-progress':
        return { label: 'En cours', color: 'bg-green-500/10 text-green-700' };
      case 'completed':
        return { label: 'Terminé', color: 'bg-gray-500/10 text-gray-700' };
      default:
        return { label: status, color: '' };
    }
  };

  const filteredProjects = publicProjects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         project.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || project.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const stats = {
    totalBudget: publicProjects.reduce((acc, p) => acc + p.budget, 0),
    totalSavings: publicProjects.reduce((acc, p) => acc + p.savings, 0),
    activeProjects: publicProjects.filter(p => p.status === 'in-progress').length,
    avgScore: publicProjects.reduce((acc, p) => acc + p.citizenScore, 0) / publicProjects.length
  };

  const handleSubscribe = (projectId: number) => {
    toast.success("Vous recevrez les notifications pour ce projet");
  };

  const handleComment = (projectId: number) => {
    toast.info("Fonctionnalité de commentaire à venir");
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header Public */}
      <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Users className="h-6 w-6 text-green-600" />
                Projets de Votre Ville
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Transparence et suivi en temps réel des travaux publics
              </CardDescription>
            </div>
            <Button variant="outline">
              <Bell className="w-4 h-4 mr-2" />
              S'abonner aux alertes
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.activeProjects}</div>
              <p className="text-sm text-muted-foreground">Projets en cours</p>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{(stats.totalBudget / 1000000).toFixed(1)}M€</div>
              <p className="text-sm text-muted-foreground">Budget investi</p>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{(stats.totalSavings / 1000).toFixed(0)}k€</div>
              <p className="text-sm text-muted-foreground">Économies TORP</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{stats.avgScore.toFixed(1)}/5</div>
              <p className="text-sm text-muted-foreground">Satisfaction citoyens</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Transparence */}
      <Card className="border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Target className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium mb-1">🏛️ Engagement Transparence</h4>
              <p className="text-sm text-muted-foreground">
                Tous les projets publics sont analysés par TORP pour garantir les meilleurs prix et éviter les arnaques. 
                Suivez l'avancement en temps réel et donnez votre avis !
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un projet ou un quartier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory('all')}
          >
            Tous
          </Button>
          <Button
            variant={selectedCategory === 'école' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory('école')}
          >
            🏫 Éducation
          </Button>
          <Button
            variant={selectedCategory === 'voirie' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory('voirie')}
          >
            🛣️ Voirie
          </Button>
          <Button
            variant={selectedCategory === 'espaces-verts' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory('espaces-verts')}
          >
            🌳 Espaces Verts
          </Button>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {filteredProjects.map(project => {
          const categoryConfig = getCategoryConfig(project.category);
          const statusConfig = getStatusConfig(project.status);
          return (
            <Card key={project.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{categoryConfig.icon}</span>
                      <Badge className={categoryConfig.color}>{categoryConfig.label}</Badge>
                      <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                    </div>
                    <CardTitle className="text-lg mb-1">{project.name}</CardTitle>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span>{project.location}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-green-500/10 text-green-700 text-lg px-3 py-1">
                      {project.torpScore}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">Score TORP</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Description */}
                <p className="text-sm text-muted-foreground">{project.description}</p>

                {/* Progress */}
                {project.status !== 'planned' && (
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Avancement</span>
                      <span className="font-medium">{project.progress}%</span>
                    </div>
                    <Progress value={project.progress} className="h-2" />
                  </div>
                )}

                {/* Budget & Savings */}
                <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Budget</p>
                    <p className="font-semibold flex items-center gap-1">
                      <Euro className="w-4 h-4" />
                      {project.budget.toLocaleString()}€
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Économie TORP</p>
                    <p className="font-semibold text-green-600 flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      {project.savings.toLocaleString()}€
                    </p>
                  </div>
                </div>

                {/* Impact */}
                <div>
                  <p className="text-sm font-medium mb-2">Impact citoyen</p>
                  <div className="space-y-1">
                    {project.impact.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timeline */}
                <div className="flex items-center justify-between text-sm pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {new Date(project.startDate).toLocaleDateString()} → {new Date(project.endDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{project.contractor}</span>
                  </div>
                </div>

                {/* Latest Update */}
                {project.updates.length > 0 && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-muted-foreground mb-1">
                      📢 Dernière mise à jour • {project.updates[0].date}
                    </p>
                    <p className="text-sm">{project.updates[0].message}</p>
                  </div>
                )}

                {/* Citizen Engagement */}
                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className={`text-lg ${i < Math.round(project.citizenScore) ? '⭐' : '☆'}`}>
                          {i < Math.round(project.citizenScore) ? '⭐' : '☆'}
                        </span>
                      ))}
                      <span className="text-sm ml-2">{project.citizenScore}/5</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MessageSquare className="w-4 h-4" />
                      <span>{project.comments} avis</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleSubscribe(project.id)}
                  >
                    <Bell className="w-3 h-3 mr-1" />
                    Suivre
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleComment(project.id)}
                  >
                    <MessageSquare className="w-3 h-3 mr-1" />
                    Avis
                  </Button>
                  <Button variant="outline" size="sm">
                    <Share2 className="w-3 h-3 mr-1" />
                    Partager
                  </Button>
                  <Button variant="outline" size="sm">
                    <Eye className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { 
  LayoutGrid, 
  List, 
  Calendar,
  Clock,
  Users,
  MapPin,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Plus,
  Filter,
  Search,
  Download,
  Eye,
  Edit,
  Trash2,
  Phone,
  Mail
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Project {
  id: number;
  name: string;
  client: string;
  status: 'planning' | 'in-progress' | 'paused' | 'completed';
  progress: number;
  startDate: string;
  endDate: string;
  budget: number;
  spent: number;
  team: string[];
  location: string;
  priority: 'high' | 'medium' | 'low';
  phase: string;
  daysRemaining: number;
}

export function MultiProjectManagement() {
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'timeline'>('kanban');
  const [searchQuery, setSearchQuery] = useState("");

  const projects: Project[] = [
    {
      id: 1,
      name: "Rénovation Villa Moderne",
      client: "M. et Mme Rousseau",
      status: 'in-progress',
      progress: 65,
      startDate: "2024-01-15",
      endDate: "2024-03-30",
      budget: 85000,
      spent: 55250,
      team: ["Jean D.", "Marie M.", "Pierre L."],
      location: "Paris 16e",
      priority: 'high',
      phase: "Électricité",
      daysRemaining: 45
    },
    {
      id: 2,
      name: "Extension Maison",
      client: "Famille Dubois",
      status: 'in-progress',
      progress: 35,
      startDate: "2024-02-01",
      endDate: "2024-05-15",
      budget: 125000,
      spent: 43750,
      team: ["Sophie L.", "Marc T."],
      location: "Neuilly-sur-Seine",
      priority: 'high',
      phase: "Gros œuvre",
      daysRemaining: 75
    },
    {
      id: 3,
      name: "Rénovation Appartement T3",
      client: "Mme Martin",
      status: 'planning',
      progress: 5,
      startDate: "2024-03-01",
      endDate: "2024-04-30",
      budget: 45000,
      spent: 2250,
      team: ["Jean D."],
      location: "Paris 11e",
      priority: 'medium',
      phase: "Préparation",
      daysRemaining: 90
    },
    {
      id: 4,
      name: "Cuisine Équipée Premium",
      client: "M. Leclerc",
      status: 'in-progress',
      progress: 80,
      startDate: "2024-01-20",
      endDate: "2024-02-28",
      budget: 32000,
      spent: 25600,
      team: ["Marie M.", "Pierre L."],
      location: "Boulogne-Billancourt",
      priority: 'high',
      phase: "Finitions",
      daysRemaining: 15
    },
    {
      id: 5,
      name: "Isolation Combles",
      client: "Copro Les Jardins",
      status: 'completed',
      progress: 100,
      startDate: "2024-01-05",
      endDate: "2024-02-05",
      budget: 28000,
      spent: 27100,
      team: ["Marc T."],
      location: "Versailles",
      priority: 'low',
      phase: "Terminé",
      daysRemaining: 0
    },
    {
      id: 6,
      name: "Salle de Bain Luxe",
      client: "M. Petit",
      status: 'paused',
      progress: 45,
      startDate: "2024-01-25",
      endDate: "2024-03-15",
      budget: 38000,
      spent: 17100,
      team: ["Sophie L."],
      location: "Saint-Cloud",
      priority: 'medium',
      phase: "Attente matériaux",
      daysRemaining: 60
    }
  ];

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'planning':
        return { label: 'Planification', color: 'bg-blue-500/10 text-blue-700 hover:bg-blue-500/20', icon: Calendar };
      case 'in-progress':
        return { label: 'En cours', color: 'bg-green-500/10 text-green-700 hover:bg-green-500/20', icon: Clock };
      case 'paused':
        return { label: 'En pause', color: 'bg-orange-500/10 text-orange-700 hover:bg-orange-500/20', icon: AlertCircle };
      case 'completed':
        return { label: 'Terminé', color: 'bg-gray-500/10 text-gray-700 hover:bg-gray-500/20', icon: CheckCircle2 };
      default:
        return { label: status, color: '', icon: Clock };
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

  const handleNewProject = () => {
    toast.success("Nouveau projet créé");
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.client.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const projectsByStatus = {
    planning: filteredProjects.filter(p => p.status === 'planning'),
    'in-progress': filteredProjects.filter(p => p.status === 'in-progress'),
    paused: filteredProjects.filter(p => p.status === 'paused'),
    completed: filteredProjects.filter(p => p.status === 'completed')
  };

  const ProjectCard = ({ project }: { project: Project }) => {
    const statusConfig = getStatusConfig(project.status);
    const budgetUsed = (project.spent / project.budget) * 100;
    const StatusIcon = statusConfig.icon;

    return (
      <Card className="mb-3 hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-sm">{project.name}</h4>
                  <Badge variant="outline" className={`text-xs ${getPriorityColor(project.priority)}`}>
                    {project.priority === 'high' ? '🔴' : project.priority === 'medium' ? '🟡' : '🟢'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{project.client}</p>
              </div>
              <Badge className={`text-xs ${statusConfig.color}`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusConfig.label}
              </Badge>
            </div>

            {/* Progress */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Avancement</span>
                <span className="font-medium">{project.progress}%</span>
              </div>
              <Progress value={project.progress} className="h-1.5" />
            </div>

            {/* Info */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="w-3 h-3" />
                {project.location}
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="w-3 h-3" />
                {project.daysRemaining > 0 ? `${project.daysRemaining}j restants` : 'Terminé'}
              </div>
            </div>

            {/* Budget */}
            <div className="flex items-center justify-between text-xs pt-2 border-t">
              <span className="text-muted-foreground">Budget</span>
              <div className="text-right">
                <span className={budgetUsed > 90 ? 'text-red-600 font-medium' : 'font-medium'}>
                  {project.spent.toLocaleString()}€
                </span>
                <span className="text-muted-foreground"> / {project.budget.toLocaleString()}€</span>
              </div>
            </div>

            {/* Team */}
            <div className="flex items-center gap-2">
              <Users className="w-3 h-3 text-muted-foreground" />
              <div className="flex gap-1">
                {project.team.map((member, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs px-1.5 py-0">
                    {member}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-1 pt-2 border-t">
              <Button variant="ghost" size="sm" className="h-7 text-xs flex-1">
                <Eye className="w-3 h-3 mr-1" />
                Voir
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs flex-1">
                <Edit className="w-3 h-3 mr-1" />
                Modifier
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Gestion Multi-Projets</CardTitle>
              <CardDescription className="text-base mt-2">
                Vue d'ensemble et suivi de tous vos chantiers
              </CardDescription>
            </div>
            <Button onClick={handleNewProject}>
              <Plus className="w-4 h-4 mr-2" />
              Nouveau Projet
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {projectsByStatus.planning.length}
              </div>
              <p className="text-sm text-muted-foreground">Planification</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {projectsByStatus['in-progress'].length}
              </div>
              <p className="text-sm text-muted-foreground">En cours</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {projectsByStatus.paused.length}
              </div>
              <p className="text-sm text-muted-foreground">En pause</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">
                {projectsByStatus.completed.length}
              </div>
              <p className="text-sm text-muted-foreground">Terminés</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters & View Mode */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un projet ou client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'kanban' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('kanban')}
          >
            <LayoutGrid className="w-4 h-4 mr-2" />
            Kanban
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4 mr-2" />
            Liste
          </Button>
          <Button
            variant={viewMode === 'timeline' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('timeline')}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Timeline
          </Button>
        </div>
        <Button variant="outline" size="sm">
          <Filter className="w-4 h-4 mr-2" />
          Filtres
        </Button>
      </div>

      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-4 gap-4">
          {/* Planification */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-blue-700">
                Planification ({projectsByStatus.planning.length})
              </h3>
            </div>
            <div className="space-y-3">
              {projectsByStatus.planning.map(project => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </div>

          {/* En cours */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-green-700">
                En cours ({projectsByStatus['in-progress'].length})
              </h3>
            </div>
            <div className="space-y-3">
              {projectsByStatus['in-progress'].map(project => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </div>

          {/* En pause */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-orange-700">
                En pause ({projectsByStatus.paused.length})
              </h3>
            </div>
            <div className="space-y-3">
              {projectsByStatus.paused.map(project => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </div>

          {/* Terminés */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-gray-700">
                Terminés ({projectsByStatus.completed.length})
              </h3>
            </div>
            <div className="space-y-3">
              {projectsByStatus.completed.map(project => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              {filteredProjects.map(project => {
                const statusConfig = getStatusConfig(project.status);
                const budgetUsed = (project.spent / project.budget) * 100;
                return (
                  <div key={project.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold">{project.name}</h4>
                          <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                          <Badge variant="outline" className={getPriorityColor(project.priority)}>
                            Priorité {project.priority}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-4 gap-6 text-sm">
                          <div>
                            <p className="text-muted-foreground">Client</p>
                            <p className="font-medium">{project.client}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Phase</p>
                            <p className="font-medium">{project.phase}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Budget</p>
                            <p className="font-medium">
                              {project.spent.toLocaleString()}€ / {project.budget.toLocaleString()}€
                              <span className={`ml-2 ${budgetUsed > 90 ? 'text-red-600' : 'text-green-600'}`}>
                                ({Math.round(budgetUsed)}%)
                              </span>
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Deadline</p>
                            <p className="font-medium">{project.endDate}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right mr-4">
                          <div className="text-2xl font-bold">{project.progress}%</div>
                          <Progress value={project.progress} className="w-20 h-2 mt-1" />
                        </div>
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-6">
              <div className="relative">
                {/* Timeline bar */}
                <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border" />
                
                {filteredProjects.map((project, idx) => {
                  const statusConfig = getStatusConfig(project.status);
                  return (
                    <div key={project.id} className="relative pl-16 pb-8">
                      {/* Timeline dot */}
                      <div className={`absolute left-6 top-2 w-5 h-5 rounded-full border-4 border-background ${
                        project.status === 'completed' ? 'bg-green-600' :
                        project.status === 'in-progress' ? 'bg-blue-600' :
                        project.status === 'paused' ? 'bg-orange-600' :
                        'bg-gray-400'
                      }`} />
                      
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h4 className="font-semibold">{project.name}</h4>
                              <p className="text-sm text-muted-foreground">{project.client}</p>
                            </div>
                            <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Début</p>
                              <p className="font-medium">{project.startDate}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Fin prévue</p>
                              <p className="font-medium">{project.endDate}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Avancement</p>
                              <div className="flex items-center gap-2">
                                <Progress value={project.progress} className="flex-1 h-2" />
                                <span className="font-medium">{project.progress}%</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
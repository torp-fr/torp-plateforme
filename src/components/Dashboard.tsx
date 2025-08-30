import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  FileText, 
  Clock, 
  Euro,
  BarChart3,
  CheckCircle,
  AlertCircle
} from "lucide-react";

export const Dashboard = () => {
  const mockProjects = [
    {
      id: "DEV-001",
      title: "Rénovation salle de bain",
      company: "Rénov'Expert",
      amount: 8500,
      grade: "A",
      status: "En cours",
      progress: 75,
      gradeColor: "grade-a"
    },
    {
      id: "DEV-002", 
      title: "Isolation combles",
      company: "Iso-Confort",
      amount: 3200,
      grade: "B",
      status: "Accepté",
      progress: 25,
      gradeColor: "grade-b"
    },
    {
      id: "DEV-003",
      title: "Peinture façade",
      company: "Couleur & Co",
      amount: 5800,
      grade: "C",
      status: "En attente",
      progress: 0,
      gradeColor: "grade-c"
    }
  ];

  const stats = [
    {
      title: "Devis analysés",
      value: "127",
      change: "+12%",
      icon: FileText,
      trend: "up"
    },
    {
      title: "Projets actifs",
      value: "8",
      change: "+3",
      icon: Clock,
      trend: "up"
    },
    {
      title: "Budget total",
      value: "45 600€",
      change: "+8%",
      icon: Euro,
      trend: "up"
    },
    {
      title: "Note moyenne",
      value: "B+",
      change: "↗",
      icon: BarChart3,
      trend: "up"
    }
  ];

  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Tableau de bord intelligent
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Suivez l'analyse de vos devis, l'avancement de vos projets et la gestion financière
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {stats.map((stat, index) => (
            <Card key={index} variant="gradient" className="animate-fade-in">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <stat.icon className="h-5 w-5 text-primary" />
                  <Badge variant="success" className="text-xs">
                    {stat.change}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">
                  {stat.title}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Projects Table */}
        <Card variant="elevated" className="animate-fade-in">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl">Projets récents</CardTitle>
              <Button variant="outline" size="sm">
                Voir tout
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {mockProjects.map((project, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-background rounded-lg border">
                  <div className="flex items-center gap-4">
                    <Badge variant={project.gradeColor as any} className="text-lg font-bold px-3 py-1">
                      {project.grade}
                    </Badge>
                    <div>
                      <h4 className="font-semibold text-foreground">{project.title}</h4>
                      <p className="text-sm text-muted-foreground">{project.company}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="font-semibold text-foreground">
                        {project.amount.toLocaleString()}€
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {project.status}
                      </div>
                    </div>
                    
                    <div className="w-24">
                      <Progress value={project.progress} className="h-2" />
                      <div className="text-xs text-muted-foreground mt-1 text-center">
                        {project.progress}%
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      {project.status === "En cours" && (
                        <Clock className="h-4 w-4 text-warning" />
                      )}
                      {project.status === "Accepté" && (
                        <CheckCircle className="h-4 w-4 text-success" />
                      )}
                      {project.status === "En attente" && (
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
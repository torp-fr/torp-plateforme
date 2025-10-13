import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Calendar, Clock, AlertTriangle, CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { format, addDays, differenceInDays, isAfter, isBefore } from "date-fns";
import { fr } from "date-fns/locale";

interface TimelinePhase {
  id: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  status: "completed" | "in-progress" | "pending" | "delayed";
  progress: number;
  tasks: TimelineTask[];
  dependencies?: string[];
}

interface TimelineTask {
  id: string;
  name: string;
  duration: number;
  status: "completed" | "in-progress" | "pending";
  responsible?: string;
}

export const ProjectTimeline = ({ projectId }: { projectId: string }) => {
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);

  // Mock data - À remplacer par des données réelles
  const phases: TimelinePhase[] = [
    {
      id: "admin",
      name: "Démarches administratives",
      description: "Permis et autorisations",
      startDate: new Date(),
      endDate: addDays(new Date(), 30),
      status: "in-progress",
      progress: 60,
      tasks: [
        { id: "1", name: "Dépôt permis de construire", duration: 1, status: "completed" },
        { id: "2", name: "Attente validation mairie", duration: 20, status: "in-progress" },
        { id: "3", name: "Obtention assurances", duration: 5, status: "pending" },
      ]
    },
    {
      id: "prep",
      name: "Préparation chantier",
      description: "Installation et sécurisation",
      startDate: addDays(new Date(), 30),
      endDate: addDays(new Date(), 40),
      status: "pending",
      progress: 0,
      tasks: [
        { id: "4", name: "Installation clôture", duration: 1, status: "pending" },
        { id: "5", name: "Raccordements provisoires", duration: 2, status: "pending" },
        { id: "6", name: "Base vie chantier", duration: 1, status: "pending" },
      ],
      dependencies: ["admin"]
    },
    {
      id: "gros-oeuvre",
      name: "Gros œuvre",
      description: "Structure et fondations",
      startDate: addDays(new Date(), 40),
      endDate: addDays(new Date(), 80),
      status: "pending",
      progress: 0,
      tasks: [
        { id: "7", name: "Terrassement", duration: 5, status: "pending" },
        { id: "8", name: "Fondations", duration: 10, status: "pending" },
        { id: "9", name: "Élévation murs", duration: 15, status: "pending" },
        { id: "10", name: "Charpente et couverture", duration: 10, status: "pending" },
      ],
      dependencies: ["prep"]
    },
    {
      id: "second-oeuvre",
      name: "Second œuvre",
      description: "Isolation et menuiseries",
      startDate: addDays(new Date(), 80),
      endDate: addDays(new Date(), 120),
      status: "pending",
      progress: 0,
      tasks: [
        { id: "11", name: "Isolation thermique", duration: 8, status: "pending" },
        { id: "12", name: "Pose menuiseries", duration: 5, status: "pending" },
        { id: "13", name: "Plomberie", duration: 10, status: "pending" },
        { id: "14", name: "Électricité", duration: 10, status: "pending" },
      ],
      dependencies: ["gros-oeuvre"]
    },
    {
      id: "finitions",
      name: "Finitions",
      description: "Revêtements et peintures",
      startDate: addDays(new Date(), 120),
      endDate: addDays(new Date(), 150),
      status: "pending",
      progress: 0,
      tasks: [
        { id: "15", name: "Plâtrerie", duration: 10, status: "pending" },
        { id: "16", name: "Carrelage", duration: 8, status: "pending" },
        { id: "17", name: "Peinture", duration: 7, status: "pending" },
        { id: "18", name: "Parquet", duration: 5, status: "pending" },
      ],
      dependencies: ["second-oeuvre"]
    },
    {
      id: "reception",
      name: "Réception",
      description: "Contrôles et livraison",
      startDate: addDays(new Date(), 150),
      endDate: addDays(new Date(), 160),
      status: "pending",
      progress: 0,
      tasks: [
        { id: "19", name: "Nettoyage final", duration: 2, status: "pending" },
        { id: "20", name: "Visite pré-réception", duration: 1, status: "pending" },
        { id: "21", name: "Levée réserves", duration: 5, status: "pending" },
        { id: "22", name: "Réception définitive", duration: 1, status: "pending" },
      ],
      dependencies: ["finitions"]
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-500";
      case "in-progress": return "bg-blue-500";
      case "delayed": return "bg-red-500";
      default: return "bg-gray-300";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "in-progress": return <Clock className="w-5 h-5 text-blue-500" />;
      case "delayed": return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default: return <Circle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getTotalDuration = () => {
    if (phases.length === 0) return 0;
    return differenceInDays(
      phases[phases.length - 1].endDate,
      phases[0].startDate
    );
  };

  const getOverallProgress = () => {
    const total = phases.reduce((acc, phase) => acc + phase.progress, 0);
    return Math.round(total / phases.length);
  };

  return (
    <div className="space-y-6">
      {/* Vue d'ensemble */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Planning Projet
          </CardTitle>
          <CardDescription>
            Durée totale estimée : {getTotalDuration()} jours
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Avancement global</span>
              <span className="font-semibold">{getOverallProgress()}%</span>
            </div>
            <Progress value={getOverallProgress()} className="h-2" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-green-500">
                {phases.filter(p => p.status === "completed").length}
              </div>
              <div className="text-xs text-muted-foreground">Terminées</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-blue-500">
                {phases.filter(p => p.status === "in-progress").length}
              </div>
              <div className="text-xs text-muted-foreground">En cours</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-gray-500">
                {phases.filter(p => p.status === "pending").length}
              </div>
              <div className="text-xs text-muted-foreground">À venir</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-red-500">
                {phases.filter(p => p.status === "delayed").length}
              </div>
              <div className="text-xs text-muted-foreground">Retard</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline visuelle */}
      <Card>
        <CardHeader>
          <CardTitle>Chronologie des phases</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {phases.map((phase, index) => (
              <div key={phase.id} className="relative">
                {index < phases.length - 1 && (
                  <div className="absolute left-5 top-14 w-0.5 h-full bg-border" />
                )}
                
                <div
                  className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    selectedPhase === phase.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => setSelectedPhase(
                    selectedPhase === phase.id ? null : phase.id
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      {getStatusIcon(phase.status)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{phase.name}</h3>
                        <Badge variant={
                          phase.status === "completed" ? "default" :
                          phase.status === "in-progress" ? "secondary" :
                          "outline"
                        }>
                          {phase.status === "completed" ? "Terminé" :
                           phase.status === "in-progress" ? "En cours" :
                           phase.status === "delayed" ? "Retard" : "À venir"}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-3">
                        {phase.description}
                      </p>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(phase.startDate, "dd MMM", { locale: fr })}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(phase.endDate, "dd MMM yyyy", { locale: fr })}
                        </span>
                        <span className="ml-auto">
                          {differenceInDays(phase.endDate, phase.startDate)} jours
                        </span>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Progression</span>
                          <span className="font-semibold">{phase.progress}%</span>
                        </div>
                        <Progress value={phase.progress} className="h-2" />
                      </div>

                      {/* Détails des tâches */}
                      {selectedPhase === phase.id && (
                        <div className="mt-4 pt-4 border-t space-y-2">
                          <h4 className="font-medium text-sm mb-3">Tâches détaillées</h4>
                          {phase.tasks.map(task => (
                            <div
                              key={task.id}
                              className="flex items-center justify-between p-2 rounded bg-muted/50"
                            >
                              <div className="flex items-center gap-2">
                                {task.status === "completed" ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                                ) : task.status === "in-progress" ? (
                                  <Clock className="w-4 h-4 text-blue-500" />
                                ) : (
                                  <Circle className="w-4 h-4 text-gray-400" />
                                )}
                                <span className="text-sm">{task.name}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {task.duration}j
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Prochaines échéances */}
      <Card>
        <CardHeader>
          <CardTitle>Prochaines échéances</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {phases
              .filter(p => p.status === "in-progress" || p.status === "pending")
              .slice(0, 3)
              .map(phase => (
                <div
                  key={phase.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted"
                >
                  <div>
                    <div className="font-medium">{phase.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {format(phase.endDate, "dd MMMM yyyy", { locale: fr })}
                    </div>
                  </div>
                  <Badge variant="outline">
                    Dans {differenceInDays(phase.endDate, new Date())} jours
                  </Badge>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

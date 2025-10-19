import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { 
  Calendar as CalendarIcon,
  Users,
  Clock,
  MapPin,
  Plus,
  ChevronLeft,
  ChevronRight,
  Filter,
  Download,
  AlertCircle,
  CheckCircle2,
  User
} from "lucide-react";
import { toast } from "sonner";

interface TeamMember {
  id: number;
  name: string;
  role: string;
  skills: string[];
  availability: number;
  currentProjects: number;
}

interface Assignment {
  id: number;
  projectName: string;
  member: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  type: 'chantier' | 'devis' | 'maintenance' | 'reunion';
}

export function TeamScheduler() {
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [selectedMember, setSelectedMember] = useState<number | null>(null);

  const teamMembers: TeamMember[] = [
    {
      id: 1,
      name: "Jean Dupont",
      role: "Chef d'équipe",
      skills: ["Maçonnerie", "Gros œuvre"],
      availability: 75,
      currentProjects: 3
    },
    {
      id: 2,
      name: "Marie Martin",
      role: "Électricienne",
      skills: ["Électricité", "Domotique"],
      availability: 90,
      currentProjects: 2
    },
    {
      id: 3,
      name: "Pierre Durand",
      role: "Plombier",
      skills: ["Plomberie", "Chauffage"],
      availability: 60,
      currentProjects: 4
    },
    {
      id: 4,
      name: "Sophie Leblanc",
      role: "Peintre",
      skills: ["Peinture", "Finitions"],
      availability: 85,
      currentProjects: 2
    },
    {
      id: 5,
      name: "Marc Petit",
      role: "Menuisier",
      skills: ["Menuiserie", "Parquet"],
      availability: 70,
      currentProjects: 3
    }
  ];

  const weekDays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  
  const assignments: Assignment[] = [
    {
      id: 1,
      projectName: "Villa Moderne",
      member: "Jean Dupont",
      date: "2024-02-19",
      startTime: "08:00",
      endTime: "17:00",
      location: "Paris 16e",
      status: 'scheduled',
      type: 'chantier'
    },
    {
      id: 2,
      projectName: "Extension Maison",
      member: "Jean Dupont",
      date: "2024-02-20",
      startTime: "08:00",
      endTime: "17:00",
      location: "Neuilly",
      status: 'scheduled',
      type: 'chantier'
    },
    {
      id: 3,
      projectName: "Appt T3 Électricité",
      member: "Marie Martin",
      date: "2024-02-19",
      startTime: "09:00",
      endTime: "18:00",
      location: "Paris 11e",
      status: 'in-progress',
      type: 'chantier'
    },
    {
      id: 4,
      projectName: "Cuisine Premium",
      member: "Marie Martin",
      date: "2024-02-20",
      startTime: "14:00",
      endTime: "18:00",
      location: "Boulogne",
      status: 'scheduled',
      type: 'chantier'
    },
    {
      id: 5,
      projectName: "Salle de Bain Luxe",
      member: "Pierre Durand",
      date: "2024-02-19",
      startTime: "08:00",
      endTime: "12:00",
      location: "Saint-Cloud",
      status: 'completed',
      type: 'chantier'
    },
    {
      id: 6,
      projectName: "Devis Rénovation",
      member: "Pierre Durand",
      date: "2024-02-20",
      startTime: "10:00",
      endTime: "11:30",
      location: "Versailles",
      status: 'scheduled',
      type: 'devis'
    },
    {
      id: 7,
      projectName: "Finitions Appt",
      member: "Sophie Leblanc",
      date: "2024-02-21",
      startTime: "08:00",
      endTime: "17:00",
      location: "Paris 15e",
      status: 'scheduled',
      type: 'chantier'
    },
    {
      id: 8,
      projectName: "Pose Parquet",
      member: "Marc Petit",
      date: "2024-02-22",
      startTime: "09:00",
      endTime: "16:00",
      location: "Courbevoie",
      status: 'scheduled',
      type: 'chantier'
    }
  ];

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'scheduled':
        return { label: 'Planifié', color: 'bg-blue-500/10 text-blue-700', dot: 'bg-blue-500' };
      case 'in-progress':
        return { label: 'En cours', color: 'bg-green-500/10 text-green-700', dot: 'bg-green-500' };
      case 'completed':
        return { label: 'Terminé', color: 'bg-gray-500/10 text-gray-700', dot: 'bg-gray-500' };
      case 'cancelled':
        return { label: 'Annulé', color: 'bg-red-500/10 text-red-700', dot: 'bg-red-500' };
      default:
        return { label: status, color: '', dot: 'bg-gray-500' };
    }
  };

  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'chantier':
        return { icon: '🏗️', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' };
      case 'devis':
        return { icon: '📋', color: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400' };
      case 'maintenance':
        return { icon: '🔧', color: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400' };
      case 'reunion':
        return { icon: '👥', color: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' };
      default:
        return { icon: '📅', color: '' };
    }
  };

  const handleNewAssignment = () => {
    toast.success("Nouvelle affectation créée");
  };

  const getAvailabilityColor = (availability: number) => {
    if (availability >= 80) return 'text-green-600';
    if (availability >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Get assignments for a specific member and day
  const getAssignmentsForMemberAndDay = (memberId: number, dayOffset: number) => {
    const member = teamMembers.find(m => m.id === memberId);
    if (!member) return [];
    
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + dayOffset);
    const dateStr = targetDate.toISOString().split('T')[0];
    
    return assignments.filter(a => 
      a.member === member.name && 
      a.date === dateStr
    );
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <CalendarIcon className="h-6 w-6" />
                Planning Équipe
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Gestion des affectations et disponibilités
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                <Filter className="w-4 h-4 mr-2" />
                Filtres
              </Button>
              <Button onClick={handleNewAssignment}>
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle affectation
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{teamMembers.length}</div>
              <p className="text-sm text-muted-foreground">Membres actifs</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{assignments.filter(a => a.status === 'in-progress').length}</div>
              <p className="text-sm text-muted-foreground">En cours</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{assignments.filter(a => a.status === 'scheduled').length}</div>
              <p className="text-sm text-muted-foreground">Planifiés</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {Math.round(teamMembers.reduce((acc, m) => acc + m.availability, 0) / teamMembers.length)}%
              </div>
              <p className="text-sm text-muted-foreground">Disponibilité moy.</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {teamMembers.filter(m => m.availability < 50).length}
              </div>
              <p className="text-sm text-muted-foreground">Surcharge</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 bg-muted/50">
          <TabsTrigger value="calendar">
            <CalendarIcon className="w-4 h-4 mr-2" />
            Vue Calendrier
          </TabsTrigger>
          <TabsTrigger value="team">
            <Users className="w-4 h-4 mr-2" />
            Vue Équipe
          </TabsTrigger>
          <TabsTrigger value="list">
            <Clock className="w-4 h-4 mr-2" />
            Liste tâches
          </TabsTrigger>
        </TabsList>

        {/* Calendar View */}
        <TabsContent value="calendar" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button variant="outline" size="sm" onClick={() => setSelectedWeek(selectedWeek - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <h3 className="font-semibold">Semaine du 19 au 24 Février 2024</h3>
                  <Button variant="outline" size="sm" onClick={() => setSelectedWeek(selectedWeek + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Exporter
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left p-3 border-b font-medium w-40">Membre</th>
                      {weekDays.map((day, idx) => (
                        <th key={idx} className="text-center p-3 border-b font-medium">
                          <div>{day}</div>
                          <div className="text-xs text-muted-foreground font-normal">{19 + idx}/02</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {teamMembers.map(member => (
                      <tr key={member.id} className="border-b hover:bg-muted/50">
                        <td className="p-3">
                          <div>
                            <div className="font-medium">{member.name}</div>
                            <div className="text-xs text-muted-foreground">{member.role}</div>
                            <div className={`text-xs font-medium mt-1 ${getAvailabilityColor(member.availability)}`}>
                              {member.availability}% dispo
                            </div>
                          </div>
                        </td>
                        {weekDays.map((_, dayIdx) => {
                          const dayAssignments = getAssignmentsForMemberAndDay(member.id, dayIdx);
                          return (
                            <td key={dayIdx} className="p-2 align-top">
                              <div className="space-y-1">
                                {dayAssignments.map(assignment => {
                                  const statusConfig = getStatusConfig(assignment.status);
                                  const typeConfig = getTypeConfig(assignment.type);
                                  return (
                                    <div 
                                      key={assignment.id}
                                      className={`text-xs p-2 rounded border-l-2 ${typeConfig.color} cursor-pointer hover:shadow-sm transition-shadow`}
                                    >
                                      <div className="flex items-center gap-1 mb-1">
                                        <span>{typeConfig.icon}</span>
                                        <span className="font-medium truncate">{assignment.projectName}</span>
                                      </div>
                                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {assignment.startTime} - {assignment.endTime}
                                      </div>
                                      <div className="flex items-center gap-1 mt-1">
                                        <div className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                                        <span className="text-xs">{statusConfig.label}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                                {dayAssignments.length === 0 && (
                                  <div className="text-center text-xs text-muted-foreground py-4">
                                    Libre
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team View */}
        <TabsContent value="team" className="space-y-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamMembers.map(member => {
              const memberAssignments = assignments.filter(a => a.member === member.name);
              return (
                <Card key={member.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{member.name}</CardTitle>
                        <CardDescription>{member.role}</CardDescription>
                      </div>
                      <Badge className={getAvailabilityColor(member.availability)}>
                        {member.availability}% dispo
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Compétences</p>
                      <div className="flex flex-wrap gap-1">
                        {member.skills.map((skill, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Affectations ({member.currentProjects} projets)
                      </p>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {memberAssignments.slice(0, 3).map(assignment => {
                          const statusConfig = getStatusConfig(assignment.status);
                          return (
                            <div key={assignment.id} className="text-xs p-2 border rounded">
                              <div className="font-medium mb-1">{assignment.projectName}</div>
                              <div className="flex items-center justify-between text-muted-foreground">
                                <span>{assignment.date}</span>
                                <Badge className={`text-xs ${statusConfig.color}`}>
                                  {statusConfig.label}
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <Button variant="outline" className="w-full" size="sm">
                      Voir planning complet
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* List View */}
        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-3">
                {assignments.map(assignment => {
                  const statusConfig = getStatusConfig(assignment.status);
                  const typeConfig = getTypeConfig(assignment.type);
                  return (
                    <div key={assignment.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-xl">{typeConfig.icon}</span>
                            <h4 className="font-semibold">{assignment.projectName}</h4>
                            <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                          </div>
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-muted-foreground" />
                              <span>{assignment.member}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                              <span>{assignment.date}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              <span>{assignment.startTime} - {assignment.endTime}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-muted-foreground" />
                              <span>{assignment.location}</span>
                            </div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          Modifier
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Camera,
  Upload,
  CheckCircle,
  AlertTriangle,
  Clock,
  MapPin,
  Calendar,
  Eye,
  Download,
  FileText,
  Shield,
  Hammer,
  Zap,
  Droplet,
  Paintbrush,
  ThermometerSun
} from "lucide-react";

interface ConstructionPhoto {
  id: string;
  url: string;
  date: Date;
  phase: string;
  geolocation?: { lat: number; lng: number };
  description: string;
  aiDetection?: {
    conformity: boolean;
    issues: string[];
    quality: number;
  };
}

interface ChecklistItem {
  id: string;
  phase: string;
  category: string;
  description: string;
  dtu: string;
  completed: boolean;
  date?: Date;
  notes?: string;
}

export function ConstructionTracking() {
  const { toast } = useToast();
  const [activePhase, setActivePhase] = useState("demolition");
  const [photos, setPhotos] = useState<ConstructionPhoto[]>([
    {
      id: "1",
      url: "/placeholder.svg",
      date: new Date("2024-01-15"),
      phase: "demolition",
      description: "Dépose cuisine existante terminée",
      aiDetection: {
        conformity: true,
        issues: [],
        quality: 95
      }
    },
    {
      id: "2",
      url: "/placeholder.svg",
      date: new Date("2024-01-18"),
      phase: "electricity",
      description: "Mise aux normes électriques en cours",
      aiDetection: {
        conformity: false,
        issues: ["Câbles apparents en zone humide détectés"],
        quality: 78
      }
    }
  ]);

  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    {
      id: "1",
      phase: "demolition",
      category: "Dépose",
      description: "Dépose propre sans endommagement structure",
      dtu: "DTU 20.1",
      completed: true,
      date: new Date("2024-01-15")
    },
    {
      id: "2",
      phase: "demolition",
      category: "Dépose",
      description: "Évacuation gravats et déchets",
      dtu: "DTU 20.1",
      completed: true,
      date: new Date("2024-01-15")
    },
    {
      id: "3",
      phase: "electricity",
      category: "Électricité",
      description: "Tableau électrique conforme NF C 15-100",
      dtu: "NF C 15-100",
      completed: true,
      date: new Date("2024-01-18")
    },
    {
      id: "4",
      phase: "electricity",
      category: "Électricité",
      description: "Câbles gainés en zone humide (IP44 minimum)",
      dtu: "NF C 15-100",
      completed: false,
      notes: "Correction demandée le 18/01"
    },
    {
      id: "5",
      phase: "electricity",
      category: "Électricité",
      description: "Prises et éclairage correctement positionnés",
      dtu: "NF C 15-100",
      completed: false
    },
    {
      id: "6",
      phase: "plumbing",
      category: "Plomberie",
      description: "Arrivées eau chaude/froide testées sans fuite",
      dtu: "DTU 60.1",
      completed: false
    },
    {
      id: "7",
      phase: "plumbing",
      category: "Plomberie",
      description: "Évacuations conformes avec siphons",
      dtu: "DTU 60.1",
      completed: false
    },
    {
      id: "8",
      phase: "tiling",
      category: "Carrelage",
      description: "Joints réalisés avec étanchéité conforme",
      dtu: "DTU 52.2",
      completed: false
    },
    {
      id: "9",
      phase: "tiling",
      category: "Carrelage",
      description: "Niveau et alignement vérifiés",
      dtu: "DTU 52.2",
      completed: false
    },
    {
      id: "10",
      phase: "installation",
      category: "Menuiserie",
      description: "Meubles d'aplomb et de niveau",
      dtu: "DTU 36.1",
      completed: false
    },
    {
      id: "11",
      phase: "installation",
      category: "Menuiserie",
      description: "Fixations murales résistantes à la charge",
      dtu: "DTU 36.1",
      completed: false
    },
    {
      id: "12",
      phase: "finishing",
      category: "Finitions",
      description: "Peinture 2 couches sans coulures",
      dtu: "DTU 59.1",
      completed: false
    }
  ]);

  const phases = [
    { id: "demolition", name: "Dépose", icon: Hammer, progress: 100, status: "completed" },
    { id: "electricity", name: "Électricité", icon: Zap, progress: 75, status: "in-progress" },
    { id: "plumbing", name: "Plomberie", icon: Droplet, progress: 0, status: "upcoming" },
    { id: "tiling", name: "Carrelage", icon: ThermometerSun, progress: 0, status: "upcoming" },
    { id: "installation", name: "Installation", icon: Hammer, progress: 0, status: "upcoming" },
    { id: "finishing", name: "Finitions", icon: Paintbrush, progress: 0, status: "upcoming" }
  ];

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      toast({
        title: "Photos uploadées",
        description: `${files.length} photo(s) ajoutée(s) avec analyse IA en cours...`,
      });
      // Simulation upload et analyse IA
      setTimeout(() => {
        toast({
          title: "Analyse IA terminée",
          description: "Conformité vérifiée automatiquement",
        });
      }, 2000);
    }
  };

  const toggleChecklistItem = (itemId: string) => {
    setChecklist(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, completed: !item.completed, date: !item.completed ? new Date() : undefined }
        : item
    ));
  };

  const currentPhase = phases.find(p => p.id === activePhase);
  const phaseChecklist = checklist.filter(item => item.phase === activePhase);
  const phasePhotos = photos.filter(photo => photo.phase === activePhase);
  const completedItems = phaseChecklist.filter(item => item.completed).length;
  const totalItems = phaseChecklist.length;
  const phaseProgress = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  const overallProgress = Math.round(
    phases.reduce((sum, phase) => sum + phase.progress, 0) / phases.length
  );

  return (
    <div className="space-y-6">
      {/* Timeline visuelle des phases */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Avancement Global du Chantier
          </CardTitle>
          <CardDescription>
            Projet : Rénovation Cuisine • Entreprise : BatiCuisine Pro
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Progression totale</span>
              <span className="text-2xl font-bold text-primary">{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-3" />
            
            {/* Timeline des phases */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-6">
              {phases.map((phase) => {
                const Icon = phase.icon;
                return (
                  <button
                    key={phase.id}
                    onClick={() => setActivePhase(phase.id)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      activePhase === phase.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Icon className={`h-6 w-6 ${
                        phase.status === "completed" ? "text-green-600" :
                        phase.status === "in-progress" ? "text-orange-600" :
                        "text-muted-foreground"
                      }`} />
                      <span className="text-xs font-medium text-center">{phase.name}</span>
                      <Badge variant={
                        phase.status === "completed" ? "default" :
                        phase.status === "in-progress" ? "secondary" :
                        "outline"
                      } className="text-xs">
                        {phase.progress}%
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Détails de la phase active */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {currentPhase && <currentPhase.icon className="h-5 w-5" />}
                Phase : {currentPhase?.name}
              </CardTitle>
              <CardDescription>
                Progression : {completedItems}/{totalItems} tâches validées
              </CardDescription>
            </div>
            <Badge variant={
              currentPhase?.status === "completed" ? "default" :
              currentPhase?.status === "in-progress" ? "secondary" :
              "outline"
            } className="text-lg px-4 py-2">
              {currentPhase?.progress}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="checklist" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="checklist">
                <CheckCircle className="h-4 w-4 mr-2" />
                Checklist DTU
              </TabsTrigger>
              <TabsTrigger value="photos">
                <Camera className="h-4 w-4 mr-2" />
                Photos Chantier
              </TabsTrigger>
            </TabsList>

            <TabsContent value="checklist" className="space-y-4">
              <div className="mb-4">
                <Progress value={phaseProgress} className="h-2" />
              </div>

              <div className="space-y-3">
                {phaseChecklist.map((item) => (
                  <Card key={item.id} className={item.completed ? "bg-green-50 dark:bg-green-950/20" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={item.completed}
                          onCheckedChange={() => toggleChecklistItem(item.id)}
                          className="mt-1"
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <p className={`font-medium ${item.completed ? "line-through text-muted-foreground" : ""}`}>
                              {item.description}
                            </p>
                            {item.completed && (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <Badge variant="outline" className="text-xs">
                              <Shield className="h-3 w-3 mr-1" />
                              {item.dtu}
                            </Badge>
                            {item.date && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {item.date.toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          {item.notes && (
                            <div className="flex items-start gap-2 mt-2 p-2 bg-orange-50 dark:bg-orange-950/20 rounded-md">
                              <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5" />
                              <p className="text-xs text-orange-700 dark:text-orange-400">{item.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {phaseChecklist.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Cette phase n'a pas encore démarré</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="photos" className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  {phasePhotos.length} photo(s) • Analyse IA automatique
                </p>
                <Button size="sm" className="gap-2">
                  <Upload className="h-4 w-4" />
                  <Label htmlFor="photo-upload" className="cursor-pointer">
                    Ajouter Photos
                  </Label>
                  <Input
                    id="photo-upload"
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {phasePhotos.map((photo) => (
                  <Card key={photo.id}>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                          <img
                            src={photo.url}
                            alt={photo.description}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {photo.date.toLocaleDateString()}
                            </span>
                            {photo.geolocation && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                GPS vérifié
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium">{photo.description}</p>
                          
                          {photo.aiDetection && (
                            <div className={`p-3 rounded-lg ${
                              photo.aiDetection.conformity 
                                ? "bg-green-50 dark:bg-green-950/20" 
                                : "bg-orange-50 dark:bg-orange-950/20"
                            }`}>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium flex items-center gap-1">
                                  <Shield className="h-3 w-3" />
                                  Analyse IA
                                </span>
                                <Badge variant={photo.aiDetection.conformity ? "default" : "destructive"} className="text-xs">
                                  {photo.aiDetection.quality}% qualité
                                </Badge>
                              </div>
                              {photo.aiDetection.issues.length > 0 && (
                                <div className="space-y-1">
                                  {photo.aiDetection.issues.map((issue, idx) => (
                                    <div key={idx} className="flex items-start gap-2">
                                      <AlertTriangle className="h-3 w-3 text-orange-600 mt-0.5" />
                                      <p className="text-xs text-orange-700 dark:text-orange-400">{issue}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {photo.aiDetection.conformity && (
                                <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400">
                                  <CheckCircle className="h-3 w-3" />
                                  Conforme aux normes DTU
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {phasePhotos.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground mb-4">Aucune photo pour cette phase</p>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Upload className="h-4 w-4" />
                    <Label htmlFor="photo-upload-empty" className="cursor-pointer">
                      Ajouter des Photos
                    </Label>
                    <Input
                      id="photo-upload-empty"
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Alertes et recommandations */}
      <Card className="border-orange-200 dark:border-orange-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
            <AlertTriangle className="h-5 w-5" />
            Alertes & Points d'Attention
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-sm">Câbles électriques non conformes détectés</p>
              <p className="text-xs text-muted-foreground mt-1">
                Norme NF C 15-100 : Les câbles en zone humide doivent être gainés (IP44 minimum)
              </p>
              <Button variant="outline" size="sm" className="mt-2 text-xs">
                <FileText className="h-3 w-3 mr-1" />
                Voir fiche technique NF C 15-100
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Download,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Home,
  Wrench,
  Euro,
  Calendar,
  Camera,
  Lightbulb,
  Shield,
  Droplet,
  ThermometerSun,
  Hammer
} from "lucide-react";

interface ProjectData {
  projectType: string;
  roomType: string;
  surfaceArea: string;
  budget: string;
  timeline: string;
  description: string;
  specificNeeds: string[];
  photos?: File[];
  address: string;
  currentState: string;
}

export function CCTPGenerator() {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [projectData, setProjectData] = useState<ProjectData>({
    projectType: "",
    roomType: "",
    surfaceArea: "",
    budget: "",
    timeline: "",
    description: "",
    specificNeeds: [],
    address: "",
    currentState: ""
  });

  const totalSteps = 5;
  const progress = (step / totalSteps) * 100;

  const projectTypes = [
    { id: "renovation", label: "Rénovation", icon: Wrench, description: "Travaux de rénovation complète ou partielle" },
    { id: "extension", label: "Extension", icon: Home, description: "Agrandissement d'espace existant" },
    { id: "construction", label: "Construction neuve", icon: Hammer, description: "Nouvelle construction" },
    { id: "amenagement", label: "Aménagement", icon: Lightbulb, description: "Aménagement d'espace" }
  ];

  const roomTypes = [
    { id: "cuisine", label: "Cuisine", icon: Wrench, works: ["Plomberie", "Électricité", "Carrelage", "Menuiserie"] },
    { id: "salle-bain", label: "Salle de bain", icon: Droplet, works: ["Plomberie", "Électricité", "Carrelage", "Étanchéité"] },
    { id: "salon", label: "Salon/Séjour", icon: Home, works: ["Électricité", "Peinture", "Revêtement sol"] },
    { id: "chambre", label: "Chambre", icon: Home, works: ["Électricité", "Peinture", "Revêtement sol"] },
    { id: "combles", label: "Combles", icon: ThermometerSun, works: ["Isolation", "Électricité", "Plomberie", "Menuiserie"] },
    { id: "facade", label: "Façade", icon: Home, works: ["Ravalement", "Isolation extérieure", "Peinture"] }
  ];

  const specificNeeds = [
    { id: "norme-pmr", label: "Accessibilité PMR" },
    { id: "isolation-thermique", label: "Isolation thermique renforcée" },
    { id: "isolation-phonique", label: "Isolation phonique" },
    { id: "domotique", label: "Domotique / Maison connectée" },
    { id: "eco-materiaux", label: "Matériaux écologiques" },
    { id: "energie-renouvelable", label: "Énergies renouvelables" }
  ];

  const handleNext = () => {
    if (validateStep()) {
      setStep(step + 1);
    }
  };

  const handlePrevious = () => {
    setStep(step - 1);
  };

  const validateStep = () => {
    switch (step) {
      case 1:
        if (!projectData.projectType) {
          toast({
            title: "Champ requis",
            description: "Veuillez sélectionner un type de projet",
            variant: "destructive"
          });
          return false;
        }
        break;
      case 2:
        if (!projectData.roomType || !projectData.surfaceArea) {
          toast({
            title: "Champs requis",
            description: "Veuillez compléter tous les champs obligatoires",
            variant: "destructive"
          });
          return false;
        }
        break;
      case 3:
        if (!projectData.budget || !projectData.timeline) {
          toast({
            title: "Champs requis",
            description: "Veuillez compléter tous les champs obligatoires",
            variant: "destructive"
          });
          return false;
        }
        break;
    }
    return true;
  };

  const toggleSpecificNeed = (needId: string) => {
    setProjectData(prev => ({
      ...prev,
      specificNeeds: prev.specificNeeds.includes(needId)
        ? prev.specificNeeds.filter(id => id !== needId)
        : [...prev.specificNeeds, needId]
    }));
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      setProjectData(prev => ({
        ...prev,
        photos: Array.from(files)
      }));
      toast({
        title: "Photos ajoutées",
        description: `${files.length} photo(s) uploadée(s) - Analyse IA en cours...`
      });
    }
  };

  const handleGenerateCCTP = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      toast({
        title: "CCTP généré avec succès !",
        description: "Votre Cahier des Clauses Techniques Particulières est prêt (24 pages)",
      });
    }, 3000);
  };

  const selectedRoom = roomTypes.find(r => r.id === projectData.roomType);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Générateur CCTP Intelligent
              </CardTitle>
              <CardDescription>
                Créez votre Cahier des Clauses Techniques en 5 étapes
              </CardDescription>
            </div>
            <Badge className="text-lg px-4 py-2">
              Étape {step}/{totalSteps}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progression</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">Quel type de projet souhaitez-vous réaliser ?</h3>
                <p className="text-sm text-muted-foreground">Sélectionnez la catégorie qui correspond le mieux à vos travaux</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projectTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      onClick={() => setProjectData({ ...projectData, projectType: type.id })}
                      className={`p-6 rounded-lg border-2 transition-all text-left ${
                        projectData.projectType === type.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <Icon className={`h-8 w-8 ${
                          projectData.projectType === type.id ? "text-primary" : "text-muted-foreground"
                        }`} />
                        <div className="flex-1">
                          <h4 className="font-semibold text-lg mb-1">{type.label}</h4>
                          <p className="text-sm text-muted-foreground">{type.description}</p>
                        </div>
                        {projectData.projectType === type.id && (
                          <CheckCircle className="h-6 w-6 text-primary" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">Décrivez l'espace concerné</h3>
                <p className="text-sm text-muted-foreground">Sélectionnez le type de pièce et indiquez ses dimensions</p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="roomType" className="text-base font-medium mb-3 block">Type de pièce</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {roomTypes.map((room) => {
                      const Icon = room.icon;
                      return (
                        <button
                          key={room.id}
                          onClick={() => setProjectData({ ...projectData, roomType: room.id })}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            projectData.roomType === room.id
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <Icon className={`h-6 w-6 mb-2 mx-auto ${
                            projectData.roomType === room.id ? "text-primary" : "text-muted-foreground"
                          }`} />
                          <p className="text-sm font-medium text-center">{room.label}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedRoom && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium mb-2">Corps d'état concernés :</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedRoom.works.map((work) => (
                        <Badge key={work} variant="secondary">{work}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="surface">Surface (m²) *</Label>
                    <Input
                      id="surface"
                      type="number"
                      placeholder="Ex: 12"
                      value={projectData.surfaceArea}
                      onChange={(e) => setProjectData({ ...projectData, surfaceArea: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="address">Adresse du chantier</Label>
                    <Input
                      id="address"
                      placeholder="Ex: 12 Rue des Lilas, 75015 Paris"
                      value={projectData.address}
                      onChange={(e) => setProjectData({ ...projectData, address: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="currentState">État actuel de l'espace</Label>
                  <Textarea
                    id="currentState"
                    placeholder="Décrivez l'état actuel : ancien carrelage, peinture écaillée, installation vétuste..."
                    value={projectData.currentState}
                    onChange={(e) => setProjectData({ ...projectData, currentState: e.target.value })}
                    className="min-h-[100px]"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">Budget et calendrier</h3>
                <p className="text-sm text-muted-foreground">Définissez votre budget et vos contraintes de temps</p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="budget" className="text-base font-medium mb-3 block">
                    <Euro className="h-4 w-4 inline mr-2" />
                    Budget envisagé *
                  </Label>
                  <RadioGroup value={projectData.budget} onValueChange={(value) => setProjectData({ ...projectData, budget: value })}>
                    {[
                      { value: "moins-10k", label: "Moins de 10 000 €", description: "Travaux légers" },
                      { value: "10k-20k", label: "10 000 - 20 000 €", description: "Rénovation standard" },
                      { value: "20k-50k", label: "20 000 - 50 000 €", description: "Rénovation complète" },
                      { value: "plus-50k", label: "Plus de 50 000 €", description: "Travaux d'envergure" }
                    ].map((option) => (
                      <div key={option.value} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                        <RadioGroupItem value={option.value} id={option.value} />
                        <Label htmlFor={option.value} className="flex-1 cursor-pointer">
                          <span className="font-medium">{option.label}</span>
                          <span className="text-sm text-muted-foreground block">{option.description}</span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <Separator />

                <div>
                  <Label htmlFor="timeline" className="text-base font-medium mb-3 block">
                    <Calendar className="h-4 w-4 inline mr-2" />
                    Délai souhaité *
                  </Label>
                  <RadioGroup value={projectData.timeline} onValueChange={(value) => setProjectData({ ...projectData, timeline: value })}>
                    {[
                      { value: "urgent", label: "Urgent (moins de 1 mois)", description: "Démarrage immédiat" },
                      { value: "court", label: "Court terme (1-3 mois)", description: "Démarrage rapide" },
                      { value: "moyen", label: "Moyen terme (3-6 mois)", description: "Planning flexible" },
                      { value: "long", label: "Long terme (plus de 6 mois)", description: "En phase d'étude" }
                    ].map((option) => (
                      <div key={option.value} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                        <RadioGroupItem value={option.value} id={option.value} />
                        <Label htmlFor={option.value} className="flex-1 cursor-pointer">
                          <span className="font-medium">{option.label}</span>
                          <span className="text-sm text-muted-foreground block">{option.description}</span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">Besoins spécifiques et Contraintes</h3>
                <p className="text-sm text-muted-foreground">Sélectionnez les options qui s'appliquent à votre projet</p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-base font-medium mb-3 block">
                    <Shield className="h-4 w-4 inline mr-2" />
                    Contraintes techniques et normes
                  </Label>
                  <div className="grid md:grid-cols-2 gap-3">
                    {specificNeeds.map((need) => (
                      <button
                        key={need.id}
                        onClick={() => toggleSpecificNeed(need.id)}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                          projectData.specificNeeds.includes(need.id)
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{need.label}</span>
                          {projectData.specificNeeds.includes(need.id) && (
                            <CheckCircle className="h-5 w-5 text-primary" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <Label htmlFor="description" className="text-base font-medium mb-2 block">
                    Description détaillée de votre projet
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="Décrivez vos attentes, vos préférences de matériaux, style souhaité, points d'attention particuliers..."
                    value={projectData.description}
                    onChange={(e) => setProjectData({ ...projectData, description: e.target.value })}
                    className="min-h-[150px]"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Plus votre description est détaillée, plus le CCTP sera précis et adapté
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">Photos et finalisation</h3>
                <p className="text-sm text-muted-foreground">Ajoutez des photos pour enrichir l'analyse IA (optionnel)</p>
              </div>

              <div className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Camera className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="font-medium mb-2">Uploadez des photos de l'espace</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    L'IA TORP analysera automatiquement les dimensions, l'état et les contraintes
                  </p>
                  <Input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="max-w-xs mx-auto"
                  />
                  {projectData.photos && projectData.photos.length > 0 && (
                    <Badge className="mt-4" variant="secondary">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {projectData.photos.length} photo(s) ajoutée(s)
                    </Badge>
                  )}
                </div>

                <Separator />

                <div className="bg-muted/50 p-6 rounded-lg space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Récapitulatif de votre projet
                  </h4>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Type de projet</p>
                      <p className="font-medium">
                        {projectTypes.find(t => t.id === projectData.projectType)?.label}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Pièce</p>
                      <p className="font-medium">
                        {roomTypes.find(r => r.id === projectData.roomType)?.label} ({projectData.surfaceArea} m²)
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Budget</p>
                      <p className="font-medium">{projectData.budget}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Délai</p>
                      <p className="font-medium">{projectData.timeline}</p>
                    </div>
                    {projectData.specificNeeds.length > 0 && (
                      <div className="md:col-span-2">
                        <p className="text-muted-foreground mb-2">Besoins spécifiques</p>
                        <div className="flex flex-wrap gap-2">
                          {projectData.specificNeeds.map(needId => {
                            const need = specificNeeds.find(n => n.id === needId);
                            return need && <Badge key={needId} variant="outline">{need.label}</Badge>;
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="flex-1 text-sm">
                    <p className="font-medium text-blue-900 dark:text-blue-400 mb-1">
                      Votre CCTP contiendra :
                    </p>
                    <ul className="text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
                      <li>Description détaillée des travaux par corps d'état</li>
                      <li>Références aux normes DTU applicables</li>
                      <li>Spécifications techniques des matériaux</li>
                      <li>Planning prévisionnel des interventions</li>
                      <li>Liste des vérifications et contrôles obligatoires</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={step === 1}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Précédent
            </Button>

            {step < totalSteps ? (
              <Button onClick={handleNext} className="gap-2">
                Suivant
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleGenerateCCTP}
                disabled={isGenerating}
                size="lg"
                className="gap-2"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                    Génération en cours...
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5" />
                    Générer le CCTP
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

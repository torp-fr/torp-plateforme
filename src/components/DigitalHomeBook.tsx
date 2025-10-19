import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Home,
  Calendar,
  Bell,
  FileText,
  Euro,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle,
  Wrench,
  Shield,
  Zap,
  Droplet,
  Flame,
  Download,
  Plus,
  Eye,
  Settings
} from "lucide-react";

interface WorkHistory {
  id: string;
  date: Date;
  type: string;
  description: string;
  company: string;
  amount: number;
  documents: string[];
  warranty: {
    type: string;
    expiryDate: Date;
  };
}

interface MaintenanceReminder {
  id: string;
  title: string;
  category: string;
  dueDate: Date;
  frequency: string;
  priority: "low" | "medium" | "high";
  status: "upcoming" | "due" | "overdue";
  description: string;
  icon: any;
}

export function DigitalHomeBook() {
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState("all");

  const workHistory: WorkHistory[] = [
    {
      id: "1",
      date: new Date("2024-03-01"),
      type: "Rénovation Cuisine",
      description: "Rénovation complète avec électricité, plomberie, carrelage",
      company: "BatiCuisine Pro",
      amount: 18450,
      documents: ["Devis", "Facture", "Photos", "PV Réception", "DOE"],
      warranty: {
        type: "Décennale",
        expiryDate: new Date("2034-03-01")
      }
    },
    {
      id: "2",
      date: new Date("2023-10-15"),
      type: "Isolation Combles",
      description: "Isolation thermique renforcée RE2020",
      company: "IsoTherm Expert",
      amount: 8900,
      documents: ["Devis", "Facture", "Certificat RE2020"],
      warranty: {
        type: "Biennale",
        expiryDate: new Date("2025-10-15")
      }
    },
    {
      id: "3",
      date: new Date("2023-06-20"),
      type: "Chaudière gaz",
      description: "Installation chaudière condensation",
      company: "Chauffage Plus",
      amount: 4200,
      documents: ["Devis", "Facture", "Certificat conformité"],
      warranty: {
        type: "Garantie fabricant",
        expiryDate: new Date("2028-06-20")
      }
    }
  ];

  const maintenanceReminders: MaintenanceReminder[] = [
    {
      id: "1",
      title: "Révision chaudière annuelle",
      category: "Chauffage",
      dueDate: new Date("2024-06-20"),
      frequency: "Annuelle",
      priority: "high",
      status: "due",
      description: "Entretien obligatoire chaudière gaz",
      icon: Flame
    },
    {
      id: "2",
      title: "Ramonage conduit",
      category: "Chauffage",
      dueDate: new Date("2024-09-01"),
      frequency: "Annuelle",
      priority: "high",
      status: "upcoming",
      description: "Ramonage obligatoire 2 fois/an pour cheminée",
      icon: Flame
    },
    {
      id: "3",
      title: "Vérification joints carrelage cuisine",
      category: "Étanchéité",
      dueDate: new Date("2025-03-01"),
      frequency: "Annuelle (1ère année)",
      priority: "medium",
      status: "upcoming",
      description: "Contrôle garantie parfait achèvement",
      icon: Droplet
    },
    {
      id: "4",
      title: "Test installation électrique",
      category: "Électricité",
      dueDate: new Date("2024-12-01"),
      frequency: "Annuelle (recommandée)",
      priority: "medium",
      status: "upcoming",
      description: "Vérification conformité NF C 15-100",
      icon: Zap
    },
    {
      id: "5",
      title: "Nettoyage VMC",
      category: "Ventilation",
      dueDate: new Date("2024-09-01"),
      frequency: "Semestrielle",
      priority: "low",
      status: "upcoming",
      description: "Nettoyage filtres et bouches VMC",
      icon: Settings
    }
  ];

  const propertyValue = {
    initialValue: 285000,
    currentValue: 305000,
    workInvestment: 31550,
    appreciationPercent: 7.0
  };

  const categories = [
    { id: "all", label: "Tous", icon: Home },
    { id: "heating", label: "Chauffage", icon: Flame },
    { id: "plumbing", label: "Plomberie", icon: Droplet },
    { id: "electricity", label: "Électricité", icon: Zap },
    { id: "maintenance", label: "Entretien", icon: Wrench }
  ];

  const filteredReminders = activeCategory === "all" 
    ? maintenanceReminders 
    : maintenanceReminders.filter(r => {
        const categoryMap: Record<string, string> = {
          "heating": "Chauffage",
          "plumbing": "Plomberie",
          "electricity": "Électricité",
          "maintenance": "Entretien"
        };
        return r.category === categoryMap[activeCategory];
      });

  const upcomingReminders = maintenanceReminders.filter(r => r.status !== "overdue").length;
  const overdueReminders = maintenanceReminders.filter(r => r.status === "overdue").length;

  return (
    <div className="space-y-6">
      {/* Header avec valeur patrimoniale */}
      <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-6 w-6 text-primary" />
                Carnet Numérique de Logement
              </CardTitle>
              <CardDescription>
                Historique complet des travaux • Rappels automatiques • Valorisation patrimoine
              </CardDescription>
            </div>
            <Badge className="text-lg px-4 py-2">
              <TrendingUp className="h-4 w-4 mr-2" />
              +{propertyValue.appreciationPercent}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Valeur initiale</p>
              <p className="text-2xl font-bold">€{propertyValue.initialValue.toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Investissement travaux</p>
              <p className="text-2xl font-bold text-blue-600">+€{propertyValue.workInvestment.toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Valeur estimée actuelle</p>
              <p className="text-2xl font-bold text-green-600">€{propertyValue.currentValue.toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Plus-value estimée</p>
              <p className="text-2xl font-bold text-primary">€{(propertyValue.currentValue - propertyValue.initialValue).toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="history" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="history">
            <FileText className="h-4 w-4 mr-2" />
            Historique Travaux
          </TabsTrigger>
          <TabsTrigger value="reminders">
            <Bell className="h-4 w-4 mr-2" />
            Rappels ({upcomingReminders})
          </TabsTrigger>
          <TabsTrigger value="value">
            <TrendingUp className="h-4 w-4 mr-2" />
            Valorisation
          </TabsTrigger>
        </TabsList>

        {/* Historique des travaux */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Historique Complet des Travaux</CardTitle>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter manuellement
                </Button>
              </div>
              <CardDescription>
                Tous les travaux TORP et ajouts manuels centralisés
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {workHistory.map((work, index) => (
                  <Card key={work.id} className="border-2">
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-lg">{work.type}</h4>
                              {index === 0 && (
                                <Badge variant="secondary">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  TORP
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{work.description}</p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {work.date.toLocaleDateString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <Wrench className="h-3 w-3" />
                                {work.company}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-primary">€{work.amount.toLocaleString()}</p>
                            <Badge variant="outline" className="mt-2">
                              <Shield className="h-3 w-3 mr-1" />
                              {work.warranty.type}
                            </Badge>
                          </div>
                        </div>

                        <Separator />

                        <div className="space-y-2">
                          <p className="text-sm font-medium">Documents disponibles ({work.documents.length})</p>
                          <div className="flex flex-wrap gap-2">
                            {work.documents.map((doc) => (
                              <Button key={doc} variant="outline" size="sm" className="gap-2">
                                <FileText className="h-3 w-3" />
                                {doc}
                                <Eye className="h-3 w-3" />
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2 text-sm">
                            <Shield className="h-4 w-4 text-green-600" />
                            <span>Garantie {work.warranty.type} active</span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            Expire le {work.warranty.expiryDate.toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rappels d'entretien */}
        <TabsContent value="reminders" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Rappels d'Entretien Automatiques</CardTitle>
                <div className="flex gap-2">
                  {overdueReminders > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {overdueReminders} en retard
                    </Badge>
                  )}
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="h-3 w-3" />
                    {upcomingReminders} à venir
                  </Badge>
                </div>
              </div>
              <CardDescription>
                Notifications automatiques basées sur garanties et DTU
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {categories.map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <Button
                        key={cat.id}
                        variant={activeCategory === cat.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActiveCategory(cat.id)}
                        className="gap-2 whitespace-nowrap"
                      >
                        <Icon className="h-4 w-4" />
                        {cat.label}
                      </Button>
                    );
                  })}
                </div>

                <div className="space-y-3">
                  {filteredReminders.map((reminder) => {
                    const Icon = reminder.icon;
                    const isPriority = reminder.priority === "high";
                    const isDue = reminder.status === "due";
                    
                    return (
                      <Card 
                        key={reminder.id} 
                        className={`border-2 ${
                          isDue ? "border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/20" : ""
                        }`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <Icon className={`h-5 w-5 mt-1 ${
                                isDue ? "text-orange-600" : "text-muted-foreground"
                              }`} />
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold">{reminder.title}</h4>
                                  {isPriority && (
                                    <Badge variant="destructive" className="text-xs">
                                      Prioritaire
                                    </Badge>
                                  )}
                                  {isDue && (
                                    <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">
                                      À faire maintenant
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">{reminder.description}</p>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {reminder.dueDate.toLocaleDateString()}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {reminder.frequency}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {reminder.category}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <Button variant="outline" size="sm">
                              Planifier
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Valorisation patrimoniale */}
        <TabsContent value="value" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Impact Travaux sur Valeur Patrimoniale</CardTitle>
              <CardDescription>
                Estimation plus-value générée par les travaux documentés
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Plus-value estimée totale</p>
                    <p className="text-3xl font-bold text-green-600">
                      +€{(propertyValue.currentValue - propertyValue.initialValue).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Appréciation</p>
                    <p className="text-3xl font-bold text-green-600">+{propertyValue.appreciationPercent}%</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-semibold mb-3">Détail par type de travaux</h4>
                  <div className="space-y-3">
                    {workHistory.map((work) => {
                      const valueAdd = work.amount * 0.65; // Estimation 65% de valorisation
                      const roi = ((valueAdd / work.amount) * 100).toFixed(0);
                      
                      return (
                        <div key={work.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium">{work.type}</p>
                            <p className="text-sm text-muted-foreground">
                              Investissement : €{work.amount.toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600">+€{Math.round(valueAdd).toLocaleString()}</p>
                            <Badge variant="outline" className="text-xs">ROI {roi}%</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Separator />

                <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    Avantage Revente
                  </h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <span>Documentation complète TORP augmente confiance acheteurs</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <span>Garanties décennale transférables = argument négociation</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <span>Historique entretien prouve soin apporté au bien</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <span>DPE amélioré justifie prix premium</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg mb-1">Exporter Carnet Complet</h3>
                  <p className="text-sm text-muted-foreground">
                    PDF professionnel pour acheteur/notaire
                  </p>
                </div>
                <Button size="lg" className="gap-2">
                  <Download className="h-5 w-5" />
                  Télécharger Carnet
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

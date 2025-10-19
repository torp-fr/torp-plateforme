import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Download,
  QrCode,
  Shield,
  CheckCircle,
  Calendar,
  Building,
  User,
  FileCheck,
  Image,
  Clock,
  AlertCircle,
  Package,
  Printer,
  Mail,
  Share2,
  Eye
} from "lucide-react";

interface Equipment {
  id: string;
  name: string;
  brand: string;
  model: string;
  serialNumber: string;
  installDate: Date;
  warranty: {
    type: string;
    duration: string;
    expiryDate: Date;
  };
  qrCode: string;
}

export function DOEGenerator() {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [pvNotes, setPvNotes] = useState("");
  const [pvReserves, setPvReserves] = useState("");

  const projectInfo = {
    name: "Rénovation Cuisine",
    client: "M. et Mme Dupont",
    address: "12 Rue des Lilas, 75015 Paris",
    company: "BatiCuisine Pro",
    siret: "123 456 789 00012",
    startDate: new Date("2024-01-10"),
    endDate: new Date("2024-03-01"),
    totalAmount: 18450
  };

  const documents = [
    {
      id: "1",
      category: "Devis & Contrats",
      name: "Devis initial signé",
      date: "2024-01-05",
      size: "850 KB",
      status: "validated"
    },
    {
      id: "2",
      category: "Devis & Contrats",
      name: "CCTP Projet",
      date: "2024-01-08",
      size: "1.2 MB",
      status: "validated"
    },
    {
      id: "3",
      category: "Photos",
      name: "Photos avant travaux (4)",
      date: "2024-01-10",
      size: "3.5 MB",
      status: "validated"
    },
    {
      id: "4",
      category: "Photos",
      name: "Photos suivi chantier (18)",
      date: "2024-02-15",
      size: "12 MB",
      status: "validated"
    },
    {
      id: "5",
      category: "Photos",
      name: "Photos finales (8)",
      date: "2024-03-01",
      size: "5.8 MB",
      status: "validated"
    },
    {
      id: "6",
      category: "Technique",
      name: "Plans d'exécution",
      date: "2024-01-12",
      size: "2.1 MB",
      status: "validated"
    },
    {
      id: "7",
      category: "Facturation",
      name: "Facture finale",
      date: "2024-03-01",
      size: "456 KB",
      status: "validated"
    }
  ];

  const warranties = [
    {
      id: "1",
      type: "Garantie parfait achèvement",
      duration: "1 an",
      startDate: new Date("2024-03-01"),
      expiryDate: new Date("2025-03-01"),
      coverage: "Tous les désordres constatés à la réception ou durant l'année suivante",
      status: "active"
    },
    {
      id: "2",
      type: "Garantie biennale",
      duration: "2 ans",
      startDate: new Date("2024-03-01"),
      expiryDate: new Date("2026-03-01"),
      coverage: "Équipements dissociables (robinetterie, électroménager, etc.)",
      status: "active"
    },
    {
      id: "3",
      type: "Garantie décennale",
      duration: "10 ans",
      startDate: new Date("2024-03-01"),
      expiryDate: new Date("2034-03-01"),
      coverage: "Dommages compromettant solidité ou habitabilité",
      status: "active"
    }
  ];

  const equipment: Equipment[] = [
    {
      id: "1",
      name: "Hotte aspirante",
      brand: "Siemens",
      model: "LC97BHM50",
      serialNumber: "SN-2024-001234",
      installDate: new Date("2024-02-20"),
      warranty: {
        type: "Fabricant",
        duration: "2 ans",
        expiryDate: new Date("2026-02-20")
      },
      qrCode: "QR-HOTTE-001234"
    },
    {
      id: "2",
      name: "Four encastrable",
      brand: "Bosch",
      model: "HBA5780S0",
      serialNumber: "SN-2024-005678",
      installDate: new Date("2024-02-20"),
      warranty: {
        type: "Fabricant",
        duration: "2 ans",
        expiryDate: new Date("2026-02-20")
      },
      qrCode: "QR-FOUR-005678"
    },
    {
      id: "3",
      name: "Plaque induction",
      brand: "Bosch",
      model: "PIE631FB1E",
      serialNumber: "SN-2024-009012",
      installDate: new Date("2024-02-20"),
      warranty: {
        type: "Fabricant",
        duration: "2 ans",
        expiryDate: new Date("2026-02-20")
      },
      qrCode: "QR-PLAQUE-009012"
    },
    {
      id: "4",
      name: "Robinetterie évier",
      brand: "Grohe",
      model: "Eurosmart",
      serialNumber: "SN-2024-003456",
      installDate: new Date("2024-02-18"),
      warranty: {
        type: "Biennale",
        duration: "2 ans",
        expiryDate: new Date("2026-02-18")
      },
      qrCode: "QR-ROBI-003456"
    }
  ];

  const handleGeneratePV = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      toast({
        title: "PV de réception généré",
        description: "Le document est prêt à être téléchargé",
      });
    }, 2000);
  };

  const handleGenerateDOE = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      toast({
        title: "DOE complet généré",
        description: "Dossier des Ouvrages Exécutés prêt (32 pages)",
      });
    }, 3000);
  };

  const handleGenerateQR = (equipmentId: string) => {
    toast({
      title: "QR Code généré",
      description: "Code scannable pour accès instantané aux informations",
    });
  };

  return (
    <div className="space-y-6">
      {/* En-tête avec statut */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                Génération DOE Automatique
              </CardTitle>
              <CardDescription>
                Dossier des Ouvrages Exécutés • {projectInfo.name}
              </CardDescription>
            </div>
            <Badge className="text-lg px-4 py-2">
              <CheckCircle className="h-4 w-4 mr-2" />
              Chantier Terminé
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Client</p>
              <p className="font-medium">{projectInfo.client}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Entreprise</p>
              <p className="font-medium">{projectInfo.company}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Durée</p>
              <p className="font-medium">7 semaines</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Montant</p>
              <p className="font-medium text-primary">€{projectInfo.totalAmount.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="pv" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pv">
            <FileText className="h-4 w-4 mr-2" />
            PV Réception
          </TabsTrigger>
          <TabsTrigger value="documents">
            <Package className="h-4 w-4 mr-2" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="equipment">
            <QrCode className="h-4 w-4 mr-2" />
            Équipements
          </TabsTrigger>
          <TabsTrigger value="warranties">
            <Shield className="h-4 w-4 mr-2" />
            Garanties
          </TabsTrigger>
        </TabsList>

        {/* PV de réception */}
        <TabsContent value="pv" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Procès-Verbal de Réception des Travaux</CardTitle>
              <CardDescription>Document officiel de fin de chantier</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Informations projet */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Informations Projet
                </h3>
                <div className="grid md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <Label className="text-xs text-muted-foreground">Maître d'ouvrage</Label>
                    <p className="font-medium">{projectInfo.client}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Adresse chantier</Label>
                    <p className="font-medium">{projectInfo.address}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Entreprise</Label>
                    <p className="font-medium">{projectInfo.company}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">SIRET</Label>
                    <p className="font-medium">{projectInfo.siret}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Date début</Label>
                    <p className="font-medium">{projectInfo.startDate.toLocaleDateString()}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Date fin</Label>
                    <p className="font-medium">{projectInfo.endDate.toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Travaux réalisés */}
              <div className="space-y-4">
                <h3 className="font-semibold">Travaux Réalisés</h3>
                <div className="space-y-2">
                  {[
                    "Dépose cuisine existante avec évacuation",
                    "Électricité : remise aux normes NF C 15-100",
                    "Plomberie : évacuations et arrivées d'eau",
                    "Carrelage sol : grès cérame 60×60 cm",
                    "Pose meubles et plan de travail quartz",
                    "Menuiserie : porte et plinthes",
                    "Peinture : 2 couches finition mate"
                  ].map((work, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                      <p className="text-sm">{work}</p>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Conformité */}
              <div className="space-y-4">
                <h3 className="font-semibold">Conformité & Normes</h3>
                <div className="grid md:grid-cols-2 gap-3">
                  {[
                    "Travaux conformes au CCTP",
                    "Normes DTU respectées",
                    "NF C 15-100 (électricité)",
                    "DTU 60.1 (plomberie)",
                    "DTU 52.2 (carrelage)",
                    "Qualité matériaux conforme"
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/20 rounded-lg">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <p className="text-sm">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Réserves */}
              <div className="space-y-4">
                <h3 className="font-semibold">Réserves Éventuelles</h3>
                <Textarea
                  placeholder="Indiquez les éventuelles réserves ou points à corriger..."
                  value={pvReserves}
                  onChange={(e) => setPvReserves(e.target.value)}
                  className="min-h-[100px]"
                />
                {!pvReserves && (
                  <div className="flex items-center gap-2 text-green-600 text-sm">
                    <CheckCircle className="h-4 w-4" />
                    Aucune réserve • Travaux conformes et complets
                  </div>
                )}
              </div>

              <Separator />

              {/* Notes complémentaires */}
              <div className="space-y-4">
                <h3 className="font-semibold">Notes Complémentaires</h3>
                <Textarea
                  placeholder="Ajoutez des notes ou commentaires supplémentaires..."
                  value={pvNotes}
                  onChange={(e) => setPvNotes(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>

              <Separator />

              {/* Actions */}
              <div className="flex gap-3">
                <Button onClick={handleGeneratePV} disabled={isGenerating} className="flex-1">
                  {isGenerating ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Génération en cours...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Générer PV Réception (PDF)
                    </>
                  )}
                </Button>
                <Button variant="outline">
                  <Eye className="h-4 w-4 mr-2" />
                  Prévisualiser
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Documents Compilés</CardTitle>
              <CardDescription>
                Tous les documents du projet centralisés et indexés
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {["Devis & Contrats", "Technique", "Photos", "Facturation"].map((category) => {
                  const categoryDocs = documents.filter(doc => doc.category === category);
                  return (
                    <div key={category} className="space-y-2">
                      <h4 className="font-semibold text-sm text-muted-foreground">{category}</h4>
                      <div className="space-y-2">
                        {categoryDocs.map((doc) => (
                          <Card key={doc.id}>
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <FileText className="h-5 w-5 text-muted-foreground" />
                                  <div>
                                    <p className="font-medium text-sm">{doc.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {doc.date} • {doc.size}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Validé
                                  </Badge>
                                  <Button variant="ghost" size="sm">
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Équipements avec QR Codes */}
        <TabsContent value="equipment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Équipements Installés</CardTitle>
              <CardDescription>
                Avec QR Codes pour accès instantané aux informations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {equipment.map((item) => (
                  <Card key={item.id}>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">{item.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {item.brand} • {item.model}
                            </p>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleGenerateQR(item.id)}
                          >
                            <QrCode className="h-4 w-4" />
                          </Button>
                        </div>
                        <Separator />
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">N° série</span>
                            <span className="font-medium">{item.serialNumber}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Installation</span>
                            <span className="font-medium">{item.installDate.toLocaleDateString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Garantie</span>
                            <Badge variant="secondary">{item.warranty.duration}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Expire le</span>
                            <span className="font-medium">{item.warranty.expiryDate.toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Garanties */}
        <TabsContent value="warranties" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Garanties Actives</CardTitle>
              <CardDescription>
                Toutes les garanties légales et contractuelles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {warranties.map((warranty) => (
                  <Card key={warranty.id} className="border-2">
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <h4 className="font-semibold text-lg">{warranty.type}</h4>
                            <p className="text-sm text-muted-foreground">
                              Durée : {warranty.duration}
                            </p>
                          </div>
                          <Badge className="text-sm">
                            <Shield className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        </div>
                        <p className="text-sm">{warranty.coverage}</p>
                        <Separator />
                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <Label className="text-xs text-muted-foreground">Date début</Label>
                            <p className="font-medium">{warranty.startDate.toLocaleDateString()}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Date expiration</Label>
                            <p className="font-medium text-primary">{warranty.expiryDate.toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Actions globales */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">DOE Complet</h3>
                <p className="text-sm text-muted-foreground">
                  Dossier des Ouvrages Exécutés • PDF professionnel 32 pages
                </p>
              </div>
              <Button size="lg" onClick={handleGenerateDOE} disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Clock className="h-5 w-5 mr-2 animate-spin" />
                    Génération...
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5 mr-2" />
                    Télécharger DOE
                  </>
                )}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1">
                <Mail className="h-4 w-4 mr-2" />
                Envoyer par Email
              </Button>
              <Button variant="outline" className="flex-1">
                <Share2 className="h-4 w-4 mr-2" />
                Partager
              </Button>
              <Button variant="outline" className="flex-1">
                <Printer className="h-4 w-4 mr-2" />
                Imprimer
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

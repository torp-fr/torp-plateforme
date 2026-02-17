import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCarnet } from '@/hooks/phase5/useCarnet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle, Plus, Shield, Clock, CheckCircle2,
  XCircle, FileText, Camera, Euro, Calendar, Phone
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Sinistre {
  id: string;
  titre: string;
  description: string;
  date_sinistre: string;
  date_declaration: string;
  type: 'degat_des_eaux' | 'incendie' | 'vol' | 'catastrophe_naturelle' | 'malfacon' | 'autre';
  garantie_concernee: 'parfait_achevement' | 'biennale' | 'decennale' | 'assurance_habitation' | 'autre';
  statut: 'declare' | 'en_cours' | 'expertise' | 'indemnise' | 'clos' | 'refuse';
  montant_estime?: number;
  montant_indemnise?: number;
  numero_dossier?: string;
  assureur?: string;
  expert?: string;
  photos: string[];
  documents: string[];
}

const TYPES_SINISTRE = [
  { value: 'degat_des_eaux', label: 'Dégât des eaux', icon: '💧' },
  { value: 'incendie', label: 'Incendie', icon: '🔥' },
  { value: 'vol', label: 'Vol / Cambriolage', icon: '🔓' },
  { value: 'catastrophe_naturelle', label: 'Catastrophe naturelle', icon: '🌊' },
  { value: 'malfacon', label: 'Malfaçon / Désordre', icon: '🔨' },
  { value: 'autre', label: 'Autre', icon: '❓' },
];

const GARANTIES = [
  { value: 'parfait_achevement', label: 'Garantie de Parfait Achèvement (1 an)' },
  { value: 'biennale', label: 'Garantie Biennale (2 ans)' },
  { value: 'decennale', label: 'Garantie Décennale (10 ans)' },
  { value: 'assurance_habitation', label: 'Assurance Habitation' },
  { value: 'autre', label: 'Autre' },
];

export function SinistresPage() {
  const { projectId } = useParams();
  const { carnet, sinistres, addSinistre, isLoading } = useCarnet(projectId!);
  const [activeTab, setActiveTab] = useState('en_cours');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Sinistres de démonstration
  const sinistresData: Sinistre[] = sinistres?.length ? sinistres : [];

  // Stats
  const stats = {
    total: sinistresData.length,
    enCours: sinistresData.filter(s => ['declare', 'en_cours', 'expertise'].includes(s.statut)).length,
    indemnises: sinistresData.filter(s => s.statut === 'indemnise').length,
    clos: sinistresData.filter(s => s.statut === 'clos').length,
    refuses: sinistresData.filter(s => s.statut === 'refuse').length,
    montantTotal: sinistresData.reduce((sum, s) => sum + (s.montant_indemnise || 0), 0),
  };

  const getStatusBadge = (statut: Sinistre['statut']) => {
    switch (statut) {
      case 'declare':
        return <Badge className="bg-blue-100 text-blue-800"><Clock className="h-3 w-3 mr-1" />Déclaré</Badge>;
      case 'en_cours':
        return <Badge className="bg-amber-100 text-amber-800"><Clock className="h-3 w-3 mr-1" />En cours</Badge>;
      case 'expertise':
        return <Badge className="bg-purple-100 text-purple-800"><FileText className="h-3 w-3 mr-1" />Expertise</Badge>;
      case 'indemnise':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Indemnisé</Badge>;
      case 'clos':
        return <Badge variant="secondary"><CheckCircle2 className="h-3 w-3 mr-1" />Clos</Badge>;
      case 'refuse':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Refusé</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    return TYPES_SINISTRE.find(t => t.value === type)?.icon || '❓';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-purple-100 text-purple-800">Phase 5</Badge>
            <Badge variant="outline">Sinistres</Badge>
          </div>
          <h1 className="text-3xl font-bold">Gestion des Sinistres</h1>
          <p className="text-muted-foreground">
            Déclarez et suivez vos sinistres et réclamations
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Déclarer un sinistre
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Déclarer un sinistre</DialogTitle>
              <DialogDescription>
                Remplissez les informations pour déclarer votre sinistre
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="type">Type de sinistre</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner le type" />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPES_SINISTRE.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.icon} {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="date">Date du sinistre</Label>
                  <Input id="date" type="date" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="titre">Titre</Label>
                <Input id="titre" placeholder="Ex: Fuite d'eau salle de bain" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description détaillée</Label>
                <Textarea
                  id="description"
                  placeholder="Décrivez les circonstances, les dégâts constatés..."
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="garantie">Garantie concernée</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner la garantie" />
                    </SelectTrigger>
                    <SelectContent>
                      {GARANTIES.map(g => (
                        <SelectItem key={g.value} value={g.value}>
                          {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="montant">Montant estimé (€)</Label>
                  <Input id="montant" type="number" placeholder="1000" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Photos du sinistre</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <Camera className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Glissez vos photos ici ou cliquez pour sélectionner
                  </p>
                  <Button variant="outline" size="sm" className="mt-2">
                    Sélectionner des fichiers
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annuler
              </Button>
              <Button variant="destructive" onClick={() => setIsDialogOpen(false)}>
                Déclarer le sinistre
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total sinistres</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.enCours}</p>
                <p className="text-sm text-muted-foreground">En cours</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.indemnises}</p>
                <p className="text-sm text-muted-foreground">Indemnisés</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <XCircle className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.clos + stats.refuses}</p>
                <p className="text-sm text-muted-foreground">Clos/Refusés</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Euro className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.montantTotal}€</p>
                <p className="text-sm text-muted-foreground">Indemnisé total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contenu */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="en_cours">En cours ({stats.enCours})</TabsTrigger>
          <TabsTrigger value="tous">Tous ({stats.total})</TabsTrigger>
          <TabsTrigger value="garanties">Mes garanties</TabsTrigger>
          <TabsTrigger value="contacts">Contacts utiles</TabsTrigger>
        </TabsList>

        <TabsContent value="en_cours" className="mt-4">
          {sinistresData.filter(s => ['declare', 'en_cours', 'expertise'].includes(s.statut)).length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <Shield className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-semibold">Aucun sinistre en cours</h3>
                <p className="text-muted-foreground mt-1">
                  Votre bien n'a pas de sinistre actif. C'est une bonne nouvelle !
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {sinistresData
                .filter(s => ['declare', 'en_cours', 'expertise'].includes(s.statut))
                .map(sinistre => (
                  <Card key={sinistre.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="text-3xl">{getTypeIcon(sinistre.type)}</div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{sinistre.titre}</h3>
                              {getStatusBadge(sinistre.statut)}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{sinistre.description}</p>
                            <div className="flex items-center gap-4 mt-2 text-sm">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {format(new Date(sinistre.date_sinistre), 'dd/MM/yyyy', { locale: fr })}
                              </span>
                              {sinistre.montant_estime && (
                                <span className="flex items-center gap-1">
                                  <Euro className="h-4 w-4" />
                                  Estimé : {sinistre.montant_estime}€
                                </span>
                              )}
                              {sinistre.numero_dossier && (
                                <span>Dossier : {sinistre.numero_dossier}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          Voir détails
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tous">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center py-8">
                Historique complet des sinistres déclarés
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="garanties">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-green-600" />
                  Garantie de Parfait Achèvement
                </CardTitle>
                <CardDescription>1 an après réception</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm">Couvre tous les défauts de conformité signalés dans l'année suivant la réception.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  Garantie Biennale (Bon Fonctionnement)
                </CardTitle>
                <CardDescription>2 ans après réception</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm">Couvre les équipements dissociables : robinetterie, volets, radiateurs, etc.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-purple-600" />
                  Garantie Décennale
                </CardTitle>
                <CardDescription>10 ans après réception</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm">Couvre les dommages compromettant la solidité ou rendant le bien impropre à sa destination.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <CardTitle>Contacts utiles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Assurance Habitation</p>
                    <p className="text-sm text-muted-foreground">Non renseigné</p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Phone className="h-4 w-4 mr-2" />
                    Ajouter
                  </Button>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Constructeur / MOE</p>
                    <p className="text-sm text-muted-foreground">Non renseigné</p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Phone className="h-4 w-4 mr-2" />
                    Ajouter
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default SinistresPage;

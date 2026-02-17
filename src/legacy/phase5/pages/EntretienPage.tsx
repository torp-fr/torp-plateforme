import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCarnet } from '@/hooks/phase5/useCarnet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
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
  Wrench, Calendar as CalendarIcon, Plus, CheckCircle2,
  Clock, AlertTriangle, Repeat, Euro, Building2
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Entretien {
  id: string;
  titre: string;
  description: string;
  categorie: 'chauffage' | 'plomberie' | 'electricite' | 'toiture' | 'facade' | 'ventilation' | 'autre';
  frequence: 'mensuel' | 'trimestriel' | 'semestriel' | 'annuel' | 'ponctuel';
  derniere_realisation?: string;
  prochaine_echeance: string;
  cout_estime?: number;
  prestataire?: string;
  statut: 'a_jour' | 'a_planifier' | 'en_retard';
  rappel_active: boolean;
}

const CATEGORIES = [
  { value: 'chauffage', label: 'Chauffage / Climatisation', icon: '🔥' },
  { value: 'plomberie', label: 'Plomberie', icon: '🚿' },
  { value: 'electricite', label: 'Électricité', icon: '⚡' },
  { value: 'toiture', label: 'Toiture', icon: '🏠' },
  { value: 'facade', label: 'Façade / Extérieur', icon: '🧱' },
  { value: 'ventilation', label: 'Ventilation / VMC', icon: '💨' },
  { value: 'autre', label: 'Autre', icon: '🔧' },
];

const ENTRETIENS_RECOMMANDES: Partial<Entretien>[] = [
  {
    titre: 'Entretien chaudière',
    description: 'Contrôle annuel obligatoire de la chaudière gaz/fioul',
    categorie: 'chauffage',
    frequence: 'annuel',
    cout_estime: 150,
  },
  {
    titre: 'Ramonage cheminée',
    description: 'Ramonage des conduits de fumée (2x/an si bois)',
    categorie: 'chauffage',
    frequence: 'semestriel',
    cout_estime: 80,
  },
  {
    titre: 'Entretien VMC',
    description: 'Nettoyage des bouches et filtres VMC',
    categorie: 'ventilation',
    frequence: 'annuel',
    cout_estime: 100,
  },
  {
    titre: 'Entretien climatisation',
    description: 'Contrôle du circuit frigorifique et nettoyage',
    categorie: 'chauffage',
    frequence: 'annuel',
    cout_estime: 120,
  },
  {
    titre: 'Vérification toiture',
    description: 'Inspection visuelle et nettoyage gouttières',
    categorie: 'toiture',
    frequence: 'annuel',
    cout_estime: 200,
  },
  {
    titre: 'Contrôle installation électrique',
    description: 'Vérification tableau et prises',
    categorie: 'electricite',
    frequence: 'annuel',
    cout_estime: 100,
  },
];

export function EntretienPage() {
  const { projectId } = useParams();
  const { carnet, entretiens, addEntretien, updateEntretien, isLoading } = useCarnet(projectId!);
  const [activeTab, setActiveTab] = useState('planning');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  // Entretiens de démonstration (à remplacer par données réelles)
  const entretiensData: Entretien[] = entretiens?.length ? entretiens : ENTRETIENS_RECOMMANDES.map((e, i) => ({
    ...e,
    id: `entretien-${i}`,
    prochaine_echeance: format(new Date(Date.now() + Math.random() * 180 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    statut: Math.random() > 0.7 ? 'en_retard' : Math.random() > 0.5 ? 'a_planifier' : 'a_jour',
    rappel_active: true,
  })) as Entretien[];

  // Stats
  const stats = {
    total: entretiensData.length,
    aJour: entretiensData.filter(e => e.statut === 'a_jour').length,
    aPlanifier: entretiensData.filter(e => e.statut === 'a_planifier').length,
    enRetard: entretiensData.filter(e => e.statut === 'en_retard').length,
    coutAnnuel: entretiensData.reduce((sum, e) => sum + (e.cout_estime || 0), 0),
  };

  const getStatusBadge = (statut: Entretien['statut']) => {
    switch (statut) {
      case 'a_jour':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />À jour</Badge>;
      case 'a_planifier':
        return <Badge className="bg-blue-100 text-blue-800"><Clock className="h-3 w-3 mr-1" />À planifier</Badge>;
      case 'en_retard':
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />En retard</Badge>;
    }
  };

  const getCategorieIcon = (categorie: string) => {
    return CATEGORIES.find(c => c.value === categorie)?.icon || '🔧';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-purple-100 text-purple-800">Phase 5</Badge>
            <Badge variant="outline">Entretien</Badge>
          </div>
          <h1 className="text-3xl font-bold">Planning d'Entretien</h1>
          <p className="text-muted-foreground">
            Gérez l'entretien préventif de votre bien
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un entretien
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvel entretien</DialogTitle>
              <DialogDescription>
                Planifiez un nouvel entretien pour votre bien
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="titre">Titre</Label>
                <Input id="titre" placeholder="Ex: Entretien chaudière" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="categorie">Catégorie</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.icon} {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="frequence">Fréquence</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une fréquence" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensuel">Mensuel</SelectItem>
                    <SelectItem value="trimestriel">Trimestriel</SelectItem>
                    <SelectItem value="semestriel">Semestriel</SelectItem>
                    <SelectItem value="annuel">Annuel</SelectItem>
                    <SelectItem value="ponctuel">Ponctuel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" placeholder="Détails de l'entretien..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="cout">Coût estimé (€)</Label>
                  <Input id="cout" type="number" placeholder="100" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="prestataire">Prestataire</Label>
                  <Input id="prestataire" placeholder="Nom du prestataire" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={() => setIsDialogOpen(false)}>
                Ajouter
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
              <div className="p-2 bg-purple-100 rounded-lg">
                <Wrench className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Entretiens</p>
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
                <p className="text-2xl font-bold">{stats.aJour}</p>
                <p className="text-sm text-muted-foreground">À jour</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.aPlanifier}</p>
                <p className="text-sm text-muted-foreground">À planifier</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.enRetard}</p>
                <p className="text-sm text-muted-foreground">En retard</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Euro className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.coutAnnuel}€</p>
                <p className="text-sm text-muted-foreground">Budget annuel</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contenu */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="planning">Planning</TabsTrigger>
          <TabsTrigger value="historique">Historique</TabsTrigger>
          <TabsTrigger value="prestataires">Prestataires</TabsTrigger>
        </TabsList>

        <TabsContent value="planning" className="mt-4">
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-4">
              {entretiensData
                .sort((a, b) => new Date(a.prochaine_echeance).getTime() - new Date(b.prochaine_echeance).getTime())
                .map(entretien => (
                  <Card key={entretien.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="text-3xl">{getCategorieIcon(entretien.categorie)}</div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{entretien.titre}</h3>
                              {getStatusBadge(entretien.statut)}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{entretien.description}</p>
                            <div className="flex items-center gap-4 mt-2 text-sm">
                              <span className="flex items-center gap-1">
                                <Repeat className="h-4 w-4" />
                                {entretien.frequence}
                              </span>
                              <span className="flex items-center gap-1">
                                <CalendarIcon className="h-4 w-4" />
                                Prochain : {format(new Date(entretien.prochaine_echeance), 'dd/MM/yyyy', { locale: fr })}
                              </span>
                              {entretien.cout_estime && (
                                <span className="flex items-center gap-1">
                                  <Euro className="h-4 w-4" />
                                  ~{entretien.cout_estime}€
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          Planifier
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Calendrier</CardTitle>
                </CardHeader>
                <CardContent>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    locale={fr}
                    className="rounded-md border"
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="historique">
          <Card>
            <CardHeader>
              <CardTitle>Historique des entretiens</CardTitle>
              <CardDescription>Interventions passées sur le bien</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Aucun historique pour le moment.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prestataires">
          <Card>
            <CardHeader>
              <CardTitle>Prestataires</CardTitle>
              <CardDescription>Contacts des intervenants</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Aucun prestataire enregistré.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default EntretienPage;

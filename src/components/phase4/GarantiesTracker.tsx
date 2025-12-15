/**
 * GarantiesTracker - Suivi des garanties légales
 * Affiche l'état des garanties et permet de signaler des désordres
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  Shield,
  Clock,
  AlertTriangle,
  CheckCircle,
  Calendar,
  FileWarning,
  Plus,
  Building2,
  Euro,
  Info,
  ChevronRight,
  Camera,
  Send,
} from 'lucide-react';
import type { Garantie, GarantieType, Desordre } from '@/types/phase4.types';
import { garantiesService } from '@/services/phase4';

interface GarantiesTrackerProps {
  chantierId: string;
}

export function GarantiesTracker({ chantierId }: GarantiesTrackerProps) {
  const { toast } = useToast();
  const [garanties, setGaranties] = useState<Garantie[]>([]);
  const [desordres, setDesordres] = useState<Desordre[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSignalementDialog, setShowSignalementDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTab, setSelectedTab] = useState<GarantieType | 'all'>('all');

  const [signalementForm, setSignalementForm] = useState({
    nature: '',
    description: '',
    localisation: '',
    gravite: 'moyenne' as 'faible' | 'moyenne' | 'grave' | 'critique',
    dateDecouverte: new Date().toISOString().split('T')[0],
    photos: [] as string[],
  });

  useEffect(() => {
    loadData();
  }, [chantierId]);

  const loadData = async () => {
    setLoading(true);
    const [garantiesData, desordresData] = await Promise.all([
      garantiesService.getGarantiesByChantier(chantierId),
      garantiesService.getDesordresByChantier(chantierId),
    ]);
    setGaranties(garantiesData);
    setDesordres(desordresData);
    setLoading(false);
  };

  const getGarantieIcon = (type: GarantieType) => {
    switch (type) {
      case 'parfait_achevement':
        return <Shield className="h-5 w-5 text-green-600" />;
      case 'biennale':
        return <Shield className="h-5 w-5 text-blue-600" />;
      case 'decennale':
        return <Shield className="h-5 w-5 text-purple-600" />;
      default:
        return <Shield className="h-5 w-5" />;
    }
  };

  const getGarantieLabel = (type: GarantieType) => {
    switch (type) {
      case 'parfait_achevement':
        return 'Parfait achèvement';
      case 'biennale':
        return 'Biennale';
      case 'decennale':
        return 'Décennale';
      case 'vices_caches':
        return 'Vices cachés';
      default:
        return type;
    }
  };

  const getGarantieDuree = (type: GarantieType) => {
    switch (type) {
      case 'parfait_achevement':
        return '1 an';
      case 'biennale':
        return '2 ans';
      case 'decennale':
        return '10 ans';
      case 'vices_caches':
        return '10 ans';
      default:
        return '';
    }
  };

  const calculateProgress = (garantie: Garantie) => {
    const debut = new Date(garantie.dateDebut).getTime();
    const fin = new Date(garantie.dateFin).getTime();
    const now = Date.now();

    if (now >= fin) return 100;
    if (now <= debut) return 0;

    return Math.round(((now - debut) / (fin - debut)) * 100);
  };

  const getJoursRestants = (garantie: Garantie) => {
    const fin = new Date(garantie.dateFin);
    const now = new Date();
    const diff = Math.ceil((fin.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const handleSignalement = async () => {
    setSubmitting(true);
    try {
      await garantiesService.signalerDesordre(chantierId, {
        nature: signalementForm.nature,
        description: signalementForm.description,
        localisation: signalementForm.localisation,
        gravite: signalementForm.gravite,
        dateDecouverte: signalementForm.dateDecouverte,
        photos: signalementForm.photos,
      });

      toast({
        title: 'Désordre signalé',
        description: 'Le désordre a été enregistré et sera traité.',
      });

      setShowSignalementDialog(false);
      setSignalementForm({
        nature: '',
        description: '',
        localisation: '',
        gravite: 'moyenne',
        dateDecouverte: new Date().toISOString().split('T')[0],
        photos: [],
      });
      loadData();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de signaler le désordre.',
        variant: 'destructive',
      });
    }
    setSubmitting(false);
  };

  const filteredGaranties = selectedTab === 'all'
    ? garanties
    : garanties.filter(g => g.type === selectedTab);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Chargement des garanties...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Garanties légales</h2>
          <p className="text-muted-foreground">
            Suivi des garanties et signalement des désordres
          </p>
        </div>
        <Button onClick={() => setShowSignalementDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Signaler un désordre
        </Button>
      </div>

      {/* Alertes garanties proches de l'expiration */}
      {garanties.filter(g => g.active && getJoursRestants(g) <= 90).length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Garanties bientôt expirées</AlertTitle>
          <AlertDescription>
            Certaines garanties expirent dans moins de 3 mois. Vérifiez l'état du bâtiment pour signaler d'éventuels désordres.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs filtres */}
      <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as GarantieType | 'all')}>
        <TabsList>
          <TabsTrigger value="all">Toutes</TabsTrigger>
          <TabsTrigger value="parfait_achevement">1 an</TabsTrigger>
          <TabsTrigger value="biennale">2 ans</TabsTrigger>
          <TabsTrigger value="decennale">10 ans</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Liste des garanties */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredGaranties.map((garantie) => {
          const progress = calculateProgress(garantie);
          const joursRestants = getJoursRestants(garantie);
          const desordresGarantie = desordres.filter(d => d.garantieId === garantie.id);

          return (
            <Card key={garantie.id} className={`${!garantie.active ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getGarantieIcon(garantie.type)}
                    <CardTitle className="text-lg">
                      {getGarantieLabel(garantie.type)}
                    </CardTitle>
                  </div>
                  <Badge variant={garantie.active ? 'default' : 'secondary'}>
                    {garantie.active ? 'Active' : 'Expirée'}
                  </Badge>
                </div>
                <CardDescription>
                  Durée: {getGarantieDuree(garantie.type)}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Dates */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Début:</span>
                    <div className="font-medium">
                      {new Date(garantie.dateDebut).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Fin:</span>
                    <div className="font-medium">
                      {new Date(garantie.dateFin).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                </div>

                {/* Progress */}
                {garantie.active && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Écoulé</span>
                      <span className={joursRestants <= 90 ? 'text-orange-600 font-medium' : ''}>
                        {joursRestants > 0 ? `${joursRestants} jours restants` : 'Expirée'}
                      </span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}

                {/* Périmètre */}
                <div className="text-sm">
                  <div className="text-muted-foreground mb-1">Périmètre:</div>
                  <div className="text-xs bg-gray-50 p-2 rounded">
                    {garantie.perimetre}
                  </div>
                </div>

                {/* Désordres */}
                {desordresGarantie.length > 0 && (
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <div className="flex items-center gap-2 text-orange-700 font-medium text-sm">
                      <FileWarning className="h-4 w-4" />
                      <span>{desordresGarantie.length} désordre(s) signalé(s)</span>
                    </div>
                    <div className="mt-2 space-y-1">
                      {desordresGarantie.slice(0, 2).map(d => (
                        <div key={d.id} className="text-xs text-orange-600 flex items-center gap-1">
                          <ChevronRight className="h-3 w-3" />
                          {d.nature}
                        </div>
                      ))}
                      {desordresGarantie.length > 2 && (
                        <div className="text-xs text-orange-500">
                          +{desordresGarantie.length - 2} autres
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Assurance */}
                {garantie.assuranceNom && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    <span>{garantie.assuranceNom}</span>
                    {garantie.numeroPolice && (
                      <span className="text-xs">({garantie.numeroPolice})</span>
                    )}
                  </div>
                )}
              </CardContent>

              <CardFooter>
                <Button variant="outline" size="sm" className="w-full">
                  Voir les détails
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Section Désordres récents */}
      {desordres.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Désordres récents</CardTitle>
            <CardDescription>
              Derniers désordres signalés sur ce chantier
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {desordres.slice(0, 5).map((desordre) => (
                <div key={desordre.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className={`p-2 rounded-full ${
                    desordre.gravite === 'critique' ? 'bg-red-100' :
                    desordre.gravite === 'grave' ? 'bg-orange-100' :
                    'bg-yellow-100'
                  }`}>
                    <AlertTriangle className={`h-4 w-4 ${
                      desordre.gravite === 'critique' ? 'text-red-600' :
                      desordre.gravite === 'grave' ? 'text-orange-600' :
                      'text-yellow-600'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{desordre.nature}</span>
                      <Badge variant="outline" className="text-xs">
                        {desordre.statut}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {desordre.description}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{desordre.localisation}</span>
                      <span>
                        Signalé le {new Date(desordre.dateSignalement).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog Signalement */}
      <Dialog open={showSignalementDialog} onOpenChange={setShowSignalementDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Signaler un désordre</DialogTitle>
            <DialogDescription>
              Décrivez le problème constaté pour mettre en jeu la garantie appropriée.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Nature du désordre *</Label>
              <Input
                placeholder="Ex: Fissure murale, Infiltration, Panne équipement..."
                value={signalementForm.nature}
                onChange={(e) => setSignalementForm({ ...signalementForm, nature: e.target.value })}
              />
            </div>

            <div>
              <Label>Description détaillée *</Label>
              <Textarea
                placeholder="Décrivez précisément le problème observé..."
                value={signalementForm.description}
                onChange={(e) => setSignalementForm({ ...signalementForm, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Localisation *</Label>
                <Input
                  placeholder="Ex: Salle de bain RDC"
                  value={signalementForm.localisation}
                  onChange={(e) => setSignalementForm({ ...signalementForm, localisation: e.target.value })}
                />
              </div>
              <div>
                <Label>Gravité *</Label>
                <Select
                  value={signalementForm.gravite}
                  onValueChange={(v) => setSignalementForm({ ...signalementForm, gravite: v as typeof signalementForm.gravite })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="faible">Faible</SelectItem>
                    <SelectItem value="moyenne">Moyenne</SelectItem>
                    <SelectItem value="grave">Grave</SelectItem>
                    <SelectItem value="critique">Critique</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Date de découverte</Label>
              <Input
                type="date"
                value={signalementForm.dateDecouverte}
                onChange={(e) => setSignalementForm({ ...signalementForm, dateDecouverte: e.target.value })}
              />
            </div>

            <div>
              <Label>Photos (optionnel)</Label>
              <Button variant="outline" className="w-full mt-1">
                <Camera className="h-4 w-4 mr-2" />
                Ajouter des photos
              </Button>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Le système déterminera automatiquement la garantie applicable en fonction de la nature du désordre.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSignalementDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSignalement}
              disabled={submitting || !signalementForm.nature || !signalementForm.description || !signalementForm.localisation}
            >
              {submitting ? (
                'Envoi...'
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Signaler
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default GarantiesTracker;

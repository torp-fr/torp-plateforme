/**
 * ReservesList - Liste et gestion des réserves
 * Affiche les réserves avec filtres et actions
 */

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Search,
  Filter,
  Camera,
  MessageSquare,
  Calendar,
  Building2,
  MapPin,
  ChevronRight,
  Upload,
  Check,
  X,
  RefreshCw,
} from 'lucide-react';
import type { Reserve, ReserveStatut, ReserveGravite } from '@/types/phase4.types';
import { reservesService } from '@/services/phase4';

interface ReservesListProps {
  chantierId: string;
  userRole?: 'maitre_ouvrage' | 'entreprise';
  entrepriseId?: string;
}

export function ReservesList({ chantierId, userRole = 'maitre_ouvrage', entrepriseId }: ReservesListProps) {
  const { toast } = useToast();
  const [reserves, setReserves] = useState<Reserve[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGravite, setFilterGravite] = useState<ReserveGravite | 'all'>('all');
  const [filterStatut, setFilterStatut] = useState<ReserveStatut | 'all'>('all');
  const [selectedReserve, setSelectedReserve] = useState<Reserve | null>(null);
  const [showLeveeDialog, setShowLeveeDialog] = useState(false);
  const [showContestationDialog, setShowContestationDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Formulaires
  const [leveeForm, setLeveeForm] = useState({ commentaire: '', photos: [] as string[] });
  const [contestationForm, setContestationForm] = useState({ motif: '' });

  useEffect(() => {
    loadReserves();
  }, [chantierId, entrepriseId]);

  const loadReserves = async () => {
    setLoading(true);
    let data: Reserve[];
    if (entrepriseId) {
      data = await reservesService.getReservesByEntreprise(entrepriseId);
    } else {
      data = await reservesService.getReservesByChantier(chantierId);
    }
    setReserves(data);
    setLoading(false);
  };

  // Statistiques
  const stats = useMemo(() => {
    const total = reserves.length;
    const ouvertes = reserves.filter(r => r.statut === 'ouverte').length;
    const enCours = reserves.filter(r => r.statut === 'en_cours').length;
    const levees = reserves.filter(r => r.statut === 'levee').length;
    const contestees = reserves.filter(r => r.statut === 'contestee').length;
    const enRetard = reserves.filter(r =>
      ['ouverte', 'en_cours'].includes(r.statut) &&
      new Date(r.dateEcheance) < new Date()
    ).length;

    return {
      total,
      ouvertes,
      enCours,
      levees,
      contestees,
      enRetard,
      tauxLevee: total > 0 ? Math.round((levees / total) * 100) : 0,
    };
  }, [reserves]);

  // Filtrage
  const filteredReserves = useMemo(() => {
    return reserves.filter(r => {
      const matchSearch = searchTerm === '' ||
        r.nature.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.localisation.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.entrepriseNom.toLowerCase().includes(searchTerm.toLowerCase());

      const matchGravite = filterGravite === 'all' || r.gravite === filterGravite;
      const matchStatut = filterStatut === 'all' || r.statut === filterStatut;

      return matchSearch && matchGravite && matchStatut;
    });
  }, [reserves, searchTerm, filterGravite, filterStatut]);

  const getStatutBadge = (statut: ReserveStatut) => {
    switch (statut) {
      case 'ouverte':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Ouverte</Badge>;
      case 'en_cours':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">En cours</Badge>;
      case 'levee':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Levée</Badge>;
      case 'contestee':
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Contestée</Badge>;
      case 'expiree':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Expirée</Badge>;
      default:
        return null;
    }
  };

  const getGraviteBadge = (gravite: ReserveGravite) => {
    switch (gravite) {
      case 'mineure':
        return <Badge className="bg-yellow-100 text-yellow-800">Mineure</Badge>;
      case 'majeure':
        return <Badge className="bg-orange-100 text-orange-800">Majeure</Badge>;
      case 'grave':
        return <Badge className="bg-red-100 text-red-800">Grave</Badge>;
      case 'non_conformite_substantielle':
        return <Badge className="bg-red-600 text-white">NC substantielle</Badge>;
      default:
        return null;
    }
  };

  const isEnRetard = (reserve: Reserve) => {
    return ['ouverte', 'en_cours'].includes(reserve.statut) &&
           new Date(reserve.dateEcheance) < new Date();
  };

  const getJoursRestants = (reserve: Reserve) => {
    const echeance = new Date(reserve.dateEcheance);
    const now = new Date();
    const diff = Math.ceil((echeance.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const handleLevee = async () => {
    if (!selectedReserve) return;

    setSubmitting(true);
    try {
      await reservesService.leverReserve(selectedReserve.id, {
        leveePar: 'Utilisateur',
        commentaire: leveeForm.commentaire,
        photosApres: leveeForm.photos,
      });

      toast({
        title: 'Réserve levée',
        description: 'La réserve a été marquée comme levée.',
      });

      setShowLeveeDialog(false);
      setLeveeForm({ commentaire: '', photos: [] });
      loadReserves();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de lever la réserve.',
        variant: 'destructive',
      });
    }
    setSubmitting(false);
  };

  const handleContestation = async () => {
    if (!selectedReserve) return;

    setSubmitting(true);
    try {
      await reservesService.contesterReserve(selectedReserve.id, {
        motif: contestationForm.motif,
      });

      toast({
        title: 'Réserve contestée',
        description: 'La contestation a été enregistrée.',
      });

      setShowContestationDialog(false);
      setContestationForm({ motif: '' });
      loadReserves();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de contester la réserve.',
        variant: 'destructive',
      });
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      {/* En-tête avec stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-sm text-muted-foreground">Total</div>
        </Card>
        <Card className="p-4 bg-red-50">
          <div className="text-2xl font-bold text-red-700">{stats.ouvertes}</div>
          <div className="text-sm text-red-600">Ouvertes</div>
        </Card>
        <Card className="p-4 bg-blue-50">
          <div className="text-2xl font-bold text-blue-700">{stats.enCours}</div>
          <div className="text-sm text-blue-600">En cours</div>
        </Card>
        <Card className="p-4 bg-green-50">
          <div className="text-2xl font-bold text-green-700">{stats.levees}</div>
          <div className="text-sm text-green-600">Levées</div>
        </Card>
        <Card className="p-4 bg-orange-50">
          <div className="text-2xl font-bold text-orange-700">{stats.enRetard}</div>
          <div className="text-sm text-orange-600">En retard</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{stats.tauxLevee}%</div>
          <div className="text-sm text-muted-foreground">Taux levée</div>
          <Progress value={stats.tauxLevee} className="h-1 mt-2" />
        </Card>
      </div>

      {/* Filtres */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une réserve..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Tabs value={filterStatut} onValueChange={(v) => setFilterStatut(v as ReserveStatut | 'all')} className="w-auto">
          <TabsList>
            <TabsTrigger value="all">Toutes</TabsTrigger>
            <TabsTrigger value="ouverte">Ouvertes</TabsTrigger>
            <TabsTrigger value="en_cours">En cours</TabsTrigger>
            <TabsTrigger value="levee">Levées</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="outline" onClick={loadReserves}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Liste des réserves */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Chargement...</div>
      ) : filteredReserves.length === 0 ? (
        <Card className="p-8 text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium">Aucune réserve</h3>
          <p className="text-muted-foreground">
            {searchTerm || filterStatut !== 'all'
              ? 'Aucune réserve ne correspond aux critères'
              : 'Toutes les réserves ont été levées'}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredReserves.map((reserve) => (
            <Card key={reserve.id} className={`overflow-hidden ${isEnRetard(reserve) ? 'border-red-300' : ''}`}>
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row">
                  {/* Photo thumbnail */}
                  <div className="w-full md:w-32 h-32 bg-gray-100 flex items-center justify-center">
                    {reserve.photos.length > 0 ? (
                      <img
                        src={reserve.photos[0].url}
                        alt="Photo réserve"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Camera className="h-8 w-8 text-gray-400" />
                    )}
                  </div>

                  {/* Contenu */}
                  <div className="flex-1 p-4">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">#{reserve.numero}</span>
                          {getGraviteBadge(reserve.gravite)}
                          {getStatutBadge(reserve.statut)}
                          {isEnRetard(reserve) && (
                            <Badge variant="destructive" className="text-xs">
                              En retard
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-semibold">{reserve.nature}</h3>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Lot: {reserve.lot}
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {reserve.description}
                    </p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{reserve.localisation}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Building2 className="h-4 w-4" />
                        <span>{reserve.entrepriseNom}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>
                          Échéance: {new Date(reserve.dateEcheance).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getJoursRestants(reserve) > 0 ? (
                          <span className="text-orange-600">
                            {getJoursRestants(reserve)} jours restants
                          </span>
                        ) : reserve.statut !== 'levee' ? (
                          <span className="text-red-600 font-medium">
                            {Math.abs(getJoursRestants(reserve))} jours de retard
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {reserve.statut !== 'levee' && userRole === 'maitre_ouvrage' && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedReserve(reserve);
                            setShowLeveeDialog(true);
                          }}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Lever
                        </Button>
                      )}
                      {reserve.statut === 'ouverte' && userRole === 'entreprise' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => reservesService.startTraitement(reserve.id).then(loadReserves)}
                          >
                            <Clock className="h-4 w-4 mr-1" />
                            Prendre en charge
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedReserve(reserve);
                              setShowContestationDialog(true);
                            }}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Contester
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="ghost">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog Levée */}
      <Dialog open={showLeveeDialog} onOpenChange={setShowLeveeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lever la réserve #{selectedReserve?.numero}</DialogTitle>
            <DialogDescription>
              Confirmez la levée de cette réserve après vérification des travaux correctifs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Commentaire de levée</label>
              <Textarea
                placeholder="Travaux correctifs vérifiés et conformes..."
                value={leveeForm.commentaire}
                onChange={(e) => setLeveeForm({ ...leveeForm, commentaire: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Photos après travaux</label>
              <Button variant="outline" className="w-full">
                <Upload className="h-4 w-4 mr-2" />
                Ajouter des photos
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLeveeDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleLevee} disabled={submitting}>
              {submitting ? 'Traitement...' : 'Confirmer la levée'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Contestation */}
      <Dialog open={showContestationDialog} onOpenChange={setShowContestationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contester la réserve #{selectedReserve?.numero}</DialogTitle>
            <DialogDescription>
              Expliquez pourquoi vous contestez cette réserve.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Motif de contestation *</label>
              <Textarea
                placeholder="La réserve n'est pas justifiée car..."
                value={contestationForm.motif}
                onChange={(e) => setContestationForm({ motif: e.target.value })}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContestationDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleContestation}
              disabled={submitting || !contestationForm.motif}
              variant="destructive"
            >
              {submitting ? 'Traitement...' : 'Contester'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ReservesList;

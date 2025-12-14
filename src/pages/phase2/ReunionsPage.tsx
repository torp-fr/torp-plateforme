/**
 * TORP Phase 2 - Gestion des Réunions de Chantier
 * Planification, comptes-rendus, et suivi des actions
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ArrowLeft,
  Plus,
  Calendar,
  Users,
  Clock,
  MapPin,
  FileText,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Loader2,
  Download,
  ChevronRight,
  ClipboardList,
  Video,
  Send,
} from 'lucide-react';

import { ReunionService } from '@/services/phase2/reunion.service';
import { ChantierService } from '@/services/phase2/chantier.service';
import type {
  Reunion,
  TypeReunion,
  StatutReunion,
  Participant,
  PointOrdreDuJour,
  Action,
  TEMPLATE_REUNION_LANCEMENT,
  TEMPLATE_REUNION_HEBDO,
} from '@/types/phase2';
import { useToast } from '@/hooks/use-toast';

const TYPE_LABELS: Record<TypeReunion, string> = {
  lancement: 'Réunion de lancement',
  chantier_hebdo: 'Réunion hebdomadaire',
  coordination: 'Coordination',
  reception_partielle: 'Réception partielle',
  pre_reception: 'Pré-réception',
  reception: 'Réception',
  levee_reserves: 'Levée de réserves',
  extraordinaire: 'Extraordinaire',
};

const STATUT_CONFIG: Record<StatutReunion, { label: string; color: string }> = {
  planifiee: { label: 'Planifiée', color: 'bg-blue-500' },
  confirmee: { label: 'Confirmée', color: 'bg-green-500' },
  en_cours: { label: 'En cours', color: 'bg-yellow-500' },
  terminee: { label: 'Terminée', color: 'bg-gray-500' },
  annulee: { label: 'Annulée', color: 'bg-red-500' },
  reportee: { label: 'Reportée', color: 'bg-orange-500' },
};

export default function ReunionsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [chantierId, setChantierId] = useState<string | null>(null);
  const [reunions, setReunions] = useState<Reunion[]>([]);
  const [selectedReunion, setSelectedReunion] = useState<Reunion | null>(null);
  const [activeTab, setActiveTab] = useState('a_venir');

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [newReunion, setNewReunion] = useState({
    type: 'chantier_hebdo' as TypeReunion,
    titre: '',
    date: '',
    heure: '09:00',
    duree: 120,
    lieu: '',
  });

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  const loadData = async () => {
    if (!projectId) return;
    setLoading(true);

    try {
      // Récupérer ou créer le chantier
      let chantier = await ChantierService.getChantierByProject(projectId);
      if (!chantier) {
        chantier = await ChantierService.createChantier({
          projectId,
          nom: 'Nouveau chantier',
        });
      }

      setChantierId(chantier.id);

      // Charger les réunions
      const reunionsData = await ReunionService.getReunionsByChantier(chantier.id);
      setReunions(reunionsData);
    } catch (error) {
      console.error('Error loading reunions:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les réunions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReunion = async () => {
    if (!chantierId || !newReunion.date || !newReunion.titre) return;

    setCreating(true);
    try {
      await ReunionService.createReunion({
        chantierId,
        type: newReunion.type,
        titre: newReunion.titre || TYPE_LABELS[newReunion.type],
        dateReunion: newReunion.date,
        heureDebut: newReunion.heure,
        dureePrevueMinutes: newReunion.duree,
        lieu: newReunion.lieu,
      });

      toast({ title: 'Réunion créée', description: newReunion.titre });
      setShowCreateDialog(false);
      setNewReunion({
        type: 'chantier_hebdo',
        titre: '',
        date: '',
        heure: '09:00',
        duree: 120,
        lieu: '',
      });
      loadData();
    } catch (error) {
      console.error('Error creating reunion:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de créer la réunion',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleStartReunion = async (reunionId: string) => {
    try {
      await ReunionService.updateReunion(reunionId, { statut: 'en_cours' });
      toast({ title: 'Réunion démarrée' });
      loadData();
    } catch (error) {
      console.error('Error starting reunion:', error);
    }
  };

  const handleEndReunion = async (reunionId: string) => {
    try {
      await ReunionService.updateReunion(reunionId, { statut: 'terminee' });
      toast({ title: 'Réunion terminée' });
      loadData();
    } catch (error) {
      console.error('Error ending reunion:', error);
    }
  };

  const upcomingReunions = reunions.filter(
    r => ['planifiee', 'confirmee'].includes(r.statut)
  );

  const pastReunions = reunions.filter(
    r => ['terminee', 'annulee', 'reportee'].includes(r.statut)
  );

  const pendingActions = reunions
    .flatMap(r => (r.actions || []).map(a => ({ ...a, reunionTitre: r.titre })))
    .filter(a => a.statut === 'a_faire' || a.statut === 'en_cours');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Réunions de chantier</h1>
            <p className="text-muted-foreground">
              {reunions.length} réunion(s) - {pendingActions.length} action(s) en attente
            </p>
          </div>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle réunion
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{upcomingReunions.length}</div>
            <p className="text-xs text-muted-foreground">À venir</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{pastReunions.length}</div>
            <p className="text-xs text-muted-foreground">Terminées</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-orange-600">{pendingActions.length}</div>
            <p className="text-xs text-muted-foreground">Actions en attente</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">
              {reunions.filter(r => r.compteRendu).length}
            </div>
            <p className="text-xs text-muted-foreground">CR rédigés</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="a_venir">
            À venir ({upcomingReunions.length})
          </TabsTrigger>
          <TabsTrigger value="passees">
            Passées ({pastReunions.length})
          </TabsTrigger>
          <TabsTrigger value="actions">
            Actions ({pendingActions.length})
          </TabsTrigger>
        </TabsList>

        {/* Upcoming meetings */}
        <TabsContent value="a_venir" className="space-y-4">
          {upcomingReunions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">Aucune réunion planifiée</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Planifiez votre première réunion de chantier
                </p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Planifier une réunion
                </Button>
              </CardContent>
            </Card>
          ) : (
            upcomingReunions.map(reunion => (
              <Card key={reunion.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">{TYPE_LABELS[reunion.type]}</Badge>
                        <Badge className={`${STATUT_CONFIG[reunion.statut].color} text-white`}>
                          {STATUT_CONFIG[reunion.statut].label}
                        </Badge>
                      </div>
                      <h3 className="font-semibold text-lg">{reunion.titre}</h3>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(reunion.dateReunion).toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                          })}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {reunion.heureDebut}
                        </div>
                        {reunion.lieu && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {reunion.lieu}
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {reunion.participantsConvoques?.length || 0} convoqué(s)
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedReunion(reunion);
                          setShowDetailsDialog(true);
                        }}
                      >
                        Détails
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleStartReunion(reunion.id)}
                      >
                        Démarrer
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Past meetings */}
        <TabsContent value="passees" className="space-y-4">
          {pastReunions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">Aucune réunion passée</h3>
                <p className="text-muted-foreground">
                  L'historique des réunions apparaîtra ici
                </p>
              </CardContent>
            </Card>
          ) : (
            pastReunions.map(reunion => (
              <Card key={reunion.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">{TYPE_LABELS[reunion.type]}</Badge>
                        <Badge className={`${STATUT_CONFIG[reunion.statut].color} text-white`}>
                          {STATUT_CONFIG[reunion.statut].label}
                        </Badge>
                        {reunion.compteRendu && (
                          <Badge variant="secondary">
                            <FileText className="w-3 h-3 mr-1" />
                            CR disponible
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-semibold">{reunion.titre}</h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(reunion.dateReunion).toLocaleDateString('fr-FR')}
                        {reunion.actions && ` - ${reunion.actions.length} action(s)`}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedReunion(reunion);
                        setShowDetailsDialog(true);
                      }}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Actions */}
        <TabsContent value="actions" className="space-y-4">
          {pendingActions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="w-12 h-12 text-green-500 mb-4" />
                <h3 className="font-semibold mb-2">Toutes les actions sont traitées</h3>
                <p className="text-muted-foreground">
                  Aucune action en attente
                </p>
              </CardContent>
            </Card>
          ) : (
            pendingActions.map((action, idx) => (
              <Card key={idx}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      action.priorite === 'urgente' ? 'bg-red-500' :
                      action.priorite === 'haute' ? 'bg-orange-500' :
                      action.priorite === 'normale' ? 'bg-blue-500' : 'bg-gray-400'
                    }`} />
                    <div className="flex-1">
                      <p className="font-medium">{action.description}</p>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span>📋 {(action as any).reunionTitre}</span>
                        <span>👤 {action.responsable}</span>
                        <span>📅 {action.echeance}</span>
                      </div>
                    </div>
                    <Badge variant={
                      action.priorite === 'urgente' ? 'destructive' :
                      action.priorite === 'haute' ? 'default' : 'secondary'
                    }>
                      {action.priorite}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle réunion</DialogTitle>
            <DialogDescription>
              Planifiez une réunion de chantier
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Type de réunion</Label>
              <Select
                value={newReunion.type}
                onValueChange={(v: TypeReunion) => {
                  setNewReunion({
                    ...newReunion,
                    type: v,
                    titre: TYPE_LABELS[v],
                    duree: v === 'lancement' ? 180 : v === 'chantier_hebdo' ? 120 : 90,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lancement">Réunion de lancement</SelectItem>
                  <SelectItem value="chantier_hebdo">Réunion hebdomadaire</SelectItem>
                  <SelectItem value="coordination">Coordination</SelectItem>
                  <SelectItem value="pre_reception">Pré-réception</SelectItem>
                  <SelectItem value="reception">Réception</SelectItem>
                  <SelectItem value="extraordinaire">Extraordinaire</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Titre</Label>
              <Input
                value={newReunion.titre}
                onChange={(e) => setNewReunion({ ...newReunion, titre: e.target.value })}
                placeholder="Titre de la réunion"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={newReunion.date}
                  onChange={(e) => setNewReunion({ ...newReunion, date: e.target.value })}
                />
              </div>
              <div>
                <Label>Heure</Label>
                <Input
                  type="time"
                  value={newReunion.heure}
                  onChange={(e) => setNewReunion({ ...newReunion, heure: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Durée (min)</Label>
                <Input
                  type="number"
                  value={newReunion.duree}
                  onChange={(e) => setNewReunion({ ...newReunion, duree: parseInt(e.target.value) || 60 })}
                />
              </div>
              <div>
                <Label>Lieu</Label>
                <Input
                  value={newReunion.lieu}
                  onChange={(e) => setNewReunion({ ...newReunion, lieu: e.target.value })}
                  placeholder="Sur site / Visio"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateReunion} disabled={creating || !newReunion.date}>
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedReunion?.titre}</DialogTitle>
            <DialogDescription>
              {selectedReunion && (
                <span className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">{TYPE_LABELS[selectedReunion.type]}</Badge>
                  <Badge className={`${STATUT_CONFIG[selectedReunion.statut].color} text-white`}>
                    {STATUT_CONFIG[selectedReunion.statut].label}
                  </Badge>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedReunion && (
            <div className="space-y-6">
              {/* Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{new Date(selectedReunion.dateReunion).toLocaleDateString('fr-FR')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span>{selectedReunion.heureDebut} ({selectedReunion.dureePrevueMinutes} min)</span>
                </div>
                {selectedReunion.lieu && (
                  <div className="flex items-center gap-2 col-span-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedReunion.lieu}</span>
                  </div>
                )}
              </div>

              {/* Ordre du jour */}
              {selectedReunion.ordreDuJour && selectedReunion.ordreDuJour.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <ClipboardList className="w-4 h-4" />
                    Ordre du jour
                  </h4>
                  <div className="space-y-2">
                    {selectedReunion.ordreDuJour.map((point, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-2 bg-muted/50 rounded">
                        <span className="font-medium text-sm">{point.ordre}.</span>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{point.titre}</p>
                          {point.description && (
                            <p className="text-xs text-muted-foreground">{point.description}</p>
                          )}
                        </div>
                        {point.dureeMinutes && (
                          <Badge variant="outline" className="text-xs">
                            {point.dureeMinutes} min
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Participants */}
              {selectedReunion.participantsConvoques && selectedReunion.participantsConvoques.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Participants convoqués ({selectedReunion.participantsConvoques.length})
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedReunion.participantsConvoques.map((p, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                        <Users className="w-3 h-3 text-muted-foreground" />
                        <span>{p.nom}</span>
                        <span className="text-muted-foreground">({p.role})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              {selectedReunion.actions && selectedReunion.actions.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Actions ({selectedReunion.actions.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedReunion.actions.map((action, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-2 border rounded">
                        {action.statut === 'terminee' ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                        ) : (
                          <Circle className="w-4 h-4 text-muted-foreground mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="text-sm">{action.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {action.responsable} - {action.echeance}
                          </p>
                        </div>
                        <Badge variant={
                          action.priorite === 'urgente' ? 'destructive' :
                          action.priorite === 'haute' ? 'default' : 'secondary'
                        }>
                          {action.priorite}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              Fermer
            </Button>
            {selectedReunion?.statut === 'en_cours' && (
              <Button onClick={() => {
                handleEndReunion(selectedReunion.id);
                setShowDetailsDialog(false);
              }}>
                Terminer la réunion
              </Button>
            )}
            {selectedReunion?.statut === 'terminee' && !selectedReunion.compteRendu && (
              <Button>
                <FileText className="w-4 h-4 mr-2" />
                Rédiger le CR
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

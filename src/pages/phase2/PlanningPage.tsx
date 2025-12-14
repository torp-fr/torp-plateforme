/**
 * TORP Phase 2 - Planning Gantt Interactif
 * Visualisation et gestion du planning d'exécution
 */

import React, { useState, useEffect, useMemo } from 'react';
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
import { Progress } from '@/components/ui/progress';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider';
import {
  ArrowLeft,
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Download,
  Upload,
  Settings,
  Layers,
  Target,
  TrendingUp,
  Milestone,
} from 'lucide-react';

import { PlanningService } from '@/services/phase2/planning.service';
import { ChantierService } from '@/services/phase2/chantier.service';
import type {
  PlanningLot,
  PlanningTache,
  GanttTask,
  CheminCritique,
} from '@/types/phase2';
import type { PlanningStats } from '@/services/phase2/planning.service';
import { useToast } from '@/hooks/use-toast';

const STATUT_COLORS: Record<string, string> = {
  non_commence: 'bg-gray-200',
  en_cours: 'bg-blue-500',
  terminee: 'bg-green-500',
  en_retard: 'bg-red-500',
  suspendue: 'bg-orange-500',
};

const STATUT_LABELS: Record<string, string> = {
  non_commence: 'Non commencé',
  en_cours: 'En cours',
  terminee: 'Terminée',
  en_retard: 'En retard',
  suspendue: 'Suspendue',
};

export default function PlanningPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [chantierId, setChantierId] = useState<string | null>(null);
  const [lots, setLots] = useState<PlanningLot[]>([]);
  const [taches, setTaches] = useState<PlanningTache[]>([]);
  const [ganttData, setGanttData] = useState<GanttTask[]>([]);
  const [stats, setStats] = useState<PlanningStats | null>(null);
  const [cheminCritique, setCheminCritique] = useState<CheminCritique | null>(null);
  const [expandedLots, setExpandedLots] = useState<Set<string>>(new Set());

  // Dialogs
  const [showAddLot, setShowAddLot] = useState(false);
  const [showAddTache, setShowAddTache] = useState(false);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [editingTache, setEditingTache] = useState<PlanningTache | null>(null);

  // Form state
  const [newLot, setNewLot] = useState({ code: '', nom: '', entrepriseNom: '', couleur: '#4F46E5' });
  const [newTache, setNewTache] = useState({
    nom: '',
    description: '',
    dateDebutPrevue: '',
    dureeJours: 5,
    estJalon: false,
  });

  // Gantt view settings
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
  const [startDate, setStartDate] = useState<Date>(new Date());

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

      // Charger les données du planning
      const [lotsData, tachesData, statsData, ganttDataResult] = await Promise.all([
        PlanningService.getLots(chantier.id),
        PlanningService.getTachesByChantier(chantier.id),
        PlanningService.getStats(chantier.id),
        PlanningService.getGanttData(chantier.id),
      ]);

      setLots(lotsData);
      setTaches(tachesData);
      setStats(statsData);
      setGanttData(ganttDataResult);

      // Calculer le chemin critique si des tâches existent
      if (tachesData.length > 0) {
        const cc = await PlanningService.calculerCheminCritique(chantier.id);
        setCheminCritique(cc);
      }

      // Expand all lots by default
      setExpandedLots(new Set(lotsData.map(l => l.id)));
    } catch (error) {
      console.error('Error loading planning:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger le planning',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddLot = async () => {
    if (!chantierId || !newLot.code || !newLot.nom) return;

    try {
      await PlanningService.createLot({
        chantierId,
        code: newLot.code,
        nom: newLot.nom,
        entrepriseNom: newLot.entrepriseNom || undefined,
        couleur: newLot.couleur,
      });

      toast({ title: 'Lot ajouté', description: `${newLot.code} - ${newLot.nom}` });
      setShowAddLot(false);
      setNewLot({ code: '', nom: '', entrepriseNom: '', couleur: '#4F46E5' });
      loadData();
    } catch (error) {
      console.error('Error adding lot:', error);
      toast({ title: 'Erreur', description: 'Impossible d\'ajouter le lot', variant: 'destructive' });
    }
  };

  const handleAddTache = async () => {
    if (!selectedLotId || !newTache.nom || !newTache.dateDebutPrevue) return;

    try {
      await PlanningService.createTache({
        lotId: selectedLotId,
        nom: newTache.nom,
        description: newTache.description || undefined,
        dateDebutPrevue: newTache.dateDebutPrevue,
        dureeJours: newTache.dureeJours,
        estJalon: newTache.estJalon,
      });

      toast({ title: 'Tâche ajoutée', description: newTache.nom });
      setShowAddTache(false);
      setNewTache({ nom: '', description: '', dateDebutPrevue: '', dureeJours: 5, estJalon: false });
      setSelectedLotId(null);
      loadData();
    } catch (error) {
      console.error('Error adding tache:', error);
      toast({ title: 'Erreur', description: 'Impossible d\'ajouter la tâche', variant: 'destructive' });
    }
  };

  const handleUpdateAvancement = async (tacheId: string, avancement: number) => {
    try {
      await PlanningService.updateAvancement({ tacheId, avancement });
      loadData();
    } catch (error) {
      console.error('Error updating avancement:', error);
    }
  };

  const toggleLotExpansion = (lotId: string) => {
    setExpandedLots(prev => {
      const next = new Set(prev);
      if (next.has(lotId)) {
        next.delete(lotId);
      } else {
        next.add(lotId);
      }
      return next;
    });
  };

  // Calculate date range for Gantt view
  const dateRange = useMemo(() => {
    const dates: Date[] = [];
    const start = new Date(startDate);
    start.setDate(start.getDate() - start.getDay()); // Start from Sunday

    const daysToShow = viewMode === 'day' ? 14 : viewMode === 'week' ? 8 * 7 : 12 * 7;

    for (let i = 0; i < daysToShow; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date);
    }

    return dates;
  }, [startDate, viewMode]);

  const getTaskPosition = (task: GanttTask, dateRange: Date[]) => {
    const start = new Date(task.dateDebut);
    const end = new Date(task.dateFin);
    const rangeStart = dateRange[0];
    const rangeEnd = dateRange[dateRange.length - 1];

    const totalDays = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24));
    const startOffset = Math.max(0, Math.ceil((start.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)));
    const endOffset = Math.min(totalDays, Math.ceil((end.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)));

    const left = (startOffset / totalDays) * 100;
    const width = ((endOffset - startOffset) / totalDays) * 100;

    return { left: `${left}%`, width: `${Math.max(width, 1)}%` };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Planning d'exécution</h1>
            <p className="text-muted-foreground">Diagramme de Gantt interactif</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={viewMode} onValueChange={(v: 'day' | 'week' | 'month') => setViewMode(v)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Jour</SelectItem>
              <SelectItem value="week">Semaine</SelectItem>
              <SelectItem value="month">Mois</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setShowAddLot(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Lot
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.nombreLots}</div>
              <p className="text-xs text-muted-foreground">Lots</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.nombreTaches}</div>
              <p className="text-xs text-muted-foreground">Tâches</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">{stats.tachesTerminees}</div>
              <p className="text-xs text-muted-foreground">Terminées</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-600">{stats.tachesEnCours}</div>
              <p className="text-xs text-muted-foreground">En cours</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-600">{stats.tachesEnRetard}</div>
              <p className="text-xs text-muted-foreground">En retard</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.avancementGlobal}%</div>
              <p className="text-xs text-muted-foreground">Avancement</p>
              <Progress value={stats.avancementGlobal} className="h-1 mt-1" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chemin critique alert */}
      {cheminCritique && cheminCritique.tacheIds.length > 0 && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <Target className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <span className="font-medium">Chemin critique :</span> {cheminCritique.dureeTotaleJours} jours
            ({cheminCritique.dateDebut} → {cheminCritique.dateFin})
            - {cheminCritique.tacheIds.length} tâche(s) critique(s)
          </AlertDescription>
        </Alert>
      )}

      {/* Gantt Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Diagramme de Gantt
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lots.length === 0 ? (
            <div className="text-center py-12">
              <Layers className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">Aucun lot défini</h3>
              <p className="text-muted-foreground mb-4">
                Commencez par créer des lots de travaux
              </p>
              <Button onClick={() => setShowAddLot(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Créer un lot
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Timeline header */}
              <div className="flex border-b sticky top-0 bg-white z-10">
                <div className="w-64 flex-shrink-0 p-2 font-medium border-r">
                  Tâches
                </div>
                <div className="flex-1 flex">
                  {dateRange.filter((_, i) => viewMode === 'day' || i % 7 === 0).map((date, i) => (
                    <div
                      key={i}
                      className="flex-1 text-center text-xs p-1 border-r"
                      style={{ minWidth: viewMode === 'day' ? '40px' : '80px' }}
                    >
                      {viewMode === 'day'
                        ? date.getDate()
                        : `S${Math.ceil((date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))}`
                      }
                    </div>
                  ))}
                </div>
              </div>

              {/* Lots and tasks */}
              {lots.map(lot => {
                const lotTaches = taches.filter(t => t.lotId === lot.id);
                const isExpanded = expandedLots.has(lot.id);

                return (
                  <div key={lot.id}>
                    {/* Lot row */}
                    <div className="flex border-b bg-muted/30 hover:bg-muted/50">
                      <div className="w-64 flex-shrink-0 p-2 border-r flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => toggleLotExpansion(lot.id)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </Button>
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: lot.couleur }}
                        />
                        <span className="font-medium truncate">
                          {lot.code} - {lot.nom}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 ml-auto"
                          onClick={() => {
                            setSelectedLotId(lot.id);
                            setShowAddTache(true);
                          }}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="flex-1 relative h-8">
                        {/* Lot summary bar */}
                        {lotTaches.length > 0 && (
                          <div
                            className="absolute top-1 h-6 rounded opacity-30"
                            style={{
                              backgroundColor: lot.couleur,
                              ...getTaskPosition(
                                {
                                  id: lot.id,
                                  nom: lot.nom,
                                  dateDebut: lotTaches.reduce((min, t) => t.dateDebutPrevue < min ? t.dateDebutPrevue : min, lotTaches[0].dateDebutPrevue),
                                  dateFin: lotTaches.reduce((max, t) => t.dateFinPrevue > max ? t.dateFinPrevue : max, lotTaches[0].dateFinPrevue),
                                  avancement: 0,
                                  couleur: lot.couleur,
                                } as GanttTask,
                                dateRange
                              ),
                            }}
                          />
                        )}
                      </div>
                    </div>

                    {/* Tasks rows */}
                    {isExpanded && lotTaches.map(tache => {
                      const isCritical = cheminCritique?.tacheIds.includes(tache.id);

                      return (
                        <div
                          key={tache.id}
                          className={`flex border-b hover:bg-muted/20 ${isCritical ? 'bg-red-50' : ''}`}
                        >
                          <div className="w-64 flex-shrink-0 p-2 pl-10 border-r flex items-center gap-2">
                            {tache.estJalon ? (
                              <Milestone className="w-4 h-4 text-primary" />
                            ) : (
                              <div className={`w-2 h-2 rounded-full ${STATUT_COLORS[tache.statut]}`} />
                            )}
                            <span className="truncate text-sm">{tache.nom}</span>
                            {isCritical && (
                              <Badge variant="destructive" className="text-[10px] h-4 px-1">
                                Critique
                              </Badge>
                            )}
                          </div>
                          <div className="flex-1 relative h-8">
                            {/* Task bar */}
                            <div
                              className={`absolute top-1 h-6 rounded cursor-pointer transition-all hover:opacity-80 ${tache.estJalon ? 'w-3 h-3 top-2.5 rotate-45 rounded-none' : ''}`}
                              style={{
                                backgroundColor: tache.estJalon ? '#8B5CF6' : lot.couleur,
                                ...(!tache.estJalon && getTaskPosition(
                                  {
                                    id: tache.id,
                                    nom: tache.nom,
                                    dateDebut: tache.dateDebutPrevue,
                                    dateFin: tache.dateFinPrevue,
                                    avancement: tache.avancement,
                                    couleur: lot.couleur,
                                  } as GanttTask,
                                  dateRange
                                )),
                                ...(tache.estJalon && {
                                  left: getTaskPosition(
                                    { dateDebut: tache.dateDebutPrevue, dateFin: tache.dateDebutPrevue } as GanttTask,
                                    dateRange
                                  ).left,
                                }),
                              }}
                              onClick={() => setEditingTache(tache)}
                            >
                              {/* Progress inside bar */}
                              {!tache.estJalon && tache.avancement > 0 && (
                                <div
                                  className="h-full rounded-l bg-green-600"
                                  style={{ width: `${tache.avancement}%` }}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Lot Dialog */}
      <Dialog open={showAddLot} onOpenChange={setShowAddLot}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un lot</DialogTitle>
            <DialogDescription>
              Créez un nouveau lot de travaux
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Code</Label>
                <Input
                  value={newLot.code}
                  onChange={(e) => setNewLot({ ...newLot, code: e.target.value })}
                  placeholder="Ex: LOT1"
                />
              </div>
              <div>
                <Label>Couleur</Label>
                <Input
                  type="color"
                  value={newLot.couleur}
                  onChange={(e) => setNewLot({ ...newLot, couleur: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Nom du lot</Label>
              <Input
                value={newLot.nom}
                onChange={(e) => setNewLot({ ...newLot, nom: e.target.value })}
                placeholder="Ex: Gros œuvre"
              />
            </div>
            <div>
              <Label>Entreprise (optionnel)</Label>
              <Input
                value={newLot.entrepriseNom}
                onChange={(e) => setNewLot({ ...newLot, entrepriseNom: e.target.value })}
                placeholder="Ex: Entreprise Martin SARL"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddLot(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddLot} disabled={!newLot.code || !newLot.nom}>
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Task Dialog */}
      <Dialog open={showAddTache} onOpenChange={setShowAddTache}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une tâche</DialogTitle>
            <DialogDescription>
              Lot: {lots.find(l => l.id === selectedLotId)?.nom}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom de la tâche</Label>
              <Input
                value={newTache.nom}
                onChange={(e) => setNewTache({ ...newTache, nom: e.target.value })}
                placeholder="Ex: Coulage fondations"
              />
            </div>
            <div>
              <Label>Description (optionnel)</Label>
              <Textarea
                value={newTache.description}
                onChange={(e) => setNewTache({ ...newTache, description: e.target.value })}
                placeholder="Détails de la tâche..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date de début</Label>
                <Input
                  type="date"
                  value={newTache.dateDebutPrevue}
                  onChange={(e) => setNewTache({ ...newTache, dateDebutPrevue: e.target.value })}
                />
              </div>
              <div>
                <Label>Durée (jours)</Label>
                <Input
                  type="number"
                  min={1}
                  value={newTache.dureeJours}
                  onChange={(e) => setNewTache({ ...newTache, dureeJours: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="estJalon"
                checked={newTache.estJalon}
                onChange={(e) => setNewTache({ ...newTache, estJalon: e.target.checked })}
              />
              <Label htmlFor="estJalon">Jalon (point clé sans durée)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTache(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddTache} disabled={!newTache.nom || !newTache.dateDebutPrevue}>
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog open={!!editingTache} onOpenChange={() => setEditingTache(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la tâche</DialogTitle>
            <DialogDescription>{editingTache?.nom}</DialogDescription>
          </DialogHeader>
          {editingTache && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Avancement</span>
                  <span className="text-2xl font-bold">{editingTache.avancement}%</span>
                </div>
                <Slider
                  value={[editingTache.avancement]}
                  max={100}
                  step={5}
                  onValueChange={([value]) => {
                    setEditingTache({ ...editingTache, avancement: value });
                  }}
                />
                <div className="flex justify-between mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUpdateAvancement(editingTache.id, 0)}
                  >
                    0%
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUpdateAvancement(editingTache.id, 50)}
                  >
                    50%
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUpdateAvancement(editingTache.id, 100)}
                  >
                    100%
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Début prévu</span>
                  <p className="font-medium">{editingTache.dateDebutPrevue}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Fin prévue</span>
                  <p className="font-medium">{editingTache.dateFinPrevue}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Statut</span>
                  <p>
                    <Badge className={`${STATUT_COLORS[editingTache.statut]} text-white`}>
                      {STATUT_LABELS[editingTache.statut]}
                    </Badge>
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Durée</span>
                  <p className="font-medium">{editingTache.dureeJours} jours</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTache(null)}>
              Fermer
            </Button>
            {editingTache && (
              <Button onClick={() => {
                handleUpdateAvancement(editingTache.id, editingTache.avancement);
                setEditingTache(null);
              }}>
                Enregistrer
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * TORP Phase 2 - Composant PlanningGantt
 * Diagramme de Gantt interactif réutilisable
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
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
  ChevronDown,
  ChevronRight,
  Calendar,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Download,
  Milestone,
  Target,
} from 'lucide-react';

// Types
interface GanttTask {
  id: string;
  nom: string;
  dateDebut: string;
  dateFin: string;
  avancement: number;
  couleur: string;
  parentId?: string;
  estJalon?: boolean;
  estCritique?: boolean;
  niveau: number;
  statut?: string;
  dureeJours?: number;
}

interface GanttLot {
  id: string;
  code: string;
  nom: string;
  couleur: string;
  taches: GanttTask[];
  avancement?: number;
}

interface PlanningGanttProps {
  lots: GanttLot[];
  criticalPath?: string[];
  startDate?: string;
  endDate?: string;
  viewMode?: 'day' | 'week' | 'month';
  onViewModeChange?: (mode: 'day' | 'week' | 'month') => void;
  onTaskClick?: (taskId: string) => void;
  onTaskUpdate?: (taskId: string, updates: { avancement?: number; dateDebut?: string; dateFin?: string }) => void;
  onLotToggle?: (lotId: string) => void;
  onExport?: (format: 'pdf' | 'excel' | 'msproject') => void;
  readOnly?: boolean;
  showStats?: boolean;
  className?: string;
}

// Constantes couleurs statuts
const STATUT_COLORS: Record<string, string> = {
  non_commence: 'bg-gray-300',
  a_planifier: 'bg-gray-300',
  planifiee: 'bg-blue-300',
  en_cours: 'bg-blue-500',
  terminee: 'bg-green-500',
  en_retard: 'bg-red-500',
  suspendue: 'bg-orange-500',
  annulee: 'bg-gray-400',
};

const STATUT_LABELS: Record<string, string> = {
  non_commence: 'Non commencé',
  a_planifier: 'À planifier',
  planifiee: 'Planifiée',
  en_cours: 'En cours',
  terminee: 'Terminée',
  en_retard: 'En retard',
  suspendue: 'Suspendue',
  annulee: 'Annulée',
};

export function PlanningGantt({
  lots,
  criticalPath = [],
  startDate,
  endDate,
  viewMode: initialViewMode = 'week',
  onViewModeChange,
  onTaskClick,
  onTaskUpdate,
  onLotToggle,
  onExport,
  readOnly = false,
  showStats = true,
  className,
}: PlanningGanttProps) {
  // State
  const [expandedLots, setExpandedLots] = useState<Set<string>>(new Set(lots.map(l => l.id)));
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>(initialViewMode);
  const [zoom, setZoom] = useState(1);
  const [selectedTask, setSelectedTask] = useState<GanttTask | null>(null);
  const [showTaskDialog, setShowTaskDialog] = useState(false);

  // Calcul des dates de la timeline
  const timeline = useMemo(() => {
    // Trouver les dates min/max si non fournies
    let minDate = startDate ? new Date(startDate) : new Date();
    let maxDate = endDate ? new Date(endDate) : new Date();

    if (!startDate || !endDate) {
      lots.forEach(lot => {
        lot.taches.forEach(tache => {
          const taskStart = new Date(tache.dateDebut);
          const taskEnd = new Date(tache.dateFin);
          if (taskStart < minDate) minDate = taskStart;
          if (taskEnd > maxDate) maxDate = taskEnd;
        });
      });

      // Ajouter marge
      minDate.setDate(minDate.getDate() - 7);
      maxDate.setDate(maxDate.getDate() + 14);
    }

    // Générer les jours
    const days: Date[] = [];
    const current = new Date(minDate);
    while (current <= maxDate) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return { start: minDate, end: maxDate, days, totalDays: days.length };
  }, [lots, startDate, endDate]);

  // Grouper par unité de temps selon viewMode
  const timeUnits = useMemo(() => {
    if (viewMode === 'day') {
      return timeline.days.map(d => ({
        date: d,
        label: d.getDate().toString(),
        sublabel: d.toLocaleDateString('fr-FR', { weekday: 'short' }),
      }));
    }

    if (viewMode === 'week') {
      const weeks: { start: Date; end: Date; label: string }[] = [];
      let weekStart = new Date(timeline.start);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Lundi

      while (weekStart <= timeline.end) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const weekNum = Math.ceil(
          (weekStart.getTime() - new Date(weekStart.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)
        );

        weeks.push({
          start: new Date(weekStart),
          end: weekEnd > timeline.end ? new Date(timeline.end) : weekEnd,
          label: `S${weekNum}`,
        });

        weekStart.setDate(weekStart.getDate() + 7);
      }
      return weeks;
    }

    // Month
    const months: { start: Date; label: string }[] = [];
    const current = new Date(timeline.start);
    current.setDate(1);

    while (current <= timeline.end) {
      months.push({
        start: new Date(current),
        label: current.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
      });
      current.setMonth(current.getMonth() + 1);
    }
    return months;
  }, [timeline, viewMode]);

  // Statistiques
  const stats = useMemo(() => {
    const allTasks = lots.flatMap(l => l.taches);
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter(t => t.avancement === 100).length;
    const inProgressTasks = allTasks.filter(t => t.avancement > 0 && t.avancement < 100).length;
    const criticalTasks = allTasks.filter(t => criticalPath.includes(t.id)).length;
    const overallProgress = totalTasks > 0
      ? Math.round(allTasks.reduce((sum, t) => sum + t.avancement, 0) / totalTasks)
      : 0;

    return { totalTasks, completedTasks, inProgressTasks, criticalTasks, overallProgress };
  }, [lots, criticalPath]);

  // Handlers
  const toggleLot = useCallback((lotId: string) => {
    setExpandedLots(prev => {
      const next = new Set(prev);
      if (next.has(lotId)) {
        next.delete(lotId);
      } else {
        next.add(lotId);
      }
      return next;
    });
    onLotToggle?.(lotId);
  }, [onLotToggle]);

  const handleViewModeChange = useCallback((mode: 'day' | 'week' | 'month') => {
    setViewMode(mode);
    onViewModeChange?.(mode);
  }, [onViewModeChange]);

  const handleTaskClick = useCallback((task: GanttTask) => {
    setSelectedTask(task);
    setShowTaskDialog(true);
    onTaskClick?.(task.id);
  }, [onTaskClick]);

  const handleAvancementChange = useCallback((value: number[]) => {
    if (selectedTask && onTaskUpdate) {
      onTaskUpdate(selectedTask.id, { avancement: value[0] });
      setSelectedTask({ ...selectedTask, avancement: value[0] });
    }
  }, [selectedTask, onTaskUpdate]);

  // Calcul position tâche dans la timeline
  const getTaskPosition = useCallback((task: GanttTask) => {
    const taskStart = new Date(task.dateDebut);
    const taskEnd = new Date(task.dateFin);

    const startOffset = Math.max(0,
      (taskStart.getTime() - timeline.start.getTime()) / (24 * 60 * 60 * 1000)
    );
    const duration = Math.max(1,
      (taskEnd.getTime() - taskStart.getTime()) / (24 * 60 * 60 * 1000) + 1
    );

    const unitWidth = 100 / timeline.totalDays;

    return {
      left: `${startOffset * unitWidth}%`,
      width: `${Math.max(duration * unitWidth, 1)}%`,
    };
  }, [timeline]);

  // Calculer la couleur de fond d'un lot
  const getLotAvancement = useCallback((lot: GanttLot) => {
    if (lot.taches.length === 0) return 0;
    return Math.round(
      lot.taches.reduce((sum, t) => sum + t.avancement, 0) / lot.taches.length
    );
  }, []);

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Planning Gantt
        </CardTitle>
        <div className="flex items-center gap-2">
          {/* View Mode */}
          <Select value={viewMode} onValueChange={(v) => handleViewModeChange(v as 'day' | 'week' | 'month')}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Jour</SelectItem>
              <SelectItem value="week">Semaine</SelectItem>
              <SelectItem value="month">Mois</SelectItem>
            </SelectContent>
          </Select>

          {/* Zoom */}
          <div className="flex items-center gap-1 border rounded-md px-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setZoom(z => Math.min(2, z + 0.25))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          {/* Export */}
          {onExport && (
            <Select onValueChange={(v) => onExport(v as 'pdf' | 'excel' | 'msproject')}>
              <SelectTrigger className="w-32">
                <Download className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Export" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="excel">Excel</SelectItem>
                <SelectItem value="msproject">MS Project</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {/* Stats */}
        {showStats && (
          <div className="grid grid-cols-5 gap-4 mb-4 p-3 bg-muted/30 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold">{lots.length}</div>
              <div className="text-xs text-muted-foreground">Lots</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.totalTasks}</div>
              <div className="text-xs text-muted-foreground">Tâches</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.completedTasks}</div>
              <div className="text-xs text-muted-foreground">Terminées</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.criticalTasks}</div>
              <div className="text-xs text-muted-foreground">Critiques</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.overallProgress}%</div>
              <div className="text-xs text-muted-foreground">Avancement</div>
              <Progress value={stats.overallProgress} className="h-1 mt-1" />
            </div>
          </div>
        )}

        {/* Chemin critique alert */}
        {criticalPath.length > 0 && (
          <div className="flex items-center gap-2 mb-4 p-2 bg-red-50 border border-red-200 rounded-lg text-sm">
            <Target className="h-4 w-4 text-red-600" />
            <span className="text-red-800">
              <strong>Chemin critique :</strong> {criticalPath.length} tâche(s) critique(s) identifiée(s)
            </span>
          </div>
        )}

        {/* Gantt Chart */}
        <div
          className="overflow-x-auto border rounded-lg"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
        >
          {/* Header timeline */}
          <div className="flex border-b sticky top-0 bg-white z-10">
            <div className="w-64 shrink-0 p-2 font-medium border-r bg-muted/50">
              Tâche
            </div>
            <div className="flex-1 flex">
              {timeUnits.map((unit, i) => (
                <div
                  key={i}
                  className="flex-1 text-center text-xs p-1 border-r bg-muted/30"
                  style={{
                    minWidth: viewMode === 'day' ? 30 : viewMode === 'week' ? 60 : 100,
                  }}
                >
                  {'label' in unit ? unit.label : ''}
                </div>
              ))}
            </div>
          </div>

          {/* Lots et tâches */}
          {lots.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Aucun lot défini</p>
            </div>
          ) : (
            lots.map(lot => {
              const isExpanded = expandedLots.has(lot.id);
              const lotAvancement = getLotAvancement(lot);

              return (
                <div key={lot.id}>
                  {/* Ligne lot */}
                  <div
                    className="flex border-b bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => toggleLot(lot.id)}
                  >
                    <div className="w-64 shrink-0 p-2 border-r flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0" />
                      )}
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: lot.couleur }}
                      />
                      <span className="font-medium truncate">
                        {lot.code} - {lot.nom}
                      </span>
                      <Badge variant="outline" className="ml-auto text-xs">
                        {lotAvancement}%
                      </Badge>
                    </div>
                    <div className="flex-1 relative h-10 flex items-center">
                      {/* Barre résumé lot */}
                      {lot.taches.length > 0 && (
                        <div
                          className="absolute h-5 rounded opacity-40"
                          style={{
                            backgroundColor: lot.couleur,
                            left: getTaskPosition(lot.taches[0]).left,
                            width: `calc(${getTaskPosition(lot.taches[lot.taches.length - 1]).left} + ${getTaskPosition(lot.taches[lot.taches.length - 1]).width} - ${getTaskPosition(lot.taches[0]).left})`,
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Tâches du lot */}
                  {isExpanded && lot.taches.map(tache => {
                    const isCritical = criticalPath.includes(tache.id);
                    const position = getTaskPosition(tache);

                    return (
                      <div
                        key={tache.id}
                        className={`flex border-b hover:bg-muted/10 cursor-pointer transition-colors ${
                          isCritical ? 'bg-red-50' : ''
                        } ${selectedTask?.id === tache.id ? 'bg-blue-50' : ''}`}
                        onClick={() => handleTaskClick(tache)}
                      >
                        <div className="w-64 shrink-0 p-2 pl-10 border-r flex items-center gap-2">
                          {tache.estJalon ? (
                            <Milestone className="h-4 w-4 text-purple-500 shrink-0" />
                          ) : (
                            <div className={`w-2 h-2 rounded-full shrink-0 ${
                              STATUT_COLORS[tache.statut || 'non_commence']
                            }`} />
                          )}
                          <span className={`truncate text-sm ${
                            isCritical ? 'text-red-700 font-medium' : ''
                          }`}>
                            {tache.nom}
                          </span>
                          {isCritical && (
                            <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />
                          )}
                        </div>
                        <div className="flex-1 relative h-9 flex items-center">
                          {/* Barre de tâche */}
                          {tache.estJalon ? (
                            <div
                              className="absolute w-3 h-3 rotate-45 bg-purple-500"
                              style={{ left: position.left }}
                            />
                          ) : (
                            <div
                              className={`absolute h-6 rounded ${
                                isCritical ? 'ring-2 ring-red-400' : ''
                              }`}
                              style={{
                                backgroundColor: isCritical ? '#ef4444' : lot.couleur,
                                ...position,
                              }}
                            >
                              {/* Barre d'avancement */}
                              {tache.avancement > 0 && (
                                <div
                                  className="h-full rounded-l bg-black/20"
                                  style={{ width: `${tache.avancement}%` }}
                                />
                              )}
                              {/* Label */}
                              <span className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium">
                                {tache.avancement}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Légende */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 bg-red-500 rounded" />
            <span>Chemin critique</span>
          </div>
          <div className="flex items-center gap-1">
            <Milestone className="h-4 w-4 text-purple-500" />
            <span>Jalon</span>
          </div>
          {lots.slice(0, 4).map(lot => (
            <div key={lot.id} className="flex items-center gap-1">
              <div
                className="w-4 h-3 rounded"
                style={{ backgroundColor: lot.couleur }}
              />
              <span>{lot.code}</span>
            </div>
          ))}
        </div>
      </CardContent>

      {/* Dialog détail tâche */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedTask?.nom}</DialogTitle>
            <DialogDescription>
              {selectedTask?.dureeJours} jour(s) - Du {selectedTask?.dateDebut} au {selectedTask?.dateFin}
            </DialogDescription>
          </DialogHeader>

          {selectedTask && (
            <div className="space-y-4">
              {/* Statut */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Statut</span>
                <Badge className={STATUT_COLORS[selectedTask.statut || 'non_commence']}>
                  {STATUT_LABELS[selectedTask.statut || 'non_commence']}
                </Badge>
              </div>

              {/* Chemin critique */}
              {criticalPath.includes(selectedTask.id) && (
                <div className="flex items-center gap-2 p-2 bg-red-50 rounded text-red-700 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Cette tâche est sur le chemin critique</span>
                </div>
              )}

              {/* Avancement */}
              {!readOnly && !selectedTask.estJalon && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Avancement</span>
                    <span className="text-2xl font-bold">{selectedTask.avancement}%</span>
                  </div>
                  <Slider
                    value={[selectedTask.avancement]}
                    max={100}
                    step={5}
                    onValueChange={handleAvancementChange}
                  />
                  <div className="flex justify-between gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAvancementChange([0])}
                    >
                      0%
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAvancementChange([25])}
                    >
                      25%
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAvancementChange([50])}
                    >
                      50%
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAvancementChange([75])}
                    >
                      75%
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAvancementChange([100])}
                    >
                      100%
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTaskDialog(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default PlanningGantt;

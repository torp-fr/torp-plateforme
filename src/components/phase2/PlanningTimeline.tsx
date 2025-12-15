/**
 * PlanningTimeline - Vue chronologique du planning (style Gantt simplifié)
 * Affiche les tâches sur une ligne temporelle
 */

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Flag,
  AlertTriangle,
} from 'lucide-react';
import type { PlanningLot, PlanningTache, GanttTask } from '@/types/phase2';

interface PlanningTimelineProps {
  lots: PlanningLot[];
  startDate?: Date;
  endDate?: Date;
}

type ViewMode = 'day' | 'week' | 'month';

export function PlanningTimeline({ lots, startDate, endDate }: PlanningTimelineProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Calcul des dates min/max du planning
  const dateRange = useMemo(() => {
    let minDate = startDate || new Date();
    let maxDate = endDate || new Date();

    const extractDates = (lot: PlanningLot) => {
      if (lot.dateDebutPrevue) {
        const d = new Date(lot.dateDebutPrevue);
        if (d < minDate) minDate = d;
      }
      if (lot.dateFinPrevue) {
        const d = new Date(lot.dateFinPrevue);
        if (d > maxDate) maxDate = d;
      }
      lot.taches?.forEach(tache => {
        const start = new Date(tache.dateDebut);
        const end = new Date(tache.dateFin);
        if (start < minDate) minDate = start;
        if (end > maxDate) maxDate = end;
      });
      lot.children?.forEach(extractDates);
    };

    lots.forEach(extractDates);

    // Ajouter une marge
    minDate = new Date(minDate);
    minDate.setDate(minDate.getDate() - 7);
    maxDate = new Date(maxDate);
    maxDate.setDate(maxDate.getDate() + 14);

    return { minDate, maxDate };
  }, [lots, startDate, endDate]);

  // Génération des colonnes de temps
  const timeColumns = useMemo(() => {
    const columns: { date: Date; label: string; isWeekend: boolean; isToday: boolean }[] = [];
    const current = new Date(dateRange.minDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    while (current <= dateRange.maxDate) {
      const dayOfWeek = current.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isToday = current.getTime() === today.getTime();

      let label = '';
      if (viewMode === 'day') {
        label = current.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
      } else if (viewMode === 'week') {
        if (current.getDay() === 1) {
          label = `S${getWeekNumber(current)}`;
        }
      } else {
        if (current.getDate() === 1) {
          label = current.toLocaleDateString('fr-FR', { month: 'short' });
        }
      }

      columns.push({
        date: new Date(current),
        label,
        isWeekend,
        isToday,
      });

      current.setDate(current.getDate() + 1);
    }

    return columns;
  }, [dateRange, viewMode]);

  // Helper: numéro de semaine
  function getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  // Calcul position et largeur d'une barre
  const getBarStyle = (startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const totalDays = Math.ceil((dateRange.maxDate.getTime() - dateRange.minDate.getTime()) / (1000 * 60 * 60 * 24));
    const startOffset = Math.ceil((start.getTime() - dateRange.minDate.getTime()) / (1000 * 60 * 60 * 24));
    const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const columnWidth = viewMode === 'day' ? 40 : viewMode === 'week' ? 20 : 10;

    return {
      left: `${startOffset * columnWidth}px`,
      width: `${Math.max(duration * columnWidth - 4, 20)}px`,
    };
  };

  // Navigation
  const navigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    const amount = viewMode === 'day' ? 7 : viewMode === 'week' ? 28 : 90;
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - amount);
    } else {
      newDate.setDate(newDate.getDate() + amount);
    }
    setCurrentDate(newDate);
  };

  const columnWidth = viewMode === 'day' ? 40 : viewMode === 'week' ? 20 : 10;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Planning
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Jour</SelectItem>
                <SelectItem value="week">Semaine</SelectItem>
                <SelectItem value="month">Mois</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center">
              <Button variant="ghost" size="icon" onClick={() => navigatePeriod('prev')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())}>
                Aujourd'hui
              </Button>
              <Button variant="ghost" size="icon" onClick={() => navigatePeriod('next')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full">
          <div className="min-w-max">
            {/* En-tête des colonnes */}
            <div className="flex border-b sticky top-0 bg-background z-10">
              <div className="w-48 flex-shrink-0 p-2 font-medium border-r">
                Lot / Tâche
              </div>
              <div className="flex">
                {timeColumns.map((col, idx) => (
                  <div
                    key={idx}
                    className={`flex-shrink-0 text-center text-xs py-1 border-r ${
                      col.isWeekend ? 'bg-muted/50' : ''
                    } ${col.isToday ? 'bg-primary/10' : ''}`}
                    style={{ width: columnWidth }}
                  >
                    {col.label && (
                      <span className="font-medium">{col.label}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Lignes des lots et tâches */}
            <TooltipProvider>
              {lots.map((lot) => (
                <div key={lot.id}>
                  {/* Ligne du lot */}
                  <div className="flex border-b hover:bg-muted/30">
                    <div className="w-48 flex-shrink-0 p-2 border-r flex items-center gap-2">
                      <div
                        className={`w-2 h-4 rounded-full ${
                          lot.estCritique ? 'bg-red-500' : 'bg-primary'
                        }`}
                      />
                      <span className="font-medium text-sm truncate">{lot.nom}</span>
                    </div>
                    <div className="relative flex-1 h-8" style={{ minWidth: timeColumns.length * columnWidth }}>
                      {/* Barres de fond (weekends) */}
                      <div className="absolute inset-0 flex">
                        {timeColumns.map((col, idx) => (
                          <div
                            key={idx}
                            className={`flex-shrink-0 h-full ${
                              col.isWeekend ? 'bg-muted/30' : ''
                            } ${col.isToday ? 'bg-primary/5' : ''}`}
                            style={{ width: columnWidth }}
                          />
                        ))}
                      </div>
                      {/* Barre du lot */}
                      {lot.dateDebutPrevue && lot.dateFinPrevue && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={`absolute top-1 h-6 rounded ${
                                lot.estCritique ? 'bg-red-400' : 'bg-primary/60'
                              } cursor-pointer hover:brightness-90 transition-all`}
                              style={getBarStyle(lot.dateDebutPrevue, lot.dateFinPrevue)}
                            >
                              <div
                                className="h-full rounded-l bg-primary"
                                style={{ width: `${lot.avancement}%` }}
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-medium">{lot.nom}</p>
                            <p className="text-xs">Avancement: {lot.avancement}%</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>

                  {/* Lignes des tâches */}
                  {lot.taches?.map((tache) => (
                    <div key={tache.id} className="flex border-b hover:bg-muted/20">
                      <div className="w-48 flex-shrink-0 p-2 pl-6 border-r flex items-center gap-2">
                        <span className="text-sm text-muted-foreground truncate">{tache.nom}</span>
                        {tache.estPointArret && (
                          <Flag className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                        )}
                        {tache.estCritique && (
                          <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />
                        )}
                      </div>
                      <div className="relative flex-1 h-6" style={{ minWidth: timeColumns.length * columnWidth }}>
                        {/* Barres de fond */}
                        <div className="absolute inset-0 flex">
                          {timeColumns.map((col, idx) => (
                            <div
                              key={idx}
                              className={`flex-shrink-0 h-full ${
                                col.isWeekend ? 'bg-muted/30' : ''
                              } ${col.isToday ? 'bg-primary/5' : ''}`}
                              style={{ width: columnWidth }}
                            />
                          ))}
                        </div>
                        {/* Barre de la tâche */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={`absolute top-0.5 h-5 rounded cursor-pointer hover:brightness-90 transition-all ${
                                tache.estCritique
                                  ? 'bg-red-300'
                                  : tache.statut === 'terminee'
                                  ? 'bg-green-300'
                                  : 'bg-blue-300'
                              }`}
                              style={getBarStyle(tache.dateDebut, tache.dateFin)}
                            >
                              <div
                                className={`h-full rounded-l ${
                                  tache.estCritique
                                    ? 'bg-red-500'
                                    : tache.statut === 'terminee'
                                    ? 'bg-green-500'
                                    : 'bg-blue-500'
                                }`}
                                style={{ width: `${tache.avancement}%` }}
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-medium">{tache.nom}</p>
                            <p className="text-xs">
                              {new Date(tache.dateDebut).toLocaleDateString('fr-FR')} →{' '}
                              {new Date(tache.dateFin).toLocaleDateString('fr-FR')}
                            </p>
                            <p className="text-xs">Avancement: {tache.avancement}%</p>
                            {tache.estCritique && (
                              <Badge variant="destructive" className="text-xs mt-1">
                                Chemin critique
                              </Badge>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </TooltipProvider>

            {/* Ligne "Aujourd'hui" */}
            <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20" style={{
              left: `calc(192px + ${Math.ceil((new Date().getTime() - dateRange.minDate.getTime()) / (1000 * 60 * 60 * 24)) * columnWidth}px)`,
            }} />
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Légende */}
        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-primary" />
            <span>Lot</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-500" />
            <span>Tâche</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span>Chemin critique</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span>Terminé</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default PlanningTimeline;

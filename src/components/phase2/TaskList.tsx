/**
 * TaskList - Liste des tâches du planning avec gestion d'avancement
 * Permet de visualiser et mettre à jour les tâches
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  PlayCircle,
  PauseCircle,
  XCircle,
  Calendar,
  Edit2,
  Flag,
  ChevronRight,
} from 'lucide-react';
import type { PlanningLot, PlanningTache, StatutTache, UpdateAvancementInput } from '@/types/phase2';

interface TaskListProps {
  lots: PlanningLot[];
  onUpdateAvancement?: (input: UpdateAvancementInput) => Promise<void>;
  readOnly?: boolean;
}

const STATUT_CONFIG: Record<StatutTache, { label: string; color: string; icon: React.ElementType }> = {
  a_planifier: { label: 'À planifier', color: 'bg-gray-400', icon: Clock },
  planifiee: { label: 'Planifiée', color: 'bg-blue-500', icon: Calendar },
  en_cours: { label: 'En cours', color: 'bg-green-500', icon: PlayCircle },
  en_attente: { label: 'En attente', color: 'bg-yellow-500', icon: PauseCircle },
  terminee: { label: 'Terminée', color: 'bg-emerald-600', icon: CheckCircle2 },
  annulee: { label: 'Annulée', color: 'bg-red-500', icon: XCircle },
};

interface TaskItemProps {
  tache: PlanningTache;
  onEdit?: (tache: PlanningTache) => void;
  readOnly?: boolean;
}

function TaskItem({ tache, onEdit, readOnly }: TaskItemProps) {
  const statutConfig = STATUT_CONFIG[tache.statut];
  const StatutIcon = statutConfig.icon;

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  const isOverdue = new Date(tache.dateFin) < new Date() && tache.statut !== 'terminee' && tache.statut !== 'annulee';

  return (
    <div
      className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${
        tache.estCritique ? 'border-red-200 bg-red-50/50' : 'hover:bg-muted/50'
      } ${isOverdue ? 'border-orange-300 bg-orange-50/50' : ''}`}
    >
      {/* Checkbox / Statut */}
      <div className="flex-shrink-0">
        <div className={`w-8 h-8 rounded-full ${statutConfig.color} flex items-center justify-center`}>
          <StatutIcon className="h-4 w-4 text-white" />
        </div>
      </div>

      {/* Infos tâche */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`font-medium truncate ${tache.statut === 'terminee' ? 'line-through text-muted-foreground' : ''}`}>
            {tache.nom}
          </p>
          {tache.estCritique && (
            <Badge variant="destructive" className="text-xs">
              Critique
            </Badge>
          )}
          {tache.estPointArret && (
            <Badge variant="secondary" className="text-xs">
              <Flag className="h-3 w-3 mr-1" />
              Point d'arrêt
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
          <span>{formatDate(tache.dateDebut)} → {formatDate(tache.dateFin)}</span>
          <span>•</span>
          <span>{tache.dureeJours}j</span>
          {tache.margeTotaleJours !== undefined && tache.margeTotaleJours > 0 && (
            <>
              <span>•</span>
              <span className="text-green-600">Marge: {tache.margeTotaleJours}j</span>
            </>
          )}
        </div>
      </div>

      {/* Avancement */}
      <div className="flex-shrink-0 w-32">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-muted-foreground">Avancement</span>
          <span className="font-medium">{tache.avancement}%</span>
        </div>
        <Progress value={tache.avancement} className="h-1.5" />
      </div>

      {/* Actions */}
      {!readOnly && onEdit && (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(tache);
          }}
        >
          <Edit2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export function TaskList({ lots, onUpdateAvancement, readOnly = false }: TaskListProps) {
  const [editingTask, setEditingTask] = useState<PlanningTache | null>(null);
  const [newAvancement, setNewAvancement] = useState(0);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEditTask = (tache: PlanningTache) => {
    setEditingTask(tache);
    setNewAvancement(tache.avancement);
    setNotes(tache.notes || '');
  };

  const handleSaveAvancement = async () => {
    if (!editingTask || !onUpdateAvancement) return;

    setIsSubmitting(true);
    try {
      await onUpdateAvancement({
        tacheId: editingTask.id,
        avancement: newAvancement,
        notes: notes || undefined,
        statut: newAvancement === 100 ? 'terminee' : newAvancement > 0 ? 'en_cours' : editingTask.statut,
      });
      setEditingTask(null);
    } catch (error) {
      console.error('Erreur mise à jour avancement:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTotalTasks = (lot: PlanningLot): number => {
    const directTasks = lot.taches?.length || 0;
    const childTasks = lot.children?.reduce((acc, child) => acc + getTotalTasks(child), 0) || 0;
    return directTasks + childTasks;
  };

  const getCompletedTasks = (lot: PlanningLot): number => {
    const directCompleted = lot.taches?.filter(t => t.statut === 'terminee').length || 0;
    const childCompleted = lot.children?.reduce((acc, child) => acc + getCompletedTasks(child), 0) || 0;
    return directCompleted + childCompleted;
  };

  if (lots.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Aucune tâche planifiée</p>
          <Button className="mt-4">Créer la première tâche</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Planning des tâches
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="space-y-2">
            {lots.map((lot) => {
              const totalTasks = getTotalTasks(lot);
              const completedTasks = getCompletedTasks(lot);

              return (
                <AccordionItem
                  key={lot.id}
                  value={lot.id}
                  className="border rounded-lg px-4"
                >
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center justify-between w-full mr-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2 h-8 rounded-full ${
                            lot.estCritique ? 'bg-red-500' : 'bg-primary'
                          }`}
                        />
                        <div className="text-left">
                          <p className="font-medium">{lot.nom}</p>
                          <p className="text-sm text-muted-foreground">
                            {lot.entrepriseNom || 'Entreprise non assignée'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-medium">{lot.avancement}%</p>
                          <p className="text-xs text-muted-foreground">
                            {completedTasks}/{totalTasks} tâches
                          </p>
                        </div>
                        <Progress value={lot.avancement} className="w-24 h-2" />
                        <Badge className={STATUT_CONFIG[lot.statut].color}>
                          {STATUT_CONFIG[lot.statut].label}
                        </Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="space-y-2 pt-2">
                      {lot.taches?.map((tache) => (
                        <TaskItem
                          key={tache.id}
                          tache={tache}
                          onEdit={readOnly ? undefined : handleEditTask}
                          readOnly={readOnly}
                        />
                      ))}
                      {lot.children?.map((childLot) => (
                        <div key={childLot.id} className="ml-4 border-l-2 pl-4 space-y-2">
                          <p className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                            <ChevronRight className="h-4 w-4" />
                            {childLot.nom}
                          </p>
                          {childLot.taches?.map((tache) => (
                            <TaskItem
                              key={tache.id}
                              tache={tache}
                              onEdit={readOnly ? undefined : handleEditTask}
                              readOnly={readOnly}
                            />
                          ))}
                        </div>
                      ))}
                      {(!lot.taches || lot.taches.length === 0) && (!lot.children || lot.children.length === 0) && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Aucune tâche pour ce lot
                        </p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      {/* Dialog édition avancement */}
      <Dialog open={!!editingTask} onOpenChange={() => setEditingTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mettre à jour l'avancement</DialogTitle>
            <DialogDescription>
              {editingTask?.nom}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <Label>Avancement ({newAvancement}%)</Label>
              <Slider
                value={[newAvancement]}
                onValueChange={([value]) => setNewAvancement(value)}
                max={100}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optionnel)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Commentaires sur l'avancement..."
                rows={3}
              />
            </div>

            {newAvancement === 100 && (
              <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm">La tâche sera marquée comme terminée</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTask(null)}>
              Annuler
            </Button>
            <Button onClick={handleSaveAvancement} disabled={isSubmitting}>
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default TaskList;

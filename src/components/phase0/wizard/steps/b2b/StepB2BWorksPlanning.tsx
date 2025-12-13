/**
 * Étape 3 B2B - Travaux & Planning
 * Description des travaux, délais et contraintes chantier
 */

import React from 'react';
import { StepComponentProps } from '../../WizardContainer';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Calendar, Clock, Zap, CalendarClock, CalendarDays, CalendarRange,
  AlertTriangle, Info, FileText
} from 'lucide-react';

// Niveaux d'urgence
const URGENCY_LEVELS = [
  { value: 'emergency', label: 'Urgent', desc: 'Sous 48h', icon: <Zap className="w-4 h-4 text-red-500" />, badge: 'Urgent', color: 'bg-red-100 text-red-800' },
  { value: 'within_month', label: '< 1 mois', desc: 'Sous 4 semaines', icon: <CalendarClock className="w-4 h-4 text-orange-500" />, badge: 'Rapide', color: 'bg-orange-100 text-orange-800' },
  { value: 'within_quarter', label: '1-3 mois', desc: 'Sous 3 mois', icon: <CalendarDays className="w-4 h-4 text-yellow-500" />, badge: 'Planifié', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'within_year', label: '> 3 mois', desc: 'Dans l\'année', icon: <CalendarRange className="w-4 h-4 text-blue-500" />, badge: 'Flexible', color: 'bg-blue-100 text-blue-800' },
  { value: 'planning', label: 'En étude', desc: 'Pas de date', icon: <Calendar className="w-4 h-4 text-gray-500" />, badge: 'Étude', color: 'bg-gray-100 text-gray-800' },
];

// Jours de la semaine
const WEEKDAYS = [
  { value: 'monday', label: 'Lun' },
  { value: 'tuesday', label: 'Mar' },
  { value: 'wednesday', label: 'Mer' },
  { value: 'thursday', label: 'Jeu' },
  { value: 'friday', label: 'Ven' },
  { value: 'saturday', label: 'Sam' },
];

// Contraintes chantier
const SITE_CONSTRAINTS = [
  'Voisinage sensible au bruit',
  'Accès limité (sans ascenseur)',
  'Stationnement difficile',
  'Site occupé pendant travaux',
  'Horaires restreints',
  'Zone piétonne / restreinte',
];

export function StepB2BWorksPlanning({
  project,
  answers,
  onAnswerChange,
  isProcessing,
}: StepComponentProps) {
  const workProject = (project.workProject || {}) as Record<string, unknown>;
  const general = (workProject.general || {}) as Record<string, unknown>;
  const constraints = (workProject.constraints || {}) as Record<string, unknown>;
  const temporal = (constraints.temporal || {}) as Record<string, unknown>;
  const physical = (constraints.physical || {}) as Record<string, unknown>;

  const getValue = (path: string) => {
    return answers[`workProject.${path}`] ?? getNestedValue(workProject, path) ?? '';
  };

  const urgencyLevel = getValue('constraints.temporal.urgencyLevel') as string;
  const accessDays = (getValue('constraints.physical.accessDays') as string[]) || [];
  const specificConstraints = (getValue('constraints.physical.specificConstraints') as string[]) || [];

  return (
    <div className="space-y-6">
      {/* Description du projet */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Description du projet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Titre du projet</Label>
            <Input
              value={getValue('general.title') as string}
              onChange={(e) => onAnswerChange('workProject.general.title', e.target.value)}
              placeholder="Ex: Rénovation complète appartement T3"
              disabled={isProcessing}
            />
          </div>
          <div className="space-y-2">
            <Label>Description des travaux</Label>
            <Textarea
              value={getValue('general.description') as string}
              onChange={(e) => onAnswerChange('workProject.general.description', e.target.value)}
              placeholder="Décrivez les travaux à réaliser : objectifs, périmètre, contraintes particulières..."
              rows={4}
              disabled={isProcessing}
            />
          </div>
        </CardContent>
      </Card>

      {/* Délais */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Délais
          </CardTitle>
          <CardDescription>Quand souhaitez-vous démarrer les travaux ?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={urgencyLevel}
            onValueChange={(v) => onAnswerChange('workProject.constraints.temporal.urgencyLevel', v)}
            className="grid grid-cols-2 md:grid-cols-5 gap-2"
          >
            {URGENCY_LEVELS.map((level) => (
              <label
                key={level.value}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all text-center
                  ${urgencyLevel === level.value ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'}`}
              >
                <RadioGroupItem value={level.value} className="sr-only" />
                {level.icon}
                <span className="font-medium text-sm">{level.label}</span>
                <Badge className={level.color}>{level.badge}</Badge>
              </label>
            ))}
          </RadioGroup>

          {urgencyLevel === 'emergency' && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Interventions urgentes : surcoût de 15-30% et disponibilité réduite.
              </AlertDescription>
            </Alert>
          )}

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <Label>Date souhaitée de démarrage</Label>
              <Input
                type="date"
                value={getValue('constraints.temporal.desiredStartDate') as string}
                onChange={(e) => onAnswerChange('workProject.constraints.temporal.desiredStartDate', e.target.value)}
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <Label>Date limite de fin (si applicable)</Label>
              <Input
                type="date"
                value={getValue('constraints.temporal.deadlineDate') as string}
                onChange={(e) => onAnswerChange('workProject.constraints.temporal.deadlineDate', e.target.value)}
                disabled={isProcessing}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accès chantier */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Accès chantier
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Jours */}
          <div className="space-y-2">
            <Label>Jours d'accès possibles</Label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => {
                const isSelected = accessDays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => {
                      const updated = isSelected
                        ? accessDays.filter(d => d !== day.value)
                        : [...accessDays, day.value];
                      onAnswerChange('workProject.constraints.physical.accessDays', updated);
                    }}
                    className={`px-4 py-2 rounded-lg border-2 font-medium transition-all
                      ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted hover:border-primary/50'}`}
                    disabled={isProcessing}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Horaires */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Heure de début</Label>
              <Input
                type="time"
                value={getValue('constraints.physical.accessTimeStart') as string || '08:00'}
                onChange={(e) => onAnswerChange('workProject.constraints.physical.accessTimeStart', e.target.value)}
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <Label>Heure de fin</Label>
              <Input
                type="time"
                value={getValue('constraints.physical.accessTimeEnd') as string || '18:00'}
                onChange={(e) => onAnswerChange('workProject.constraints.physical.accessTimeEnd', e.target.value)}
                disabled={isProcessing}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contraintes */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-primary" />
            Contraintes particulières
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {SITE_CONSTRAINTS.map((constraint) => (
              <label key={constraint} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-muted/50">
                <Checkbox
                  checked={specificConstraints.includes(constraint)}
                  onCheckedChange={(checked) => {
                    const updated = checked
                      ? [...specificConstraints, constraint]
                      : specificConstraints.filter(c => c !== constraint);
                    onAnswerChange('workProject.constraints.physical.specificConstraints', updated);
                  }}
                  disabled={isProcessing}
                />
                <span className="text-sm">{constraint}</span>
              </label>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Autres contraintes</Label>
            <Textarea
              value={getValue('constraints.physical.notes') as string}
              onChange={(e) => onAnswerChange('workProject.constraints.physical.notes', e.target.value)}
              placeholder="Précisez toute contrainte particulière : accès spécifique, coordination nécessaire..."
              rows={2}
              disabled={isProcessing}
            />
          </div>
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Ces informations permettront d'estimer précisément les délais et d'identifier
          les entreprises adaptées à vos contraintes.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, part) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
    return undefined;
  }, obj);
}

export default StepB2BWorksPlanning;

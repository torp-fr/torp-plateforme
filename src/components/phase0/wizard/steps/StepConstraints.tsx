/**
 * Étape 5 - Contraintes et budget
 * Collecte les contraintes temporelles, d'occupation et le budget
 */

import React from 'react';
import { StepComponentProps } from '../WizardContainer';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Calendar, Clock, Home, Euro, CreditCard, AlertTriangle, Info, Sparkles
} from 'lucide-react';

const OCCUPANCY_OPTIONS = [
  { value: 'vacant', label: 'Logement vacant', description: 'Le bien sera vide pendant les travaux' },
  { value: 'occupied_full', label: 'Occupé en permanence', description: 'Vous habiterez sur place' },
  { value: 'occupied_partial', label: 'Occupation partielle', description: 'Présence occasionnelle' },
  { value: 'flexible', label: 'Flexible', description: 'À discuter selon les phases' },
];

const FUNDING_OPTIONS = [
  { value: 'personal_funds', label: 'Fonds propres', description: 'Épargne personnelle' },
  { value: 'bank_loan', label: 'Prêt bancaire', description: 'Crédit immobilier ou travaux' },
  { value: 'mixed', label: 'Financement mixte', description: 'Apport + crédit' },
  { value: 'subsidies', label: 'Aides et subventions', description: 'MaPrimeRénov\', CEE...' },
];

const FINISH_LEVELS = [
  { value: 'basic', label: 'Basique', description: 'Fonctionnel et économique', multiplier: '0.8x' },
  { value: 'standard', label: 'Standard', description: 'Bon rapport qualité/prix', multiplier: '1x' },
  { value: 'premium', label: 'Premium', description: 'Matériaux et finitions haut de gamme', multiplier: '1.3x' },
  { value: 'luxury', label: 'Luxe', description: 'Excellence et sur-mesure', multiplier: '1.6x' },
];

const BUDGET_RANGES = [
  { min: 0, max: 10000, label: 'Moins de 10 000 €' },
  { min: 10000, max: 25000, label: '10 000 € - 25 000 €' },
  { min: 25000, max: 50000, label: '25 000 € - 50 000 €' },
  { min: 50000, max: 100000, label: '50 000 € - 100 000 €' },
  { min: 100000, max: 200000, label: '100 000 € - 200 000 €' },
  { min: 200000, max: 500000, label: '200 000 € - 500 000 €' },
  { min: 500000, max: 1000000, label: 'Plus de 500 000 €' },
];

export function StepConstraints({
  project,
  answers,
  onAnswerChange,
  onAnswersChange,
  errors,
  isProcessing,
}: StepComponentProps) {
  const workProject = (project.workProject || {}) as Record<string, unknown>;
  const constraints = (workProject.constraints || {}) as Record<string, unknown>;
  const temporal = (constraints.temporal || {}) as Record<string, unknown>;
  const occupancy = (constraints.occupancy || {}) as Record<string, unknown>;
  const physical = (constraints.physical || {}) as Record<string, unknown>;
  const budget = (workProject.budget || {}) as Record<string, unknown>;
  const quality = (workProject.quality || {}) as Record<string, unknown>;

  const getValue = (path: string, defaultValue: unknown = '') => {
    const answerValue = answers[`workProject.${path}`];
    if (answerValue !== undefined) return answerValue;

    const parts = path.split('.');
    let current: unknown = workProject;
    for (const part of parts) {
      if (current && typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return defaultValue;
      }
    }
    return current ?? defaultValue;
  };

  // Calculer une date minimale (aujourd'hui + 1 mois)
  const minStartDate = new Date();
  minStartDate.setMonth(minStartDate.getMonth() + 1);
  const minStartDateStr = minStartDate.toISOString().split('T')[0];

  return (
    <div className="space-y-8">
      {/* Contraintes temporelles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Planning
          </CardTitle>
          <CardDescription>
            Définissez vos contraintes de dates pour le projet
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="desiredStartDate">Date de début souhaitée</Label>
              <Input
                id="desiredStartDate"
                type="date"
                min={minStartDateStr}
                value={(getValue('constraints.temporal.desiredStartDate') as string) || ''}
                onChange={(e) => onAnswerChange('workProject.constraints.temporal.desiredStartDate', e.target.value)}
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deadlineDate">Date limite (si applicable)</Label>
              <Input
                id="deadlineDate"
                type="date"
                min={minStartDateStr}
                value={(getValue('constraints.temporal.deadlineDate') as string) || ''}
                onChange={(e) => onAnswerChange('workProject.constraints.temporal.deadlineDate', e.target.value)}
                disabled={isProcessing}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxDuration">Durée maximale souhaitée (mois)</Label>
            <Select
              value={(getValue('constraints.temporal.maxDurationMonths') as string) || ''}
              onValueChange={(value) => onAnswerChange('workProject.constraints.temporal.maxDurationMonths', parseInt(value))}
              disabled={isProcessing}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pas de limite" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 mois maximum</SelectItem>
                <SelectItem value="2">2 mois maximum</SelectItem>
                <SelectItem value="3">3 mois maximum</SelectItem>
                <SelectItem value="6">6 mois maximum</SelectItem>
                <SelectItem value="12">12 mois maximum</SelectItem>
                <SelectItem value="24">Plus de 12 mois</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="isUrgent"
              checked={getValue('constraints.temporal.isUrgent', false) as boolean}
              onCheckedChange={(checked) => onAnswerChange('workProject.constraints.temporal.isUrgent', checked)}
              disabled={isProcessing}
            />
            <Label htmlFor="isUrgent" className="cursor-pointer">
              Travaux urgents (+ 15% environ)
            </Label>
          </div>

          <div className="space-y-2">
            <Label>Périodes à éviter</Label>
            <div className="flex flex-wrap gap-2">
              {['Vacances scolaires', 'Été (juillet-août)', 'Fin d\'année', 'Fêtes'].map((period) => {
                const avoidPeriods = (getValue('constraints.temporal.avoidPeriods', []) as string[]) || [];
                return (
                  <label key={period} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={avoidPeriods.includes(period)}
                      onCheckedChange={(checked) => {
                        const updated = checked
                          ? [...avoidPeriods, period]
                          : avoidPeriods.filter(p => p !== period);
                        onAnswerChange('workProject.constraints.temporal.avoidPeriods', updated);
                      }}
                      disabled={isProcessing}
                    />
                    <span className="text-sm">{period}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contraintes d'occupation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Home className="w-5 h-5 text-primary" />
            Occupation du bien
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={(getValue('constraints.occupancy.duringWorks') as string) || ''}
            onValueChange={(value) => onAnswerChange('workProject.constraints.occupancy.duringWorks', value)}
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            {OCCUPANCY_OPTIONS.map((option) => (
              <label
                key={option.value}
                htmlFor={`occupancy-${option.value}`}
                className={`
                  flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
                  ${getValue('constraints.occupancy.duringWorks') === option.value
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-primary/50'
                  }
                `}
              >
                <RadioGroupItem
                  value={option.value}
                  id={`occupancy-${option.value}`}
                  className="mt-0.5"
                />
                <div>
                  <span className="font-medium">{option.label}</span>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </div>
              </label>
            ))}
          </RadioGroup>

          {getValue('constraints.occupancy.duringWorks') === 'occupied_full' && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                L'occupation pendant les travaux peut rallonger les délais et nécessiter une organisation par phases.
                Prévoyez des aménagements temporaires si nécessaire.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Contraintes d'accès */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Accès et contraintes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Contraintes d'accès au chantier</Label>
            <div className="flex flex-wrap gap-2">
              {[
                'Accès difficile (étage sans ascenseur)',
                'Stationnement limité',
                'Rue étroite',
                'Zone piétonne',
                'Horaires restreints',
                'Voisinage sensible',
              ].map((constraint) => {
                const accessConstraints = (getValue('constraints.physical.accessConstraints', []) as string[]) || [];
                return (
                  <label key={constraint} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={accessConstraints.includes(constraint)}
                      onCheckedChange={(checked) => {
                        const updated = checked
                          ? [...accessConstraints, constraint]
                          : accessConstraints.filter(c => c !== constraint);
                        onAnswerChange('workProject.constraints.physical.accessConstraints', updated);
                      }}
                      disabled={isProcessing}
                    />
                    <span className="text-sm">{constraint}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="otherConstraints">Autres contraintes ou remarques</Label>
            <Textarea
              id="otherConstraints"
              value={(getValue('constraints.physical.notes') as string) || ''}
              onChange={(e) => onAnswerChange('workProject.constraints.physical.notes', e.target.value)}
              placeholder="Décrivez toute contrainte particulière..."
              rows={3}
              disabled={isProcessing}
            />
          </div>
        </CardContent>
      </Card>

      {/* Budget */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Euro className="w-5 h-5 text-primary" />
            Budget
          </CardTitle>
          <CardDescription>
            Définissez votre enveloppe budgétaire pour les travaux
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Fourchette de budget */}
          <div className="space-y-2">
            <Label>Enveloppe budgétaire *</Label>
            <RadioGroup
              value={`${getValue('budget.totalEnvelope.min', '')}-${getValue('budget.totalEnvelope.max', '')}`}
              onValueChange={(value) => {
                const [min, max] = value.split('-').map(Number);
                onAnswersChange({
                  'workProject.budget.totalEnvelope.min': min,
                  'workProject.budget.totalEnvelope.max': max,
                });
              }}
              className="grid grid-cols-1 md:grid-cols-2 gap-2"
            >
              {BUDGET_RANGES.map((range) => (
                <label
                  key={`${range.min}-${range.max}`}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all
                    ${getValue('budget.totalEnvelope.min') === range.min &&
                      getValue('budget.totalEnvelope.max') === range.max
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-primary/50'
                    }
                  `}
                >
                  <RadioGroupItem value={`${range.min}-${range.max}`} />
                  <span className="text-sm font-medium">{range.label}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Ou saisie personnalisée */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budgetMin">Budget minimum (€)</Label>
              <Input
                id="budgetMin"
                type="number"
                min={0}
                step={1000}
                value={(getValue('budget.totalEnvelope.min') as number) || ''}
                onChange={(e) => onAnswerChange('workProject.budget.totalEnvelope.min', parseInt(e.target.value) || null)}
                placeholder="50000"
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budgetMax">Budget maximum (€)</Label>
              <Input
                id="budgetMax"
                type="number"
                min={0}
                step={1000}
                value={(getValue('budget.totalEnvelope.max') as number) || ''}
                onChange={(e) => onAnswerChange('workProject.budget.totalEnvelope.max', parseInt(e.target.value) || null)}
                placeholder="80000"
                disabled={isProcessing}
              />
            </div>
          </div>

          {/* Mode de financement */}
          <div className="space-y-2">
            <Label>Mode de financement</Label>
            <RadioGroup
              value={(getValue('budget.fundingMode') as string) || ''}
              onValueChange={(value) => onAnswerChange('workProject.budget.fundingMode', value)}
              className="grid grid-cols-2 gap-2"
            >
              {FUNDING_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`
                    flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all
                    ${getValue('budget.fundingMode') === option.value
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-primary/50'
                    }
                  `}
                >
                  <RadioGroupItem value={option.value} className="mt-0.5" />
                  <div>
                    <span className="text-sm font-medium">{option.label}</span>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Intérêt aides */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="interestedInAids"
              checked={getValue('budget.interestedInAids', false) as boolean}
              onCheckedChange={(checked) => onAnswerChange('workProject.budget.interestedInAids', checked)}
              disabled={isProcessing}
            />
            <Label htmlFor="interestedInAids" className="cursor-pointer">
              Je souhaite être informé des aides disponibles (MaPrimeRénov', CEE, etc.)
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Niveau de finition */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Niveau de finition souhaité
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={(getValue('quality.finishLevel') as string) || ''}
            onValueChange={(value) => onAnswerChange('workProject.quality.finishLevel', value)}
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            {FINISH_LEVELS.map((level) => (
              <label
                key={level.value}
                className={`
                  flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
                  ${getValue('quality.finishLevel') === level.value
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-primary/50'
                  }
                `}
              >
                <RadioGroupItem value={level.value} className="mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{level.label}</span>
                    <span className="text-xs text-muted-foreground">{level.multiplier}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{level.description}</p>
                </div>
              </label>
            ))}
          </RadioGroup>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Le niveau de finition impacte directement le budget. Le multiplicateur indiqué est une estimation
              par rapport au niveau standard.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}

export default StepConstraints;

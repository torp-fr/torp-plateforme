/**
 * Étape 4 - Aspects pratiques
 * Planning, accès au chantier et budget
 */

import React from 'react';
import { StepComponentProps } from '../WizardContainer';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Calendar, Clock, Home, Euro, CreditCard, AlertTriangle, Info,
  Sparkles, Zap, CalendarClock, CalendarDays, CalendarRange, HelpCircle,
  Banknote, PiggyBank, Landmark, Gift
} from 'lucide-react';

// Niveaux d'urgence du projet
const URGENCY_LEVELS = [
  {
    value: 'emergency',
    label: 'Intervention urgente',
    description: 'Sous 24-48h (dégât des eaux, panne critique...)',
    icon: <Zap className="w-5 h-5 text-red-500" />,
    badge: 'Urgence',
    badgeColor: 'bg-red-100 text-red-800',
  },
  {
    value: 'within_month',
    label: 'Dans le mois',
    description: 'Démarrage souhaité sous 4 semaines',
    icon: <CalendarClock className="w-5 h-5 text-orange-500" />,
    badge: 'Rapide',
    badgeColor: 'bg-orange-100 text-orange-800',
  },
  {
    value: 'within_quarter',
    label: 'Dans le trimestre',
    description: 'Démarrage souhaité sous 3 mois',
    icon: <CalendarDays className="w-5 h-5 text-yellow-500" />,
    badge: 'Planifié',
    badgeColor: 'bg-yellow-100 text-yellow-800',
  },
  {
    value: 'within_year',
    label: 'Dans l\'année',
    description: 'Projet à planifier dans les 12 mois',
    icon: <CalendarRange className="w-5 h-5 text-blue-500" />,
    badge: 'Flexible',
    badgeColor: 'bg-blue-100 text-blue-800',
  },
  {
    value: 'planning',
    label: 'En phase d\'étude',
    description: 'Je prépare mon projet, pas de date définie',
    icon: <Calendar className="w-5 h-5 text-gray-500" />,
    badge: 'Étude',
    badgeColor: 'bg-gray-100 text-gray-800',
  },
];

// Jours de la semaine pour accès chantier
const WEEKDAYS = [
  { value: 'monday', label: 'Lun' },
  { value: 'tuesday', label: 'Mar' },
  { value: 'wednesday', label: 'Mer' },
  { value: 'thursday', label: 'Jeu' },
  { value: 'friday', label: 'Ven' },
  { value: 'saturday', label: 'Sam' },
];

// Options d'occupation
const OCCUPANCY_OPTIONS = [
  { value: 'vacant', label: 'Logement vacant', description: 'Le bien sera vide pendant les travaux' },
  { value: 'occupied_full', label: 'Occupé en permanence', description: 'Vous habiterez sur place' },
  { value: 'occupied_partial', label: 'Occupation partielle', description: 'Présence occasionnelle' },
  { value: 'flexible', label: 'Flexible', description: 'À discuter selon les phases' },
];

// Options de financement
const FUNDING_OPTIONS = [
  {
    value: 'personal_funds',
    label: 'Fonds propres',
    description: 'Épargne personnelle',
    icon: <PiggyBank className="w-4 h-4" />,
  },
  {
    value: 'bank_loan',
    label: 'Prêt bancaire',
    description: 'Crédit immobilier ou travaux',
    icon: <Landmark className="w-4 h-4" />,
  },
  {
    value: 'mixed',
    label: 'Financement mixte',
    description: 'Apport + crédit',
    icon: <Banknote className="w-4 h-4" />,
  },
  {
    value: 'subsidies',
    label: 'Avec aides',
    description: 'MaPrimeRénov\', CEE...',
    icon: <Gift className="w-4 h-4" />,
  },
];

// Options de niveau de connaissance du budget
const BUDGET_KNOWLEDGE_OPTIONS = [
  {
    value: 'defined',
    label: 'J\'ai un budget défini',
    description: 'Je connais mon enveloppe budgétaire',
  },
  {
    value: 'estimate',
    label: 'J\'ai une estimation',
    description: 'J\'ai une idée approximative',
  },
  {
    value: 'no_idea',
    label: 'Je ne sais pas',
    description: 'J\'attends une estimation',
  },
];

// Niveaux de finition
const FINISH_LEVELS = [
  { value: 'basic', label: 'Basique', description: 'Fonctionnel et économique', multiplier: '0.8x' },
  { value: 'standard', label: 'Standard', description: 'Bon rapport qualité/prix', multiplier: '1x' },
  { value: 'premium', label: 'Premium', description: 'Matériaux haut de gamme', multiplier: '1.3x' },
  { value: 'luxury', label: 'Luxe', description: 'Excellence et sur-mesure', multiplier: '1.6x' },
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

  const budgetKnowledge = getValue('budget.knowledge', '') as string;

  return (
    <div className="space-y-4">
      {/* Urgence / Planning */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Planning du projet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <RadioGroup
            value={(getValue('constraints.temporal.urgencyLevel') as string) || ''}
            onValueChange={(value) => onAnswerChange('workProject.constraints.temporal.urgencyLevel', value)}
            className="grid grid-cols-2 md:grid-cols-3 gap-2"
          >
            {URGENCY_LEVELS.map((level) => (
              <label
                key={level.value}
                htmlFor={`urgency-${level.value}`}
                className={`
                  flex flex-col items-center gap-1 p-3 rounded-lg border-2 cursor-pointer transition-all text-center
                  ${getValue('constraints.temporal.urgencyLevel') === level.value
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-primary/50'
                  }
                `}
              >
                <RadioGroupItem
                  value={level.value}
                  id={`urgency-${level.value}`}
                  className="sr-only"
                />
                <span className="flex-shrink-0">
                  {React.cloneElement(level.icon, { className: 'w-4 h-4' })}
                </span>
                <span className="text-xs font-medium">{level.label}</span>
              </label>
            ))}
          </RadioGroup>

          {getValue('constraints.temporal.urgencyLevel') === 'emergency' && (
            <Alert variant="destructive" className="py-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Surcoûts possibles de 15 à 30% pour les interventions urgentes.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Accès au chantier */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Accès au chantier
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {/* Jours d'accès */}
          <div className="space-y-2">
            <Label className="text-xs">Jours d'accès possibles</Label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((day) => {
                const accessDays = (getValue('constraints.physical.accessDays', []) as string[]) || [];
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
                    className={`
                      px-3 py-1.5 rounded border-2 text-xs font-medium transition-all
                      ${isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted hover:border-primary/50'
                      }
                    `}
                    disabled={isProcessing}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Horaires d'accès + Contraintes inline */}
          <div className="grid grid-cols-4 gap-2">
            <div className="space-y-1">
              <Label htmlFor="accessTimeStart" className="text-xs">Début</Label>
              <Input
                id="accessTimeStart"
                type="time"
                value={(getValue('constraints.physical.accessTimeStart') as string) || '08:00'}
                onChange={(e) => onAnswerChange('workProject.constraints.physical.accessTimeStart', e.target.value)}
                disabled={isProcessing}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="accessTimeEnd" className="text-xs">Fin</Label>
              <Input
                id="accessTimeEnd"
                type="time"
                value={(getValue('constraints.physical.accessTimeEnd') as string) || '18:00'}
                onChange={(e) => onAnswerChange('workProject.constraints.physical.accessTimeEnd', e.target.value)}
                disabled={isProcessing}
                className="h-9"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Contraintes</Label>
              <div className="grid grid-cols-2 gap-1">
                {[
                  { key: 'Voisinage sensible au bruit', label: 'Bruit sensible' },
                  { key: 'Stationnement difficile', label: 'Parking difficile' },
                  { key: 'Télétravail régulier', label: 'Télétravail' },
                  { key: 'Présence d\'animaux', label: 'Animaux' },
                ].map(({ key, label }) => {
                  const constraints = (getValue('constraints.physical.specificConstraints', []) as string[]) || [];
                  return (
                    <label key={key} className="flex items-center gap-1 cursor-pointer">
                      <Checkbox
                        checked={constraints.includes(key)}
                        onCheckedChange={(checked) => {
                          const updated = checked
                            ? [...constraints, key]
                            : constraints.filter(c => c !== key);
                          onAnswerChange('workProject.constraints.physical.specificConstraints', updated);
                        }}
                        disabled={isProcessing}
                        className="h-3 w-3"
                      />
                      <span className="text-xs">{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Occupation */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Home className="w-4 h-4 text-primary" />
            Occupation du bien
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <RadioGroup
            value={(getValue('constraints.occupancy.duringWorks') as string) || ''}
            onValueChange={(value) => onAnswerChange('workProject.constraints.occupancy.duringWorks', value)}
            className="grid grid-cols-2 md:grid-cols-4 gap-2"
          >
            {OCCUPANCY_OPTIONS.map((option) => (
              <label
                key={option.value}
                htmlFor={`occupancy-${option.value}`}
                className={`
                  flex flex-col items-center gap-1 p-2 rounded-lg border-2 cursor-pointer transition-all text-center
                  ${getValue('constraints.occupancy.duringWorks') === option.value
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-primary/50'
                  }
                `}
              >
                <RadioGroupItem
                  value={option.value}
                  id={`occupancy-${option.value}`}
                  className="sr-only"
                />
                <span className="text-xs font-medium">{option.label}</span>
              </label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Budget */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Euro className="w-4 h-4 text-primary" />
            Budget prévisionnel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {/* Connaissance du budget */}
          <RadioGroup
            value={budgetKnowledge}
            onValueChange={(value) => onAnswerChange('workProject.budget.knowledge', value)}
            className="grid grid-cols-3 gap-2"
          >
            {BUDGET_KNOWLEDGE_OPTIONS.map((option) => (
              <label
                key={option.value}
                htmlFor={`budget-knowledge-${option.value}`}
                className={`
                  flex flex-col items-center gap-1 p-2 rounded-lg border-2 cursor-pointer transition-all text-center
                  ${budgetKnowledge === option.value
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-primary/50'
                  }
                `}
              >
                <RadioGroupItem
                  value={option.value}
                  id={`budget-knowledge-${option.value}`}
                  className="sr-only"
                />
                <span className="text-xs font-medium">{option.label}</span>
              </label>
            ))}
          </RadioGroup>

          {/* Saisie du budget si connu */}
          {(budgetKnowledge === 'defined' || budgetKnowledge === 'estimate') && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-lg">
              <div className="space-y-1">
                <Label htmlFor="budgetMin" className="text-xs">Budget minimum (€)</Label>
                <Input
                  id="budgetMin"
                  type="number"
                  min={0}
                  step={1000}
                  value={(getValue('budget.totalEnvelope.min') as number) || ''}
                  onChange={(e) => onAnswerChange('workProject.budget.totalEnvelope.min', parseInt(e.target.value) || null)}
                  placeholder="50000"
                  disabled={isProcessing}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="budgetMax" className="text-xs">Budget maximum (€)</Label>
                <Input
                  id="budgetMax"
                  type="number"
                  min={0}
                  step={1000}
                  value={(getValue('budget.totalEnvelope.max') as number) || ''}
                  onChange={(e) => onAnswerChange('workProject.budget.totalEnvelope.max', parseInt(e.target.value) || null)}
                  placeholder="80000"
                  disabled={isProcessing}
                  className="h-9"
                />
              </div>
            </div>
          )}

          {/* Niveau de finition */}
          <div className="space-y-2">
            <Label className="text-xs">Niveau de finition souhaité</Label>
            <RadioGroup
              value={(getValue('quality.finishLevel') as string) || ''}
              onValueChange={(value) => onAnswerChange('workProject.quality.finishLevel', value)}
              className="grid grid-cols-4 gap-2"
            >
              {FINISH_LEVELS.map((level) => (
                <label
                  key={level.value}
                  className={`
                    flex flex-col items-center gap-0.5 p-2 rounded-lg border-2 cursor-pointer transition-all text-center
                    ${getValue('quality.finishLevel') === level.value
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-primary/50'
                    }
                  `}
                >
                  <RadioGroupItem value={level.value} className="sr-only" />
                  <span className="text-xs font-medium">{level.label}</span>
                  <span className="text-xs text-muted-foreground">{level.multiplier}</span>
                </label>
              ))}
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Mode de financement */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            Financement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <RadioGroup
            value={(getValue('budget.fundingMode') as string) || ''}
            onValueChange={(value) => onAnswerChange('workProject.budget.fundingMode', value)}
            className="grid grid-cols-4 gap-2"
          >
            {FUNDING_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`
                  flex flex-col items-center gap-1 p-2 rounded-lg border-2 cursor-pointer transition-all text-center
                  ${getValue('budget.fundingMode') === option.value
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-primary/50'
                  }
                `}
              >
                <RadioGroupItem value={option.value} className="sr-only" />
                <span className="text-muted-foreground">{option.icon}</span>
                <span className="text-xs font-medium">{option.label}</span>
              </label>
            ))}
          </RadioGroup>

          {/* Intérêt aides */}
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-3">
              <Checkbox
                id="interestedInAids"
                checked={getValue('budget.interestedInAids', false) as boolean}
                onCheckedChange={(checked) => onAnswerChange('workProject.budget.interestedInAids', checked)}
                disabled={isProcessing}
              />
              <Label htmlFor="interestedInAids" className="cursor-pointer text-xs text-green-800">
                Rechercher les aides disponibles (MaPrimeRénov', CEE, Éco-PTZ...)
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default StepConstraints;

/**
 * Étape 3 - Intention de travaux
 * Sélection du type de projet
 * NOTE: La sélection des lots sera intégrée dans le bilan final (standby)
 */

import React from 'react';
import { StepComponentProps } from '../WizardContainer';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Hammer, Wrench, ThermometerSun,
  Home, Building, Shield, Info
} from 'lucide-react';
import { WorkType } from '@/types/phase0/work-project.types';

const WORK_TYPE_OPTIONS: Array<{
  value: WorkType;
  label: string;
  description: string;
  example: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'renovation',
    label: 'Rénovation',
    description: 'Rénover ou moderniser un bien existant',
    example: 'Ex: Refaire la cuisine et la salle de bain, changer les sols et repeindre',
    icon: <Hammer className="w-5 h-5" />,
  },
  {
    value: 'refurbishment',
    label: 'Réhabilitation',
    description: 'Remettre aux normes un bien dégradé ou insalubre',
    example: 'Ex: Remettre aux normes un appartement ancien avec électricité vétuste et problèmes d\'humidité',
    icon: <Wrench className="w-5 h-5" />,
  },
  {
    value: 'extension',
    label: 'Extension',
    description: 'Agrandir la surface habitable',
    example: 'Ex: Ajouter une véranda, surélever la toiture, ou créer une annexe',
    icon: <Building className="w-5 h-5" />,
  },
  {
    value: 'improvement',
    label: 'Amélioration',
    description: 'Améliorer le confort ou la performance énergétique',
    example: 'Ex: Installer une pompe à chaleur, ajouter une isolation, remplacer les fenêtres',
    icon: <ThermometerSun className="w-5 h-5" />,
  },
  {
    value: 'new_construction',
    label: 'Construction neuve',
    description: 'Construire un nouveau bâtiment',
    example: 'Ex: Construction d\'une maison individuelle ou d\'un garage',
    icon: <Home className="w-5 h-5" />,
  },
  {
    value: 'maintenance',
    label: 'Entretien',
    description: 'Travaux d\'entretien courant et préventif',
    example: 'Ex: Ravalement de façade, réfection de toiture, remplacement de chaudière',
    icon: <Shield className="w-5 h-5" />,
  },
];

export function StepWorkIntent({
  project,
  answers,
  onAnswerChange,
  isProcessing,
}: StepComponentProps) {
  const workProject = (project.workProject || {}) as Record<string, unknown>;
  const scope = (workProject.scope || {}) as Record<string, unknown>;
  const general = (workProject.general || {}) as Record<string, unknown>;

  const workType = (scope.workType as WorkType) || (answers['workProject.scope.workType'] as WorkType);

  return (
    <div className="space-y-8">
      {/* Type de travaux */}
      <div className="space-y-4">
        <Label className="text-base font-medium">Type de projet *</Label>
        <p className="text-sm text-muted-foreground">
          Sélectionnez le type de travaux qui correspond le mieux à votre projet.
        </p>
        <RadioGroup
          value={workType || ''}
          onValueChange={(value) => onAnswerChange('workProject.scope.workType', value)}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {WORK_TYPE_OPTIONS.map((option) => (
            <label
              key={option.value}
              htmlFor={`work-type-${option.value}`}
              className={`
                flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
                ${workType === option.value
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-muted hover:border-primary/50'
                }
              `}
            >
              <RadioGroupItem
                value={option.value}
                id={`work-type-${option.value}`}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={workType === option.value ? 'text-primary' : 'text-muted-foreground'}>
                    {option.icon}
                  </span>
                  <span className="font-medium">{option.label}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
                <p className="text-xs text-muted-foreground/80 mt-2 italic border-l-2 border-muted pl-2">
                  {option.example}
                </p>
              </div>
            </label>
          ))}
        </RadioGroup>
      </div>

      {/* Titre et description */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Décrivez votre projet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="projectTitle">Titre du projet (optionnel)</Label>
            <Input
              id="projectTitle"
              value={(general.title as string) || (answers['workProject.general.title'] as string) || ''}
              onChange={(e) => onAnswerChange('workProject.general.title', e.target.value)}
              placeholder="Ex: Rénovation complète appartement 3 pièces"
              disabled={isProcessing}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="projectDescription">Description (optionnel)</Label>
            <Textarea
              id="projectDescription"
              value={(general.description as string) || (answers['workProject.general.description'] as string) || ''}
              onChange={(e) => onAnswerChange('workProject.general.description', e.target.value)}
              placeholder="Décrivez votre projet en quelques lignes : vos objectifs, ce que vous souhaitez améliorer..."
              rows={4}
              disabled={isProcessing}
            />
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Les lots de travaux détaillés seront identifiés automatiquement lors du bilan de votre avant-projet,
          basés sur le type de travaux sélectionné et les informations de votre bien.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export default StepWorkIntent;

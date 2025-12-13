/**
 * Étape 5 - Caractéristiques du bien
 * Collecte les détails sur le bien (surface, état, année, etc.)
 * NOTE: Ces informations seront enrichies automatiquement via APIs (BAN, Cadastre, DPE, Géorisques...)
 */

import React from 'react';
import { StepComponentProps } from '../WizardContainer';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Ruler, Calendar, Layers, ThermometerSun, Home, Info, Sparkles, Database, MapPin,
  Camera, Upload, Image as ImageIcon, X, Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const CONDITION_OPTIONS = [
  { value: 'new', label: 'Neuf', description: 'Construction récente, jamais habitée' },
  { value: 'excellent', label: 'Excellent', description: 'Très bon état général, peu de travaux' },
  { value: 'good', label: 'Bon', description: 'Bon état, quelques travaux mineurs' },
  { value: 'average', label: 'Moyen', description: 'État correct, travaux de rafraîchissement' },
  { value: 'poor', label: 'Mauvais', description: 'Travaux importants nécessaires' },
  { value: 'very_poor', label: 'Très mauvais', description: 'Rénovation lourde requise' },
  { value: 'to_renovate', label: 'À rénover', description: 'Rénovation complète nécessaire' },
];

const DPE_RATINGS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

const STRUCTURE_TYPES = [
  { value: 'concrete', label: 'Béton' },
  { value: 'brick', label: 'Brique' },
  { value: 'stone', label: 'Pierre' },
  { value: 'wood', label: 'Bois' },
  { value: 'metal', label: 'Métal' },
  { value: 'mixed', label: 'Mixte' },
  { value: 'other', label: 'Autre' },
];

const HEATING_TYPES = [
  { value: 'gas', label: 'Gaz' },
  { value: 'electric', label: 'Électrique' },
  { value: 'oil', label: 'Fioul' },
  { value: 'wood', label: 'Bois / Granulés' },
  { value: 'heat_pump', label: 'Pompe à chaleur' },
  { value: 'district', label: 'Chauffage urbain' },
  { value: 'none', label: 'Aucun' },
  { value: 'other', label: 'Autre' },
];

export function StepPropertyDetails({
  project,
  answers,
  onAnswerChange,
  errors,
  isProcessing,
}: StepComponentProps) {
  const property = (project.property || {}) as Record<string, unknown>;
  const characteristics = (property.characteristics || {}) as Record<string, unknown>;
  const construction = (property.construction || {}) as Record<string, unknown>;
  const condition = (property.condition || {}) as Record<string, unknown>;
  const diagnostics = (property.diagnostics || {}) as Record<string, unknown>;
  const dpe = (diagnostics.dpe || {}) as Record<string, unknown>;
  const equipment = (property.equipment || {}) as Record<string, unknown>;
  const condo = (property.condo || {}) as Record<string, unknown>;

  const getValue = (path: string, defaultValue: unknown = '') => {
    const answerValue = answers[`property.${path}`];
    if (answerValue !== undefined) return answerValue;

    const parts = path.split('.');
    let current: unknown = property;
    for (const part of parts) {
      if (current && typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return defaultValue;
      }
    }
    return current ?? defaultValue;
  };

  return (
    <div className="space-y-8">
      {/* Info enrichissement automatique */}
      <Alert className="bg-blue-50 border-blue-200">
        <Database className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>Enrichissement automatique :</strong> Certaines informations seront complétées
          automatiquement à partir de l'adresse de votre bien via les bases officielles
          (Cadastre, BAN, API DPE, Géorisques, PLU...).
        </AlertDescription>
      </Alert>

      {/* Surfaces */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Ruler className="w-5 h-5 text-primary" />
            Surfaces
          </CardTitle>
          <CardDescription>
            Ces informations permettent d'estimer précisément le coût des travaux
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="livingArea">Surface habitable (m²)</Label>
              <Input
                id="livingArea"
                type="number"
                min={1}
                max={10000}
                value={getValue('characteristics.livingArea', '') as string}
                onChange={(e) => onAnswerChange('property.characteristics.livingArea', parseInt(e.target.value) || null)}
                placeholder="85"
                disabled={isProcessing}
              />
              <p className="text-xs text-muted-foreground">
                Surface de plancher, hors annexes
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="totalArea">Surface totale (m²)</Label>
              <Input
                id="totalArea"
                type="number"
                min={1}
                max={100000}
                value={getValue('characteristics.totalArea', '') as string}
                onChange={(e) => onAnswerChange('property.characteristics.totalArea', parseInt(e.target.value) || null)}
                placeholder="100"
                disabled={isProcessing}
              />
              <p className="text-xs text-muted-foreground">
                Inclut annexes, garage, cave...
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="roomCount">Pièces</Label>
              <Input
                id="roomCount"
                type="number"
                min={1}
                max={50}
                value={getValue('characteristics.roomCount', '') as string}
                onChange={(e) => onAnswerChange('property.characteristics.roomCount', parseInt(e.target.value) || null)}
                placeholder="4"
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bedroomCount">Chambres</Label>
              <Input
                id="bedroomCount"
                type="number"
                min={0}
                max={20}
                value={getValue('characteristics.bedroomCount', '') as string}
                onChange={(e) => onAnswerChange('property.characteristics.bedroomCount', parseInt(e.target.value) || null)}
                placeholder="3"
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bathroomCount">SdB / Sdd</Label>
              <Input
                id="bathroomCount"
                type="number"
                min={0}
                max={10}
                value={getValue('characteristics.bathroomCount', '') as string}
                onChange={(e) => onAnswerChange('property.characteristics.bathroomCount', parseInt(e.target.value) || null)}
                placeholder="1"
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="floorCount">Niveaux</Label>
              <Input
                id="floorCount"
                type="number"
                min={1}
                max={10}
                value={getValue('characteristics.floorCount', '') as string}
                onChange={(e) => onAnswerChange('property.characteristics.floorCount', parseInt(e.target.value) || null)}
                placeholder="2"
                disabled={isProcessing}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Construction */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Construction
            <Badge variant="outline" className="ml-2 text-xs">
              <Sparkles className="w-3 h-3 mr-1" />
              Auto-remplissage
            </Badge>
          </CardTitle>
          <CardDescription>
            Ces informations peuvent être récupérées automatiquement via le cadastre
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="yearBuilt">Année de construction</Label>
              <Input
                id="yearBuilt"
                type="number"
                min={1800}
                max={new Date().getFullYear()}
                value={getValue('construction.yearBuilt', '') as string}
                onChange={(e) => onAnswerChange('property.construction.yearBuilt', parseInt(e.target.value) || null)}
                placeholder="1970"
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="structureType">Type de structure</Label>
              <Select
                value={getValue('construction.structureType', '') as string}
                onValueChange={(value) => onAnswerChange('property.construction.structureType', value)}
                disabled={isProcessing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez..." />
                </SelectTrigger>
                <SelectContent>
                  {STRUCTURE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* État général */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Home className="w-5 h-5 text-primary" />
            État général
          </CardTitle>
          <CardDescription>
            Évaluez l'état actuel du bien pour mieux cibler les travaux
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={getValue('condition.overallState', '') as string}
            onValueChange={(value) => onAnswerChange('property.condition.overallState', value)}
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            {CONDITION_OPTIONS.map((option) => (
              <label
                key={option.value}
                htmlFor={`condition-${option.value}`}
                className={`
                  flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
                  ${getValue('condition.overallState') === option.value
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-primary/50'
                  }
                `}
              >
                <RadioGroupItem
                  value={option.value}
                  id={`condition-${option.value}`}
                  className="mt-0.5"
                />
                <div>
                  <span className="font-medium">{option.label}</span>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </div>
              </label>
            ))}
          </RadioGroup>

          <div className="space-y-2">
            <Label htmlFor="lastRenovation">Dernière rénovation (optionnel)</Label>
            <Input
              id="lastRenovation"
              type="number"
              min={1900}
              max={new Date().getFullYear()}
              value={getValue('condition.lastRenovation', '') as string}
              onChange={(e) => onAnswerChange('property.condition.lastRenovation', parseInt(e.target.value) || null)}
              placeholder="2015"
              disabled={isProcessing}
            />
          </div>
        </CardContent>
      </Card>

      {/* Performance énergétique */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ThermometerSun className="w-5 h-5 text-primary" />
            Performance énergétique
            <Badge variant="outline" className="ml-2 text-xs">
              <Sparkles className="w-3 h-3 mr-1" />
              API DPE/ADEME
            </Badge>
          </CardTitle>
          <CardDescription>
            Ces informations peuvent être récupérées automatiquement via l'API DPE de l'ADEME
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Classe DPE (si connue)</Label>
            <div className="flex flex-wrap gap-2">
              {DPE_RATINGS.map((rating) => {
                const colors: Record<string, string> = {
                  A: 'bg-green-500',
                  B: 'bg-lime-500',
                  C: 'bg-yellow-400',
                  D: 'bg-amber-400',
                  E: 'bg-orange-400',
                  F: 'bg-orange-500',
                  G: 'bg-red-500',
                };
                const isSelected = getValue('diagnostics.dpe.rating') === rating;

                return (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => onAnswerChange('property.diagnostics.dpe.rating', rating)}
                    className={`
                      w-10 h-10 rounded-lg font-bold text-white transition-all
                      ${colors[rating]}
                      ${isSelected ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'opacity-70 hover:opacity-100'}
                    `}
                    disabled={isProcessing}
                  >
                    {rating}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => onAnswerChange('property.diagnostics.dpe.rating', null)}
                className={`
                  px-3 h-10 rounded-lg border-2 text-sm transition-all
                  ${!getValue('diagnostics.dpe.rating')
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-primary/50'
                  }
                `}
                disabled={isProcessing}
              >
                Je ne sais pas
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="heatingType">Type de chauffage</Label>
            <Select
              value={getValue('equipment.heating.type', '') as string}
              onValueChange={(value) => onAnswerChange('property.equipment.heating.type', value)}
              disabled={isProcessing}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez..." />
              </SelectTrigger>
              <SelectContent>
                {HEATING_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="hasDoubleGlazing"
                checked={getValue('equipment.windows.doubleGlazing', false) as boolean}
                onCheckedChange={(checked) => onAnswerChange('property.equipment.windows.doubleGlazing', checked)}
                disabled={isProcessing}
              />
              <Label htmlFor="hasDoubleGlazing" className="cursor-pointer">
                Double vitrage installé
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="hasInsulation"
                checked={getValue('construction.hasInsulation', false) as boolean}
                onCheckedChange={(checked) => onAnswerChange('property.construction.hasInsulation', checked)}
                disabled={isProcessing}
              />
              <Label htmlFor="hasInsulation" className="cursor-pointer">
                Isolation thermique récente
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Copropriété */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Copropriété
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="isInCondo"
              checked={getValue('condo.isInCondo', false) as boolean}
              onCheckedChange={(checked) => onAnswerChange('property.condo.isInCondo', checked)}
              disabled={isProcessing}
            />
            <Label htmlFor="isInCondo" className="cursor-pointer">
              Le bien est en copropriété
            </Label>
          </div>

          {getValue('condo.isInCondo') && (
            <div className="pl-6 space-y-4 border-l-2 border-muted ml-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="floorNumber">Étage du bien</Label>
                  <Input
                    id="floorNumber"
                    type="number"
                    min={-3}
                    max={50}
                    value={getValue('condo.floorNumber', '') as string}
                    onChange={(e) => onAnswerChange('property.condo.floorNumber', parseInt(e.target.value))}
                    placeholder="3"
                    disabled={isProcessing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="totalFloors">Nombre d'étages de l'immeuble</Label>
                  <Input
                    id="totalFloors"
                    type="number"
                    min={1}
                    max={50}
                    value={getValue('condo.totalFloors', '') as string}
                    onChange={(e) => onAnswerChange('property.condo.totalFloors', parseInt(e.target.value))}
                    placeholder="5"
                    disabled={isProcessing}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="hasElevator"
                  checked={getValue('condo.hasElevator', false) as boolean}
                  onCheckedChange={(checked) => onAnswerChange('property.condo.hasElevator', checked)}
                  disabled={isProcessing}
                />
                <Label htmlFor="hasElevator" className="cursor-pointer">
                  Présence d'un ascenseur
                </Label>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Les travaux en copropriété peuvent nécessiter l'accord du syndic
                  pour certaines interventions (parties communes, façade...).
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Photos du bien (optionnel) */}
      <Card>
        <Collapsible>
          <CardHeader className="pb-3">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 -mx-4 px-4 py-2 rounded-lg transition-colors">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Camera className="w-5 h-5 text-primary" />
                  Photos du bien
                  <Badge variant="outline" className="ml-2 text-xs">Optionnel</Badge>
                </CardTitle>
                <Button variant="ghost" size="sm">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </CollapsibleTrigger>
            <CardDescription>
              Ajoutez des photos pour faciliter l'analyse de votre projet
            </CardDescription>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 bg-muted/50 rounded-full">
                    <ImageIcon className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Glissez vos photos ici</p>
                    <p className="text-sm text-muted-foreground">
                      ou cliquez pour sélectionner des fichiers
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      JPG, PNG ou WebP • Max 10 Mo par photo
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={isProcessing}>
                      <Upload className="w-4 h-4 mr-2" />
                      Parcourir
                    </Button>
                    <Button variant="outline" size="sm" disabled={isProcessing}>
                      <Camera className="w-4 h-4 mr-2" />
                      Prendre une photo
                    </Button>
                  </div>
                </div>
              </div>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Les photos aident à mieux comprendre l'état actuel du bien et à identifier
                  les travaux nécessaires. Vous pourrez en ajouter plus tard.
                </AlertDescription>
              </Alert>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Info APIs */}
      <Alert>
        <MapPin className="h-4 w-4" />
        <AlertDescription>
          <strong>Sources de données :</strong> BAN (adresse), Cadastre (parcelle, surface),
          Géorisques (risques naturels), API DPE ADEME (diagnostic énergétique),
          PLU (urbanisme, secteur ABF).
        </AlertDescription>
      </Alert>
    </div>
  );
}

export default StepPropertyDetails;

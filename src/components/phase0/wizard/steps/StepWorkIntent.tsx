/**
 * Étape 4 - Intention de travaux
 * Sélection du type de projet et des lots
 */

import React, { useState, useMemo } from 'react';
import { StepComponentProps } from '../WizardContainer';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Hammer, Wrench, Paintbrush, Zap, Droplet, ThermometerSun,
  Home, Building, Trees, Shield, Lightbulb, ChevronDown, ChevronUp, Info
} from 'lucide-react';
import { WorkType } from '@/types/phase0/work-project.types';
import { LotType, LotCategory, LOT_CATALOG, LotDefinition } from '@/types/phase0/lots.types';
import { LotService } from '@/services/phase0/lot.service';

const WORK_TYPE_OPTIONS: Array<{
  value: WorkType;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'renovation',
    label: 'Rénovation',
    description: 'Rénover ou moderniser un bien existant',
    icon: <Hammer className="w-5 h-5" />,
  },
  {
    value: 'refurbishment',
    label: 'Réhabilitation',
    description: 'Remettre aux normes un bien dégradé',
    icon: <Wrench className="w-5 h-5" />,
  },
  {
    value: 'extension',
    label: 'Extension',
    description: 'Agrandir la surface habitable',
    icon: <Building className="w-5 h-5" />,
  },
  {
    value: 'improvement',
    label: 'Amélioration',
    description: 'Améliorer le confort ou la performance',
    icon: <ThermometerSun className="w-5 h-5" />,
  },
  {
    value: 'new_construction',
    label: 'Construction neuve',
    description: 'Construire un nouveau bâtiment',
    icon: <Home className="w-5 h-5" />,
  },
  {
    value: 'maintenance',
    label: 'Entretien',
    description: 'Travaux d\'entretien courant',
    icon: <Shield className="w-5 h-5" />,
  },
];

const CATEGORY_INFO: Record<LotCategory, { label: string; icon: React.ReactNode; color: string }> = {
  gros_oeuvre: { label: 'Gros œuvre', icon: <Hammer className="w-4 h-4" />, color: 'bg-orange-100 text-orange-800' },
  second_oeuvre: { label: 'Second œuvre', icon: <Wrench className="w-4 h-4" />, color: 'bg-blue-100 text-blue-800' },
  technique: { label: 'Lots techniques', icon: <Zap className="w-4 h-4" />, color: 'bg-yellow-100 text-yellow-800' },
  finitions: { label: 'Finitions', icon: <Paintbrush className="w-4 h-4" />, color: 'bg-purple-100 text-purple-800' },
  exterieur: { label: 'Extérieur', icon: <Trees className="w-4 h-4" />, color: 'bg-green-100 text-green-800' },
  specifique: { label: 'Spécifique', icon: <Lightbulb className="w-4 h-4" />, color: 'bg-pink-100 text-pink-800' },
};

export function StepWorkIntent({
  project,
  answers,
  onAnswerChange,
  onAnswersChange,
  errors,
  isProcessing,
}: StepComponentProps) {
  const workProject = (project.workProject || {}) as Record<string, unknown>;
  const scope = (workProject.scope || {}) as Record<string, unknown>;
  const general = (workProject.general || {}) as Record<string, unknown>;

  const [expandedCategories, setExpandedCategories] = useState<Set<LotCategory>>(
    new Set(['technique', 'finitions'])
  );

  const workType = (scope.workType as WorkType) || (answers['workProject.scope.workType'] as WorkType);

  // Lots sélectionnés
  const selectedLots = useMemo(() => {
    const selected = (answers['selectedLots'] as LotType[]) || [];
    return new Set(selected);
  }, [answers]);

  // Grouper les lots par catégorie
  const lotsByCategory = useMemo(() => {
    const grouped: Record<LotCategory, LotDefinition[]> = {
      gros_oeuvre: [],
      second_oeuvre: [],
      technique: [],
      finitions: [],
      exterieur: [],
      specifique: [],
    };

    LOT_CATALOG.forEach((lot) => {
      grouped[lot.category].push(lot);
    });

    return grouped;
  }, []);

  // Toggle une catégorie
  const toggleCategory = (category: LotCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Toggle un lot
  const toggleLot = (lotType: LotType) => {
    const current = Array.from(selectedLots);
    const updated = selectedLots.has(lotType)
      ? current.filter((l) => l !== lotType)
      : [...current, lotType];
    onAnswerChange('selectedLots', updated);
  };

  // Sélectionner tous les lots d'une catégorie
  const selectAllInCategory = (category: LotCategory) => {
    const categoryLots = lotsByCategory[category].map((l) => l.type);
    const current = Array.from(selectedLots);
    const allSelected = categoryLots.every((l) => selectedLots.has(l));

    if (allSelected) {
      // Désélectionner tous
      const updated = current.filter((l) => !categoryLots.includes(l));
      onAnswerChange('selectedLots', updated);
    } else {
      // Sélectionner tous
      const updated = [...new Set([...current, ...categoryLots])];
      onAnswerChange('selectedLots', updated);
    }
  };

  // Vérifier la compatibilité
  const compatibility = useMemo(() => {
    return LotService.checkLotCompatibility(Array.from(selectedLots));
  }, [selectedLots]);

  // Suggestions de lots complémentaires
  const suggestions = useMemo(() => {
    return LotService.suggestComplementaryLots(Array.from(selectedLots));
  }, [selectedLots]);

  return (
    <div className="space-y-8">
      {/* Type de travaux */}
      <div className="space-y-4">
        <Label className="text-base font-medium">Type de projet *</Label>
        <RadioGroup
          value={workType || ''}
          onValueChange={(value) => onAnswerChange('workProject.scope.workType', value)}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          {WORK_TYPE_OPTIONS.map((option) => (
            <label
              key={option.value}
              htmlFor={`work-type-${option.value}`}
              className={`
                flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
                ${workType === option.value
                  ? 'border-primary bg-primary/5'
                  : 'border-muted hover:border-primary/50'
                }
              `}
            >
              <RadioGroupItem
                value={option.value}
                id={`work-type-${option.value}`}
                className="mt-0.5"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className={workType === option.value ? 'text-primary' : 'text-muted-foreground'}>
                    {option.icon}
                  </span>
                  <span className="font-medium">{option.label}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
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
            <Label htmlFor="projectTitle">Titre du projet *</Label>
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

      {/* Sélection des lots */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lots de travaux</CardTitle>
          <CardDescription>
            Sélectionnez les types de travaux concernés par votre projet.
            {selectedLots.size > 0 && (
              <Badge variant="secondary" className="ml-2">
                {selectedLots.size} lot(s) sélectionné(s)
              </Badge>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Liste par catégorie */}
          <div className="space-y-3">
            {(Object.keys(lotsByCategory) as LotCategory[]).map((category) => {
              const categoryInfo = CATEGORY_INFO[category];
              const lots = lotsByCategory[category];
              const isExpanded = expandedCategories.has(category);
              const selectedInCategory = lots.filter((l) => selectedLots.has(l.type)).length;

              return (
                <div key={category} className="border rounded-lg">
                  {/* En-tête de catégorie */}
                  <button
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Badge className={categoryInfo.color}>
                        {categoryInfo.icon}
                        <span className="ml-1">{categoryInfo.label}</span>
                      </Badge>
                      {selectedInCategory > 0 && (
                        <Badge variant="secondary">
                          {selectedInCategory}/{lots.length}
                        </Badge>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>

                  {/* Liste des lots */}
                  {isExpanded && (
                    <div className="border-t p-4 space-y-3">
                      {/* Bouton tout sélectionner */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => selectAllInCategory(category)}
                      >
                        {lots.every((l) => selectedLots.has(l.type))
                          ? 'Tout désélectionner'
                          : 'Tout sélectionner'}
                      </Button>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {lots.map((lot) => (
                          <label
                            key={lot.type}
                            className={`
                              flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all
                              ${selectedLots.has(lot.type)
                                ? 'border-primary bg-primary/5'
                                : 'border-muted hover:border-primary/50'
                              }
                            `}
                          >
                            <Checkbox
                              checked={selectedLots.has(lot.type)}
                              onCheckedChange={() => toggleLot(lot.type)}
                              disabled={isProcessing}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">
                                  {lot.number}. {lot.name}
                                </span>
                                {lot.rgeEligible && (
                                  <Badge variant="outline" className="text-xs">
                                    RGE
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {lot.description}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Alertes et suggestions */}
      {(compatibility.warnings.length > 0 || suggestions.length > 0) && (
        <div className="space-y-4">
          {/* Avertissements */}
          {compatibility.warnings.length > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Points d'attention :</strong>
                <ul className="list-disc list-inside mt-1">
                  {compatibility.warnings.map((warning, i) => (
                    <li key={i} className="text-sm">{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <Alert>
              <Lightbulb className="h-4 w-4 text-yellow-600" />
              <AlertDescription>
                <strong>Lots suggérés :</strong>
                <div className="flex flex-wrap gap-2 mt-2">
                  {suggestions.slice(0, 5).map((lotType) => {
                    const lot = LOT_CATALOG.find((l) => l.type === lotType);
                    if (!lot) return null;
                    return (
                      <Button
                        key={lotType}
                        variant="outline"
                        size="sm"
                        onClick={() => toggleLot(lotType)}
                      >
                        + {lot.name}
                      </Button>
                    );
                  })}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Conseils */}
          {compatibility.suggestions.length > 0 && (
            <Alert>
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {compatibility.suggestions.map((suggestion, i) => (
                    <li key={i} className="text-sm">{suggestion}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}

export default StepWorkIntent;

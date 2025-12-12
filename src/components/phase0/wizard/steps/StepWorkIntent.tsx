/**
 * Étape 4 - Intention de travaux
 * Sélection du type de projet et des lots
 */

import React, { useState, useMemo, useEffect } from 'react';
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
  Home, Building, Trees, Shield, Lightbulb, ChevronDown, ChevronUp, Info,
  Sparkles, CheckCircle2, Plus, Minus
} from 'lucide-react';
import { WorkType } from '@/types/phase0/work-project.types';
import { LotType, LotCategory, LOT_CATALOG, LotDefinition } from '@/types/phase0/lots.types';
import { LotService } from '@/services/phase0/lot.service';

const WORK_TYPE_OPTIONS: Array<{
  value: WorkType;
  label: string;
  description: string;
  example: string;
  icon: React.ReactNode;
  suggestedLots: LotType[];
}> = [
  {
    value: 'renovation',
    label: 'Rénovation',
    description: 'Rénover ou moderniser un bien existant',
    example: 'Ex: Refaire la cuisine et la salle de bain, changer les sols et repeindre',
    icon: <Hammer className="w-5 h-5" />,
    suggestedLots: ['demolition', 'platrerie', 'carrelage', 'peinture', 'courants_forts', 'sanitaires', 'cuisine_equipee', 'salle_bain_cle_main'],
  },
  {
    value: 'refurbishment',
    label: 'Réhabilitation',
    description: 'Remettre aux normes un bien dégradé ou insalubre',
    example: 'Ex: Remettre aux normes un appartement ancien avec électricité vétuste et problèmes d\'humidité',
    icon: <Wrench className="w-5 h-5" />,
    suggestedLots: ['demolition', 'maconnerie', 'courants_forts', 'sanitaires', 'isolation_interieure', 'platrerie', 'vmc_simple_flux', 'chauffage_central'],
  },
  {
    value: 'extension',
    label: 'Extension',
    description: 'Agrandir la surface habitable',
    example: 'Ex: Ajouter une véranda, surélever la toiture, ou créer une annexe',
    icon: <Building className="w-5 h-5" />,
    suggestedLots: ['terrassement_vrd', 'maconnerie', 'beton_arme', 'charpente_bois', 'couverture', 'menuiseries_exterieures', 'isolation_interieure', 'courants_forts'],
  },
  {
    value: 'improvement',
    label: 'Amélioration',
    description: 'Améliorer le confort ou la performance énergétique',
    example: 'Ex: Installer une pompe à chaleur, ajouter une isolation, remplacer les fenêtres',
    icon: <ThermometerSun className="w-5 h-5" />,
    suggestedLots: ['ite', 'isolation_interieure', 'menuiseries_exterieures', 'chauffage_central', 'vmc_double_flux', 'photovoltaique'],
  },
  {
    value: 'new_construction',
    label: 'Construction neuve',
    description: 'Construire un nouveau bâtiment',
    example: 'Ex: Construction d\'une maison individuelle ou d\'un garage',
    icon: <Home className="w-5 h-5" />,
    suggestedLots: ['terrassement_vrd', 'maconnerie', 'beton_arme', 'charpente_bois', 'couverture', 'menuiseries_exterieures', 'isolation_interieure', 'platrerie', 'courants_forts', 'sanitaires', 'chauffage_central', 'vmc_simple_flux'],
  },
  {
    value: 'maintenance',
    label: 'Entretien',
    description: 'Travaux d\'entretien courant et préventif',
    example: 'Ex: Ravalement de façade, réfection de toiture, remplacement de chaudière',
    icon: <Shield className="w-5 h-5" />,
    suggestedLots: ['ravalement', 'couverture', 'peinture', 'chauffage_central', 'vmc_simple_flux'],
  },
];

const CATEGORY_INFO: Record<LotCategory, { label: string; icon: React.ReactNode; color: string }> = {
  gros_oeuvre: { label: 'Gros œuvre', icon: <Hammer className="w-4 h-4" />, color: 'bg-orange-100 text-orange-800' },
  enveloppe: { label: 'Enveloppe', icon: <Home className="w-4 h-4" />, color: 'bg-amber-100 text-amber-800' },
  cloisonnement: { label: 'Cloisonnement & Isolation', icon: <Wrench className="w-4 h-4" />, color: 'bg-blue-100 text-blue-800' },
  finitions: { label: 'Finitions', icon: <Paintbrush className="w-4 h-4" />, color: 'bg-purple-100 text-purple-800' },
  electricite: { label: 'Électricité', icon: <Zap className="w-4 h-4" />, color: 'bg-yellow-100 text-yellow-800' },
  plomberie: { label: 'Plomberie', icon: <Droplet className="w-4 h-4" />, color: 'bg-cyan-100 text-cyan-800' },
  cvc: { label: 'Chauffage / Ventilation / Clim', icon: <ThermometerSun className="w-4 h-4" />, color: 'bg-red-100 text-red-800' },
  ventilation: { label: 'Ventilation', icon: <Shield className="w-4 h-4" />, color: 'bg-sky-100 text-sky-800' },
  exterieurs: { label: 'Extérieurs', icon: <Trees className="w-4 h-4" />, color: 'bg-green-100 text-green-800' },
  speciaux: { label: 'Lots spéciaux', icon: <Lightbulb className="w-4 h-4" />, color: 'bg-pink-100 text-pink-800' },
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
    new Set(['finitions', 'electricite', 'plomberie'])
  );

  const workType = (scope.workType as WorkType) || (answers['workProject.scope.workType'] as WorkType);
  const [hasAutoSuggested, setHasAutoSuggested] = useState(false);

  // Lots sélectionnés
  const selectedLots = useMemo(() => {
    const selected = (answers['selectedLots'] as LotType[]) || [];
    return new Set(selected);
  }, [answers]);

  // Lots suggérés basés sur le type de travaux
  const suggestedLots = useMemo(() => {
    if (!workType) return [];
    const workTypeOption = WORK_TYPE_OPTIONS.find(o => o.value === workType);
    return workTypeOption?.suggestedLots || [];
  }, [workType]);

  // Auto-suggérer les lots quand le type de travaux change
  useEffect(() => {
    if (workType && !hasAutoSuggested && suggestedLots.length > 0 && selectedLots.size === 0) {
      onAnswerChange('selectedLots', suggestedLots);
      setHasAutoSuggested(true);
    }
  }, [workType, suggestedLots, hasAutoSuggested, selectedLots.size, onAnswerChange]);

  // Reset auto-suggestion flag when work type changes
  useEffect(() => {
    setHasAutoSuggested(false);
  }, [workType]);

  // Grouper les lots par catégorie
  const lotsByCategory = useMemo(() => {
    const grouped: Record<LotCategory, LotDefinition[]> = {
      gros_oeuvre: [],
      enveloppe: [],
      cloisonnement: [],
      finitions: [],
      electricite: [],
      plomberie: [],
      cvc: [],
      ventilation: [],
      exterieurs: [],
      speciaux: [],
    };

    LOT_CATALOG.forEach((lot) => {
      if (grouped[lot.category]) {
        grouped[lot.category].push(lot);
      }
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

      {/* Lots de travaux identifiés */}
      <Card className={workType ? 'border-primary/30' : ''}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Lots de travaux identifiés</CardTitle>
          </div>
          <CardDescription>
            {workType ? (
              <>
                Basé sur votre type de projet, nous avons identifié les lots de travaux suivants.
                <span className="block mt-1 text-sm">
                  Vous pouvez ajuster cette sélection selon vos besoins.
                </span>
              </>
            ) : (
              'Sélectionnez un type de projet ci-dessus pour voir les lots suggérés.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Résumé des lots sélectionnés */}
          {selectedLots.size > 0 && (
            <Alert className="bg-primary/5 border-primary/20">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <AlertDescription className="flex items-center justify-between">
                <span>
                  <strong>{selectedLots.size} lot(s)</strong> de travaux sélectionné(s)
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onAnswerChange('selectedLots', [])}
                  className="text-muted-foreground hover:text-destructive"
                >
                  Tout effacer
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Lots suggérés (affichés en premier si workType sélectionné) */}
          {workType && suggestedLots.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                  Lots suggérés pour "{WORK_TYPE_OPTIONS.find(o => o.value === workType)?.label}"
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const allSuggested = suggestedLots.every(l => selectedLots.has(l));
                    if (allSuggested) {
                      const updated = Array.from(selectedLots).filter(l => !suggestedLots.includes(l));
                      onAnswerChange('selectedLots', updated);
                    } else {
                      const updated = [...new Set([...Array.from(selectedLots), ...suggestedLots])];
                      onAnswerChange('selectedLots', updated);
                    }
                  }}
                >
                  {suggestedLots.every(l => selectedLots.has(l)) ? 'Désélectionner tous' : 'Sélectionner tous'}
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {suggestedLots.map((lotType) => {
                  const lot = LOT_CATALOG.find(l => l.type === lotType);
                  if (!lot) return null;
                  const isSelected = selectedLots.has(lotType);
                  return (
                    <button
                      key={lotType}
                      type="button"
                      onClick={() => toggleLot(lotType)}
                      className={`
                        flex items-center gap-2 p-3 rounded-lg border text-left transition-all
                        ${isSelected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-muted hover:border-primary/50'
                        }
                      `}
                    >
                      {isSelected ? (
                        <Minus className="w-4 h-4 flex-shrink-0" />
                      ) : (
                        <Plus className="w-4 h-4 flex-shrink-0" />
                      )}
                      <span className="text-sm font-medium truncate">{lot.name}</span>
                      {lot.rgeEligible && (
                        <Badge variant="outline" className="text-xs ml-auto flex-shrink-0">RGE</Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Liste complète par catégorie (repliée par défaut) */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Tous les lots disponibles</Label>
            <p className="text-xs text-muted-foreground">
              Cliquez sur une catégorie pour voir tous les lots disponibles et personnaliser votre sélection.
            </p>
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
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Badge className={categoryInfo.color}>
                        {categoryInfo.icon}
                        <span className="ml-1">{categoryInfo.label}</span>
                      </Badge>
                      {selectedInCategory > 0 && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary">
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

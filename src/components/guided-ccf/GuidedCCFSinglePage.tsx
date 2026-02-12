/**
 * Guided CCF Component - Single Page Version
 * Formulaire complet sur une seule page pour créer un Cahier des Charges
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle } from 'lucide-react';

export interface CCFData {
  projectName: string;
  projectType: 'renovation' | 'neuf' | 'extension' | 'maintenance';
  scope: string;
  budget: number;
  timeline: string;
  objectives: string[];
  constraints: string[];
  successCriteria: string[];
  company?: string;
  contacts?: string;
}

interface GuidedCCFProps {
  onSubmit: (data: CCFData) => void;
  isLoading?: boolean;
}

export function GuidedCCFSinglePage({ onSubmit, isLoading = false }: GuidedCCFProps) {
  const [formData, setFormData] = useState<Partial<CCFData>>({
    projectType: 'renovation',
    timeline: '1-3-months',
    objectives: [],
    constraints: [],
    successCriteria: [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const projectTypes = [
    { value: 'renovation', label: 'Rénovation' },
    { value: 'neuf', label: 'Construction neuve' },
    { value: 'extension', label: 'Extension' },
    { value: 'maintenance', label: 'Maintenance' },
  ];

  const commonObjectives = [
    'Améliorer l\'efficacité énergétique',
    'Moderniser les installations',
    'Augmenter la surface utile',
    'Améliorer le confort',
    'Respecter les normes',
    'Réduire les coûts de fonctionnement',
  ];

  const commonConstraints = [
    'Budget limité',
    'Délai court',
    'Accès restreint au site',
    'Continuité d\'activité requise',
    'Amiante possible',
    'Bâtiment historique',
    'Zones protégées',
  ];

  const successCriteriaOptions = [
    'Respect du budget',
    'Respect de la timeline',
    'Qualité de la réalisation',
    'Conformité aux normes',
    'Satisfaction du client',
    'Performance énergétique',
  ];

  const handleInputChange = (field: keyof CCFData, value: any) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  const toggleArrayItem = (field: 'objectives' | 'constraints' | 'successCriteria', item: string) => {
    const current = formData[field] || [];
    if (current.includes(item)) {
      handleInputChange(field, current.filter(i => i !== item));
    } else {
      handleInputChange(field, [...current, item]);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.projectName?.trim()) newErrors.projectName = 'Nom du projet requis';
    if (!formData.scope?.trim()) newErrors.scope = 'Périmètre requis';
    if (!formData.budget || formData.budget <= 0) newErrors.budget = 'Budget requis (> 0)';
    if (!formData.objectives?.length) newErrors.objectives = 'Au moins 1 objectif requis';
    if (!formData.constraints?.length) newErrors.constraints = 'Au moins 1 contrainte requise';
    if (!formData.successCriteria?.length) newErrors.successCriteria = 'Au moins 1 critère de succès requis';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit(formData as CCFData);
    }
  };

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="space-y-6"
      >
        {/* Project Info Section */}
        <Card className="bg-card border-border shadow-md">
          <CardHeader>
            <CardTitle className="font-display text-foreground">Informations du projet</CardTitle>
            <CardDescription>Identifiez votre projet</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Nom du projet *
                </label>
                <Input
                  placeholder="ex: Rénovation Appartement Paris 16"
                  value={formData.projectName || ''}
                  onChange={(e) => handleInputChange('projectName', e.target.value)}
                  className={`bg-background border-border text-foreground placeholder-muted-foreground ${
                    errors.projectName ? 'border-red-500' : ''
                  }`}
                />
                {errors.projectName && (
                  <p className="text-xs text-red-500 mt-1">{errors.projectName}</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Type de projet *
                </label>
                <Select
                  value={formData.projectType}
                  onValueChange={(v) => handleInputChange('projectType', v)}
                >
                  <SelectTrigger className="bg-background border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {projectTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Entreprise/Raison sociale
                </label>
                <Input
                  placeholder="SARL Dupont BTP"
                  value={formData.company || ''}
                  onChange={(e) => handleInputChange('company', e.target.value)}
                  className="bg-background border-border text-foreground placeholder-muted-foreground"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Contact (nom/tél)
                </label>
                <Input
                  placeholder="Jean Dupont - 06 12 34 56 78"
                  value={formData.contacts || ''}
                  onChange={(e) => handleInputChange('contacts', e.target.value)}
                  className="bg-background border-border text-foreground placeholder-muted-foreground"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scope & Budget Section */}
        <Card className="bg-card border-border shadow-md">
          <CardHeader>
            <CardTitle className="font-display text-foreground">Périmètre & Budget</CardTitle>
            <CardDescription>Définissez l'étendue et le budget</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Périmètre du projet * (détaillez les travaux)
              </label>
              <Textarea
                placeholder="Décrivez ce qui doit être fait (travaux, zones, etc.)"
                value={formData.scope || ''}
                onChange={(e) => handleInputChange('scope', e.target.value)}
                rows={4}
                className={`bg-background border-border text-foreground placeholder-muted-foreground ${
                  errors.scope ? 'border-red-500' : ''
                }`}
              />
              {errors.scope && <p className="text-xs text-red-500 mt-1">{errors.scope}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Budget estimé (€) *
                </label>
                <Input
                  type="number"
                  placeholder="50000"
                  value={formData.budget || ''}
                  onChange={(e) => handleInputChange('budget', parseFloat(e.target.value))}
                  className={`bg-background border-border text-foreground placeholder-muted-foreground ${
                    errors.budget ? 'border-red-500' : ''
                  }`}
                />
                {errors.budget && <p className="text-xs text-red-500 mt-1">{errors.budget}</p>}
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Timeline souhaité *
                </label>
                <Select
                  value={formData.timeline}
                  onValueChange={(v) => handleInputChange('timeline', v)}
                >
                  <SelectTrigger className="bg-background border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1-3-months">1-3 mois</SelectItem>
                    <SelectItem value="3-6-months">3-6 mois</SelectItem>
                    <SelectItem value="6-12-months">6-12 mois</SelectItem>
                    <SelectItem value="12-plus-months">Plus de 12 mois</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Objectives Section */}
        <Card className="bg-card border-border shadow-md">
          <CardHeader>
            <CardTitle className="font-display text-foreground">Objectifs</CardTitle>
            <CardDescription>Sélectionnez au moins un objectif</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {commonObjectives.map((obj) => (
                <div key={obj} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`obj-${obj}`}
                    checked={formData.objectives?.includes(obj) || false}
                    onChange={() => toggleArrayItem('objectives', obj)}
                    className="h-4 w-4 rounded border-border bg-background cursor-pointer"
                  />
                  <label
                    htmlFor={`obj-${obj}`}
                    className="text-sm text-foreground cursor-pointer flex-1"
                  >
                    {obj}
                  </label>
                </div>
              ))}
            </div>
            {errors.objectives && <p className="text-xs text-red-500 mt-2">{errors.objectives}</p>}
          </CardContent>
        </Card>

        {/* Constraints Section */}
        <Card className="bg-card border-border shadow-md">
          <CardHeader>
            <CardTitle className="font-display text-foreground">Contraintes</CardTitle>
            <CardDescription>Sélectionnez au moins une contrainte</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {commonConstraints.map((constraint) => (
                <div key={constraint} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`constraint-${constraint}`}
                    checked={formData.constraints?.includes(constraint) || false}
                    onChange={() => toggleArrayItem('constraints', constraint)}
                    className="h-4 w-4 rounded border-border bg-background cursor-pointer"
                  />
                  <label
                    htmlFor={`constraint-${constraint}`}
                    className="text-sm text-foreground cursor-pointer flex-1"
                  >
                    {constraint}
                  </label>
                </div>
              ))}
            </div>
            {errors.constraints && (
              <p className="text-xs text-red-500 mt-2">{errors.constraints}</p>
            )}
          </CardContent>
        </Card>

        {/* Success Criteria Section */}
        <Card className="bg-card border-border shadow-md">
          <CardHeader>
            <CardTitle className="font-display text-foreground">Critères de Succès</CardTitle>
            <CardDescription>Sélectionnez au moins un critère</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {successCriteriaOptions.map((criteria) => (
                <div key={criteria} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`criteria-${criteria}`}
                    checked={formData.successCriteria?.includes(criteria) || false}
                    onChange={() => toggleArrayItem('successCriteria', criteria)}
                    className="h-4 w-4 rounded border-border bg-background cursor-pointer"
                  />
                  <label
                    htmlFor={`criteria-${criteria}`}
                    className="text-sm text-foreground cursor-pointer flex-1"
                  >
                    {criteria}
                  </label>
                </div>
              ))}
            </div>
            {errors.successCriteria && (
              <p className="text-xs text-red-500 mt-2">{errors.successCriteria}</p>
            )}
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex gap-4 pt-4">
          <Button
            type="submit"
            disabled={isLoading}
            className="flex-1 gradient-primary text-primary-foreground border-0 font-display text-base py-6"
          >
            {isLoading ? 'Création en cours...' : 'Créer le CCF & Continuer'}
          </Button>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-900">
            Tous les champs avec * sont obligatoires. Complétez le formulaire pour passer à l'étape suivante.
          </p>
        </div>
      </form>
    </div>
  );
}

export default GuidedCCFSinglePage;

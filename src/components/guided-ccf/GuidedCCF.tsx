/**
 * Guided CCF Component
 * Questionnaire interactif pour créer un Cahier des Charges Fonctionnel
 * Cadre de projet structuré pour l'analyse de devis
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
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, ChevronRight, ChevronLeft, AlertCircle, FileText, Loader } from 'lucide-react';
import type { EnrichedClientData } from '@/types/enrichment';

export interface CCFData {
  // Informations projet
  projectName: string;
  projectType: 'renovation' | 'neuf' | 'extension' | 'maintenance';
  scope: string;
  budget: number;
  timeline: string;
  objectives: string[];
  constraints: string[];
  successCriteria: string[];

  // Informations client (NEW)
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  projectAddress: {
    number?: string;
    street: string;
    postalCode: string;
    city: string;
  };

  // Données entreprise (will be auto-filled from profile later)
  company?: string;
  siret?: string;
  contacts?: string;

  // Données enrichies (AUTO-FILLED from APIs)
  enrichedData?: EnrichedClientData;
  enrichmentStatus?: 'pending' | 'in_progress' | 'completed' | 'failed';
}

interface GuidedCCFProps {
  onSubmit: (data: CCFData) => void;
  isLoading?: boolean;
}

export function GuidedCCF({ onSubmit, isLoading = false }: GuidedCCFProps) {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<Partial<CCFData>>({
    projectType: 'renovation',
    timeline: '1-3-months',
    objectives: [],
    constraints: [],
    successCriteria: [],
  });

  const steps = [
    { title: 'Infos projet', description: 'Nom et type de projet' },
    { title: 'Scope & Budget', description: 'Périmètre et budget' },
    { title: 'Timeline', description: 'Planning et délais' },
    { title: 'Objectifs', description: 'Buts du projet' },
    { title: 'Constraints', description: 'Limitations et risques' },
    { title: 'Critères succès', description: 'Définir le succès' },
    { title: 'Contact', description: 'Infos supplémentaires' },
    { title: 'Revue', description: 'Vérifier le CCF' },
  ];

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

  const handleNext = () => {
    if (step < steps.length - 1) setStep(step + 1);
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleInputChange = (field: keyof CCFData, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  const toggleArrayItem = (field: 'objectives' | 'constraints' | 'successCriteria', item: string) => {
    const current = formData[field] || [];
    if (current.includes(item)) {
      handleInputChange(field, current.filter(i => i !== item));
    } else {
      handleInputChange(field, [...current, item]);
    }
  };

  const handleSubmit = () => {
    if (
      formData.projectName &&
      formData.projectType &&
      formData.scope &&
      formData.budget &&
      formData.timeline &&
      formData.objectives?.length &&
      formData.constraints?.length &&
      formData.successCriteria?.length
    ) {
      onSubmit(formData as CCFData);
    }
  };

  const isStepValid = (): boolean => {
    switch (step) {
      case 0:
        return !!formData.projectName && !!formData.projectType;
      case 1:
        return !!formData.scope && !!formData.budget;
      case 2:
        return !!formData.timeline;
      case 3:
        return (formData.objectives?.length || 0) > 0;
      case 4:
        return (formData.constraints?.length || 0) > 0;
      case 5:
        return (formData.successCriteria?.length || 0) > 0;
      case 6:
        return true;
      case 7:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-up">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          {steps.map((s, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center">
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center font-display font-bold transition-colors ${
                  idx <= step
                    ? 'gradient-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {idx < step ? (
                  <CheckCircle2 className="h-6 w-6" />
                ) : (
                  idx + 1
                )}
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`h-1 flex-1 mx-2 mb-10 transition-colors ${
                    idx < step ? 'gradient-primary' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <Card className="bg-card border-border mb-6 shadow-md hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle className="text-2xl text-foreground font-display">{steps[step].title}</CardTitle>
          <CardDescription className="text-muted-foreground">{steps[step].description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 0: Infos projet */}
          {step === 0 && (
            <>
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Nom du projet *
                </label>
                <Input
                  placeholder="ex: Rénovation Appartement Paris 16"
                  value={formData.projectName || ''}
                  onChange={(e) => handleInputChange('projectName', e.target.value)}
                  className="bg-background border-border text-foreground placeholder-muted-foreground"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Type de projet *
                </label>
                <Select value={formData.projectType} onValueChange={(v) => handleInputChange('projectType', v)}>
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
            </>
          )}

          {/* Step 1: Scope & Budget */}
          {step === 1 && (
            <>
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Périmètre du projet *
                </label>
                <Textarea
                  placeholder="Décrivez ce qui doit être fait (travaux, zones, etc.)"
                  value={formData.scope || ''}
                  onChange={(e) => handleInputChange('scope', e.target.value)}
                  rows={4}
                  className="bg-background border-border text-foreground placeholder-muted-foreground"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Budget (€) *
                </label>
                <Input
                  type="number"
                  placeholder="50000"
                  value={formData.budget || ''}
                  onChange={(e) => handleInputChange('budget', parseFloat(e.target.value))}
                  className="bg-background border-border text-foreground placeholder-muted-foreground"
                />
              </div>
            </>
          )}

          {/* Step 2: Timeline */}
          {step === 2 && (
            <>
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Timeline souhaité *
                </label>
                <Select value={formData.timeline} onValueChange={(v) => handleInputChange('timeline', v)}>
                  <SelectTrigger className="bg-white border-slate-200 text-slate-900">
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
            </>
          )}

          {/* Step 3: Objectifs */}
          {step === 3 && (
            <>
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-4">
                  Objectifs principaux * (sélectionnez au moins 1)
                </label>
                <div className="space-y-2">
                  {commonObjectives.map((obj) => (
                    <div key={obj} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={obj}
                        checked={formData.objectives?.includes(obj) || false}
                        onChange={() => toggleArrayItem('objectives', obj)}
                        className="h-4 w-4 bg-white border-slate-300 text-cyan-600 rounded"
                      />
                      <label htmlFor={obj} className="text-sm text-foreground cursor-pointer flex-1">
                        {obj}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Objectifs personnalisés
                </label>
                <Textarea
                  placeholder="Ajoutez d'autres objectifs spécifiques à votre projet"
                  rows={2}
                  className="bg-background border-border text-foreground placeholder-muted-foreground"
                />
              </div>
            </>
          )}

          {/* Step 4: Constraints */}
          {step === 4 && (
            <>
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-4">
                  Contraintes & limitations * (sélectionnez au moins 1)
                </label>
                <div className="space-y-2">
                  {commonConstraints.map((constraint) => (
                    <div key={constraint} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={constraint}
                        checked={formData.constraints?.includes(constraint) || false}
                        onChange={() => toggleArrayItem('constraints', constraint)}
                        className="h-4 w-4 bg-white border-slate-300 text-cyan-600 rounded"
                      />
                      <label htmlFor={constraint} className="text-sm text-muted-foreground cursor-pointer flex-1">
                        {constraint}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Step 5: Success Criteria */}
          {step === 5 && (
            <>
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Critères de succès * (sélectionnez au moins 1)
                </label>
                <div className="space-y-2">
                  {[
                    'Respect du budget',
                    'Respect de la timeline',
                    'Qualité de la réalisation',
                    'Conformité aux normes',
                    'Satisfactiondu client',
                    'Performance énergétique',
                  ].map((criteria) => (
                    <div key={criteria} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={criteria}
                        checked={formData.successCriteria?.includes(criteria) || false}
                        onChange={() => toggleArrayItem('successCriteria', criteria)}
                        className="h-4 w-4 bg-white border-slate-300 text-cyan-600 rounded"
                      />
                      <label htmlFor={criteria} className="text-sm text-muted-foreground cursor-pointer flex-1">
                        {criteria}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Step 6: Contact */}
          {step === 6 && (
            <>
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Entreprise/Raison sociale
                </label>
                <Input
                  placeholder="ex: Acme SARL"
                  value={formData.company || ''}
                  onChange={(e) => handleInputChange('company', e.target.value)}
                  className="bg-background border-border text-foreground placeholder-muted-foreground"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Contact principal
                </label>
                <Input
                  placeholder="ex: Pierre Dupont, Chef de projet"
                  value={formData.contacts || ''}
                  onChange={(e) => handleInputChange('contacts', e.target.value)}
                  className="bg-background border-border text-foreground placeholder-muted-foreground"
                />
              </div>
            </>
          )}

          {/* Step 7: Review */}
          {step === 7 && (
            <>
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg space-y-3 text-sm">
                <div>
                  <span className="text-slate-600">Nom:</span>
                  <span className="text-slate-900 ml-2 font-medium">{formData.projectName}</span>
                </div>
                <div>
                  <span className="text-slate-600">Type:</span>
                  <span className="text-slate-900 ml-2 font-medium">
                    {projectTypes.find((t) => t.value === formData.projectType)?.label}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600">Budget:</span>
                  <span className="text-slate-900 ml-2 font-medium">{formData.budget}€</span>
                </div>
                <div>
                  <span className="text-slate-600">Timeline:</span>
                  <span className="text-slate-900 ml-2 font-medium">{formData.timeline}</span>
                </div>
                <div>
                  <span className="text-slate-600">Objectifs:</span>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {formData.objectives?.map((obj) => (
                      <Badge key={obj} className="bg-blue-500/20 text-blue-300 border-0">
                        {obj}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-slate-600">Constraints:</span>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {formData.constraints?.map((c) => (
                      <Badge key={c} className="bg-orange-500/20 text-orange-300 border-0">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 flex gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                <p className="text-sm text-green-300">
                  Votre CCF est complète! Cliquez sur "Finaliser" pour la figé et commencer l'analyse de devis.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between gap-4">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={step === 0}
          className="border-slate-300 text-foreground hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Précédent
        </Button>

        {step < steps.length - 1 ? (
          <Button
            onClick={handleNext}
            disabled={!isStepValid()}
            className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
          >
            Suivant
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!isStepValid() || isLoading}
            className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
          >
            <FileText className="h-4 w-4 mr-2" />
            {isLoading ? 'Génération...' : 'Finaliser le CCF'}
          </Button>
        )}
      </div>
    </div>
  );
}

export default GuidedCCF;

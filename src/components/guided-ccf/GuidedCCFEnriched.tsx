/**
 * Guided CCF Component - Single Page avec Enrichissement Automatique
 * Formulaire complet + requêtes APIs DPE, Cadastre, etc.
 */

import { useState, useCallback } from 'react';
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
import { AlertCircle, Loader, CheckCircle2, MapPin, Zap } from 'lucide-react';
import { enrichClientData } from '@/services/enrichmentService';
import type { ClientInfo, EnrichedClientData } from '@/types/enrichment';
import type { CCFData } from './GuidedCCF';

interface GuidedCCFEnrichedProps {
  onSubmit: (data: CCFData & { enrichedData?: EnrichedClientData }) => void;
  isLoading?: boolean;
}

export function GuidedCCFEnriched({
  onSubmit,
  isLoading: isSubmitting = false,
}: GuidedCCFEnrichedProps) {
  const [formData, setFormData] = useState<Partial<CCFData>>({
    projectType: 'renovation',
    timeline: '1-3-months',
    objectives: [],
    constraints: [],
    successCriteria: [],
    projectAddress: {
      street: '',
      postalCode: '',
      city: '',
    },
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [enrichmentStatus, setEnrichmentStatus] = useState<
    'idle' | 'enriching' | 'completed' | 'error'
  >('idle');
  const [enrichedData, setEnrichedData] = useState<EnrichedClientData | null>(null);
  const [enrichmentError, setEnrichmentError] = useState<string | null>(null);

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

  const handleAddressChange = (field: keyof (typeof formData.projectAddress), value: string) => {
    setFormData({
      ...formData,
      projectAddress: {
        ...formData.projectAddress,
        [field]: value,
      },
    });
  };

  const toggleArrayItem = (field: 'objectives' | 'constraints' | 'successCriteria', item: string) => {
    const current = formData[field] || [];
    if (current.includes(item)) {
      handleInputChange(field, current.filter(i => i !== item));
    } else {
      handleInputChange(field, [...current, item]);
    }
  };

  // Enrichissement automatique lors du blur de l'adresse
  const handleAddressBlur = useCallback(async () => {
    if (!formData.clientName || !formData.projectAddress?.street || !formData.projectAddress?.city) {
      return;
    }

    setEnrichmentStatus('enriching');
    setEnrichmentError(null);

    try {
      const clientInfo: ClientInfo = {
        name: formData.clientName,
        phone: formData.clientPhone,
        email: formData.clientEmail,
        address: formData.projectAddress as any,
        siret: formData.siret,
      };

      const result = await enrichClientData(clientInfo, formData.siret);

      if (result.success && result.data) {
        setEnrichedData(result.data);
        setEnrichmentStatus('completed');
        console.log('✅ Client data enriched:', result.data);
      } else {
        setEnrichmentStatus('error');
        setEnrichmentError(result.errors?.[0] || 'Enrichment failed');
        console.warn('⚠️ Enrichment failed:', result.errors);
      }
    } catch (error) {
      setEnrichmentStatus('error');
      setEnrichmentError(error instanceof Error ? error.message : 'Unknown error');
      console.error('❌ Enrichment error:', error);
    }
  }, [formData.clientName, formData.projectAddress, formData.clientPhone, formData.clientEmail, formData.siret]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.projectName?.trim()) newErrors.projectName = 'Nom du projet requis';
    if (!formData.clientName?.trim()) newErrors.clientName = 'Nom du client requis';
    if (!formData.projectAddress?.street?.trim()) newErrors.address = 'Adresse requise';
    if (!formData.projectAddress?.city?.trim()) newErrors.city = 'Ville requise';
    if (!formData.projectAddress?.postalCode?.trim()) newErrors.postalCode = 'Code postal requis';
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
      const submitData = {
        ...formData,
        enrichedData: enrichedData || undefined,
      } as CCFData & { enrichedData?: EnrichedClientData };

      onSubmit(submitData);
    }
  };

  return (
    <div className="w-full space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="space-y-6"
      >
        {/* CLIENT INFO Section */}
        <Card className="bg-card border-border shadow-md">
          <CardHeader>
            <CardTitle className="font-display text-foreground">Informations du client</CardTitle>
            <CardDescription>Identifiez le client et le projet</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Nom du client *
                </label>
                <Input
                  placeholder="ex: Jean Dupont"
                  value={formData.clientName || ''}
                  onChange={(e) => handleInputChange('clientName', e.target.value)}
                  className={`bg-background border-border text-foreground placeholder-muted-foreground ${
                    errors.clientName ? 'border-red-500' : ''
                  }`}
                />
                {errors.clientName && (
                  <p className="text-xs text-red-500 mt-1">{errors.clientName}</p>
                )}
              </div>

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
                  Téléphone
                </label>
                <Input
                  type="tel"
                  placeholder="06 12 34 56 78"
                  value={formData.clientPhone || ''}
                  onChange={(e) => handleInputChange('clientPhone', e.target.value)}
                  className="bg-background border-border text-foreground placeholder-muted-foreground"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="client@example.com"
                  value={formData.clientEmail || ''}
                  onChange={(e) => handleInputChange('clientEmail', e.target.value)}
                  className="bg-background border-border text-foreground placeholder-muted-foreground"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ADDRESS Section - with Auto-Enrichment */}
        <Card className={`border-border shadow-md ${enrichmentStatus === 'enriching' ? 'bg-blue-50/50' : 'bg-card'}`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-display text-foreground flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Adresse du projet
                </CardTitle>
                <CardDescription>
                  Automatiquement enrichie avec données DPE, cadastre, réglementaire
                </CardDescription>
              </div>
              {enrichmentStatus === 'enriching' && (
                <Loader className="h-5 w-5 text-primary animate-spin" />
              )}
              {enrichmentStatus === 'completed' && (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Numéro
                </label>
                <Input
                  placeholder="25"
                  value={formData.projectAddress?.number || ''}
                  onChange={(e) => handleAddressChange('number', e.target.value)}
                  className="bg-background border-border text-foreground placeholder-muted-foreground"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-medium text-foreground block mb-2">
                  Rue *
                </label>
                <Input
                  placeholder="Rue de la Paix"
                  value={formData.projectAddress?.street || ''}
                  onChange={(e) => handleAddressChange('street', e.target.value)}
                  className={`bg-background border-border text-foreground placeholder-muted-foreground ${
                    errors.address ? 'border-red-500' : ''
                  }`}
                />
                {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Code Postal *
                </label>
                <Input
                  placeholder="75016"
                  value={formData.projectAddress?.postalCode || ''}
                  onChange={(e) => handleAddressChange('postalCode', e.target.value)}
                  onBlur={handleAddressBlur}
                  className={`bg-background border-border text-foreground placeholder-muted-foreground ${
                    errors.postalCode ? 'border-red-500' : ''
                  }`}
                />
                {errors.postalCode && (
                  <p className="text-xs text-red-500 mt-1">{errors.postalCode}</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Ville *
                </label>
                <Input
                  placeholder="Paris"
                  value={formData.projectAddress?.city || ''}
                  onChange={(e) => handleAddressChange('city', e.target.value)}
                  onBlur={handleAddressBlur}
                  className={`bg-background border-border text-foreground placeholder-muted-foreground ${
                    errors.city ? 'border-red-500' : ''
                  }`}
                />
                {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city}</p>}
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-medium text-foreground block mb-2">
                  SIRET (optionnel - pour enrichissement entreprise)
                </label>
                <Input
                  placeholder="12345678901234"
                  value={formData.siret || ''}
                  onChange={(e) => handleInputChange('siret', e.target.value)}
                  className="bg-background border-border text-foreground placeholder-muted-foreground"
                />
              </div>
            </div>

            {/* Enrichment Status Display */}
            {enrichmentStatus === 'enriching' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                <Loader className="h-5 w-5 text-blue-600 animate-spin flex-shrink-0" />
                <p className="text-sm text-blue-900">
                  Récupération des données DPE, cadastre et réglementaire...
                </p>
              </div>
            )}

            {enrichmentStatus === 'completed' && enrichedData && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-2">
                <p className="text-sm font-semibold text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Données enrichies avec succès!
                </p>
                <div className="text-xs text-emerald-700 space-y-1">
                  {enrichedData.dpe.available && <p>✓ DPE: Classe {enrichedData.dpe.class}</p>}
                  {enrichedData.cadastre.parcelleNumber && (
                    <p>✓ Cadastre: Parcelle {enrichedData.cadastre.parcelleNumber}</p>
                  )}
                  {enrichedData.regulatory.abfZone && <p>⚠️ Zone ABF détectée</p>}
                  {enrichedData.regulatory.floodableZone && <p>⚠️ Zone inondable détectée</p>}
                </div>
              </div>
            )}

            {enrichmentStatus === 'error' && enrichmentError && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-900">
                  ⚠️ Enrichissement partiel: {enrichmentError}. Vous pouvez continuer.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* PROJECT INFO Section */}
        <Card className="bg-card border-border shadow-md">
          <CardHeader>
            <CardTitle className="font-display text-foreground">Informations du projet</CardTitle>
            <CardDescription>Définissez la nature et l'étendue du projet</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Timeline *
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

            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Périmètre * (détaillez les travaux)
              </label>
              <Textarea
                placeholder="Décrivez ce qui doit être fait..."
                value={formData.scope || ''}
                onChange={(e) => handleInputChange('scope', e.target.value)}
                rows={4}
                className={`bg-background border-border text-foreground placeholder-muted-foreground ${
                  errors.scope ? 'border-red-500' : ''
                }`}
              />
              {errors.scope && <p className="text-xs text-red-500 mt-1">{errors.scope}</p>}
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
                className={`bg-background border-border text-foreground placeholder-muted-foreground ${
                  errors.budget ? 'border-red-500' : ''
                }`}
              />
              {errors.budget && <p className="text-xs text-red-500 mt-1">{errors.budget}</p>}
            </div>
          </CardContent>
        </Card>

        {/* OBJECTIVES, CONSTRAINTS, CRITERIA */}
        <Card className="bg-card border-border shadow-md">
          <CardHeader>
            <CardTitle className="font-display text-foreground">Objectifs & Contraintes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="text-sm font-medium text-foreground block mb-3">
                Objectifs * (au moins 1)
              </label>
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
                    <label htmlFor={`obj-${obj}`} className="text-sm text-foreground cursor-pointer">
                      {obj}
                    </label>
                  </div>
                ))}
              </div>
              {errors.objectives && <p className="text-xs text-red-500 mt-2">{errors.objectives}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground block mb-3">
                Contraintes * (au moins 1)
              </label>
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
                      className="text-sm text-foreground cursor-pointer"
                    >
                      {constraint}
                    </label>
                  </div>
                ))}
              </div>
              {errors.constraints && <p className="text-xs text-red-500 mt-2">{errors.constraints}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground block mb-3">
                Critères de Succès * (au moins 1)
              </label>
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
                      className="text-sm text-foreground cursor-pointer"
                    >
                      {criteria}
                    </label>
                  </div>
                ))}
              </div>
              {errors.successCriteria && (
                <p className="text-xs text-red-500 mt-2">{errors.successCriteria}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex gap-4 pt-4">
          <Button
            type="submit"
            disabled={isSubmitting || enrichmentStatus === 'enriching'}
            className="flex-1 gradient-primary text-primary-foreground border-0 font-display text-base py-6"
          >
            {isSubmitting ? (
              <>
                <Loader className="h-4 w-4 mr-2 animate-spin" />
                Création en cours...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Créer le CCF & Continuer
              </>
            )}
          </Button>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-900">
            ✨ Les données client sont automatiquement enrichies avec DPE, cadastre et informations réglementaires.
            Les champs avec * sont obligatoires.
          </p>
        </div>
      </form>
    </div>
  );
}

export default GuidedCCFEnriched;

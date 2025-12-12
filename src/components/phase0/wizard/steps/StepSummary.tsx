/**
 * Étape 6 - Récapitulatif et validation
 * Affiche un résumé du projet avant finalisation
 */

import React, { useMemo } from 'react';
import { StepComponentProps } from '../WizardContainer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  User, Building, MapPin, Hammer, Euro, Calendar, Clock, Home,
  Check, AlertTriangle, Info, FileText, Edit, ChevronRight
} from 'lucide-react';
import { LOT_CATALOG, LotType } from '@/types/phase0/lots.types';
import { EstimationService } from '@/services/phase0/estimation.service';
import { ValidationService } from '@/services/phase0/validation.service';
import { Phase0Project } from '@/types/phase0/project.types';

export function StepSummary({
  project,
  answers,
  onAnswerChange,
  errors,
  isProcessing,
}: StepComponentProps) {
  // Extraire les données du projet
  const owner = (project.owner || {}) as Record<string, unknown>;
  const ownerIdentity = (owner.identity || {}) as Record<string, unknown>;
  const ownerContact = (owner.contact || {}) as Record<string, unknown>;
  const property = (project.property || {}) as Record<string, unknown>;
  const propertyAddress = (property.address || {}) as Record<string, unknown>;
  const propertyChars = (property.characteristics || {}) as Record<string, unknown>;
  const workProject = (project.workProject || {}) as Record<string, unknown>;
  const workGeneral = (workProject.general || {}) as Record<string, unknown>;
  const workScope = (workProject.scope || {}) as Record<string, unknown>;
  const workConstraints = (workProject.constraints || {}) as Record<string, unknown>;
  const workTemporal = (workConstraints.temporal || {}) as Record<string, unknown>;
  const workBudget = (workProject.budget || {}) as Record<string, unknown>;
  const budgetEnvelope = (workBudget.totalEnvelope || {}) as Record<string, unknown>;
  const workQuality = (workProject.quality || {}) as Record<string, unknown>;

  // Lots sélectionnés
  const selectedLots = (answers['selectedLots'] as LotType[]) || [];
  const selectedLotDetails = selectedLots.map(lotType =>
    LOT_CATALOG.find(l => l.type === lotType)
  ).filter(Boolean);

  // Estimation
  const estimation = useMemo(() => {
    const projectData: Partial<Phase0Project> = {
      owner: project.owner as Phase0Project['owner'],
      property: project.property as Phase0Project['property'],
      workProject: project.workProject as Phase0Project['workProject'],
      selectedLots: selectedLots.map(type => {
        const lot = LOT_CATALOG.find(l => l.type === type);
        return {
          id: type,
          projectId: '',
          type,
          number: lot?.number || '',
          category: lot?.category || 'specifique',
          name: lot?.name || type,
          description: lot?.description || '',
          priority: 'medium' as const,
          isUrgent: false,
          selectedPrestations: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }),
    };
    return EstimationService.estimateProject(projectData);
  }, [project, selectedLots]);

  // Validation
  const validation = useMemo(() => {
    return ValidationService.validateProject(project as Partial<Phase0Project>, 'standard');
  }, [project]);

  // Labels
  const ownerTypeLabels: Record<string, string> = {
    b2c: 'Particulier',
    b2b: 'Professionnel',
    b2g: 'Collectivité',
    investor: 'Investisseur',
  };

  const propertyTypeLabels: Record<string, string> = {
    apartment: 'Appartement',
    house: 'Maison',
    villa: 'Villa',
    loft: 'Loft',
    studio: 'Studio',
    building: 'Immeuble',
    commercial: 'Local commercial',
    office: 'Bureau',
    warehouse: 'Entrepôt',
    land: 'Terrain',
  };

  const workTypeLabels: Record<string, string> = {
    new_construction: 'Construction neuve',
    extension: 'Extension',
    renovation: 'Rénovation',
    refurbishment: 'Réhabilitation',
    restoration: 'Restauration',
    maintenance: 'Entretien',
    improvement: 'Amélioration',
    conversion: 'Transformation',
    demolition: 'Démolition',
  };

  const finishLevelLabels: Record<string, string> = {
    basic: 'Basique',
    standard: 'Standard',
    premium: 'Premium',
    luxury: 'Luxe',
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Non définie';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatBudget = (value: number) => {
    return value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  };

  return (
    <div className="space-y-6">
      {/* Alertes de validation */}
      {!validation.isValid && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Informations manquantes :</strong>
            <ul className="list-disc list-inside mt-1">
              {validation.validations
                .filter(v => !v.isValid && v.severity === 'error')
                .slice(0, 5)
                .map((v, i) => (
                  <li key={i} className="text-sm">{v.message}</li>
                ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Complétude */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Complétude du projet</CardTitle>
            <Badge variant={validation.completeness >= 80 ? 'default' : 'secondary'}>
              {validation.completeness}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-primary transition-all"
              style={{ width: `${validation.completeness}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {validation.completeness >= 80
              ? 'Votre projet est suffisamment complet pour être soumis.'
              : 'Complétez les informations manquantes pour améliorer la qualité des devis.'}
          </p>
        </CardContent>
      </Card>

      {/* Maître d'ouvrage */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Maître d'ouvrage
            </CardTitle>
            <Button variant="ghost" size="sm">
              <Edit className="w-4 h-4 mr-1" />
              Modifier
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Profil</dt>
              <dd className="font-medium">
                {ownerTypeLabels[ownerIdentity.type as string] || 'Non défini'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {ownerIdentity.type === 'b2c' ? 'Nom' : 'Raison sociale'}
              </dt>
              <dd className="font-medium">
                {ownerIdentity.type === 'b2c'
                  ? `${ownerIdentity.firstName || ''} ${ownerIdentity.lastName || ''}`.trim() || 'Non renseigné'
                  : (ownerIdentity.companyName as string) || 'Non renseigné'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{(ownerContact.email as string) || 'Non renseigné'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Téléphone</dt>
              <dd className="font-medium">{(ownerContact.phone as string) || 'Non renseigné'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Bien */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building className="w-5 h-5 text-primary" />
              Bien concerné
            </CardTitle>
            <Button variant="ghost" size="sm">
              <Edit className="w-4 h-4 mr-1" />
              Modifier
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="md:col-span-2">
              <dt className="text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                Adresse
              </dt>
              <dd className="font-medium">
                {propertyAddress.street ? (
                  <>
                    {propertyAddress.street as string}
                    {propertyAddress.complement && <>, {propertyAddress.complement as string}</>}
                    <br />
                    {propertyAddress.postalCode as string} {propertyAddress.city as string}
                  </>
                ) : (
                  'Non renseignée'
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Type de bien</dt>
              <dd className="font-medium">
                {propertyTypeLabels[propertyChars.type as string] || 'Non défini'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Surface habitable</dt>
              <dd className="font-medium">
                {propertyChars.livingArea ? `${propertyChars.livingArea} m²` : 'Non renseignée'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Nombre de pièces</dt>
              <dd className="font-medium">
                {propertyChars.roomCount || 'Non renseigné'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Année de construction</dt>
              <dd className="font-medium">
                {(property.construction as Record<string, unknown>)?.yearBuilt || 'Non renseignée'}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Projet */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Hammer className="w-5 h-5 text-primary" />
              Projet de travaux
            </CardTitle>
            <Button variant="ghost" size="sm">
              <Edit className="w-4 h-4 mr-1" />
              Modifier
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="md:col-span-2">
              <dt className="text-muted-foreground">Titre</dt>
              <dd className="font-medium">
                {(workGeneral.title as string) || 'Non défini'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Type de travaux</dt>
              <dd className="font-medium">
                {workTypeLabels[workScope.workType as string] || 'Non défini'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Niveau de finition</dt>
              <dd className="font-medium">
                {finishLevelLabels[workQuality.finishLevel as string] || 'Standard'}
              </dd>
            </div>
          </dl>

          {/* Lots sélectionnés */}
          <Separator />
          <div>
            <h4 className="font-medium mb-2">
              Lots de travaux ({selectedLots.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {selectedLotDetails.map((lot) => (
                <Badge key={lot!.type} variant="outline">
                  {lot!.number}. {lot!.name}
                </Badge>
              ))}
              {selectedLots.length === 0 && (
                <span className="text-sm text-muted-foreground">Aucun lot sélectionné</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Budget et planning */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Euro className="w-5 h-5 text-primary" />
              Budget et planning
            </CardTitle>
            <Button variant="ghost" size="sm">
              <Edit className="w-4 h-4 mr-1" />
              Modifier
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Enveloppe budgétaire</dt>
              <dd className="font-medium">
                {budgetEnvelope.min || budgetEnvelope.max ? (
                  <>
                    {formatBudget(budgetEnvelope.min as number || 0)} - {formatBudget(budgetEnvelope.max as number || 0)}
                  </>
                ) : (
                  'Non définie'
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Estimation TORP</dt>
              <dd className="font-medium text-primary">
                {formatBudget(estimation.budget.total.min)} - {formatBudget(estimation.budget.total.max)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Date de début souhaitée
              </dt>
              <dd className="font-medium">
                {formatDate(workTemporal.desiredStartDate as string)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Durée estimée
              </dt>
              <dd className="font-medium">
                {estimation.duration.totalWeeks.min} - {estimation.duration.totalWeeks.max} semaines
              </dd>
            </div>
          </dl>

          {/* Facteurs d'estimation */}
          {estimation.factors.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">Facteurs pris en compte</h4>
                <ul className="space-y-1">
                  {estimation.factors.map((factor, i) => (
                    <li key={i} className="text-sm flex items-center gap-2">
                      <span className={factor.impact === 'increase' ? 'text-red-500' : 'text-green-500'}>
                        {factor.impact === 'increase' ? '+' : '-'}{Math.abs(factor.percentage)}%
                      </span>
                      <span className="text-muted-foreground">{factor.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Consentement */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="acceptTerms"
              checked={(answers['acceptTerms'] as boolean) || false}
              onCheckedChange={(checked) => onAnswerChange('acceptTerms', checked)}
              disabled={isProcessing}
            />
            <div>
              <Label htmlFor="acceptTerms" className="cursor-pointer">
                J'accepte les conditions générales d'utilisation et la politique de confidentialité
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                En validant, vous autorisez TORP à traiter vos données pour vous mettre en relation
                avec des professionnels du bâtiment qualifiés.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="acceptContact"
              checked={(answers['acceptContact'] as boolean) || false}
              onCheckedChange={(checked) => onAnswerChange('acceptContact', checked)}
              disabled={isProcessing}
            />
            <div>
              <Label htmlFor="acceptContact" className="cursor-pointer">
                J'accepte d'être contacté par des professionnels correspondant à mon projet
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info documents */}
      <Alert>
        <FileText className="h-4 w-4" />
        <AlertDescription>
          <strong>Documents générés :</strong> Après validation, TORP générera automatiquement
          votre Cahier des Charges Fonctionnel (CCF) et votre Avant-Projet Sommaire (APS)
          pour faciliter vos échanges avec les professionnels.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export default StepSummary;

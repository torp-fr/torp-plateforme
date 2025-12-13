/**
 * Étape 6 - Validation de l'avant-projet
 * Affiche un récapitulatif complet avant finalisation
 * Inclut les lots de travaux identifiés automatiquement
 */

import React, { useMemo, useState } from 'react';
import { StepComponentProps } from '../WizardContainer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  User, Building, MapPin, Hammer, Euro, Calendar, Clock, Home,
  Check, AlertTriangle, Info, FileText, Edit, ChevronRight,
  Sparkles, Map, Shield, Briefcase, Building2, ChevronDown, Plus, Minus,
  TrendingUp, TrendingDown, BarChart3, Calculator, Layers, ArrowUpDown
} from 'lucide-react';
import { LOT_CATALOG, LotType, LotCategory } from '@/types/phase0/lots.types';
import { EstimationService } from '@/services/phase0/estimation.service';
import { ValidationService } from '@/services/phase0/validation.service';
import { Phase0Project } from '@/types/phase0/project.types';
import { WorkType } from '@/types/phase0/work-project.types';
import { PricingEstimationService, ProjectEstimation } from '@/services/phase0/pricing-estimation.service';
import { RoomDetailsData, ROOM_TYPE_CONFIG } from '@/types/phase0/room-details.types';

// Lots suggérés par type de travaux
const SUGGESTED_LOTS_BY_WORK_TYPE: Record<WorkType, LotType[]> = {
  renovation: ['demolition', 'platrerie', 'carrelage', 'peinture', 'courants_forts', 'sanitaires'],
  refurbishment: ['demolition', 'maconnerie', 'courants_forts', 'sanitaires', 'isolation_interieure', 'platrerie', 'vmc_simple_flux'],
  extension: ['terrassement_vrd', 'maconnerie', 'beton_arme', 'charpente_bois', 'couverture', 'menuiseries_exterieures', 'isolation_interieure'],
  improvement: ['ite', 'isolation_interieure', 'menuiseries_exterieures', 'chauffage_central', 'vmc_double_flux'],
  new_construction: ['terrassement_vrd', 'maconnerie', 'beton_arme', 'charpente_bois', 'couverture', 'menuiseries_exterieures', 'isolation_interieure', 'platrerie', 'courants_forts', 'sanitaires', 'chauffage_central'],
  maintenance: ['ravalement', 'couverture', 'peinture', 'chauffage_central'],
  restoration: ['demolition', 'maconnerie', 'charpente_bois', 'couverture', 'menuiseries_exterieures', 'platrerie'],
  conversion: ['demolition', 'maconnerie', 'platrerie', 'courants_forts', 'sanitaires', 'isolation_interieure'],
  demolition: ['demolition', 'terrassement_vrd'],
};

const CATEGORY_LABELS: Record<LotCategory, string> = {
  gros_oeuvre: 'Gros œuvre',
  enveloppe: 'Enveloppe',
  cloisonnement: 'Cloisonnement',
  finitions: 'Finitions',
  electricite: 'Électricité',
  plomberie: 'Plomberie',
  cvc: 'CVC',
  ventilation: 'Ventilation',
  exterieurs: 'Extérieurs',
  speciaux: 'Spéciaux',
};

/**
 * Tags simplifiés B2C - Mots-clés faciles à comprendre pour les particuliers
 * Les termes techniques seront utilisés dans les documents DCE/AVP/CCF générés
 */
const B2C_SIMPLIFIED_TAGS: Record<LotType, string[]> = {
  // Gros œuvre
  terrassement_vrd: ['Terrassement', 'Fondations'],
  maconnerie: ['Murs', 'Maçonnerie'],
  beton_arme: ['Béton', 'Structure'],
  demolition: ['Démolition', 'Dépose'],

  // Enveloppe
  charpente_bois: ['Charpente', 'Toiture bois'],
  charpente_metal: ['Charpente métallique'],
  couverture: ['Toiture', 'Tuiles'],
  etancheite: ['Étanchéité', 'Toit plat'],
  bardage: ['Bardage', 'Façade'],
  ite: ['Isolation extérieure', 'ITE'],
  ravalement: ['Ravalement', 'Façade'],
  menuiseries_exterieures: ['Fenêtres', 'Portes extérieures'],

  // Cloisonnement
  platrerie: ['Cloisons', 'Plafonds'],
  isolation_interieure: ['Isolation', 'Thermique'],
  faux_plafonds: ['Plafonds suspendus'],

  // Finitions
  menuiseries_interieures: ['Portes intérieures', 'Placards'],
  carrelage: ['Carrelage', 'Sol'],
  parquet: ['Parquet', 'Sol bois'],
  revetements_sols: ['Sol souple', 'Moquette'],
  peinture: ['Peinture', 'Papier peint'],
  revetements_muraux: ['Revêtements', 'Murs'],

  // Électricité
  courants_forts: ['Électricité', 'Prises'],
  courants_faibles: ['Réseau', 'Internet', 'TV'],
  domotique: ['Domotique', 'Maison connectée'],
  photovoltaique: ['Panneaux solaires', 'Photovoltaïque'],

  // Plomberie
  sanitaires: ['Plomberie', 'Salle de bain'],
  eaux_pluviales: ['Gouttières', 'Évacuation'],
  assainissement: ['Assainissement', 'Fosse'],

  // CVC
  chauffage_central: ['Chauffage', 'Radiateurs'],
  plancher_chauffant: ['Chauffage au sol'],
  climatisation: ['Climatisation', 'Clim'],
  pompe_chaleur: ['Pompe à chaleur', 'PAC'],
  chaudiere: ['Chaudière'],

  // Ventilation
  vmc_simple_flux: ['Ventilation', 'VMC'],
  vmc_double_flux: ['VMC double flux', 'Récupération chaleur'],

  // Extérieurs
  amenagements_exterieurs: ['Jardin', 'Terrasse'],
  clotures: ['Clôtures', 'Portail'],
  piscine: ['Piscine'],

  // Spéciaux
  cuisine_equipee: ['Cuisine équipée'],
  salle_bain_cle_main: ['Salle de bain clé en main'],
  ascenseur: ['Ascenseur', 'Monte-charge'],
  securite_incendie: ['Sécurité', 'Incendie'],
};

export function StepSummary({
  project,
  answers,
  onAnswerChange,
  errors,
  isProcessing,
}: StepComponentProps) {
  const [openSections, setOpenSections] = useState<string[]>(['owner', 'property', 'works', 'lots']);

  // Extraire les données du projet (avec support pour ownerProfile)
  const owner = (project.ownerProfile || project.owner || {}) as Record<string, unknown>;
  const ownerIdentity = (owner.identity || {}) as Record<string, unknown>;
  const ownerContact = (owner.contact || {}) as Record<string, unknown>;
  const property = (project.property || {}) as Record<string, unknown>;
  const propertyAddress = (property.address || {}) as Record<string, unknown>;
  const propertyChars = (property.characteristics || {}) as Record<string, unknown>;
  const propertyConstruction = (property.construction || {}) as Record<string, unknown>;
  const propertyCondo = (property.condo || {}) as Record<string, unknown>;
  const propertyDiagnostics = (property.diagnostics || {}) as Record<string, unknown>;
  const propertyDpe = (propertyDiagnostics.dpe || {}) as Record<string, unknown>;
  const workProject = (project.workProject || {}) as Record<string, unknown>;
  const workGeneral = (workProject.general || {}) as Record<string, unknown>;
  const workScope = (workProject.scope || {}) as Record<string, unknown>;
  const workConstraints = (workProject.constraints || {}) as Record<string, unknown>;
  const workTemporal = (workConstraints.temporal || {}) as Record<string, unknown>;
  const workBudget = (workProject.budget || {}) as Record<string, unknown>;
  const budgetEnvelope = (workBudget.totalEnvelope || {}) as Record<string, unknown>;
  const workQuality = (workProject.quality || {}) as Record<string, unknown>;

  const workType = (workScope.workType as WorkType) || (answers['workProject.scope.workType'] as WorkType);

  // Room details data
  const roomDetailsData = useMemo((): RoomDetailsData => {
    const data = (project.roomDetails || answers['roomDetails']) as RoomDetailsData | undefined;
    return data || { rooms: [] };
  }, [project.roomDetails, answers]);

  // AI Pricing Estimation from room details
  const aiEstimation = useMemo((): ProjectEstimation | null => {
    if (roomDetailsData.rooms.length === 0) return null;
    const totalWorks = roomDetailsData.rooms.reduce((sum, r) => sum + r.works.length, 0);
    if (totalWorks === 0) return null;

    const postalCode = propertyAddress.postalCode as string || '';
    return PricingEstimationService.estimateProjectCost(roomDetailsData, {
      postalCode,
      complexity: 'standard',
      finishLevel: (workQuality.finishLevel as 'basic' | 'standard' | 'premium' | 'luxury') || 'standard',
      contingencyPercentage: 10,
    });
  }, [roomDetailsData, propertyAddress.postalCode, workQuality.finishLevel]);

  // Lots suggérés automatiquement basés sur le type de travaux
  const suggestedLots = useMemo(() => {
    if (!workType) return [];
    return SUGGESTED_LOTS_BY_WORK_TYPE[workType] || [];
  }, [workType]);

  // Lots sélectionnés (depuis les réponses ou auto-suggestion)
  const selectedLots = useMemo(() => {
    const fromAnswers = (answers['selectedLots'] as LotType[]) || [];
    if (fromAnswers.length > 0) return fromAnswers;
    return suggestedLots;
  }, [answers, suggestedLots]);

  // Détails des lots sélectionnés
  const selectedLotDetails = selectedLots.map(lotType =>
    LOT_CATALOG.find(l => l.type === lotType)
  ).filter(Boolean);

  // Grouper les lots par catégorie
  const lotsByCategory = useMemo(() => {
    const grouped: Record<LotCategory, typeof selectedLotDetails> = {} as Record<LotCategory, typeof selectedLotDetails>;
    selectedLotDetails.forEach(lot => {
      if (!lot) return;
      if (!grouped[lot.category]) {
        grouped[lot.category] = [];
      }
      grouped[lot.category].push(lot);
    });
    return grouped;
  }, [selectedLotDetails]);

  // Toggle lot selection
  const toggleLot = (lotType: LotType) => {
    const current = [...selectedLots];
    const index = current.indexOf(lotType);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(lotType);
    }
    onAnswerChange('selectedLots', current);
  };

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
          category: lot?.category || 'speciaux',
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
    return ValidationService.validateProject(project as Partial<Phase0Project>, 'minimal');
  }, [project]);

  // Labels
  const ownerTypeLabels: Record<string, string> = {
    b2c: 'Particulier',
    b2b: 'Professionnel / Entreprise',
    b2b_moe: 'Maître d\'œuvre externe',
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

  const urgencyLabels: Record<string, string> = {
    emergency: 'Urgence (24-48h)',
    within_month: 'Dans le mois',
    within_quarter: 'Dans le trimestre',
    within_year: 'Dans l\'année',
    planning: 'En phase d\'étude',
  };

  const finishLevelLabels: Record<string, string> = {
    basic: 'Basique',
    standard: 'Standard',
    premium: 'Premium',
    luxury: 'Luxe',
  };

  const formatBudget = (value: number) => {
    return value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  };

  const toggleSection = (section: string) => {
    setOpenSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  return (
    <div className="space-y-6">
      {/* En-tête validation */}
      <div className="text-center pb-4">
        <h2 className="text-2xl font-bold">Validation de votre avant-projet</h2>
        <p className="text-muted-foreground mt-2">
          Vérifiez les informations ci-dessous avant de finaliser votre projet
        </p>
      </div>

      {/* Alertes de validation */}
      {!validation.isValid && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Informations à compléter :</strong>
            <ul className="list-disc list-inside mt-1">
              {validation.validations
                .filter(v => !v.isValid && v.severity === 'error')
                .slice(0, 3)
                .map((v, i) => (
                  <li key={i} className="text-sm">{v.message}</li>
                ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Complétude */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Complétude du projet</span>
            <Badge variant={validation.completeness >= 60 ? 'default' : 'secondary'}>
              {validation.completeness}%
            </Badge>
          </div>
          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-primary transition-all"
              style={{ width: `${validation.completeness}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section Maître d'ouvrage */}
      <Collapsible open={openSections.includes('owner')} onOpenChange={() => toggleSection('owner')}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  {ownerIdentity.type === 'b2c' ? (
                    <User className="w-5 h-5 text-primary" />
                  ) : (
                    <Briefcase className="w-5 h-5 text-primary" />
                  )}
                  Maître d'ouvrage
                  <Badge variant="outline" className="ml-2">
                    {ownerTypeLabels[ownerIdentity.type as string] || 'Non défini'}
                  </Badge>
                </CardTitle>
                <ChevronDown className={`w-5 h-5 transition-transform ${openSections.includes('owner') ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">
                    {ownerIdentity.type === 'b2c' ? 'Nom complet' : 'Raison sociale'}
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
                {ownerIdentity.type !== 'b2c' && (
                  <div>
                    <dt className="text-muted-foreground">SIRET</dt>
                    <dd className="font-medium">{(ownerIdentity.siret as string) || 'Non renseigné'}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Section Bien concerné */}
      <Collapsible open={openSections.includes('property')} onOpenChange={() => toggleSection('property')}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building className="w-5 h-5 text-primary" />
                  Bien concerné
                  <Badge variant="outline" className="ml-2">
                    {propertyTypeLabels[propertyChars.type as string] || 'Non défini'}
                  </Badge>
                </CardTitle>
                <ChevronDown className={`w-5 h-5 transition-transform ${openSections.includes('property') ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              {/* Adresse et localisation */}
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium">
                      {propertyAddress.street ? (
                        <>
                          {propertyAddress.street as string}
                          {propertyAddress.complement && <span>, {propertyAddress.complement as string}</span>}
                        </>
                      ) : (
                        'Adresse non renseignée'
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {propertyAddress.postalCode as string} {propertyAddress.city as string}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Map className="w-4 h-4 mr-1" />
                    Carte
                  </Button>
                </div>
              </div>

              {/* Informations cadastrales et réglementaires */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="p-3 bg-muted/20 rounded-lg">
                  <dt className="text-muted-foreground text-xs">Surface habitable</dt>
                  <dd className="font-semibold">
                    {propertyChars.livingArea ? `${propertyChars.livingArea} m²` : '-'}
                  </dd>
                </div>
                <div className="p-3 bg-muted/20 rounded-lg">
                  <dt className="text-muted-foreground text-xs">Année construction</dt>
                  <dd className="font-semibold">
                    {propertyConstruction.yearBuilt || '-'}
                  </dd>
                </div>
                <div className="p-3 bg-muted/20 rounded-lg">
                  <dt className="text-muted-foreground text-xs">DPE</dt>
                  <dd className="font-semibold">
                    {propertyDpe.rating ? (
                      <Badge className={`
                        ${propertyDpe.rating === 'A' || propertyDpe.rating === 'B' ? 'bg-green-500' :
                          propertyDpe.rating === 'C' || propertyDpe.rating === 'D' ? 'bg-yellow-500' :
                          'bg-red-500'
                        }
                      `}>
                        {propertyDpe.rating as string}
                      </Badge>
                    ) : '-'}
                  </dd>
                </div>
                <div className="p-3 bg-muted/20 rounded-lg">
                  <dt className="text-muted-foreground text-xs">Copropriété</dt>
                  <dd className="font-semibold">
                    {propertyCondo.isInCondo ? `Oui (étage ${propertyCondo.floorNumber || '?'})` : 'Non'}
                  </dd>
                </div>
              </div>

              {/* Alertes réglementaires (placeholder pour futures APIs) */}
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>Informations réglementaires :</strong> Les données cadastrales, secteur ABF,
                  et risques seront récupérées automatiquement via les APIs officielles.
                </AlertDescription>
              </Alert>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Section Projet de travaux */}
      <Collapsible open={openSections.includes('works')} onOpenChange={() => toggleSection('works')}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Hammer className="w-5 h-5 text-primary" />
                  Projet de travaux
                  <Badge variant="outline" className="ml-2">
                    {workTypeLabels[workType] || 'Non défini'}
                  </Badge>
                </CardTitle>
                <ChevronDown className={`w-5 h-5 transition-transform ${openSections.includes('works') ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {workGeneral.title && (
                  <div className="md:col-span-2">
                    <dt className="text-muted-foreground">Titre du projet</dt>
                    <dd className="font-medium">{workGeneral.title as string}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-muted-foreground">Niveau de finition</dt>
                  <dd className="font-medium">
                    {finishLevelLabels[workQuality.finishLevel as string] || 'Standard'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Planning</dt>
                  <dd className="font-medium">
                    {urgencyLabels[workTemporal.urgencyLevel as string] || 'Non défini'}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Section Lots de travaux identifiés - Affichage B2C simplifié */}
      <Collapsible open={openSections.includes('lots')} onOpenChange={() => toggleSection('lots')}>
        <Card className="border-primary/30">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-500" />
                  Vos travaux en quelques mots
                  <Badge className="ml-2 bg-primary">
                    {selectedLots.length} postes
                  </Badge>
                </CardTitle>
                <ChevronDown className={`w-5 h-5 transition-transform ${openSections.includes('lots') ? 'rotate-180' : ''}`} />
              </div>
              <CardDescription>
                Mots-clés identifiés automatiquement pour votre projet
              </CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  Ces mots-clés décrivent votre projet de façon simple. Le détail technique complet
                  sera inclus dans les documents générés (CCF, APS) pour les professionnels.
                </AlertDescription>
              </Alert>

              {/* Tags simplifiés B2C */}
              <div className="p-4 bg-muted/20 rounded-lg">
                <Label className="text-sm font-medium mb-3 block">Travaux prévus :</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedLots.map(lotType => {
                    const tags = B2C_SIMPLIFIED_TAGS[lotType] || [];
                    const primaryTag = tags[0] || lotType;
                    return (
                      <Badge
                        key={lotType}
                        variant="default"
                        className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors py-1.5 px-3 text-sm"
                        onClick={() => toggleLot(lotType)}
                      >
                        {primaryTag}
                        <Minus className="w-3 h-3 ml-2" />
                      </Badge>
                    );
                  })}
                </div>
              </div>

              {/* Ajouter d'autres travaux */}
              <div className="border-t pt-4">
                <Label className="text-sm font-medium mb-3 block">Ajouter des travaux :</Label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(B2C_SIMPLIFIED_TAGS)
                    .filter(([lotType]) => !selectedLots.includes(lotType as LotType))
                    .slice(0, 12)
                    .map(([lotType, tags]) => (
                      <Badge
                        key={lotType}
                        variant="outline"
                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                        onClick={() => toggleLot(lotType as LotType)}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        {tags[0]}
                      </Badge>
                    ))}
                </div>
              </div>

              {/* Info document technique */}
              <Alert className="bg-gray-50 border-gray-200">
                <FileText className="h-4 w-4 text-gray-600" />
                <AlertDescription className="text-gray-700 text-sm">
                  <strong>Pour les professionnels :</strong> Les lots techniques détaillés seront générés
                  dans le Cahier des Charges Fonctionnel avec les spécifications DCE complètes.
                </AlertDescription>
              </Alert>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Estimation financière améliorée */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Euro className="w-5 h-5 text-primary" />
            Estimation budgétaire
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Votre budget vs Estimations */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white/50 dark:bg-black/20 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Votre budget</p>
              <p className="text-xl font-bold">
                {budgetEnvelope.min || budgetEnvelope.max ? (
                  <>
                    {formatBudget(budgetEnvelope.min as number || 0)} - {formatBudget(budgetEnvelope.max as number || 0)}
                  </>
                ) : (
                  <span className="text-muted-foreground">Non défini</span>
                )}
              </p>
            </div>
            <div className="p-4 bg-white/50 dark:bg-black/20 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                <Layers className="w-3 h-3" />
                Estimation lots
              </p>
              <p className="text-xl font-bold text-primary">
                {formatBudget(estimation.budget.total.min)} - {formatBudget(estimation.budget.total.max)}
              </p>
            </div>
            {aiEstimation && (
              <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200">
                <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <Calculator className="w-3 h-3 text-green-600" />
                  Estimation IA détaillée
                </p>
                <p className="text-xl font-bold text-green-700 dark:text-green-400">
                  {PricingEstimationService.formatPriceRange(aiEstimation.total.min, aiEstimation.total.max)}
                </p>
              </div>
            )}
          </div>

          {/* Benchmark marché (si AI estimation disponible) */}
          {aiEstimation?.benchmarkComparison && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  Analyse benchmark marché
                </h4>
                <Badge
                  variant={
                    aiEstimation.benchmarkComparison.marketPosition === 'below'
                      ? 'secondary'
                      : aiEstimation.benchmarkComparison.marketPosition === 'above'
                      ? 'default'
                      : 'outline'
                  }
                  className="flex items-center gap-1"
                >
                  {aiEstimation.benchmarkComparison.marketPosition === 'below' && (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {aiEstimation.benchmarkComparison.marketPosition === 'above' && (
                    <TrendingUp className="w-3 h-3" />
                  )}
                  {aiEstimation.benchmarkComparison.marketPosition === 'below'
                    ? 'Sous la moyenne'
                    : aiEstimation.benchmarkComparison.marketPosition === 'above'
                    ? 'Au-dessus de la moyenne'
                    : 'Dans la moyenne'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                <div>
                  <span className="text-muted-foreground block">Moyenne régionale</span>
                  <span className="font-semibold text-blue-700 dark:text-blue-300">
                    {PricingEstimationService.formatPrice(aiEstimation.benchmarkComparison.regionalAverage)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Moyenne nationale</span>
                  <span className="font-semibold">
                    {PricingEstimationService.formatPrice(aiEstimation.benchmarkComparison.nationalAverage)}
                  </span>
                </div>
                {aiEstimation.pricePerSqm && (
                  <>
                    <div>
                      <span className="text-muted-foreground block">Prix/m² estimé</span>
                      <span className="font-semibold">
                        {PricingEstimationService.formatPriceRange(
                          aiEstimation.pricePerSqm.min,
                          aiEstimation.pricePerSqm.max
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Écart marché</span>
                      <span className={`font-semibold ${
                        aiEstimation.benchmarkComparison.percentageFromAverage > 0
                          ? 'text-amber-600'
                          : 'text-green-600'
                      }`}>
                        {aiEstimation.benchmarkComparison.percentageFromAverage > 0 ? '+' : ''}
                        {aiEstimation.benchmarkComparison.percentageFromAverage}%
                      </span>
                    </div>
                  </>
                )}
              </div>

              <p className="text-sm text-blue-700 dark:text-blue-300 border-l-2 border-blue-300 pl-3">
                {aiEstimation.benchmarkComparison.message}
              </p>
            </div>
          )}

          {/* Détail par pièce (si AI estimation disponible) */}
          {aiEstimation && aiEstimation.rooms.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2 text-sm">
                <Home className="w-4 h-4" />
                Estimation détaillée par pièce
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {aiEstimation.rooms.map((room) => (
                  <div key={room.roomId} className="flex justify-between p-2 bg-white/30 dark:bg-black/10 rounded text-sm">
                    <span className="text-muted-foreground">
                      {room.roomName}
                      {room.surface && <span className="ml-1">({room.surface} m²)</span>}
                    </span>
                    <span className="font-medium">
                      {PricingEstimationService.formatPriceRange(
                        room.totalEstimate.min,
                        room.totalEstimate.max
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-sm pt-2 border-t">
                <span className="text-muted-foreground">
                  Provision imprévus ({aiEstimation.contingency.percentage}%)
                </span>
                <span className="font-medium">
                  {PricingEstimationService.formatPriceRange(
                    aiEstimation.contingency.min,
                    aiEstimation.contingency.max
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Durée estimée */}
          <div className="flex items-center justify-between text-sm pt-2 border-t">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span>Durée estimée : {estimation.duration.totalWeeks.min} - {estimation.duration.totalWeeks.max} semaines</span>
            </div>
            {aiEstimation && (
              <span className="text-xs text-muted-foreground">
                Confiance: {aiEstimation.confidence === 'high' ? 'Élevée' : aiEstimation.confidence === 'medium' ? 'Moyenne' : 'Indicative'}
              </span>
            )}
          </div>

          {/* Alerte cohérence budget */}
          {budgetEnvelope.max && (
            <>
              {(budgetEnvelope.max as number) < estimation.budget.total.min && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Votre budget semble inférieur à l'estimation basée sur les lots. Nous vous conseillons de revoir
                    le périmètre des travaux ou d'ajuster votre enveloppe budgétaire.
                  </AlertDescription>
                </Alert>
              )}
              {aiEstimation && (budgetEnvelope.max as number) < aiEstimation.total.min && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    L'estimation IA détaillée ({PricingEstimationService.formatPriceRange(aiEstimation.total.min, aiEstimation.total.max)})
                    dépasse votre budget. Envisagez d'ajuster le périmètre des travaux.
                  </AlertDescription>
                </Alert>
              )}
              {aiEstimation &&
               (budgetEnvelope.min as number) >= aiEstimation.total.min &&
               (budgetEnvelope.max as number) <= aiEstimation.total.max * 1.2 && (
                <Alert className="bg-green-50 border-green-200">
                  <Check className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Votre budget est cohérent avec l'estimation IA détaillée. Vous êtes bien positionné pour ce projet.
                  </AlertDescription>
                </Alert>
              )}
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
                J'accepte les conditions générales d'utilisation et la politique de confidentialité *
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                En validant, vous autorisez TORP à traiter vos données pour générer votre avant-projet
                et vous mettre en relation avec des professionnels qualifiés.
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

      {/* Info documents générés */}
      <Alert className="bg-green-50 border-green-200">
        <FileText className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          <strong>Documents générés après validation :</strong>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li><strong>CCF</strong> - Cahier des Charges Fonctionnel détaillé</li>
            <li><strong>APS</strong> - Avant-Projet Sommaire avec estimations</li>
          </ul>
          <p className="mt-2 text-sm">
            Ces documents faciliteront vos échanges avec les professionnels et la comparaison des devis.
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}

export default StepSummary;

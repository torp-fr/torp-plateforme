/**
 * Étape 2 B2B - Site d'intervention
 * Adresse et caractéristiques du lieu des travaux (pour les professionnels)
 */

import React, { useState, useCallback } from 'react';
import { StepComponentProps } from '../WizardContainer';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Home, Building, Building2, Factory, Trees, MapPin, Search, Loader2,
  CheckCircle2, Info, Car, Clock, Users, AlertTriangle, Lightbulb
} from 'lucide-react';
import type { SiteType } from '@/types/phase0/client.types';

// =============================================================================
// OPTIONS DE CONFIGURATION
// =============================================================================

const SITE_TYPE_OPTIONS: Array<{
  value: SiteType;
  label: string;
  icon: React.ReactNode;
  description?: string;
  constraints?: string[];
}> = [
  {
    value: 'appartement',
    label: 'Appartement',
    icon: <Building className="w-5 h-5" />,
    constraints: ['copropriété', 'voisinage'],
  },
  {
    value: 'maison',
    label: 'Maison individuelle',
    icon: <Home className="w-5 h-5" />,
  },
  {
    value: 'immeuble',
    label: 'Immeuble entier',
    icon: <Building2 className="w-5 h-5" />,
    constraints: ['accès multiples', 'gestion occupants'],
  },
  {
    value: 'local_commercial',
    label: 'Local commercial',
    icon: <Building2 className="w-5 h-5" />,
    constraints: ['horaires activité'],
  },
  {
    value: 'bureaux',
    label: 'Bureaux',
    icon: <Building2 className="w-5 h-5" />,
    constraints: ['horaires bureau'],
  },
  {
    value: 'entrepot',
    label: 'Entrepôt / Local technique',
    icon: <Factory className="w-5 h-5" />,
  },
  {
    value: 'erp',
    label: 'ERP',
    icon: <Users className="w-5 h-5" />,
    description: 'Établissement Recevant du Public',
    constraints: ['réglementation ERP', 'sécurité'],
  },
  {
    value: 'industriel',
    label: 'Site industriel',
    icon: <Factory className="w-5 h-5" />,
    constraints: ['ICPE', 'sécurité'],
  },
  {
    value: 'terrain',
    label: 'Terrain nu',
    icon: <Trees className="w-5 h-5" />,
  },
];

const DPE_OPTIONS = [
  { value: 'A', label: 'A', color: 'bg-green-600' },
  { value: 'B', label: 'B', color: 'bg-green-500' },
  { value: 'C', label: 'C', color: 'bg-yellow-400' },
  { value: 'D', label: 'D', color: 'bg-yellow-500' },
  { value: 'E', label: 'E', color: 'bg-orange-400' },
  { value: 'F', label: 'F', color: 'bg-orange-500' },
  { value: 'G', label: 'G', color: 'bg-red-500' },
  { value: 'non_requis', label: 'Non requis', color: 'bg-gray-400' },
];

const OCCUPANCY_TYPE_OPTIONS = [
  { value: 'owner', label: 'Occupé par le propriétaire' },
  { value: 'tenant', label: 'Loué (locataire en place)' },
  { value: 'vacant', label: 'Vacant / Libre' },
  { value: 'mixed', label: 'Mixte (plusieurs occupants)' },
];

interface AddressSuggestion {
  label: string;
  street: string;
  postalCode: string;
  city: string;
  coordinates?: { lat: number; lng: number };
}

// =============================================================================
// COMPOSANT PRINCIPAL
// =============================================================================

export function StepSiteAddress({
  project,
  answers,
  onAnswerChange,
  onAnswersChange,
  errors,
  isProcessing,
}: StepComponentProps) {
  // Récupération des données existantes
  const client = (project.client || {}) as Record<string, unknown>;
  const site = (client.site || {}) as Record<string, unknown>;
  const address = (site.address || {}) as Record<string, unknown>;
  const characteristics = (site.characteristics || {}) as Record<string, unknown>;
  const accessConstraints = (site.accessConstraints || {}) as Record<string, unknown>;
  const occupancy = (site.occupancy || {}) as Record<string, unknown>;

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressValidated, setAddressValidated] = useState(false);

  // Valeurs courantes
  const siteType = (site.siteType as SiteType) || (answers['client.site.siteType'] as SiteType);
  const currentStreet = (address.streetName as string) || (answers['client.site.address.streetName'] as string) || '';
  const currentPostalCode = (address.postalCode as string) || (answers['client.site.address.postalCode'] as string) || '';
  const currentCity = (address.city as string) || (answers['client.site.address.city'] as string) || '';

  // Recherche d'adresse via API BAN
  const searchAddress = useCallback(async () => {
    if (!searchQuery || searchQuery.length < 5) return;

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(searchQuery)}&limit=5`
      );
      const data = await response.json();

      const results: AddressSuggestion[] = data.features?.map((feature: Record<string, unknown>) => {
        const props = feature.properties as Record<string, string>;
        const geometry = feature.geometry as { coordinates: number[] };
        return {
          label: props.label,
          street: props.name || props.street || '',
          postalCode: props.postcode || '',
          city: props.city || '',
          coordinates: geometry?.coordinates ? {
            lng: geometry.coordinates[0],
            lat: geometry.coordinates[1],
          } : undefined,
        };
      }) || [];

      setSuggestions(results);
    } catch (err) {
      console.error('Erreur recherche adresse:', err);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  // Sélection d'une suggestion
  const selectAddress = useCallback((suggestion: AddressSuggestion) => {
    onAnswersChange({
      'client.site.address.streetName': suggestion.street,
      'client.site.address.postalCode': suggestion.postalCode,
      'client.site.address.city': suggestion.city,
      'client.site.address.coordinates': suggestion.coordinates,
      'client.site.address.country': 'France',
    });
    setAddressValidated(true);
    setSuggestions([]);
    setSearchQuery('');
  }, [onAnswersChange]);

  // Déterminer les contraintes associées au type de site
  const siteTypeOption = SITE_TYPE_OPTIONS.find(o => o.value === siteType);
  const siteConstraints = siteTypeOption?.constraints || [];

  // Insights dynamiques
  const getInsights = () => {
    const insights: string[] = [];

    if (siteType === 'erp') {
      insights.push('📋 Réglementation ERP applicable - vérification conformité');
      insights.push('🔥 Commission de sécurité potentiellement requise');
    }

    if (siteType === 'appartement' || siteType === 'immeuble') {
      insights.push('🏢 Vérification règlement de copropriété');
      insights.push('📝 Déclaration de travaux au syndic');
    }

    const dpeValue = characteristics.dpeRating as string || answers['client.site.characteristics.dpeRating'] as string;
    if (dpeValue && ['E', 'F', 'G'].includes(dpeValue)) {
      insights.push('⚡ Passoire énergétique - éligibilité MaPrimeRénov\' renforcée');
    }

    const occupancyType = occupancy.occupancyType as string || answers['client.site.occupancy.occupancyType'] as string;
    if (occupancyType === 'tenant') {
      insights.push('👥 Locataire en place - coordination nécessaire');
    }

    return insights;
  };

  const insights = getInsights();

  return (
    <div className="space-y-8">
      {/* Type de site */}
      <div className="space-y-4">
        <Label className="text-base font-medium">Type de site *</Label>
        <RadioGroup
          value={siteType || ''}
          onValueChange={(value) => onAnswerChange('client.site.siteType', value)}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
        >
          {SITE_TYPE_OPTIONS.map((option) => (
            <label
              key={option.value}
              htmlFor={`site-type-${option.value}`}
              className={`
                relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all
                ${siteType === option.value
                  ? 'border-primary bg-primary/5'
                  : 'border-muted hover:border-primary/50'
                }
              `}
            >
              <RadioGroupItem
                value={option.value}
                id={`site-type-${option.value}`}
                className="sr-only"
              />
              <span className={siteType === option.value ? 'text-primary' : 'text-muted-foreground'}>
                {option.icon}
              </span>
              <span className="text-sm font-medium text-center">{option.label}</span>
              {option.description && (
                <span className="text-xs text-muted-foreground text-center">{option.description}</span>
              )}
            </label>
          ))}
        </RadioGroup>

        {/* Contraintes associées au type */}
        {siteConstraints.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {siteConstraints.map((constraint) => (
              <Badge key={constraint} variant="outline" className="text-xs">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {constraint}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Adresse du site */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Adresse des travaux
          </CardTitle>
          <CardDescription>
            Lieu d'exécution du chantier
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Nom du site (optionnel) */}
          <div className="space-y-2">
            <Label htmlFor="siteName">Nom / Référence du site</Label>
            <Input
              id="siteName"
              value={(site.siteName as string) || (answers['client.site.siteName'] as string) || ''}
              onChange={(e) => onAnswerChange('client.site.siteName', e.target.value)}
              placeholder="Ex: Résidence Les Jardins, Agence Centre-Ville..."
              disabled={isProcessing}
            />
          </div>

          {/* Champ de recherche */}
          <div className="space-y-2">
            <Label htmlFor="address-search">Rechercher l'adresse</Label>
            <div className="flex gap-2">
              <Input
                id="address-search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchAddress()}
                placeholder="Ex: 15 rue de la Paix, Paris"
                disabled={isProcessing}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={searchAddress}
                disabled={isSearching || searchQuery.length < 5}
              >
                {isSearching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="border rounded-lg divide-y">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => selectAddress(suggestion)}
                  className="w-full px-4 py-3 text-left hover:bg-muted transition-colors flex items-center gap-3"
                >
                  <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm">{suggestion.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Adresse validée */}
          {addressValidated && currentStreet && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                Adresse validée : {currentStreet}, {currentPostalCode} {currentCity}
              </AlertDescription>
            </Alert>
          )}

          {/* Saisie manuelle */}
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-4">
              Ou saisissez l'adresse manuellement :
            </p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="street">Adresse (numéro et rue) *</Label>
                <Input
                  id="street"
                  value={currentStreet}
                  onChange={(e) => {
                    onAnswerChange('client.site.address.streetName', e.target.value);
                    setAddressValidated(false);
                  }}
                  placeholder="15 rue de la Paix"
                  disabled={isProcessing}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="complement">Complément d'adresse</Label>
                <Input
                  id="complement"
                  value={(address.complement as string) || (answers['client.site.address.complement'] as string) || ''}
                  onChange={(e) => onAnswerChange('client.site.address.complement', e.target.value)}
                  placeholder="Bâtiment A, Escalier 2, 3ème étage..."
                  disabled={isProcessing}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Code postal *</Label>
                  <Input
                    id="postalCode"
                    value={currentPostalCode}
                    onChange={(e) => {
                      onAnswerChange('client.site.address.postalCode', e.target.value);
                      setAddressValidated(false);
                    }}
                    placeholder="75001"
                    maxLength={5}
                    disabled={isProcessing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Ville *</Label>
                  <Input
                    id="city"
                    value={currentCity}
                    onChange={(e) => {
                      onAnswerChange('client.site.address.city', e.target.value);
                      setAddressValidated(false);
                    }}
                    placeholder="Paris"
                    disabled={isProcessing}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Caractéristiques du site */}
      {siteType && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Caractéristiques du site
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="totalArea">Surface totale (m²)</Label>
                <Input
                  id="totalArea"
                  type="number"
                  value={(characteristics.totalArea as string) || (answers['client.site.characteristics.totalArea'] as string) || ''}
                  onChange={(e) => onAnswerChange('client.site.characteristics.totalArea', parseFloat(e.target.value) || '')}
                  placeholder="150"
                  disabled={isProcessing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="interventionArea">Surface d'intervention (m²)</Label>
                <Input
                  id="interventionArea"
                  type="number"
                  value={(characteristics.interventionArea as string) || (answers['client.site.characteristics.interventionArea'] as string) || ''}
                  onChange={(e) => onAnswerChange('client.site.characteristics.interventionArea', parseFloat(e.target.value) || '')}
                  placeholder="80"
                  disabled={isProcessing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="constructionYear">Année de construction</Label>
                <Input
                  id="constructionYear"
                  type="number"
                  value={(characteristics.constructionYear as string) || (answers['client.site.characteristics.constructionYear'] as string) || ''}
                  onChange={(e) => onAnswerChange('client.site.characteristics.constructionYear', parseInt(e.target.value) || '')}
                  placeholder="1985"
                  min={1800}
                  max={new Date().getFullYear()}
                  disabled={isProcessing}
                />
              </div>
            </div>

            {/* Étage(s) / niveaux */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="levels">Nombre de niveaux</Label>
                <Input
                  id="levels"
                  type="number"
                  value={(characteristics.levels as string) || (answers['client.site.characteristics.levels'] as string) || ''}
                  onChange={(e) => onAnswerChange('client.site.characteristics.levels', parseInt(e.target.value) || '')}
                  placeholder="2"
                  min={1}
                  disabled={isProcessing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="floors">Étage(s) concerné(s)</Label>
                <Input
                  id="floors"
                  value={(characteristics.floors as string) || (answers['client.site.characteristics.floors'] as string) || ''}
                  onChange={(e) => onAnswerChange('client.site.characteristics.floors', e.target.value)}
                  placeholder="Ex: RDC, 1er, 2ème..."
                  disabled={isProcessing}
                />
              </div>
            </div>

            {/* DPE */}
            <div className="space-y-3">
              <Label>DPE actuel (si connu)</Label>
              <div className="flex flex-wrap gap-2">
                {DPE_OPTIONS.map((option) => {
                  const currentDpe = (characteristics.dpeRating as string) ||
                    (answers['client.site.characteristics.dpeRating'] as string);
                  const isSelected = currentDpe === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onAnswerChange('client.site.characteristics.dpeRating', option.value)}
                      disabled={isProcessing}
                      className={`
                        w-10 h-10 rounded-lg font-bold text-white transition-all
                        ${option.color}
                        ${isSelected ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'opacity-70 hover:opacity-100'}
                      `}
                    >
                      {option.label !== 'Non requis' ? option.label : '—'}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contraintes d'accès */}
      {siteType && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Car className="w-5 h-5 text-primary" />
              Accès et contraintes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="vehicleAccess"
                  checked={
                    (accessConstraints.vehicleAccess as boolean) ??
                    (answers['client.site.accessConstraints.vehicleAccess'] as boolean) ?? false
                  }
                  onCheckedChange={(checked) => onAnswerChange('client.site.accessConstraints.vehicleAccess', checked)}
                  disabled={isProcessing}
                />
                <Label htmlFor="vehicleAccess" className="cursor-pointer">
                  Accès véhicule possible
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="parkingAvailable"
                  checked={
                    (accessConstraints.parkingAvailable as boolean) ??
                    (answers['client.site.accessConstraints.parkingAvailable'] as boolean) ?? false
                  }
                  onCheckedChange={(checked) => onAnswerChange('client.site.accessConstraints.parkingAvailable', checked)}
                  disabled={isProcessing}
                />
                <Label htmlFor="parkingAvailable" className="cursor-pointer">
                  Stationnement disponible
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="elevatorAvailable"
                  checked={
                    (accessConstraints.elevatorAvailable as boolean) ??
                    (answers['client.site.accessConstraints.elevatorAvailable'] as boolean) ?? false
                  }
                  onCheckedChange={(checked) => onAnswerChange('client.site.accessConstraints.elevatorAvailable', checked)}
                  disabled={isProcessing}
                />
                <Label htmlFor="elevatorAvailable" className="cursor-pointer">
                  Ascenseur disponible
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeRestrictions">Restrictions horaires</Label>
              <Input
                id="timeRestrictions"
                value={(accessConstraints.timeRestrictions as string) || (answers['client.site.accessConstraints.timeRestrictions'] as string) || ''}
                onChange={(e) => onAnswerChange('client.site.accessConstraints.timeRestrictions', e.target.value)}
                placeholder="Ex: Travaux bruyants interdits avant 8h et après 19h"
                disabled={isProcessing}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Occupation */}
      {siteType && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Occupation du site
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Statut d'occupation</Label>
                <Select
                  value={(occupancy.occupancyType as string) || (answers['client.site.occupancy.occupancyType'] as string) || ''}
                  onValueChange={(value) => onAnswerChange('client.site.occupancy.occupancyType', value)}
                  disabled={isProcessing}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez..." />
                  </SelectTrigger>
                  <SelectContent>
                    {OCCUPANCY_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2 pt-8">
                <Checkbox
                  id="occupiedDuringWorks"
                  checked={
                    (occupancy.occupiedDuringWorks as boolean) ??
                    (answers['client.site.occupancy.occupiedDuringWorks'] as boolean) ?? false
                  }
                  onCheckedChange={(checked) => onAnswerChange('client.site.occupancy.occupiedDuringWorks', checked)}
                  disabled={isProcessing}
                />
                <Label htmlFor="occupiedDuringWorks" className="cursor-pointer">
                  Site occupé pendant les travaux
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="occupancyConstraints">Contraintes liées à l'occupation</Label>
              <Input
                id="occupancyConstraints"
                value={(occupancy.occupancyConstraints as string) || (answers['client.site.occupancy.occupancyConstraints'] as string) || ''}
                onChange={(e) => onAnswerChange('client.site.occupancy.occupancyConstraints', e.target.value)}
                placeholder="Ex: Personne âgée, activité professionnelle maintenue..."
                disabled={isProcessing}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insights contextuels */}
      {insights.length > 0 && (
        <Alert className="bg-amber-50 border-amber-200">
          <Lightbulb className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            <div className="text-amber-800">
              <strong className="block mb-2">Points identifiés pour ce site :</strong>
              <ul className="space-y-1">
                {insights.map((insight, index) => (
                  <li key={index} className="text-sm">{insight}</li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Info géolocalisation */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          L'adresse sera utilisée pour identifier les risques naturels, les contraintes
          réglementaires (PLU, zone patrimoniale) et estimer les coûts selon la localisation.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export default StepSiteAddress;

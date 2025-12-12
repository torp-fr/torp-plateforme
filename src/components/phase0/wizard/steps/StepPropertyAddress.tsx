/**
 * Étape 2 - Identification du bien
 * Collecte l'adresse et le type de bien
 */

import React, { useState, useCallback } from 'react';
import { StepComponentProps } from '../WizardContainer';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Home, Building, Building2, Factory, Trees, MapPin, Search, Loader2, CheckCircle2, Info
} from 'lucide-react';
import { PropertyType } from '@/types/phase0/property.types';

const PROPERTY_TYPE_OPTIONS: Array<{
  value: PropertyType;
  label: string;
  icon: React.ReactNode;
  description?: string;
}> = [
  { value: 'apartment', label: 'Appartement', icon: <Building className="w-5 h-5" /> },
  { value: 'house', label: 'Maison', icon: <Home className="w-5 h-5" /> },
  { value: 'villa', label: 'Villa', icon: <Home className="w-5 h-5" /> },
  { value: 'loft', label: 'Loft', icon: <Building2 className="w-5 h-5" /> },
  { value: 'studio', label: 'Studio', icon: <Building className="w-5 h-5" /> },
  { value: 'building', label: 'Immeuble', icon: <Building2 className="w-5 h-5" /> },
  { value: 'commercial', label: 'Local commercial', icon: <Building2 className="w-5 h-5" /> },
  { value: 'office', label: 'Bureau', icon: <Building2 className="w-5 h-5" /> },
  { value: 'warehouse', label: 'Entrepôt', icon: <Factory className="w-5 h-5" /> },
  { value: 'land', label: 'Terrain', icon: <Trees className="w-5 h-5" /> },
];

interface AddressSuggestion {
  label: string;
  street: string;
  postalCode: string;
  city: string;
  coordinates?: { lat: number; lng: number };
}

export function StepPropertyAddress({
  project,
  answers,
  onAnswerChange,
  onAnswersChange,
  errors,
  isProcessing,
}: StepComponentProps) {
  const property = (project.property || {}) as Record<string, unknown>;
  const address = (property.address || {}) as Record<string, unknown>;
  const characteristics = (property.characteristics || {}) as Record<string, unknown>;

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressValidated, setAddressValidated] = useState(false);

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
      'property.address.street': suggestion.street,
      'property.address.postalCode': suggestion.postalCode,
      'property.address.city': suggestion.city,
      'property.address.coordinates': suggestion.coordinates,
    });
    setAddressValidated(true);
    setSuggestions([]);
    setSearchQuery('');
  }, [onAnswersChange]);

  const propertyType = (characteristics.type as PropertyType) ||
    (answers['property.characteristics.type'] as PropertyType);

  const currentStreet = (address.street as string) || (answers['property.address.street'] as string) || '';
  const currentPostalCode = (address.postalCode as string) || (answers['property.address.postalCode'] as string) || '';
  const currentCity = (address.city as string) || (answers['property.address.city'] as string) || '';

  return (
    <div className="space-y-8">
      {/* Type de bien */}
      <div className="space-y-4">
        <Label className="text-base font-medium">Type de bien *</Label>
        <RadioGroup
          value={propertyType || ''}
          onValueChange={(value) => onAnswerChange('property.characteristics.type', value)}
          className="grid grid-cols-2 md:grid-cols-5 gap-3"
        >
          {PROPERTY_TYPE_OPTIONS.map((option) => (
            <label
              key={option.value}
              htmlFor={`property-type-${option.value}`}
              className={`
                relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all
                ${propertyType === option.value
                  ? 'border-primary bg-primary/5'
                  : 'border-muted hover:border-primary/50'
                }
              `}
            >
              <RadioGroupItem
                value={option.value}
                id={`property-type-${option.value}`}
                className="sr-only"
              />
              <span className={propertyType === option.value ? 'text-primary' : 'text-muted-foreground'}>
                {option.icon}
              </span>
              <span className="text-sm font-medium text-center">{option.label}</span>
            </label>
          ))}
        </RadioGroup>
      </div>

      {/* Recherche d'adresse */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Adresse du bien
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Champ de recherche */}
          <div className="space-y-2">
            <Label htmlFor="address-search">Rechercher une adresse</Label>
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
            <p className="text-xs text-muted-foreground">
              Utilisez la recherche pour une saisie rapide et précise
            </p>
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
            <Alert>
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
                    onAnswerChange('property.address.street', e.target.value);
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
                  value={(address.complement as string) || (answers['property.address.complement'] as string) || ''}
                  onChange={(e) => onAnswerChange('property.address.complement', e.target.value)}
                  placeholder="Bâtiment A, Appartement 12..."
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
                      onAnswerChange('property.address.postalCode', e.target.value);
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
                      onAnswerChange('property.address.city', e.target.value);
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

      {/* Info géolocalisation */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          L'adresse sera utilisée pour identifier les risques naturels, les contraintes
          réglementaires (PLU, zone patrimoniale) et estimer les coûts locaux.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export default StepPropertyAddress;

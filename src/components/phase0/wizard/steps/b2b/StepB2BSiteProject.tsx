/**
 * Étape 2 B2B - Site & Projet
 * Adresse, caractéristiques du site et type de projet
 */

import React, { useState, useCallback } from 'react';
import { StepComponentProps } from '../../WizardContainer';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Home, Building, Building2, Factory, MapPin, Search, Loader2,
  CheckCircle2, Car, Users, Hammer, Wrench, ThermometerSun, Shield
} from 'lucide-react';

// Types de site
const SITE_TYPES = [
  { value: 'appartement', label: 'Appartement', icon: <Building className="w-5 h-5" /> },
  { value: 'maison', label: 'Maison', icon: <Home className="w-5 h-5" /> },
  { value: 'immeuble', label: 'Immeuble', icon: <Building2 className="w-5 h-5" /> },
  { value: 'local_commercial', label: 'Local commercial', icon: <Building2 className="w-5 h-5" /> },
  { value: 'bureaux', label: 'Bureaux', icon: <Building2 className="w-5 h-5" /> },
  { value: 'erp', label: 'ERP', icon: <Users className="w-5 h-5" /> },
  { value: 'industriel', label: 'Industriel', icon: <Factory className="w-5 h-5" /> },
];

// Types de projet
const PROJECT_TYPES = [
  { value: 'renovation', label: 'Rénovation', icon: <Hammer className="w-5 h-5" />, desc: 'Rénover ou moderniser' },
  { value: 'refurbishment', label: 'Réhabilitation', icon: <Wrench className="w-5 h-5" />, desc: 'Remise aux normes' },
  { value: 'extension', label: 'Extension', icon: <Building className="w-5 h-5" />, desc: 'Agrandir la surface' },
  { value: 'improvement', label: 'Amélioration', icon: <ThermometerSun className="w-5 h-5" />, desc: 'Performance énergétique' },
  { value: 'maintenance', label: 'Entretien', icon: <Shield className="w-5 h-5" />, desc: 'Maintenance préventive' },
  { value: 'new_construction', label: 'Construction', icon: <Home className="w-5 h-5" />, desc: 'Construction neuve' },
];

// Occupation
const OCCUPANCY_TYPES = [
  { value: 'vacant', label: 'Vacant / Libre' },
  { value: 'owner', label: 'Occupé propriétaire' },
  { value: 'tenant', label: 'Loué (locataire)' },
  { value: 'mixed', label: 'Mixte' },
];

interface AddressSuggestion {
  label: string;
  street: string;
  postalCode: string;
  city: string;
}

export function StepB2BSiteProject({
  project,
  answers,
  onAnswerChange,
  onAnswersChange,
  isProcessing,
}: StepComponentProps) {
  // Utiliser property.identification pour compatibilité avec la validation
  const property = (project.property || {}) as Record<string, unknown>;
  const identification = (property.identification || {}) as Record<string, unknown>;
  const address = (identification.address || {}) as Record<string, unknown>;
  const workProject = (project.workProject || {}) as Record<string, unknown>;
  const general = (workProject.general || {}) as Record<string, unknown>;

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressValidated, setAddressValidated] = useState(false);

  const getValue = (path: string) => {
    if (path.startsWith('property.')) {
      return answers[path] ?? getNestedValue(property, path.replace('property.', '')) ?? '';
    }
    if (path.startsWith('workProject.')) {
      return answers[path] ?? getNestedValue(workProject, path.replace('workProject.', '')) ?? '';
    }
    return answers[path] ?? '';
  };

  // Type de bien (utilisé comme type de site en B2B)
  const siteType = (identification.type as string) || (answers['property.identification.type'] as string) || '';
  const projectType = getValue('workProject.general.projectType') as string;
  const currentStreet = getValue('property.identification.address.streetName') as string;
  const currentPostalCode = getValue('property.identification.address.postalCode') as string;
  const currentCity = getValue('property.identification.address.city') as string;

  // Recherche adresse API BAN
  const searchAddress = useCallback(async () => {
    if (!searchQuery || searchQuery.length < 5) return;
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(searchQuery)}&limit=5`
      );
      const data = await response.json();
      const results: AddressSuggestion[] = data.features?.map((f: Record<string, unknown>) => {
        const props = f.properties as Record<string, string>;
        return {
          label: props.label,
          street: props.name || props.street || '',
          postalCode: props.postcode || '',
          city: props.city || '',
        };
      }) || [];
      setSuggestions(results);
    } catch (err) {
      console.error('Erreur recherche:', err);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  const selectAddress = useCallback((suggestion: AddressSuggestion) => {
    // Utiliser les chemins corrects pour compatibilité avec la validation
    onAnswersChange({
      'property.identification.address.streetName': suggestion.street,
      'property.identification.address.postalCode': suggestion.postalCode,
      'property.identification.address.city': suggestion.city,
      'property.identification.address.country': 'France',
    });
    setAddressValidated(true);
    setSuggestions([]);
    setSearchQuery('');
  }, [onAnswersChange]);

  return (
    <div className="space-y-6">
      {/* Type de site */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Type de site</Label>
        <RadioGroup
          value={siteType}
          onValueChange={(v) => onAnswerChange('property.identification.type', v)}
          className="grid grid-cols-2 md:grid-cols-4 gap-2"
        >
          {SITE_TYPES.map((type) => (
            <label
              key={type.value}
              className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all
                ${siteType === type.value ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'}`}
            >
              <RadioGroupItem value={type.value} className="sr-only" />
              <span className={siteType === type.value ? 'text-primary' : 'text-muted-foreground'}>
                {type.icon}
              </span>
              <span className="text-xs font-medium text-center">{type.label}</span>
            </label>
          ))}
        </RadioGroup>
      </div>

      {/* Adresse */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Adresse des travaux
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Recherche */}
          <div className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchAddress()}
              placeholder="Rechercher une adresse..."
              className="flex-1"
            />
            <Button variant="outline" onClick={searchAddress} disabled={isSearching || searchQuery.length < 5}>
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="border rounded-lg divide-y">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectAddress(s)}
                  className="w-full px-4 py-3 text-left hover:bg-muted transition-colors flex items-center gap-3"
                >
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{s.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Adresse validée */}
          {addressValidated && currentStreet && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                {currentStreet}, {currentPostalCode} {currentCity}
              </AlertDescription>
            </Alert>
          )}

          {/* Saisie manuelle */}
          <div className="grid grid-cols-1 gap-4 pt-2">
            <Input
              value={currentStreet}
              onChange={(e) => { onAnswerChange('property.identification.address.streetName', e.target.value); setAddressValidated(false); }}
              placeholder="Adresse (numéro et rue)"
              disabled={isProcessing}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                value={currentPostalCode}
                onChange={(e) => { onAnswerChange('property.identification.address.postalCode', e.target.value); setAddressValidated(false); }}
                placeholder="Code postal"
                maxLength={5}
                disabled={isProcessing}
              />
              <Input
                value={currentCity}
                onChange={(e) => { onAnswerChange('property.identification.address.city', e.target.value); setAddressValidated(false); }}
                placeholder="Ville"
                disabled={isProcessing}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Caractéristiques & Occupation */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Caractéristiques</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Surface (m²)</Label>
              <Input
                type="number"
                value={getValue('property.characteristics.livingArea') as string}
                onChange={(e) => onAnswerChange('property.characteristics.livingArea', parseFloat(e.target.value) || '')}
                placeholder="150"
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <Label>Année construction</Label>
              <Input
                type="number"
                value={getValue('property.construction.year') as string}
                onChange={(e) => onAnswerChange('property.construction.year', parseInt(e.target.value) || '')}
                placeholder="1985"
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <Label>Niveaux</Label>
              <Input
                type="number"
                value={getValue('property.characteristics.levels') as string}
                onChange={(e) => onAnswerChange('property.characteristics.levels', parseInt(e.target.value) || '')}
                placeholder="2"
                min={1}
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <Label>Occupation</Label>
              <Select
                value={getValue('workProject.constraints.occupancy.duringWorks') as string}
                onValueChange={(v) => onAnswerChange('workProject.constraints.occupancy.duringWorks', v)}
                disabled={isProcessing}
              >
                <SelectTrigger><SelectValue placeholder="Statut" /></SelectTrigger>
                <SelectContent>
                  {OCCUPANCY_TYPES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Accès */}
          <div className="flex flex-wrap gap-4 pt-2">
            {[
              { id: 'vehicleAccess', label: 'Accès véhicule', icon: <Car className="w-4 h-4" /> },
              { id: 'parkingAvailable', label: 'Stationnement', icon: <Car className="w-4 h-4" /> },
              { id: 'elevatorAvailable', label: 'Ascenseur', icon: <Building className="w-4 h-4" /> },
            ].map((item) => (
              <label key={item.id} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={getValue(`workProject.constraints.physical.${item.id}`) as boolean || false}
                  onCheckedChange={(c) => onAnswerChange(`workProject.constraints.physical.${item.id}`, c)}
                  disabled={isProcessing}
                />
                <span className="text-sm">{item.label}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Type de projet */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Hammer className="w-5 h-5 text-primary" />
            Type de projet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={projectType}
            onValueChange={(v) => onAnswerChange('workProject.general.projectType', v)}
            className="grid grid-cols-2 md:grid-cols-3 gap-3"
          >
            {PROJECT_TYPES.map((type) => (
              <label
                key={type.value}
                className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
                  ${projectType === type.value ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'}`}
              >
                <RadioGroupItem value={type.value} className="mt-0.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className={projectType === type.value ? 'text-primary' : 'text-muted-foreground'}>
                      {type.icon}
                    </span>
                    <span className="font-medium">{type.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{type.desc}</p>
                </div>
              </label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>
    </div>
  );
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, part) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
    return undefined;
  }, obj);
}

export default StepB2BSiteProject;

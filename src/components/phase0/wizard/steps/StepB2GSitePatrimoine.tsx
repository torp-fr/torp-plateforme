/**
 * Étape B2G 2 - Type de projet
 * Sélection multiple des domaines d'intervention et caractéristiques du projet
 */

import React, { useState, useCallback } from 'react';
import { StepComponentProps } from '../WizardContainer';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Building2, MapPin, Search, Loader2, CheckCircle2, TreePine, Droplets, Route,
  Construction, Info, Zap, Wrench, Plus, X
} from 'lucide-react';

// Domaines d'intervention (sélection multiple)
const PROJECT_DOMAINS = [
  { id: 'batiment', label: 'Bâtiment', icon: Building2, color: 'blue' },
  { id: 'voirie', label: 'Voirie & VRD', icon: Route, color: 'orange' },
  { id: 'reseaux', label: 'Réseaux', icon: Droplets, color: 'cyan' },
  { id: 'espaces_verts', label: 'Espaces verts', icon: TreePine, color: 'green' },
  { id: 'energie', label: 'Énergie', icon: Zap, color: 'yellow' },
  { id: 'equipements', label: 'Équipements', icon: Wrench, color: 'purple' },
];

// Types détaillés par domaine
const DOMAIN_TYPES: Record<string, Array<{ value: string; label: string }>> = {
  batiment: [
    { value: 'mairie', label: 'Mairie / Hôtel de ville' },
    { value: 'ecole', label: 'École / Groupe scolaire' },
    { value: 'college_lycee', label: 'Collège / Lycée' },
    { value: 'petite_enfance', label: 'Crèche / Multi-accueil' },
    { value: 'sport', label: 'Équipement sportif' },
    { value: 'culture', label: 'Médiathèque / Salle des fêtes' },
    { value: 'technique', label: 'Bâtiment technique' },
    { value: 'logement', label: 'Logement social' },
    { value: 'autre_bat', label: 'Autre bâtiment ERP' },
  ],
  voirie: [
    { value: 'voie_communale', label: 'Voie communale' },
    { value: 'place', label: 'Place / Parvis' },
    { value: 'parking', label: 'Parking' },
    { value: 'trottoir', label: 'Trottoirs / Cheminements' },
    { value: 'piste_cyclable', label: 'Piste cyclable' },
    { value: 'carrefour', label: 'Carrefour / Giratoire' },
    { value: 'ouvrage_art', label: 'Pont / Ouvrage d\'art' },
  ],
  reseaux: [
    { value: 'eau', label: 'Eau potable' },
    { value: 'assainissement', label: 'Assainissement EU/EP' },
    { value: 'eclairage', label: 'Éclairage public' },
    { value: 'telecom', label: 'Télécoms / Fibre' },
    { value: 'chauffage', label: 'Chauffage urbain' },
  ],
  espaces_verts: [
    { value: 'parc', label: 'Parc / Jardin' },
    { value: 'aire_jeux', label: 'Aire de jeux' },
    { value: 'terrain_sport', label: 'Terrain de sport' },
    { value: 'cimetiere', label: 'Cimetière' },
    { value: 'mobilier', label: 'Mobilier urbain' },
  ],
  energie: [
    { value: 'photovoltaique', label: 'Photovoltaïque' },
    { value: 'thermique', label: 'Rénovation thermique' },
    { value: 'chaufferie', label: 'Chaufferie / PAC' },
    { value: 'gth', label: 'GTB / GTC' },
  ],
  equipements: [
    { value: 'cuisine', label: 'Cuisine collective' },
    { value: 'video', label: 'Vidéoprotection' },
    { value: 'accessibilite', label: 'Accessibilité PMR' },
    { value: 'securite', label: 'Sécurité incendie' },
  ],
};

// Natures d'opération
const OPERATION_TYPES = [
  { value: 'construction', label: 'Construction neuve' },
  { value: 'renovation', label: 'Rénovation' },
  { value: 'rehabilitation', label: 'Réhabilitation lourde' },
  { value: 'extension', label: 'Extension' },
  { value: 'requalification', label: 'Requalification' },
  { value: 'mise_normes', label: 'Mise aux normes' },
  { value: 'entretien', label: 'Gros entretien' },
  { value: 'demolition', label: 'Démolition' },
];

interface AddressSuggestion {
  label: string;
  street: string;
  postalCode: string;
  city: string;
}

export function StepB2GSitePatrimoine({
  project,
  answers,
  onAnswerChange,
  onAnswersChange,
  isProcessing,
}: StepComponentProps) {
  const property = (project.property || {}) as Record<string, unknown>;
  const workProject = (project.workProject || {}) as Record<string, unknown>;

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);

  const getValue = (path: string) => {
    if (path.startsWith('property.')) {
      return answers[path] ?? getNestedValue(property, path.replace('property.', '')) ?? '';
    }
    if (path.startsWith('workProject.')) {
      return answers[path] ?? getNestedValue(workProject, path.replace('workProject.', '')) ?? '';
    }
    return answers[path] ?? '';
  };

  // Domaines sélectionnés (tableau)
  const selectedDomains = (getValue('workProject.domains') as string[]) || [];
  const selectedTypes = (getValue('property.identification.types') as string[]) || [];
  const operationType = getValue('workProject.general.projectType') as string;

  // Toggle domain selection
  const toggleDomain = (domainId: string) => {
    const newDomains = selectedDomains.includes(domainId)
      ? selectedDomains.filter(d => d !== domainId)
      : [...selectedDomains, domainId];
    onAnswerChange('workProject.domains', newDomains);
  };

  // Toggle type selection
  const toggleType = (typeValue: string) => {
    const newTypes = selectedTypes.includes(typeValue)
      ? selectedTypes.filter(t => t !== typeValue)
      : [...selectedTypes, typeValue];
    onAnswerChange('property.identification.types', newTypes);
  };

  // Recherche adresse
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
    onAnswersChange({
      'property.identification.address.streetName': suggestion.street,
      'property.identification.address.postalCode': suggestion.postalCode,
      'property.identification.address.city': suggestion.city,
    });
    setSuggestions([]);
    setSearchQuery('');
  }, [onAnswersChange]);

  // Types disponibles selon les domaines sélectionnés
  const availableTypes = selectedDomains.flatMap(domain =>
    (DOMAIN_TYPES[domain] || []).map(t => ({ ...t, domain }))
  );

  const getColorClass = (color: string, selected: boolean) => {
    const colors: Record<string, string> = {
      blue: selected ? 'bg-blue-100 border-blue-500 text-blue-700' : 'hover:border-blue-300',
      orange: selected ? 'bg-orange-100 border-orange-500 text-orange-700' : 'hover:border-orange-300',
      cyan: selected ? 'bg-cyan-100 border-cyan-500 text-cyan-700' : 'hover:border-cyan-300',
      green: selected ? 'bg-green-100 border-green-500 text-green-700' : 'hover:border-green-300',
      yellow: selected ? 'bg-yellow-100 border-yellow-500 text-yellow-700' : 'hover:border-yellow-300',
      purple: selected ? 'bg-purple-100 border-purple-500 text-purple-700' : 'hover:border-purple-300',
    };
    return colors[color] || '';
  };

  return (
    <div className="space-y-5">
      {/* Domaines d'intervention - sélection multiple */}
      <div>
        <Label className="text-sm font-medium mb-2 block">Domaines d'intervention *</Label>
        <p className="text-xs text-muted-foreground mb-3">Sélectionnez un ou plusieurs domaines concernés par votre projet</p>
        <div className="flex flex-wrap gap-2">
          {PROJECT_DOMAINS.map((domain) => {
            const Icon = domain.icon;
            const isSelected = selectedDomains.includes(domain.id);
            return (
              <button
                key={domain.id}
                type="button"
                onClick={() => toggleDomain(domain.id)}
                disabled={isProcessing}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all
                  ${getColorClass(domain.color, isSelected)}
                  ${!isSelected && 'border-muted bg-background'}`}
              >
                <Icon className="w-4 h-4" />
                {domain.label}
                {isSelected && <CheckCircle2 className="w-4 h-4" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Types détaillés selon domaines */}
      {selectedDomains.length > 0 && (
        <div>
          <Label className="text-sm font-medium mb-2 block">Précisez le(s) type(s)</Label>
          <div className="flex flex-wrap gap-2">
            {availableTypes.map((type) => {
              const isSelected = selectedTypes.includes(type.value);
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => toggleType(type.value)}
                  disabled={isProcessing}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-sm transition-all
                    ${isSelected ? 'bg-primary/10 border-primary text-primary' : 'border-muted hover:border-primary/50'}`}
                >
                  {type.label}
                  {isSelected && <X className="w-3 h-3" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Nature de l'opération */}
      <div>
        <Label className="text-sm font-medium mb-2 block">Nature de l'opération *</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {OPERATION_TYPES.map((op) => {
            const isSelected = operationType === op.value;
            return (
              <button
                key={op.value}
                type="button"
                onClick={() => onAnswerChange('workProject.general.projectType', op.value)}
                disabled={isProcessing}
                className={`px-3 py-2 rounded-lg border text-sm transition-all text-left
                  ${isSelected ? 'bg-primary text-primary-foreground border-primary' : 'border-muted hover:border-primary/50'}`}
              >
                {op.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Localisation compacte */}
      <div className="p-4 bg-muted/30 rounded-lg space-y-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Localisation du projet</Label>
        </div>

        {/* Recherche */}
        <div className="flex gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchAddress()}
            placeholder="Rechercher une adresse..."
            className="h-9"
          />
          <Button variant="outline" size="sm" onClick={searchAddress} disabled={isSearching || searchQuery.length < 5}>
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="border rounded-lg divide-y bg-background">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => selectAddress(s)}
                className="w-full px-3 py-2 text-left hover:bg-muted transition-colors text-sm"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Champs adresse */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input
            value={getValue('property.identification.address.streetName') as string}
            onChange={(e) => onAnswerChange('property.identification.address.streetName', e.target.value)}
            placeholder="Adresse"
            className="h-9 md:col-span-2"
            disabled={isProcessing}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={getValue('property.identification.address.postalCode') as string}
              onChange={(e) => onAnswerChange('property.identification.address.postalCode', e.target.value)}
              placeholder="CP"
              maxLength={5}
              className="h-9"
              disabled={isProcessing}
            />
            <Input
              value={getValue('property.identification.address.city') as string}
              onChange={(e) => onAnswerChange('property.identification.address.city', e.target.value)}
              placeholder="Ville"
              className="h-9"
              disabled={isProcessing}
            />
          </div>
        </div>
      </div>

      {/* Caractéristiques selon domaines */}
      {selectedDomains.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {selectedDomains.includes('batiment') && (
            <>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Surface (m²)</Label>
                <Input
                  type="number"
                  value={getValue('property.characteristics.livingArea') as string}
                  onChange={(e) => onAnswerChange('property.characteristics.livingArea', parseFloat(e.target.value) || '')}
                  placeholder="SHON"
                  className="h-9"
                  disabled={isProcessing}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Année</Label>
                <Input
                  type="number"
                  value={getValue('property.construction.year') as string}
                  onChange={(e) => onAnswerChange('property.construction.year', parseInt(e.target.value) || '')}
                  placeholder="1985"
                  className="h-9"
                  disabled={isProcessing}
                />
              </div>
            </>
          )}
          {(selectedDomains.includes('voirie') || selectedDomains.includes('reseaux')) && (
            <>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Linéaire (ml)</Label>
                <Input
                  type="number"
                  value={getValue('property.characteristics.linearLength') as string}
                  onChange={(e) => onAnswerChange('property.characteristics.linearLength', parseFloat(e.target.value) || '')}
                  placeholder="500"
                  className="h-9"
                  disabled={isProcessing}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Largeur (m)</Label>
                <Input
                  type="number"
                  value={getValue('property.characteristics.width') as string}
                  onChange={(e) => onAnswerChange('property.characteristics.width', parseFloat(e.target.value) || '')}
                  placeholder="6"
                  className="h-9"
                  disabled={isProcessing}
                />
              </div>
            </>
          )}
          {selectedDomains.includes('espaces_verts') && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Surface (m²)</Label>
              <Input
                type="number"
                value={getValue('property.characteristics.areaSize') as string}
                onChange={(e) => onAnswerChange('property.characteristics.areaSize', parseFloat(e.target.value) || '')}
                placeholder="5000"
                className="h-9"
                disabled={isProcessing}
              />
            </div>
          )}
        </div>
      )}

      {/* Description projet */}
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-sm">Intitulé du projet *</Label>
          <Input
            value={getValue('workProject.general.title') as string}
            onChange={(e) => onAnswerChange('workProject.general.title', e.target.value)}
            placeholder="Ex: Rénovation énergétique groupe scolaire Jean Jaurès"
            className="h-9"
            disabled={isProcessing}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-sm">Description / Programme</Label>
          <Textarea
            value={getValue('workProject.general.description') as string}
            onChange={(e) => onAnswerChange('workProject.general.description', e.target.value)}
            placeholder="Décrivez les objectifs, le programme fonctionnel, les contraintes particulières..."
            rows={3}
            disabled={isProcessing}
          />
        </div>
      </div>

      {/* Tags sélectionnés */}
      {(selectedDomains.length > 0 || selectedTypes.length > 0) && (
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          {selectedDomains.map(d => {
            const domain = PROJECT_DOMAINS.find(pd => pd.id === d);
            return domain ? (
              <Badge key={d} variant="secondary" className="text-xs">
                {domain.label}
              </Badge>
            ) : null;
          })}
          {selectedTypes.map(t => {
            const type = availableTypes.find(at => at.value === t);
            return type ? (
              <Badge key={t} variant="outline" className="text-xs">
                {type.label}
              </Badge>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, part) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
    return undefined;
  }, obj);
}

export default StepB2GSitePatrimoine;

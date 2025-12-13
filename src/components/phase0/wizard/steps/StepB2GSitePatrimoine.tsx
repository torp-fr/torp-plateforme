/**
 * Étape B2G 2 - Site & Patrimoine
 * Composant adapté aux collectivités pour différents types de patrimoine:
 * - Bâtiments publics (mairies, écoles, équipements sportifs...)
 * - Voirie et espaces publics
 * - Réseaux (eau, assainissement...)
 * - Espaces verts et aménagements
 */

import React, { useState, useCallback } from 'react';
import { StepComponentProps } from '../WizardContainer';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Building2, Home, School, Landmark, MapPin, Search, Loader2,
  CheckCircle2, Car, TreePine, Droplets, Route, Construction,
  ParkingCircle, Building, Info, Lightbulb
} from 'lucide-react';

// Catégories de patrimoine public
const PATRIMOINE_CATEGORIES = [
  {
    id: 'batiment',
    label: 'Bâtiment public',
    icon: Building2,
    description: 'Mairie, école, équipement sportif, médiathèque...',
    color: 'bg-blue-100 text-blue-700',
  },
  {
    id: 'voirie',
    label: 'Voirie & Espaces publics',
    icon: Route,
    description: 'Routes, rues, places, trottoirs, stationnements...',
    color: 'bg-orange-100 text-orange-700',
  },
  {
    id: 'reseaux',
    label: 'Réseaux techniques',
    icon: Droplets,
    description: 'Eau, assainissement, éclairage public...',
    color: 'bg-cyan-100 text-cyan-700',
  },
  {
    id: 'espaces_verts',
    label: 'Espaces verts & Aménagement',
    icon: TreePine,
    description: 'Parcs, jardins, aires de jeux, mobilier urbain...',
    color: 'bg-green-100 text-green-700',
  },
];

// Types de bâtiments publics
const BATIMENT_TYPES = [
  { value: 'mairie', label: 'Mairie / Hôtel de ville', icon: Landmark },
  { value: 'ecole', label: 'École / Groupe scolaire', icon: School },
  { value: 'college', label: 'Collège', icon: Building2 },
  { value: 'lycee', label: 'Lycée', icon: Building2 },
  { value: 'creche', label: 'Crèche / Multi-accueil', icon: Home },
  { value: 'equipement_sportif', label: 'Équipement sportif', icon: Building },
  { value: 'mediatheque', label: 'Médiathèque / Bibliothèque', icon: Building2 },
  { value: 'salle_polyvalente', label: 'Salle polyvalente / des fêtes', icon: Building },
  { value: 'centre_technique', label: 'Centre technique municipal', icon: Construction },
  { value: 'logement_social', label: 'Logement social', icon: Home },
  { value: 'erp', label: 'Autre ERP', icon: Building2 },
  { value: 'autre_batiment', label: 'Autre bâtiment', icon: Building2 },
];

// Types de voirie
const VOIRIE_TYPES = [
  { value: 'voie_communale', label: 'Voie communale' },
  { value: 'chemin_rural', label: 'Chemin rural' },
  { value: 'place_publique', label: 'Place publique' },
  { value: 'parking', label: 'Parking / Aire de stationnement' },
  { value: 'trottoir', label: 'Trottoirs / Cheminements piétons' },
  { value: 'piste_cyclable', label: 'Piste cyclable / Voie verte' },
  { value: 'carrefour', label: 'Carrefour / Giratoire' },
  { value: 'pont', label: 'Pont / Ouvrage d\'art' },
  { value: 'autre_voirie', label: 'Autre' },
];

// Types de réseaux
const RESEAUX_TYPES = [
  { value: 'eau_potable', label: 'Eau potable' },
  { value: 'assainissement', label: 'Assainissement' },
  { value: 'eaux_pluviales', label: 'Eaux pluviales' },
  { value: 'eclairage_public', label: 'Éclairage public' },
  { value: 'telecom', label: 'Télécommunications / Fibre' },
  { value: 'chauffage_urbain', label: 'Chauffage urbain' },
  { value: 'autre_reseau', label: 'Autre réseau' },
];

// Types d'espaces verts
const ESPACES_VERTS_TYPES = [
  { value: 'parc', label: 'Parc / Jardin public' },
  { value: 'square', label: 'Square' },
  { value: 'aire_jeux', label: 'Aire de jeux' },
  { value: 'terrain_sport', label: 'Terrain de sport extérieur' },
  { value: 'cimetiere', label: 'Cimetière' },
  { value: 'mobilier_urbain', label: 'Mobilier urbain' },
  { value: 'autre_espace', label: 'Autre aménagement' },
];

// Types de projets selon la catégorie
const PROJECT_TYPES = {
  batiment: [
    { value: 'renovation', label: 'Rénovation', desc: 'Modernisation, mise aux normes' },
    { value: 'rehabilitation', label: 'Réhabilitation', desc: 'Réhabilitation lourde' },
    { value: 'extension', label: 'Extension', desc: 'Agrandissement' },
    { value: 'construction', label: 'Construction neuve', desc: 'Nouveau bâtiment' },
    { value: 'demolition', label: 'Démolition', desc: 'Déconstruction' },
    { value: 'accessibilite', label: 'Mise en accessibilité', desc: 'PMR / Handicap' },
    { value: 'thermique', label: 'Rénovation énergétique', desc: 'Performance thermique' },
    { value: 'maintenance', label: 'Entretien / Maintenance', desc: 'Travaux courants' },
  ],
  voirie: [
    { value: 'creation', label: 'Création', desc: 'Nouvelle voie / aménagement' },
    { value: 'requalification', label: 'Requalification', desc: 'Réaménagement complet' },
    { value: 'renforcement', label: 'Renforcement', desc: 'Remise en état de la chaussée' },
    { value: 'securisation', label: 'Sécurisation', desc: 'Aménagements de sécurité' },
    { value: 'accessibilite', label: 'Accessibilité', desc: 'Mise aux normes PMR' },
    { value: 'entretien', label: 'Entretien', desc: 'Travaux courants' },
  ],
  reseaux: [
    { value: 'creation', label: 'Création / Extension', desc: 'Nouveau réseau' },
    { value: 'renouvellement', label: 'Renouvellement', desc: 'Remplacement vétusté' },
    { value: 'mise_aux_normes', label: 'Mise aux normes', desc: 'Conformité réglementaire' },
    { value: 'reparation', label: 'Réparation', desc: 'Travaux ponctuels' },
    { value: 'modernisation', label: 'Modernisation', desc: 'Smart city, télérelève...' },
  ],
  espaces_verts: [
    { value: 'creation', label: 'Création', desc: 'Nouvel espace' },
    { value: 'requalification', label: 'Requalification', desc: 'Réaménagement' },
    { value: 'mise_aux_normes', label: 'Mise aux normes', desc: 'Sécurité, accessibilité' },
    { value: 'entretien', label: 'Gros entretien', desc: 'Travaux importants' },
  ],
};

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
  const identification = (property.identification || {}) as Record<string, unknown>;
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

  // Catégorie de patrimoine sélectionnée
  const patrimoineCategory = getValue('property.identification.patrimoineCategory') as string || 'batiment';
  const patrimoineType = getValue('property.identification.type') as string;
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

  // Obtenir les types selon la catégorie
  const getTypesForCategory = () => {
    switch (patrimoineCategory) {
      case 'batiment': return BATIMENT_TYPES;
      case 'voirie': return VOIRIE_TYPES;
      case 'reseaux': return RESEAUX_TYPES;
      case 'espaces_verts': return ESPACES_VERTS_TYPES;
      default: return BATIMENT_TYPES;
    }
  };

  const getProjectTypesForCategory = () => {
    return PROJECT_TYPES[patrimoineCategory as keyof typeof PROJECT_TYPES] || PROJECT_TYPES.batiment;
  };

  return (
    <div className="space-y-6">
      {/* Catégorie de patrimoine */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Type de patrimoine concerné</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PATRIMOINE_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = patrimoineCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  onAnswerChange('property.identification.patrimoineCategory', cat.id);
                  // Reset le type quand on change de catégorie
                  onAnswerChange('property.identification.type', '');
                }}
                className={`flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-all
                  ${isSelected ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'}`}
                disabled={isProcessing}
              >
                <div className={`p-2 rounded-lg ${cat.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">{cat.label}</div>
                  <p className="text-xs text-muted-foreground mt-1">{cat.description}</p>
                </div>
                {isSelected && <CheckCircle2 className="w-5 h-5 text-primary" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Type spécifique */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">
            {patrimoineCategory === 'batiment' && 'Type de bâtiment'}
            {patrimoineCategory === 'voirie' && 'Type de voirie / espace public'}
            {patrimoineCategory === 'reseaux' && 'Type de réseau'}
            {patrimoineCategory === 'espaces_verts' && 'Type d\'espace'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={patrimoineType}
            onValueChange={(v) => onAnswerChange('property.identification.type', v)}
            disabled={isProcessing}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionnez le type..." />
            </SelectTrigger>
            <SelectContent>
              {getTypesForCategory().map((type) => (
                <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Nom / Désignation */}
          <div className="mt-4 space-y-2">
            <Label>Nom / Désignation</Label>
            <Input
              value={getValue('property.identification.name') as string}
              onChange={(e) => onAnswerChange('property.identification.name', e.target.value)}
              placeholder={
                patrimoineCategory === 'batiment' ? 'Ex: École Paul Bert, Gymnase municipal...' :
                patrimoineCategory === 'voirie' ? 'Ex: Rue de la Mairie, Place du marché...' :
                patrimoineCategory === 'reseaux' ? 'Ex: Réseau AEP quartier Nord...' :
                'Ex: Parc des sports...'
              }
              disabled={isProcessing}
            />
          </div>
        </CardContent>
      </Card>

      {/* Localisation */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Localisation
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
          <div className="grid grid-cols-1 gap-4">
            <Input
              value={currentStreet}
              onChange={(e) => { onAnswerChange('property.identification.address.streetName', e.target.value); setAddressValidated(false); }}
              placeholder="Adresse"
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
                placeholder="Commune"
                disabled={isProcessing}
              />
            </div>
          </div>

          {/* Informations complémentaires voirie/réseaux */}
          {(patrimoineCategory === 'voirie' || patrimoineCategory === 'reseaux') && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <Label>Linéaire approximatif (ml)</Label>
                <Input
                  type="number"
                  value={getValue('property.characteristics.linearLength') as string}
                  onChange={(e) => onAnswerChange('property.characteristics.linearLength', parseFloat(e.target.value) || '')}
                  placeholder="Ex: 500"
                  disabled={isProcessing}
                />
              </div>
              <div className="space-y-2">
                <Label>Largeur moyenne (m)</Label>
                <Input
                  type="number"
                  value={getValue('property.characteristics.width') as string}
                  onChange={(e) => onAnswerChange('property.characteristics.width', parseFloat(e.target.value) || '')}
                  placeholder="Ex: 6"
                  disabled={isProcessing}
                />
              </div>
            </div>
          )}

          {/* Informations complémentaires bâtiment */}
          {patrimoineCategory === 'batiment' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
              <div className="space-y-2">
                <Label>Surface (m²)</Label>
                <Input
                  type="number"
                  value={getValue('property.characteristics.livingArea') as string}
                  onChange={(e) => onAnswerChange('property.characteristics.livingArea', parseFloat(e.target.value) || '')}
                  placeholder="SHON"
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
                  placeholder="R+2"
                  min={1}
                  disabled={isProcessing}
                />
              </div>
            </div>
          )}

          {/* Surface pour espaces verts */}
          {patrimoineCategory === 'espaces_verts' && (
            <div className="space-y-2">
              <Label>Surface approximative (m²)</Label>
              <Input
                type="number"
                value={getValue('property.characteristics.livingArea') as string}
                onChange={(e) => onAnswerChange('property.characteristics.livingArea', parseFloat(e.target.value) || '')}
                placeholder="Ex: 5000"
                disabled={isProcessing}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Type de projet */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Construction className="w-5 h-5 text-primary" />
            Nature de l'opération
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={projectType}
            onValueChange={(v) => onAnswerChange('workProject.general.projectType', v)}
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            {getProjectTypesForCategory().map((type) => (
              <label
                key={type.value}
                className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
                  ${projectType === type.value ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'}`}
              >
                <RadioGroupItem value={type.value} className="mt-0.5" />
                <div>
                  <span className="font-medium">{type.label}</span>
                  <p className="text-xs text-muted-foreground mt-1">{type.desc}</p>
                </div>
              </label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Description */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Description de l'opération</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Titre du projet</Label>
            <Input
              value={getValue('workProject.general.title') as string}
              onChange={(e) => onAnswerChange('workProject.general.title', e.target.value)}
              placeholder="Ex: Rénovation énergétique de l'école primaire Jean Jaurès"
              disabled={isProcessing}
            />
          </div>
          <div className="space-y-2">
            <Label>Description / Programme</Label>
            <Textarea
              value={getValue('workProject.general.description') as string}
              onChange={(e) => onAnswerChange('workProject.general.description', e.target.value)}
              placeholder="Décrivez le programme de l'opération, les objectifs, les contraintes particulières..."
              rows={4}
              disabled={isProcessing}
            />
          </div>
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Ces informations permettront de générer un DCE adapté au type de marché et de patrimoine concerné.
        </AlertDescription>
      </Alert>
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

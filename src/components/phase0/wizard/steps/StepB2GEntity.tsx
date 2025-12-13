/**
 * Étape B2G 1 - Entité publique
 * Identification de la collectivité ou établissement public
 */

import React from 'react';
import { StepComponentProps } from '../WizardContainer';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Building2, User, Phone, Mail, MapPin, Info, Landmark, FileText
} from 'lucide-react';

const ENTITY_TYPES = [
  { value: 'commune', label: 'Commune', description: 'Mairie, services municipaux' },
  { value: 'epci', label: 'EPCI', description: 'Communauté de communes, agglomération, métropole' },
  { value: 'departement', label: 'Département', description: 'Conseil départemental' },
  { value: 'region', label: 'Région', description: 'Conseil régional' },
  { value: 'etat', label: 'État', description: 'Services déconcentrés, préfecture' },
  { value: 'etablissement_public', label: 'Établissement public', description: 'EPA, EPIC, EPSCP...' },
  { value: 'hopital', label: 'Établissement de santé', description: 'Hôpital, EHPAD public' },
  { value: 'education', label: 'Éducation', description: 'Collège, lycée, université publique' },
  { value: 'bailleur_social', label: 'Bailleur social', description: 'OPH, ESH, SEM' },
  { value: 'association', label: 'Association loi 1901', description: 'Association reconnue d\'utilité publique' },
  { value: 'autre', label: 'Autre', description: 'Autre type d\'entité publique' },
];

const STRATES_POPULATION = [
  { value: 'moins_1000', label: 'Moins de 1 000 habitants' },
  { value: '1000_3500', label: '1 000 à 3 500 habitants' },
  { value: '3500_10000', label: '3 500 à 10 000 habitants' },
  { value: '10000_20000', label: '10 000 à 20 000 habitants' },
  { value: '20000_50000', label: '20 000 à 50 000 habitants' },
  { value: '50000_100000', label: '50 000 à 100 000 habitants' },
  { value: 'plus_100000', label: 'Plus de 100 000 habitants' },
];

export function StepB2GEntity({
  project,
  answers,
  onAnswerChange,
  errors,
  isProcessing,
}: StepComponentProps) {
  const client = (project.client || {}) as Record<string, unknown>;
  const entity = (client.entity || {}) as Record<string, unknown>;
  const contact = (client.contact || {}) as Record<string, unknown>;

  const getValue = (path: string, defaultValue: unknown = '') => {
    const answerValue = answers[`client.${path}`];
    if (answerValue !== undefined) return answerValue;

    const parts = path.split('.');
    let current: unknown = client;
    for (const part of parts) {
      if (current && typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return defaultValue;
      }
    }
    return current ?? defaultValue;
  };

  return (
    <div className="space-y-8">
      {/* Information */}
      <Alert className="bg-blue-50 border-blue-200">
        <Landmark className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>Marché public :</strong> Ces informations permettent d'identifier le pouvoir
          adjudicateur et d'adapter les documents aux exigences des marchés publics (Code de
          la commande publique).
        </AlertDescription>
      </Alert>

      {/* Type d'entité */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Type d'entité publique
          </CardTitle>
          <CardDescription>
            Sélectionnez le type d'entité qui correspond à votre organisation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={getValue('entity.type', '') as string}
            onValueChange={(value) => onAnswerChange('client.entity.type', value)}
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            {ENTITY_TYPES.map((type) => (
              <label
                key={type.value}
                htmlFor={`entity-${type.value}`}
                className={`
                  flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
                  ${getValue('entity.type') === type.value
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-primary/50'
                  }
                `}
              >
                <RadioGroupItem
                  value={type.value}
                  id={`entity-${type.value}`}
                  className="mt-0.5"
                />
                <div>
                  <span className="font-medium">{type.label}</span>
                  <p className="text-sm text-muted-foreground">{type.description}</p>
                </div>
              </label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Identification */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Identification de l'entité
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="entityName">Nom de l'entité *</Label>
              <Input
                id="entityName"
                value={getValue('entity.name', '') as string}
                onChange={(e) => onAnswerChange('client.entity.name', e.target.value)}
                placeholder="Ex: Ville de Lyon, Région Auvergne-Rhône-Alpes..."
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siret">Numéro SIRET</Label>
              <Input
                id="siret"
                value={getValue('entity.siret', '') as string}
                onChange={(e) => onAnswerChange('client.entity.siret', e.target.value)}
                placeholder="123 456 789 00012"
                disabled={isProcessing}
                maxLength={17}
              />
              <p className="text-xs text-muted-foreground">
                14 chiffres - Disponible sur annuaire-entreprises.data.gouv.fr
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="codeAPE">Code APE / NAF</Label>
              <Input
                id="codeAPE"
                value={getValue('entity.codeAPE', '') as string}
                onChange={(e) => onAnswerChange('client.entity.codeAPE', e.target.value)}
                placeholder="84.11Z"
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="codeInsee">Code INSEE commune</Label>
              <Input
                id="codeInsee"
                value={getValue('entity.codeInsee', '') as string}
                onChange={(e) => onAnswerChange('client.entity.codeInsee', e.target.value)}
                placeholder="69123"
                disabled={isProcessing}
              />
            </div>
          </div>

          {/* Strate démographique pour communes */}
          {(getValue('entity.type') === 'commune' || getValue('entity.type') === 'epci') && (
            <div className="space-y-2">
              <Label htmlFor="strate">Strate démographique</Label>
              <Select
                value={getValue('entity.strate', '') as string}
                onValueChange={(value) => onAnswerChange('client.entity.strate', value)}
                disabled={isProcessing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez la strate..." />
                </SelectTrigger>
                <SelectContent>
                  {STRATES_POPULATION.map((strate) => (
                    <SelectItem key={strate.value} value={strate.value}>
                      {strate.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                La strate influence les seuils de procédure applicables
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Adresse du siège */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Adresse du siège
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address">Adresse</Label>
            <Input
              id="address"
              value={getValue('entity.address.street', '') as string}
              onChange={(e) => onAnswerChange('client.entity.address.street', e.target.value)}
              placeholder="1 Place de la Mairie"
              disabled={isProcessing}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="postalCode">Code postal</Label>
              <Input
                id="postalCode"
                value={getValue('entity.address.postalCode', '') as string}
                onChange={(e) => onAnswerChange('client.entity.address.postalCode', e.target.value)}
                placeholder="69001"
                disabled={isProcessing}
                maxLength={5}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="city">Ville</Label>
              <Input
                id="city"
                value={getValue('entity.address.city', '') as string}
                onChange={(e) => onAnswerChange('client.entity.address.city', e.target.value)}
                placeholder="Lyon"
                disabled={isProcessing}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact du représentant */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Représentant du pouvoir adjudicateur
          </CardTitle>
          <CardDescription>
            Personne habilitée à signer le marché
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="civility">Civilité</Label>
              <Select
                value={getValue('contact.civility', '') as string}
                onValueChange={(value) => onAnswerChange('client.contact.civility', value)}
                disabled={isProcessing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Monsieur</SelectItem>
                  <SelectItem value="Mme">Madame</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="function">Fonction</Label>
              <Input
                id="function"
                value={getValue('contact.function', '') as string}
                onChange={(e) => onAnswerChange('client.contact.function', e.target.value)}
                placeholder="Ex: Maire, Président, Directeur..."
                disabled={isProcessing}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lastName">Nom *</Label>
              <Input
                id="lastName"
                value={getValue('contact.lastName', '') as string}
                onChange={(e) => onAnswerChange('client.contact.lastName', e.target.value)}
                placeholder="Dupont"
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="firstName">Prénom *</Label>
              <Input
                id="firstName"
                value={getValue('contact.firstName', '') as string}
                onChange={(e) => onAnswerChange('client.contact.firstName', e.target.value)}
                placeholder="Jean"
                disabled={isProcessing}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email professionnel *
              </Label>
              <Input
                id="email"
                type="email"
                value={getValue('contact.email', '') as string}
                onChange={(e) => onAnswerChange('client.contact.email', e.target.value)}
                placeholder="contact@mairie.fr"
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Téléphone
              </Label>
              <Input
                id="phone"
                type="tel"
                value={getValue('contact.phone', '') as string}
                onChange={(e) => onAnswerChange('client.contact.phone', e.target.value)}
                placeholder="04 XX XX XX XX"
                disabled={isProcessing}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Service instructeur */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Service instructeur (optionnel)
          </CardTitle>
          <CardDescription>
            Service en charge du suivi technique et administratif du marché
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="serviceName">Nom du service</Label>
              <Input
                id="serviceName"
                value={getValue('contact.serviceName', '') as string}
                onChange={(e) => onAnswerChange('client.contact.serviceName', e.target.value)}
                placeholder="Ex: Direction des Services Techniques"
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serviceContact">Contact du service</Label>
              <Input
                id="serviceContact"
                value={getValue('contact.serviceContact', '') as string}
                onChange={(e) => onAnswerChange('client.contact.serviceContact', e.target.value)}
                placeholder="Nom du référent technique"
                disabled={isProcessing}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="serviceEmail">Email du service</Label>
            <Input
              id="serviceEmail"
              type="email"
              value={getValue('contact.serviceEmail', '') as string}
              onChange={(e) => onAnswerChange('client.contact.serviceEmail', e.target.value)}
              placeholder="services-techniques@mairie.fr"
              disabled={isProcessing}
            />
          </div>
        </CardContent>
      </Card>

      {/* Info RGPD */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Les informations collectées sont traitées conformément au RGPD et au Code de la
          commande publique. Elles sont nécessaires à l'établissement des pièces du marché.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export default StepB2GEntity;

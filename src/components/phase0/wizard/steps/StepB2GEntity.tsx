/**
 * Étape B2G 1 - Entité publique (version compacte)
 * Les informations principales viennent du profil - ici on confirme et complète
 */

import React, { useEffect } from 'react';
import { StepComponentProps } from '../WizardContainer';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, User, Settings, CheckCircle, ExternalLink } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Link } from 'react-router-dom';

const ENTITY_TYPE_LABELS: Record<string, string> = {
  commune: 'Commune',
  epci: 'EPCI / Intercommunalité',
  departement: 'Département',
  region: 'Région',
  other: 'Autre établissement public',
};

export function StepB2GEntity({
  project,
  answers,
  onAnswerChange,
  errors,
  isProcessing,
}: StepComponentProps) {
  const { user } = useApp();
  const client = (project.client || {}) as Record<string, unknown>;

  // Récupérer les infos du profil utilisateur
  const userMetadata = user as Record<string, unknown> | null;
  const profileEntityType = userMetadata?.entityType as string || '';
  const profileEntityName = userMetadata?.company as string || '';
  const profileSiret = userMetadata?.siret as string || '';
  const profileContactName = user?.name || '';
  const profileContactEmail = user?.email || '';

  // Pré-remplir automatiquement depuis le profil
  useEffect(() => {
    const prefills: Record<string, string> = {};
    if (profileEntityType && !answers['client.entity.type']) prefills['client.entity.type'] = profileEntityType;
    if (profileEntityName && !answers['client.entity.name']) prefills['client.entity.name'] = profileEntityName;
    if (profileSiret && !answers['client.entity.siret']) prefills['client.entity.siret'] = profileSiret;
    if (profileContactEmail && !answers['client.contact.email']) prefills['client.contact.email'] = profileContactEmail;
    if (profileContactName && !answers['client.contact.lastName']) {
      const names = profileContactName.split(' ');
      if (names.length > 1) {
        prefills['client.contact.firstName'] = names[0];
        prefills['client.contact.lastName'] = names.slice(1).join(' ');
      } else {
        prefills['client.contact.lastName'] = profileContactName;
      }
    }
    Object.entries(prefills).forEach(([k, v]) => onAnswerChange(k, v));
  }, []);

  const getValue = (path: string, defaultValue: unknown = '') => {
    const fullPath = `client.${path}`;
    if (answers[fullPath] !== undefined) return answers[fullPath];
    const parts = path.split('.');
    let current: unknown = client;
    for (const part of parts) {
      if (current && typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else return defaultValue;
    }
    return current ?? defaultValue;
  };

  const displayEntityType = (getValue('entity.type', profileEntityType) as string) || profileEntityType;
  const isProfileComplete = profileEntityName && profileEntityType;

  return (
    <div className="space-y-4">
      {/* Résumé profil */}
      {isProfileComplete ? (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-green-900">
                  {getValue('entity.name', profileEntityName) as string}
                </p>
                <p className="text-sm text-green-700">
                  {ENTITY_TYPE_LABELS[displayEntityType] || displayEntityType}
                  {getValue('entity.siret') && ` • SIRET: ${getValue('entity.siret')}`}
                </p>
              </div>
            </div>
            <Link to="/settings/organization">
              <Button variant="ghost" size="sm" className="text-green-700 hover:text-green-800">
                <Settings className="w-4 h-4 mr-1" />
                Modifier
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <Alert>
          <Building2 className="h-4 w-4" />
          <AlertDescription>
            Complétez votre profil collectivité pour pré-remplir automatiquement vos projets.
            <Link to="/settings/organization" className="ml-2 text-primary hover:underline inline-flex items-center gap-1">
              Configurer <ExternalLink className="w-3 h-3" />
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Champs essentiels compacts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm">Nom de la collectivité *</Label>
          <Input
            value={getValue('entity.name', '') as string}
            onChange={(e) => onAnswerChange('client.entity.name', e.target.value)}
            placeholder="Ville de..."
            disabled={isProcessing}
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Type</Label>
          <Select
            value={displayEntityType}
            onValueChange={(v) => onAnswerChange('client.entity.type', v)}
            disabled={isProcessing}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Type de collectivité" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ENTITY_TYPE_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm">SIRET</Label>
          <Input
            value={getValue('entity.siret', '') as string}
            onChange={(e) => onAnswerChange('client.entity.siret', e.target.value)}
            placeholder="123 456 789 00012"
            disabled={isProcessing}
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Code INSEE</Label>
          <Input
            value={getValue('entity.codeInsee', '') as string}
            onChange={(e) => onAnswerChange('client.entity.codeInsee', e.target.value)}
            placeholder="69123"
            disabled={isProcessing}
            className="h-9"
          />
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label className="text-sm">Adresse siège</Label>
          <Input
            value={getValue('entity.address.street', '') as string}
            onChange={(e) => onAnswerChange('client.entity.address.street', e.target.value)}
            placeholder="1 Place de la Mairie, 69001 Lyon"
            disabled={isProcessing}
            className="h-9"
          />
        </div>
      </div>

      {/* Contact projet - section compacte */}
      <div className="pt-2 border-t">
        <div className="flex items-center gap-2 mb-3">
          <User className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Contact pour ce projet</span>
          <Badge variant="secondary" className="text-xs">Optionnel si identique au profil</Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Prénom</Label>
            <Input
              value={getValue('contact.firstName', '') as string}
              onChange={(e) => onAnswerChange('client.contact.firstName', e.target.value)}
              placeholder="Jean"
              disabled={isProcessing}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Nom</Label>
            <Input
              value={getValue('contact.lastName', '') as string}
              onChange={(e) => onAnswerChange('client.contact.lastName', e.target.value)}
              placeholder="Dupont"
              disabled={isProcessing}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Fonction</Label>
            <Input
              value={getValue('contact.function', '') as string}
              onChange={(e) => onAnswerChange('client.contact.function', e.target.value)}
              placeholder="DGS, DST..."
              disabled={isProcessing}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Email</Label>
            <Input
              type="email"
              value={getValue('contact.email', '') as string}
              onChange={(e) => onAnswerChange('client.contact.email', e.target.value)}
              placeholder="contact@mairie.fr"
              disabled={isProcessing}
              className="h-9"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default StepB2GEntity;

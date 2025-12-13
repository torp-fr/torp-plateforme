/**
 * Étape 1 B2B - Client (MOA / Donneur d'ordres)
 * Informations client et nature de la demande
 */

import React from 'react';
import { StepComponentProps } from '../../WizardContainer';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  User, Building2, Building, Landmark, Home, Briefcase,
  Phone, Mail, Info
} from 'lucide-react';

// Types de client
const CLIENT_TYPES = [
  { value: 'particulier', label: 'Particulier', icon: <User className="w-5 h-5" />, desc: 'Propriétaire ou locataire' },
  { value: 'entreprise', label: 'Entreprise', icon: <Briefcase className="w-5 h-5" />, desc: 'Société, commerce, PME' },
  { value: 'copropriete', label: 'Copropriété', icon: <Building className="w-5 h-5" />, desc: 'Syndic, conseil syndical' },
  { value: 'bailleur', label: 'Bailleur', icon: <Building2 className="w-5 h-5" />, desc: 'Bailleur social ou privé' },
  { value: 'collectivite', label: 'Collectivité', icon: <Landmark className="w-5 h-5" />, desc: 'Mairie, établissement public' },
  { value: 'promoteur', label: 'Promoteur', icon: <Home className="w-5 h-5" />, desc: 'Promoteur, marchand de biens' },
];

// Nature de la demande
const REQUEST_NATURES = [
  { value: 'devis', label: 'Demande de devis', badge: 'Standard' },
  { value: 'consultation', label: 'Consultation entreprises', badge: 'Multi-devis' },
  { value: 'appel_offres', label: 'Appel d\'offres privé', badge: 'AO' },
  { value: 'marche_public', label: 'Marché public', badge: 'MAPA/MF', variant: 'secondary' as const },
  { value: 'urgence', label: 'Intervention urgente', badge: 'Urgent', variant: 'destructive' as const },
];

export function StepB2BClient({
  project,
  answers,
  onAnswerChange,
  isProcessing,
}: StepComponentProps) {
  const client = (project.client || {}) as Record<string, unknown>;
  const identity = (client.identity || {}) as Record<string, unknown>;
  const contact = (client.contact || {}) as Record<string, unknown>;
  const context = (client.context || {}) as Record<string, unknown>;

  const getValue = (path: string) => {
    return answers[`client.${path}`] ?? getNestedValue(client, path) ?? '';
  };

  const clientType = getValue('identity.clientType') as string;
  const isProClient = ['entreprise', 'copropriete', 'bailleur', 'collectivite', 'promoteur'].includes(clientType);

  return (
    <div className="space-y-6">
      {/* Type de client */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Type de client *</Label>
        <RadioGroup
          value={clientType}
          onValueChange={(v) => onAnswerChange('client.identity.clientType', v)}
          className="grid grid-cols-2 md:grid-cols-3 gap-3"
        >
          {CLIENT_TYPES.map((type) => (
            <label
              key={type.value}
              className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
                ${clientType === type.value ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'}`}
            >
              <RadioGroupItem value={type.value} className="sr-only" />
              <span className={clientType === type.value ? 'text-primary' : 'text-muted-foreground'}>
                {type.icon}
              </span>
              <div>
                <div className="font-medium text-sm">{type.label}</div>
                <div className="text-xs text-muted-foreground">{type.desc}</div>
              </div>
            </label>
          ))}
        </RadioGroup>
      </div>

      {/* Identité client */}
      {clientType && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Identité du client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!isProClient && (
                <div className="space-y-2">
                  <Label>Civilité</Label>
                  <Select
                    value={getValue('identity.civility') as string}
                    onValueChange={(v) => onAnswerChange('client.identity.civility', v)}
                    disabled={isProcessing}
                  >
                    <SelectTrigger><SelectValue placeholder="Sélectionnez..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">M.</SelectItem>
                      <SelectItem value="Mme">Mme</SelectItem>
                      <SelectItem value="M./Mme">M. et Mme</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className={`space-y-2 ${isProClient ? 'md:col-span-2' : ''}`}>
                <Label>{isProClient ? 'Raison sociale *' : 'Nom *'}</Label>
                <Input
                  value={getValue('identity.name') as string}
                  onChange={(e) => onAnswerChange('client.identity.name', e.target.value)}
                  placeholder={isProClient ? 'Nom de l\'entreprise' : 'Nom du client'}
                  disabled={isProcessing}
                />
              </div>
            </div>

            {isProClient && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>SIRET</Label>
                  <Input
                    value={getValue('identity.siret') as string}
                    onChange={(e) => onAnswerChange('client.identity.siret', e.target.value)}
                    placeholder="123 456 789 00001"
                    disabled={isProcessing}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Référence interne</Label>
                  <Input
                    value={getValue('identity.internalRef') as string}
                    onChange={(e) => onAnswerChange('client.identity.internalRef', e.target.value)}
                    placeholder="Votre référence dossier"
                    disabled={isProcessing}
                  />
                </div>
              </div>
            )}

            {/* Contact */}
            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium mb-4 flex items-center gap-2">
                <Phone className="w-4 h-4" /> Contact
              </h4>
              {isProClient && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label>Nom du contact</Label>
                    <Input
                      value={getValue('contact.contactName') as string}
                      onChange={(e) => onAnswerChange('client.contact.contactName', e.target.value)}
                      placeholder="Votre interlocuteur"
                      disabled={isProcessing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fonction</Label>
                    <Input
                      value={getValue('contact.contactRole') as string}
                      onChange={(e) => onAnswerChange('client.contact.contactRole', e.target.value)}
                      placeholder="Directeur, Syndic..."
                      disabled={isProcessing}
                    />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={getValue('contact.email') as string}
                    onChange={(e) => onAnswerChange('client.contact.email', e.target.value)}
                    placeholder="email@client.com"
                    disabled={isProcessing}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input
                    type="tel"
                    value={getValue('contact.phone') as string}
                    onChange={(e) => onAnswerChange('client.contact.phone', e.target.value)}
                    placeholder="06 12 34 56 78"
                    disabled={isProcessing}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Nature de la demande */}
      {clientType && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Nature de la demande</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {REQUEST_NATURES.map((nature) => {
                const selected = getValue('context.requestNature') === nature.value;
                return (
                  <button
                    key={nature.value}
                    type="button"
                    onClick={() => onAnswerChange('client.context.requestNature', nature.value)}
                    disabled={isProcessing}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all
                      ${selected ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'}`}
                  >
                    <span>{nature.label}</span>
                    <Badge variant={nature.variant || 'outline'} className="text-xs">
                      {nature.badge}
                    </Badge>
                  </button>
                );
              })}
            </div>

            {getValue('context.requestNature') === 'marche_public' && (
              <Alert className="mt-4 bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  Documents DCE/CCTP conformes aux marchés publics générés automatiquement.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
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

export default StepB2BClient;

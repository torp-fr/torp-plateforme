/**
 * Étape 1 - Profil du maître d'ouvrage
 * Collecte les informations sur le demandeur
 */

import React from 'react';
import { StepComponentProps } from '../WizardContainer';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Building2, Landmark, TrendingUp, Phone, Mail, MessageSquare } from 'lucide-react';
import { OwnerType } from '@/types/phase0/owner.types';

const OWNER_TYPE_OPTIONS: Array<{ value: OwnerType; label: string; description: string; icon: React.ReactNode }> = [
  {
    value: 'b2c',
    label: 'Particulier',
    description: 'Vous êtes un particulier souhaitant réaliser des travaux',
    icon: <User className="w-5 h-5" />,
  },
  {
    value: 'b2b',
    label: 'Professionnel',
    description: 'Vous représentez une entreprise ou société',
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    value: 'b2g',
    label: 'Collectivité',
    description: 'Vous êtes une collectivité ou organisme public',
    icon: <Landmark className="w-5 h-5" />,
  },
  {
    value: 'investor',
    label: 'Investisseur',
    description: 'Vous êtes un investisseur immobilier',
    icon: <TrendingUp className="w-5 h-5" />,
  },
];

const CONTACT_METHOD_OPTIONS = [
  { value: 'email', label: 'Email', icon: <Mail className="w-4 h-4" /> },
  { value: 'phone', label: 'Téléphone', icon: <Phone className="w-4 h-4" /> },
  { value: 'sms', label: 'SMS', icon: <MessageSquare className="w-4 h-4" /> },
];

export function StepOwnerProfile({
  project,
  answers,
  onAnswerChange,
  onAnswersChange,
  errors,
  isProcessing,
}: StepComponentProps) {
  // Support both owner and ownerProfile for backwards compatibility
  const owner = (project.ownerProfile || project.owner || {}) as Record<string, unknown>;
  const identity = (owner.identity || {}) as Record<string, unknown>;
  const contact = (owner.contact || {}) as Record<string, unknown>;

  // Utiliser ownerProfile. pour les nouvelles réponses (cohérent avec la structure de données)
  const ownerType = (identity.type as OwnerType) || (answers['ownerProfile.identity.type'] as OwnerType) || (answers['owner.identity.type'] as OwnerType);
  const isB2C = ownerType === 'b2c' || ownerType === 'B2C';
  const isB2B = ownerType === 'b2b' || ownerType === 'b2g' || ownerType === 'investor';

  // Vérifier si le profil est déjà pré-rempli
  const isPreFilled = !!(identity.firstName || identity.lastName || contact.email);

  return (
    <div className="space-y-6">
      {/* Message si pré-rempli */}
      {isPreFilled && (
        <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm text-green-700 dark:text-green-300">
            ✓ Vos informations ont été pré-remplies depuis votre profil. Vous pouvez les modifier si nécessaire.
          </p>
        </div>
      )}

      {/* Sélection du type - compact */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Vous êtes :</Label>
        <RadioGroup
          value={ownerType?.toLowerCase() || ''}
          onValueChange={(value) => onAnswerChange('ownerProfile.identity.type', value)}
          className="grid grid-cols-2 md:grid-cols-4 gap-2"
        >
          {OWNER_TYPE_OPTIONS.map((option) => (
            <label
              key={option.value}
              htmlFor={`owner-type-${option.value}`}
              className={`
                relative flex flex-col items-center gap-1 p-3 rounded-lg border-2 cursor-pointer transition-all text-center
                ${ownerType?.toLowerCase() === option.value
                  ? 'border-primary bg-primary/5'
                  : 'border-muted hover:border-primary/50'
                }
              `}
            >
              <RadioGroupItem
                value={option.value}
                id={`owner-type-${option.value}`}
                className="sr-only"
              />
              <span className="text-primary">{option.icon}</span>
              <span className="text-xs font-medium">{option.label}</span>
            </label>
          ))}
        </RadioGroup>
      </div>

      {/* Formulaire identité (si type sélectionné) - Compact */}
      {ownerType && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Vos informations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {/* Champs B2C */}
            {isB2C && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="firstName" className="text-xs">Prénom *</Label>
                  <Input
                    id="firstName"
                    value={(identity.firstName as string) || (answers['ownerProfile.identity.firstName'] as string) || ''}
                    onChange={(e) => onAnswerChange('ownerProfile.identity.firstName', e.target.value)}
                    placeholder="Jean"
                    disabled={isProcessing}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lastName" className="text-xs">Nom *</Label>
                  <Input
                    id="lastName"
                    value={(identity.lastName as string) || (answers['ownerProfile.identity.lastName'] as string) || ''}
                    onChange={(e) => onAnswerChange('ownerProfile.identity.lastName', e.target.value)}
                    placeholder="Dupont"
                    disabled={isProcessing}
                    className="h-9"
                  />
                </div>
              </div>
            )}

            {/* Champs B2B */}
            {isB2B && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="companyName" className="text-xs">Raison sociale *</Label>
                  <Input
                    id="companyName"
                    value={(identity.companyName as string) || (answers['ownerProfile.identity.companyName'] as string) || ''}
                    onChange={(e) => onAnswerChange('ownerProfile.identity.companyName', e.target.value)}
                    placeholder="Société Example SAS"
                    disabled={isProcessing}
                    className="h-9"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="siret" className="text-xs">SIRET</Label>
                    <Input
                      id="siret"
                      value={(identity.siret as string) || (answers['ownerProfile.identity.siret'] as string) || ''}
                      onChange={(e) => onAnswerChange('ownerProfile.identity.siret', e.target.value)}
                      placeholder="123 456 789 00001"
                      maxLength={17}
                      disabled={isProcessing}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="contactName" className="text-xs">Nom du contact</Label>
                    <Input
                      id="contactName"
                      value={(identity.contactName as string) || (answers['ownerProfile.identity.contactName'] as string) || ''}
                      onChange={(e) => onAnswerChange('ownerProfile.identity.contactName', e.target.value)}
                      placeholder="Marie Martin"
                      disabled={isProcessing}
                      className="h-9"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Coordonnées - compact */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t">
              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={(contact.email as string) || (answers['ownerProfile.contact.email'] as string) || ''}
                  onChange={(e) => onAnswerChange('ownerProfile.contact.email', e.target.value)}
                  placeholder="jean.dupont@email.com"
                  disabled={isProcessing}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="phone" className="text-xs">Téléphone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={(contact.phone as string) || (answers['ownerProfile.contact.phone'] as string) || ''}
                  onChange={(e) => onAnswerChange('ownerProfile.contact.phone', e.target.value)}
                  placeholder="06 12 34 56 78"
                  disabled={isProcessing}
                  className="h-9"
                />
              </div>
            </div>

            {/* Préférence de contact - inline */}
            <div className="flex items-center gap-3 pt-2">
              <Label className="text-xs whitespace-nowrap">Contact préféré :</Label>
              <div className="flex gap-2">
                {CONTACT_METHOD_OPTIONS.map((option) => {
                  const isSelected = (contact.preferredContact as string) === option.value ||
                    (answers['ownerProfile.contact.preferredContact'] as string) === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onAnswerChange('ownerProfile.contact.preferredContact', option.value)}
                      disabled={isProcessing}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs border transition-all ${
                        isSelected ? 'border-primary bg-primary/10 text-primary' : 'border-muted hover:border-primary/50'
                      }`}
                    >
                      {option.icon}
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default StepOwnerProfile;

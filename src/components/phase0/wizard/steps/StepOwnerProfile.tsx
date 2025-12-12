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
  const owner = (project.owner || {}) as Record<string, unknown>;
  const identity = (owner.identity || {}) as Record<string, unknown>;
  const contact = (owner.contact || {}) as Record<string, unknown>;

  const ownerType = (identity.type as OwnerType) || (answers['owner.identity.type'] as OwnerType);
  const isB2C = ownerType === 'b2c';
  const isB2B = ownerType === 'b2b' || ownerType === 'b2g' || ownerType === 'investor';

  return (
    <div className="space-y-8">
      {/* Sélection du type */}
      <div className="space-y-4">
        <Label className="text-base font-medium">Vous êtes :</Label>
        <RadioGroup
          value={ownerType || ''}
          onValueChange={(value) => onAnswerChange('owner.identity.type', value)}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {OWNER_TYPE_OPTIONS.map((option) => (
            <label
              key={option.value}
              htmlFor={`owner-type-${option.value}`}
              className={`
                relative flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all
                ${ownerType === option.value
                  ? 'border-primary bg-primary/5'
                  : 'border-muted hover:border-primary/50'
                }
              `}
            >
              <RadioGroupItem
                value={option.value}
                id={`owner-type-${option.value}`}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-primary">{option.icon}</span>
                  <span className="font-medium">{option.label}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {option.description}
                </p>
              </div>
            </label>
          ))}
        </RadioGroup>
      </div>

      {/* Formulaire identité (si type sélectionné) */}
      {ownerType && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vos informations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Champs B2C */}
            {isB2C && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Prénom *</Label>
                    <Input
                      id="firstName"
                      value={(identity.firstName as string) || (answers['owner.identity.firstName'] as string) || ''}
                      onChange={(e) => onAnswerChange('owner.identity.firstName', e.target.value)}
                      placeholder="Jean"
                      disabled={isProcessing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nom *</Label>
                    <Input
                      id="lastName"
                      value={(identity.lastName as string) || (answers['owner.identity.lastName'] as string) || ''}
                      onChange={(e) => onAnswerChange('owner.identity.lastName', e.target.value)}
                      placeholder="Dupont"
                      disabled={isProcessing}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Champs B2B */}
            {isB2B && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="companyName">Raison sociale *</Label>
                  <Input
                    id="companyName"
                    value={(identity.companyName as string) || (answers['owner.identity.companyName'] as string) || ''}
                    onChange={(e) => onAnswerChange('owner.identity.companyName', e.target.value)}
                    placeholder="Société Example SAS"
                    disabled={isProcessing}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="siret">SIRET</Label>
                    <Input
                      id="siret"
                      value={(identity.siret as string) || (answers['owner.identity.siret'] as string) || ''}
                      onChange={(e) => onAnswerChange('owner.identity.siret', e.target.value)}
                      placeholder="123 456 789 00001"
                      maxLength={17}
                      disabled={isProcessing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactName">Nom du contact</Label>
                    <Input
                      id="contactName"
                      value={(identity.contactName as string) || (answers['owner.identity.contactName'] as string) || ''}
                      onChange={(e) => onAnswerChange('owner.identity.contactName', e.target.value)}
                      placeholder="Marie Martin"
                      disabled={isProcessing}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Coordonnées */}
            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium mb-4">Coordonnées</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={(contact.email as string) || (answers['owner.contact.email'] as string) || ''}
                    onChange={(e) => onAnswerChange('owner.contact.email', e.target.value)}
                    placeholder="jean.dupont@email.com"
                    disabled={isProcessing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={(contact.phone as string) || (answers['owner.contact.phone'] as string) || ''}
                    onChange={(e) => onAnswerChange('owner.contact.phone', e.target.value)}
                    placeholder="06 12 34 56 78"
                    disabled={isProcessing}
                  />
                </div>
              </div>
            </div>

            {/* Préférence de contact */}
            <div className="space-y-2">
              <Label>Moyen de contact préféré</Label>
              <Select
                value={(contact.preferredContactMethod as string) || (answers['owner.contact.preferredContactMethod'] as string) || ''}
                onValueChange={(value) => onAnswerChange('owner.contact.preferredContactMethod', value)}
                disabled={isProcessing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez..." />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_METHOD_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        {option.icon}
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Disponibilités */}
            <div className="space-y-2">
              <Label>Disponibilités pour être contacté</Label>
              <div className="flex flex-wrap gap-4">
                {['morning', 'afternoon', 'evening'].map((time) => (
                  <label key={time} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={
                        ((contact.availableSlots as string[]) || []).includes(time) ||
                        ((answers['owner.contact.availableSlots'] as string[]) || []).includes(time)
                      }
                      onCheckedChange={(checked) => {
                        const current = (contact.availableSlots as string[]) ||
                          (answers['owner.contact.availableSlots'] as string[]) || [];
                        const updated = checked
                          ? [...current, time]
                          : current.filter(t => t !== time);
                        onAnswerChange('owner.contact.availableSlots', updated);
                      }}
                      disabled={isProcessing}
                    />
                    <span className="text-sm">
                      {time === 'morning' ? 'Matin (9h-12h)' :
                       time === 'afternoon' ? 'Après-midi (14h-18h)' : 'Soir (18h-20h)'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expérience (optionnel) */}
      {ownerType && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Votre expérience (optionnel)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Avez-vous déjà réalisé des travaux ?</Label>
              <RadioGroup
                value={answers['owner.experience.previousProjects'] as string || ''}
                onValueChange={(value) => onAnswerChange('owner.experience.previousProjects', parseInt(value))}
                className="flex flex-wrap gap-4"
              >
                {[
                  { value: '0', label: 'Non, c\'est mon premier projet' },
                  { value: '1', label: '1 projet' },
                  { value: '2', label: '2-3 projets' },
                  { value: '5', label: 'Plus de 3 projets' },
                ].map((option) => (
                  <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value={option.value} />
                    <span className="text-sm">{option.label}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>Votre niveau de connaissance en travaux</Label>
              <Select
                value={answers['owner.experience.technicalKnowledge'] as string || ''}
                onValueChange={(value) => onAnswerChange('owner.experience.technicalKnowledge', value)}
                disabled={isProcessing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez votre niveau..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune connaissance</SelectItem>
                  <SelectItem value="basic">Notions de base</SelectItem>
                  <SelectItem value="intermediate">Niveau intermédiaire</SelectItem>
                  <SelectItem value="advanced">Niveau avancé</SelectItem>
                  <SelectItem value="expert">Expert / Professionnel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default StepOwnerProfile;

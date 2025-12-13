/**
 * Étape 1 B2B - Informations Client (Maître d'Ouvrage / Donneur d'ordres)
 * Pour les professionnels qui interviennent chez un client
 */

import React from 'react';
import { StepComponentProps } from '../WizardContainer';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  User, Building2, Building, Users, Landmark, Home,
  Phone, Mail, MessageSquare, Clock, Info, Briefcase,
  FileText, Calendar, AlertCircle, Lightbulb
} from 'lucide-react';
import type { ClientType, B2BProjectType, RequestNature } from '@/types/phase0/client.types';

// =============================================================================
// OPTIONS DE CONFIGURATION
// =============================================================================

const CLIENT_TYPE_OPTIONS: Array<{
  value: ClientType;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'particulier',
    label: 'Particulier',
    description: 'Client particulier, propriétaire ou locataire',
    icon: <User className="w-5 h-5" />,
  },
  {
    value: 'entreprise',
    label: 'Entreprise',
    description: 'Société, commerce, PME/PMI',
    icon: <Briefcase className="w-5 h-5" />,
  },
  {
    value: 'copropriete',
    label: 'Copropriété',
    description: 'Syndic, conseil syndical, ASL',
    icon: <Building className="w-5 h-5" />,
  },
  {
    value: 'bailleur',
    label: 'Bailleur',
    description: 'Bailleur social ou privé, SCI',
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    value: 'collectivite',
    label: 'Collectivité',
    description: 'Mairie, département, région, établissement public',
    icon: <Landmark className="w-5 h-5" />,
  },
  {
    value: 'promoteur',
    label: 'Promoteur / MDB',
    description: 'Promoteur immobilier, marchand de biens',
    icon: <Home className="w-5 h-5" />,
  },
];

const PROJECT_TYPE_OPTIONS: Array<{
  value: B2BProjectType;
  label: string;
  description: string;
}> = [
  { value: 'renovation_globale', label: 'Rénovation globale', description: 'Travaux complets multi-lots' },
  { value: 'renovation_energetique', label: 'Rénovation énergétique', description: 'Performance énergétique, isolation, chauffage' },
  { value: 'amenagement', label: 'Aménagement', description: 'Aménagement intérieur, redistribution' },
  { value: 'extension', label: 'Extension / Surélévation', description: 'Agrandissement du bâti existant' },
  { value: 'mise_aux_normes', label: 'Mise aux normes', description: 'Conformité, accessibilité, sécurité' },
  { value: 'maintenance', label: 'Maintenance / Entretien', description: 'Travaux de maintenance préventive ou curative' },
  { value: 'construction_neuve', label: 'Construction neuve', description: 'Construction sur terrain nu' },
  { value: 'expertise', label: 'Expertise / Audit', description: 'Diagnostic, étude, conseil' },
];

const REQUEST_NATURE_OPTIONS: Array<{
  value: RequestNature;
  label: string;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
}> = [
  { value: 'devis', label: 'Demande de devis', badge: 'Standard' },
  { value: 'consultation', label: 'Consultation entreprises', badge: 'Multi-devis' },
  { value: 'appel_offres', label: 'Appel d\'offres privé', badge: 'AO' },
  { value: 'marche_public', label: 'Marché public', badge: 'MAPA/MF', badgeVariant: 'secondary' },
  { value: 'urgence', label: 'Intervention urgente', badge: 'Urgent', badgeVariant: 'destructive' },
  { value: 'contrat_cadre', label: 'Contrat cadre existant', badge: 'Récurrent' },
];

const CONTACT_METHOD_OPTIONS = [
  { value: 'email', label: 'Email', icon: <Mail className="w-4 h-4" /> },
  { value: 'phone', label: 'Téléphone', icon: <Phone className="w-4 h-4" /> },
  { value: 'sms', label: 'SMS', icon: <MessageSquare className="w-4 h-4" /> },
];

const URGENCY_OPTIONS = [
  { value: 'immediate', label: 'Immédiat', description: 'Sous 1 semaine' },
  { value: 'court_terme', label: 'Court terme', description: '1 à 4 semaines' },
  { value: 'moyen_terme', label: 'Moyen terme', description: '1 à 3 mois' },
  { value: 'long_terme', label: 'Long terme', description: 'Plus de 3 mois' },
  { value: 'flexible', label: 'Flexible', description: 'À définir ensemble' },
];

// =============================================================================
// COMPOSANT PRINCIPAL
// =============================================================================

export function StepClientInfo({
  project,
  answers,
  onAnswerChange,
  onAnswersChange,
  errors,
  isProcessing,
}: StepComponentProps) {
  // Récupération des données existantes
  const client = (project.client || {}) as Record<string, unknown>;
  const identity = (client.identity || {}) as Record<string, unknown>;
  const contact = (client.contact || {}) as Record<string, unknown>;
  const context = (client.context || {}) as Record<string, unknown>;

  // Valeurs courantes
  const clientType = (identity.clientType as ClientType) || (answers['client.identity.clientType'] as ClientType);
  const projectType = (context.projectType as B2BProjectType) || (answers['client.context.projectType'] as B2BProjectType);
  const requestNature = (context.requestNature as RequestNature) || (answers['client.context.requestNature'] as RequestNature);

  // Déterminer si c'est un client professionnel (pour afficher les champs SIRET, etc.)
  const isProClient = clientType === 'entreprise' || clientType === 'copropriete' ||
    clientType === 'bailleur' || clientType === 'collectivite' || clientType === 'promoteur';

  // Insights dynamiques basés sur les sélections
  const getContextualInsights = () => {
    const insights: string[] = [];

    if (clientType === 'collectivite' || requestNature === 'marche_public') {
      insights.push('📋 Documents DCE/CCTP conformes aux marchés publics');
      insights.push('⚖️ Respect du Code de la commande publique');
    }

    if (clientType === 'copropriete') {
      insights.push('📊 Prise en compte des contraintes de copropriété');
      insights.push('📝 Documents adaptés pour AG des copropriétaires');
    }

    if (projectType === 'renovation_energetique') {
      insights.push('🌱 Éligibilité aux aides (MaPrimeRénov\', CEE...)');
      insights.push('📈 Audit énergétique et gains prévisionnels');
    }

    if (requestNature === 'urgence') {
      insights.push('⚡ Procédure accélérée et réactivité prioritaire');
    }

    return insights;
  };

  const insights = getContextualInsights();

  return (
    <div className="space-y-8">
      {/* En-tête contextuel */}
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>Renseignez les informations de votre client</strong> (Maître d'Ouvrage / Donneur d'ordres).
          Ces données permettront de générer automatiquement les documents adaptés (DCE, CCTP, devis...).
        </AlertDescription>
      </Alert>

      {/* Type de client */}
      <div className="space-y-4">
        <Label className="text-base font-medium">Type de client *</Label>
        <RadioGroup
          value={clientType || ''}
          onValueChange={(value) => onAnswerChange('client.identity.clientType', value)}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {CLIENT_TYPE_OPTIONS.map((option) => (
            <label
              key={option.value}
              htmlFor={`client-type-${option.value}`}
              className={`
                relative flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all
                ${clientType === option.value
                  ? 'border-primary bg-primary/5'
                  : 'border-muted hover:border-primary/50'
                }
              `}
            >
              <RadioGroupItem
                value={option.value}
                id={`client-type-${option.value}`}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={clientType === option.value ? 'text-primary' : 'text-muted-foreground'}>
                    {option.icon}
                  </span>
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

      {/* Informations client (si type sélectionné) */}
      {clientType && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Informations du client
            </CardTitle>
            <CardDescription>
              Coordonnées et identité du maître d'ouvrage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Nom / Raison sociale */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!isProClient && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="clientCivility">Civilité</Label>
                    <Select
                      value={(identity.civility as string) || (answers['client.identity.civility'] as string) || ''}
                      onValueChange={(value) => onAnswerChange('client.identity.civility', value)}
                      disabled={isProcessing}
                    >
                      <SelectTrigger id="clientCivility">
                        <SelectValue placeholder="Sélectionnez..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M">M.</SelectItem>
                        <SelectItem value="Mme">Mme</SelectItem>
                        <SelectItem value="M./Mme">M. et Mme</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientFirstName">Prénom</Label>
                    <Input
                      id="clientFirstName"
                      value={(identity.firstName as string) || (answers['client.identity.firstName'] as string) || ''}
                      onChange={(e) => onAnswerChange('client.identity.firstName', e.target.value)}
                      placeholder="Prénom du client"
                      disabled={isProcessing}
                    />
                  </div>
                </>
              )}
              <div className={`space-y-2 ${!isProClient ? '' : 'md:col-span-2'}`}>
                <Label htmlFor="clientName">{isProClient ? 'Raison sociale *' : 'Nom *'}</Label>
                <Input
                  id="clientName"
                  value={(identity.name as string) || (answers['client.identity.name'] as string) || ''}
                  onChange={(e) => onAnswerChange('client.identity.name', e.target.value)}
                  placeholder={isProClient ? 'Nom de l\'entreprise / organisme' : 'Nom de famille'}
                  disabled={isProcessing}
                />
              </div>
            </div>

            {/* Champs spécifiques aux clients professionnels */}
            {isProClient && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientSiret">SIRET</Label>
                  <Input
                    id="clientSiret"
                    value={(identity.siret as string) || (answers['client.identity.siret'] as string) || ''}
                    onChange={(e) => onAnswerChange('client.identity.siret', e.target.value)}
                    placeholder="123 456 789 00001"
                    maxLength={17}
                    disabled={isProcessing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientRef">Référence interne client</Label>
                  <Input
                    id="clientRef"
                    value={(identity.internalRef as string) || (answers['client.identity.internalRef'] as string) || ''}
                    onChange={(e) => onAnswerChange('client.identity.internalRef', e.target.value)}
                    placeholder="Votre référence dossier"
                    disabled={isProcessing}
                  />
                </div>
              </div>
            )}

            {/* Contact principal */}
            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium mb-4 flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Contact principal
              </h4>
              {isProClient && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactName">Nom du contact</Label>
                    <Input
                      id="contactName"
                      value={(contact.contactName as string) || (answers['client.contact.contactName'] as string) || ''}
                      onChange={(e) => onAnswerChange('client.contact.contactName', e.target.value)}
                      placeholder="Nom de votre interlocuteur"
                      disabled={isProcessing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactRole">Fonction</Label>
                    <Input
                      id="contactRole"
                      value={(contact.contactRole as string) || (answers['client.contact.contactRole'] as string) || ''}
                      onChange={(e) => onAnswerChange('client.contact.contactRole', e.target.value)}
                      placeholder="Ex: Directeur technique, Syndic..."
                      disabled={isProcessing}
                    />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientEmail">Email *</Label>
                  <Input
                    id="clientEmail"
                    type="email"
                    value={(contact.email as string) || (answers['client.contact.email'] as string) || ''}
                    onChange={(e) => onAnswerChange('client.contact.email', e.target.value)}
                    placeholder="email@client.com"
                    disabled={isProcessing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientPhone">Téléphone *</Label>
                  <Input
                    id="clientPhone"
                    type="tel"
                    value={(contact.phone as string) || (answers['client.contact.phone'] as string) || ''}
                    onChange={(e) => onAnswerChange('client.contact.phone', e.target.value)}
                    placeholder="06 12 34 56 78"
                    disabled={isProcessing}
                  />
                </div>
              </div>
            </div>

            {/* Préférence de contact */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Moyen de contact préféré</Label>
                <Select
                  value={(contact.preferredContact as string) || (answers['client.contact.preferredContact'] as string) || ''}
                  onValueChange={(value) => onAnswerChange('client.contact.preferredContact', value)}
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
              <div className="space-y-2">
                <Label>Disponibilités</Label>
                <div className="flex flex-wrap gap-2 pt-2">
                  {['morning', 'afternoon', 'evening'].map((slot) => {
                    const currentSlots = (contact.availableSlots as string[]) ||
                      (answers['client.contact.availableSlots'] as string[]) || [];
                    const isSelected = currentSlots.includes(slot);
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => {
                          const updated = isSelected
                            ? currentSlots.filter(s => s !== slot)
                            : [...currentSlots, slot];
                          onAnswerChange('client.contact.availableSlots', updated);
                        }}
                        disabled={isProcessing}
                        className={`
                          px-3 py-1.5 rounded-full text-sm transition-all
                          ${isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted hover:bg-muted/80'
                          }
                        `}
                      >
                        {slot === 'morning' ? '🌅 Matin' :
                          slot === 'afternoon' ? '☀️ Après-midi' : '🌙 Soir'}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contexte du projet */}
      {clientType && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Contexte de l'intervention
            </CardTitle>
            <CardDescription>
              Nature et cadre de la demande client
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Type de projet */}
            <div className="space-y-3">
              <Label className="text-base">Type de projet *</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {PROJECT_TYPE_OPTIONS.map((option) => {
                  const isSelected = projectType === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onAnswerChange('client.context.projectType', option.value)}
                      disabled={isProcessing}
                      className={`
                        p-3 rounded-lg border-2 text-left transition-all
                        ${isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-primary/50'
                        }
                      `}
                    >
                      <div className="font-medium">{option.label}</div>
                      <div className="text-sm text-muted-foreground">{option.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Nature de la demande */}
            <div className="space-y-3">
              <Label className="text-base">Nature de la demande</Label>
              <div className="flex flex-wrap gap-2">
                {REQUEST_NATURE_OPTIONS.map((option) => {
                  const isSelected = requestNature === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onAnswerChange('client.context.requestNature', option.value)}
                      disabled={isProcessing}
                      className={`
                        flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all
                        ${isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-primary/50'
                        }
                      `}
                    >
                      <span>{option.label}</span>
                      {option.badge && (
                        <Badge variant={option.badgeVariant || 'outline'} className="text-xs">
                          {option.badge}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Délai / Urgence */}
            <div className="space-y-3">
              <Label className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Délai souhaité
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {URGENCY_OPTIONS.map((option) => {
                  const currentUrgency = (context.urgency as string) ||
                    (answers['client.context.timeline.urgency'] as string);
                  const isSelected = currentUrgency === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onAnswerChange('client.context.timeline.urgency', option.value)}
                      disabled={isProcessing}
                      className={`
                        p-3 rounded-lg border-2 text-center transition-all
                        ${isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-primary/50'
                        }
                        ${option.value === 'immediate' ? 'border-orange-300' : ''}
                      `}
                    >
                      <div className="font-medium text-sm">{option.label}</div>
                      <div className="text-xs text-muted-foreground">{option.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Référence AO (si applicable) */}
            {(requestNature === 'appel_offres' || requestNature === 'marche_public' || requestNature === 'consultation') && (
              <div className="space-y-2">
                <Label htmlFor="tenderRef">Référence consultation / AO</Label>
                <Input
                  id="tenderRef"
                  value={(context.tenderRef as string) || (answers['client.context.tenderRef'] as string) || ''}
                  onChange={(e) => onAnswerChange('client.context.tenderRef', e.target.value)}
                  placeholder="Ex: AO-2024-001, DCE Rénovation Mairie..."
                  disabled={isProcessing}
                />
              </div>
            )}

            {/* Notes complémentaires */}
            <div className="space-y-2">
              <Label htmlFor="clientNotes">Notes / Informations complémentaires</Label>
              <Textarea
                id="clientNotes"
                value={(context.notes as string) || (answers['client.context.notes'] as string) || ''}
                onChange={(e) => onAnswerChange('client.context.notes', e.target.value)}
                placeholder="Contexte particulier, historique avec le client, points d'attention..."
                rows={3}
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
              <strong className="block mb-2">Éléments identifiés pour ce dossier :</strong>
              <ul className="space-y-1">
                {insights.map((insight, index) => (
                  <li key={index} className="text-sm">{insight}</li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Info données */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Ces informations seront utilisées pour personnaliser les documents générés
          (mentions légales, clauses spécifiques, format adapté au contexte).
        </AlertDescription>
      </Alert>
    </div>
  );
}

export default StepClientInfo;

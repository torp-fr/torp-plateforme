/**
 * Étape 4 B2B - Budget & Validation
 * Budget, finition, récapitulatif et génération documents
 */

import React, { useMemo } from 'react';
import { StepComponentProps } from '../../WizardContainer';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Euro, CheckCircle2, User, MapPin, Hammer, Calendar,
  FileText, Download, Sparkles, AlertTriangle
} from 'lucide-react';

// Niveaux de finition
const FINISH_LEVELS = [
  { value: 'basic', label: 'Basique', desc: 'Fonctionnel', multiplier: '0.8x' },
  { value: 'standard', label: 'Standard', desc: 'Qualité/prix', multiplier: '1x' },
  { value: 'premium', label: 'Premium', desc: 'Haut de gamme', multiplier: '1.3x' },
  { value: 'luxury', label: 'Luxe', desc: 'Sur-mesure', multiplier: '1.6x' },
];

// Connaissance budget
const BUDGET_KNOWLEDGE = [
  { value: 'defined', label: 'Budget défini', desc: 'Enveloppe connue' },
  { value: 'estimate', label: 'Estimation', desc: 'Idée approximative' },
  { value: 'no_idea', label: 'À estimer', desc: 'Attente estimation' },
];

export function StepB2BBudgetValidation({
  project,
  answers,
  onAnswerChange,
  isProcessing,
}: StepComponentProps) {
  const client = (project.client || {}) as Record<string, unknown>;
  const clientIdentity = (client.identity || {}) as Record<string, unknown>;
  const clientContact = (client.contact || {}) as Record<string, unknown>;
  const clientContext = (client.context || {}) as Record<string, unknown>;
  const site = (client.site || {}) as Record<string, unknown>;
  const siteAddress = (site.address || {}) as Record<string, unknown>;
  const workProject = (project.workProject || {}) as Record<string, unknown>;
  const general = (workProject.general || {}) as Record<string, unknown>;
  const scope = (workProject.scope || {}) as Record<string, unknown>;
  const budget = (workProject.budget || {}) as Record<string, unknown>;
  const quality = (workProject.quality || {}) as Record<string, unknown>;
  const constraints = (workProject.constraints || {}) as Record<string, unknown>;
  const temporal = (constraints.temporal || {}) as Record<string, unknown>;

  const getValue = (path: string, section: 'client' | 'workProject' = 'workProject') => {
    const prefix = section === 'client' ? 'client.' : 'workProject.';
    const obj = section === 'client' ? client : workProject;
    return answers[`${prefix}${path}`] ?? getNestedValue(obj, path) ?? '';
  };

  const budgetKnowledge = getValue('budget.knowledge') as string;
  const finishLevel = getValue('quality.finishLevel') as string;

  // Récapitulatif
  const summary = useMemo(() => {
    const clientType = getValue('identity.clientType', 'client') as string;
    const clientName = getValue('identity.name', 'client') as string;
    const address = `${siteAddress.streetName || ''}, ${siteAddress.postalCode || ''} ${siteAddress.city || ''}`.trim();
    const projectType = getValue('scope.workType') as string;
    const projectTitle = getValue('general.title') as string;
    const urgency = getValue('constraints.temporal.urgencyLevel') as string;
    const requestNature = getValue('context.requestNature', 'client') as string;

    return { clientType, clientName, address, projectType, projectTitle, urgency, requestNature };
  }, [client, siteAddress, workProject, answers]);

  const isComplete = summary.clientType && (summary.address.length > 5 || summary.projectType);

  return (
    <div className="space-y-6">
      {/* Budget */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Euro className="w-5 h-5 text-primary" />
            Budget prévisionnel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connaissance du budget */}
          <RadioGroup
            value={budgetKnowledge}
            onValueChange={(v) => onAnswerChange('workProject.budget.knowledge', v)}
            className="grid grid-cols-3 gap-2"
          >
            {BUDGET_KNOWLEDGE.map((opt) => (
              <label
                key={opt.value}
                className={`flex flex-col items-center p-3 rounded-lg border-2 cursor-pointer transition-all text-center
                  ${budgetKnowledge === opt.value ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'}`}
              >
                <RadioGroupItem value={opt.value} className="sr-only" />
                <span className="font-medium text-sm">{opt.label}</span>
                <span className="text-xs text-muted-foreground">{opt.desc}</span>
              </label>
            ))}
          </RadioGroup>

          {/* Saisie budget */}
          {(budgetKnowledge === 'defined' || budgetKnowledge === 'estimate') && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
              <div className="space-y-2">
                <Label>Budget min (€)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  value={getValue('budget.totalEnvelope.min') as string}
                  onChange={(e) => onAnswerChange('workProject.budget.totalEnvelope.min', parseInt(e.target.value) || null)}
                  placeholder="50000"
                  disabled={isProcessing}
                />
              </div>
              <div className="space-y-2">
                <Label>Budget max (€)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  value={getValue('budget.totalEnvelope.max') as string}
                  onChange={(e) => onAnswerChange('workProject.budget.totalEnvelope.max', parseInt(e.target.value) || null)}
                  placeholder="80000"
                  disabled={isProcessing}
                />
              </div>
            </div>
          )}

          {/* Niveau de finition */}
          <div className="space-y-2 pt-2">
            <Label>Niveau de finition</Label>
            <RadioGroup
              value={finishLevel}
              onValueChange={(v) => onAnswerChange('workProject.quality.finishLevel', v)}
              className="grid grid-cols-4 gap-2"
            >
              {FINISH_LEVELS.map((level) => (
                <label
                  key={level.value}
                  className={`flex flex-col items-center p-3 rounded-lg border-2 cursor-pointer transition-all text-center
                    ${finishLevel === level.value ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'}`}
                >
                  <RadioGroupItem value={level.value} className="sr-only" />
                  <span className="font-medium text-sm">{level.label}</span>
                  <span className="text-xs text-muted-foreground">{level.multiplier}</span>
                </label>
              ))}
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Récapitulatif */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            Récapitulatif du projet
          </CardTitle>
          <CardDescription>Vérifiez les informations avant validation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Client */}
          <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
            <User className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="font-medium">Client</div>
              <div className="text-sm text-muted-foreground">
                {summary.clientName || 'Non renseigné'}
                {summary.clientType && <Badge variant="outline" className="ml-2">{summary.clientType}</Badge>}
              </div>
              {summary.requestNature && (
                <Badge variant="secondary" className="mt-1">{summary.requestNature}</Badge>
              )}
            </div>
          </div>

          {/* Site */}
          <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
            <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="font-medium">Site d'intervention</div>
              <div className="text-sm text-muted-foreground">
                {summary.address.length > 5 ? summary.address : 'Adresse non renseignée'}
              </div>
            </div>
          </div>

          {/* Projet */}
          <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
            <Hammer className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="font-medium">Projet</div>
              <div className="text-sm text-muted-foreground">
                {summary.projectTitle || summary.projectType || 'Non renseigné'}
              </div>
              {summary.projectType && summary.projectTitle && (
                <Badge variant="outline" className="mt-1">{summary.projectType}</Badge>
              )}
            </div>
          </div>

          {/* Planning */}
          <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
            <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="font-medium">Délai</div>
              <div className="text-sm text-muted-foreground">
                {summary.urgency || 'Non défini'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents générés */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Documents générés
          </CardTitle>
          <CardDescription>
            Ces documents seront générés automatiquement après validation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { name: 'Fiche projet client', desc: 'Synthèse des informations client et site' },
            { name: 'CCTP (Cahier des Clauses Techniques)', desc: 'Spécifications techniques des travaux' },
            { name: 'DCE (Dossier de Consultation)', desc: 'Dossier complet pour consultation' },
          ].map((doc) => (
            <div key={doc.name} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="font-medium text-sm">{doc.name}</div>
                <div className="text-xs text-muted-foreground">{doc.desc}</div>
              </div>
              <Badge variant="outline">
                <Sparkles className="w-3 h-3 mr-1" />
                Auto
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Validation */}
      {!isComplete && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Complétez au minimum le type de client et l'adresse ou le type de projet
            pour valider ce projet.
          </AlertDescription>
        </Alert>
      )}

      {isComplete && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>Projet prêt pour validation.</strong> Cliquez sur "Terminer" pour
            générer les documents et créer le projet.
          </AlertDescription>
        </Alert>
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

export default StepB2BBudgetValidation;

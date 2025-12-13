/**
 * Étape B2G 4 - Marché public
 * Type de marché, allotissement et procédure
 */

import React from 'react';
import { StepComponentProps } from '../WizardContainer';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Scale, FileText, Users, AlertTriangle, Info, Layers, CheckCircle, Euro
} from 'lucide-react';

const TYPES_MARCHE = [
  {
    value: 'travaux',
    label: 'Marché de travaux',
    description: 'Réalisation de travaux de bâtiment ou de génie civil',
    seuils: { mapa: 100000, procedure: 5382000 },
  },
  {
    value: 'fournitures',
    label: 'Marché de fournitures',
    description: 'Achat, crédit-bail, location de produits',
    seuils: { mapa: 40000, procedure: 215000 },
  },
  {
    value: 'services',
    label: 'Marché de services',
    description: 'Prestations intellectuelles ou techniques',
    seuils: { mapa: 40000, procedure: 215000 },
  },
  {
    value: 'maitrise_oeuvre',
    label: 'Maîtrise d\'œuvre',
    description: 'Conception, études, direction de travaux',
    seuils: { mapa: 40000, procedure: 215000 },
  },
  {
    value: 'mixte',
    label: 'Marché mixte',
    description: 'Combinaison travaux/services ou fournitures',
    seuils: { mapa: 40000, procedure: 215000 },
  },
];

const PROCEDURES = [
  { value: 'gre_gre', label: 'Gré à gré', description: 'Moins de 40 000 € HT', maxHT: 40000 },
  { value: 'mapa', label: 'MAPA', description: 'Procédure adaptée', maxHT: 5382000 },
  { value: 'appel_offres_ouvert', label: 'Appel d\'offres ouvert', description: 'Publicité + mise en concurrence' },
  { value: 'appel_offres_restreint', label: 'Appel d\'offres restreint', description: 'Sélection préalable des candidats' },
  { value: 'procedure_negociee', label: 'Procédure négociée', description: 'Avec ou sans publicité' },
  { value: 'dialogue_competitif', label: 'Dialogue compétitif', description: 'Pour projets complexes' },
  { value: 'concours', label: 'Concours', description: 'Notamment pour maîtrise d\'œuvre' },
];

const CRITERES_ATTRIBUTION = [
  { id: 'prix', label: 'Prix', defaultWeight: 40 },
  { id: 'technique', label: 'Valeur technique', defaultWeight: 40 },
  { id: 'delai', label: 'Délai d\'exécution', defaultWeight: 10 },
  { id: 'environnement', label: 'Critères environnementaux', defaultWeight: 5 },
  { id: 'social', label: 'Critères sociaux (insertion)', defaultWeight: 5 },
  { id: 'qualite', label: 'Qualité de service', defaultWeight: 0 },
  { id: 'sav', label: 'SAV / Garanties', defaultWeight: 0 },
];

const FORMES_PRIX = [
  { value: 'global_forfaitaire', label: 'Prix global et forfaitaire', description: 'Prix fixe pour l\'ensemble' },
  { value: 'unitaires', label: 'Prix unitaires', description: 'Application sur quantités réelles' },
  { value: 'mixte', label: 'Prix mixtes', description: 'Combinaison forfaitaire + unitaires' },
];

export function StepB2GMarche({
  project,
  answers,
  onAnswerChange,
  errors,
  isProcessing,
}: StepComponentProps) {
  const client = (project.client || {}) as Record<string, unknown>;
  const marche = (client.marche || {}) as Record<string, unknown>;
  const criteres = (marche.criteres || {}) as Record<string, number>;

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

  const montantEstime = getValue('marche.montantEstime', 0) as number;
  const typeMarche = getValue('marche.type', '') as string;

  // Déterminer la procédure recommandée
  const getProcedureRecommandee = () => {
    if (montantEstime <= 40000) return 'gre_gre';
    if (typeMarche === 'travaux') {
      if (montantEstime <= 100000) return 'mapa';
      if (montantEstime <= 5382000) return 'mapa';
      return 'appel_offres_ouvert';
    }
    if (montantEstime <= 215000) return 'mapa';
    return 'appel_offres_ouvert';
  };

  const totalCriteres = Object.values(criteres).reduce((sum: number, val) => sum + (val || 0), 0);

  return (
    <div className="space-y-8">
      {/* Type de marché */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Scale className="w-5 h-5 text-primary" />
            Type de marché
          </CardTitle>
          <CardDescription>
            Qualification juridique du marché selon le Code de la commande publique
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={typeMarche}
            onValueChange={(value) => onAnswerChange('client.marche.type', value)}
            className="grid grid-cols-1 gap-3"
          >
            {TYPES_MARCHE.map((type) => (
              <label
                key={type.value}
                htmlFor={`type-${type.value}`}
                className={`
                  flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
                  ${typeMarche === type.value
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-primary/50'
                  }
                `}
              >
                <RadioGroupItem
                  value={type.value}
                  id={`type-${type.value}`}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{type.label}</span>
                    <Badge variant="outline" className="text-xs">
                      MAPA: {(type.seuils.mapa / 1000).toFixed(0)}k€ HT
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{type.description}</p>
                </div>
              </label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Montant estimé */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Euro className="w-5 h-5 text-primary" />
            Estimation financière
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="montantEstime">Montant estimé HT *</Label>
              <Input
                id="montantEstime"
                type="number"
                min={0}
                value={montantEstime || ''}
                onChange={(e) => onAnswerChange('client.marche.montantEstime', parseFloat(e.target.value) || 0)}
                placeholder="150000"
                disabled={isProcessing}
              />
              <p className="text-xs text-muted-foreground">
                Estimation prévisionnelle pour déterminer la procédure
              </p>
            </div>
            <div className="space-y-2">
              <Label>Procédure recommandée</Label>
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">
                  {PROCEDURES.find(p => p.value === getProcedureRecommandee())?.label}
                </p>
                <p className="text-sm text-muted-foreground">
                  {PROCEDURES.find(p => p.value === getProcedureRecommandee())?.description}
                </p>
              </div>
            </div>
          </div>

          {montantEstime > 0 && montantEstime <= 40000 && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Montant inférieur à 40 000 € HT : procédure simplifiée possible (gré à gré)
                avec simple mise en concurrence recommandée.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Procédure */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Procédure de passation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="procedure">Type de procédure *</Label>
            <Select
              value={getValue('marche.procedure', '') as string}
              onValueChange={(value) => onAnswerChange('client.marche.procedure', value)}
              disabled={isProcessing}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez la procédure..." />
              </SelectTrigger>
              <SelectContent>
                {PROCEDURES.map((proc) => (
                  <SelectItem key={proc.value} value={proc.value}>
                    <div>
                      <span className="font-medium">{proc.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {proc.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="negotiation"
              checked={getValue('marche.negotiation', false) as boolean}
              onCheckedChange={(checked) => onAnswerChange('client.marche.negotiation', checked)}
              disabled={isProcessing}
            />
            <Label htmlFor="negotiation" className="cursor-pointer">
              Possibilité de négociation avec les candidats
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Allotissement */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Allotissement
          </CardTitle>
          <CardDescription>
            L'allotissement est le principe (art. L2113-10 CCP). Le marché global doit être justifié.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={getValue('marche.allotissement', 'separe') as string}
            onValueChange={(value) => onAnswerChange('client.marche.allotissement', value)}
            className="space-y-3"
          >
            <label
              htmlFor="allotissement-separe"
              className={`
                flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
                ${getValue('marche.allotissement') === 'separe'
                  ? 'border-primary bg-primary/5'
                  : 'border-muted hover:border-primary/50'
                }
              `}
            >
              <RadioGroupItem value="separe" id="allotissement-separe" className="mt-0.5" />
              <div>
                <span className="font-medium">Marchés séparés (allotis)</span>
                <p className="text-sm text-muted-foreground">
                  Un marché par lot technique (recommandé pour favoriser l'accès des PME)
                </p>
              </div>
            </label>

            <label
              htmlFor="allotissement-global"
              className={`
                flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
                ${getValue('marche.allotissement') === 'global'
                  ? 'border-primary bg-primary/5'
                  : 'border-muted hover:border-primary/50'
                }
              `}
            >
              <RadioGroupItem value="global" id="allotissement-global" className="mt-0.5" />
              <div>
                <span className="font-medium">Marché global (unique)</span>
                <p className="text-sm text-muted-foreground">
                  Un seul marché pour l'ensemble des prestations (à justifier)
                </p>
              </div>
            </label>
          </RadioGroup>

          {getValue('marche.allotissement') === 'global' && (
            <div className="space-y-2">
              <Label htmlFor="justifGlobal">Justification du marché global *</Label>
              <Textarea
                id="justifGlobal"
                value={getValue('marche.justifGlobal', '') as string}
                onChange={(e) => onAnswerChange('client.marche.justifGlobal', e.target.value)}
                placeholder="Raisons techniques, économiques ou financières justifiant l'absence d'allotissement..."
                rows={3}
                disabled={isProcessing}
              />
            </div>
          )}

          {getValue('marche.allotissement') === 'separe' && (
            <div className="space-y-2">
              <Label htmlFor="nombreLots">Nombre de lots prévus</Label>
              <Input
                id="nombreLots"
                type="number"
                min={2}
                value={getValue('marche.nombreLots', '') as string}
                onChange={(e) => onAnswerChange('client.marche.nombreLots', parseInt(e.target.value) || null)}
                placeholder="Ex: 6"
                disabled={isProcessing}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Critères d'attribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-primary" />
            Critères d'attribution
          </CardTitle>
          <CardDescription>
            Pondération des critères (total = 100%)
            {totalCriteres > 0 && (
              <Badge
                variant={totalCriteres === 100 ? 'default' : 'destructive'}
                className="ml-2"
              >
                Total: {totalCriteres}%
              </Badge>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CRITERES_ATTRIBUTION.map((critere) => (
              <div key={critere.id} className="flex items-center gap-3">
                <Label htmlFor={`critere-${critere.id}`} className="flex-1">
                  {critere.label}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id={`critere-${critere.id}`}
                    type="number"
                    min={0}
                    max={100}
                    className="w-20"
                    value={criteres[critere.id] ?? critere.defaultWeight}
                    onChange={(e) => onAnswerChange(
                      `client.marche.criteres.${critere.id}`,
                      parseInt(e.target.value) || 0
                    )}
                    disabled={isProcessing}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
            ))}
          </div>

          {totalCriteres > 0 && totalCriteres !== 100 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Le total des pondérations doit être égal à 100% (actuellement {totalCriteres}%)
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Forme de prix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Euro className="w-5 h-5 text-primary" />
            Forme de prix
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={getValue('marche.formePrix', 'global_forfaitaire') as string}
            onValueChange={(value) => onAnswerChange('client.marche.formePrix', value)}
            className="space-y-3"
          >
            {FORMES_PRIX.map((forme) => (
              <label
                key={forme.value}
                htmlFor={`forme-${forme.value}`}
                className={`
                  flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
                  ${getValue('marche.formePrix') === forme.value
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-primary/50'
                  }
                `}
              >
                <RadioGroupItem value={forme.value} id={`forme-${forme.value}`} className="mt-0.5" />
                <div>
                  <span className="font-medium">{forme.label}</span>
                  <p className="text-sm text-muted-foreground">{forme.description}</p>
                </div>
              </label>
            ))}
          </RadioGroup>

          <div className="mt-4 flex items-center space-x-2">
            <Checkbox
              id="revision"
              checked={getValue('marche.revisionPrix', false) as boolean}
              onCheckedChange={(checked) => onAnswerChange('client.marche.revisionPrix', checked)}
              disabled={isProcessing}
            />
            <Label htmlFor="revision" className="cursor-pointer">
              Clause de révision des prix (recommandé pour marchés &gt; 12 mois)
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Info réglementaire */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Références :</strong> Code de la commande publique (CCP) - Ordonnance n°2018-1074
          du 26 novembre 2018. Seuils de procédure en vigueur au 1er janvier 2024.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export default StepB2GMarche;

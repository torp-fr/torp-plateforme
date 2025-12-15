/**
 * Phase0IncompleteAlert - Composant d'alerte pour prérequis Phase 0 manquants
 *
 * Affiche les erreurs et avertissements de validation Phase 0
 * avec des actions correctives.
 */

import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import type { ValidationError, ValidationWarning } from '@/hooks/phase1/usePhase0Validation';

interface Phase0IncompleteAlertProps {
  errors: ValidationError[];
  warnings?: ValidationWarning[];
  completeness?: number;
  projectId?: string;
  onRetry?: () => void;
}

export function Phase0IncompleteAlert({
  errors,
  warnings = [],
  completeness = 0,
  projectId,
  onRetry
}: Phase0IncompleteAlertProps) {
  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;

  return (
    <div className="container max-w-3xl py-8">
      {/* En-tête */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 mb-4">
          <AlertTriangle className="w-8 h-8 text-orange-600" />
        </div>
        <h1 className="text-2xl font-bold">Phase 0 incomplète</h1>
        <p className="text-muted-foreground mt-2">
          Veuillez compléter les éléments suivants avant de passer à la consultation
        </p>
      </div>

      {/* Barre de progression */}
      {completeness > 0 && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progression du projet</span>
              <span className="text-sm text-muted-foreground">{completeness}%</span>
            </div>
            <Progress value={completeness} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {completeness < 50
                ? 'Projet en début de définition'
                : completeness < 80
                ? 'Projet bien avancé, quelques éléments à compléter'
                : 'Projet presque complet'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Erreurs bloquantes */}
      {hasErrors && (
        <div className="space-y-3 mb-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            Éléments obligatoires ({errors.length})
          </h2>

          {errors.map((error, index) => (
            <Card key={index} className="border-destructive/50 bg-destructive/5">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-destructive">{error.message}</p>
                    <p className="text-sm text-muted-foreground mt-1">{error.action}</p>
                  </div>
                  {error.link && (
                    <Button size="sm" asChild>
                      <Link to={error.link}>
                        Corriger
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Avertissements */}
      {hasWarnings && (
        <div className="space-y-3 mb-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-orange-600">
            <Info className="w-5 h-5" />
            Recommandations ({warnings.length})
          </h2>

          {warnings.map((warning, index) => (
            <Alert key={index} className="bg-orange-50 border-orange-200">
              <Info className="w-4 h-4 text-orange-600" />
              <AlertTitle className="text-orange-800">{warning.message}</AlertTitle>
              {warning.recommendation && (
                <AlertDescription className="text-orange-700">
                  {warning.recommendation}
                </AlertDescription>
              )}
            </Alert>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 mt-8">
        <Button
          variant="default"
          className="flex-1"
          asChild
        >
          <Link to={projectId ? `/phase0/${projectId}` : '/phase0'}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à Phase 0
          </Link>
        </Button>

        {onRetry && (
          <Button
            variant="outline"
            onClick={onRetry}
            className="flex-1"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Revérifier
          </Button>
        )}
      </div>

      {/* Aide */}
      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="font-medium flex items-center gap-2 mb-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          Checklist Phase 0
        </h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li className={errors.some(e => e.code.includes('OWNER')) ? 'text-destructive' : ''}>
            {errors.some(e => e.code.includes('OWNER')) ? '❌' : '✓'} Profil du maître d'ouvrage
          </li>
          <li className={errors.some(e => e.code.includes('ADDRESS') || e.code.includes('STREET') || e.code.includes('POSTAL') || e.code.includes('CITY')) ? 'text-destructive' : ''}>
            {errors.some(e => e.code.includes('ADDRESS')) ? '❌' : '✓'} Adresse complète du bien
          </li>
          <li className={errors.some(e => e.code === 'NO_LOTS_SELECTED') ? 'text-destructive' : ''}>
            {errors.some(e => e.code === 'NO_LOTS_SELECTED') ? '❌' : '✓'} Lots de travaux sélectionnés
          </li>
          <li className={warnings.some(w => w.code === 'BUDGET_NOT_ESTIMATED') ? 'text-orange-600' : ''}>
            {warnings.some(w => w.code === 'BUDGET_NOT_ESTIMATED') ? '⚠️' : '✓'} Budget estimé (recommandé)
          </li>
          <li className={warnings.some(w => w.code === 'CCTP_NOT_GENERATED') ? 'text-orange-600' : ''}>
            {warnings.some(w => w.code === 'CCTP_NOT_GENERATED') ? '⚠️' : '✓'} CCTP généré (recommandé)
          </li>
        </ul>
      </div>
    </div>
  );
}

export default Phase0IncompleteAlert;

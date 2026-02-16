/**
 * Execution Context Panel - Shows analysis context and metadata
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Briefcase, Calendar, User } from 'lucide-react';
import type { ExecutionContext } from '@/types/audit';

interface ExecutionContextPanelProps {
  context: ExecutionContext;
}

export function ExecutionContextPanel({ context }: ExecutionContextPanelProps) {
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Contexte d'exécution</CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Project Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <label className="text-sm font-semibold text-foreground">Région</label>
            </div>
            <p className="text-foreground">{context.region || 'N/A'}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <label className="text-sm font-semibold text-foreground">Type de projet</label>
            </div>
            <p className="text-foreground">{context.projectType || 'N/A'}</p>
          </div>

          {context.address && (
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-foreground">Adresse</label>
              <p className="text-foreground">{context.address}</p>
            </div>
          )}
        </div>

        {/* Work Types */}
        {context.workTypes && context.workTypes.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Types de travaux</label>
            <div className="flex flex-wrap gap-2">
              {context.workTypes.map((type) => (
                <Badge key={type} variant="secondary">
                  {type}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Contractor Info */}
        <div className="border-t border-border pt-4 space-y-4">
          <h4 className="font-semibold text-foreground">Informations entrepreneur</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Entreprise</label>
              <p className="text-foreground">{context.contractorName || 'N/A'}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">SIRET</label>
              <p className="text-foreground font-mono">{context.contractorSiret || 'N/A'}</p>
            </div>

            {context.contractorSolvencyScore !== undefined && (
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Score de solvabilité</label>
                <div className="flex items-center gap-2">
                  <p className="text-foreground font-semibold">{context.contractorSolvencyScore}/100</p>
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
                      style={{ width: `${context.contractorSolvencyScore}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Execution Info */}
        <div className="border-t border-border pt-4 space-y-4">
          <h4 className="font-semibold text-foreground">Exécution</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <label className="text-muted-foreground">Démarrage</label>
              <div className="flex items-center gap-2 text-foreground">
                <Calendar className="h-3 w-3" />
                {formatDate(context.startedAt)}
              </div>
            </div>

            {context.completedAt && (
              <div className="space-y-1">
                <label className="text-muted-foreground">Fin</label>
                <div className="flex items-center gap-2 text-foreground">
                  <Calendar className="h-3 w-3" />
                  {formatDate(context.completedAt)}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-muted-foreground">Durée totale</label>
              <p className="text-foreground">{formatDuration(context.totalDurationMs)}</p>
            </div>

            <div className="space-y-1">
              <label className="text-muted-foreground">Statut</label>
              <Badge
                variant={
                  context.status === 'completed'
                    ? 'default'
                    : context.status === 'failed'
                      ? 'destructive'
                      : 'secondary'
                }
              >
                {context.status}
              </Badge>
            </div>
          </div>
        </div>

        {/* Model Info */}
        {context.aiModel && (
          <div className="border-t border-border pt-4 space-y-2">
            <h4 className="font-semibold text-foreground">Configuration IA</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="text-muted-foreground">Modèle</label>
                <p className="text-foreground">{context.aiModel}</p>
              </div>
              {context.aiTemperature !== undefined && (
                <div>
                  <label className="text-muted-foreground">Température</label>
                  <p className="text-foreground">{context.aiTemperature}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

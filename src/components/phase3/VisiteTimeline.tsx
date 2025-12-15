/**
 * VisiteTimeline - Timeline des visites de contrôle
 * Affiche l'historique et les visites planifiées
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Clock,
  User,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  Plus,
} from 'lucide-react';
import type { VisiteControle, RapportControle } from '@/types/phase3';

interface VisiteTimelineProps {
  visites: VisiteControle[];
  onAddVisite?: () => void;
  onViewVisite?: (visite: VisiteControle) => void;
}

const STATUT_VISITE_CONFIG = {
  planifiee: { label: 'Planifiée', color: 'bg-blue-500', dotColor: 'bg-blue-500' },
  effectuee: { label: 'Effectuée', color: 'bg-green-500', dotColor: 'bg-green-500' },
  reportee: { label: 'Reportée', color: 'bg-yellow-500', dotColor: 'bg-yellow-500' },
  annulee: { label: 'Annulée', color: 'bg-red-500', dotColor: 'bg-red-400' },
};

const TYPE_VISITE_LABELS = {
  visite_initiale: 'Visite initiale',
  visite_periodique: 'Visite périodique',
  visite_finale: 'Visite finale',
  visite_inopinee: 'Visite inopinée',
  controle_levee_reserve: 'Contrôle levée réserves',
};

const AVIS_CONFIG = {
  favorable: { label: 'Favorable', color: 'text-green-600 bg-green-50', icon: CheckCircle2 },
  favorable_reserve: { label: 'Favorable avec réserves', color: 'text-yellow-600 bg-yellow-50', icon: AlertTriangle },
  defavorable: { label: 'Défavorable', color: 'text-red-600 bg-red-50', icon: XCircle },
  en_attente: { label: 'En attente', color: 'text-gray-600 bg-gray-50', icon: Clock },
};

export function VisiteTimeline({ visites, onAddVisite, onViewVisite }: VisiteTimelineProps) {
  // Trier les visites par date (les plus récentes en premier pour les effectuées, les plus proches pour les planifiées)
  const sortedVisites = [...visites].sort((a, b) => {
    const dateA = new Date(a.dateReelle || a.datePrevue);
    const dateB = new Date(b.dateReelle || b.datePrevue);
    return dateB.getTime() - dateA.getTime();
  });

  const upcomingVisites = sortedVisites.filter(v => v.statut === 'planifiee');
  const pastVisites = sortedVisites.filter(v => v.statut !== 'planifiee');

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const renderVisite = (visite: VisiteControle, isPast: boolean) => {
    const statutConfig = STATUT_VISITE_CONFIG[visite.statut];
    const date = visite.dateReelle || visite.datePrevue;

    return (
      <div key={visite.id} className="relative pl-8 pb-6 last:pb-0">
        {/* Ligne verticale */}
        <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-muted" />

        {/* Point sur la timeline */}
        <div
          className={`absolute left-1.5 top-1 w-4 h-4 rounded-full border-2 border-background ${statutConfig.dotColor}`}
        />

        {/* Contenu */}
        <div
          className={`p-4 rounded-lg border hover:shadow-sm transition-shadow cursor-pointer ${
            visite.statut === 'planifiee' ? 'bg-blue-50/50 border-blue-200' : 'bg-background'
          }`}
          onClick={() => onViewVisite?.(visite)}
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="font-medium">{TYPE_VISITE_LABELS[visite.type]}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                {formatDate(date)}
                <Clock className="h-3 w-3 ml-2" />
                {formatTime(visite.datePrevue)}
                {visite.dureeMinutes && (
                  <span className="text-xs">({visite.dureeMinutes} min)</span>
                )}
              </p>
            </div>
            <Badge className={statutConfig.color}>{statutConfig.label}</Badge>
          </div>

          {/* Contrôleur */}
          {visite.controleur && (
            <p className="text-sm flex items-center gap-2 mb-2">
              <User className="h-3 w-3 text-muted-foreground" />
              {visite.controleur}
            </p>
          )}

          {/* Rapport si existe */}
          {visite.rapport && (
            <div className={`mt-3 p-3 rounded-lg ${AVIS_CONFIG[visite.rapport.avis].color}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {React.createElement(AVIS_CONFIG[visite.rapport.avis].icon, {
                    className: 'h-4 w-4',
                  })}
                  <span className="font-medium text-sm">
                    Avis: {AVIS_CONFIG[visite.rapport.avis].label}
                  </span>
                </div>
                {visite.rapport.documentUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(visite.rapport!.documentUrl, '_blank');
                    }}
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    Rapport
                  </Button>
                )}
              </div>
              {visite.rapport.reserves.length > 0 && (
                <p className="text-xs mt-2">
                  {visite.rapport.reserves.length} réserve(s) émise(s)
                </p>
              )}
            </div>
          )}

          {/* Observations */}
          {visite.observations && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
              {visite.observations}
            </p>
          )}

          {/* Flèche */}
          <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Historique des visites
          </CardTitle>
          {onAddVisite && (
            <Button size="sm" onClick={onAddVisite}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle visite
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {visites.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Aucune visite planifiée</p>
            {onAddVisite && (
              <Button onClick={onAddVisite}>
                <Plus className="h-4 w-4 mr-2" />
                Planifier une visite
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Visites à venir */}
            {upcomingVisites.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  À venir ({upcomingVisites.length})
                </h4>
                <div className="space-y-0">
                  {upcomingVisites.map((visite) => renderVisite(visite, false))}
                </div>
              </div>
            )}

            {/* Visites passées */}
            {pastVisites.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Historique ({pastVisites.length})
                </h4>
                <div className="space-y-0">
                  {pastVisites.map((visite) => renderVisite(visite, true))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default VisiteTimeline;

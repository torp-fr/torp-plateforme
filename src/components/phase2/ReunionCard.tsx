/**
 * ReunionCard - Carte de réunion de chantier
 * Affiche les informations d'une réunion avec participants et actions
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  FileText,
  CheckCircle2,
  AlertCircle,
  Video,
  ChevronRight,
} from 'lucide-react';

export type StatutReunion = 'planifiee' | 'en_cours' | 'terminee' | 'annulee' | 'reportee';

export interface Participant {
  id: string;
  nom: string;
  role: string;
  entreprise?: string;
  present?: boolean;
  excuse?: boolean;
}

export interface Reunion {
  id: string;
  chantierId: string;
  numero: number;
  type: 'chantier' | 'coordination' | 'technique' | 'reception' | 'autre';
  objet: string;
  dateHeure: string;
  dureeMinutes: number;
  lieu?: string;
  visioUrl?: string;
  statut: StatutReunion;
  participants: Participant[];
  ordreJour?: string[];
  comptesRendusUrl?: string;
  pointsOuverts?: number;
  decisionsCount?: number;
}

interface ReunionCardProps {
  reunion: Reunion;
  onJoin?: () => void;
  onViewDetails?: () => void;
  compact?: boolean;
}

const STATUT_CONFIG: Record<StatutReunion, { label: string; color: string }> = {
  planifiee: { label: 'Planifiée', color: 'bg-blue-500' },
  en_cours: { label: 'En cours', color: 'bg-green-500' },
  terminee: { label: 'Terminée', color: 'bg-gray-500' },
  annulee: { label: 'Annulée', color: 'bg-red-500' },
  reportee: { label: 'Reportée', color: 'bg-yellow-500' },
};

const TYPE_LABELS: Record<Reunion['type'], string> = {
  chantier: 'Réunion de chantier',
  coordination: 'Coordination',
  technique: 'Réunion technique',
  reception: 'Réception',
  autre: 'Réunion',
};

export function ReunionCard({ reunion, onJoin, onViewDetails, compact = false }: ReunionCardProps) {
  const statutConfig = STATUT_CONFIG[reunion.statut];
  const dateReunion = new Date(reunion.dateHeure);
  const isToday = new Date().toDateString() === dateReunion.toDateString();
  const isPast = dateReunion < new Date();
  const presentCount = reunion.participants.filter(p => p.present).length;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  if (compact) {
    return (
      <div
        className={`flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer ${
          isToday ? 'border-primary bg-primary/5' : ''
        }`}
        onClick={onViewDetails}
      >
        <div className="flex-shrink-0 text-center">
          <p className="text-2xl font-bold">{dateReunion.getDate()}</p>
          <p className="text-xs text-muted-foreground uppercase">
            {dateReunion.toLocaleDateString('fr-FR', { month: 'short' })}
          </p>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">
            {TYPE_LABELS[reunion.type]} #{reunion.numero}
          </p>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Clock className="h-3 w-3" />
            {formatTime(dateReunion)}
            {reunion.lieu && (
              <>
                <span>•</span>
                <MapPin className="h-3 w-3" />
                {reunion.lieu}
              </>
            )}
          </p>
        </div>
        <Badge className={statutConfig.color}>{statutConfig.label}</Badge>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className={isToday ? 'border-primary' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline">{TYPE_LABELS[reunion.type]}</Badge>
              <span className="text-sm text-muted-foreground">#{reunion.numero}</span>
            </div>
            <CardTitle className="text-lg">{reunion.objet}</CardTitle>
          </div>
          <Badge className={statutConfig.color}>{statutConfig.label}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Date et heure */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className={isToday ? 'font-medium text-primary' : ''}>
              {isToday ? "Aujourd'hui" : formatDate(dateReunion)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{formatTime(dateReunion)}</span>
            <span className="text-muted-foreground">({reunion.dureeMinutes} min)</span>
          </div>
        </div>

        {/* Lieu / Visio */}
        {(reunion.lieu || reunion.visioUrl) && (
          <div className="flex items-center gap-4 text-sm">
            {reunion.lieu && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{reunion.lieu}</span>
              </div>
            )}
            {reunion.visioUrl && (
              <div className="flex items-center gap-2 text-primary">
                <Video className="h-4 w-4" />
                <span>Visioconférence disponible</span>
              </div>
            )}
          </div>
        )}

        {/* Participants */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Participants ({reunion.participants.length})
            </p>
            {reunion.statut === 'terminee' && (
              <span className="text-xs text-muted-foreground">
                {presentCount} présent(s)
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {reunion.participants.slice(0, 6).map((participant) => (
              <div
                key={participant.id}
                className={`flex items-center gap-2 px-2 py-1 rounded-full text-xs ${
                  participant.present === false && !participant.excuse
                    ? 'bg-red-100 text-red-700'
                    : participant.excuse
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-muted'
                }`}
              >
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[10px]">
                    {participant.nom.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <span>{participant.nom}</span>
                {participant.present && (
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                )}
              </div>
            ))}
            {reunion.participants.length > 6 && (
              <span className="px-2 py-1 text-xs text-muted-foreground">
                +{reunion.participants.length - 6} autres
              </span>
            )}
          </div>
        </div>

        {/* Ordre du jour */}
        {reunion.ordreJour && reunion.ordreJour.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Ordre du jour</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              {reunion.ordreJour.slice(0, 3).map((point, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-primary">{idx + 1}.</span>
                  <span>{point}</span>
                </li>
              ))}
              {reunion.ordreJour.length > 3 && (
                <li className="text-xs">+{reunion.ordreJour.length - 3} autres points</li>
              )}
            </ul>
          </div>
        )}

        {/* Stats si terminée */}
        {reunion.statut === 'terminee' && (
          <div className="flex items-center gap-4 py-2 px-3 bg-muted/50 rounded-lg text-sm">
            {reunion.comptesRendusUrl && (
              <div className="flex items-center gap-1 text-green-600">
                <FileText className="h-4 w-4" />
                <span>CR disponible</span>
              </div>
            )}
            {reunion.decisionsCount !== undefined && reunion.decisionsCount > 0 && (
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-blue-500" />
                <span>{reunion.decisionsCount} décision(s)</span>
              </div>
            )}
            {reunion.pointsOuverts !== undefined && reunion.pointsOuverts > 0 && (
              <div className="flex items-center gap-1 text-orange-600">
                <AlertCircle className="h-4 w-4" />
                <span>{reunion.pointsOuverts} point(s) ouvert(s)</span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {reunion.statut === 'planifiee' && reunion.visioUrl && onJoin && (
            <Button onClick={onJoin} className="flex-1">
              <Video className="h-4 w-4 mr-2" />
              Rejoindre
            </Button>
          )}
          {reunion.comptesRendusUrl && (
            <Button variant="outline" asChild>
              <a href={reunion.comptesRendusUrl} target="_blank" rel="noopener noreferrer">
                <FileText className="h-4 w-4 mr-2" />
                Compte-rendu
              </a>
            </Button>
          )}
          <Button variant="ghost" onClick={onViewDetails}>
            Détails
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default ReunionCard;

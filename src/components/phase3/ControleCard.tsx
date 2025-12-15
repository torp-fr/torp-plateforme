/**
 * ControleCard - Carte d'un organisme ou mission de contrôle
 * Affiche les informations du contrôle avec statut et réserves
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Building2,
  Shield,
  Zap,
  Flame,
  ThermometerSun,
  HardHat,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Calendar,
  FileText,
  ChevronRight,
  Phone,
  Mail,
} from 'lucide-react';
import type {
  OrganismeControle,
  TypeOrganismeControle,
  MissionBureauControle,
  StatutMissionControle,
} from '@/types/phase3';

interface ControleCardProps {
  organisme: OrganismeControle;
  onViewDetails?: () => void;
  onAddVisite?: () => void;
}

const TYPE_CONFIG: Record<TypeOrganismeControle, { label: string; icon: React.ElementType; color: string }> = {
  bureau_controle: { label: 'Bureau de contrôle', icon: Building2, color: 'bg-blue-500' },
  sps: { label: 'Coordinateur SPS', icon: HardHat, color: 'bg-orange-500' },
  consuel: { label: 'Consuel', icon: Zap, color: 'bg-yellow-500' },
  qualigaz: { label: 'Qualigaz', icon: Flame, color: 'bg-red-500' },
  certigaz: { label: 'Certigaz', icon: Flame, color: 'bg-red-400' },
  operateur_rt: { label: 'RE2020/RT', icon: ThermometerSun, color: 'bg-green-500' },
  autre: { label: 'Autre', icon: Shield, color: 'bg-gray-500' },
};

const STATUT_MISSION_CONFIG: Record<StatutMissionControle, { label: string; color: string; icon: React.ElementType }> = {
  planifiee: { label: 'Planifiée', color: 'bg-gray-400', icon: Clock },
  en_cours: { label: 'En cours', color: 'bg-blue-500', icon: Clock },
  rapport_emis: { label: 'Rapport émis', color: 'bg-purple-500', icon: FileText },
  avis_favorable: { label: 'Favorable', color: 'bg-green-500', icon: CheckCircle2 },
  avis_favorable_reserve: { label: 'Favorable avec réserves', color: 'bg-yellow-500', icon: AlertTriangle },
  avis_defavorable: { label: 'Défavorable', color: 'bg-red-500', icon: XCircle },
  cloturee: { label: 'Clôturée', color: 'bg-gray-500', icon: CheckCircle2 },
};

export function ControleCard({ organisme, onViewDetails, onAddVisite }: ControleCardProps) {
  const typeConfig = TYPE_CONFIG[organisme.type];
  const TypeIcon = typeConfig.icon;

  const totalReserves = organisme.missions.reduce((acc, m) => acc + m.nombreReserves, 0);
  const reservesLevees = organisme.missions.reduce((acc, m) => acc + m.reservesLevees, 0);
  const reservesEnAttente = totalReserves - reservesLevees;

  const formatCurrency = (amount?: number) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${typeConfig.color}`}>
              <TypeIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">{organisme.nom}</CardTitle>
              <p className="text-sm text-muted-foreground">{typeConfig.label}</p>
              {organisme.reference && (
                <p className="text-xs text-muted-foreground">Réf: {organisme.reference}</p>
              )}
            </div>
          </div>
          <Badge variant={organisme.statut === 'actif' ? 'default' : 'secondary'}>
            {organisme.statut === 'actif' ? 'Actif' : organisme.statut === 'termine' ? 'Terminé' : 'Suspendu'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Contact */}
        {organisme.contact && (
          <div className="flex items-center gap-4 text-sm">
            <span className="font-medium">{organisme.contact.nom}</span>
            {organisme.contact.email && (
              <a href={`mailto:${organisme.contact.email}`} className="flex items-center gap-1 text-primary hover:underline">
                <Mail className="h-3 w-3" />
                Email
              </a>
            )}
            {organisme.contact.telephone && (
              <a href={`tel:${organisme.contact.telephone}`} className="flex items-center gap-1 text-primary hover:underline">
                <Phone className="h-3 w-3" />
                {organisme.contact.telephone}
              </a>
            )}
          </div>
        )}

        {/* Missions */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Missions ({organisme.missions.length})</p>
          <div className="space-y-2">
            {organisme.missions.map((mission) => {
              const statutConfig = STATUT_MISSION_CONFIG[mission.statut];
              const StatutIcon = statutConfig.icon;
              const reservesPending = mission.nombreReserves - mission.reservesLevees;

              return (
                <div
                  key={mission.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      {mission.code}
                    </Badge>
                    <span className="text-sm">{mission.libelle}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {reservesPending > 0 && (
                      <Badge variant="outline" className="text-orange-600 border-orange-300">
                        {reservesPending} réserve(s)
                      </Badge>
                    )}
                    <Badge className={statutConfig.color}>
                      <StatutIcon className="h-3 w-3 mr-1" />
                      {statutConfig.label}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Réserves globales */}
        {totalReserves > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Levée des réserves</span>
              <span className="font-medium">{reservesLevees}/{totalReserves}</span>
            </div>
            <Progress value={(reservesLevees / totalReserves) * 100} className="h-2" />
            {reservesEnAttente > 0 && (
              <p className="text-xs text-orange-600">
                <AlertTriangle className="h-3 w-3 inline mr-1" />
                {reservesEnAttente} réserve(s) en attente de levée
              </p>
            )}
          </div>
        )}

        {/* Dates et montant */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          {organisme.dateDebut && (
            <div>
              <p className="text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Début mission
              </p>
              <p className="font-medium">
                {new Date(organisme.dateDebut).toLocaleDateString('fr-FR')}
              </p>
            </div>
          )}
          {organisme.montantHT && (
            <div>
              <p className="text-muted-foreground">Montant HT</p>
              <p className="font-medium">{formatCurrency(organisme.montantHT)}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {organisme.statut === 'actif' && onAddVisite && (
            <Button variant="outline" size="sm" onClick={onAddVisite}>
              <Calendar className="h-4 w-4 mr-2" />
              Planifier visite
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onViewDetails} className="ml-auto">
            Voir détails
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default ControleCard;

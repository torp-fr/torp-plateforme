/**
 * ChantierCard - Carte résumé d'un chantier
 * Affiche les informations principales et l'avancement
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Building2,
  Calendar,
  Euro,
  AlertTriangle,
  Clock,
  CheckCircle2,
  PauseCircle,
  ChevronRight,
  Users,
} from 'lucide-react';
import type { ChantierResume, StatutChantier, ChantierAlerte } from '@/types/phase2';

interface ChantierCardProps {
  chantier: ChantierResume;
  onSelect?: (id: string) => void;
}

const STATUT_CONFIG: Record<StatutChantier, { label: string; color: string; icon: React.ElementType }> = {
  preparation: { label: 'Préparation', color: 'bg-gray-500', icon: Clock },
  ordre_service: { label: 'Ordre de service', color: 'bg-blue-500', icon: Calendar },
  en_cours: { label: 'En cours', color: 'bg-green-500', icon: Building2 },
  suspendu: { label: 'Suspendu', color: 'bg-yellow-500', icon: PauseCircle },
  reception: { label: 'Réception', color: 'bg-purple-500', icon: CheckCircle2 },
  garantie_parfait_achevement: { label: 'GPA', color: 'bg-indigo-500', icon: CheckCircle2 },
  clos: { label: 'Clôturé', color: 'bg-gray-400', icon: CheckCircle2 },
};

const ALERTE_ICONS: Record<ChantierAlerte['type'], React.ElementType> = {
  retard: Clock,
  budget: Euro,
  document: Calendar,
  securite: AlertTriangle,
  qualite: CheckCircle2,
};

export function ChantierCard({ chantier, onSelect }: ChantierCardProps) {
  const navigate = useNavigate();
  const statutConfig = STATUT_CONFIG[chantier.statut];
  const StatutIcon = statutConfig.icon;

  const handleClick = () => {
    if (onSelect) {
      onSelect(chantier.id);
    } else {
      navigate(`/phase2/${chantier.id}`);
    }
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDate = (date?: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const activeAlertes = chantier.alertes.filter(a => a.niveau !== 'info');

  return (
    <Card
      className="hover:shadow-lg transition-shadow cursor-pointer group"
      onClick={handleClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {chantier.nom}
            </CardTitle>
            {chantier.reference && (
              <p className="text-sm text-muted-foreground">Réf: {chantier.reference}</p>
            )}
          </div>
          <Badge className={`${statutConfig.color} text-white`}>
            <StatutIcon className="h-3 w-3 mr-1" />
            {statutConfig.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Avancement */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Avancement global</span>
            <span className="font-medium">{chantier.avancementGlobal}%</span>
          </div>
          <Progress value={chantier.avancementGlobal} className="h-2" />
        </div>

        {/* Dates et Montant */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <p className="text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Début prévu
            </p>
            <p className="font-medium">{formatDate(chantier.dateDebutPrevue)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Fin prévue
            </p>
            <p className="font-medium">{formatDate(chantier.dateFinPrevue)}</p>
          </div>
        </div>

        {/* Montant */}
        {chantier.montantTotalHT && (
          <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Euro className="h-3.5 w-3.5" />
              Montant HT
            </span>
            <span className="font-semibold">{formatCurrency(chantier.montantTotalHT)}</span>
          </div>
        )}

        {/* Retard éventuel */}
        {chantier.retardJours && chantier.retardJours > 0 && (
          <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-2 rounded-lg">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium">
              Retard de {chantier.retardJours} jour{chantier.retardJours > 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Alertes */}
        {activeAlertes.length > 0 && (
          <div className="space-y-2">
            {activeAlertes.slice(0, 2).map((alerte, idx) => {
              const AlerteIcon = ALERTE_ICONS[alerte.type];
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
                    alerte.niveau === 'error'
                      ? 'text-red-700 bg-red-50'
                      : 'text-yellow-700 bg-yellow-50'
                  }`}
                >
                  <AlerteIcon className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{alerte.message}</span>
                </div>
              );
            })}
            {activeAlertes.length > 2 && (
              <p className="text-xs text-muted-foreground text-center">
                +{activeAlertes.length - 2} autre(s) alerte(s)
              </p>
            )}
          </div>
        )}

        {/* Action */}
        <Button
          variant="ghost"
          className="w-full group-hover:bg-primary/10"
        >
          Voir le chantier
          <ChevronRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>
      </CardContent>
    </Card>
  );
}

export default ChantierCard;

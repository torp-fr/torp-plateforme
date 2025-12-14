/**
 * OPRSessionCard - Carte de session OPR
 * Affiche le résumé et les actions pour une session d'opérations préalables à la réception
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  ClipboardCheck,
  Calendar,
  Clock,
  MapPin,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText,
  ChevronRight,
  Play,
  Pause,
  Camera,
} from 'lucide-react';
import type { OPRSession } from '@/types/phase4.types';
import { oprService } from '@/services/phase4';

interface OPRSessionCardProps {
  session: OPRSession;
  onSelect?: (session: OPRSession) => void;
  onUpdate?: () => void;
}

export function OPRSessionCard({ session, onSelect, onUpdate }: OPRSessionCardProps) {
  const [loading, setLoading] = useState(false);

  const stats = oprService.getSessionStats(session);
  const readiness = oprService.canProceedToReception(session);

  const getStatusBadge = () => {
    switch (session.statut) {
      case 'planifiee':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Planifiée</Badge>;
      case 'en_cours':
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">En cours</Badge>;
      case 'terminee':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Terminée</Badge>;
      case 'annulee':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Annulée</Badge>;
      default:
        return null;
    }
  };

  const handleStartSession = async () => {
    setLoading(true);
    await oprService.startSession(session.id);
    onUpdate?.();
    setLoading(false);
  };

  const handleEndSession = async () => {
    setLoading(true);
    await oprService.endSession(session.id);
    onUpdate?.();
    setLoading(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <ClipboardCheck className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Session OPR</CardTitle>
              <CardDescription>Opérations Préalables à la Réception</CardDescription>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Infos date/lieu */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{formatDate(session.dateOPR)}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{session.heureDebut}{session.heureFin ? ` - ${session.heureFin}` : ''}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground col-span-2">
            <MapPin className="h-4 w-4" />
            <span>{session.lieu}</span>
          </div>
        </div>

        <Separator />

        {/* Avancement */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Avancement des contrôles</span>
            <span className="font-medium">{stats.pourcentageAvancement}%</span>
          </div>
          <Progress value={stats.pourcentageAvancement} className="h-2" />
          <div className="grid grid-cols-3 gap-2 text-xs text-center">
            <div className="p-2 bg-green-50 rounded">
              <div className="font-semibold text-green-700">{stats.controlesConformes}</div>
              <div className="text-green-600">Conformes</div>
            </div>
            <div className="p-2 bg-red-50 rounded">
              <div className="font-semibold text-red-700">{stats.controlesNonConformes}</div>
              <div className="text-red-600">Non conformes</div>
            </div>
            <div className="p-2 bg-orange-50 rounded">
              <div className="font-semibold text-orange-700">{stats.controlesReserves}</div>
              <div className="text-orange-600">Réserves</div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Participants */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{session.participants.filter(p => p.present).length}/{session.participants.length} participants</span>
          </div>
          {session.convocationEnvoyee && (
            <Badge variant="secondary" className="text-xs">
              <CheckCircle className="h-3 w-3 mr-1" />
              Convocations envoyées
            </Badge>
          )}
        </div>

        {/* Réserves */}
        {stats.totalReserves > 0 && (
          <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
            <div className="flex items-center gap-2 text-orange-700 font-medium mb-2">
              <AlertTriangle className="h-4 w-4" />
              <span>{stats.totalReserves} réserve(s) émise(s)</span>
            </div>
            <div className="flex gap-4 text-xs">
              {stats.reservesMineures > 0 && (
                <span className="text-yellow-600">{stats.reservesMineures} mineures</span>
              )}
              {stats.reservesMajeures > 0 && (
                <span className="text-orange-600">{stats.reservesMajeures} majeures</span>
              )}
              {stats.reservesGraves > 0 && (
                <span className="text-red-600">{stats.reservesGraves} graves</span>
              )}
            </div>
          </div>
        )}

        {/* Documents */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>{stats.documentsPresents} documents présents</span>
          </div>
          {stats.documentsManquants > 0 && (
            <Badge variant="destructive" className="text-xs">
              {stats.documentsManquants} manquants
            </Badge>
          )}
        </div>

        {/* Alertes readiness */}
        {session.statut === 'terminee' && (
          <div className={`p-3 rounded-lg border ${readiness.canProceed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              {readiness.canProceed ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-green-700">Prêt pour la réception</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="font-medium text-red-700">Réception bloquée</span>
                </>
              )}
            </div>
            {readiness.blockers.length > 0 && (
              <ul className="text-xs text-red-600 list-disc list-inside">
                {readiness.blockers.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
            {readiness.warnings.length > 0 && (
              <ul className="text-xs text-orange-600 list-disc list-inside mt-1">
                {readiness.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2">
        {session.statut === 'planifiee' && (
          <Button onClick={handleStartSession} disabled={loading} className="flex-1">
            <Play className="h-4 w-4 mr-2" />
            Démarrer
          </Button>
        )}
        {session.statut === 'en_cours' && (
          <>
            <Button variant="outline" onClick={() => onSelect?.(session)} className="flex-1">
              <Camera className="h-4 w-4 mr-2" />
              Continuer
            </Button>
            <Button onClick={handleEndSession} disabled={loading}>
              <Pause className="h-4 w-4 mr-2" />
              Terminer
            </Button>
          </>
        )}
        {session.statut === 'terminee' && (
          <Button variant="outline" onClick={() => onSelect?.(session)} className="flex-1">
            Voir détails
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

export default OPRSessionCard;

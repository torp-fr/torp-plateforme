/**
 * Status Badge Component
 * Affiche le statut d'une analyse avec icône et couleur
 */

import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, XCircle, AlertCircle, Loader2 } from 'lucide-react';

type AnalysisStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'ERROR' | 'CANCELLED';

interface StatusBadgeProps {
  status: AnalysisStatus;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<AnalysisStatus, { label: string; icon: any; variant: any; className?: string }> = {
  PENDING: {
    label: 'En attente',
    icon: Clock,
    variant: 'outline',
    className: 'border-orange-300 text-orange-700 bg-orange-50',
  },
  PROCESSING: {
    label: 'En cours',
    icon: Loader2,
    variant: 'secondary',
    className: 'bg-blue-100 text-blue-700',
  },
  COMPLETED: {
    label: 'Terminée',
    icon: CheckCircle2,
    variant: 'default',
    className: 'bg-green-600 text-white hover:bg-green-700',
  },
  ERROR: {
    label: 'Erreur',
    icon: XCircle,
    variant: 'destructive',
    className: '',
  },
  CANCELLED: {
    label: 'Annulée',
    icon: AlertCircle,
    variant: 'outline',
    className: 'border-gray-300 text-gray-600',
  },
};

export const StatusBadge = ({ status, size = 'md' }: StatusBadgeProps) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  const Icon = config.icon;

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const iconClass = status === 'PROCESSING' ? `${iconSize} animate-spin` : iconSize;

  return (
    <Badge variant={config.variant} className={config.className}>
      <Icon className={`${iconClass} mr-1`} />
      {config.label}
    </Badge>
  );
};

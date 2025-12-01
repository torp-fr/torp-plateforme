/**
 * Priority Indicator Component
 * Affiche le niveau de priorité d'une recommandation
 */

import { Badge } from '@/components/ui/badge';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

type Priority = 'HIGH' | 'MEDIUM' | 'LOW';

interface PriorityIndicatorProps {
  priority: Priority;
  variant?: 'badge' | 'icon' | 'full';
  size?: 'sm' | 'md';
}

const PRIORITY_CONFIG: Record<Priority, { label: string; icon: any; className: string; badgeClass: string }> = {
  HIGH: {
    label: 'Priorité élevée',
    icon: AlertTriangle,
    className: 'text-red-600',
    badgeClass: 'bg-red-100 text-red-800 border-red-300',
  },
  MEDIUM: {
    label: 'Priorité moyenne',
    icon: AlertCircle,
    className: 'text-orange-600',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-300',
  },
  LOW: {
    label: 'Priorité faible',
    icon: Info,
    className: 'text-blue-600',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
  },
};

export const PriorityIndicator = ({ priority, variant = 'badge', size = 'md' }: PriorityIndicatorProps) => {
  const config = PRIORITY_CONFIG[priority];
  const Icon = config.icon;

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  if (variant === 'icon') {
    return <Icon className={`${iconSize} ${config.className}`} />;
  }

  if (variant === 'full') {
    return (
      <div className="flex items-center gap-2">
        <Icon className={`${iconSize} ${config.className}`} />
        <span className={`text-sm font-medium ${config.className}`}>{config.label}</span>
      </div>
    );
  }

  // Default: badge variant
  return (
    <Badge variant="outline" className={config.badgeClass}>
      <Icon className={`${iconSize} mr-1`} />
      {size === 'md' ? config.label : priority}
    </Badge>
  );
};

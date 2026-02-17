/**
 * EmptyState - Reusable empty state component
 * Displays when no data is available
 */

import React from 'react';
import { Database, TrendingUp } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}

export function EmptyState({
  title = 'Aucune donnée disponible',
  description = 'Les données apparaîtront ici lorsque le système sera utilisé.',
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="mb-4">
        {icon || <Database className="h-12 w-12 text-muted-foreground/50" />}
      </div>
      <h3 className="text-lg font-semibold text-muted-foreground mb-2">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground/70 max-w-xs">
        {description}
      </p>
    </div>
  );
}

export default EmptyState;

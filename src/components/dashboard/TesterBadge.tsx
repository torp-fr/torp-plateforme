/**
 * TesterBadge Component
 * Displays a badge when the app is in free testing mode
 */

import { Badge } from '@/components/ui/badge';
import { env } from '@/config/env';

export function TesterBadge() {
  // Only show in free mode
  if (!env.freeMode.enabled) return null;

  return (
    <Badge variant="default" className="bg-green-600 hover:bg-green-700 animate-pulse">
      🎉 Testeur
    </Badge>
  );
}

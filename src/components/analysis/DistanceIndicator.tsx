import { useState, useEffect } from 'react';
import { geocodingService, DistanceResult } from '@/services/api/geocoding.service';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Navigation, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  entrepriseAddress?: string | null;
  chantierAddress?: string | null;
  onDistanceCalculated?: (result: DistanceResult | null) => void;
  className?: string;
}

export function DistanceIndicator({
  entrepriseAddress,
  chantierAddress,
  onDistanceCalculated,
  className,
}: Props) {
  const [result, setResult] = useState<DistanceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!entrepriseAddress || !chantierAddress) {
      setResult(null);
      return;
    }

    calculateDistance();
  }, [entrepriseAddress, chantierAddress]);

  async function calculateDistance() {
    setLoading(true);
    setError(null);

    try {
      const distanceResult = await geocodingService.calculateDistance(
        entrepriseAddress!,
        chantierAddress!
      );

      if (distanceResult.success && distanceResult.data) {
        setResult(distanceResult.data);
        onDistanceCalculated?.(distanceResult.data);
      } else {
        setError(distanceResult.error || 'Impossible de calculer la distance');
        onDistanceCalculated?.(null);
      }
    } catch (err) {
      setError('Erreur lors du calcul de distance');
      onDistanceCalculated?.(null);
    } finally {
      setLoading(false);
    }
  }

  if (!entrepriseAddress || !chantierAddress) {
    return null;
  }

  if (loading) {
    return (
      <Card className={cn("p-4", className)}>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("p-4 border-orange-200 bg-orange-50", className)}>
        <div className="flex items-center gap-2 text-orange-700">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      </Card>
    );
  }

  if (!result) return null;

  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-start gap-4">
        {/* Icon avec zone */}
        <div className={cn(
          "flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center",
          getZoneColor(result.zone?.type)
        )}>
          <Navigation className="h-6 w-6" />
        </div>

        {/* Infos distance */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold">{result.distanceFormatee}</span>
            {result.zone && (
              <Badge variant={getZoneBadgeVariant(result.zone.type)}>
                {result.zone.label}
              </Badge>
            )}
          </div>

          {/* Durée estimée */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{result.dureeEstimee}</span>
          </div>

          {/* Adresses */}
          <div className="grid sm:grid-cols-2 gap-2 text-xs pt-2 border-t">
            <div className="flex items-start gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-blue-500 mt-0.5" />
              <div>
                <p className="font-medium text-muted-foreground">Entreprise</p>
                <p className="truncate">{entrepriseAddress}</p>
              </div>
            </div>
            <div className="flex items-start gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium text-muted-foreground">Chantier</p>
                <p className="truncate">{chantierAddress}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Helpers
function getZoneColor(zoneType?: string): string {
  switch (zoneType) {
    case 'proximite':
      return 'bg-green-100 text-green-700';
    case 'locale':
      return 'bg-blue-100 text-blue-700';
    case 'regionale':
      return 'bg-yellow-100 text-yellow-700';
    case 'nationale':
      return 'bg-orange-100 text-orange-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function getZoneBadgeVariant(zoneType?: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (zoneType) {
    case 'proximite':
    case 'locale':
      return 'default';
    case 'regionale':
      return 'secondary';
    case 'nationale':
      return 'destructive';
    default:
      return 'outline';
  }
}

export default DistanceIndicator;
